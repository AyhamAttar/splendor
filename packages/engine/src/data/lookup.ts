import type { DevCardDef, NobleDef, Level } from "../types";
import { CARDS } from "./cards";
import { NOBLES } from "./nobles";

export const CARD_BY_ID: ReadonlyMap<number, DevCardDef> = new Map(
  CARDS.map((c) => [c.id, c]),
);

export const NOBLE_BY_ID: ReadonlyMap<number, NobleDef> = new Map(
  NOBLES.map((n) => [n.id, n]),
);

/** Resolve a card by id; throws on unknown id (an engine/data bug, not user input). */
export function getCard(id: number): DevCardDef {
  const c = CARD_BY_ID.get(id);
  if (!c) throw new Error(`Unknown card id: ${id}`);
  return c;
}

export function getNoble(id: number): NobleDef {
  const n = NOBLE_BY_ID.get(id);
  if (!n) throw new Error(`Unknown noble id: ${id}`);
  return n;
}

export function cardsByLevel(level: Level): DevCardDef[] {
  return CARDS.filter((c) => c.level === level);
}

export { CARDS, NOBLES };
