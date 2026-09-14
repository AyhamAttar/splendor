import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { MatchPlayerSummary, MatchSummary } from "../games/match-summary";
import { isPrismaError } from "../prisma/prisma-errors";
import { toUserProfile } from "../auth/user-profile.mapper";
import type { UserProfile } from "../auth/types";
import { ProfilesRepository, type UserWithGuest } from "./profiles.repository";
import { computeStats } from "./profile-stats";
import { toPublicProfile } from "./profiles.mapper";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import type {
  MatchHistoryEntry,
  MatchHistoryPage,
  ProfileView,
  PublicProfile,
} from "./profiles.types";

export const HISTORY_DEFAULT_LIMIT = 20;
const HISTORY_MAX_LIMIT = 50;

/**
 * Public profiles, editable self-profile, handle lookup, and per-user match
 * history + aggregate stats (Phase 4). Reads MatchResult summaries written by
 * the games layer; never touches live game state.
 */
@Injectable()
export class ProfilesService {
  constructor(private readonly repo: ProfilesRepository) {}

  /** Public profile + lifetime stats for any user. */
  async getProfile(id: string): Promise<ProfileView> {
    const user = await this.requireUser(id);
    const guestId = user.guest?.id ?? null;
    const summaries = (await this.repo.allSummaries(user.id, guestId)).map(
      (s) => s as unknown as MatchSummary,
    );
    const stats = computeStats(summaries, this.mineMatcher(user));
    return { profile: toPublicProfile(user), stats };
  }

  /** A page of a user's finished games, newest first. */
  async getHistory(
    id: string,
    limit: number,
    cursor?: string,
  ): Promise<MatchHistoryPage> {
    const user = await this.requireUser(id);
    const guestId = user.guest?.id ?? null;
    const take = Math.min(Math.max(Math.trunc(limit) || HISTORY_DEFAULT_LIMIT, 1), HISTORY_MAX_LIMIT);
    const isMine = this.mineMatcher(user);

    // Over-fetch by one to detect whether another page exists.
    const rows = await this.repo.listResults(user.id, guestId, take + 1, cursor);
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    const entries: MatchHistoryEntry[] = page.map((r) => {
      const s = r.summary as unknown as MatchSummary;
      const mine = s.players.find(isMine) ?? null;
      return {
        gameId: r.gameId,
        finishedAt: r.finishedAt,
        seed: s.seed,
        turnNumber: s.turnNumber,
        durationMs: s.durationMs,
        players: s.players.map((p) => ({
          seatIndex: p.seatIndex,
          name: p.name,
          userId: p.userId,
          prestige: p.prestige,
          cards: p.cards,
          nobles: p.nobles,
          won: p.won,
        })),
        winnerSeatIndices: s.players.filter((p) => p.won).map((p) => p.seatIndex),
        yourSeatIndex: mine?.seatIndex ?? null,
      };
    });

    return {
      entries,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Resolve a handle to a public profile (add-friend preview). */
  async lookupByHandle(handle: string): Promise<PublicProfile | null> {
    const normalized = handle.trim().toLowerCase();
    if (!normalized) return null;
    const user = await this.repo.findByHandle(normalized);
    return user ? toPublicProfile(user) : null;
  }

  /** Update the caller's own editable profile fields. */
  async updateMe(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName === "" ? null : dto.displayName.trim();
    }
    if (dto.avatar !== undefined) {
      data.avatar = dto.avatar === "" ? null : dto.avatar.trim();
    }
    if (dto.handle !== undefined) {
      data.handle = dto.handle.trim().toLowerCase();
    }

    try {
      const user = await this.repo.update(userId, data);
      return toUserProfile(user);
    } catch (e) {
      if (isPrismaError(e, "P2002")) {
        throw new ConflictException({
          code: "HANDLE_TAKEN",
          message: "That handle is already taken.",
        });
      }
      throw e;
    }
  }

  // --- helpers ---------------------------------------------------------------

  private async requireUser(id: string): Promise<UserWithGuest> {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "No such user.",
      });
    }
    return user;
  }

  /** Match a summary seat to this user (account id OR upgraded-from guest id). */
  private mineMatcher(
    user: UserWithGuest,
  ): (p: MatchPlayerSummary) => boolean {
    const guestId = user.guest?.id ?? null;
    return (p) =>
      p.userId === user.id || (guestId !== null && p.guestId === guestId);
  }
}
