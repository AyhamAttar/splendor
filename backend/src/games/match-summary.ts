import {
  getBonuses,
  getPrestige,
  getWinners,
  type GameState,
  type Gem,
} from "@splendor/engine";

/**
 * Per-seat final standing captured for match history / profile stats. Owning
 * identity is denormalized (`userId`/`guestId`) so a user's history and stats
 * are derivable from the summary alone without re-joining the (possibly-swept)
 * game snapshot. `bonuses` powers the "favorite gem" stat; `purchasedCardIds`
 * powers "most-bought card".
 */
export interface MatchPlayerSummary {
  seatIndex: number;
  name: string;
  userId: string | null;
  guestId: string | null;
  prestige: number;
  cards: number;
  nobles: number;
  bonuses: Record<Gem, number>;
  purchasedCardIds: number[];
  won: boolean;
}

/** The `MatchResult.summary` JSON shape (see schema.prisma). */
export interface MatchSummary {
  seed: number;
  /** Total turns applied over the whole game. */
  turnNumber: number;
  /** Wall-clock game length (finishedAt − game.createdAt), clamped to ≥ 0. */
  durationMs: number;
  players: MatchPlayerSummary[];
}

/** What gets written to a `MatchResult` row: winning seats + the full summary. */
export interface MatchOutcome {
  /** Winning seat indices (length > 1 on a full tie). */
  winners: number[];
  summary: MatchSummary;
}

/** Seat → owning identity, from the game's `GamePlayer` rows. */
export interface SeatOwner {
  seatIndex: number;
  userId: string | null;
  guestId: string | null;
}

/**
 * Build the immutable `MatchResult` payload from a FINISHED engine state plus
 * the seat→identity mapping. Pure: prestige/bonuses/winners come from the engine
 * selectors, so history and the in-game game-over screen agree exactly.
 */
export function summarizeGame(
  state: GameState,
  seats: SeatOwner[],
  createdAt: Date,
  finishedAt: Date,
): MatchOutcome {
  const winners = state.winners ?? getWinners(state);
  const winnerSet = new Set(winners);
  const ownerBySeat = new Map(seats.map((s) => [s.seatIndex, s]));

  const players: MatchPlayerSummary[] = state.players.map((p, seatIndex) => {
    const owner = ownerBySeat.get(seatIndex);
    return {
      seatIndex,
      name: p.name,
      userId: owner?.userId ?? null,
      guestId: owner?.guestId ?? null,
      prestige: getPrestige(p),
      cards: p.purchased.length,
      nobles: p.nobles.length,
      bonuses: getBonuses(p),
      purchasedCardIds: [...p.purchased],
      won: winnerSet.has(seatIndex),
    };
  });

  return {
    winners,
    summary: {
      seed: state.seed,
      turnNumber: state.turnNumber,
      durationMs: Math.max(0, finishedAt.getTime() - createdAt.getTime()),
      players,
    },
  };
}
