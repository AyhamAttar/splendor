import type { ButtonHTMLAttributes } from "react";

const VARIANT = {
  primary: "bg-gold-500 font-semibold text-navy-950 hover:bg-gold-400",
  ghost: "text-parchment-300/70 underline hover:text-parchment-100",
} as const;

const SIZE = {
  md: "px-4 py-1.5 text-sm",
  sm: "px-3 py-1.5 text-sm",
  xs: "px-3 py-1 text-xs",
  "2xs": "px-2 py-0.5 text-[10px]",
} as const;

/** Standard rectangular action button (gold primary / underlined ghost).
 *  One-offs stay inline by design: full-width CTAs (lobby, game over), the
 *  outline Pass, the dark Reserve, link-like lobby controls, steppers. */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
}) {
  return (
    <button
      {...rest}
      className={[
        "rounded transition duration-150 ease-out-expo",
        "active:translate-y-px disabled:opacity-40",
        SIZE[size],
        VARIANT[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
