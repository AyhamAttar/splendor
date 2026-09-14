import { Injectable } from "@nestjs/common";
import { type Friendship, FriendshipStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Public columns of a user embedded in a friendship/request view. */
export interface PublicUserRow {
  id: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
  createdAt: Date;
}

const publicUserSelect = {
  id: true,
  displayName: true,
  handle: true,
  avatar: true,
  createdAt: true,
} as const;

/** Join both endpoints' public profiles onto a friendship row. */
const withEndpoints = {
  requester: { select: publicUserSelect },
  addressee: { select: publicUserSelect },
} as const;

/** A friendship row with both endpoints' public profiles joined in. */
export type FriendshipWithUsers = Friendship & {
  requester: PublicUserRow;
  addressee: PublicUserRow;
};

/**
 * Data access for the Friendship edge table (Phase 4). One row per ordered
 * `(requester, addressee)` pair; a pair has at most one edge in either
 * direction (the service enforces this). Pure persistence — the relationship
 * rules live in FriendsService.
 */
@Injectable()
export class FriendsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByHandle(handle: string): Promise<PublicUserRow | null> {
    return this.prisma.user.findUnique({
      where: { handle },
      select: publicUserSelect,
    });
  }

  findById(id: string): Promise<FriendshipWithUsers | null> {
    return this.prisma.friendship.findUnique({
      where: { id },
      include: withEndpoints,
    });
  }

  /**
   * The single NON-blocked edge (PENDING or ACCEPTED) between two users, in
   * either direction. Blocks are excluded because each party can independently
   * hold their own BLOCKED edge — see `findBlocks`. At most one non-blocked edge
   * per unordered pair exists.
   */
  findRelationship(a: string, b: string): Promise<FriendshipWithUsers | null> {
    return this.prisma.friendship.findFirst({
      where: {
        status: { in: [FriendshipStatus.PENDING, FriendshipStatus.ACCEPTED] },
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
      include: withEndpoints,
    });
  }

  /** BLOCKED edges between the pair (0–2 rows; each party may block the other). */
  findBlocks(
    a: string,
    b: string,
  ): Promise<{ requesterId: string; addresseeId: string }[]> {
    return this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.BLOCKED,
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
      select: { requesterId: true, addresseeId: true },
    });
  }

  createRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<FriendshipWithUsers> {
    return this.prisma.friendship.create({
      data: { requesterId, addresseeId, status: FriendshipStatus.PENDING },
      include: withEndpoints,
    });
  }

  /** Accept a PENDING request. Returns false if the row was concurrently
   *  removed / already resolved (scoped to PENDING), so callers can 404 rather
   *  than surface a Prisma P2025. */
  async accept(id: string): Promise<boolean> {
    const { count } = await this.prisma.friendship.updateMany({
      where: { id, status: FriendshipStatus.PENDING },
      data: { status: FriendshipStatus.ACCEPTED },
    });
    return count > 0;
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.friendship.delete({ where: { id } }).catch(() => undefined);
  }

  /**
   * Block `blockedId`: sever any non-blocked relationship and record the
   * blocker's own BLOCKED edge. Atomic. Crucially it does NOT touch the OTHER
   * party's BLOCKED edge (blockedId → blockerId), so a blocked user can't clear
   * the blocker's block by re-blocking then unblocking. `upsert` makes a
   * concurrent duplicate block idempotent (each party owns exactly one edge).
   */
  async block(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Drop the other party's inbound PENDING/ACCEPTED edge toward the blocker.
      await tx.friendship.deleteMany({
        where: {
          requesterId: blockedId,
          addresseeId: blockerId,
          status: { in: [FriendshipStatus.PENDING, FriendshipStatus.ACCEPTED] },
        },
      });
      // Set (or create) the blocker's own edge to BLOCKED.
      await tx.friendship.upsert({
        where: {
          requesterId_addresseeId: {
            requesterId: blockerId,
            addresseeId: blockedId,
          },
        },
        create: {
          requesterId: blockerId,
          addresseeId: blockedId,
          status: FriendshipStatus.BLOCKED,
        },
        update: { status: FriendshipStatus.BLOCKED },
      });
    });
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.friendship.deleteMany({
      where: {
        requesterId: blockerId,
        addresseeId: blockedId,
        status: FriendshipStatus.BLOCKED,
      },
    });
  }

  listAccepted(userId: string): Promise<FriendshipWithUsers[]> {
    return this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: withEndpoints,
      orderBy: { updatedAt: "desc" },
    });
  }

  listIncoming(userId: string): Promise<FriendshipWithUsers[]> {
    return this.prisma.friendship.findMany({
      where: { status: FriendshipStatus.PENDING, addresseeId: userId },
      include: withEndpoints,
      orderBy: { createdAt: "desc" },
    });
  }

  listOutgoing(userId: string): Promise<FriendshipWithUsers[]> {
    return this.prisma.friendship.findMany({
      where: { status: FriendshipStatus.PENDING, requesterId: userId },
      include: withEndpoints,
      orderBy: { createdAt: "desc" },
    });
  }

  listBlocked(userId: string): Promise<FriendshipWithUsers[]> {
    return this.prisma.friendship.findMany({
      where: { status: FriendshipStatus.BLOCKED, requesterId: userId },
      include: withEndpoints,
      orderBy: { updatedAt: "desc" },
    });
  }

  /** Ids of a user's accepted friends — the fan-out set for presence events. */
  async friendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  }
}
