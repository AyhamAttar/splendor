"use client";

import { io, type Socket } from "socket.io-client";
import type { RedactedGameState } from "@splendor/engine";
import type { RoomView } from "./rooms";
import type { RequestView } from "./social";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface RealtimeCallbacks {
  onState: (state: RedactedGameState) => void;
  onPresence: (data: { connectedSeats: (number | null)[] }) => void;
  onError?: (data: { code: string; message: string }) => void;
}

export interface RealtimeHandle {
  disconnect: () => void;
}

/**
 * Open a Socket.IO connection for one online game, subscribe to it, and wire
 * callbacks for pushed state and presence updates.
 *
 * Authentication is carried in the socket handshake `auth` payload — either an
 * in-memory access token (registered user) or the durable guest token from
 * localStorage — matching the server's `resolveIdentity` in GameGateway.
 *
 * Call `disconnect()` on the returned handle to clean up (e.g. from useEffect).
 */
export function connectGame(
  gameId: string,
  creds: { accessToken?: string | null; guestToken?: string | null },
  callbacks: RealtimeCallbacks,
): RealtimeHandle {
  const socket: Socket = io(BASE, {
    transports: ["websocket"],
    auth: {
      ...(creds.accessToken ? { accessToken: creds.accessToken } : {}),
      ...(creds.guestToken ? { guestToken: creds.guestToken } : {}),
    },
  });

  socket.on("connect", () => {
    socket.emit("subscribe", { gameId });
  });

  socket.on("state", (data: RedactedGameState) => {
    callbacks.onState(data);
  });

  socket.on("presence", (data: { connectedSeats: (number | null)[] }) => {
    callbacks.onPresence(data);
  });

  socket.on("error", (data: { code: string; message: string }) => {
    callbacks.onError?.(data);
  });

  return {
    disconnect: () => socket.disconnect(),
  };
}

export interface RoomCallbacks {
  onState: (room: RoomView) => void;
  onPresence: (data: { online: string[] }) => void;
  onError?: (data: { code: string; message: string }) => void;
}

/**
 * Open a Socket.IO connection for one lobby room, subscribe to it, and wire
 * callbacks for pushed room snapshots (member join/leave/ready, the start
 * transition) and connection presence. Same auth handshake as `connectGame`.
 */
export function connectRoom(
  code: string,
  creds: { accessToken?: string | null; guestToken?: string | null },
  callbacks: RoomCallbacks,
): RealtimeHandle {
  const socket: Socket = io(BASE, {
    transports: ["websocket"],
    auth: {
      ...(creds.accessToken ? { accessToken: creds.accessToken } : {}),
      ...(creds.guestToken ? { guestToken: creds.guestToken } : {}),
    },
  });

  socket.on("connect", () => {
    socket.emit("room:subscribe", { code });
  });

  socket.on("room:state", (data: RoomView) => callbacks.onState(data));
  socket.on("room:presence", (data: { online: string[] }) =>
    callbacks.onPresence(data),
  );
  socket.on("room:error", (data: { code: string; message: string }) =>
    callbacks.onError?.(data),
  );

  return {
    disconnect: () => socket.disconnect(),
  };
}

/** A room invite pushed to a friend over the social channel. */
export interface RoomInvitePush {
  code: string;
  from: {
    userId: string;
    displayName: string | null;
    handle: string | null;
    avatar: string | null;
  };
}

export interface SocialCallbacks {
  /** Friends currently online, sent once on connect. */
  onReady: (data: { online: string[] }) => void;
  /** A friend came online / went offline. */
  onPresence: (data: { userId: string; online: boolean }) => void;
  /** A new incoming friend request. */
  onRequest: (request: RequestView) => void;
  /** The friend graph changed (accept/decline/remove/block) — refetch. */
  onChanged: () => void;
  /** A friend invited the user to a room. */
  onRoomInvite: (invite: RoomInvitePush) => void;
}

/**
 * Open the per-user social channel (Phase 4) on the dedicated `/social`
 * namespace — isolated from the game/room sockets so it never intercepts guest
 * play. Signed-in users only.
 *
 * `getCreds` is read via the socket.io `auth` CALLBACK on every (re)connect, so
 * reconnects after a drop send the CURRENT in-memory access token rather than a
 * value captured once at construction (which would be stale/expired and get the
 * socket rejected). The in-memory token is kept fresh by normal REST activity
 * (authedFetch's silent refresh).
 */
export function connectSocial(
  getCreds: () => { accessToken?: string | null; guestToken?: string | null },
  callbacks: SocialCallbacks,
): RealtimeHandle {
  const socket: Socket = io(BASE + "/social", {
    transports: ["websocket"],
    auth: (cb) => {
      const creds = getCreds();
      cb({
        ...(creds.accessToken ? { accessToken: creds.accessToken } : {}),
        ...(creds.guestToken ? { guestToken: creds.guestToken } : {}),
      });
    },
  });

  socket.on("social:ready", (data: { online: string[] }) =>
    callbacks.onReady(data),
  );
  socket.on("friend:presence", (data: { userId: string; online: boolean }) =>
    callbacks.onPresence(data),
  );
  socket.on("friend:request", (data: RequestView) => callbacks.onRequest(data));
  socket.on("friend:changed", () => callbacks.onChanged());
  socket.on("room:invite", (data: RoomInvitePush) =>
    callbacks.onRoomInvite(data),
  );

  return {
    disconnect: () => socket.disconnect(),
  };
}
