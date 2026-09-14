"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RedactedGameState } from "@splendor/engine";
import { connectGame, type RealtimeHandle } from "@/lib/realtime";
import { getAccessToken } from "@/lib/auth";
import { getGuestToken } from "@/lib/session";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface UseGameSocket {
  /** Latest pushed game state from the server, or null before first push. */
  state: RedactedGameState | null;
  /** Seats currently subscribed in this game room. */
  connectedSeats: (number | null)[];
  status: ConnectionStatus;
}

/**
 * Subscribe to realtime game state pushes for an online game via Socket.IO.
 * Provides the redacted state visible to this viewer plus presence info.
 *
 * This hook is transport-only and complements `useGame` (REST actions).
 * Pass `null` to stay disconnected (hotseat games have no socket).
 */
export function useGameSocket(gameId: string | null): UseGameSocket {
  const [state, setState] = useState<RedactedGameState | null>(null);
  const [connectedSeats, setConnectedSeats] = useState<(number | null)[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const handleRef = useRef<RealtimeHandle | null>(null);

  const openConnection = useCallback(() => {
    handleRef.current?.disconnect();
    if (!gameId) return;
    setStatus("connecting");

    handleRef.current = connectGame(
      gameId,
      { accessToken: getAccessToken(), guestToken: getGuestToken() },
      {
        onState: (s) => {
          setState(s);
          setStatus("connected");
        },
        onPresence: (p) => setConnectedSeats(p.connectedSeats),
        onError: () => setStatus("disconnected"),
      },
    );
  }, [gameId]);

  useEffect(() => {
    openConnection();
    return () => {
      handleRef.current?.disconnect();
      handleRef.current = null;
    };
  }, [openConnection]);

  return { state, connectedSeats, status };
}
