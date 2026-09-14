/** Lowercase room lifecycle state sent to clients (maps from the Prisma enum). */
export type RoomStatusView = "waiting" | "in_game" | "closed";

/** A single seat in a room as shown to clients. `id` is the RoomMember id — an
 *  opaque handle (not an identity token) the client stores to recognise itself
 *  in pushed updates. Identity tokens are never exposed. */
export interface RoomMemberView {
  id: string;
  seatIndex: number;
  name: string;
  isHost: boolean;
  ready: boolean;
  kind: "user" | "guest";
}

/**
 * Neutral room snapshot broadcast to every member over the socket (one emit per
 * room). It is viewer-agnostic — the client recognises its own seat by matching
 * the `memberId` it received from the REST create/join response against
 * `members[].id`, so we don't need per-viewer broadcasts.
 */
export interface RoomView {
  code: string;
  status: RoomStatusView;
  maxPlayers: number;
  members: RoomMemberView[];
  gameId: string | null;
}

/** REST responses also tell the caller which member row is theirs. */
export interface RoomViewForCaller extends RoomView {
  memberId: string;
  seatIndex: number;
  isHost: boolean;
}
