import type {
  GameState,
  TurnCommand,
  Action,
  ApplyResult,
  EngineError,
  Gem,
  Level,
  GameEvent,
  TokenBag,
  PlayerState,
} from "./types";
import { GEMS, TOKEN_COLORS, LEVELS } from "./types";
import { getCard } from "./data/lookup";
import { getPrestige, getWinners } from "./selectors";
import { computeAutoPayment, validateExplicitPayment } from "./payment";
import { eligibleNobles } from "./rules/nobles";
import { canPass } from "./rules/legality";
import { tokenTotal, bagTotal, compactBag } from "./util";

const WINNING_SCORE = 15;
const MAX_TOKENS = 10;
const MAX_RESERVED = 3;
const LOG_CAP = 60;

type StepResult = { ok: true } | { ok: false; error: EngineError };
const OK: StepResult = { ok: true };
function fail(error: EngineError): StepResult {
  return { ok: false, error };
}

/**
 * Apply one complete, atomic turn. Never mutates `prev`. The pipeline is:
 *   parse action -> validate+apply action -> token-limit gate
 *   -> noble gate -> endgame check + advance -> commit log.
 */
export function applyTurn(prev: GameState, command: TurnCommand): ApplyResult {
  if (prev.status === "finished") {
    return { ok: false, error: { code: "GAME_FINISHED" } };
  }

  const parsed = parseAction(command.action);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const state: GameState = structuredClone(prev);
  const player = state.players[state.currentPlayer];
  const events: GameEvent[] = [];

  // 1. Validate + apply the chosen action.
  const acted = applyAction(state, player, parsed.action, events);
  if (!acted.ok) return { ok: false, error: acted.error };

  // 2. Token-limit gate (must end the turn holding <= 10 tokens).
  const total = tokenTotal(player.tokens);
  if (total > MAX_TOKENS) {
    const mustReturn = total - MAX_TOKENS;
    const ret = command.returnTokens;
    if (!ret || bagTotal(ret) === 0) {
      return { ok: false, error: { code: "TOKEN_RETURN_REQUIRED", mustReturn } };
    }
    const returned = applyReturn(state, player, ret, mustReturn, events);
    if (!returned.ok) return { ok: false, error: returned.error };
  } else if (command.returnTokens && bagTotal(command.returnTokens) > 0) {
    return {
      ok: false,
      error: { code: "INVALID_TOKEN_RETURN", reason: "no return needed" },
    };
  }

  // 3. Noble gate (auto-visit / choose one when several qualify).
  const nobled = applyNobles(state, state.currentPlayer, command.nobleId, events);
  if (!nobled.ok) return { ok: false, error: nobled.error };

  // 4. Endgame flags + advance to the next seat.
  advanceAndCheckEnd(state, events);

  // 5. Commit the log (capped).
  state.log = [...state.log, ...events].slice(-LOG_CAP);

  return { ok: true, state };
}

// --- Action parsing (engine is the authority; API DTOs stay shallow) --------

function parseAction(
  action: Action,
): { ok: true; action: Action } | { ok: false; error: EngineError } {
  const a = action as unknown as Record<string, unknown>;
  const bad = (detail: string): { ok: false; error: EngineError } => ({
    ok: false,
    error: { code: "INVALID_ACTION_SHAPE", detail },
  });
  if (!a || typeof a !== "object" || typeof a.type !== "string") {
    return bad("action missing 'type'");
  }
  const isGem = (x: unknown): x is Gem => GEMS.includes(x as Gem);
  switch (a.type) {
    case "TAKE_DIFFERENT":
      if (!Array.isArray(a.gems) || !a.gems.every(isGem)) {
        return bad("gems must be an array of gem colors");
      }
      return { ok: true, action: { type: "TAKE_DIFFERENT", gems: a.gems as Gem[] } };
    case "TAKE_SAME":
      if (!isGem(a.gem)) return bad("gem must be a gem color");
      return { ok: true, action: { type: "TAKE_SAME", gem: a.gem } };
    case "RESERVE_BOARD":
      if (typeof a.cardId !== "number") return bad("cardId must be a number");
      return { ok: true, action: { type: "RESERVE_BOARD", cardId: a.cardId } };
    case "RESERVE_DECK":
      if (a.level !== 1 && a.level !== 2 && a.level !== 3) {
        return bad("level must be 1, 2 or 3");
      }
      return { ok: true, action: { type: "RESERVE_DECK", level: a.level } };
    case "PURCHASE":
      if (typeof a.cardId !== "number") return bad("cardId must be a number");
      return {
        ok: true,
        action: {
          type: "PURCHASE",
          cardId: a.cardId,
          payment: a.payment as TokenBag | undefined,
        },
      };
    case "PASS":
      return { ok: true, action: { type: "PASS" } };
    default:
      return bad(`unknown action type '${String(a.type)}'`);
  }
}

