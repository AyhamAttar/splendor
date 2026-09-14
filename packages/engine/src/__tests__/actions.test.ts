import { applyTurn } from "../engine";
import { cardsByLevel } from "../data/lookup";
import { makeState, makePlayer, tokens, boardWith } from "./fixtures";
import type { Gem, GameState, TurnCommand } from "../types";

const L1 = cardsByLevel(1);
const [c0, c1, c2] = L1;

function ok(state: GameState, cmd: TurnCommand) {
  const r = applyTurn(state, cmd);
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.state;
}
function errCode(state: GameState, cmd: TurnCommand) {
  const r = applyTurn(state, cmd);
  if (r.ok) throw new Error("expected error, got ok");
  return r.error.code;
}

describe("TAKE_DIFFERENT", () => {
  it("moves up to 3 distinct gems from bank to player and advances the turn", () => {
    const s = ok(makeState(), { action: { type: "TAKE_DIFFERENT", gems: ["white", "blue", "green"] } });
    expect(s.players[0].tokens).toMatchObject({ white: 1, blue: 1, green: 1 });
    expect(s.bank).toMatchObject({ white: 3, blue: 3, green: 3 });
    expect(s.currentPlayer).toBe(1);
    expect(s.turnNumber).toBe(1);
  });

  it("allows taking fewer than 3", () => {
    expect(ok(makeState(), { action: { type: "TAKE_DIFFERENT", gems: ["red"] } }).players[0].tokens.red).toBe(1);
    expect(ok(makeState(), { action: { type: "TAKE_DIFFERENT", gems: ["red", "black"] } }).players[0].tokens.black).toBe(1);
  });

  it("rejects duplicates, 4 gems, gold, and empty piles", () => {
    expect(errCode(makeState(), { action: { type: "TAKE_DIFFERENT", gems: ["red", "red"] } })).toBe("DUPLICATE_GEMS");
    expect(errCode(makeState(), { action: { type: "TAKE_DIFFERENT", gems: ["white", "blue", "green", "red"] } })).toBe("TOO_MANY_GEMS");
    // gold is not a valid gem for this action -> shape rejected by the engine
    expect(errCode(makeState(), { action: { type: "TAKE_DIFFERENT", gems: ["gold" as unknown as Gem] } })).toBe("INVALID_ACTION_SHAPE");
    const emptyWhite = makeState({ bank: tokens({ white: 0, blue: 4, green: 4, red: 4, black: 4, gold: 5 }) });
    expect(errCode(emptyWhite, { action: { type: "TAKE_DIFFERENT", gems: ["white"] } })).toBe("EMPTY_PILE");
  });
});

describe("TAKE_SAME", () => {
  it("is legal at exactly 4 in the pile", () => {
    const s = ok(makeState(), { action: { type: "TAKE_SAME", gem: "white" } });
    expect(s.players[0].tokens.white).toBe(2);
    expect(s.bank.white).toBe(2);
  });

  it("is rejected when the pile is below 4", () => {
    const three = makeState({ bank: tokens({ white: 3, blue: 4, green: 4, red: 4, black: 4, gold: 5 }) });
    expect(errCode(three, { action: { type: "TAKE_SAME", gem: "white" } })).toBe("PILE_BELOW_FOUR");
  });
});

describe("RESERVE", () => {
  it("reserves a face-up card, gains a gold, and refills the slot", () => {
    const s = makeState({ board: boardWith(c0), decks: { 1: [c1.id], 2: [], 3: [] } });
    const out = ok(s, { action: { type: "RESERVE_BOARD", cardId: c0.id } });
    expect(out.players[0].reserved).toEqual([{ cardId: c0.id, hidden: false }]);
    expect(out.players[0].tokens.gold).toBe(1);
    expect(out.bank.gold).toBe(4);
    expect(out.board[1][0]).toBe(c1.id); // refilled from deck top
  });

  it("is still legal with no gold left (no gold gained)", () => {
    const s = makeState({ board: boardWith(c0), bank: tokens({ white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 0 }) });
    const out = ok(s, { action: { type: "RESERVE_BOARD", cardId: c0.id } });
    expect(out.players[0].tokens.gold).toBe(0);
    expect(out.players[0].reserved).toHaveLength(1);
  });

  it("leaves an empty slot when the deck is exhausted", () => {
    const s = makeState({ board: boardWith(c0), decks: { 1: [], 2: [], 3: [] } });
    const out = ok(s, { action: { type: "RESERVE_BOARD", cardId: c0.id } });
    expect(out.board[1][0]).toBeNull();
  });

  it("blind-reserves the top of a deck as hidden and omits it from the log", () => {
    const s = makeState({ decks: { 1: [c2.id, c1.id], 2: [], 3: [] } });
    const out = ok(s, { action: { type: "RESERVE_DECK", level: 1 } });
    expect(out.players[0].reserved).toEqual([{ cardId: c1.id, hidden: true }]);
    expect(out.decks[1]).toEqual([c2.id]);
    const ev = out.log.find((e) => e.t === "reserved");
    expect(ev && "cardId" in ev ? (ev as { cardId?: number }).cardId : undefined).toBeUndefined();
  });

  it("rejects a 4th reservation and an empty-deck blind draw", () => {
    const full = makeState({
      board: boardWith(c0),
      players: [makePlayer({ reserved: [{ cardId: c1.id, hidden: false }, { cardId: c2.id, hidden: false }, { cardId: L1[3].id, hidden: false }] }), makePlayer()],
    });
    expect(errCode(full, { action: { type: "RESERVE_BOARD", cardId: c0.id } })).toBe("RESERVE_LIMIT");
    expect(errCode(makeState(), { action: { type: "RESERVE_DECK", level: 1 } })).toBe("DECK_EMPTY");
  });
});
