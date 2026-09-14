"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { matchmakingApi, type QueueStatus } from "@/lib/matchmaking";
import type { ApiError } from "@/lib/api";

export type MatchPhase = "idle" | "searching" | "matched" | "error";

export interface UseQuickMatch {
  phase: MatchPhase;
  /** How many players are currently waiting (including the caller). */
  size: number;
  gameId: string | null;
  error: ApiError | null;
  find: (name: string) => Promise<void>;
  cancel: () => Promise<void>;
}

const POLL_MS = 1500;

/**
 * Drives the public quick-match queue: join, then poll status until matched.
 * Matchmaking results are pull-based (no socket) — simple and robust for a
 * single-host queue; the backend consumes the match on read.
 */
export function useQuickMatch(): UseQuickMatch {
  const [phase, setPhase] = useState<MatchPhase>("idle");
  const [size, setSize] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const apply = useCallback(
    (s: QueueStatus) => {
      if (s.status === "matched") {
        setGameId(s.gameId);
        setPhase("matched");
        stopPolling();
      } else if (s.status === "searching") {
        setSize(s.size);
        setPhase("searching");
      } else {
        setPhase("idle");
      }
    },
    [stopPolling],
  );

  const poll = useCallback(async () => {
    try {
      apply(await matchmakingApi.status());
    } catch {
      // Transient network error — keep polling.
    }
  }, [apply]);

  const find = useCallback(
    async (name: string) => {
      setError(null);
      try {
        apply(await matchmakingApi.join(name));
        stopPolling();
        timerRef.current = setInterval(() => void poll(), POLL_MS);
      } catch (e) {
        setPhase("error");
        setError(e as ApiError);
      }
    },
    [apply, poll, stopPolling],
  );

  const cancel = useCallback(async () => {
    stopPolling();
    setPhase("idle");
    setSize(0);
    try {
      await matchmakingApi.leave();
    } catch {
      // Best effort — the entry is TTL-pruned server-side regardless.
    }
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { phase, size, gameId, error, find, cancel };
}
