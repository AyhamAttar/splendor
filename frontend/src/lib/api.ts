import type {
  GameState,
  RedactedGameState,
  TurnCommand,
} from "@splendor/engine";
import { authedFetch } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** A non-2xx response, narrowed. Engine 422s add fields like `mustReturn`,
 *  `eligible`, `shortfall`; stale-turn 409s add `currentTurn`. */
export interface ApiError {
  status: number;
  code?: string;
  message: string;
  [extra: string]: unknown;
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && "status" in e && "message" in e;
}

async function req<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers["x-session-token"] = opts.token;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    const err: ApiError = {
      status: 0,
      code: "NETWORK",
      message: "Cannot reach the game server. Is the API running on :4000?",
    };
    throw err;
  }

  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      message: (data.message as string) ?? res.statusText,
      ...data,
    };
    throw err;
  }
  return data as T;
}

export interface CreateGameResponse {
  gameId: string;
  sessionToken: string;
  state: GameState;
}

export const api = {
  createGame: (playerNames: string[], seed?: number) =>
    req<CreateGameResponse>("/games", {
      method: "POST",
      body: { playerNames, ...(seed !== undefined ? { seed } : {}) },
    }),
  getState: (gameId: string, token: string) =>
    req<{ state: GameState }>(`/games/${gameId}`, { token }),
  resume: (token: string) =>
    req<{ gameId: string; state: GameState }>(`/resume/${token}`),
  act: (
    gameId: string,
    token: string,
    command: TurnCommand & { expectedTurn: number },
  ) =>
    req<{ state: GameState }>(`/games/${gameId}/actions`, {
      method: "POST",
      token,
      body: command,
    }),
  remove: (gameId: string, token: string) =>
    req<void>(`/games/${gameId}`, { method: "DELETE", token }),
};

/** A per-viewer online game response: redacted state plus the caller's seat
 *  (null = spectator). */
export interface OnlineGameResponse {
  state: RedactedGameState;
  seat: number | null;
}

/**
 * Online games (created by the lobby / matchmaking) are authorized by IDENTITY,
 * not the legacy per-game session token — so these go through `authedFetch`,
 * which attaches the access token (or guest token) and silently refreshes it.
 */
export const onlineApi = {
  getState: (gameId: string) =>
    authedFetch<OnlineGameResponse>(`/games/${gameId}`),
  act: (gameId: string, command: TurnCommand & { expectedTurn: number }) =>
    authedFetch<OnlineGameResponse>(`/games/${gameId}/actions`, {
      method: "POST",
      body: command,
    }),
};
