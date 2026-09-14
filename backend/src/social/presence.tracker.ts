import { Injectable } from "@nestjs/common";

/**
 * Tracks which users currently have at least one live social connection.
 * Abstract so an in-memory implementation serves the single-host deployment now
 * and a Redis-backed one can drop in for multi-instance presence later (mirrors
 * the MatchmakingQueue abstraction). Reference-counted per user so multiple tabs
 * / devices don't flap presence.
 */
export abstract class PresenceTracker {
  /** Register a connection. Returns true if the user just came online (0 → 1). */
  abstract add(userId: string): boolean;
  /** Drop a connection. Returns true if the user just went offline (1 → 0). */
  abstract remove(userId: string): boolean;
  abstract isOnline(userId: string): boolean;
  /** Filter a set of user ids to those currently online. */
  abstract onlineAmong(userIds: string[]): string[];
}

@Injectable()
export class InMemoryPresenceTracker extends PresenceTracker {
  private readonly counts = new Map<string, number>();

  add(userId: string): boolean {
    const next = (this.counts.get(userId) ?? 0) + 1;
    this.counts.set(userId, next);
    return next === 1;
  }

  remove(userId: string): boolean {
    const next = (this.counts.get(userId) ?? 0) - 1;
    if (next <= 0) {
      const wasOnline = this.counts.delete(userId);
      return wasOnline;
    }
    this.counts.set(userId, next);
    return false;
  }

  isOnline(userId: string): boolean {
    return this.counts.has(userId);
  }

  onlineAmong(userIds: string[]): string[] {
    return userIds.filter((id) => this.counts.has(id));
  }
}
