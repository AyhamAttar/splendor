# Data Model

Persistence uses **PostgreSQL** via **Prisma**. The schema lives at
[`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). This document
describes the Phase 0 tables and the reasoning behind them.

## Entity overview

```
User 1─0..1 GuestIdentity
User 1───* GamePlayer *───1 Game 1───* Move
User 1───* RefreshToken
GuestIdentity 1───* GamePlayer
Game 1───0..1 MatchResult
User *───* User  (via Friendship)
User 1───* Room  (host)
```

## Tables

### `Game`
The core row. One per game.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (PK) | Equals `GameState.id` (a UUID minted by the API). |
| `seed` | Int | RNG seed; with `Move` history the game is fully replayable. |
| `status` | `GameStatus` | `ACTIVE` / `FINISHED`, denormalized from the state. |
| `turnNumber` | Int | Denormalized optimistic-concurrency tag. |
| `state` | Json | **Authoritative `GameState` snapshot** (see `@splendor/engine`). |
| `sessionToken` | String (unique) | Legacy shared per-game token (hotseat auth). |
| `online` | Boolean | `false` for hotseat; `true` for networked games (Phase 2+). Online games use identity-based seat ownership and return fog-of-war redacted state. |
| `createdAt` / `updatedAt` | DateTime | `updatedAt` drives idle TTL sweeping. |

**Why store `GameState` as JSON?** The engine already defines a complete,
serializable, framework-free state object and is the single source of truth for
its shape. Mirroring every nested field into relational columns would create a
second schema to keep in sync with the engine and buy nothing — the API always
loads/saves the whole state atomically per turn. `turnNumber`/`status` are lifted
out only for cheap indexing and queries.

### `Move`
Append-only per-turn log. Enables audit, replay, and match history.

| Field | Type | Notes |
|-------|------|-------|
| `gameId` | FK → Game | Cascade delete with the game. |
| `turnNumber` | Int | Engine turn number **before** the command applied. |
| `seatIndex` | Int | Player index that moved. |
| `command` | Json | The raw `TurnCommand` as submitted. |
| | | `@@unique([gameId, turnNumber])` prevents double-recording a turn. |

### `GamePlayer`
A seat, mapping the engine's `players[seatIndex]` to an identity.

| Field | Type | Notes |
|-------|------|-------|
| `gameId` | FK → Game | Cascade delete. |
| `seatIndex` | Int | `@@unique([gameId, seatIndex])`. |
| `name` | String | Display name. |
| `userId` / `guestId` | FK? | Null for hotseat seats; set for online seats (Phase 2+). |

### `User` and `GuestIdentity`
Identity tables. `GuestIdentity` gives anonymous players a durable device identity
that can be upgraded to a `User` without losing history (the upgrade sets
`GuestIdentity.userId`; games stay attached via `GamePlayer.guestId`).

**Phase 1** added auth fields to `User`:

| Field | Type | Notes |
|-------|------|-------|
| `passwordHash` | String? | bcrypt (cost 12). Null for OAuth-only accounts (OAuth deferred). |
| `emailVerifiedAt` | DateTime? | Set when email verification confirms the address; unused/optional in Phase 1. |

**Phase 4** added profile fields to `User`:

| Field | Type | Notes |
|-------|------|-------|
| `handle` | String? (unique) | Public @handle — the discoverable identity for friend requests. Stored lowercase; null until claimed. |
| `avatar` | String? | Optional avatar image URL, validated as http(s) on write, rendered client-side. |

### `RefreshToken`
One row per active session/device (Phase 1). The raw token is **never stored** —
only its SHA-256 hash — so a DB leak can't be replayed. See [AUTH.md](./AUTH.md)
for the rotation/reuse-detection lifecycle.

| Field | Type | Notes |
|-------|------|-------|
| `userId` | FK → User | Cascade delete with the account. |
| `tokenHash` | String (unique) | SHA-256 of the raw refresh token. |
| `expiresAt` | DateTime | Session expiry (`AUTH_REFRESH_TTL_DAYS`). |
| `revokedAt` | DateTime? | Set on rotation, logout, or reuse-detection sweep. |
| `replacedByHash` | String? | Links a rotated token to its successor. |
| `userAgent` | String? | Best-effort device label for the session. |

### `Friendship` (Phase 4)
A single edge between two users. One row per **ordered** `(requester, addressee)`
pair (`@@unique([requesterId, addresseeId])`); the service enforces at most one
relationship per pair across directions.

| Field | Type | Notes |
|-------|------|-------|
| `requesterId` / `addresseeId` | FK → User | Cascade delete with either account. |
| `status` | `FriendshipStatus` | `PENDING` (requester → addressee), `ACCEPTED` (mutual), `BLOCKED` (requester is the blocker). |

See [SOCIAL.md](./SOCIAL.md) for the request/accept/block state machine.

### `MatchResult` (Phase 4)
Immutable per-game summary written **atomically** with the finishing turn (in the
same transaction that flips `Game.status` to `FINISHED`), so "finished" ⇔ "history
row exists". A user's match history is every `MatchResult` whose game has a
`GamePlayer` owned by that user (or by the guest identity they upgraded from).

| Field | Type | Notes |
|-------|------|-------|
| `gameId` | FK → Game (unique) | Cascade delete with the game. |
| `winners` | Json | `number[]` of winning seat indices (length > 1 on a tie). |
| `summary` | Json | `MatchSummary`: seed, total turns, duration, and a per-seat breakdown (name, owning userId/guestId, prestige, cards, nobles, gem bonuses, purchased card ids, won). See backend `match-summary.ts`. |
| `finishedAt` | DateTime | When the game ended. |

## TTL / cleanup
`GameRepository` runs an interval sweep (every 15 min) deleting **only `ACTIVE`**
games whose `updatedAt` is older than `GAME_TTL_HOURS` (default 24) — i.e.
abandoned in-progress games. **`FINISHED` games are retained** so their
`MatchResult` (durable match history) and `seed` + `Move` log (replay data, Phase
4 keeps this available) survive. Cascades still remove a deleted game's
`GamePlayer`, `Move`, and `MatchResult` rows. Bounding retention of finished games
(archival) is a later-phase concern. Idle is measured from the last **write**
(turn), not the last read.

## Migrations & workflow
- Generate the client after schema changes: `pnpm --filter @splendor/backend prisma:generate`
- Create/apply a dev migration: `pnpm --filter @splendor/backend prisma:migrate` (needs a running DB)
- Apply migrations in prod/CI: `pnpm --filter @splendor/backend prisma:deploy`
- Inspect data: `pnpm --filter @splendor/backend prisma:studio`

A local PostgreSQL is provided by the repo-root `docker-compose.yml`
(`docker compose up -d`); point the backend at it via `backend/.env`
(copy from `backend/.env.example`).
