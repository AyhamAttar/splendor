import type { Gem, TokenColor } from "@splendor/engine";

/** Canonical render order for gems (gold is handled separately). */
export const GEM_ORDER: Gem[] = ["white", "blue", "green", "red", "black"];
export const TOKEN_ORDER: TokenColor[] = [...GEM_ORDER, "gold"];

/** CSS color per token, referencing the theme tokens in globals.css. */
export const GEM_VAR: Record<TokenColor, string> = {
  white: "var(--color-gem-white)",
  blue: "var(--color-gem-blue)",
  green: "var(--color-gem-green)",
  red: "var(--color-gem-red)",
  black: "var(--color-gem-black)",
  gold: "var(--color-gem-gold)",
};

/** Light gems need dark text/pips for contrast; dark gems need light text. */
export const GEM_IS_LIGHT: Record<TokenColor, boolean> = {
  white: true,
  gold: true,
  blue: false,
  green: false,
  red: false,
  black: false,
};

export const GEM_LABEL: Record<TokenColor, string> = {
  white: "Diamond",
  blue: "Sapphire",
  green: "Emerald",
  red: "Ruby",
  black: "Onyx",
  gold: "Gold",
};

/** Single glow color per gem, driving the animated `token-glow` pulse
    (see globals.css). Kept as one rgba so the drop-shadow blur can interpolate
    smoothly while the color stays constant. */
export const GEM_GLOW_COLOR: Record<TokenColor, string> = {
  white: "rgba(244,241,234,0.65)",
  blue:  "rgba(31,95,191,0.65)",
  green: "rgba(28,138,78,0.65)",
  red:   "rgba(194,47,47,0.65)",
  black: "rgba(150,110,205,0.60)",
  gold:  "rgba(227,179,65,0.65)",
};

/** Gem icon image per token, from public/assets/Gems/. */
export const GEM_ICON: Record<TokenColor, string> = {
  white: "/assets/Gems/Diamond.png",
  blue: "/assets/Gems/Sapphire.png",
  green: "/assets/Gems/Emerald.png",
  red: "/assets/Gems/Ruby.png",
  black: "/assets/Gems/Onyx.png",
  gold: "/assets/Gems/Gold.png",
};
