import type { TokenColor } from "@splendor/engine";
import { GEM_IS_LIGHT, GEM_VAR } from "@/lib/gems";

const SIZE = {
  dot: "h-3 w-3", // bare bonus dot (reserved minis)
  xs: "h-4 w-4 text-[9px]", // compact cost pips (card faces, nobles)
  sm: "h-5 w-5 text-[10px]", // standard pips (panels, dialogs, DevCard bonus dot)
} as const;

/** Plain fill: a flat disc with a thin dark seat. The default cost/count pip. */
function flatStyle(color: TokenColor): React.CSSProperties {
  return {
    background: GEM_VAR[color],
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.4)",
  };
}

/** Cut-gem fill: a top-left glint and bottom-right shadow over the gem color,
 *  seated with an inset rim and a soft drop — the stone reads as faceted and
 *  raised rather than a flat chip. Still a CSS-drawn colored shape (no image).
 *  Used for the prominent bonus counters on a player panel. */
function jewelStyle(color: TokenColor): React.CSSProperties {
  return {
    background: `radial-gradient(115% 115% at 30% 22%, rgba(255,255,255,0.6), rgba(255,255,255,0) 46%), radial-gradient(120% 120% at 72% 88%, rgba(0,0,0,0.34), rgba(0,0,0,0) 52%), ${GEM_VAR[color]}`,
    boxShadow:
      "inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.45), 0 1px 2px rgba(3,7,18,0.5)",
    textShadow: GEM_IS_LIGHT[color]
      ? "0 1px 0 rgba(255,255,255,0.4)"
      : "0 1px 1px rgba(0,0,0,0.5)",
  };
}

/** A small colored gem disc (or square): cost pips, bonus counters, token
 *  counts. Pass a numeric child to show a count, or none for a bare dot.
 *  `jewel` gives the richer faceted treatment for prominent counters. */
export function GemPip({
  color,
  size = "sm",
  shape = "round",
  dim = false,
  jewel = false,
  title,
  children,
}: {
  color: TokenColor;
  size?: keyof typeof SIZE;
  shape?: "round" | "square";
  dim?: boolean;
  jewel?: boolean;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={[
        "inline-flex items-center justify-center font-bold",
        SIZE[size],
        shape === "square" ? "rounded" : "rounded-full",
        GEM_IS_LIGHT[color] ? "text-navy-950" : "text-white",
        dim ? "opacity-20" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={jewel ? jewelStyle(color) : flatStyle(color)}
    >
      {children}
    </span>
  );
}
