"use client";

import { useState } from "react";

/**
 * A round avatar: renders the user's image URL when set and loadable, otherwise
 * a monogram of their name/handle. External URLs are rendered with a plain
 * `<img>` (avatars can come from any host, so next/image's host allowlist
 * doesn't fit) with `no-referrer` and a graceful fallback on load error.
 */
export function Avatar({
  src,
  name,
  handle,
  size = 40,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  handle?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const label = (name || handle || "?").trim();
  const initial = label.charAt(0).toUpperCase() || "?";
  const dims = { width: size, height: size } as const;

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={dims}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={{ ...dims, fontSize: Math.round(size * 0.42) }}
      className={`grid shrink-0 place-items-center rounded-full bg-navy-700 font-display font-semibold text-gold-300 ${className}`}
      aria-hidden
    >
      <bdi>{initial}</bdi>
    </span>
  );
}
