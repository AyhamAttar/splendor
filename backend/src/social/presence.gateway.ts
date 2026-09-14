import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Injectable } from "@nestjs/common";
import type { Namespace, Socket } from "socket.io";
import { SocketIdentityService } from "../auth/socket-identity.service";
import { FriendsRepository } from "./friends.repository";
import { PresenceTracker } from "./presence.tracker";
import type { RequestView, RoomInvitePush } from "./friends.types";

/** Per-user room on the social namespace; every one of a user's tabs joins it. */
const USER = (userId: string) => `user:${userId}`;

interface SocialSocketData {
  userId: string;
  /** The user's accepted-friend ids, cached at connect so the disconnect
   *  fan-out doesn't re-query. */
  friendIds: string[];
}

/**
 * Social realtime channel (Phase 4): per-user presence + notifications, isolated
 * on its own `/social` namespace so it never intercepts the game / lobby sockets
 * that share the default namespace (a presence gateway there would disconnect
 * guest players, who have no account). Only signed-in users connect here.
 *
 * Server → client events:
 *  - `social:ready`   { online: string[] } — which of your friends are online now.
 *  - `friend:presence`{ userId, online }   — a friend came online / went offline.
 *  - `friend:request` RequestView          — someone sent you a friend request.
 *  - `friend:changed` {}                    — your friend graph changed; refetch.
 *  - `room:invite`    RoomInvitePush        — a friend invited you to a room.
 */
// CORS for the socket is enforced centrally by CorsIoAdapter (env allow-list).
@Injectable()
@WebSocketGateway({ namespace: "/social" })
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Namespace;

  constructor(
    private readonly identities: SocketIdentityService,
    private readonly friends: FriendsRepository,
    private readonly presence: PresenceTracker,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const identity = await this.identities.resolve(socket);
      // Social presence is account-only; guests (and anonymous) have no friends.
      if (!identity?.userId) {
        socket.disconnect(true);
        return;
      }
      const userId = identity.userId;

      // Resolve friends BEFORE marking the socket tracked, so a transient DB
      // failure can't leave a phantom userId that handleDisconnect would act on.
      const friendIds = await this.friends.friendIds(userId);

      const data = socket.data as SocialSocketData;
      data.userId = userId;
      data.friendIds = friendIds;
      await socket.join(USER(userId));

      // Tell the arriving client which of its friends are currently online.
      socket.emit("social:ready", { online: this.presence.onlineAmong(friendIds) });

      // On the 0 → 1 transition, tell online friends this user is now online.
      if (this.presence.add(userId)) {
        for (const fid of friendIds) {
          this.server.to(USER(fid)).emit("friend:presence", { userId, online: true });
        }
      }
    } catch {
      // e.g. a DB error resolving identity/friends — drop the socket cleanly so
      // the client reconnects; no phantom presence state is left behind.
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const data = socket.data as Partial<SocialSocketData>;
    if (!data.userId) return;
    // On the 1 → 0 transition, tell online friends this user went offline —
    // reusing the friend ids cached at connect (no disconnect-time DB query).
    if (this.presence.remove(data.userId)) {
      for (const fid of data.friendIds ?? []) {
        this.server.to(USER(fid)).emit("friend:presence", {
          userId: data.userId,
          online: false,
        });
      }
    }
  }

  // --- Server → client push (called by FriendsService) -----------------------

  notifyFriendRequest(addresseeId: string, request: RequestView): void {
    this.server?.to(USER(addresseeId)).emit("friend:request", request);
  }

  /** Tell a user their friend graph changed so the client refetches /friends. */
  notifyFriendChanged(userId: string): void {
    this.server?.to(USER(userId)).emit("friend:changed", {});
  }

  notifyRoomInvite(friendUserId: string, invite: RoomInvitePush): void {
    this.server?.to(USER(friendUserId)).emit("room:invite", invite);
  }
}
