"use client";

import type { PlayerState, RedactedPlayerState } from "@splendor/engine";
import { getCard } from "@splendor/engine";
import { GEM_ORDER } from "@/lib/gems";
import { useMessages, useT } from "@/i18n/I18nProvider";
import { Modal } from "../Modal";
import { Button } from "../Button";
import { DevCard } from "../DevCard";
import { useInspect } from "../CardInspectContext";

export function OwnedCardsDialog({
  player,
  onClose,
}: {
  // Purchased cards are public; accept a redacted player (online) too.
  player: PlayerState | RedactedPlayerState;
  onClose: () => void;
}) {
  const m = useMessages();
  const t = useT();
  const inspect = useInspect();
  const o = m.ownedCards;
  const cards = player.purchased.map(getCard);
  const sorted = [...cards].sort(
    (a, b) =>
      GEM_ORDER.indexOf(a.bonus) - GEM_ORDER.indexOf(b.bonus) ||
      a.points - b.points ||
      a.id - b.id,
  );
  const points = cards.reduce((n, c) => n + c.points, 0);

  const title = t("ownedCards.titleSingular", { name: player.name });
  const subtitle =
    cards.length === 1
      ? o.subtitleSingular
      : t("ownedCards.subtitlePlural", { count: cards.length });
  const prestigeSuffix = points > 0 ? t("ownedCards.prestige", { points }) : "";

  return (
    <Modal
      title={title}
      onClose={onClose}
      panelClassName="flex flex-col"
      panelStyle={{ width: "70vw", height: "70vh" }}
    >
      <p className="mb-3 shrink-0 text-center text-sm text-parchment-300/70">
        {subtitle}
        {prestigeSuffix}
      </p>
      {sorted.length === 0 ? (
        <p className="grid flex-1 place-items-center text-sm text-parchment-300/60">
          {o.noPurchased}
        </p>
      ) : (
        <div
          dir="ltr"
          className="flex min-h-0 flex-1 flex-wrap content-start justify-center gap-3 overflow-y-auto py-1"
        >
          {sorted.map((card) => (
            <DevCard
              key={card.id}
              card={card}
              onClick={() => inspect({ kind: "dev", cardId: card.id })}
            />
          ))}
        </div>
      )}
      <div className="mt-4 flex shrink-0 justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {o.close}
        </Button>
      </div>
    </Modal>
  );
}
