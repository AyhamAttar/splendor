"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { roomsApi, type RoomView, type RoomViewForCaller } from "@/lib/rooms";
import { connectRoom, type RealtimeHandle } from "@/lib/realtime";
import { getAccessToken } from "@/lib/auth";
import { getGuestToken } from "@/lib/session";
import { isApiError, type ApiError } from "@/lib/api";

export type RoomPhase = "loading" | "needJoin" | "in" | "removed" | "error";

export interface UseRoom {
  phase: RoomPhase;
  room: RoomView | null;
  /** This caller's member id (stable across pushed updates). */
  memberId: string | null;
  /** Member ids currently connected to the room socket. */
  online: string[];
  error: ApiError | null;
  /** Set once the host starts — the page navigates to this game. */
  startedGameId: string | null;
  join: (name: string) => Promise<void>;
  leave: () => Promise<void>;
  ready: (ready: boolean) => Promise<void>;
  start: () => Promise<void>;
  kick: (memberId: string) => Promise<void>;
  setSeats: (maxPlayers: number) => Promise<void>;
}

/**
 * Client state for one lobby room: REST for membership + mutations, a socket
 * for live member/ready/seat updates and the start transition. The caller's
 * `memberId` (from the REST responses) identifies "you" within the neutral
 * pushed snapshots, so no per-viewer broadcasts are needed.
 */
export function useRoom(code: string): UseRoom {
  const [phase, setPhase] = useState<RoomPhase>("loading");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [startedGameId, setStartedGameId] = useState<string | null>(null);
  const handleRef = useRef<RealtimeHandle | null>(null);
  const memberIdRef = useRef<string | null>(null);

  const adopt = useCallback((view: RoomViewForCaller) => {
    memberIdRef.current = view.memberId;
    setMemberId(view.memberId);
    setRoom(view);
    setPhase("in");
    setError(null);
  }, []);

  // Handle a neutral snapshot (REST or socket): detect start + removal.
  const applyView = useCallback((view: RoomView) => {
    setRoom(view);
    if (view.status === "in_game" && view.gameId) {
      setStartedGameId(view.gameId);
      return;
    }
    const mine = memberIdRef.current;
    if (mine && !view.members.some((mem) => mem.id === mine)) {
      setPhase("removed");
    }
  }, []);

  // Initial load: are we already a member?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const view = await roomsApi.get(code);
        if (!cancelled) adopt(view);
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e) && (e.status === 403 || e.status === 404)) {
          setPhase(e.status === 404 ? "error" : "needJoin");
          setError(e);
        } else {
          setPhase("error");
          setError(e as ApiError);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, adopt]);

  // Subscribe to live updates once we're in the room.
  useEffect(() => {
    if (phase !== "in") return;
    handleRef.current?.disconnect();
    handleRef.current = connectRoom(
      code,
      { accessToken: getAccessToken(), guestToken: getGuestToken() },
      {
        onState: applyView,
        onPresence: (p) => setOnline(p.online),
      },
    );
    return () => {
      handleRef.current?.disconnect();
      handleRef.current = null;
    };
  }, [phase, code, applyView]);

  const join = useCallback(
    async (name: string) => {
      const view = await roomsApi.join(code, name);
      adopt(view);
    },
    [code, adopt],
  );

  const leave = useCallback(async () => {
    try {
      await roomsApi.leave(code);
    } finally {
      setPhase("removed");
    }
  }, [code]);

  const ready = useCallback(
    async (value: boolean) => {
      applyView(await roomsApi.ready(code, value));
    },
    [code, applyView],
  );

  const start = useCallback(async () => {
    const { gameId } = await roomsApi.start(code);
    setStartedGameId(gameId);
  }, [code]);

  const kick = useCallback(
    async (target: string) => {
      applyView(await roomsApi.kick(code, target));
    },
    [code, applyView],
  );

  const setSeats = useCallback(
    async (maxPlayers: number) => {
      applyView(await roomsApi.setSeats(code, maxPlayers));
    },
    [code, applyView],
  );

  return {
    phase,
    room,
    memberId,
    online,
    error,
    startedGameId,
    join,
    leave,
    ready,
    start,
    kick,
    setSeats,
  };
}
