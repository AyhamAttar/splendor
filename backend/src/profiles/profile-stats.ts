import { GEMS, type Gem } from "@splendor/engine";
import type { MatchPlayerSummary, MatchSummary } from "../games/match-summary";

/** Aggregate profile statistics derived from a user's finished-game summaries. */
export interface ProfileStats {
  games: number;
  wins: number;
  /** wins / games, 0 when no games played. */
  winRate: number;
  /** Most-accumulated bonus gem color across all games; null if none bought. */
  favoriteGem: Gem | null;
  totalPrestige: number;
  /** Highest prestige reached in a single game. */
  bestPrestige: number;
  totalCards: number;
}

/**
 * Fold a user's match summaries into profile stats. `isMine` picks the caller's
 * seat in each summary — it must match by userId AND the user's former guest id
 * (games played before a guest→account upgrade are owned by the guest id).
 */
export function computeStats(
  summaries: MatchSummary[],
  isMine: (p: MatchPlayerSummary) => boolean,
): ProfileStats {
  let games = 0;
  let wins = 0;
  let totalPrestige = 0;
  let bestPrestige = 0;
  let totalCards = 0;
  const gemTotals: Record<Gem, number> = {
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
  };

  for (const s of summaries) {
    const me = s.players.find(isMine);
    if (!me) continue;
    games++;
    if (me.won) wins++;
    totalPrestige += me.prestige;
    totalCards += me.cards;
    if (me.prestige > bestPrestige) bestPrestige = me.prestige;
    for (const g of GEMS) gemTotals[g] += me.bonuses?.[g] ?? 0;
  }

  let favoriteGem: Gem | null = null;
  let bestGem = 0;
  for (const g of GEMS) {
    if (gemTotals[g] > bestGem) {
      bestGem = gemTotals[g];
      favoriteGem = g;
    }
  }

  return {
    games,
    wins,
    winRate: games ? wins / games : 0,
    favoriteGem,
    totalPrestige,
    bestPrestige,
    totalCards,
  };
}
