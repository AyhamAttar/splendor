// Public API surface of the Splendor rules engine (@splendor/engine).
// SINGLE SOURCE OF TRUTH — consumed by both the NestJS backend (authoritative)
// and the Next.js frontend (previews/affordances). There is no copy to sync;
// change rules or data here and rebuild the package.

export * from "./types";

export { createGame } from "./setup";
export type { CreateGameOptions } from "./setup";

export { applyTurn } from "./engine";

export {
  getBonuses,
  getPrestige,
  getEffectiveCost,
  getWinners,
} from "./selectors";

export {
  canAfford,
  computeAutoPayment,
  validateExplicitPayment,
} from "./payment";

export { eligibleNobles } from "./rules/nobles";
export { canPass } from "./rules/legality";

export {
  CARDS,
  NOBLES,
  getCard,
  getNoble,
  cardsByLevel,
  CARD_BY_ID,
  NOBLE_BY_ID,
} from "./data/lookup";

export {
  emptyTokens,
  tokenTotal,
  bagTotal,
  distinctGems,
  compactBag,
} from "./util";

export {
  redactStateFor,
  type RedactedGameState,
  type RedactedPlayerState,
  type RedactedReservedCard,
} from "./redaction";
