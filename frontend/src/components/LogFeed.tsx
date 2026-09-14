"use client";

import type { GameEvent, GameState, RedactedGameState } from "@splendor/engine";
import { useMessages } from "@/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

function describe(
  ev: GameEvent,
  state: GameState | RedactedGameState,
  m: Messages,
): string {
  const name = (i: number) => state.players[i]?.name ?? `Player ${i + 1}`;
  const l = m.log;
  const sub = (tpl: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce(
      (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
      tpl,
    );

  switch (ev.t) {
    case "took_different":
      return sub(l.tookDifferent, {
        name: name(ev.player),
        gems: ev.gems.join(", "),
      });
    case "took_same":
      return sub(l.tookSame, { name: name(ev.player), gem: ev.gem });
    case "returned":
      return sub(l.returned, { name: name(ev.player) });
    case "reserved":
      return sub(ev.gainedGold ? l.reservedWithGold : l.reserved, {
        name: name(ev.player),
        level: ev.level,
      });
    case "purchased":
      return sub(ev.points ? l.purchasedPoints : l.purchased, {
        name: name(ev.player),
        points: ev.points ?? 0,
      });
    case "noble":
      return sub(l.noble, { name: name(ev.player) });
    case "passed":
      return sub(l.passed, { name: name(ev.player) });
    case "final_round":
      return l.finalRound;
    case "finished":
      return l.finished;
  }
}

export function LogFeed({ state }: { state: GameState | RedactedGameState }) {
  const m = useMessages();
  const recent = state.log.slice(-7).reverse();
  if (recent.length === 0) return null;
  return (
    <div className="gold-hairline rounded-lg bg-navy-900/40 p-3 shadow-raise-1">
      <h2 className="font-display mb-1.5 text-xs uppercase tracking-widest text-gold-300/70">
        {m.log.heading}
      </h2>
      <ul className="space-y-0.5 text-xs text-parchment-300/80">
        {recent.map((ev, i) => (
          <li key={i}>{describe(ev, state, m)}</li>
        ))}
      </ul>
    </div>
  );
}
