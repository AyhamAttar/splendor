import type { DevCardDef, Level } from "@splendor/engine";
import { cardImage } from "@/lib/cardImages";
import { CostPips } from "./CostPips";
import { GemPip } from "./GemPip";
import { Art } from "./Art";

const CARD_SIZE = "h-36 w-24";

export const TIER_BACK_STYLE: Record<Level, React.CSSProperties> = {
  1: { "--tier-a": "#1c6b43", "--tier-b": "#08281a" } as React.CSSProperties,
  2: { "--tier-a": "#957327", "--tier-b": "#2c2109" } as React.CSSProperties,
  3: {},
};

export function CardBack({
  level,
  onClick,
  disabled,
  label,
}: {
  level: Level;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const cls = [
    "gold-frame",
    CARD_SIZE,
    "card-back flex flex-col items-center justify-center rounded-card shadow-raise-1 transition duration-200 ease-out-expo",
    onClick && !disabled
      ? "cursor-pointer hover:-translate-y-1 hover:shadow-raise-2"
      : "",
    disabled ? "opacity-50" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const body = (
    <>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: level }, (_, i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full bg-gold-300 shadow-[inset_0_0_0_1px_rgba(138,109,42,0.55)]"
          />
        ))}
      </div>
      {label && (
        <span className="mt-1.5 text-[10px] uppercase tracking-wider text-gold-300/80">
          {label}
        </span>
      )}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      dir="ltr"
      className={cls}
      style={TIER_BACK_STYLE[level]}
    >
      {body}
    </button>
  ) : (
    <div dir="ltr" className={cls} style={TIER_BACK_STYLE[level]}>
      {body}
    </div>
  );
}

export function DevCard({
  card,
  onClick,
  affordable,
  focused,
  disabled,
}: {
  card?: DevCardDef | null;
  onClick?: () => void;
  affordable?: boolean;
  focused?: boolean;
  disabled?: boolean;
}) {
  if (!card) {
    return <div className={`${CARD_SIZE} card-empty`} aria-hidden />;
  }

  const clickable = Boolean(onClick) && !disabled;
  const cls = [
    "gold-frame",
    CARD_SIZE,
    "card-face relative flex flex-col overflow-hidden rounded-card p-2 text-navy-900 text-left shadow-raise-1 transition duration-200 ease-out-expo",
    affordable ? "ring-2 ring-gold-400" : "",
    focused ? "outline outline-2 outline-gold-300" : "",
    clickable
      ? "cursor-pointer hover:-translate-y-1 hover:shadow-raise-2 active:translate-y-0 active:shadow-raise-1"
      : "",
    disabled ? "opacity-60" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const art = cardImage(card);
  const body = (
    <>
      {art && (
        <>
          <Art src={art} />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-parchment-50/80 via-parchment-50/10 to-parchment-50/85" />
        </>
      )}
      <div className="relative z-10 flex items-start justify-between">
        <span className="font-display text-emboss-parchment text-xl font-bold leading-none">
          {card.points > 0 ? card.points : ""}
        </span>
        <GemPip color={card.bonus} />
      </div>
      <div className="relative z-10 mt-auto">
        <CostPips cost={card.cost} size="xs" />
      </div>
    </>
  );

  return clickable ? (
    <button type="button" onClick={onClick} dir="ltr" className={cls}>
      {body}
    </button>
  ) : (
    <div dir="ltr" className={cls}>
      {body}
    </div>
  );
}
