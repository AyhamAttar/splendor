import type { ProfileStats } from "./profile-stats";

/**
 * Viewer-agnostic account info, safe to show to anyone. Deliberately omits
 * `email` and any auth material — only the self-facing `UserProfile` (auth)
 * carries the email.
 */
export interface PublicProfile {
  id: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
  createdAt: Date;
}

/** A public profile plus aggregate match stats — the `GET /users/:id` response. */
export interface ProfileView {
  profile: PublicProfile;
  stats: ProfileStats;
}

/** One player's line within a history entry. */
export interface MatchHistoryPlayer {
  seatIndex: number;
  name: string;
  /** Owning account id, or null (guest seat) — lets the client link profiles. */
  userId: string | null;
  prestige: number;
  cards: number;
  nobles: number;
  won: boolean;
}

/** One finished game as it appears in a user's match history. */
export interface MatchHistoryEntry {
  gameId: string;
  finishedAt: Date;
  seed: number;
  turnNumber: number;
  durationMs: number;
  players: MatchHistoryPlayer[];
  winnerSeatIndices: number[];
  /** The viewed user's seat in this game (null only if data is inconsistent). */
  yourSeatIndex: number | null;
}

/** A page of match history with an opaque cursor for the next page. */
export interface MatchHistoryPage {
  entries: MatchHistoryEntry[];
  nextCursor: string | null;
}
