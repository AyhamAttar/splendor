import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GamesService } from "../games/games.service";
import { MatchmakingQueue, type QueueEntry } from "./matchmaking.queue";
import { MetricsService } from "../metrics/metrics.service";
import type { AuthenticatedIdentity } from "../auth/types";

const TARGET_DEFAULT = 4; // group size to match instantly
const MIN_PLAYERS = 2; // smallest game we'll form on timeout
const WAIT_MS_DEFAULT = 12_000; // start a <target game after this long waiting
const TICK_MS = 1_000; // queue processing cadence
const MATCHED_TTL_MS = 60_000; // keep a matched entry this long for the client to read

/** Queue state reported to a polling client. */
export type QueueStatus =
  | { status: "idle" }
  | { status: "searching"; size: number; target: number }
  | { status: "matched"; gameId: string };

/**
 * Public quick-match queue (Phase 3, Major Task 8). Players join the queue and
 * poll `/matchmaking/status`; a periodic tick groups waiting players (instantly
 * at the target size, or after a wait window down to MIN_PLAYERS) and spins up
 * an online game via GamesService. The queue itself is abstracted behind
 * MatchmakingQueue so a Redis store can replace the in-memory default at scale.
 */
@Injectable()
export class MatchmakingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchmakingService.name);
  private readonly target: number;
  private readonly waitMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private processing = false;

  constructor(
    private readonly queue: MatchmakingQueue,
    private readonly games: GamesService,
    private readonly metrics: MetricsService,
    config: ConfigService,
  ) {
    this.target = Number(config.get("MATCH_TARGET")) || TARGET_DEFAULT;
    this.waitMs = Number(config.get("MATCH_WAIT_MS")) || WAIT_MS_DEFAULT;
  }

  onModuleInit(): void {
    // Expose queue depth to Prometheus without metrics depending on this module.
    this.metrics.registerQueueDepthSource(() => this.queue.waiting().length);
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  static key(identity: AuthenticatedIdentity): string {
    return identity.userId ? `user:${identity.userId}` : `guest:${identity.guestId}`;
  }

  /** Enter (or re-touch) the queue. Returns the caller's current status. */
  join(identity: AuthenticatedIdentity, name: string): QueueStatus {
    const key = MatchmakingService.key(identity);
    this.queue.upsert({ key, identity, name, joinedAt: Date.now() });
    return this.status(identity, /* consume */ false);
  }

  leave(identity: AuthenticatedIdentity): void {
    this.queue.remove(MatchmakingService.key(identity));
  }

  /**
   * Report queue status. When matched, the gameId is returned and the entry is
   * consumed (removed) so the client reads it exactly once before navigating.
   */
  status(identity: AuthenticatedIdentity, consume = true): QueueStatus {
    const key = MatchmakingService.key(identity);
    const entry = this.queue.get(key);
    if (!entry) return { status: "idle" };
    if (entry.gameId) {
      const gameId = entry.gameId;
      if (consume) this.queue.remove(key);
      return { status: "matched", gameId };
    }
    return {
      status: "searching",
      size: this.queue.waiting().length,
      target: this.target,
    };
  }

  // --- queue processing ------------------------------------------------------

  private async tick(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      this.pruneMatched();
      await this.formGames();
    } catch (e) {
      this.logger.error(`Matchmaking tick failed: ${(e as Error).message}`);
    } finally {
      this.processing = false;
    }
  }

  private async formGames(): Promise<void> {
    const waiting = this.queue
      .waiting()
      .sort((a, b) => a.joinedAt - b.joinedAt);

    const now = Date.now();
    let i = 0;
    while (i < waiting.length) {
      const remaining = waiting.length - i;
      const oldest = waiting[i];
      const full = remaining >= this.target;
      const timedOut =
        remaining >= MIN_PLAYERS && now - oldest.joinedAt >= this.waitMs;
      if (!full && !timedOut) break;

      const groupSize = Math.min(this.target, remaining);
      const group = waiting.slice(i, i + groupSize);
      await this.startGame(group);
      i += groupSize;
    }
  }

  private async startGame(group: QueueEntry[]): Promise<void> {
    const participants = group.map((e) => ({ identity: e.identity, name: e.name }));
    const { gameId } = await this.games.createOnline(participants);
    this.queue.setMatched(
      group.map((e) => e.key),
      gameId,
    );
    this.logger.log(`Matched ${group.length} player(s) into game ${gameId}`);
  }

  /** Drop matched entries a client never came back to read. */
  private pruneMatched(): void {
    const cutoff = Date.now() - MATCHED_TTL_MS;
    for (const e of this.queue.matched()) {
      if ((e.matchedAt ?? 0) < cutoff) this.queue.remove(e.key);
    }
  }
}
