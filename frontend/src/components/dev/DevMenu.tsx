"use client";

import { useState } from "react";
import {
  canAfford,
  getCard,
  getPrestige,
  tokenTotal,
  GEMS,
  LEVELS,
  type GameState,
  type PlayerState,
  type TokenBag,
  type TurnCommand,
} from "@splendor/engine";
import { useDraggable } from "@/hooks/useDraggable";

const NEAR_WIN_SCORE = 14; // one point shy of the 15 that ends the game.

/**
 * Cheat controls the sandbox exposes to the DevMenu. Every method targets the
 * CURRENT player and mutates the local game in place (no rules enforced) — the
 * fast path to a scenario. Turns that must go through the rules engine (buying,
 * ending a turn) are driven separately via GameView's `advance`.
 */
export interface DevApi {
  /** Seed of the running game (display only). */
  seed: number;
  /** Number of seats in the running game. */
  playerCount: number;
  /** Name of the player the cheats act on. */
  currentName: string;
  /** Start a brand-new seeded game (optionally changing the seat count). */
  reset(playerCount?: number): void;
  /** Add tokens to the current player, drawn from the bank. */
  giveTokens(bag: TokenBag): void;
  /** Set the current player to exactly `total` tokens spread across gems. */
  fillTokens(total: number): void;
  /** Return all of the current player's tokens to the bank. */
  clearTokens(): void;
  /** Instantly own a development card (bonus + points). */
  grantCard(opts?: { pointsOnly?: boolean }): number | null;
  /** Grant bonus cards so the current player qualifies for `count` nobles. */
  qualifyForNobles(count: number): number[];
  /** Award a revealed noble to the current player outright. */
  grantNoble(): number | null;
  /** Grant point cards until the current player has `points` prestige. */
  setPrestige(points: number): void;
  /** Flip the final-round flag. */
  forceFinalRound(): void;
  /** End the game now (winner via the engine tie-break). */
  forceFinish(): void;
  /** Hand the turn to the next seat with no action. */
  nextPlayer(): void;
}

/** A guaranteed-legal, minimal turn used to "end the turn" and fire the
 *  post-action gates (noble visit/choice, over-10 return, final round). */
function trivialTurn(state: GameState): TurnCommand {
  const gem = GEMS.find((g) => state.bank[g] > 0);
  if (gem) return { action: { type: "TAKE_DIFFERENT", gems: [gem] } };
  const cur = state.players[state.currentPlayer];
  if (cur.reserved.length < 3) {
    const lvl = LEVELS.find((l) => state.decks[l].length > 0);
    if (lvl) return { action: { type: "RESERVE_DECK", level: lvl } };
  }
  return { action: { type: "PASS" } };
}

function firstAffordable(state: GameState): number | null {
  const p = state.players[state.currentPlayer] as PlayerState;
  for (const lvl of LEVELS) {
    for (const id of state.board[lvl]) {
      if (id != null && canAfford(p, getCard(id))) return id;
    }
  }
  for (const r of p.reserved) {
    if (canAfford(p, getCard(r.cardId))) return r.cardId;
  }
  return null;
}

