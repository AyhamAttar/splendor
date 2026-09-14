"use client";

import { useState } from "react";
import type {
  PlayerState,
  RedactedPlayerState,
  RedactedReservedCard,
} from "@splendor/engine";
import { getBonuses, getCard, getPrestige } from "@splendor/engine";
import { GEM_ORDER, TOKEN_ORDER } from "@/lib/gems";
import { TokenChip } from "./TokenChip";
import { cardImage } from "@/lib/cardImages";
import { useMessages, useT } from "@/i18n/I18nProvider";
import { CostPips } from "./CostPips";
import { GemPip } from "./GemPip";
import { Button } from "./Button";
import { Art } from "./Art";
import { TIER_BACK_STYLE } from "./DevCard";
import { useInspect } from "./CardInspectContext";
import { OwnedCardsDialog } from "./dialogs/OwnedCardsDialog";

export function PlayerPanel({
  player,
  isCurrent,
  canAct,
  isViewer = false,
  affordable,
  onBuyReserved,
}: {
  // Full player (hotseat) or a redacted one (online): opponents' blind reserves
  // arrive with cardId=null and must render as a generic back.
  player: PlayerState | RedactedPlayerState;
  isCurrent: boolean;
  canAct: boolean;
  /** This panel belongs to the viewing identity (online) — may peek own reserves. */
  isViewer?: boolean;
  affordable: (cardId: number) => boolean;
  onBuyReserved: (cardId: number) => void;
}) {
  const [showCards, setShowCards] = useState(false);
  const m = useMessages();
  const t = useT();
  // Selectors read tokens + purchased cards only, never `reserved`.
  const bonuses = getBonuses(player as PlayerState);
  const prestige = getPrestige(player as PlayerState);
  const heldColors = TOKEN_ORDER.filter((c) => player.tokens[c] > 0);

  return (
    <div
      className={`rounded-lg p-3 shadow-raise-1 transition ${
        isCurrent
          ? "gold-frame turn-breath bg-navy-800/75"
          : "gold-hairline bg-navy-900/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-semibold text-parchment-50">
          {player.name}
          {isCurrent && (
            <span className="ms-2 rounded bg-gold-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gold-300">
              {m.playerPanel.turn}
            </span>
          )}
        </span>
        <span
          className="prestige-seal grid h-9 min-w-9 place-items-center rounded-full px-1 font-display text-lg font-bold text-gold-300"
          title={m.playerPanel.prestige}
        >
          {prestige}
        </span>
      </div>

      <Row label={m.playerPanel.bonus}>
        <div dir="ltr" className="flex gap-1">
          {GEM_ORDER.map((g) => (
            <GemPip key={g} color={g} shape="square" jewel dim={!bonuses[g]}>
              {bonuses[g] || ""}
            </GemPip>
          ))}
        </div>
      </Row>

      <Row label={m.playerPanel.tokens}>
        {heldColors.length ? (
          <div dir="ltr" className="flex flex-wrap gap-1">
            {heldColors.map((c) => (
              <TokenChip
                key={c}
                color={c}
                count={player.tokens[c]}
                size="xs"
                dim
              />
            ))}
          </div>
        ) : (
          <span className="text-xs text-parchment-300/40">
            {m.playerPanel.none}
          </span>
        )}
      </Row>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-parchment-300/70">
        <button
          type="button"
          onClick={() => setShowCards(true)}
          disabled={!player.purchased.length}
          title={m.playerPanel.viewOwned}
          className="rounded underline-offset-2 transition enabled:hover:text-gold-300 enabled:hover:underline disabled:cursor-default disabled:opacity-70"
        >
          {t("playerPanel.cards", { count: player.purchased.length })}
        </button>
        <span>
          {t("playerPanel.reserved", { count: player.reserved.length })}
        </span>
        <span>{t("playerPanel.nobles", { count: player.nobles.length })}</span>
      </div>

      {player.reserved.length > 0 && (
        <div className="mt-2 flex gap-2">
          {player.reserved.map((r, i) => (
            <ReservedMini
              key={r.cardId ?? `hidden-${i}`}
              reserved={r}
              canPeek={isCurrent || isViewer}
              canBuy={canAct}
              affordable={r.cardId != null && affordable(r.cardId)}
              onBuy={() => {
                if (r.cardId != null) onBuyReserved(r.cardId);
              }}
            />
          ))}
        </div>
      )}

      {showCards && (
        <OwnedCardsDialog player={player} onClose={() => setShowCards(false)} />
      )}
    </div>
  );
}

function ReservedMini({
  reserved,
  canPeek,
  canBuy,
  affordable,
  onBuy,
}: {
  reserved: RedactedReservedCard;
  canPeek: boolean;
  canBuy: boolean;
  affordable: boolean;
  onBuy: () => void;
}) {
  const [peek, setPeek] = useState(false);
  const m = useMessages();
  const inspect = useInspect();

  // An opponent's blind reserve (online) carries no card id — render a generic
  // locked back, never revealing level or art.
  if (reserved.cardId === null) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          dir="ltr"
          className="card-back-mini gold-hairline grid h-20 w-14 place-items-center overflow-hidden rounded-md text-lg text-gold-300/80"
        >
          🔒
        </div>
      </div>
    );
  }

  const cardId = reserved.cardId;
  const showFace = !reserved.hidden || (canPeek && peek);
  const card = getCard(cardId);
  const art = cardImage(card);
  const peekable = canPeek && reserved.hidden;
  // A face-up reserved card can be inspected; a hidden one stays secret (peek).
  const inspectable = !reserved.hidden;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        dir="ltr"
        className={`gold-hairline relative h-20 w-14 overflow-hidden rounded-md ${
          showFace ? "card-face" : "card-back-mini"
        } ${peekable || inspectable ? "cursor-pointer" : ""}`}
        style={showFace ? undefined : TIER_BACK_STYLE[card.level]}
        onClick={
          inspectable
            ? () => inspect({ kind: "dev", cardId: reserved.cardId })
            : undefined
        }
        onPointerDown={peekable ? () => setPeek(true) : undefined}
        onPointerUp={peekable ? () => setPeek(false) : undefined}
        onPointerLeave={peekable ? () => setPeek(false) : undefined}
      >
        {showFace ? (
          <>
            {art && (
              <>
                <Art src={art} />
                <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-parchment-50/75 via-parchment-50/10 to-parchment-50/85" />
              </>
            )}
            <div className="relative z-10 flex h-full flex-col p-1 text-navy-900">
              <div className="flex items-start justify-between">
                <span className="font-display text-sm font-bold leading-none">
                  {card.points > 0 ? card.points : ""}
                </span>
                <GemPip color={card.bonus} size="dot" />
              </div>
              <div className="mt-auto">
                <CostPips cost={card.cost} size="xs" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-lg text-gold-300/80">
            🔒
          </div>
        )}
      </div>
      {canBuy && (
        <Button size="2xs" onClick={onBuy} disabled={!affordable}>
          {m.ownedCards.buy}
        </Button>
      )}
      {peekable && (
        <span className="text-[9px] text-parchment-300/50">
          {m.playerPanel.holdToPeek}
        </span>
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex min-h-[1.75rem] items-center gap-2">
      <span className="w-12 text-[10px] uppercase tracking-wide text-parchment-300/60">
        {label}
      </span>
      {children}
    </div>
  );
}
