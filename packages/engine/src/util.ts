import type { GemBag, TokenBag, TokenColor } from "./types";
import { GEMS } from "./types";

/** A fresh dense token record with every color at zero. */
export function emptyTokens(): Record<TokenColor, number> {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
}

/** Sum of all counts in a bag. */
export function bagTotal(bag: TokenBag | GemBag | Record<string, number>): number {
  let total = 0;
  for (const key of Object.keys(bag)) {
    total += (bag as Record<string, number>)[key] ?? 0;
  }
  return total;
}

/** Total tokens (all six colors) a player holds. */
export function tokenTotal(tokens: Record<TokenColor, number>): number {
  return (
    tokens.white +
    tokens.blue +
    tokens.green +
    tokens.red +
    tokens.black +
    tokens.gold
  );
}

/** Count distinct gem colors (excludes gold) present with a positive count. */
export function distinctGems(bag: Record<TokenColor, number>): number {
  return GEMS.reduce((n, g) => n + (bag[g] > 0 ? 1 : 0), 0);
}

/** Remove zero/negative entries from a bag, returning a compact copy. */
export function compactBag<T extends string>(
  bag: Partial<Record<T, number>>,
): Partial<Record<T, number>> {
  const out: Partial<Record<T, number>> = {};
  for (const key of Object.keys(bag) as T[]) {
    const v = bag[key] ?? 0;
    if (v > 0) out[key] = v;
  }
  return out;
}
