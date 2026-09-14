"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  Action,
  GameState,
  Gem,
  RedactedGameState,
} from "@splendor/engine";
import { GEM_ORDER } from "@/lib/gems";

export type GemCounts = Partial<Record<Gem, number>>;

/**
 * Manages the current player's token pick and derives the take action.
 * Enforces Splendor's take rules live so the UI can disable illegal clicks:
 *  - up to 3 distinct gems, OR exactly 2 of one color when that pile has >= 4.
 */
export function useSelection(state: GameState | RedactedGameState | null) {
  const [gems, setGems] = useState<GemCounts>({});

  const distinct = GEM_ORDER.filter((g) => (gems[g] ?? 0) > 0);
  const total = distinct.reduce((n, g) => n + (gems[g] ?? 0), 0);
  const hasPair = distinct.some((g) => (gems[g] ?? 0) === 2);

  const canAdd = useCallback(
    (g: Gem): boolean => {
      if (!state) return false;
      const cur = gems[g] ?? 0;
      if (state.bank[g] <= cur) return false; // never exceed the pile
      if (cur === 0) {
        if (hasPair) return false; // already committed to take-2
        return total < 3;
      }
      if (cur === 1) {
        // upgrade to take-2-same: only sole color and pile >= 4
        return distinct.length === 1 && total === 1 && state.bank[g] >= 4;
      }
      return false;
    },
    [state, gems, hasPair, total, distinct],
  );

  const add = useCallback(
    (g: Gem) => {
      if (!canAdd(g)) return;
      setGems((prev) => ({ ...prev, [g]: (prev[g] ?? 0) + 1 }));
    },
    [canAdd],
  );

  const remove = useCallback((g: Gem) => {
    setGems((prev) => {
      const cur = prev[g] ?? 0;
      if (cur <= 0) return prev;
      const next = { ...prev };
      if (cur - 1 === 0) delete next[g];
      else next[g] = cur - 1;
      return next;
    });
  }, []);

  const clear = useCallback(() => setGems({}), []);

  const action = useMemo<Action | null>(() => {
    if (total === 0) return null;
    if (hasPair) return { type: "TAKE_SAME", gem: distinct[0] };
    return { type: "TAKE_DIFFERENT", gems: distinct };
  }, [total, hasPair, distinct]);

  return { gems, total, distinct, canAdd, add, remove, clear, action };
}
