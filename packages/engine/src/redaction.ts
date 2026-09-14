import type {
  GameState,
  GameEvent,
  Level,
  LEVELS,
  PlayerState,
  ReservedCard,
} from "./types";

// ---------------------------------------------------------------------------
// Redacted variants — deck order hidden (only counts), opponent blind-reserves
// hidden (cardId nulled). Shared by backend (to produce) and frontend (to consume).
// ---------------------------------------------------------------------------

/** A reserved card visible to its owner or for board-reserves (hidden: false). */
export type RedactedReservedCard =
  | ReservedCard                          // own blind reserve or any board-reserve
  | { hidden: true; cardId: null };       // opponent's blind reserve

export interface RedactedPlayerState extends Omit<PlayerState, "reserved"> {
  reserved: RedactedReservedCard[];
}

/**
 * GameState with deck arrays replaced by remaining counts and opponent blind-
 * reserves scrubbed. The log is also scrubbed: 'reserved' events emitted for
 * another seat that carried a hidden cardId have the id removed.
 */
export interface RedactedGameState
  extends Omit<GameState, "decks" | "players" | "log"> {
  /** Remaining card count per level — no ordering information. */
  deckCounts: Record<Level, number>;
  players: RedactedPlayerState[];
  log: GameEvent[];
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Produce a per-viewer redacted snapshot.
 *
 * @param state       The authoritative full GameState.
 * @param viewerSeat  The seat index the viewer occupies, or `null` for a
 *                    spectator (all blind reserves are hidden).
 */
export function redactStateFor(
  state: GameState,
  viewerSeat: number | null,
): RedactedGameState {
  // 1. Deck arrays → counts.
  const deckCounts = {
    1: state.decks[1].length,
    2: state.decks[2].length,
    3: state.decks[3].length,
  } as Record<Level, number>;

  // 2. Per-player reserve scrubbing.
  const players: RedactedPlayerState[] = state.players.map((p, seat) => {
    const isViewer = seat === viewerSeat;
    const reserved: RedactedReservedCard[] = p.reserved.map((r) => {
      // Only scrub blind reserves belonging to someone other than the viewer.
      if (r.hidden && !isViewer) {
        return { hidden: true as const, cardId: null };
      }
      return r;
    });
    return { ...p, reserved };
  });

  // 3. Log scrubbing: 'reserved' events for another seat with a hidden cardId
  //    must have the id stripped (deck-reserve reveals aren't announced).
  const log: GameEvent[] = state.log.map((ev) => {
    if (
      ev.t === "reserved" &&
      ev.cardId !== undefined &&
      ev.player !== viewerSeat
    ) {
      // The engine only populates cardId when the card is visible (board-reserve).
      // A deck-reserve never has cardId on the log event, so this guard is a
      // belt-and-suspenders defensive strip — if the engine ever adds it, we hide it.
      const { cardId: _stripped, ...rest } = ev;
      return rest as GameEvent;
    }
    return ev;
  });

  // Omit the full decks arrays from the output.
  const { decks: _decks, ...rest } = state;

  return {
    ...rest,
    deckCounts,
    players,
    log,
  };
}
