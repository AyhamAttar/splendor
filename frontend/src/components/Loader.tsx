"use client";

/**
 * Branded loading indicator: the Splendor treasure medallion breathing with a
 * gold glow, encircled by a spinning arc. The artwork stays upright (only the
 * ring rotates) so the scene reads clearly. Motion is disabled automatically
 * under `prefers-reduced-motion` via the global reduced-motion rule.
 */
export function Loader({
  label,
  size = 120,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="brand-loader relative"
        style={{ width: size, height: size }}
        role="status"
        aria-label={label ?? "Loading"}
      >
        <span className="brand-loader-ring pointer-events-none absolute -inset-[8%]" aria-hidden />
        {/* Decorative brand art; next/image's optimizer adds no value here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/brand/loader.webp"
          alt=""
          draggable={false}
          className="brand-loader-medallion relative block h-full w-full object-contain"
        />
      </div>
      {label && (
        <p className="animate-pulse text-parchment-300">{label}</p>
      )}
    </div>
  );
}
