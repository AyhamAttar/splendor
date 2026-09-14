# Splendor Frontend

Next.js 16 (App Router) + Tailwind v4 client for the hotseat **Splendor** web
game — a pure-CSS themed board (navy / ornate gold / parchment, six gem
colors), no image assets. This project is fully self-contained and talks to
the sibling `backend` project over REST.

- **Engine mirror** (`src/engine`) — a copy of the backend's rules engine
  (minus tests) used for client-side previews and affordances: cost previews,
  auto-payment, affordability checks, noble eligibility — all without a server
  round-trip. The **authoritative** engine lives in the backend project at
  `backend/src/engine`; if rules or card data change there, sync the same
  change here. The server always has the final say, so a drifted mirror can
  only mis-preview, never corrupt a game.
- **UI** (`src/app`, `src/components`, `src/hooks`, `src/lib`) — board screen,
  dialogs for forced choices (token returns, noble picks, game over), a log
  feed, and a small typed API client with guest session persistence.

## Prerequisites

- Node 20+ (developed on Node 22)
- pnpm 11 (`corepack enable` will provide it)
- The backend API running (defaults to `http://localhost:4000`)

## Install & run

```bash
pnpm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if not localhost:4000
pnpm dev                     # → http://localhost:3000
```

## Scripts

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | Next.js dev server on :3000           |
| `pnpm build`        | Production build (full typecheck)     |
| `pnpm start`        | Serve the production build on :3000   |
| `pnpm typecheck`    | Type-check without emitting           |
| `pnpm lint`         | ESLint (flat config, next + prettier) |
| `pnpm format`       | Format with Prettier                  |
| `pnpm format:check` | Check formatting without writing      |

## How to play

1. Open http://localhost:3000, enter 2–4 nicknames (the first one starts), and
   press **Start game**. A session token is saved in your browser so a refresh
   resumes the same game.
2. On your turn, take exactly one action:
   - **Take gems** — click bank gems to select (up to 3 different, or click a
     gem twice to take 2 of one color when its pile has ≥ 4), then **Take gems**.
   - **Buy / Reserve** — click a market card for its popover. Reserving gains a
     gold joker (max 3 reserved). Blind-reserve by clicking a deck pile.
   - **Buy a reserved card** — from your own panel.
3. If a turn leaves you over 10 tokens, or more than one noble qualifies, a
   dialog guides the required choice. Nobles otherwise visit automatically.
4. First to 15 prestige triggers a final round; highest prestige then wins
   (ties broken by fewest cards).

## Notes / decisions

- **Display font**: a system serif stack (Georgia) is used for headings so
  there is no build-time or runtime font dependency.
- **TypeScript pinned to 5.x**: `typescript@latest` is 7.x, which parts of the
  toolchain don't yet support.
