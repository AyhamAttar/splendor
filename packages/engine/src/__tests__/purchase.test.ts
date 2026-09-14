import { applyTurn } from "../engine";
import { cardsByLevel } from "../data/lookup";
import { getPrestige } from "../selectors";
import { bagTotal } from "../util";
import { makeState, makePlayer, tokens, boardWith } from "./fixtures";
import { GEMS, type Gem, type GameState, type TurnCommand } from "../types";

const L1 = cardsByLevel(1);

// The 1-point Level-1 card that costs 4 of a single color (canonical staple).
const single4 = L1.find(
  (c) => Object.keys(c.cost).length === 1 && Object.values(c.cost)[0] === 4,
)!;
const S = Object.keys(single4.cost)[0] as Gem;
const OTHER = GEMS.find((g) => g !== S)!;

function ok(state: GameState, cmd: TurnCommand) {
  const r = applyTurn(state, cmd);
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.state;
}
function fail(state: GameState, cmd: TurnCommand) {
  const r = applyTurn(state, cmd);
  if (r.ok) throw new Error("expected error, got ok");
  return r.error;
}
function bonusIds(g: Gem, n: number, excludeId: number): number[] {
  return L1.filter((c) => c.bonus === g && c.id !== excludeId)
    .slice(0, n)
    .map((c) => c.id);
}

describe("PURCHASE payment math", () => {
  it("pays the cost, returns tokens to the bank, and refills the slot", () => {
    const refill = L1.find((c) => c.id !== single4.id)!;
    const s = makeState({
      players: [makePlayer({ tokens: { [S]: 4 } }), makePlayer()],
      board: boardWith(single4),
      decks: { 1: [refill.id], 2: [], 3: [] },
    });
    const out = ok(s, { action: { type: "PURCHASE", cardId: single4.id } });
    expect(out.players[0].purchased).toContain(single4.id);
    expect(out.players[0].tokens[S]).toBe(0);
    expect(out.bank[S]).toBe(4 + 4); // spent tokens returned
    expect(out.board[1][0]).toBe(refill.id);
  });

  it("applies bonus discounts (each bonus reduces its color by 1)", () => {
    const bonusCard = L1.find((c) => c.bonus === S && c.id !== single4.id)!;
    const s = makeState({
      players: [makePlayer({ tokens: { [S]: 3 }, purchased: [bonusCard.id] }), makePlayer()],
      board: boardWith(single4),
    });
    const out = ok(s, { action: { type: "PURCHASE", cardId: single4.id } });
    expect(out.players[0].tokens[S]).toBe(0); // 4 cost - 1 bonus = 3 paid
  });

  it("auto-pays with gems first, then covers the shortfall with gold", () => {
    const s = makeState({
      players: [makePlayer({ tokens: { [S]: 2, gold: 2 } }), makePlayer()],
      board: boardWith(single4),
    });
    const out = ok(s, { action: { type: "PURCHASE", cardId: single4.id } });
    expect(out.players[0].tokens[S]).toBe(0);
    expect(out.players[0].tokens.gold).toBe(0);
    expect(out.bank[S]).toBe(4 + 2);
    expect(out.bank.gold).toBe(5 + 2);
  });

  it("allows a fully-discounted (net 0) purchase and still consumes the turn", () => {
    const target = L1.find((c) => c.id !== single4.id && bagTotal(c.cost) <= 3)!;
    const purchased: number[] = [];
    for (const g of GEMS) {
      const need = target.cost[g] ?? 0;
      if (need > 0) purchased.push(...bonusIds(g, need, target.id));
    }
    const s = makeState({
      players: [makePlayer({ purchased }), makePlayer()],
      board: boardWith(target),
    });
    const out = ok(s, { action: { type: "PURCHASE", cardId: target.id } });
    expect(out.players[0].purchased).toContain(target.id);
    expect(out.turnNumber).toBe(1);
  });

  it("reports CANNOT_AFFORD with the correct shortfall", () => {
    const s = makeState({
      players: [makePlayer({ tokens: { [S]: 1 } }), makePlayer()],
      board: boardWith(single4),
    });
    const e = fail(s, { action: { type: "PURCHASE", cardId: single4.id } });
    expect(e.code).toBe("CANNOT_AFFORD");
    if (e.code === "CANNOT_AFFORD") expect(e.shortfall).toEqual({ [S]: 3 });
  });
});

describe("PURCHASE explicit payment", () => {
  const board = boardWith(single4);

  it("accepts an exact payment", () => {
    const s = makeState({ players: [makePlayer({ tokens: { [S]: 4 } }), makePlayer()], board });
    expect(ok(s, { action: { type: "PURCHASE", cardId: single4.id, payment: { [S]: 4 } } }).players[0].purchased).toContain(single4.id);
  });

  it("accepts spending gold instead of an owned gem (conserving the gem)", () => {
    const s = makeState({ players: [makePlayer({ tokens: { [S]: 4, gold: 1 } }), makePlayer()], board });
    const out = ok(s, { action: { type: "PURCHASE", cardId: single4.id, payment: { [S]: 3, gold: 1 } } });
    expect(out.players[0].tokens[S]).toBe(1); // one gem conserved
    expect(out.players[0].tokens.gold).toBe(0);
  });

  it("rejects overpay, unowned tokens, and gold mismatch", () => {
    const overpay = makeState({ players: [makePlayer({ tokens: { [S]: 4, [OTHER]: 1 } }), makePlayer()], board });
    expect(fail(overpay, { action: { type: "PURCHASE", cardId: single4.id, payment: { [S]: 4, [OTHER]: 1 } } }).code).toBe("INVALID_PAYMENT");

    const unowned = makeState({ players: [makePlayer({ tokens: { [S]: 3 } }), makePlayer()], board });
    expect(fail(unowned, { action: { type: "PURCHASE", cardId: single4.id, payment: { [S]: 4 } } }).code).toBe("INVALID_PAYMENT");

    const goldMismatch = makeState({ players: [makePlayer({ tokens: { [S]: 4, gold: 1 } }), makePlayer()], board });
    expect(fail(goldMismatch, { action: { type: "PURCHASE", cardId: single4.id, payment: { [S]: 4, gold: 1 } } }).code).toBe("INVALID_PAYMENT");
  });
});

describe("PURCHASE from reserve", () => {
  it("removes the card from reserve with no board refill", () => {
    const s = makeState({
      players: [makePlayer({ tokens: { [S]: 4 }, reserved: [{ cardId: single4.id, hidden: true }] }), makePlayer()],
    });
    const out = ok(s, { action: { type: "PURCHASE", cardId: single4.id } });
    expect(out.players[0].reserved).toHaveLength(0);
    expect(out.players[0].purchased).toContain(single4.id);
    expect(getPrestige(out.players[0])).toBe(single4.points);
  });
});
