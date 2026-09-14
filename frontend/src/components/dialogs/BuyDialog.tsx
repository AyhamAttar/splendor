"use client";

import type { DevCardDef, PlayerState } from "@splendor/engine";
import { computeAutoPayment, getBonuses, getEffectiveCost } from "@splendor/engine";
import { useMessages } from "@/i18n/I18nProvider";
import { Modal } from "../Modal";
import { Button } from "../Button";
import { CostPips } from "../CostPips";
import { DevCard } from "../DevCard";
import { TokenChip } from "../TokenChip";
import { TOKEN_ORDER } from "@/lib/gems";

export function BuyDialog({
  card,
  player,
  onConfirm,
  onClose,
  busy,
}: {
  card: DevCardDef;
  player: PlayerState;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const m = useMessages();
  const b = m.dialogs.buy;
  const bonuses = getBonuses(player);
  const eff = getEffectiveCost(card, bonuses);
  const pay = computeAutoPayment(player, card);
  const affordable = pay.ok;
  const payment = pay.ok ? pay.payment : {};
  const free = Object.keys(eff).length === 0;
  const payColors = TOKEN_ORDER.filter((c) => (payment[c] ?? 0) > 0);

  return (
    <Modal title={b.title} onClose={onClose}>
      <div className="flex gap-4">
        <DevCard card={card} />
        <div className="flex-1 text-sm">
          <p className="text-parchment-300/70">{b.costAfterBonus}</p>
          <div className="mt-1">
            {free ? (
              <span className="text-gold-300">{b.free}</span>
            ) : (
              <CostPips cost={eff} />
            )}
          </div>

          <p className="mt-4 text-parchment-300/70">{b.youPay}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {payColors.length === 0 ? (
              <span className="text-parchment-300/50">{b.noTokensNeeded}</span>
            ) : (
              payColors.map((c) => (
                <TokenChip key={c} color={c} count={payment[c]} size="sm" />
              ))
            )}
          </div>

          {!affordable && (
            <p className="mt-3 text-gem-red">{b.cantAfford}</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {b.cancel}
        </Button>
        <Button onClick={onConfirm} disabled={!affordable || busy}>
          {b.confirm}
        </Button>
      </div>
    </Modal>
  );
}
