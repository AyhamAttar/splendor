import type {
  GameState,
  PlayerState,
  TokenColor,
  TokenBag,
  Level,
  DevCardDef,
} from "../types";
import { TOKEN_COLORS } from "../types";
import { emptyTokens } from "../util";

/** Dense token record from a sparse bag. */
export function tokens(bag: TokenBag = {}): Record<TokenColor, number> {
  return { ...emptyTokens(), ...bag };
}

/** Player overrides accept a SPARSE token bag for ergonomic fixtures. */
type PlayerOverrides = Partial<Omit<PlayerState, "tokens">> & { tokens?: TokenBag };

export function makePlayer(overrides: PlayerOverrides = {}): PlayerState {
  return {
    name: overrides.name ?? "P",
    tokens: tokens(overrides.tokens ?? {}),
    purchased: overrides.purchased ? [...overrides.purchased] : [],
    reserved: overrides.reserved ? [...overrides.reserved] : [],
    nobles: overrides.nobles ? [...overrides.nobles] : [],
  };
}

/** An empty 4-slot market for every level. */
export function emptyBoard(): Record<Level, (number | null)[]> {
  return {
    1: [null, null, null, null],
    2: [null, null, null, null],
    3: [null, null, null, null],
  };
}

/** Place cards face-up in the first free slot of their level. */
export function boardWith(...cards: DevCardDef[]): Record<Level, (number | null)[]> {
  const board = emptyBoard();
  for (const c of cards) {
    const idx = board[c.level].indexOf(null);
    if (idx !== -1) board[c.level][idx] = c.id;
  }
  return board;
}

export function makeState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    id: "test",
    seed: 1,
    players: [makePlayer({ name: "A" }), makePlayer({ name: "B" })],
    currentPlayer: 0,
    turnNumber: 0,
    bank: tokens({ white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 5 }),
    decks: { 1: [], 2: [], 3: [] },
    board: emptyBoard(),
    nobles: [],
    finalRound: false,
    status: "active",
    log: [],
  };
  return { ...base, ...overrides };
}

/** Total tokens across the bank and every player (all six colors). */
export function totalTokensInPlay(state: GameState): number {
  let n = 0;
  for (const c of TOKEN_COLORS) n += state.bank[c];
  for (const p of state.players) {
    for (const c of TOKEN_COLORS) n += p.tokens[c];
  }
  return n;
}

/** Total development cards accounted for across all zones. */
export function totalCardsInPlay(state: GameState): number {
  let n = 0;
  for (const level of [1, 2, 3] as Level[]) {
    n += state.decks[level].length;
    n += state.board[level].filter((c) => c != null).length;
  }
  for (const p of state.players) {
    n += p.reserved.length;
    n += p.purchased.length;
  }
  return n;
}