// --- Action application ------------------------------------------------------

function applyAction(
  state: GameState,
  player: PlayerState,
  action: Action,
  events: GameEvent[],
): StepResult {
  switch (action.type) {
    case "TAKE_DIFFERENT":
      return takeDifferent(state, player, action.gems, events);
    case "TAKE_SAME":
      return takeSame(state, player, action.gem, events);
    case "RESERVE_BOARD":
      return reserveBoard(state, player, action.cardId, events);
    case "RESERVE_DECK":
      return reserveDeck(state, player, action.level, events);
    case "PURCHASE":
      return purchase(state, player, action.cardId, action.payment, events);
    case "PASS":
      return pass(state, events);
  }
}

function takeDifferent(
  state: GameState,
  player: PlayerState,
  gems: Gem[],
  events: GameEvent[],
): StepResult {
  if (gems.length === 0) return fail({ code: "NO_GEMS_SELECTED" });
  if (gems.length > 3) return fail({ code: "TOO_MANY_GEMS" });
  if (new Set(gems).size !== gems.length) return fail({ code: "DUPLICATE_GEMS" });
  for (const g of gems) {
    if (state.bank[g] <= 0) return fail({ code: "EMPTY_PILE", gem: g });
  }
  for (const g of gems) {
    state.bank[g]--;
    player.tokens[g]++;
  }
  events.push({ t: "took_different", player: state.currentPlayer, gems: [...gems] });
  return OK;
}

function takeSame(
  state: GameState,
  player: PlayerState,
  gem: Gem,
  events: GameEvent[],
): StepResult {
  if (state.bank[gem] < 4) return fail({ code: "PILE_BELOW_FOUR", gem });
  state.bank[gem] -= 2;
  player.tokens[gem] += 2;
  events.push({ t: "took_same", player: state.currentPlayer, gem, count: 2 });
  return OK;
}

function reserveBoard(
  state: GameState,
  player: PlayerState,
  cardId: number,
  events: GameEvent[],
): StepResult {
  if (player.reserved.length >= MAX_RESERVED) return fail({ code: "RESERVE_LIMIT" });

  let loc: { level: Level; idx: number } | null = null;
  for (const level of LEVELS) {
    const idx = state.board[level].indexOf(cardId);
    if (idx !== -1) {
      loc = { level, idx };
      break;
    }
  }
  if (!loc) return fail({ code: "CARD_NOT_AVAILABLE", cardId });

  player.reserved.push({ cardId, hidden: false });
  state.board[loc.level][loc.idx] = state.decks[loc.level].pop() ?? null;

  const gainedGold = state.bank.gold > 0;
  if (gainedGold) {
    state.bank.gold--;
    player.tokens.gold++;
  }
  events.push({
    t: "reserved",
    player: state.currentPlayer,
    level: loc.level,
    cardId,
    gainedGold,
  });
  return OK;
}

function reserveDeck(
  state: GameState,
  player: PlayerState,
  level: Level,
  events: GameEvent[],
): StepResult {
  if (player.reserved.length >= MAX_RESERVED) return fail({ code: "RESERVE_LIMIT" });
  if (state.decks[level].length === 0) return fail({ code: "DECK_EMPTY", level });

  const cardId = state.decks[level].pop() as number;
  player.reserved.push({ cardId, hidden: true }); // blind draw -> hidden

  const gainedGold = state.bank.gold > 0;
  if (gainedGold) {
    state.bank.gold--;
    player.tokens.gold++;
  }
  // cardId intentionally omitted from the log — a blind reserve is secret.
  events.push({ t: "reserved", player: state.currentPlayer, level, gainedGold });
  return OK;
}

