"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  applyTurn,
  createGame,
  getBonuses,
  getPrestige,
  getWinners,
  getCard,
  getNoble,
  GEMS,
  TOKEN_COLORS,
  LEVELS,
  type DevCardDef,
  type GameState,
  type Gem,
  type TokenBag,
  type TurnCommand,
} from "@splendor/engine";
import type { ApiError } from "@/lib/api";
import type { UseGame, SubmitResult } from "@/hooks/useGame";
import type { DevApi } from "@/components/dev/DevMenu";

const NAME_POOL = ["You", "Rival", "Guest", "Bot"];
// Fixed first deal so server render and client hydration agree (no mismatch);
// "New game" reseeds randomly, but only ever from a client interaction.
const INITIAL_SEED = 20250913;

function namesFor(count: number): string[] {
  const n = Math.min(4, Math.max(2, count));
  return NAME_POOL.slice(0, n);
}

function newSeed(): number {
  // Browser-only harness — Math.random is fine here (unlike workflow scripts).
  return Math.floor(Math.random() * 1_000_000_000);
}

function freshGame(playerCount: number, seed: number = newSeed()): GameState {
  return createGame({
    id: "sandbox",
    playerNames: namesFor(playerCount),
    seed,
  });
}

/**
 * Pull one card matching `pred` out of the market (preferred, refilling the
 * slot) or a deck, and return its id — or null if none is available. Keeps card
 * ids unique across the state, exactly as a real purchase/reserve would.
 */
function pullCard(
  s: GameState,
  pred: (c: DevCardDef) => boolean,
): number | null {
  for (const lvl of LEVELS) {
    const row = s.board[lvl];
    for (let i = 0; i < row.length; i++) {
      const id = row[i];
      if (id != null && pred(getCard(id))) {
        row[i] = s.decks[lvl].pop() ?? null; // refill like a board buy
        return id;
      }
    }
  }
  for (const lvl of LEVELS) {
    const deck = s.decks[lvl];
    for (let i = deck.length - 1; i >= 0; i--) {
      if (pred(getCard(deck[i]))) return deck.splice(i, 1)[0];
    }
  }
  return null;
}

export interface UseLocalGame {
  /** Drop-in `UseGame` for <GameView>; drives the real board off local state. */
  game: UseGame;
  /** Cheat controls for the floating DevMenu. */
  dev: DevApi;
}

/**
 * An entirely client-side Splendor game: `createGame` seeds a plain `GameState`
 * held in React state, and every submitted turn runs the pure `applyTurn`
 * reducer locally — no backend, auth, or socket. The returned `dev` API mutates
 * that state directly so a tester can jump straight to any scenario.
 */
