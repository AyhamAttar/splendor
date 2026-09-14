"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  applyTurn,
  canAfford,
  canPass,
  getCard,
  getNoble,
  LEVELS,
  type Action,
  type EngineError,
  type GameState,
  type Level,
  type PlayerState,
  type RedactedGameState,
  type RedactedPlayerState,
  type TokenColor,
  type TurnCommand,
} from "@splendor/engine";
import { useGame, type UseGame } from "@/hooks/useGame";
import { useSelection } from "@/hooks/useSelection";
import { useDraggable } from "@/hooks/useDraggable";
import { useResizable } from "@/hooks/useResizable";
import { clearSessionToken } from "@/lib/session";
import { useMessages, useT } from "@/i18n/I18nProvider";
import { LanguageToggle } from "./LanguageToggle";
import { NobleRow } from "./NobleRow";
import { CardMarket } from "./CardMarket";
import { TokenBank } from "./TokenBank";
import { PlayerPanel } from "./PlayerPanel";
import { LogFeed } from "./LogFeed";
import { ActionBar } from "./ActionBar";
import { Button } from "./Button";
import { Celebrations } from "./Celebrations";
import { Loader } from "./Loader";
import { CardDetailsModal } from "./CardDetailsModal";
import { CardInspectProvider, type Inspectable } from "./CardInspectContext";
import { BuyDialog } from "./dialogs/BuyDialog";
import { TokenReturnDialog } from "./dialogs/TokenReturnDialog";
import { NobleChoiceDialog } from "./dialogs/NobleChoiceDialog";
import { GameOverDialog } from "./dialogs/GameOverDialog";
// Type-only import — erased at build, so the dev harness never ships to prod.
import type { DevApi } from "./dev/DevMenu";
import { DevMenu } from "./dev/DevMenu";

const ACTIONBAR_MIN_KEY = "splendor:actionbar-min";

type Dialog =
  | { type: "buy"; cardId: number }
  | {
      type: "return";
      command: TurnCommand;
      mustReturn: number;
      projected: Record<TokenColor, number>;
    }
  | { type: "noble"; command: TurnCommand; eligible: number[] };

function projectTokens(
  player: PlayerState | RedactedPlayerState,
  action: Action,
  bankGold: number,
): Record<TokenColor, number> {
  const t = { ...player.tokens };
  if (action.type === "TAKE_DIFFERENT") for (const g of action.gems) t[g]++;
  else if (action.type === "TAKE_SAME") t[action.gem] += 2;
  else if (
    (action.type === "RESERVE_DECK" || action.type === "RESERVE_BOARD") &&
    bankGold > 0
  )
    t.gold++;
  return t;
}

function dialogForSubDecision(
  command: TurnCommand,
  err: { code?: string; mustReturn?: unknown; eligible?: unknown },
  state: GameState | RedactedGameState,
): Dialog | null {
  if (err.code === "TOKEN_RETURN_REQUIRED") {
    return {
      type: "return",
      command,
      mustReturn: Number(err.mustReturn),
      projected: projectTokens(
        state.players[state.currentPlayer],
        command.action,
        state.bank.gold,
      ),
    };
  }
  if (err.code === "NOBLE_CHOICE_REQUIRED") {
    return {
      type: "noble",
      command,
      eligible: (err.eligible as number[]) ?? [],
    };
  }
  return null;
}

function engineMessage(e: EngineError, errors: Record<string, string>): string {
  switch (e.code) {
    case "PASS_NOT_ALLOWED":
      return errors.passNotAllowed;
    case "CANNOT_AFFORD":
      return errors.cannotAfford;
    case "RESERVE_LIMIT":
      return errors.reserveLimit;
    default:
      return errors.notAllowed;
  }
}

export function GameScreen({
  gameId,
  online = false,
}: {
  gameId: string;
  online?: boolean;
}) {
  const game = useGame(gameId, { online });
  return <GameView game={game} online={online} />;
}

