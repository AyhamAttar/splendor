import type { DevCardDef } from "@splendor/engine";
import { CARD_IMAGE_FILES } from "./cardImageList";

/**
 * Assigns the available real card artwork (public/assets/Cards/) to a fixed,
 * scattered subset of the 90 development cards. Deterministic (fixed seed), so
 * a given card always shows the same image; the ~two-thirds of cards without
 * one fall back to the pure-CSS parchment face.
 */
const CARD_IMAGE_BY_ID: Map<number, string> = (() => {
  const ids = Array.from({ length: 90 }, (_, i) => i + 1);
  // Small deterministic PRNG shuffle so the illustrated cards are spread across
  // levels/colors rather than clustered at the low ids.
  let seed = 0x5eed01;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const map = new Map<number, string>();
  CARD_IMAGE_FILES.forEach((file, i) => {
    map.set(ids[i], `/assets/Cards/${encodeURIComponent(file)}`);
  });
  return map;
})();

/**
 * Public URL of a card's real artwork, or `null` when the card uses the
 * pure-CSS parchment face. Only a scattered subset of cards are illustrated.
 */
export function cardImage(card: DevCardDef): string | null {
  return CARD_IMAGE_BY_ID.get(card.id) ?? null;
}
