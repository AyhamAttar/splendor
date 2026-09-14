import type { NobleDef } from "@splendor/engine";
import { nobleImage } from "@/lib/nobles";
import { CostPips } from "./CostPips";
import { Art } from "./Art";

const PARCHMENT = {
  background:
    "linear-gradient(155deg, var(--color-parchment-50), var(--color-parchment-300))",
} as const;

export function NobleTile({
  noble,
  onClick,
  selectable,
}: {
  noble: NobleDef;
  onClick?: () => void;
  selectable?: boolean;
}) {
  const img = nobleImage(noble.id);
  const cls = [
    "gold-frame relative h-24 w-24 shrink-0 overflow-hidden rounded-card shadow-raise-1 transition duration-200 ease-out-expo",
    selectable
      ? "cursor-pointer ring-2 ring-gold-300 hover:-translate-y-1 hover:shadow-raise-2"
      : onClick
        ? "cursor-pointer hover:-translate-y-1 hover:shadow-raise-2"
        : "",
  ]
    .filter(Boolean)
    .join(" ");
  const body = (
    <>
      {img && <Art src={img} />}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-parchment-50/25 via-transparent to-parchment-50/45" />
      {/* Point badge: physical right-1.5 top-1.5 — canonical Splendor top-right corner, kept LTR */}
      <span className="font-display text-emboss-parchment absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-parchment-50/90 text-sm font-bold leading-none text-navy-900 shadow-raise-1 ring-1 ring-gold-300/70">
        {noble.points}
      </span>
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end p-2">
        <CostPips cost={noble.requirement} size="xs" />
      </div>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      dir="ltr"
      className={cls}
      style={PARCHMENT}
      title="Noble"
    >
      {body}
    </button>
  ) : (
    <div dir="ltr" className={cls} style={PARCHMENT} title="Noble">
      {body}
    </div>
  );
}
