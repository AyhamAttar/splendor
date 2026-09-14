import type { PlayerState, DevCardDef, TokenBag, GemBag } from "./types";
import { GEMS, TOKEN_COLORS } from "./types";
import { getBonuses, getEffectiveCost } from "./selectors";

/**
 * Greedily compute a valid payment: spend colored gems first, then cover any
 * remaining cost with gold. Returns the payment bag, or the per-gem shortfall
 * if the player cannot afford the card.
 */
export function computeAutoPayment(
  player: PlayerState,
  card: DevCardDef,
): { ok: true; payment: TokenBag } | { ok: false; shortfall: GemBag } {
  const bonuses = getBonuses(player);
  const eff = getEffectiveCost(card, bonuses);

  const payment: TokenBag = {};
  let goldNeeded = 0;
  for (const g of GEMS) {
    const need = eff[g] ?? 0;
    if (need === 0) continue;
    const fromGems = Math.min(need, player.tokens[g]);
    if (fromGems > 0) payment[g] = fromGems;
    goldNeeded += need - fromGems;
  }

  const gold = player.tokens.gold;
  if (goldNeeded > gold) {
    // Distribute available gold across the per-gem deficits (in GEMS order);
    // whatever is left uncovered is the reported shortfall.
    let remainingGold = gold;
    const shortfall: GemBag = {};
    for (const g of GEMS) {
      const need = eff[g] ?? 0;
      const deficit = Math.max(0, need - player.tokens[g]);
      if (deficit === 0) continue;
      const covered = Math.min(deficit, remainingGold);
      remainingGold -= covered;
      const left = deficit - covered;
      if (left > 0) shortfall[g] = left;
    }
    return { ok: false, shortfall };
  }

  if (goldNeeded > 0) payment.gold = goldNeeded;
  return { ok: true, payment };
}

/** Can the player buy this card at all (via auto-payment)? */
export function canAfford(player: PlayerState, card: DevCardDef): boolean {
  return computeAutoPayment(player, card).ok;
}

/**
 * Validate an explicit payment: only owned tokens, no colored overpay, no
 * paying colors the card doesn't need, and gold must EXACTLY cover the gap.
 * This permits the legal "spend gold instead of a gem I own" play.
 */
export function validateExplicitPayment(
  player: PlayerState,
  card: DevCardDef,
  payment: TokenBag,
): { ok: true } | { ok: false; reason: string } {
  const bonuses = getBonuses(player);
  const eff = getEffectiveCost(card, bonuses);

  // 1. Only owned tokens, no negatives.
  for (const c of TOKEN_COLORS) {
    const pay = payment[c] ?? 0;
    if (pay < 0) return { ok: false, reason: `negative ${c}` };
    if (pay > player.tokens[c]) {
      return { ok: false, reason: `only holds ${player.tokens[c]} ${c}` };
    }
  }

  // 2. No colored overpay / paying colors that aren't required.
  let goldNeeded = 0;
  for (const g of GEMS) {
    const need = eff[g] ?? 0;
    const pay = payment[g] ?? 0;
    if (pay > need) return { ok: false, reason: `overpaid ${g}` };
    goldNeeded += need - pay;
  }

  // 3. Gold must exactly cover the remaining cost.
  const gold = payment.gold ?? 0;
  if (gold !== goldNeeded) {
    return {
      ok: false,
      reason: `gold ${gold} does not match remaining cost ${goldNeeded}`,
    };
  }

  return { ok: true };
}
