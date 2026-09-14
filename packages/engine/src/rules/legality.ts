import type { GameState, Level, PlayerState } from "../types";
import { GEMS, LEVELS } from "../types";
import type { RedactedGameState } from "../redaction";
import { getCard } from "../data/lookup";
import { canAfford } from "../payment";

const MAX_RESERVED = 3;

/**
 * Remaining cards in a level's draw pile, reading either the authoritative
 * `decks` arrays or a redacted state's `deckCounts`. This lets `canPass` run
 * unchanged on a per-viewer redacted state (the frontend never holds deck
 * order) without forking the rule.
 */
function deckRemaining(state: GameState | RedactedGameState, level: Level): number {
  return "decks" in state ? state.decks[level].length : state.deckCounts[level];
}

/**
 * PASS is legal only when the current player has NO other legal action:
 *  - no gem pile has tokens (taking even one gem is an action), AND
 *  - no board card or own reserved card is affordable, AND
 *  - the player cannot reserve (hand full, or nothing left to reserve).
 */
export function canPass(state: GameState | RedactedGameState): boolean {
  const p = state.players[state.currentPlayer];
  // Affordability helpers read only tokens + purchased cards, never `reserved`,
  // so a redacted player (whose sole difference is the reserved-card shape) is
  // safe to treat as a full PlayerState here.
  const affordPlayer = p as PlayerState;

  // 1. Can take tokens? Any nonempty gem pile means TAKE_DIFFERENT of 1 is legal.
  if (GEMS.some((g) => state.bank[g] > 0)) return false;

  // 2. Can purchase anything?
  for (const level of LEVELS) {
    for (const cid of state.board[level]) {
      if (cid != null && canAfford(affordPlayer, getCard(cid))) return false;
    }
  }
  for (const r of p.reserved) {
    // A redacted opponent reserve carries cardId=null; canPass only ever runs
    // for the viewer's own (unredacted) seat, but guard for type-safety.
    if (r.cardId != null && canAfford(affordPlayer, getCard(r.cardId))) return false;
  }

  // 3. Can reserve? Need a free slot AND something reservable.
  if (p.reserved.length < MAX_RESERVED) {
    const boardHasCard = LEVELS.some((l) =>
      state.board[l].some((c) => c != null),
    );
    const deckHasCard = LEVELS.some((l) => deckRemaining(state, l) > 0);
    if (boardHasCard || deckHasCard) return false;
  }

  return true;
}