function purchase(
  state: GameState,
  player: PlayerState,
  cardId: number,
  payment: TokenBag | undefined,
  events: GameEvent[],
): StepResult {
  const reservedIdx = player.reserved.findIndex((r) => r.cardId === cardId);
  let boardLoc: { level: Level; idx: number } | null = null;
  if (reservedIdx === -1) {
    for (const level of LEVELS) {
      const idx = state.board[level].indexOf(cardId);
      if (idx !== -1) {
        boardLoc = { level, idx };
        break;
      }
    }
    if (!boardLoc) return fail({ code: "CARD_NOT_AVAILABLE", cardId });
  }

  const card = getCard(cardId);

  let pay: TokenBag;
  if (payment === undefined) {
    const auto = computeAutoPayment(player, card);
    if (!auto.ok) {
      return fail({ code: "CANNOT_AFFORD", cardId, shortfall: auto.shortfall });
    }
    pay = auto.payment;
  } else {
    const valid = validateExplicitPayment(player, card, payment);
    if (!valid.ok) return fail({ code: "INVALID_PAYMENT", reason: valid.reason });
    pay = payment;
  }

  // Spend tokens back to the bank.
  for (const c of TOKEN_COLORS) {
    const amt = pay[c] ?? 0;
    if (amt > 0) {
      player.tokens[c] -= amt;
      state.bank[c] += amt;
    }
  }

  player.purchased.push(cardId);
  if (reservedIdx !== -1) {
    player.reserved.splice(reservedIdx, 1); // no board refill for reserved buys
  } else if (boardLoc) {
    state.board[boardLoc.level][boardLoc.idx] =
      state.decks[boardLoc.level].pop() ?? null;
  }

  events.push({
    t: "purchased",
    player: state.currentPlayer,
    cardId,
    points: card.points,
  });
  return OK;
}

function pass(state: GameState, events: GameEvent[]): StepResult {
  if (!canPass(state)) return fail({ code: "PASS_NOT_ALLOWED" });
  events.push({ t: "passed", player: state.currentPlayer });
  return OK;
}

// --- Token return (over-10 gate) --------------------------------------------

function applyReturn(
  state: GameState,
  player: PlayerState,
  ret: TokenBag,
  mustReturn: number,
  events: GameEvent[],
): StepResult {
  if (bagTotal(ret) !== mustReturn) {
    return fail({
      code: "INVALID_TOKEN_RETURN",
      reason: `must return exactly ${mustReturn} token(s)`,
    });
  }
  for (const c of TOKEN_COLORS) {
    const amt = ret[c] ?? 0;
    if (amt < 0) return fail({ code: "INVALID_TOKEN_RETURN", reason: `negative ${c}` });
    if (amt > player.tokens[c]) {
      return fail({
        code: "INVALID_TOKEN_RETURN",
        reason: `only holds ${player.tokens[c]} ${c}`,
      });
    }
  }
  for (const c of TOKEN_COLORS) {
    const amt = ret[c] ?? 0;
    if (amt > 0) {
      player.tokens[c] -= amt;
      state.bank[c] += amt;
    }
  }
  events.push({ t: "returned", player: state.currentPlayer, tokens: compactBag(ret) });
  return OK;
}

// --- Noble gate --------------------------------------------------------------

function applyNobles(
  state: GameState,
  playerIndex: number,
  nobleId: number | undefined,
  events: GameEvent[],
): StepResult {
  const eligible = eligibleNobles(state, playerIndex);

  if (eligible.length === 0) {
    if (nobleId !== undefined) return fail({ code: "NOBLE_NOT_ELIGIBLE", nobleId });
    return OK;
  }

  let chosen: number;
  if (nobleId !== undefined) {
    if (!eligible.includes(nobleId)) {
      return fail({ code: "NOBLE_NOT_ELIGIBLE", nobleId });
    }
    chosen = nobleId;
  } else if (eligible.length === 1) {
    chosen = eligible[0];
  } else {
    return fail({ code: "NOBLE_CHOICE_REQUIRED", eligible });
  }

  const player = state.players[playerIndex];
  player.nobles.push(chosen);
  state.nobles = state.nobles.filter((id) => id !== chosen);
  events.push({ t: "noble", player: playerIndex, nobleId: chosen });
  return OK;
}

// --- Endgame + advance -------------------------------------------------------

function advanceAndCheckEnd(state: GameState, events: GameEvent[]): void {
  if (!state.finalRound) {
    if (state.players.some((p) => getPrestige(p) >= WINNING_SCORE)) {
      state.finalRound = true;
      events.push({ t: "final_round", triggeredBy: state.currentPlayer });
    }
  }

  const isLastSeat = state.currentPlayer === state.players.length - 1;
  state.turnNumber += 1;

  if (state.finalRound && isLastSeat) {
    state.status = "finished";
    state.winners = getWinners(state);
    events.push({ t: "finished", winners: state.winners });
  } else {
    state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  }
}
