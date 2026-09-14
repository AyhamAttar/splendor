# Splendor Backend

NestJS 11 API for the hotseat **Splendor** web game. This project is fully
self-contained: it owns the **authoritative rules engine** and can be
developed, tested, and deployed independently of the frontend.

- **Engine** (`src/engine`) — pure, framework-free TypeScript rules engine
  (`createGame`, `applyTurn`), the canonical 90-card / 10-noble dataset, and
  the full unit + fuzz test suite. This is the **source of truth**: the
  frontend project keeps a mirror copy (minus tests) for client-side previews —
  if you change rules or data here, sync the same change there.
- **API** (`src/games`) — in-memory game store with a 24h TTL sweep, guest
  session tokens (no accounts), strict DTO validation, and engine errors mapped
  to meaningful HTTP statuses.

## Prerequisites

- Node 20+ (developed on Node 22)
- pnpm 11 (`corepack enable` will provide it)

## Install & run

```bash
pnpm install
pnpm dev        # nest start --watch → http://localhost:4000
```

The port defaults to **4000**; override with the `PORT` environment variable.
CORS is configured for the frontend at `http://localhost:3000` /
`http://127.0.0.1:3000` (see `src/main.ts`).

## REST API

All game-mutating routes authenticate with the `x-session-token` header
returned on game creation.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/games` | Create a game (`{ "playerNames": ["Ana", "Ben"] }`) → `gameId`, `sessionToken`, initial state |
| `GET` | `/games/:gameId` | Fetch current game state |
| `POST` | `/games/:gameId/actions` | Submit a turn (take gems / reserve / purchase …) |
| `GET` | `/resume/:token` | Resume a session by token (browser refresh) |
| `DELETE` | `/games/:gameId` | End a game |

Error contract: `400` invalid payload, `403` bad/missing session token, `404`
unknown game, `409` stale turn (concurrency), `422` illegal move (with
engine-specific detail fields such as `mustReturn`, `eligible`, `shortfall`).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | `nest start --watch` |
| `pnpm build` | Compile to `dist/` (engine tests excluded) |
| `pnpm start` | Run the compiled API (`dist/main.js`) |
| `pnpm test` | Engine unit + fuzz test suite (Jest) |
| `pnpm test:e2e` | End-to-end API tests (supertest) |

## Testing

- **Engine** (`pnpm test`): setup invariants, the dataset distribution lock,
  every action and rule (take / reserve / purchase / gold payment / 10-token
  limit / nobles / endgame + tie-break / pass gating), and a seeded
  random-playout fuzz that asserts token & card conservation and termination
  across 2–4 players.
- **API** (`pnpm test:e2e`): boots the real app and plays a full scripted game
  over HTTP, plus auth (403), existence (404), stale-turn concurrency (409),
  illegal move (422), and payload validation (400) paths.

## Notes / decisions

- **In-memory state**: games live in a `Map` in the API process and are evicted
  after 24h idle. Restarting the API clears all games (by design — no DB).
- **NestJS 11 (not 12)**: Nest 12's packages ship ESM, which breaks the
  CommonJS Jest/ts-jest e2e runner and the CLI on Node 22.
- **TypeScript pinned to 5.x**: `typescript@latest` is 7.x, which the Nest and
  ts-jest toolchains don't yet support.
