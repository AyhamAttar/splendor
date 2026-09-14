"use client";

import type { DevCardDef, NobleDef, TokenColor } from "@splendor/engine";
import { GEM_ORDER } from "@/lib/gems";
import { cardImage } from "@/lib/cardImages";
import { nobleImage, nobleItemName } from "@/lib/nobles";
import { useMessages } from "@/i18n/I18nProvider";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { CostPips } from "./CostPips";
import { GemPip } from "./GemPip";
import { Art } from "./Art";

const PANEL_CLASS =
  "flex flex-col min-w-[min(92vw,340px)] max-w-[min(95vw,720px)] max-h-[90vh]";
// Image and stats sit side by side at 50/50, so the panel is wider than tall;
// height is content-driven (capped by max-h) rather than a fixed tall column.
const PANEL_STYLE: React.CSSProperties = { width: "58vw" };

const PARCHMENT = {
  background:
    "linear-gradient(155deg, var(--color-parchment-50), var(--color-parchment-300))",
} as const;

/**
 * A centered detail view for any tabled card. Shows an enlarged card (or noble
 * treasure) with its full stats; `actions` are contextual buttons (buy/reserve)
 * injected by the caller, which knows the current game state.
 */
export function CardDetailsModal({
  card,
  noble,
  actions,
  onClose,
}: {
  card?: DevCardDef;
  noble?: NobleDef;
  actions?: React.ReactNode;
  onClose: () => void;
}) {
  const m = useMessages();
  const d = m.cardDetails;
  const gemName = (g: TokenColor) => m.gems[g];

  const title = card ? m.cardMarket.level[card.level] : d.nobleTitle;

  return (
    <Modal
      title={title}
      onClose={onClose}
      panelClassName={PANEL_CLASS}
      panelStyle={PANEL_STYLE}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-row sm:items-stretch">
          <div className="flex min-h-0 items-center justify-center sm:w-1/2">
            {card && <DevVisual card={card} />}
            {noble && <NobleVisual noble={noble} />}
          </div>

          <dl className="min-h-0 space-y-0 overflow-y-auto pe-1 text-sm sm:w-1/2 sm:self-center">
            {card && (
              <>
                <Field label={d.prestige}>
                  <Prestige points={card.points} />
                </Field>
                <Field label={d.bonus}>
                  <GemPip color={card.bonus} />
                  <span className="text-parchment-100">
                    {gemName(card.bonus)}
                  </span>
                </Field>
                <Field label={d.cost}>
                  {GEM_ORDER.some((g) => (card.cost[g] ?? 0) > 0) ? (
                    <CostPips cost={card.cost} size="sm" />
                  ) : (
                    <span className="text-gold-300">{d.free}</span>
                  )}
                </Field>
              </>
            )}
            {noble && (
              <>
                {nobleItemName(noble.id) && (
                  <Field label={d.item}>
                    <span className="text-parchment-100">
                      {nobleItemName(noble.id)}
                    </span>
                  </Field>
                )}
                <Field label={d.prestige}>
                  <Prestige points={noble.points} />
                </Field>
                <Field label={d.requirement}>
                  <CostPips cost={noble.requirement} size="sm" />
                </Field>
              </>
            )}
          </dl>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
          <Button variant="ghost" size="sm" onClick={onClose}>
            {m.ownedCards.close}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// The original card artwork on its own — no points, bonus, cost pips, or
// scrim. `card-face` shows through as the parchment fallback if art is absent.
function DevVisual({ card }: { card: DevCardDef }) {
  const art = cardImage(card);
  return (
    <div className="card-face gold-frame relative aspect-2/3 h-[42vh] max-w-full shrink-0 overflow-hidden rounded-card shadow-raise-2">
      {art && <Art src={art} />}
    </div>
  );
}

// The original noble artwork on its own — no scrim or prestige badge.
function NobleVisual({ noble }: { noble: NobleDef }) {
  const img = nobleImage(noble.id);
  return (
    <div
      dir="ltr"
      className="gold-frame relative aspect-square h-[42vh] max-w-full shrink-0 overflow-hidden rounded-card shadow-raise-2"
      style={PARCHMENT}
    >
      {img && <Art src={img} />}
    </div>
  );
}

function Prestige({ points }: { points: number }) {
  return (
    <span className="prestige-seal text-engrave-gold grid h-7 min-w-7 place-items-center rounded-full px-1.5 font-display text-base font-bold text-gold-300">
      {points}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gold-700/20 py-2.5 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-parchment-300/60">
        {label}
      </dt>
      <dd className="flex flex-wrap items-center justify-end gap-1.5">
        {children}
      </dd>
    </div>
  );
}
