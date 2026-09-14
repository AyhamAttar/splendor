"use client";

import { useState } from "react";
import type { GameState, Level, RedactedGameState } from "@splendor/engine";
import { getCard } from "@splendor/engine";
import { useMessages } from "@/i18n/I18nProvider";
import { DevCard } from "./DevCard";
import { DeckPile } from "./DeckPile";
import { Button } from "./Button";
import { useInspect } from "./CardInspectContext";

export function CardMarket({
  state,
  affordable,
  canReserve,
  disabled,
  onBuy,
  onReserveCard,
  onReserveDeck,
}: {
  // Full state (hotseat) or a per-viewer redacted state (online). Online hides
  // deck order, so read remaining counts from `deckCounts` when present.
  state: GameState | RedactedGameState;
  affordable: (cardId: number) => boolean;
  canReserve: boolean;
  disabled: boolean;
  onBuy: (cardId: number) => void;
  onReserveCard: (cardId: number) => void;
  onReserveDeck: (level: Level) => void;
}) {
  const m = useMessages();
  const inspect = useInspect();
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);
  const rows: Level[] = [1, 2, 3];
  return (
    <div className="flex flex-col gap-6">
      {rows.map((lvl) => (
        <div key={lvl} className="flex items-start gap-3">
          <div className="w-24">
            <DeckPile
              level={lvl}
              count={"decks" in state ? state.decks[lvl].length : state.deckCounts[lvl]}
              onClick={
                disabled || !canReserve ? undefined : () => onReserveDeck(lvl)
              }
            />
            <p className="mt-3 text-center text-[10px] uppercase tracking-wider text-gold-300/70">
              {m.cardMarket.level[lvl]}
            </p>
          </div>

          {state.board[lvl].map((cid, i) => {
            if (cid == null) return <DevCard key={i} card={null} />;
            const buyable = affordable(cid);
            const showActions = hoveredCardId === cid && !disabled;
            return (
              <div
                key={i}
                className="relative"
                onMouseEnter={() => setHoveredCardId(cid)}
                onMouseLeave={() =>
                  setHoveredCardId((prev) => (prev === cid ? null : prev))
                }
              >
                <DevCard
                  card={getCard(cid)}
                  affordable={buyable}
                  onClick={
                    disabled
                      ? undefined
                      : () => inspect({ kind: "dev", cardId: cid })
                  }
                />
                {showActions && (
                  <div className="absolute left-1/2 top-full z-20 -translate-x-1/2 pt-1">
                    <div className="gold-hairline flex gap-1 rounded-lg bg-navy-950/95 p-1 shadow-raise-2">
                      <Button
                        size="xs"
                        onClick={() => onBuy(cid)}
                        disabled={!buyable}
                      >
                        {m.actions.buy}
                      </Button>
                      <button
                        onClick={() => onReserveCard(cid)}
                        disabled={!canReserve}
                        className="rounded px-3 py-1 text-xs text-parchment-100 hover:bg-navy-800 disabled:opacity-40"
                        title={
                          canReserve
                            ? m.cardMarket.reserve
                            : m.cardMarket.reserveFull
                        }
                      >
                        {m.actions.reserve}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
