import type { NobleDef } from "../types";

/**
 * Splendor nobles: 12 tiles, each worth 3 prestige.
 * ids 1-10 are the canonical base-game nobles (five 4+4 pairs, five 3+3+3
 * triples), cross-verified against github.com/seal256/splendor and
 * github.com/bouk/splendimax. ids 11-12 are two extra 4+4 nobles added so all
 * twelve noble artworks can be used; each game still reveals only players+1.
 * Colors: white=diamond, blue=sapphire, green=emerald, red=ruby, black=onyx.
 */
export const NOBLES: NobleDef[] = [
  { id: 1, points: 3, requirement: { green: 4, red: 4 } },
  { id: 2, points: 3, requirement: { blue: 4, green: 4 } },
  { id: 3, points: 3, requirement: { white: 4, blue: 4 } },
  { id: 4, points: 3, requirement: { white: 4, black: 4 } },
  { id: 5, points: 3, requirement: { red: 4, black: 4 } },
  { id: 6, points: 3, requirement: { blue: 3, green: 3, red: 3 } },
  { id: 7, points: 3, requirement: { white: 3, blue: 3, green: 3 } },
  { id: 8, points: 3, requirement: { white: 3, blue: 3, black: 3 } },
  { id: 9, points: 3, requirement: { white: 3, red: 3, black: 3 } },
  { id: 10, points: 3, requirement: { green: 3, red: 3, black: 3 } },
  { id: 11, points: 3, requirement: { white: 4, green: 4 } },
  { id: 12, points: 3, requirement: { blue: 4, red: 4 } },
];
