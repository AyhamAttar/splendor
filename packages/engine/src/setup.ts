import type { GameState, PlayerState, Level } from "./types";
import { GEMS } from "./types";
import { emptyTokens } from "./util";
import { mulberry32, shuffle } from "./rng";
import { NOBLES, cardsByLevel } from "./data/lookup";

/** Gem tokens per color at setup, keyed by player count. Gold is always 5. */
const GEM_BANK_BY_PLAYERS: Record<number, number> = { 2: 4, 3: 5, 4: 7 };
const GOLD_TOKENS = 5;
const FACE_UP_PER_LEVEL = 4;

export interface CreateGameOptions {
  id: string;
  playerNames: string[];
  seed: number;
}

/**
 * Build a fresh, fully-set-up game. Deterministic given `seed`: same seed and
 * names always produce the identical shuffle/deal.
 */
export function createGame(opts: CreateGameOptions): GameState {
  const { id, playerNames, seed } = opts;
  if (playerNames.length < 2 || playerNames.length > 4) {
    throw new Error("Splendor requires 2-4 players");
  }

  const rng = mulberry32(seed);
  const gemCount = GEM_BANK_BY_PLAYERS[playerNames.length];

  const bank = emptyTokens();
  for (const g of GEMS) bank[g] = gemCount;
  bank.gold = GOLD_TOKENS;

  const decks: Record<Level, number[]> = { 1: [], 2: [], 3: [] };
  const board: Record<Level, (number | null)[]> = { 1: [], 2: [], 3: [] };
  for (const level of [1, 2, 3] as Level[]) {
    const shuffled = shuffle(
      cardsByLevel(level).map((c) => c.id),
      rng,
    );
    const faceUp = shuffled.slice(0, FACE_UP_PER_LEVEL);
    const rest = shuffled.slice(FACE_UP_PER_LEVEL);
    // Always length 4; pad with null if the deck couldn't fill (never at setup).
    while (faceUp.length < FACE_UP_PER_LEVEL) faceUp.push(null as never);
    board[level] = faceUp;
    decks[level] = rest; // top of deck = last element (pop() to draw)
  }

  const nobleCount = playerNames.length + 1;
  const nobles = shuffle(
    NOBLES.map((n) => n.id),
    rng,
  ).slice(0, nobleCount);

  const players: PlayerState[] = playerNames.map((name) => ({
    name,
    tokens: emptyTokens(),
    purchased: [],
    reserved: [],
    nobles: [],
  }));

  return {
    id,
    seed,
    players,
    currentPlayer: 0,
    turnNumber: 0,
    bank,
    decks,
    board,
    nobles,
    finalRound: false,
    status: "active",
    log: [],
  };
}
