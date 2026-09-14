import type { GameState } from "../types";
import { GEMS } from "../types";
import { getBonuses } from "../selectors";
import { getNoble } from "../data/lookup";

/**
 * Ids of currently-revealed nobles whose requirement is met by the player's
 * BONUSES (never tokens). Order follows `state.nobles`.
 */
export function eligibleNobles(state: GameState, playerIndex: number): number[] {
  const bonuses = getBonuses(state.players[playerIndex]);
  return state.nobles.filter((nid) => {
    const req = getNoble(nid).requirement;
    return GEMS.every((g) => bonuses[g] >= (req[g] ?? 0));
  });
}
