import { applyTurn } from "../engine";
import { cardsByLevel, NOBLES } from "../data/lookup";
import { tokenTotal } from "../util";
import { makeState, makePlayer, tokens } from "./fixtures";
import { GEMS, type GemBag, type TokenBag, type GameState, type TurnCommand } from "../types";

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
/** Card ids granting exactly the requested bonus counts (from Level-1 cards). */
function grantBonuses(req: GemBag): number[] {
  const ids: number[] = [];
  for (const g of GEMS) {
    const n = req[g] ?? 0;
    ids.push(...cardsByLevel(1).filter((c) => c.bonus === g).slice(0, n).map((c) => c.id));
  }
  return ids;
}

describe("10-token limit", () => {
  const nine = () => makeState({ players: [makePlayer({ tokens: { white: 5, blue: 4 } }), makePlayer()] });

  it("requires returning the exact overflow when ending over 10", () => {
    const e = fail(nine(), { action: { type: "TAKE_DIFFERENT", gems: ["green", "red"] } });
    expect(e.code).toBe("TOKEN_RETURN_REQUIRED");
    if (e.code === "TOKEN_RETURN_REQUIRED") expect(e.mustReturn).toBe(1);
  });

  it("applies a valid return (including just-taken tokens) and restocks the bank", () => {
    const out = ok(nine(), { action: { type: "TAKE_DIFFERENT", gems: ["green", "red"] }, returnTokens: { white: 1 } });
    expect(tokenTotal(out.players[0].tokens)).toBe(10);
    expect(out.bank.white).toBe(5); // 4 default + 1 returned

    const justTaken = ok(nine(), { action: { type: "TAKE_DIFFERENT", gems: ["green", "red"] }, returnTokens: { green: 1 } });
    expect(tokenTotal(justTaken.players[0].tokens)).toBe(10);
  });

  it("may return gold to get under the limit", () => {
    const s = makeState({ players: [makePlayer({ tokens: { white: 5, blue: 4, gold: 1 } }), makePlayer()] });
    const out = ok(s, { action: { type: "TAKE_DIFFERENT", gems: ["green", "red"] }, returnTokens: { gold: 1, green: 1 } });
    expect(tokenTotal(out.players[0].tokens)).toBe(10);
  });

  it("rejects a wrong-sized or unowned return", () => {
    expect(fail(nine(), { action: { type: "TAKE_DIFFERENT", gems: ["green", "red"] }, returnTokens: { white: 1, blue: 1 } }).code).toBe("INVALID_TOKEN_RETURN");
    expect(fail(nine(), { action: { type: "TAKE_DIFFERENT", gems: ["green", "red"] }, returnTokens: { black: 1 } }).code).toBe("INVALID_TOKEN_RETURN");
  });

  it("rejects an unsolicited return when at or below 10", () => {
    const s = makeState({ players: [makePlayer({ tokens: { white: 2 } }), makePlayer()] });
    expect(fail(s, { action: { type: "TAKE_DIFFERENT", gems: ["green"] }, returnTokens: { green: 1 } }).code).toBe("INVALID_TOKEN_RETURN");
  });
});

describe("nobles", () => {
  const threeColor = NOBLES.find((n) => Object.keys(n.requirement).length === 3)!;

  it("auto-visits a single eligible noble at the end of a (deferred) take turn", () => {
    const s = makeState({
      players: [makePlayer({ purchased: grantBonuses(threeColor.requirement) }), makePlayer()],
      nobles: [threeColor.id],
    });
    const out = ok(s, { action: { type: "TAKE_DIFFERENT", gems: ["white"] } });
    expect(out.players[0].nobles).toEqual([threeColor.id]);
    expect(out.nobles).toEqual([]);
  });

  it("requires a choice when several qualify and awards exactly one", () => {
    const n1 = NOBLES[0];
    const n2 = NOBLES[1];
    const union: GemBag = {};
    for (const g of GEMS) {
      const v = Math.max(n1.requirement[g] ?? 0, n2.requirement[g] ?? 0);
      if (v > 0) union[g] = v;
    }
    const s = makeState({
      players: [makePlayer({ purchased: grantBonuses(union) }), makePlayer()],
      nobles: [n1.id, n2.id],
    });
    const e = fail(s, { action: { type: "TAKE_DIFFERENT", gems: ["white"] } });
    expect(e.code).toBe("NOBLE_CHOICE_REQUIRED");
    if (e.code === "NOBLE_CHOICE_REQUIRED") expect(e.eligible.sort()).toEqual([n1.id, n2.id].sort());

    const out = ok(s, { action: { type: "TAKE_DIFFERENT", gems: ["white"] }, nobleId: n1.id });
    expect(out.players[0].nobles).toEqual([n1.id]);
    expect(out.nobles).toEqual([n2.id]); // the other noble remains
  });

  it("rejects a bogus noble id and never counts tokens as bonuses", () => {
    expect(fail(makeState(), { action: { type: "TAKE_DIFFERENT", gems: ["white"] }, nobleId: 99999 }).code).toBe("NOBLE_NOT_ELIGIBLE");

    const twoColor = NOBLES.find((n) => Object.keys(n.requirement).length === 2)!;
    const tokenBag: TokenBag = {};
    for (const g of GEMS) if (twoColor.requirement[g]) tokenBag[g] = twoColor.requirement[g]!;
    const s = makeState({ players: [makePlayer({ tokens: tokenBag }), makePlayer()], nobles: [twoColor.id] });
    const out = ok(s, { action: { type: "TAKE_DIFFERENT", gems: ["white"] } });
    // tokens (not bonuses) must never satisfy a noble
    expect(out.players[0].nobles).toEqual([]);
  });
});

describe("PASS", () => {
  it("is allowed only in a total lockout", () => {
    const locked = makeState({
      bank: tokens({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }),
      board: { 1: [null, null, null, null], 2: [null, null, null, null], 3: [null, null, null, null] },
      decks: { 1: [], 2: [], 3: [] },
    });
    expect(ok(locked, { action: { type: "PASS" } }).currentPlayer).toBe(1);
  });

  it("is rejected when any action is available", () => {
    expect(fail(makeState(), { action: { type: "PASS" } }).code).toBe("PASS_NOT_ALLOWED");
  });
});
