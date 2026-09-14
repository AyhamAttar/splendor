import type { CSSProperties } from "react";
import type { TokenColor } from "@splendor/engine";
import { GEM_ICON, GEM_GLOW_COLOR, GEM_LABEL } from "@/lib/gems";

const SIZES = {
  xs: { img: "h-5 w-5", count: "text-[9px]" },
  sm: { img: "h-7 w-7", count: "text-[10px]" },
  md: { img: "h-11 w-11", count: "text-xs" },
  lg: { img: "h-14 w-14", count: "text-sm" },
} as const;

export function TokenChip({
  color,
  count,
  size = "md",
  dim,
  onClick,
  disabled,
  selected,
  title,
}: {
  color: TokenColor;
  count?: number;
  size?: keyof typeof SIZES;
  dim?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  title?: string;
}) {
  const interactive = Boolean(onClick);
  const { img: imgCls, count: countCls } = SIZES[size];

  const classes = [
    "inline-flex select-none flex-col items-center gap-1",
    "transition-transform duration-150 ease-out-expo",
    selected ? "scale-110" : "",
    interactive && !disabled ? "cursor-pointer hover:scale-105" : "",
    interactive && disabled ? "cursor-not-allowed opacity-35" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={GEM_ICON[color]}
        alt={GEM_LABEL[color]}
        draggable={false}
        style={{ "--glow-color": GEM_GLOW_COLOR[color] } as CSSProperties}
        className={`${imgCls} object-contain ${dim ? "token-glow-dim" : "token-glow"}`}
      />
      {count !== undefined && (
        <span className={`${countCls} font-semibold text-parchment-100 leading-none`}>
          {count}
        </span>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title ?? GEM_LABEL[color]}
        className={classes}
      >
        {content}
      </button>
    );
  }
  return (
    <div title={title ?? GEM_LABEL[color]} className={classes}>
      {content}
    </div>
  );
}
