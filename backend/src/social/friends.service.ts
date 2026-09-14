import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { FriendshipStatus } from "@prisma/client";
import { RoomRepository } from "../rooms/room.repository";
import { isPrismaError } from "../prisma/prisma-errors";
import { FriendsRepository } from "./friends.repository";
import { PresenceGateway } from "./presence.gateway";
import { PresenceTracker } from "./presence.tracker";
import {
  otherUser,
  toBlockedView,
  toFriendView,
  toRequestView,
} from "./friends.mapper";
import type { FriendsOverview, SendRequestResult } from "./friends.types";

/**
 * Friends & blocking (Phase 4, user-only). Enforces "at most one NON-blocked
 * relationship per pair" while letting each party independently block the other,
 * and fans out realtime notifications (request / graph-changed / room-invite)
 * through PresenceGateway. Presence for the friend list is read from the
 * in-memory PresenceTracker.
 */
@Injectable()
export class FriendsService {
  constructor(
    private readonly repo: FriendsRepository,
    private readonly rooms: RoomRepository,
    private readonly presence: PresenceGateway,
    private readonly tracker: PresenceTracker,
  ) {}

  async overview(userId: string): Promise<FriendsOverview> {
    const [accepted, incoming, outgoing, blocked] = await Promise.all([
      this.repo.listAccepted(userId),
      this.repo.listIncoming(userId),
      this.repo.listOutgoing(userId),
      this.repo.listBlocked(userId),
    ]);
    return {
      friends: accepted.map((e) => toFriendView(e, userId, this.tracker)),
      incoming: incoming.map((e) => toRequestView(e, userId)),
      outgoing: outgoing.map((e) => toRequestView(e, userId)),
      blocked: blocked.map((e) => toBlockedView(e, userId)),
    };
  }

  /**
   * Send a friend request by handle. If the target has already requested the
   * caller, the pair auto-accepts (mutual). Blocks in either direction are
   * refused (staying generic when the caller is the blocked party).
   */
  async sendRequestByHandle(
    userId: string,
    rawHandle: string,
  ): Promise<SendRequestResult> {
    const handle = rawHandle.trim().toLowerCase();
    const target = await this.repo.findByHandle(handle);
    if (!target) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "No user with that handle.",
      });
    }
    if (target.id === userId) {
      throw new BadRequestException({
        code: "CANNOT_FRIEND_SELF",
        message: "You can't add yourself.",
      });
    }

    const blocks = await this.repo.findBlocks(userId, target.id);
    if (blocks.some((b) => b.requesterId === userId)) {
      throw new ConflictException({
        code: "BLOCKED_BY_YOU",
        message: "Unblock this user before adding them.",
      });
    }
    if (blocks.length > 0) {
      // The caller has been blocked — stay generic, don't reveal the block.
      throw new ForbiddenException({
        code: "REQUEST_BLOCKED",
        message: "Unable to send a request to this user.",
      });
    }

    const rel = await this.repo.findRelationship(userId, target.id);
    if (rel) {
      if (rel.status === FriendshipStatus.ACCEPTED) {
        throw new ConflictException({
          code: "ALREADY_FRIENDS",
          message: "You're already friends.",
        });
      }
      if (rel.requesterId === userId) {
        throw new ConflictException({
          code: "REQUEST_ALREADY_SENT",
          message: "You've already sent them a request.",
        });
      }
      // They already requested us — accept it (becomes a mutual friendship).
      if (await this.repo.accept(rel.id)) {
        this.presence.notifyFriendChanged(rel.requesterId);
        return { accepted: true };
      }
      // Their request vanished concurrently — fall through and send a fresh one.
    }

    try {
      const created = await this.repo.createRequest(userId, target.id);
      this.presence.notifyFriendRequest(target.id, toRequestView(created, target.id));
      return { accepted: false };
    } catch (e) {
      // A concurrent request created the same edge first.
      if (isPrismaError(e, "P2002")) {
        throw new ConflictException({
          code: "REQUEST_ALREADY_SENT",
          message: "You've already sent them a request.",
        });
      }
      throw e;
    }
  }

  async accept(userId: string, requestId: string): Promise<void> {
    const req = await this.repo.findById(requestId);
    if (
      !req ||
      req.status !== FriendshipStatus.PENDING ||
      req.addresseeId !== userId
    ) {
      throw this.requestNotFound();
    }
    if (!(await this.repo.accept(req.id))) throw this.requestNotFound();
    this.presence.notifyFriendChanged(req.requesterId);
  }

  async decline(userId: string, requestId: string): Promise<void> {
    const req = await this.repo.findById(requestId);
    if (
      !req ||
      req.status !== FriendshipStatus.PENDING ||
      req.addresseeId !== userId
    ) {
      throw this.requestNotFound();
    }
    await this.repo.deleteById(req.id);
    this.presence.notifyFriendChanged(req.requesterId);
  }

  /** Remove a friend, cancel an outgoing request, or decline an incoming one —
   *  the pair's non-blocked edge, if any. Blocks are managed via block/unblock.
   *  Idempotent. */
  async removeOrCancel(userId: string, otherUserId: string): Promise<void> {
    const rel = await this.repo.findRelationship(userId, otherUserId);
    if (!rel) return;
    await this.repo.deleteById(rel.id);
    this.presence.notifyFriendChanged(otherUserId);
  }

  async block(userId: string, otherUserId: string): Promise<void> {
    if (userId === otherUserId) {
      throw new BadRequestException({
        code: "CANNOT_BLOCK_SELF",
        message: "You can't block yourself.",
      });
    }
    try {
      await this.repo.block(userId, otherUserId);
    } catch (e) {
      // Foreign-key violation ⇒ no such user to block.
      if (isPrismaError(e, "P2003")) {
        throw new NotFoundException({
          code: "USER_NOT_FOUND",
          message: "No such user.",
        });
      }
      // Concurrent duplicate block ⇒ already blocked; idempotent success.
      if (isPrismaError(e, "P2002")) return;
      throw e;
    }
    this.presence.notifyFriendChanged(otherUserId);
  }

  async unblock(userId: string, otherUserId: string): Promise<void> {
    await this.repo.unblock(userId, otherUserId);
  }

  /** Push a room invite to a friend's live social sockets. Requires an accepted
   *  friendship AND that the caller is currently a member of the room. */
  async inviteToRoom(
    userId: string,
    friendUserId: string,
    code: string,
  ): Promise<void> {
    const rel = await this.repo.findRelationship(userId, friendUserId);
    if (!rel || rel.status !== FriendshipStatus.ACCEPTED) {
      throw new ForbiddenException({
        code: "NOT_FRIENDS",
        message: "You can only invite friends.",
      });
    }

    const normalizedCode = code.trim().toUpperCase();
    const room = await this.rooms.findByCode(normalizedCode);
    if (!room) {
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "Room not found.",
      });
    }
    if (!room.members.some((mem) => mem.userId === userId)) {
      throw new ForbiddenException({
        code: "NOT_IN_ROOM",
        message: "You can only invite friends to a room you're in.",
      });
    }

    const me = otherUser(rel, friendUserId); // the endpoint that isn't the friend
    this.presence.notifyRoomInvite(friendUserId, {
      code: normalizedCode,
      from: {
        userId: me.id,
        displayName: me.displayName,
        handle: me.handle,
        avatar: me.avatar,
      },
    });
  }

  private requestNotFound(): NotFoundException {
    return new NotFoundException({
      code: "REQUEST_NOT_FOUND",
      message: "No such pending request.",
    });
  }
}
