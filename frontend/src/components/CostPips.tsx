import type { GemBag } from "@splendor/engine";
import { GEM_ORDER } from "@/lib/gems";
import { GemPip } from "./GemPip";

/** Renders a card cost or noble requirement as small colored numbered pips. */
export function CostPips({
  cost,
  size = "sm",
  className = "",
}: {
  cost: GemBag;
  size?: "xs" | "sm";
  className?: string;
}) {
  const entries = GEM_ORDER.filter((g) => (cost[g] ?? 0) > 0);
  if (entries.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {entries.map((g) => (
        <GemPip key={g} color={g} size={size}>
          {cost[g]}
        </GemPip>
      ))}
    </div>
  );
}
