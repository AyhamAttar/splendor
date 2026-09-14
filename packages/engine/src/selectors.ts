import type { GameState, PlayerState, Gem, GemBag, DevCardDef } from "./types";
import { GEMS } from "./types";
import { getCard, getNoble } from "./data/lookup";

/** Derived bonus count per gem color (one per purchased card of that bonus). */
export function getBonuses(player: PlayerState): Record<Gem, number> {
  const b: Record<Gem, number> = {
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
  };
  for (const id of player.purchased) b[getCard(id).bonus]++;
  return b;
}

/** Derived prestige: card points + noble points. Never stored. */
export function getPrestige(player: PlayerState): number {
  let pts = 0;
  for (const id of player.purchased) pts += getCard(id).points;
  for (const nid of player.nobles) pts += getNoble(nid).points;
  return pts;
}

/** Cost after applying a player's bonuses (each bonus discounts its color by 1). */
export function getEffectiveCost(
  card: DevCardDef,
  bonuses: Record<Gem, number>,
): GemBag {
  const eff: GemBag = {};
  for (const g of GEMS) {
    const net = Math.max(0, (card.cost[g] ?? 0) - bonuses[g]);
    if (net > 0) eff[g] = net;
  }
  return eff;
}

/**
 * Final standings: highest prestige wins; tie-break = fewest purchased cards;
 * a remaining tie yields co-winners.
 */
export function getWinners(state: GameState): number[] {
  let best = -1;
  let candidates: number[] = [];
  state.players.forEach((p, i) => {
    const pts = getPrestige(p);
    if (pts > best) {
      best = pts;
      candidates = [i];
    } else if (pts === best) {
      candidates.push(i);
    }
  });

  let fewest = Infinity;
  let winners: number[] = [];
  for (const i of candidates) {
    const n = state.players[i].purchased.length;
    if (n < fewest) {
      fewest = n;
      winners = [i];
    } else if (n === fewest) {
      winners.push(i);
    }
  }
  return winners;
}
