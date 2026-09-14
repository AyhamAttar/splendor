import { applyTurn } from "../engine";
import { createGame } from "../setup";
import { cardsByLevel, CARDS, getCard } from "../data/lookup";
import { getWinners, getPrestige } from "../selectors";
import { canAfford } from "../payment";
import { mulberry32, shuffle } from "../rng";
import { makeState, makePlayer, totalTokensInPlay, totalCardsInPlay } from "./fixtures";
import {
  GEMS,
  TOKEN_COLORS,
  LEVELS,
  type Action,
  type GameState,
  type PlayerState,
  type TokenBag,
  type TokenColor,
  type TurnCommand,
} from "../types";

const L3 = cardsByLevel(3);
/** Enough Level-3 cards for >= 15 prestige (each is worth 3-5). */
const winningCards = L3.slice(0, 5).map((c) => c.id);

function threePlayers(overrides: Partial<PlayerState>[]): PlayerState[] {
  return [0, 1, 2].map((i) => makePlayer({ name: `P${i}`, ...(overrides[i] ?? {}) }));
}

describe("endgame", () => {
  it("triggers the final round but lets the remaining seats move, finishing after the last seat", () => {
    const s = makeState({ players: threePlayers([{ purchased: winningCards }, {}, {}]), currentPlayer: 0 });
    expect(getPrestige(s.players[0])).toBeGreaterThanOrEqual(15);

    const t1 = applyTurn(s, { action: { type: "TAKE_DIFFERENT", gems: ["white"] } });
    if (!t1.ok) throw new Error("t1");
    expect(t1.state.finalRound).toBe(true);
    expect(t1.state.status).toBe("active");
    expect(t1.state.currentPlayer).toBe(1);

    const t2 = applyTurn(t1.state, { action: { type: "TAKE_DIFFERENT", gems: ["blue"] } });
    if (!t2.ok) throw new Error("t2");
    expect(t2.state.status).toBe("active");
    expect(t2.state.currentPlayer).toBe(2);

    const t3 = applyTurn(t2.state, { action: { type: "TAKE_DIFFERENT", gems: ["green"] } });
    if (!t3.ok) throw new Error("t3");
    expect(t3.state.status).toBe("finished");
    expect(t3.state.winners).toEqual([0]);
    expect(t3.state.turnNumber % 3).toBe(0); // equal turns for everyone
  });

  it("finishes immediately when the last seat reaches 15", () => {
    const s = makeState({ players: threePlayers([{}, {}, { purchased: winningCards }]), currentPlayer: 2, turnNumber: 2 });
    const r = applyTurn(s, { action: { type: "TAKE_DIFFERENT", gems: ["white"] } });
    if (!r.ok) throw new Error("r");
    expect(r.state.status).toBe("finished");
    expect(r.state.winners).toEqual([2]);
    expect(r.state.turnNumber % 3).toBe(0);
  });
});

describe("getWinners tie-break", () => {
  it("breaks a prestige tie by fewest purchased cards", () => {
    const high = L3.reduce((a, b) => (b.points > a.points ? b : a));
    let pair: [number, number] | null = null;
    const pool = CARDS.filter((c) => c.id !== high.id);
    outer: for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        if (pool[i].points + pool[j].points === high.points) {
          pair = [pool[i].id, pool[j].id];
          break outer;
        }
      }
    }
    expect(pair).not.toBeNull();
    const state = makeState({
      players: [makePlayer({ purchased: pair! }), makePlayer({ purchased: [high.id] })],
    });
    expect(getPrestige(state.players[0])).toBe(getPrestige(state.players[1]));
    expect(getWinners(state)).toEqual([1]); // fewer cards wins
  });

  it("returns co-winners on a full tie", () => {
    const c = L3[0].id;
    const state = makeState({ players: [makePlayer({ purchased: [c] }), makePlayer({ purchased: [c] })] });
    expect(getWinners(state)).toEqual([0, 1]);
  });
});

// --- Conservation fuzz -------------------------------------------------------

function affordableIds(state: GameState, p: PlayerState): number[] {
  const ids: number[] = [];
  for (const l of LEVELS) for (const cid of state.board[l]) if (cid != null && canAfford(p, getCard(cid))) ids.push(cid);
  for (const r of p.reserved) if (canAfford(p, getCard(r.cardId))) ids.push(r.cardId);
  return ids;
}

