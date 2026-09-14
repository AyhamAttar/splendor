import type { Gem } from "@splendor/engine";
import { authedFetch } from "./auth";
import type { UserProfile } from "./auth";

/** Viewer-agnostic public account info (no email). */
export interface PublicProfile {
  id: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
  createdAt: string;
}

/** Aggregate lifetime stats shown on a profile. */
export interface ProfileStats {
  games: number;
  wins: number;
  winRate: number;
  favoriteGem: Gem | null;
  totalPrestige: number;
  bestPrestige: number;
  totalCards: number;
}

export interface ProfileView {
  profile: PublicProfile;
  stats: ProfileStats;
}

export interface MatchHistoryPlayer {
  seatIndex: number;
  name: string;
  userId: string | null;
  prestige: number;
  cards: number;
  nobles: number;
  won: boolean;
}

export interface MatchHistoryEntry {
  gameId: string;
  finishedAt: string;
  seed: number;
  turnNumber: number;
  durationMs: number;
  players: MatchHistoryPlayer[];
  winnerSeatIndices: number[];
  yourSeatIndex: number | null;
}

export interface MatchHistoryPage {
  entries: MatchHistoryEntry[];
  nextCursor: string | null;
}

/**
 * Profiles + match history API. Public reads (`get`, `history`) work for any
 * identity; `updateMe` and `lookup` require a signed-in account. Profile edits
 * are POST (the API's CORS allows GET/POST/DELETE only).
 */
export const profilesApi = {
  get: (id: string) => authedFetch<ProfileView>(`/users/${id}`),

  history: (id: string, cursor?: string) =>
    authedFetch<MatchHistoryPage>(
      `/users/${id}/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),

  updateMe: (body: {
    displayName?: string;
    handle?: string;
    avatar?: string;
  }) =>
    authedFetch<{ user: UserProfile }>("/users/me", {
      method: "POST",
      body,
    }),

  lookup: (handle: string) =>
    authedFetch<{ profile: PublicProfile | null }>(
      `/users/by-handle/${encodeURIComponent(handle)}`,
    ),
};
