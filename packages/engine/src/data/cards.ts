import type { DevCardDef } from "../types";

/**
 * The canonical base-game Splendor development deck: 90 cards.
 *   Tier 1 (ids  1-40): 40 cards, 8 of each bonus color.
 *   Tier 2 (ids 41-70): 30 cards, 6 of each bonus color.
 *   Tier 3 (ids 71-90): 20 cards, 4 of each bonus color.
 *
 * Point distribution (base game, verified):
 *   Tier 1: 35x 0pt, 5x 1pt.
 *   Tier 2: 10x 1pt, 15x 2pt, 5x 3pt.
 *   Tier 3: 5x 3pt, 10x 4pt, 5x 5pt.
 *
 * Transcribed and cross-verified against two independent open-source datasets
 * that agree exactly (identical 90-card multiset, color-symmetric per tier):
 *   - github.com/bouk/splendimax  ("Splendor Cards.csv")
 *   - github.com/seal256/splendor ("assets/cards.csv")
 * Colors: white=diamond, blue=sapphire, green=emerald, red=ruby, black=onyx.
 */
export const CARDS: DevCardDef[] = [
  // ---- Tier 1 (ids 1-40) ----
  { id: 1, level: 1, points: 0, bonus: "white", cost: { blue: 1, green: 1, red: 1, black: 1 } },
  { id: 2, level: 1, points: 0, bonus: "white", cost: { blue: 1, green: 2, red: 1, black: 1 } },
  { id: 3, level: 1, points: 0, bonus: "white", cost: { blue: 2, green: 2, black: 1 } },
  { id: 4, level: 1, points: 0, bonus: "white", cost: { white: 3, blue: 1, black: 1 } },
  { id: 5, level: 1, points: 0, bonus: "white", cost: { red: 2, black: 1 } },
  { id: 6, level: 1, points: 0, bonus: "white", cost: { blue: 2, black: 2 } },
  { id: 7, level: 1, points: 0, bonus: "white", cost: { blue: 3 } },
  { id: 8, level: 1, points: 1, bonus: "white", cost: { green: 4 } },
  { id: 9, level: 1, points: 0, bonus: "blue", cost: { white: 1, green: 1, red: 1, black: 1 } },
  { id: 10, level: 1, points: 0, bonus: "blue", cost: { white: 1, green: 1, red: 2, black: 1 } },
  { id: 11, level: 1, points: 0, bonus: "blue", cost: { white: 1, green: 2, red: 2 } },
  { id: 12, level: 1, points: 0, bonus: "blue", cost: { blue: 1, green: 3, red: 1 } },
  { id: 13, level: 1, points: 0, bonus: "blue", cost: { white: 1, black: 2 } },
  { id: 14, level: 1, points: 0, bonus: "blue", cost: { green: 2, black: 2 } },
  { id: 15, level: 1, points: 0, bonus: "blue", cost: { black: 3 } },
  { id: 16, level: 1, points: 1, bonus: "blue", cost: { red: 4 } },
  { id: 17, level: 1, points: 0, bonus: "green", cost: { white: 1, blue: 1, red: 1, black: 1 } },
  { id: 18, level: 1, points: 0, bonus: "green", cost: { white: 1, blue: 1, red: 1, black: 2 } },
  { id: 19, level: 1, points: 0, bonus: "green", cost: { blue: 1, red: 2, black: 2 } },
  { id: 20, level: 1, points: 0, bonus: "green", cost: { white: 1, blue: 3, green: 1 } },
  { id: 21, level: 1, points: 0, bonus: "green", cost: { white: 2, blue: 1 } },
  { id: 22, level: 1, points: 0, bonus: "green", cost: { blue: 2, red: 2 } },
  { id: 23, level: 1, points: 0, bonus: "green", cost: { red: 3 } },
  { id: 24, level: 1, points: 1, bonus: "green", cost: { black: 4 } },
  { id: 25, level: 1, points: 0, bonus: "red", cost: { white: 1, blue: 1, green: 1, black: 1 } },
  { id: 26, level: 1, points: 0, bonus: "red", cost: { white: 2, blue: 1, green: 1, black: 1 } },
  { id: 27, level: 1, points: 0, bonus: "red", cost: { white: 2, green: 1, black: 2 } },
  { id: 28, level: 1, points: 0, bonus: "red", cost: { white: 1, red: 1, black: 3 } },
  { id: 29, level: 1, points: 0, bonus: "red", cost: { blue: 2, green: 1 } },
  { id: 30, level: 1, points: 0, bonus: "red", cost: { white: 2, red: 2 } },
  { id: 31, level: 1, points: 0, bonus: "red", cost: { white: 3 } },
  { id: 32, level: 1, points: 1, bonus: "red", cost: { white: 4 } },
  { id: 33, level: 1, points: 0, bonus: "black", cost: { white: 1, blue: 1, green: 1, red: 1 } },
  { id: 34, level: 1, points: 0, bonus: "black", cost: { white: 1, blue: 2, green: 1, red: 1 } },
  { id: 35, level: 1, points: 0, bonus: "black", cost: { white: 2, blue: 2, red: 1 } },
  { id: 36, level: 1, points: 0, bonus: "black", cost: { green: 1, red: 3, black: 1 } },
  { id: 37, level: 1, points: 0, bonus: "black", cost: { green: 2, red: 1 } },
  { id: 38, level: 1, points: 0, bonus: "black", cost: { white: 2, green: 2 } },
  { id: 39, level: 1, points: 0, bonus: "black", cost: { green: 3 } },
  { id: 40, level: 1, points: 1, bonus: "black", cost: { blue: 4 } },
  // ---- Tier 2 (ids 41-70) ----
  { id: 41, level: 2, points: 1, bonus: "white", cost: { green: 3, red: 2, black: 2 } },
  { id: 42, level: 2, points: 1, bonus: "white", cost: { white: 2, blue: 3, red: 3 } },
  { id: 43, level: 2, points: 2, bonus: "white", cost: { green: 1, red: 4, black: 2 } },
  { id: 44, level: 2, points: 2, bonus: "white", cost: { red: 5, black: 3 } },
  { id: 45, level: 2, points: 2, bonus: "white", cost: { red: 5 } },
  { id: 46, level: 2, points: 3, bonus: "white", cost: { white: 6 } },
  { id: 47, level: 2, points: 1, bonus: "blue", cost: { blue: 2, green: 2, red: 3 } },
  { id: 48, level: 2, points: 1, bonus: "blue", cost: { blue: 2, green: 3, black: 3 } },
  { id: 49, level: 2, points: 2, bonus: "blue", cost: { white: 5, blue: 3 } },
  { id: 50, level: 2, points: 2, bonus: "blue", cost: { white: 2, red: 1, black: 4 } },
  { id: 51, level: 2, points: 2, bonus: "blue", cost: { blue: 5 } },
  { id: 52, level: 2, points: 3, bonus: "blue", cost: { blue: 6 } },
  { id: 53, level: 2, points: 1, bonus: "green", cost: { white: 3, green: 2, red: 3 } },
  { id: 54, level: 2, points: 1, bonus: "green", cost: { white: 2, blue: 3, black: 2 } },
  { id: 55, level: 2, points: 2, bonus: "green", cost: { white: 4, blue: 2, black: 1 } },
  { id: 56, level: 2, points: 2, bonus: "green", cost: { blue: 5, green: 3 } },
  { id: 57, level: 2, points: 2, bonus: "green", cost: { green: 5 } },
  { id: 58, level: 2, points: 3, bonus: "green", cost: { green: 6 } },
  { id: 59, level: 2, points: 1, bonus: "red", cost: { white: 2, red: 2, black: 3 } },
  { id: 60, level: 2, points: 1, bonus: "red", cost: { blue: 3, red: 2, black: 3 } },
  { id: 61, level: 2, points: 2, bonus: "red", cost: { white: 1, blue: 4, green: 2 } },
  { id: 62, level: 2, points: 2, bonus: "red", cost: { white: 3, black: 5 } },
  { id: 63, level: 2, points: 2, bonus: "red", cost: { black: 5 } },
  { id: 64, level: 2, points: 3, bonus: "red", cost: { red: 6 } },
  { id: 65, level: 2, points: 1, bonus: "black", cost: { white: 3, blue: 2, green: 2 } },
  { id: 66, level: 2, points: 1, bonus: "black", cost: { white: 3, green: 3, black: 2 } },
  { id: 67, level: 2, points: 2, bonus: "black", cost: { blue: 1, green: 4, red: 2 } },
  { id: 68, level: 2, points: 2, bonus: "black", cost: { green: 5, red: 3 } },
  { id: 69, level: 2, points: 2, bonus: "black", cost: { white: 5 } },
  { id: 70, level: 2, points: 3, bonus: "black", cost: { black: 6 } },
  // ---- Tier 3 (ids 71-90) ----
  { id: 71, level: 3, points: 3, bonus: "white", cost: { blue: 3, green: 3, red: 5, black: 3 } },
  { id: 72, level: 3, points: 4, bonus: "white", cost: { black: 7 } },
  { id: 73, level: 3, points: 4, bonus: "white", cost: { white: 3, red: 3, black: 6 } },
  { id: 74, level: 3, points: 5, bonus: "white", cost: { white: 3, black: 7 } },
  { id: 75, level: 3, points: 3, bonus: "blue", cost: { white: 3, green: 3, red: 3, black: 5 } },
  { id: 76, level: 3, points: 4, bonus: "blue", cost: { white: 7 } },
  { id: 77, level: 3, points: 4, bonus: "blue", cost: { white: 6, blue: 3, black: 3 } },
  { id: 78, level: 3, points: 5, bonus: "blue", cost: { white: 7, blue: 3 } },
  { id: 79, level: 3, points: 3, bonus: "green", cost: { white: 5, blue: 3, red: 3, black: 3 } },
  { id: 80, level: 3, points: 4, bonus: "green", cost: { blue: 7 } },
  { id: 81, level: 3, points: 4, bonus: "green", cost: { white: 3, blue: 6, green: 3 } },
  { id: 82, level: 3, points: 5, bonus: "green", cost: { blue: 7, green: 3 } },
  { id: 83, level: 3, points: 3, bonus: "red", cost: { white: 3, blue: 5, green: 3, black: 3 } },
  { id: 84, level: 3, points: 4, bonus: "red", cost: { green: 7 } },
  { id: 85, level: 3, points: 4, bonus: "red", cost: { blue: 3, green: 6, red: 3 } },
  { id: 86, level: 3, points: 5, bonus: "red", cost: { green: 7, red: 3 } },
  { id: 87, level: 3, points: 3, bonus: "black", cost: { white: 3, blue: 3, green: 5, red: 3 } },
  { id: 88, level: 3, points: 4, bonus: "black", cost: { red: 7 } },
  { id: 89, level: 3, points: 4, bonus: "black", cost: { green: 3, red: 6, black: 3 } },
  { id: 90, level: 3, points: 5, bonus: "black", cost: { red: 7, black: 3 } },
];
