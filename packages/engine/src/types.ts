// ---------------------------------------------------------------------------
// Splendor shared domain types — the single source of truth for both apps.
// The backend applies the engine authoritatively; the frontend imports the
// same types (and engine) for previews and affordances.
// ---------------------------------------------------------------------------

/** The five gem colors. Order is canonical and used for stable rendering. */
export const GEMS = ["white", "blue", "green", "red", "black"] as const;
export type Gem = (typeof GEMS)[number];

/** Gems plus the gold joker. Gold is a token color but never a card bonus. */
export const TOKEN_COLORS = [
  "white",
  "blue",
  "green",
  "red",
  "black",
  "gold",
] as const;
export type TokenColor = (typeof TOKEN_COLORS)[number];

export type Level = 1 | 2 | 3;
export const LEVELS: Level[] = [1, 2, 3];

/** Sparse map of gem -> count (only nonzero entries). Used for card costs. */
export type GemBag = Partial<Record<Gem, number>>;
/** Sparse map of token color -> count. Used for payments and returns. */
export type TokenBag = Partial<Record<TokenColor, number>>;

/** A development card definition (static data). */
export interface DevCardDef {
  id: number;
  level: Level;
  points: number;
  bonus: Gem;
  cost: GemBag;
}

/** A noble tile definition (static data). Always worth 3 prestige. */
export interface NobleDef {
  id: number;
  points: number;
  requirement: GemBag;
}

/** A card in a player's reserve. `hidden` = drawn blind from a deck. */
export interface ReservedCard {
  cardId: number;
  hidden: boolean;
}

export interface PlayerState {
  name: string;
  /** Dense: all six token colors always present. */
  tokens: Record<TokenColor, number>;
  /** Purchased card ids. Bonuses and prestige are DERIVED, never stored. */
  purchased: number[];
  reserved: ReservedCard[];
  /** Claimed noble ids. */
  nobles: number[];
}

export type GameStatus = "active" | "finished";

export interface GameState {
  id: string;
  seed: number;
  players: PlayerState[];
  /** Index into `players`; index 0 always takes the first turn. */
  currentPlayer: number;
  /** Total turns applied. Doubles as the optimistic-concurrency tag. */
  turnNumber: number;
  /** Dense bank of tokens available to take. */
  bank: Record<TokenColor, number>;
  /** Draw piles by level; the LAST element is the top of the deck. */
  decks: Record<Level, number[]>;
  /** Face-up market by level; always length 4; `null` = empty slot. */
  board: Record<Level, (number | null)[]>;
  /** Remaining revealed noble ids (players + 1 at setup). */
  nobles: number[];
  finalRound: boolean;
  status: GameStatus;
  /** Set when finished. Length > 1 only on a full tie after tie-break. */
  winners?: number[];
  /** Append-only, human-facing feed (capped by the engine). */
  log: GameEvent[];
}

// --- Actions -----------------------------------------------------------------

export type Action =
  | { type: "TAKE_DIFFERENT"; gems: Gem[] }
  | { type: "TAKE_SAME"; gem: Gem }
  | { type: "RESERVE_BOARD"; cardId: number }
  | { type: "RESERVE_DECK"; level: Level }
  | { type: "PURCHASE"; cardId: number; payment?: TokenBag }
  | { type: "PASS" };

export type ActionType = Action["type"];

/**
 * A complete, atomic turn. `returnTokens` is required iff the action leaves the
 * player over 10 tokens; `nobleId` is required iff more than one noble qualifies.
 */
export interface TurnCommand {
  action: Action;
  returnTokens?: TokenBag;
  nobleId?: number;
}

// --- Errors ------------------------------------------------------------------

export type EngineError =
  | { code: "GAME_FINISHED" }
  | { code: "INVALID_ACTION_SHAPE"; detail: string }
  | { code: "EMPTY_PILE"; gem: Gem }
  | { code: "DUPLICATE_GEMS" }
  | { code: "TOO_MANY_GEMS" }
  | { code: "NO_GEMS_SELECTED" }
  | { code: "PILE_BELOW_FOUR"; gem: Gem }
  | { code: "CARD_NOT_AVAILABLE"; cardId: number }
  | { code: "DECK_EMPTY"; level: Level }
  | { code: "RESERVE_LIMIT" }
  | { code: "CANNOT_AFFORD"; cardId: number; shortfall: GemBag }
  | { code: "INVALID_PAYMENT"; reason: string }
  | { code: "TOKEN_RETURN_REQUIRED"; mustReturn: number }
  | { code: "INVALID_TOKEN_RETURN"; reason: string }
  | { code: "NOBLE_CHOICE_REQUIRED"; eligible: number[] }
  | { code: "NOBLE_NOT_ELIGIBLE"; nobleId: number }
  | { code: "PASS_NOT_ALLOWED" };

export type EngineErrorCode = EngineError["code"];

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: EngineError };

// --- Log events --------------------------------------------------------------

export type GameEvent =
  | { t: "took_different"; player: number; gems: Gem[] }
  | { t: "took_same"; player: number; gem: Gem; count: number }
  | { t: "returned"; player: number; tokens: TokenBag }
  | {
      t: "reserved";
      player: number;
      level: Level;
      cardId?: number;
      gainedGold: boolean;
    }
  | { t: "purchased"; player: number; cardId: number; points: number }
  | { t: "noble"; player: number; nobleId: number }
  | { t: "passed"; player: number }
  | { t: "final_round"; triggeredBy: number }
  | { t: "finished"; winners: number[] };
