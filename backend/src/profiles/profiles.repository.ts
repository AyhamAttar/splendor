import { Injectable } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** A user row plus (if any) the guest identity they upgraded from. */
export type UserWithGuest = User & { guest: { id: string } | null };

/** One stored match result row, as read for history/stats. */
export interface StoredResult {
  id: string;
  gameId: string;
  finishedAt: Date;
  summary: Prisma.JsonValue;
}

/**
 * Data access for profiles + match history (Phase 4). Pure persistence; stat
 * aggregation and validation live in ProfilesService. History/stat queries key
 * off the seat's owning identity — either the account directly OR the guest id
 * it was upgraded from — so a user keeps games they played before signing up.
 */
@Injectable()
export class ProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<UserWithGuest | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { guest: { select: { id: true } } },
    });
  }

  findByHandle(handle: string): Promise<UserWithGuest | null> {
    return this.prisma.user.findUnique({
      where: { handle },
      include: { guest: { select: { id: true } } },
    });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /** Games a user (or their former guest identity) took part in. */
  private ownedBy(
    userId: string,
    guestId: string | null,
  ): Prisma.GamePlayerWhereInput {
    return { OR: [{ userId }, ...(guestId ? [{ guestId }] : [])] };
  }

  /** Page of a user's finished games, newest first. */
  listResults(
    userId: string,
    guestId: string | null,
    take: number,
    cursor?: string,
  ): Promise<StoredResult[]> {
    return this.prisma.matchResult.findMany({
      where: { game: { players: { some: this.ownedBy(userId, guestId) } } },
      orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, gameId: true, finishedAt: true, summary: true },
    });
  }

  /** Every summary for a user — the input to aggregate stats. */
  async allSummaries(
    userId: string,
    guestId: string | null,
  ): Promise<Prisma.JsonValue[]> {
    const rows = await this.prisma.matchResult.findMany({
      where: { game: { players: { some: this.ownedBy(userId, guestId) } } },
      select: { summary: true },
    });
    return rows.map((r) => r.summary);
  }
}