export function DevMenu({
  dev,
  state,
  advance,
  canAct,
}: {
  dev: DevApi;
  state: GameState;
  advance: (command: TurnCommand) => void;
  canAct: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState<string>("Seed a scenario, then act on the board.");
  const { nodeRef, handleProps, style, reset, moved } = useDraggable(
    "splendor:devmenu-pos",
  );

  const player = state.players[state.currentPlayer] as PlayerState;
  const prestige = getPrestige(player);
  const tokens = tokenTotal(player.tokens);
  const affordableId = firstAffordable(state);
  const finished = state.status === "finished";

  const say = (msg: string) => setNote(msg);

  return (
    <div
      ref={nodeRef}
      style={style}
      className="fixed bottom-3 left-3 z-[60] w-64 select-none font-sans text-parchment-100"
    >
      <div className="overflow-hidden rounded-lg border border-emerald-400/50 bg-navy-900/95 shadow-raise-3 ring-1 ring-emerald-400/20 backdrop-blur-sm">
        {/* Header / drag handle */}
        <div
          {...handleProps}
          className="flex items-center justify-between gap-2 border-b border-emerald-400/30 bg-emerald-400/10 px-3 py-2"
        >
          <span className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-widest text-emerald-300">
            <span aria-hidden>🧪</span> Dev Sandbox
          </span>
          <div className="flex items-center gap-1">
            {moved && (
              <button
                onClick={reset}
                title="Reset menu position"
                className="rounded px-1 text-parchment-300/60 hover:text-parchment-100"
              >
                ⤢
              </button>
            )}
            <button
              onClick={() => setOpen((v) => !v)}
              title={open ? "Collapse" : "Expand"}
              className="rounded px-1 text-parchment-300/70 hover:text-parchment-100"
            >
              {open ? "▾" : "▸"}
            </button>
          </div>
        </div>

        {open && (
          <div className="max-h-[70vh] overflow-y-auto p-3">
            {/* Live readout */}
            <div className="mb-3 grid grid-cols-3 gap-1 rounded bg-navy-950/60 p-2 text-center text-[11px]">
              <Stat label="Turn" value={player.name} />
              <Stat label="Prestige" value={String(prestige)} />
              <Stat label="Tokens" value={`${tokens}/10`} />
            </div>

            <Section title="Turn">
              <Btn
                onClick={() => {
                  advance(trivialTurn(state));
                  say("Ended turn — nobles / return / final-round gates fired.");
                }}
                disabled={!canAct}
              >
                ▶ End turn (take 1 gem)
              </Btn>
              <Btn
                onClick={() => {
                  dev.nextPlayer();
                  say(`Skipped to ${state.players[(state.currentPlayer + 1) % state.players.length].name}.`);
                }}
              >
                ⏭ Skip to next player
              </Btn>
            </Section>

            <Section title="Cards">
              <Btn
                onClick={() => {
                  if (affordableId == null) return;
                  advance({ action: { type: "PURCHASE", cardId: affordableId } });
                  say(`Bought card #${affordableId} via the engine.`);
                }}
                disabled={!canAct || affordableId == null}
                title={affordableId == null ? "Nothing affordable — give tokens first" : undefined}
              >
                🛒 Buy an affordable card
              </Btn>
              <Btn
                onClick={() => {
                  const id = dev.grantCard();
                  say(id == null ? "No card left to grant." : `Granted card #${id} (free).`);
                }}
              >
                🎁 Grant a card (free)
              </Btn>
              <Btn
                onClick={() => {
                  const id = dev.grantCard({ pointsOnly: true });
                  say(id == null ? "No point card left." : `Granted point card #${id}.`);
                }}
              >
                ⭐ Grant a point card
              </Btn>
            </Section>

            <Section title="Nobles">
              <Btn
                onClick={() => {
                  const ids = dev.qualifyForNobles(1);
                  say(
                    ids.length
                      ? `Qualified for noble #${ids[0]} — End turn to receive it.`
                      : "No revealed nobles.",
                  );
                }}
              >
                👑 Qualify for a noble
              </Btn>
              <Btn
                onClick={() => {
                  const ids = dev.qualifyForNobles(2);
                  say(
                    ids.length > 1
                      ? `Qualified for ${ids.length} nobles — End turn for the choice dialog.`
                      : "Fewer than 2 nobles revealed.",
                  );
                }}
              >
                👑👑 Qualify for 2 (choice)
              </Btn>
              <Btn
                onClick={() => {
                  const id = dev.grantNoble();
                  say(id == null ? "No revealed nobles." : `Awarded noble #${id} instantly.`);
                }}
              >
                🏷️ Grant a noble now
              </Btn>
            </Section>

            <Section title="Tokens">
              <div className="grid grid-cols-2 gap-1.5">
                <Btn
                  onClick={() => {
                    dev.giveTokens({ white: 1, blue: 1, green: 1, red: 1, black: 1 });
                    say("+1 of each gem.");
                  }}
                >
                  ＋1 each
                </Btn>
                <Btn
                  onClick={() => {
                    dev.giveTokens({ gold: 3 });
                    say("+3 gold.");
                  }}
                >
                  ＋3 gold
                </Btn>
                <Btn
                  onClick={() => {
                    dev.fillTokens(10);
                    say("Filled to 10 — End turn (take 1) to force a return.");
                  }}
                >
                  Fill to 10
                </Btn>
                <Btn
                  onClick={() => {
                    dev.clearTokens();
                    say("Returned all tokens to the bank.");
                  }}
                >
                  Clear
                </Btn>
              </div>
            </Section>

            <Section title="Endgame">
              <Btn
                onClick={() => {
                  dev.setPrestige(NEAR_WIN_SCORE);
                  say(`Set to ${NEAR_WIN_SCORE} prestige — one buy from winning.`);
                }}
              >
                🏁 Near win ({NEAR_WIN_SCORE} pts)
              </Btn>
              <div className="grid grid-cols-2 gap-1.5">
                <Btn
                  onClick={() => {
                    dev.forceFinalRound();
                    say("Final round triggered.");
                  }}
                >
                  🚩 Final round
                </Btn>
                <Btn
                  onClick={() => {
                    dev.forceFinish();
                    say("Game finished — see the Game Over dialog.");
                  }}
                  disabled={finished}
                >
                  🏆 Finish now
                </Btn>
              </div>
            </Section>

            <Section title="Session">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="text-[11px] text-parchment-300/60">Players:</span>
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      dev.reset(n);
                      say(`New ${n}-player game.`);
                    }}
                    className={[
                      "gold-hairline h-6 w-6 rounded text-xs",
                      dev.playerCount === n
                        ? "bg-gold-500 font-semibold text-navy-950"
                        : "text-parchment-100 hover:bg-navy-800",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => {
                    dev.reset();
                    say("Re-dealt a fresh game.");
                  }}
                  title="New game, same player count"
                  className="gold-hairline ml-auto rounded px-2 py-1 text-xs text-parchment-100 hover:bg-navy-800"
                >
                  🔄 New
                </button>
              </div>
              <p className="text-center text-[10px] text-parchment-300/40">
                seed {dev.seed}
              </p>
            </Section>

            <p className="mt-2 rounded bg-emerald-400/10 px-2 py-1.5 text-[11px] leading-snug text-emerald-200/90">
              {note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-parchment-300/50">
        {title}
      </h4>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="gold-hairline w-full rounded px-2.5 py-1.5 text-left text-xs text-parchment-100 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="truncate font-semibold text-gold-300" title={value}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-parchment-300/50">
        {label}
      </div>
    </div>
  );
}
