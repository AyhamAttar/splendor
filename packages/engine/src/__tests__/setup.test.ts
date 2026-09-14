import { createGame } from "../setup";
import { CARDS, NOBLES, cardsByLevel } from "../data/lookup";
import { GEMS, type Gem, type Level } from "../types";
import { bagTotal } from "../util";
import { totalTokensInPlay, totalCardsInPlay } from "./fixtures";

describe("dataset invariants", () => {
  it("has exactly 90 cards split 40/30/20 by level", () => {
    expect(CARDS).toHaveLength(90);
    expect(cardsByLevel(1)).toHaveLength(40);
    expect(cardsByLevel(2)).toHaveLength(30);
    expect(cardsByLevel(3)).toHaveLength(20);
  });

  it("assigns ids 1-40 / 41-70 / 71-90 and all unique", () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(90);
    expect(cardsByLevel(1).every((c) => c.id >= 1 && c.id <= 40)).toBe(true);
    expect(cardsByLevel(2).every((c) => c.id >= 41 && c.id <= 70)).toBe(true);
    expect(cardsByLevel(3).every((c) => c.id >= 71 && c.id <= 90)).toBe(true);
  });

  it("has the right bonus-color distribution per level (8/6/4 each)", () => {
    const perLevel: Record<Level, number> = { 1: 8, 2: 6, 3: 4 };
    for (const level of [1, 2, 3] as Level[]) {
      for (const g of GEMS) {
        const count = cardsByLevel(level).filter((c) => c.bonus === g).length;
        expect(count).toBe(perLevel[level]);
      }
    }
  });

  it("keeps points within the canonical per-tier ranges", () => {
    const allowed: Record<Level, Set<number>> = {
      1: new Set([0, 1]),
      2: new Set([1, 2, 3]),
      3: new Set([3, 4, 5]),
    };
    for (const c of CARDS) {
      expect(allowed[c.level].has(c.points)).toBe(true);
    }
  });

  it("uses only positive gem costs (no zero entries, no gold)", () => {
    for (const c of CARDS) {
      for (const key of Object.keys(c.cost)) {
        expect(GEMS).toContain(key as Gem);
        expect(c.cost[key as Gem]!).toBeGreaterThan(0);
      }
    }
  });

  it("has 12 nobles, each worth 3, requiring 4+4 or 3+3+3", () => {
    expect(NOBLES).toHaveLength(12);
    expect(new Set(NOBLES.map((n) => n.id)).size).toBe(12);
    for (const n of NOBLES) {
      expect(n.points).toBe(3);
      const values = Object.values(n.requirement);
      const total = bagTotal(n.requirement);
      const isTwoByFour = values.length === 2 && values.every((v) => v === 4);
      const isThreeByThree = values.length === 3 && values.every((v) => v === 3);
      expect(isTwoByFour || isThreeByThree).toBe(true);
      expect(total === 8 || total === 9).toBe(true);
    }
  });
});

describe("createGame setup invariants", () => {
  it.each([
    [2, 4, 3],
    [3, 5, 4],
    [4, 7, 5],
  ])(
    "%i players -> %i gems per color, %i nobles",
    (playerCount, gemsPerColor, nobleCount) => {
      const names = ["A", "B", "C", "D"].slice(0, playerCount);
      const s = createGame({ id: "g", playerNames: names, seed: 42 });

      for (const g of GEMS) expect(s.bank[g]).toBe(gemsPerColor);
      expect(s.bank.gold).toBe(5);
      expect(s.nobles).toHaveLength(nobleCount);

      for (const level of [1, 2, 3] as Level[]) {
        expect(s.board[level]).toHaveLength(4);
        expect(s.board[level].every((c) => c != null)).toBe(true);
      }
      // 78 cards remain in decks (90 - 12 revealed).
      const inDecks =
        s.decks[1].length + s.decks[2].length + s.decks[3].length;
      expect(inDecks).toBe(78);

      expect(s.currentPlayer).toBe(0);
      expect(s.players).toHaveLength(playerCount);
      expect(totalCardsInPlay(s)).toBe(90);
    },
  );

  it("token totals match the per-player-count bank", () => {
    expect(totalTokensInPlay(createGame({ id: "g", playerNames: ["A", "B"], seed: 1 }))).toBe(25);
    expect(totalTokensInPlay(createGame({ id: "g", playerNames: ["A", "B", "C"], seed: 1 }))).toBe(30);
    expect(totalTokensInPlay(createGame({ id: "g", playerNames: ["A", "B", "C", "D"], seed: 1 }))).toBe(40);
  });

  it("is deterministic for a given seed, and varies across seeds", () => {
    const a = createGame({ id: "g", playerNames: ["A", "B"], seed: 7 });
    const b = createGame({ id: "g", playerNames: ["A", "B"], seed: 7 });
    const c = createGame({ id: "g", playerNames: ["A", "B"], seed: 8 });
    expect(a.board).toEqual(b.board);
    expect(a.decks).toEqual(b.decks);
    expect(a.nobles).toEqual(b.nobles);
    // Extremely unlikely to match across different seeds.
    expect(a.decks[1]).not.toEqual(c.decks[1]);
  });

  it("rejects fewer than 2 or more than 4 players", () => {
    expect(() => createGame({ id: "g", playerNames: ["A"], seed: 1 })).toThrow();
    expect(() =>
      createGame({ id: "g", playerNames: ["A", "B", "C", "D", "E"], seed: 1 }),
    ).toThrow();
  });
});
