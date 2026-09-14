"use client";

import { useState } from "react";

/**
 * A decorative image that fills its positioned, overflow-hidden parent and
 * removes itself if the source fails to load, letting the parent's CSS
 * background (the pure-CSS card/noble face) show through as a fallback.
 */
// Literal class names so Tailwind's JIT scanner can see both variants.
const FIT = {
  cover: "object-cover",
  contain: "object-contain",
} as const;

export function Art({
  src,
  className = "",
  fit = "cover",
}: {
  src: string;
  className?: string;
  /** `cover` fills and crops (default, for tiled pieces); `contain` shows the
   *  whole image without cropping (enlarged detail views). */
  fit?: keyof typeof FIT;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // Local, decorative game art (many small tiles); next/image's optimizer
    // adds no value here and doesn't handle the inline SVG cards well.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className={`pointer-events-none absolute inset-0 h-full w-full ${FIT[fit]} ${className}`}
    />
  );
}
