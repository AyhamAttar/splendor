// The browser holds two durable tokens in localStorage:
//  - the per-game session token (legacy hotseat; maps a device to one game), and
//  - the guest identity token (Phase 1; a durable per-device identity that can be
//    upgraded to a full account without losing history).
// The access token is deliberately NOT stored here — it lives only in memory
// (see lib/auth.ts) and is re-minted from the httpOnly refresh cookie on reload.
const KEY = "splendor.session";
const GUEST_KEY = "splendor.guest";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setSessionToken(token: string): void {
  window.localStorage.setItem(KEY, token);
}

export function clearSessionToken(): void {
  window.localStorage.removeItem(KEY);
}

export function getGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(GUEST_KEY);
}

export function setGuestToken(token: string): void {
  window.localStorage.setItem(GUEST_KEY, token);
}

export function clearGuestToken(): void {
  window.localStorage.removeItem(GUEST_KEY);
}
