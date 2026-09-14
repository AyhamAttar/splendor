import { Injectable } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/types";

/** One waiting (or freshly matched) player in the quick-match queue. */
export interface QueueEntry {
  /** Stable identity key: `user:<id>` or `guest:<id>` (one entry per identity). */
  key: string;
  identity: AuthenticatedIdentity;
  name: string;
  joinedAt: number;
  /** Set once grouped into a game; the client reads it via /status then leaves. */
  gameId?: string;
  matchedAt?: number;
}

/**
 * Storage for the quick-match queue. Defined as an abstract class (DI token) so
 * a Redis-backed implementation can drop in for multi-instance matchmaking
 * (deferred — see PLAN "Horizontal scale-out") without touching the service.
 */
export abstract class MatchmakingQueue {
  abstract upsert(entry: QueueEntry): void;
  abstract get(key: string): QueueEntry | undefined;
  abstract remove(key: string): void;
  /** Entries still waiting (not yet matched). */
  abstract waiting(): QueueEntry[];
  /** Already-matched entries (for TTL pruning). */
  abstract matched(): QueueEntry[];
  abstract setMatched(keys: string[], gameId: string): void;
}

/** Single-instance in-memory queue (default). */
@Injectable()
export class InMemoryMatchmakingQueue extends MatchmakingQueue {
  private readonly entries = new Map<string, QueueEntry>();

  upsert(entry: QueueEntry): void {
    const existing = this.entries.get(entry.key);
    // Preserve queue position (joinedAt) and any match already assigned.
    if (existing) {
      existing.name = entry.name;
      return;
    }
    this.entries.set(entry.key, entry);
  }

  get(key: string): QueueEntry | undefined {
    return this.entries.get(key);
  }

  remove(key: string): void {
    this.entries.delete(key);
  }

  waiting(): QueueEntry[] {
    return [...this.entries.values()].filter((e) => !e.gameId);
  }

  matched(): QueueEntry[] {
    return [...this.entries.values()].filter((e) => e.gameId);
  }

  setMatched(keys: string[], gameId: string): void {
    const now = Date.now();
    for (const key of keys) {
      const e = this.entries.get(key);
      if (e) {
        e.gameId = gameId;
        e.matchedAt = now;
      }
    }
  }
}
