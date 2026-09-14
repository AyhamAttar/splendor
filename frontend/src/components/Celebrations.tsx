"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { GameState, RedactedGameState } from "@splendor/engine";
import { getCard, getNoble } from "@splendor/engine";
import { useMessages, useT } from "@/i18n/I18nProvider";
import { DevCard } from "./DevCard";
import { NobleCelebration } from "./NobleCelebration";
import { TokenChip } from "./TokenChip";

type Celebration =
  | { key: number; type: "card"; cardId: number; player: string }
  | { key: number; type: "noble"; nobleId: number; player: string };

export function Celebrations({
  state,
}: {
  state: GameState | RedactedGameState;
}) {
  const prevRef = useRef<{ purchased: number; nobles: number }[] | null>(null);
  const idRef = useRef(0);
  const [queue, setQueue] = useState<Celebration[]>([]);
  const m = useMessages();
  const t = useT();

  useEffect(() => {
    const prev = prevRef.current;
    if (prev) {
      const found: Celebration[] = [];
      state.players.forEach((p, i) => {
        const pp = prev[i];
        if (!pp) return;
        for (const cardId of p.purchased.slice(pp.purchased)) {
          found.push({
            key: idRef.current++,
            type: "card",
            cardId,
            player: p.name,
          });
        }
        for (const nobleId of p.nobles.slice(pp.nobles)) {
          found.push({
            key: idRef.current++,
            type: "noble",
            nobleId,
            player: p.name,
          });
        }
      });
      if (found.length) setQueue((q) => [...q, ...found]);
    }
    prevRef.current = state.players.map((p) => ({
      purchased: p.purchased.length,
      nobles: p.nobles.length,
    }));
  }, [state]);

  useEffect(() => {
    if (!queue.length) return;
    // Nobles get the grand, longer flourish; cards keep the quick pop.
    const duration = queue[0].type === "noble" ? 4200 : 2000;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), duration);
    return () => clearTimeout(timer);
  }, [queue]);

  const current = queue[0];
  const noble = current?.type === "noble" ? current : null;
  const card =
    current?.type === "card" ? { ...current, def: getCard(current.cardId) } : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      {/* Cards keep their quick CSS pop. */}
      {card && (
        <div key={card.key} className="contents">
          {/* Soft blurred scrim so the busy board recedes and the text reads. */}
          <div
            className="celebrate-scrim pointer-events-none absolute inset-0 backdrop-blur-sm"
            style={{
              background:
                "radial-gradient(circle at center, rgba(3,7,18,0.35), transparent 70%)",
              maskImage:
                "radial-gradient(circle at center, black 30%, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(circle at center, black 30%, transparent 75%)",
            }}
          />
          <div className="celebrate-pop relative flex flex-col items-center gap-3">
          <span className="ornament-label text-gold-300 [text-shadow:0_1px_2px_rgba(3,7,18,0.95),0_2px_8px_rgba(3,7,18,0.8)]">
            {t("celebrations.buysCard", { player: card.player })}
          </span>
          <div className="relative">
            <div
              className="celebrate-burst pointer-events-none absolute inset-0 -m-8 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(217,180,91,0.55), transparent 62%)",
              }}
            />
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{ transform: `rotate(${(i * 360) / 8}deg)` }}
              >
                <span
                  className="celebrate-spark block h-1.5 w-1.5 rounded-full bg-gold-300"
                  style={{ animationDelay: `${(i % 2) * 70}ms` }}
                />
              </span>
            ))}
            <DevCard card={card.def} />
          </div>
          <div className="flex flex-col items-center gap-1.5 font-display text-lg font-bold text-gold-300 [text-shadow:0_1px_2px_rgba(3,7,18,0.95),0_2px_8px_rgba(3,7,18,0.85)]">
            {card.def.points > 0 && (
              <span>{t("celebrations.prestige", { points: card.def.points })}</span>
            )}
            <span className="flex items-center gap-1.5">
              <TokenChip color={card.def.bonus} size="sm" />
              {t("celebrations.bonus", { gem: m.gems[card.def.bonus] })}
            </span>
          </div>
          </div>
        </div>
      )}

      {/* A noble joining gets the full cinematic treatment. */}
      <AnimatePresence>
        {noble && (
          <NobleCelebration
            key={noble.key}
            noble={getNoble(noble.nobleId)}
            heading={t("celebrations.nobleJoins", { player: noble.player })}
            reward={m.celebrations.noblePoints}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
