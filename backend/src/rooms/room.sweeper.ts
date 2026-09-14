import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RoomRepository } from "./room.repository";

const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // check every 15 min

/**
 * Periodically deletes stale rooms (idle since before the retention window).
 * Mirrors GameSweeper so lobbies abandoned before start — or left IN_GAME after
 * their game ends — don't accumulate. Retention is ROOM_TTL_HOURS (default 6h).
 */
@Injectable()
export class RoomSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomSweeper.name);
  private readonly ttlMs: number;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly rooms: RoomRepository,
    config: ConfigService,
  ) {
    const hours = Number(config.get("ROOM_TTL_HOURS")) || 6;
    this.ttlMs = hours * 60 * 60 * 1000;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - this.ttlMs);
    try {
      const count = await this.rooms.deleteIdle(cutoff);
      if (count > 0) this.logger.log(`Swept ${count} stale room(s)`);
    } catch (e) {
      this.logger.error(`Room sweep failed: ${(e as Error).message}`);
    }
  }
}
