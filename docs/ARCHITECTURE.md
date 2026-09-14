# Architecture

Splendor is a pnpm **monorepo** with one shared package and two apps.

```
splendor/
├─ packages/
│  └─ engine/         @splendor/engine — pure, deterministic rules engine
├─ backend/           @splendor/backend — NestJS 11 REST API + PostgreSQL (Prisma)
├─ frontend/          @splendor/frontend — Next.js 16 (App Router) client
├─ docs/              architecture & operational docs (this folder)
├─ docker-compose.yml local dependencies (PostgreSQL; expanded in Phase 6)
├─ pnpm-workspace.yaml workspace + build-script allowlist
└─ package.json       root scripts (build / typecheck / test / lint across packages)
```

## Packages

### `@splendor/engine` (`packages/engine`)
The single source of truth for Splendor rules. Previously duplicated byte-for-byte
between the backend and frontend; now one package both apps depend on.

- **Pure & deterministic** — no I/O, no framework, no side effects. A game is a
  plain serializable `GameState` produced by `createGame({ id, playerNames, seed })`
  and advanced by `applyTurn(state, command)` which returns a new state (never
  mutates). Given the same `seed` + move sequence, the game is fully reproducible.
- **Authoritative on the backend**; the frontend imports it for zero-latency
  previews/affordances (cost after discounts, noble eligibility, payment).
- Ships **compiled CJS + `.d.ts`** to `dist/` (build with `tsc`). Consumers resolve
  it as an ordinary dependency (`"@splendor/engine": "workspace:*"`), so it must be
  built before the apps build. `pnpm -r build` handles ordering topologically.
- Owns its own Jest suite (`src/__tests__`, 60 tests): setup invariants, all
  actions, payment, nobles, endgame tie-breaks, token conservation.

Public API (`packages/engine/src/index.ts`): `createGame`, `applyTurn`,
selectors (`getBonuses`, `getPrestige`, `getEffectiveCost`, `getWinners`), payment
(`canAfford`, `computeAutoPayment`, `validateExplicitPayment`), rules
(`eligibleNobles`, `canPass`), data (`CARDS`, `NOBLES`, lookups) and all domain types.

### `@splendor/backend` (`backend`)
NestJS 11 REST API. The engine is applied here authoritatively; state is persisted
to PostgreSQL via Prisma (see [DATA_MODEL.md](./DATA_MODEL.md)).

- **`games/`** — controller, service, `GameRepository` (DB-backed store), and
  `GameGateway` (Socket.IO gateway for realtime push — Phase 2).
- **`auth/`** — identity & accounts (Phase 1): guest identities plus
  email/password accounts with rotating JWT access + refresh tokens, plus the
  shared `SocketIdentityService` used by both gateways. See [AUTH.md](./AUTH.md).
- **`rooms/`** — private lobby (Phase 3): `Room`/`RoomMember`, `RoomsService`,
  `LobbyGateway` (room realtime), and `RoomSweeper`. See [ROOMS.md](./ROOMS.md).
- **`matchmaking/`** — public quick-match queue (Phase 3); in-memory behind a
  swappable DI token. See [MATCHMAKING.md](./MATCHMAKING.md).
- **`prisma/`** — `PrismaService` (client lifecycle) + global `PrismaModule`.
- Config via `@nestjs/config` (loads `backend/.env`): `DATABASE_URL`, `PORT`,
  `CORS_ORIGINS`, `GAME_TTL_HOURS`, plus the auth vars (`JWT_ACCESS_SECRET`,
  `GUEST_TOKEN_SECRET`, …).
- Global in-memory rate limiting via `@nestjs/throttler` (Redis store deferred to
  Phase 7).

REST surface:
- **Games**: `POST /games`, `GET /games/:id`,
  `POST /games/:id/actions`, `GET /resume/:token`, `DELETE /games/:id`.
  Hotseat games (`online=false`) use the legacy per-game `x-session-token`.
  Online games (`online=true`) use identity via `OptionalIdentityGuard` and
  enforce per-seat ownership; responses are fog-of-war redacted (see
  [REALTIME.md](./REALTIME.md)).
- **WebSocket**: `GameGateway` and `LobbyGateway` share the default Socket.IO
  server. Game clients subscribe to game rooms and receive per-viewer redacted
  state after each committed turn; lobby clients subscribe to `room:{code}` and
  receive room snapshots (Phase 3).
- **Auth**: `POST /auth/{guest,register,login,refresh,logout}`, `GET /auth/me` —
  see [AUTH.md](./AUTH.md).
- **Rooms**: `POST /rooms`, `GET /rooms/:code`,
  `POST /rooms/:code/{join,leave,ready,seats,kick,start}` — identity-scoped
  private lobby. See [ROOMS.md](./ROOMS.md).
- **Matchmaking**: `POST`/`DELETE /matchmaking/queue`, `GET /matchmaking/status`
  — public quick-match. See [MATCHMAKING.md](./MATCHMAKING.md).

### `@splendor/frontend` (`frontend`)
Next.js 16 App Router client (React 19, Tailwind v4, i18n en/ar with RTL). Imports
`@splendor/engine` for previews and talks to the backend over REST
(`NEXT_PUBLIC_API_URL`) plus Socket.IO for realtime. `next.config.ts` lists
`@splendor/engine` in `transpilePackages` for robust monorepo bundling.

Routes: `/` (lobby — local hotseat **and** online: create/join room, quick
match), `/room/[code]` (private lobby), `/game/[gameId]` (the board;
`?online=1` selects identity-authed, WebSocket-driven online play, otherwise
session-token hotseat). `useGame` serves both modes; online turns post through
the identity-authed REST pipeline while opponents' moves arrive via push.

## Data flow (a turn)
1. Client submits a `TurnCommand` (with `expectedTurn`) to `POST /games/:id/actions`.
2. `GamesService` loads the authoritative `GameState` from Postgres, checks the
   optimistic-concurrency tag (`expectedTurn === turnNumber`), and calls
   `applyTurn`.
3. On success it persists the new snapshot **and** appends the move to the
   append-only `Move` log in a single transaction, then returns the new state.
4. The client replaces its state with the response (`mutate → setState`).

## Why the engine is a compiled package (not shared source)
The backend runs compiled CommonJS (`node dist/main.js`); it cannot import raw
`.ts` at runtime. Publishing `dist` (JS + declarations) lets both a `tsc`-built
NestJS app and a Turbopack-bundled Next.js app consume the exact same artifact,
eliminating the former manual "sync the copy" hazard.

## Persistence
Games are durable: they survive an API restart (the previous in-memory store lost
everything on restart). Idle games are swept after `GAME_TTL_HOURS` (default 24h)
based on `Game.updatedAt`. See [DATA_MODEL.md](./DATA_MODEL.md).

## Roadmap
This document reflects **Phase 0** (monorepo foundations + persistence),
**Phase 1** (identity & accounts — see [AUTH.md](./AUTH.md)), **Phase 2**
(realtime core — WebSocket push, seat ownership, fog-of-war redaction — see
[REALTIME.md](./REALTIME.md)), and **Phase 3** (private rooms + public
quick-match, which also wires the online game board end-to-end — see
[ROOMS.md](./ROOMS.md) and [MATCHMAKING.md](./MATCHMAKING.md)). Later phases add
social features (Phase 4) and deployment — see the per-phase docs in this folder.
