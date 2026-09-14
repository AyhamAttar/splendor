import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { randomInt } from "node:crypto";
import {
  applyTurn,
  createGame,
  redactStateFor,
  type GameState,
  type RedactedGameState,
  type TurnCommand,
} from "@splendor/engine";
import { GameRepository, type StoredGame } from "./game.repository";
import { GameGateway } from "./game.gateway";
import { CreateGameDto } from "./dto/create-game.dto";
import { TurnCommandDto } from "./dto/turn-command.dto";
import { engineErrorToHttp } from "./engine-error.mapper";
import { MetricsService } from "../metrics/metrics.service";
import type { AuthenticatedIdentity } from "../auth/types";

@Injectable()
export class GamesService {
  constructor(
    private readonly store: GameRepository,
    private readonly moduleRef: ModuleRef,
    private readonly metrics: MetricsService,
  ) {}

  private getGateway(): GameGateway | null {
    try {
      return this.moduleRef.get(GameGateway, { strict: false });
    } catch {
      return null;
    }
  }

  async create(dto: CreateGameDto): Promise<{
    gameId: string;
    sessionToken: string;
    state: GameState;
  }> {
    const seed = dto.seed ?? randomInt(0, 2 ** 31 - 1);
    const id = this.store.newGameId();
    let state: GameState;
    try {
      state = createGame({ id, playerNames: dto.playerNames, seed });
    } catch (e) {
      throw new ConflictException({
        code: "SETUP_FAILED",
        message: (e as Error).message,
      });
    }
    const { gameId, sessionToken } = await this.store.create(state);
    return { gameId, sessionToken, state };
  }

  /**
   * Create an ONLINE game with each seat pre-mapped to a participant identity.
   * Called by the lobby (room start) and matchmaking — never from the public
   * create endpoint, so hotseat `POST /games` is unaffected. Seat order is the
   * order of `participants` (participant 0 becomes the host seat / first turn).
   */
  async createOnline(
    participants: { identity: AuthenticatedIdentity; name: string }[],
    seed?: number,
  ): Promise<{ gameId: string; state: GameState }> {
    const resolvedSeed = seed ?? randomInt(0, 2 ** 31 - 1);
    const id = this.store.newGameId();
    let state: GameState;
    try {
      state = createGame({
        id,
        playerNames: participants.map((p) => p.name),
        seed: resolvedSeed,
      });
    } catch (e) {
      throw new ConflictException({
        code: "SETUP_FAILED",
        message: (e as Error).message,
      });
    }
    const { gameId } = await this.store.createOnline(
      state,
      participants.map((p) => ({
        userId: p.identity.userId ?? null,
        guestId: p.identity.guestId ?? null,
        name: p.name,
      })),
    );
    return { gameId, state };
  }

  async getState(
    gameId: string,
    token: string,
    identity?: AuthenticatedIdentity,
  ): Promise<{ state: GameState | RedactedGameState; seat?: number | null }> {
    const g = await this.loadGame(gameId);

    if (g.online) {
      this.requireIdentity(identity);
      const seat = await this.store.getSeatForIdentity(gameId, identity!);
      return { state: redactStateFor(g.state, seat), seat };
    }

    // Legacy hotseat path — unchanged.
    this.authorize(g.sessionToken, token);
    return { state: g.state };
  }

  async resume(token: string): Promise<{ gameId: string; state: GameState }> {
    const g = await this.store.getBySession(token);
    if (!g) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "No game for this session.",
      });
    }
    return { gameId: g.state.id, state: g.state };
  }

  async act(
    gameId: string,
    token: string,
    dto: TurnCommandDto,
    identity?: AuthenticatedIdentity,
  ): Promise<{ state: GameState | RedactedGameState; seat?: number | null }> {
    const g = await this.loadGame(gameId);

    if (g.online) {
      this.requireIdentity(identity);
      const seat = await this.store.getSeatForIdentity(gameId, identity!);
      if (seat === null) {
        throw new ForbiddenException({
          code: "NOT_A_PLAYER",
          message: "You are not a participant in this game.",
        });
      }
      if (seat !== g.state.currentPlayer) {
        throw new ForbiddenException({
          code: "NOT_YOUR_TURN",
          message: "It is not your turn.",
        });
      }
      return this.applyAndReturn(g, dto, gameId, seat);
    }

    // Legacy hotseat path — unchanged.
    this.authorize(g.sessionToken, token);
    return this.applyAndReturn(g, dto, gameId, null);
  }

  async remove(
    gameId: string,
    token: string,
    identity?: AuthenticatedIdentity,
  ): Promise<void> {
    const g = await this.loadGame(gameId);

    if (g.online) {
      this.requireIdentity(identity);
      const seat = await this.store.getSeatForIdentity(gameId, identity!);
      if (seat !== 0) {
        // Only the host (seat 0) may delete the game.
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "Only the host may delete this game.",
        });
      }
      await this.store.delete(gameId);
      return;
    }

    this.authorize(g.sessionToken, token);
    await this.store.delete(gameId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async applyAndReturn(
    g: StoredGame,
    dto: TurnCommandDto,
    gameId: string,
    actorSeat: number | null,
  ): Promise<{ state: GameState | RedactedGameState; seat?: number | null }> {
    if (g.state.status === "finished") {
      throw new ConflictException({
        code: "GAME_FINISHED",
        message: "The game is already over.",
      });
    }
    if (dto.expectedTurn !== g.state.turnNumber) {
      throw new ConflictException({
        code: "STALE_TURN",
        message: "The game state has moved on; refresh.",
        currentTurn: g.state.turnNumber,
      });
    }

    const command: TurnCommand = {
      action: dto.action,
      returnTokens: dto.returnTokens,
      nobleId: dto.nobleId,
    };
    const startedAt = process.hrtime.bigint();
    const result = applyTurn(g.state, command);
    if (!result.ok) throw engineErrorToHttp(result.error);

    await this.store.update(gameId, result.state, {
      turnNumber: g.state.turnNumber,
      seatIndex: g.state.currentPlayer,
      command,
    });

    // Turn latency = validate + apply + persist; broadcast is excluded so the
    // histogram reflects the server-authoritative critical path, not fan-out.
    const elapsedSec = Number(process.hrtime.bigint() - startedAt) / 1e9;
    this.metrics.observeTurn(elapsedSec, g.online);

    if (g.online) {
      await this.getGateway()?.broadcast(gameId, result.state);
    }

    return {
      state:
        actorSeat !== null
          ? redactStateFor(result.state, actorSeat)
          : result.state,
      ...(g.online ? { seat: actorSeat } : {}),
    };
  }

  private async loadGame(gameId: string): Promise<StoredGame> {
    const g = await this.store.getByGameId(gameId);
    if (!g) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Unknown game.",
      });
    }
    return g;
  }

  private requireIdentity(
    identity: AuthenticatedIdentity | undefined,
  ): asserts identity is AuthenticatedIdentity {
    if (!identity?.userId && !identity?.guestId) {
      throw new UnauthorizedException({
        code: "NO_IDENTITY",
        message: "An identity is required for online games.",
      });
    }
  }

  private authorize(stored: string, token: string): void {
    if (stored !== token) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Invalid session token.",
      });
    }
  }
}
