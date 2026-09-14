import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GameRepository } from "./game.repository";

const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // check for idle games every 15 min

/**
 * Periodically deletes idle games. Kept separate from GameRepository so the
 * repository stays pure data-access; this class owns the timer lifecycle and
 * reads its retention window from config (GAME_TTL_HOURS, default 24h).
 */
@Injectable()
export class GameSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameSweeper.name);
  private readonly ttlMs: number;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly games: GameRepository,
    config: ConfigService,
  ) {
    const hours = Number(config.get("GAME_TTL_HOURS")) || 24;
    this.ttlMs = hours * 60 * 60 * 1000;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    // Don't hold the event loop open just for the sweeper (also lets Jest exit).
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - this.ttlMs);
    try {
      const count = await this.games.deleteIdle(cutoff);
      if (count > 0) this.logger.log(`Swept ${count} idle game(s)`);
    } catch (e) {
      this.logger.error(`Sweep failed: ${(e as Error).message}`);
    }
  }
}
