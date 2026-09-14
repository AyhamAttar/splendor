import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";

interface TokenBucket {
  tokens: number;
  last: number;
}

/**
 * Per-socket flood protection. A token bucket lives on `socket.data` so it is
 * garbage-collected with the socket — no global Map to leak. Each inbound
 * gateway message spends one token; tokens refill continuously. A client that
 * empties its bucket gets a `RATE_LIMITED` `WsException` rather than being able
 * to spam `subscribe`/`action` and pin the event loop.
 *
 * Tunable via WS_RATE_BURST (bucket capacity) and WS_RATE_REFILL_PER_SEC.
 */
@Injectable()
export class WsRateLimitGuard implements CanActivate {
  private readonly capacity: number;
  private readonly refillPerSec: number;

  constructor(config: ConfigService) {
    this.capacity = Number(config.get("WS_RATE_BURST")) || 30;
    this.refillPerSec = Number(config.get("WS_RATE_REFILL_PER_SEC")) || 15;
  }

  canActivate(context: ExecutionContext): boolean {
    const socket = context.switchToWs().getClient<Socket>();
    const data = socket.data as { __rate?: TokenBucket };
    const now = Date.now();
    const bucket = (data.__rate ??= { tokens: this.capacity, last: now });

    // Refill based on elapsed time, capped at capacity.
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + ((now - bucket.last) / 1000) * this.refillPerSec,
    );
    bucket.last = now;

    if (bucket.tokens < 1) {
      throw new WsException({
        code: "RATE_LIMITED",
        message: "Too many messages; slow down.",
      });
    }
    bucket.tokens -= 1;
    return true;
  }
}
