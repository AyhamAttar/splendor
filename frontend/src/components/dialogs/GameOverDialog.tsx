"use client";

import type {
  GameState,
  PlayerState,
  RedactedGameState,
} from "@splendor/engine";
import { getPrestige } from "@splendor/engine";
import { useMessages } from "@/i18n/I18nProvider";
import { Modal } from "../Modal";

export function GameOverDialog({
  state,
  onNewGame,
}: {
  state: GameState | RedactedGameState;
  onNewGame: () => void;
}) {
  const m = useMessages();
  const d = m.dialogs.gameOver;
  const winners = new Set(state.winners ?? []);
  const standings = state.players
    .map((p, i) => ({
      i,
      name: p.name,
      // getPrestige reads purchased cards + nobles only (never `reserved`).
      prestige: getPrestige(p as PlayerState),
      cards: p.purchased.length,
      nobles: p.nobles.length,
    }))
    .sort((a, b) => b.prestige - a.prestige || a.cards - b.cards);

  const winnerNames = standings
    .filter((s) => winners.has(s.i))
    .map((s) => s.name)
    .join(" & ");

  return (
    <Modal title={d.title} dismissable={false}>
      <p className="font-display text-engrave-gold flex items-center gap-2 text-lg text-gold-300">
        <Crown className="h-5 w-5 shrink-0" />
        <span>
          {winners.size > 1 ? d.winners : d.winner}: <bdi>{winnerNames}</bdi>
        </span>
      </p>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-start text-parchment-300/60">
            <th className="py-1 text-start">{d.tablePlayer}</th>
            <th className="py-1 text-end">{d.tablePrestige}</th>
            <th className="py-1 text-end">{d.tableCards}</th>
            <th className="py-1 text-end">{d.tableNobles}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr
              key={s.i}
              className={
                winners.has(s.i) ? "text-gold-300" : "text-parchment-100/80"
              }
            >
              <td className="py-1">
                <span className="inline-flex items-center gap-1.5">
                  <bdi>{s.name}</bdi>
                  {winners.has(s.i) && (
                    <Crown className="h-3.5 w-3.5 shrink-0" aria-label={d.winner} />
                  )}
                </span>
              </td>
              <td className="py-1 text-end font-semibold">{s.prestige}</td>
              <td className="py-1 text-end">{s.cards}</td>
              <td className="py-1 text-end">{s.nobles}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-parchment-300/50">{d.footer}</p>

      <button
        onClick={onNewGame}
        className="relative mt-5 w-full overflow-hidden rounded-lg bg-gold-500 py-2.5 font-display text-lg font-semibold text-navy-950 shadow-raise-2 transition duration-150 ease-out-expo hover:bg-gold-400 active:translate-y-px"
      >
        {/* Struck-coin sheen: a bright top lip on the minted gold face. */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/25 to-transparent" />
        <span className="relative">{d.newGame}</span>
      </button>
    </Modal>
  );
}

/** A hand-drawn gilt crown — the winner mark, replacing an emoji glyph so the
 *  chrome stays within the drawn-SVG icon language. */
function Crown({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <path d="M2 7l4 5 6-7 6 7 4-5-2 12H4L2 7z" />
    </svg>
  );
}
