# Authentication & Identity (Phase 1)

Splendor gives **every** visitor a durable identity with the lowest possible
friction: play instantly as a **guest**, and optionally upgrade to a full
**account** later without losing anything. This document describes the identity
model, the token lifecycle, the guest → account upgrade, the HTTP surface, and
the security posture.

> Scope note: Phase 1 establishes *identity*. Wiring identities to **game seat
> ownership** (so only the seat's owner can act, with fog-of-war redaction) is
> Phase 2. Today's game endpoints still use the legacy per-game
> `x-session-token` for local hotseat play; that is untouched here.

## Identity model

```
                 ┌──────────────┐        upgrade (claim)        ┌──────────┐
   first visit ─▶│ GuestIdentity│ ───────────────────────────▶ │   User   │
                 │  (device)    │  GuestIdentity.userId = User  │ (account)│
                 └──────┬───────┘                               └────┬─────┘
                        │ guestId                                     │ userId
                        ▼                                             ▼
                     GamePlayer  ◀── a seat is owned by a guest OR a user
```

- **GuestIdentity** — a per-device identity created on first load. The client
  holds a **signed, non-expiring guest token** (a JWT); the row stores the
  token's `jti`, so the token is both *tamper-evident* (signature) and
  *revocable* (rotate the `jti` → old token rejected). Guests can play with no
  signup.
- **User** — a registered account (`email` + `passwordHash`, bcrypt). A user may
  hold multiple concurrent **sessions**, each represented by a `RefreshToken`
  row.
- A **guest can be upgraded** to a user; the `GuestIdentity.userId` link means
  games the guest played (attached via `GamePlayer.guestId`) stay attributable to
  the new account.

See [DATA_MODEL.md](./DATA_MODEL.md) for the exact columns.

## Tokens

| Token | Form | Lifetime | Storage (client) | Storage (server) |
|-------|------|----------|------------------|------------------|
| **Access** | JWT (HS256), `typ:"access"` | short (`JWT_ACCESS_TTL`, default 15m) | **in memory only** | none (stateless) |
| **Refresh** | opaque random (48 bytes) | long (`AUTH_REFRESH_TTL_DAYS`, default 30d) | **httpOnly cookie** `refresh_token` | **SHA-256 hash** in `RefreshToken` |
| **Guest** | JWT (HS256), `typ:"guest"`, no `exp` | durable | `localStorage` (`splendor.guest`) | `jti` in `GuestIdentity.token` |

Why this split:
- The **access token never touches storage** — it lives in a module variable and
  is re-minted on every page load, so an XSS payload can't lift a long-lived
  credential from `localStorage`, and it isn't a cookie the browser will attach
  to forged requests.
- The **refresh token is httpOnly** — JavaScript can't read it, and it only
  reaches the `/auth` path. Its raw value is **never stored server-side**; only a
  SHA-256 hash is, so a database leak can't be replayed.

### Access-token lifecycle (silent refresh)

```
page load ──▶ POST /auth/refresh (cookie) ──▶ 200 { user, accessToken }  ──▶ signed in
                     │                              (new refresh cookie set)
                     └── 401 ──▶ POST /auth/guest ──▶ { guestToken, guest } ──▶ guest

authed call ──▶ 401 (access expired) ──▶ POST /auth/refresh ──▶ retry once with new access token
```

The frontend `authedFetch` (see `frontend/src/lib/auth.ts`) performs the
expired-access retry automatically; `AuthProvider` performs the load-time
bootstrap.

### Refresh-token rotation & reuse detection

Every `/auth/refresh` **rotates**: the presented token is marked `revokedAt` and
linked to its successor via `replacedByHash`, and a brand-new token is issued.
Consequences:

- A refresh token is **single-use**. Using yesterday's token after it rotated
  fails — "rotation invalidates the old token".
- Presenting an **already-revoked** token is treated as theft/replay: the user's
  **entire token family is revoked** (`revokeAllForUser`), forcing a fresh login
  everywhere. This bounds the damage from a stolen refresh token.
- `logout` revokes the current token; expiry is enforced on every rotation.

## Guest → account upgrade

`POST /auth/register` accepts an optional `x-guest-token` header. When present and
valid, the new account **claims** that guest identity
(`GuestIdentity.userId = user.id`, only if not already claimed). Because a guest's
games hang off `GamePlayer.guestId`, they remain attributable to the account —
history is preserved. A bad/expired guest token never fails an otherwise-valid
signup (it just isn't linked). In the UI, "Create account" while playing as a
guest *is* the upgrade path.

## HTTP surface (`/auth`)

| Method & path | Auth in | Returns | Notes |
|---------------|---------|---------|-------|
| `POST /auth/guest` | optional `x-guest-token` | `{ guestToken, guest }` | Idempotent: re-touches an existing guest or mints a new one. |
| `POST /auth/register` | optional `x-guest-token` | `{ user, accessToken }` + refresh cookie | Upgrades the guest if supplied. |
| `POST /auth/login` | body `{ email, password }` | `{ user, accessToken }` + refresh cookie | Generic error on bad credentials. |
| `POST /auth/refresh` | refresh cookie | `{ user, accessToken }` + rotated cookie | Silent refresh; clears the cookie on failure. |
| `POST /auth/logout` | refresh cookie | `204` | Revokes the token, clears the cookie. |
| `GET  /auth/me` | `Authorization: Bearer` | `{ user }` | Guarded by `JwtAuthGuard`; `401` when not signed in. |

Error bodies follow the app convention `{ code, message, ...extra }` — e.g.
`EMAIL_TAKEN` (409), `INVALID_CREDENTIALS` (401), `INVALID_REFRESH` /
`REFRESH_REUSED` / `REFRESH_EXPIRED` (401), `NO_TOKEN` / `INVALID_TOKEN` (401).

### Guards & decorators (for later phases)

- `JwtAuthGuard` — requires a valid access token; attaches `req.user`
  (`@CurrentUser()`).
- `GuestOrUserGuard` — accepts an access token **or** a guest token; attaches
  `req.identity` with exactly one of `userId` / `guestId` (`@CurrentIdentity()`).
  This is what online game/room endpoints will use from Phase 2.

## Rate limiting

Global throttling via `@nestjs/throttler` (in-memory; a Redis store swaps in for
multi-instance — Phase 7). A generous global default (300/min) protects gameplay
without impeding turns; auth routes tighten it: `login` 10/min, `register` 5/min,
`guest` 30/min, `refresh` 60/min (all per IP).

## Security notes

- **Passwords**: bcrypt, cost 12. Login runs a compare even for unknown emails
  and returns a single generic error to blunt account enumeration / timing.
- **Secrets**: `JWT_ACCESS_SECRET` and `GUEST_TOKEN_SECRET` are read from env and
  are **required in production** — the app refuses an insecure fallback when
  `NODE_ENV=production`. Never commit real secrets; `.env` is gitignored and
  `.env.example` documents each var.
- **Cookies**: `httpOnly`, `SameSite` from `COOKIE_SAMESITE` (default `lax` — the
  frontend and API share a site in the default deploy), `Secure` from
  `COOKIE_SECURE` (set `true` behind HTTPS), scoped to path `/auth`.
- **CORS**: origins from `CORS_ORIGINS`, `credentials: true` so the refresh
  cookie can ride; `authorization`, `x-guest-token`, and the legacy
  `x-session-token` headers are allow-listed.
- **Validation**: all request bodies are class-validator DTOs behind the global
  `ValidationPipe` (`whitelist: true`). Broader payload hardening is Phase 5.

## Not built in Phase 1 (by design)

- **Google OAuth** — designed for (`OAUTH_GOOGLE_ENABLED` flag, `passwordHash`
  nullable) but not implemented; skip per the time-box.
- **Email verification** — the `User.emailVerifiedAt` column exists and
  `emailVerified` is surfaced on the profile, but no verification email is sent
  and nothing is gated on it yet.

## Environment

See [`backend/.env.example`](../backend/.env.example) for the full list with
comments: `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `GUEST_TOKEN_SECRET`,
`AUTH_REFRESH_TTL_DAYS`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN`,
`OAUTH_GOOGLE_ENABLED`.