function chooseAction(state: GameState, rng: () => number): Action {
  const p = state.players[state.currentPlayer];
  const aff = affordableIds(state, p);
  if (aff.length) {
    // prefer the highest-point affordable card so games make progress
    let best = aff[0];
    for (const id of aff) if (getCard(id).points > getCard(best).points) best = id;
    return { type: "PURCHASE", cardId: best };
  }
  const avail = GEMS.filter((g) => state.bank[g] > 0);
  const r = rng();
  if (avail.length && r < 0.75) {
    return { type: "TAKE_DIFFERENT", gems: shuffle(avail, rng).slice(0, Math.min(3, avail.length)) };
  }
  const four = GEMS.filter((g) => state.bank[g] >= 4);
  if (four.length && r < 0.85) return { type: "TAKE_SAME", gem: four[Math.floor(rng() * four.length)] };
  if (p.reserved.length < 3) {
    const decks = LEVELS.filter((l) => state.decks[l].length > 0);
    if (decks.length) return { type: "RESERVE_DECK", level: decks[Math.floor(rng() * decks.length)] };
    const bc: number[] = [];
    for (const l of LEVELS) for (const cid of state.board[l]) if (cid != null) bc.push(cid);
    if (bc.length) return { type: "RESERVE_BOARD", cardId: bc[Math.floor(rng() * bc.length)] };
  }
  if (avail.length) return { type: "TAKE_DIFFERENT", gems: [avail[0]] };
  return { type: "PASS" };
}

function chooseReturn(state: GameState, action: Action, mustReturn: number): TokenBag {
  const p = state.players[state.currentPlayer];
  const proj: Record<TokenColor, number> = { ...p.tokens };
  if (action.type === "TAKE_DIFFERENT") for (const g of action.gems) proj[g]++;
  else if (action.type === "TAKE_SAME") proj[action.gem] += 2;
  else if ((action.type === "RESERVE_DECK" || action.type === "RESERVE_BOARD") && state.bank.gold > 0) proj.gold++;
  const ret: TokenBag = {};
  let rem = mustReturn;
  for (const c of TOKEN_COLORS) {
    if (rem <= 0) break;
    const take = Math.min(proj[c], rem);
    if (take > 0) {
      ret[c] = take;
      rem -= take;
    }
  }
  return ret;
}

function step(state: GameState, rng: () => number): GameState {
  const action = chooseAction(state, rng);
  let cmd: TurnCommand = { action };
  for (let i = 0; i < 3; i++) {
    const res = applyTurn(state, cmd);
    if (res.ok) return res.state;
    const e = res.error;
    if (e.code === "TOKEN_RETURN_REQUIRED") cmd = { ...cmd, returnTokens: chooseReturn(state, action, e.mustReturn) };
    else if (e.code === "NOBLE_CHOICE_REQUIRED") cmd = { ...cmd, nobleId: e.eligible[0] };
    else throw new Error(`unexpected error ${JSON.stringify(e)} for ${JSON.stringify(action)}`);
  }
  throw new Error("turn could not be completed");
}

describe("random-playout conservation & termination", () => {
  const cases: Array<[string[], number]> = [];
  for (let seed = 1; seed <= 5; seed++) {
    cases.push([["A", "B"], seed]);
    cases.push([["A", "B", "C"], seed]);
    cases.push([["A", "B", "C", "D"], seed]);
  }

  it.each(cases)("%s seed %i conserves tokens/cards and terminates", (names, seed) => {
    let state = createGame({ id: "fuzz", playerNames: names as string[], seed });
    const initialTokens = totalTokensInPlay(state);
    let steps = 0;
    while (state.status === "active" && steps < 3000) {
      state = step(state, mulberry32(seed * 7919 + steps * 104729));
      expect(totalTokensInPlay(state)).toBe(initialTokens);
      expect(totalCardsInPlay(state)).toBe(90);
      steps++;
    }
    expect(state.status).toBe("finished");
    expect(state.turnNumber % (names as string[]).length).toBe(0);
    expect(state.winners!.length).toBeGreaterThanOrEqual(1);
  });
});
