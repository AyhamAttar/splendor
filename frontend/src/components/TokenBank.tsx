"use client";

import type { GameState, Gem, RedactedGameState } from "@splendor/engine";
import type { GemCounts } from "@/hooks/useSelection";
import { TOKEN_ORDER } from "@/lib/gems";
import { useMessages } from "@/i18n/I18nProvider";
import { TokenChip } from "./TokenChip";

export function TokenBank({
  state,
  selection,
  canAdd,
  onAdd,
  disabled,
}: {
  state: GameState | RedactedGameState;
  selection: GemCounts;
  canAdd: (g: Gem) => boolean;
  onAdd: (g: Gem) => void;
  disabled: boolean;
}) {
  const m = useMessages();
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-display text-sm uppercase tracking-widest text-gold-300/80">
        {m.bank}
      </h2>
      {/* Token chips are game pieces */}
      <div className="flex flex-wrap gap-4">
        {TOKEN_ORDER.map((c) => {
          const isGold = c === "gold";
          const sel = isGold ? 0 : (selection[c as Gem] ?? 0);
          const addable = !isGold && !disabled && canAdd(c as Gem);
          const showDisabled = !isGold && sel === 0 && !addable;
          return (
            <div key={c} className="flex flex-col items-center gap-1">
              <div className="relative">
                <TokenChip
                  color={c}
                  count={state.bank[c]}
                  size="lg"
                  onClick={isGold ? undefined : () => onAdd(c as Gem)}
                  disabled={showDisabled}
                  selected={sel > 0}
                  title={
                    isGold
                      ? `${m.gems.gold} — ${m.actionBar.prompt}`
                      : m.gems[c]
                  }
                />
                {sel > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-navy-950 shadow">
                    +{sel}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-parchment-300/70">
                {m.gems[c]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
