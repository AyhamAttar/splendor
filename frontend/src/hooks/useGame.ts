"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  GameState,
  RedactedGameState,
  TurnCommand,
} from "@splendor/engine";
import { api, onlineApi, type ApiError } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { useGameSocket, type ConnectionStatus } from "./useGameSocket";

export interface SubmitResult {
  ok: boolean;
  error?: ApiError;
}

export interface UseGame {
  /** Full state (hotseat) or a per-viewer redacted state (online). */
  state: GameState | RedactedGameState | null;
  /** The viewer's seat in an online game; null for hotseat / spectator. */
  seat: number | null;
  /** Seats currently connected (online presence); empty for hotseat. */
  connectedSeats: (number | null)[];
  /** Socket status (online); always "connected" for hotseat. */
  connectionStatus: ConnectionStatus;
  loading: boolean;
  busy: boolean;
  error: ApiError | null;
  submit: (command: TurnCommand) => Promise<SubmitResult>;
  refresh: () => void;
}

/**
 * Single source of client truth for one game.
 *
 * - **Hotseat** (default): authorized by the per-game session token; every
 *   action POST returns the fresh full state ("mutate → setState").
 * - **Online** (`opts.online`): authorized by identity. Initial load + turn
 *   submission go through the identity-authed REST pipeline (redacted state +
 *   viewer seat), while opponents' moves arrive via the WebSocket push. Both
 *   paths feed the same `state`, so they stay in sync with no extra plumbing.
 */
export function useGame(
  gameId: string,
  opts: { online?: boolean } = {},
): UseGame {
  const online = !!opts.online;
  const [state, setState] = useState<GameState | RedactedGameState | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Live pushes for online games (disabled — null gameId — for hotseat).
  const sock = useGameSocket(online ? gameId : null);

  // Opponents' committed turns arrive here; adopt them as the new truth.
  // (Initial loading is cleared by the REST load() below, which also runs for
  // online games to fetch the viewer's seat.)
  useEffect(() => {
    if (!online || !sock.state) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(sock.state);
  }, [online, sock.state]);

  const load = useCallback(async () => {
    if (online) {
      setLoading(true);
      try {
        const res = await onlineApi.getState(gameId);
        setState(res.state);
        setSeat(res.seat);
        setError(null);
      } catch (e) {
        setError(e as ApiError);
      } finally {
        setLoading(false);
      }
      return;
    }

    const token = getSessionToken();
    if (!token) {
      setError({
        status: 0,
        code: "NO_SESSION",
        message: "No game on this device. Start a new game from the lobby.",
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { state } = await api.getState(gameId, token);
      setState(state);
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [gameId, online]);

  useEffect(() => {
    // Fetch the game once on mount and store the response (standard
    // REST-on-mount; the setState inside load() is intentional here).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submit = useCallback(
    async (command: TurnCommand): Promise<SubmitResult> => {
      if (!state) return { ok: false };
      setBusy(true);
      try {
        if (online) {
          const res = await onlineApi.act(gameId, {
            ...command,
            expectedTurn: state.turnNumber,
          });
          setState(res.state);
          setSeat(res.seat);
        } else {
          const token = getSessionToken();
          if (!token) return { ok: false };
          const { state: next } = await api.act(gameId, token, {
            ...command,
            expectedTurn: state.turnNumber,
          });
          setState(next);
        }
        setError(null);
        return { ok: true };
      } catch (e) {
        const err = e as ApiError;
        // Illegal-move 422s are surfaced to dialogs by the caller, not as a
        // blocking banner; only keep hard errors on-screen.
        if (err.status !== 422) setError(err);
        return { ok: false, error: err };
      } finally {
        setBusy(false);
      }
    },
    [gameId, online, state],
  );

  return {
    state,
    seat,
    connectedSeats: online ? sock.connectedSeats : [],
    connectionStatus: online ? sock.status : "connected",
    loading,
    busy,
    error,
    submit,
    refresh: load,
  };
}
