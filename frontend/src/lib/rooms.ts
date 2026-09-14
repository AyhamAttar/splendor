import { authedFetch } from "./auth";

/** Lifecycle state of a room, as sent by the backend (lowercase). */
export type RoomStatus = "waiting" | "in_game" | "closed";

export interface RoomMemberView {
  id: string;
  seatIndex: number;
  name: string;
  isHost: boolean;
  ready: boolean;
  kind: "user" | "guest";
}

/** Neutral room snapshot (the shape pushed over the socket). */
export interface RoomView {
  code: string;
  status: RoomStatus;
  maxPlayers: number;
  members: RoomMemberView[];
  gameId: string | null;
}

/** REST responses add which member row belongs to the caller. */
export interface RoomViewForCaller extends RoomView {
  memberId: string;
  seatIndex: number;
  isHost: boolean;
}

/**
 * Private-room lobby API. Every call is identity-scoped (guest or user) via
 * `authedFetch`; the backend maps the caller to a seat. Codes are uppercase.
 */
export const roomsApi = {
  create: (name: string) =>
    authedFetch<RoomViewForCaller>("/rooms", {
      method: "POST",
      body: { name },
    }),

  join: (code: string, name: string) =>
    authedFetch<RoomViewForCaller>(`/rooms/${code}/join`, {
      method: "POST",
      body: { name },
    }),

  get: (code: string) => authedFetch<RoomViewForCaller>(`/rooms/${code}`),

  leave: (code: string) =>
    authedFetch<void>(`/rooms/${code}/leave`, { method: "POST" }),

  ready: (code: string, ready: boolean) =>
    authedFetch<RoomViewForCaller>(`/rooms/${code}/ready`, {
      method: "POST",
      body: { ready },
    }),

  setSeats: (code: string, maxPlayers: number) =>
    authedFetch<RoomViewForCaller>(`/rooms/${code}/seats`, {
      method: "POST",
      body: { maxPlayers },
    }),

  kick: (code: string, memberId: string) =>
    authedFetch<RoomViewForCaller>(`/rooms/${code}/kick`, {
      method: "POST",
      body: { memberId },
    }),

  start: (code: string) =>
    authedFetch<{ gameId: string }>(`/rooms/${code}/start`, {
      method: "POST",
    }),
};
