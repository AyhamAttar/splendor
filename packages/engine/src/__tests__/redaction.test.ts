import { redactStateFor } from "../redaction";
import { makeState, makePlayer } from "./fixtures";
import type { GameState } from "../types";

function stateWithDecks(): GameState {
  return makeState({
    decks: {
      1: [10, 11, 12, 13, 14],
      2: [40, 41, 42],
      3: [70],
    },
  });
}

describe("redactStateFor — decks", () => {
  it("replaces deck arrays with remaining counts", () => {
    const r = redactStateFor(stateWithDecks(), 0);
    expect(r.deckCounts[1]).toBe(5);
    expect(r.deckCounts[2]).toBe(3);
    expect(r.deckCounts[3]).toBe(1);
  });

  it("does not expose the raw deck arrays", () => {
    const r = redactStateFor(stateWithDecks(), 0);
    expect((r as unknown as GameState).decks).toBeUndefined();
  });
});

describe("redactStateFor — blind reserves", () => {
  const blindReserve = { cardId: 99, hidden: true };
  const boardReserve = { cardId: 42, hidden: false };

  function stateWithReserves(): GameState {
    return makeState({
      players: [
        makePlayer({ name: "A", reserved: [blindReserve] }),   // seat 0
        makePlayer({ name: "B", reserved: [blindReserve, boardReserve] }), // seat 1
      ],
    });
  }

  it("viewer sees their own blind reserve intact", () => {
    const r = redactStateFor(stateWithReserves(), 0);
    const own = r.players[0].reserved[0];
    expect(own).toEqual({ cardId: 99, hidden: true });
  });

  it("viewer sees opponent blind reserve with cardId nulled", () => {
    const r = redactStateFor(stateWithReserves(), 0);
    const opp = r.players[1].reserved[0];
    expect(opp).toEqual({ hidden: true, cardId: null });
  });

  it("board-reserve (hidden:false) is visible to all viewers", () => {
    const r = redactStateFor(stateWithReserves(), 0);
    const boardRes = r.players[1].reserved[1];
    expect(boardRes).toEqual({ cardId: 42, hidden: false });
  });

  it("spectator (viewerSeat=null) sees all blind reserves scrubbed", () => {
    const r = redactStateFor(stateWithReserves(), null);
    expect(r.players[0].reserved[0]).toEqual({ hidden: true, cardId: null });
    expect(r.players[1].reserved[0]).toEqual({ hidden: true, cardId: null });
    // board-reserve still visible to spectator
    expect(r.players[1].reserved[1]).toEqual({ cardId: 42, hidden: false });
  });
});

describe("redactStateFor — unredacted fields preserved", () => {
  it("bank, board, nobles, currentPlayer, status are untouched", () => {
    const state = stateWithDecks();
    const r = redactStateFor(state, 0);
    expect(r.bank).toEqual(state.bank);
    expect(r.board).toEqual(state.board);
    expect(r.nobles).toEqual(state.nobles);
    expect(r.currentPlayer).toBe(state.currentPlayer);
    expect(r.status).toBe(state.status);
    expect(r.id).toBe(state.id);
    expect(r.seed).toBe(state.seed);
  });

  it("purchased, tokens, name on players are untouched", () => {
    const state = stateWithDecks();
    const r = redactStateFor(state, 0);
    for (let i = 0; i < state.players.length; i++) {
      expect(r.players[i].name).toBe(state.players[i].name);
      expect(r.players[i].tokens).toEqual(state.players[i].tokens);
      expect(r.players[i].purchased).toEqual(state.players[i].purchased);
    }
  });
});

describe("redactStateFor — log scrubbing", () => {
  it("strips cardId from opponent deck-reserve log events", () => {
    const state = makeState({
      log: [
        { t: "reserved", player: 1, level: 1, cardId: 55, gainedGold: false },
      ],
    });
    const r = redactStateFor(state, 0); // viewer is seat 0, event is seat 1
    const ev = r.log[0] as { t: string; cardId?: number };
    expect(ev.t).toBe("reserved");
    expect(ev.cardId).toBeUndefined();
  });

  it("keeps cardId on own reserve log events", () => {
    const state = makeState({
      log: [
        { t: "reserved", player: 0, level: 1, cardId: 55, gainedGold: false },
      ],
    });
    const r = redactStateFor(state, 0);
    const ev = r.log[0] as { t: string; cardId?: number };
    expect(ev.cardId).toBe(55);
  });
});
