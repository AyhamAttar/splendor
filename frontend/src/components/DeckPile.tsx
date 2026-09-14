import type { Level } from "@splendor/engine";
import { CardBack } from "./DevCard";

/** A draw pile: the ornate card back plus a remaining-count badge. Clicking
 *  blind-reserves the top card (wired in M5). */
export function DeckPile({
  level,
  count,
  onClick,
  disabled,
}: {
  level: Level;
  count: number;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <CardBack
        level={level}
        label="Deck"
        onClick={count > 0 ? onClick : undefined}
        disabled={disabled || count === 0}
      />
      <span className="gold-hairline absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-navy-950 px-2 py-0.5 text-xs font-semibold text-gold-300 shadow-raise-1">
        {count}
      </span>
    </div>
  );
}