/**
 * The board, action bar, and dialogs — driven entirely by an injected game
 * controller instead of talking to the network itself. Production routes pass
 * the server-backed `useGame`; the dev-only `/sandbox` route passes a local
 * in-memory controller plus a `dev` API so the floating DevMenu can seed states
 * and drive real turns. `dev` is undefined in production, so DevMenu never
 * renders there.
 */
export function GameView({
  game,
  online = false,
  dev,
}: {
  game: UseGame;
  online?: boolean;
  dev?: DevApi | null;
}) {
  const router = useRouter();
  const m = useMessages();
  const t = useT();
  const { state, seat, connectionStatus, loading, busy, error, submit, refresh } =
    game;
  const sel = useSelection(state);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [inspect, setInspect] = useState<Inspectable | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const {
    nodeRef: barRef,
    handleProps: barHandle,
    style: barStyle,
    reset: barReset,
    moved: barMoved,
  } = useDraggable("splendor:actionbar-pos");
  const {
    resizeHandleProps,
    sizeStyle,
    reset: resizeReset,
    resized: barResized,
  } = useResizable(barRef, "splendor:actionbar-size", { minW: 280, minH: 76 });

  // Restore the minimized preference once, on mount.
  useEffect(() => {
    try {
      setMinimized(localStorage.getItem(ACTIONBAR_MIN_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMinimize = useCallback(() => {
    setMinimized((v) => {
      const next = !v;
      try {
        localStorage.setItem(ACTIONBAR_MIN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const openInspect = useCallback((x: Inspectable) => {
    setActionError(null);
    setInspect(x);
  }, []);

  const finalize = useCallback(
    async (command: TurnCommand) => {
      setDialog(null);
      setInspect(null);
      setActionError(null);
      sel.clear();
      const res = await submit(command);
      if (res.ok || !res.error || !state) return;
      const e = res.error;
      const sub =
        e.status === 422 ? dialogForSubDecision(command, e, state) : null;
      if (sub) {
        setDialog(sub);
      } else if (e.status === 409) {
        setActionError(m.game.errors.stateChanged);
        refresh();
      } else {
        setActionError(e.message);
      }
    },
    [submit, state, sel, refresh, m],
  );

  const advance = useCallback(
    (command: TurnCommand) => {
      if (!state) return;
      // Online play holds only a redacted state (no deck order), so a local
      // applyTurn preview isn't possible — submit straight to the server, which
      // drives any sub-decision (token return / noble choice) via a 422 that
      // `finalize` already handles. Hotseat keeps the optimistic preview.
      if (online) {
        void finalize(command);
        return;
      }
      const preview = applyTurn(state as GameState, command);
      if (preview.ok) {
        void finalize(command);
        return;
      }
      const e = preview.error;
      const sub = dialogForSubDecision(command, e, state);
      if (sub) {
        setDialog(sub);
      } else {
        setActionError(engineMessage(e, m.game.errors));
      }
    },
    [state, online, finalize, m],
  );

  if (loading) {
    return (
      <Centered>
        <Loader label={m.game.loading} />
      </Centered>
    );
  }
  if (!state) {
    return (
      <Centered>
        <div className="gold-frame max-w-sm rounded-lg bg-navy-800/70 p-6 text-center">
          <p className="text-parchment-100">
            {error?.message ?? m.game.couldNotLoad}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-gold-300 underline hover:text-gold-400"
          >
            {m.game.backToLobby}
          </Link>
        </div>
      </Centered>
    );
  }

  const current = state.players[state.currentPlayer];
  const finished = state.status === "finished";
  const dialogOpen = dialog !== null;
  // Online: only the viewer may act, and only on their own turn. Hotseat: the
  // device controls whoever's turn it is.
  const isMyTurn = !online || (seat != null && seat === state.currentPlayer);
  const interactionsDisabled = finished || busy || dialogOpen || !isMyTurn;
  const canReserveNow = current.reserved.length < 3;
  const affordableFn = (cardId: number) =>
    canAfford(current as PlayerState, getCard(cardId));
  const canPassNow = canPass(state);
  const barError =
    actionError ?? (error && error.status !== 0 ? error.message : null);

  // Contextual buttons shown inside the card-details modal. A market card can
  // be bought or reserved; the current player's reserved card can be bought.
  const devActions = (cardId: number): React.ReactNode => {
    if (finished) return null;
    const inMarket = LEVELS.some((l) => state.board[l].includes(cardId));
    const isOwnReserved = current.reserved.some((r) => r.cardId === cardId);
    if (!inMarket && !isOwnReserved) return null;
    const buyable = affordableFn(cardId);
    return (
      <>
        <Button
          size="sm"
          onClick={() => {
            setInspect(null);
            setDialog({ type: "buy", cardId });
          }}
          disabled={interactionsDisabled || !buyable}
        >
          {m.actions.buy}
        </Button>
        {inMarket && (
          <button
            onClick={() =>
              advance({ action: { type: "RESERVE_BOARD", cardId } })
            }
            disabled={interactionsDisabled || !canReserveNow}
            title={
              canReserveNow ? m.cardMarket.reserve : m.cardMarket.reserveFull
            }
            className="gold-hairline rounded px-3 py-1.5 text-sm text-parchment-100 hover:bg-navy-800 disabled:opacity-40"
          >
            {m.actions.reserve}
          </button>
        )}
      </>
    );
  };

  return (
    <CardInspectProvider value={openInspect}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gold-700/25 pb-6">
          <h1 className="font-display text-3xl font-bold text-gold-300 [text-shadow:0_1px_0_rgba(255,255,255,0.1),0_2px_12px_rgba(217,180,91,0.22),0_2px_2px_rgba(3,7,18,0.5)]">
            {m.game.title}
          </h1>
          <div className="flex items-center gap-3 text-sm">
            {finished ? (
              <span className="font-display text-lg text-gold-300">
                {m.game.gameover}
              </span>
            ) : online && isMyTurn ? (
              <span className="font-display text-gold-300">
                {m.game.online.yourTurn}
              </span>
            ) : (
              <span className="text-parchment-100">
                {t("game.currentTurn", { name: current.name })}
              </span>
            )}
            {online && connectionStatus !== "connected" && (
              <span
                className="gold-hairline rounded-full px-2.5 py-0.5 text-xs text-gem-red"
                title={m.game.online.reconnecting}
              >
                {m.game.online.reconnecting}
              </span>
            )}
            <span className="gold-hairline rounded-full px-2.5 py-0.5 text-xs text-parchment-300/70">
              {t("game.turnBadge", { n: state.turnNumber })}
            </span>
            <Link
              href="/"
              className="text-parchment-300/70 underline-offset-2 transition hover:text-gold-300 hover:underline"
            >
              {m.game.lobby}
            </Link>
            <LanguageToggle />
          </div>
        </header>

        {state.finalRound && !finished && (
          <div className="gold-hairline mt-3 rounded bg-navy-800/60 px-3 py-2 text-sm text-gold-300 shadow-raise-1">
            {m.game.finalRound}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex items-start gap-4">
            <section className="playfield rise-in shrink-0 p-4 sm:p-5">
              <h2 className="font-display mb-3 text-sm uppercase tracking-widest text-gold-300/80">
                {m.game.nobles}
              </h2>
              <NobleRow nobleIds={state.nobles} />
            </section>

            <div
              className="playfield rise-in flex min-w-0 flex-1 flex-col gap-6 p-5 sm:p-6"
              style={{ animationDelay: "90ms" }}
            >
              <div className="-mx-1 overflow-x-auto px-1 py-3">
                <CardMarket
                  state={state}
                  affordable={affordableFn}
                  canReserve={canReserveNow}
                  disabled={interactionsDisabled}
                  onBuy={(cardId) => {
                    setDialog({ type: "buy", cardId });
                  }}
                  onReserveCard={(cardId) =>
                    advance({ action: { type: "RESERVE_BOARD", cardId } })
                  }
                  onReserveDeck={(level: Level) =>
                    advance({ action: { type: "RESERVE_DECK", level } })
                  }
                />
              </div>

              <TokenBank
                state={state}
                selection={sel.gems}
                canAdd={sel.canAdd}
                onAdd={sel.add}
                disabled={interactionsDisabled}
              />
            </div>
          </div>

          <aside
            className="rise-in flex flex-col gap-3"
            style={{ animationDelay: "140ms" }}
          >
            {state.players.map((p, i) => (
              <PlayerPanel
                key={i}
                player={p}
                isCurrent={i === state.currentPlayer}
                canAct={i === state.currentPlayer && !interactionsDisabled}
                isViewer={online && i === seat}
                affordable={affordableFn}
                onBuyReserved={(cardId) => setDialog({ type: "buy", cardId })}
              />
            ))}
            <LogFeed state={state} />
          </aside>
        </div>

        {!finished && (
          <div className="sticky bottom-3 z-30 mt-6 flex justify-end">
            <div
              ref={barRef}
              style={{
                ...barStyle,
                ...(minimized ? undefined : sizeStyle),
                ...(barResized && !minimized
                  ? { maxWidth: "none" }
                  : undefined),
              }}
              className={[
                minimized ? "w-auto" : barResized ? "" : "w-full lg:max-w-md",
                barMoved ? "z-40 drop-shadow-2xl" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <ActionBar
                gems={sel.gems}
                total={sel.total}
                onRemove={sel.remove}
                onConfirmTake={() =>
                  sel.action && advance({ action: sel.action })
                }
                onClear={sel.clear}
                canPass={canPassNow}
                onPass={() => advance({ action: { type: "PASS" } })}
                busy={busy}
                error={barError}
                disabled={dialogOpen}
                handleProps={barHandle}
                onResetPosition={barReset}
                moved={barMoved}
                minimized={minimized}
                onToggleMinimize={toggleMinimize}
                resizeHandleProps={resizeHandleProps}
                onResetSize={resizeReset}
              />
            </div>
          </div>
        )}

        <Celebrations state={state} />

        {dialog?.type === "buy" && (
          <BuyDialog
            card={getCard(dialog.cardId)}
            // BuyDialog reads tokens + bonuses only; a redacted viewer player
            // (own seat, real data) is safe to treat as a full PlayerState.
            player={current as PlayerState}
            busy={busy}
            onClose={() => setDialog(null)}
            onConfirm={() =>
              advance({ action: { type: "PURCHASE", cardId: dialog.cardId } })
            }
          />
        )}
        {dialog?.type === "return" && (
          <TokenReturnDialog
            projected={dialog.projected}
            mustReturn={dialog.mustReturn}
            busy={busy}
            onClose={() => setDialog(null)}
            onConfirm={(ret) =>
              advance({ ...dialog.command, returnTokens: ret })
            }
          />
        )}
        {dialog?.type === "noble" && (
          <NobleChoiceDialog
            eligible={dialog.eligible}
            busy={busy}
            onChoose={(nobleId) => advance({ ...dialog.command, nobleId })}
          />
        )}
        {finished && (
          <GameOverDialog
            state={state}
            onNewGame={() => {
              // Online games aren't tied to the device session token; just
              // return to the lobby.
              if (!online) clearSessionToken();
              router.push("/");
            }}
          />
        )}

        {inspect?.kind === "dev" && (
          <CardDetailsModal
            card={getCard(inspect.cardId)}
            actions={devActions(inspect.cardId)}
            onClose={() => setInspect(null)}
          />
        )}
        {inspect?.kind === "noble" && (
          <CardDetailsModal
            noble={getNoble(inspect.nobleId)}
            onClose={() => setInspect(null)}
          />
        )}

        {dev && (
          <DevMenu
            dev={dev}
            state={state as GameState}
            advance={advance}
            canAct={!interactionsDisabled}
          />
        )}
      </div>
    </CardInspectProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      {children}
    </div>
  );
}