export function useLocalGame(initialPlayers = 2): UseLocalGame {
  const [state, setStateRaw] = useState<GameState>(() =>
    freshGame(initialPlayers, INITIAL_SEED),
  );
  // Mirror the latest state in a ref so `submit`/mutators read fresh data
  // without waiting for a re-render. Every write goes through `setState`.
  const ref = useRef(state);
  const setState = useCallback((next: GameState) => {
    ref.current = next;
    setStateRaw(next);
  }, []);

  const mutate = useCallback(
    (fn: (draft: GameState) => void) => {
      const next = structuredClone(ref.current);
      fn(next);
      setState(next);
    },
    [setState],
  );

  // --- UseGame surface (server-shaped, but local + synchronous) ---
  const submit = useCallback(
    async (command: TurnCommand): Promise<SubmitResult> => {
      const res = applyTurn(ref.current, command);
      if (res.ok) {
        setState(res.state);
        return { ok: true };
      }
      // Match the server's error envelope: engine faults surface as 422 and
      // carry their extra fields (mustReturn / eligible / shortfall), which is
      // exactly what GameView reads to raise the return / noble-choice dialogs.
      const error: ApiError = { status: 422, message: res.error.code, ...res.error };
      return { ok: false, error };
    },
    [setState],
  );

  const game = useMemo<UseGame>(
    () => ({
      state,
      seat: null,
      connectedSeats: [],
      connectionStatus: "connected",
      loading: false,
      busy: false,
      error: null,
      submit,
      refresh: () => {},
    }),
    [state, submit],
  );

  // --- Dev mutators (all target the CURRENT player) ---
  const reset = useCallback(
    (playerCount?: number) => {
      setState(freshGame(playerCount ?? ref.current.players.length));
    },
    [setState],
  );

  const giveTokens = useCallback(
    (bag: TokenBag) =>
      mutate((s) => {
        const p = s.players[s.currentPlayer];
        for (const c of TOKEN_COLORS) {
          const take = Math.min(bag[c] ?? 0, s.bank[c]);
          if (take > 0) {
            p.tokens[c] += take;
            s.bank[c] -= take;
          }
        }
      }),
    [mutate],
  );

  const clearTokens = useCallback(
    () =>
      mutate((s) => {
        const p = s.players[s.currentPlayer];
        for (const c of TOKEN_COLORS) {
          s.bank[c] += p.tokens[c];
          p.tokens[c] = 0;
        }
      }),
    [mutate],
  );

  const fillTokens = useCallback(
    (total: number) =>
      mutate((s) => {
        const p = s.players[s.currentPlayer];
        for (const c of TOKEN_COLORS) {
          s.bank[c] += p.tokens[c];
          p.tokens[c] = 0;
        }
        // Spread the target across gem colors, round-robin, pulling from bank.
        let left = total;
        for (let i = 0; left > 0 && i < GEMS.length * 20; i++) {
          const g = GEMS[i % GEMS.length];
          if (s.bank[g] > 0) {
            p.tokens[g]++;
            s.bank[g]--;
            left--;
          }
        }
      }),
    [mutate],
  );

  const grantCard = useCallback(
    (opts?: { pointsOnly?: boolean }) => {
      let granted: number | null = null;
      mutate((s) => {
        const id = pullCard(s, (c) => (opts?.pointsOnly ? c.points > 0 : true));
        if (id != null) {
          s.players[s.currentPlayer].purchased.push(id);
          granted = id;
        }
      });
      return granted;
    },
    [mutate],
  );

  const qualifyForNobles = useCallback(
    (count: number) => {
      const chosen: number[] = [];
      mutate((s) => {
        const targets = s.nobles.slice(0, Math.max(1, count));
        if (targets.length === 0) return;
        const need: Record<Gem, number> = {
          white: 0, blue: 0, green: 0, red: 0, black: 0,
        };
        for (const nid of targets) {
          const req = getNoble(nid).requirement;
          for (const g of GEMS) need[g] = Math.max(need[g], req[g] ?? 0);
        }
        chosen.push(...targets);
        const p = s.players[s.currentPlayer];
        for (const g of GEMS) {
          while (getBonuses(p)[g] < need[g]) {
            const id = pullCard(s, (c) => c.bonus === g);
            if (id == null) break; // deck dry (never in the base game)
            p.purchased.push(id);
          }
        }
      });
      return chosen;
    },
    [mutate],
  );

  const grantNoble = useCallback(() => {
    let awarded: number | null = null;
    mutate((s) => {
      const nid = s.nobles[0];
      if (nid == null) return;
      s.players[s.currentPlayer].nobles.push(nid);
      s.nobles = s.nobles.filter((x) => x !== nid);
      s.log.push({ t: "noble", player: s.currentPlayer, nobleId: nid });
      awarded = nid;
    });
    return awarded;
  }, [mutate]);

  const setPrestige = useCallback(
    (target: number) =>
      mutate((s) => {
        const p = s.players[s.currentPlayer];
        // Greedily add point cards (largest that fits) to land on `target`.
        for (let guard = 0; getPrestige(p) < target && guard < 300; guard++) {
          const remaining = target - getPrestige(p);
          let pulled: number | null = null;
          for (let pts = Math.min(remaining, 5); pts >= 1 && pulled == null; pts--) {
            pulled = pullCard(s, (c) => c.points === pts);
          }
          if (pulled == null) break;
          p.purchased.push(pulled);
        }
      }),
    [mutate],
  );

  const forceFinalRound = useCallback(
    () =>
      mutate((s) => {
        if (s.finalRound) return;
        s.finalRound = true;
        s.log.push({ t: "final_round", triggeredBy: s.currentPlayer });
      }),
    [mutate],
  );

  const forceFinish = useCallback(
    () =>
      mutate((s) => {
        s.status = "finished";
        s.winners = getWinners(s);
        s.log.push({ t: "finished", winners: s.winners });
      }),
    [mutate],
  );

  const nextPlayer = useCallback(
    () =>
      mutate((s) => {
        s.currentPlayer = (s.currentPlayer + 1) % s.players.length;
        s.turnNumber += 1;
      }),
    [mutate],
  );

  const dev = useMemo<DevApi>(
    () => ({
      seed: state.seed,
      playerCount: state.players.length,
      currentName: state.players[state.currentPlayer]?.name ?? "",
      reset,
      giveTokens,
      fillTokens,
      clearTokens,
      grantCard,
      qualifyForNobles,
      grantNoble,
      setPrestige,
      forceFinalRound,
      forceFinish,
      nextPlayer,
    }),
    [
      state,
      reset,
      giveTokens,
      fillTokens,
      clearTokens,
      grantCard,
      qualifyForNobles,
      grantNoble,
      setPrestige,
      forceFinalRound,
      forceFinish,
      nextPlayer,
    ],
  );

  return { game, dev };
}
