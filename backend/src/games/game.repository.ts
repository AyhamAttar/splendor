import { Injectable } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma, type GameStatus } from "@prisma/client";
import type { AuthenticatedIdentity } from "../auth/types";
import type { GameState, TurnCommand } from "@splendor/engine";
import { PrismaService } from "../prisma/prisma.service";
import { summarizeGame } from "./match-summary";

/** The subset of a stored game the games service needs. */
export interface StoredGame {
  state: GameState;
  sessionToken: string;
  online: boolean;
}

/** A move to append to the append-only log alongside a state update. */
export interface MoveRecord {
  /** Engine turn number BEFORE the command was applied. */
  turnNumber: number;
  /** Seat (player index) that made the move. */
  seatIndex: number;
  command: TurnCommand;
}

/** Single home for the engine-status → Prisma-enum mapping. */
function toDbStatus(status: GameState["status"]): GameStatus {
  return status === "finished" ? "FINISHED" : "ACTIVE";
}

/**
 * Durable, DB-backed game store (replaces the former in-memory Map). Pure data
 * access: create / read / update / delete plus the idle-sweep query — the timer
 * that drives sweeping lives in GameSweeper. Games now survive an API restart.
 */
@Injectable()
export class GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  newGameId(): string {
    return randomUUID();
  }

  async create(
    state: GameState,
  ): Promise<{ gameId: string; sessionToken: string }> {
    const sessionToken = randomBytes(24).toString("base64url");
    await this.prisma.game.create({
      data: {
        id: state.id,
        seed: state.seed,
        status: toDbStatus(state.status),
        turnNumber: state.turnNumber,
        state: state as unknown as Prisma.InputJsonValue,
        sessionToken,
        players: {
          create: state.players.map((p, seatIndex) => ({
            seatIndex,
            name: p.name,
          })),
        },
      },
    });
    return { gameId: state.id, sessionToken };
  }

  /**
   * Create an ONLINE game whose seats are owned by identities (Phase 3 lobby /
   * matchmaking). `participants[seatIndex]` maps engine seat → owning identity;
   * `online` is set so seat-ownership checks, redaction, and WS push all engage.
   */
  async createOnline(
    state: GameState,
    participants: {
      userId?: string | null;
      guestId?: string | null;
      name: string;
    }[],
  ): Promise<{ gameId: string; sessionToken: string }> {
    const sessionToken = randomBytes(24).toString("base64url");
    await this.prisma.game.create({
      data: {
        id: state.id,
        seed: state.seed,
        status: toDbStatus(state.status),
        turnNumber: state.turnNumber,
        state: state as unknown as Prisma.InputJsonValue,
        sessionToken,
        online: true,
        players: {
          create: state.players.map((p, seatIndex) => ({
            seatIndex,
            name: p.name,
            userId: participants[seatIndex]?.userId ?? null,
            guestId: participants[seatIndex]?.guestId ?? null,
          })),
        },
      },
    });
    return { gameId: state.id, sessionToken };
  }

  async getByGameId(gameId: string): Promise<StoredGame | undefined> {
    const row = await this.prisma.game.findUnique({ where: { id: gameId } });
    return row ? this.toStored(row) : undefined;
  }

  async getBySession(token: string): Promise<StoredGame | undefined> {
    const row = await this.prisma.game.findUnique({
      where: { sessionToken: token },
    });
    return row ? this.toStored(row) : undefined;
  }

  /** Fetch only the session token — for auth checks that don't need full state. */
  async getSessionToken(gameId: string): Promise<string | undefined> {
    const row = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { sessionToken: true },
    });
    return row?.sessionToken;
  }

  /**
   * Resolve the seat index (0-based) owned by the given identity in an online
   * game. Returns `null` when the identity is not a participant (spectator).
   */
  async getSeatForIdentity(
    gameId: string,
    identity: AuthenticatedIdentity,
  ): Promise<number | null> {
    const row = await this.prisma.gamePlayer.findFirst({
      where: {
        gameId,
        ...(identity.userId
          ? { userId: identity.userId }
          : { guestId: identity.guestId }),
      },
      select: { seatIndex: true },
    });
    return row?.seatIndex ?? null;
  }

  /** Persist the new authoritative state and (optionally) append the move. When
   *  the incoming state is FINISHED, the immutable MatchResult is written in the
   *  same transaction so "game is finished" ⇔ "history row exists" is atomic. */
  async update(
    gameId: string,
    state: GameState,
    move?: MoveRecord,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id: gameId },
        data: {
          state: state as unknown as Prisma.InputJsonValue,
          turnNumber: state.turnNumber,
          status: toDbStatus(state.status),
        },
      });
      if (move) {
        await tx.move.create({
          data: {
            gameId,
            turnNumber: move.turnNumber,
            seatIndex: move.seatIndex,
            command: move.command as unknown as Prisma.InputJsonValue,
          },
        });
      }
      if (state.status === "finished") {
        await this.recordResult(tx, gameId, state);
      }
    });
  }

  /**
   * Write the match-history summary for a just-finished game (Phase 4). Runs
   * inside the finishing turn's transaction. Idempotent: a MatchResult already
   * exists for the game → no-op, so a retried/replayed finish can't duplicate.
   */
  private async recordResult(
    tx: Prisma.TransactionClient,
    gameId: string,
    state: GameState,
  ): Promise<void> {
    const existing = await tx.matchResult.findUnique({
      where: { gameId },
      select: { id: true },
    });
    if (existing) return;

    const game = await tx.game.findUnique({
      where: { id: gameId },
      select: {
        createdAt: true,
        players: { select: { seatIndex: true, userId: true, guestId: true } },
      },
    });
    if (!game) return;

    const { winners, summary } = summarizeGame(
      state,
      game.players,
      game.createdAt,
      new Date(),
    );
    await tx.matchResult.create({
      data: {
        gameId,
        winners: winners as unknown as Prisma.InputJsonValue,
        summary: summary as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async delete(gameId: string): Promise<void> {
    // Cascade removes players and moves. Already-gone is not an error.
    await this.prisma.game
      .delete({ where: { id: gameId } })
      .catch(() => undefined);
  }

  /**
   * Delete ACTIVE games idle since before `cutoff`; returns how many were
   * removed. FINISHED games are retained: their `MatchResult` (cascade-linked)
   * is durable match history, and `seed` + `Move` log keep replay possible
   * (Phase 4). Bounding retention of finished games is a later-phase concern.
   */
  async deleteIdle(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.game.deleteMany({
      where: { status: "ACTIVE", updatedAt: { lt: cutoff } },
    });
    return count;
  }

  private toStored(row: {
    state: Prisma.JsonValue;
    sessionToken: string;
    online: boolean;
  }): StoredGame {
    return {
      state: row.state as unknown as GameState,
      sessionToken: row.sessionToken,
      online: row.online,
    };
  }
}
