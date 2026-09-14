import type { ApiError } from "./api";
import { getGuestToken } from "./session";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  /** Unique public @handle (Phase 4); null until claimed. */
  handle: string | null;
  /** Avatar image URL (Phase 4); null if unset. */
  avatar: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface GuestProfile {
  id: string;
  createdAt: string;
}

export interface SessionResponse {
  user: UserProfile;
  accessToken: string;
}

export interface GuestResponse {
  guestToken: string;
  guest: GuestProfile;
}

// The access token lives only in memory: never in localStorage (XSS-exfiltration
// risk) and never in a readable cookie. It is re-minted from the httpOnly
// refresh cookie via /auth/refresh on every page load.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Low-level JSON request that normalizes failures to the shared ApiError shape. */
async function request<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    credentials?: RequestCredentials;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? "GET",
      headers,
      credentials: opts.credentials ?? "include",
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

export const authApi = {
  /** Issue or re-touch the durable guest identity. */
  guest: (guestToken?: string | null) =>
    request<GuestResponse>("/auth/guest", {
      method: "POST",
      headers: guestToken ? { "x-guest-token": guestToken } : {},
    }),

  register: (
    body: { email: string; password: string; displayName?: string },
    guestToken?: string | null,
  ) =>
    request<SessionResponse>("/auth/register", {
      method: "POST",
      body,
      headers: guestToken ? { "x-guest-token": guestToken } : {},
    }),

  login: (body: { email: string; password: string }) =>
    request<SessionResponse>("/auth/login", { method: "POST", body }),

  /** Rotate the refresh cookie and mint a fresh access token. */
  refresh: () =>
    request<SessionResponse>("/auth/refresh", { method: "POST" }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  me: () =>
    request<{ user: UserProfile }>("/auth/me", {
      headers: authHeader(),
    }),
};

function authHeader(): Record<string, string> {
  return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
}

/**
 * Fetch an authenticated backend endpoint, attaching the in-memory access token
 * and transparently performing a single silent refresh + retry if the token has
 * expired (401). Used by user-scoped calls now, and by online game/room actions
 * from Phase 2 onward. Guest identity travels on the x-guest-token header.
 */
export async function authedFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const withAuth = (): Record<string, string> => {
    const h: Record<string, string> = { ...opts.headers, ...authHeader() };
    const guest = getGuestToken();
    if (!accessToken && guest) h["x-guest-token"] = guest;
    return h;
  };

  try {
    return await request<T>(path, { ...opts, headers: withAuth() });
  } catch (e) {
    const err = e as ApiError;
    if (err.status !== 401 || !accessToken) throw err;
    // Access token likely expired — try one silent refresh, then retry once.
    try {
      const { accessToken: fresh } = await authApi.refresh();
      setAccessToken(fresh);
    } catch {
      setAccessToken(null);
      throw err;
    }
    return request<T>(path, { ...opts, headers: withAuth() });
  }
}
