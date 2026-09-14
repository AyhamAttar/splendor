# Contributing / Developer Guide

Splendor is a **pnpm workspace** (see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)).
Node ≥ 20 (developed on 22) and pnpm 11.5.0 (`packageManager` is pinned).

## First-time setup

```bash
pnpm install                      # installs all workspace packages
pnpm engine:build                 # build @splendor/engine (apps depend on its dist)

# Start PostgreSQL (Docker Desktop must be running)
docker compose up -d

# Backend env + database
cp backend/.env.example backend/.env
pnpm --filter @splendor/backend prisma:generate   # generate Prisma client
pnpm --filter @splendor/backend prisma:migrate     # create/apply the dev migration
```

> **Auth secrets:** the copied `.env` ships placeholder `JWT_ACCESS_SECRET` /
> `GUEST_TOKEN_SECRET`. In development the app falls back to deterministic dev
> secrets if they're unset, but generate real ones for anything shared:
> `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
> They are **required** in production (`NODE_ENV=production`). See
> [docs/AUTH.md](./docs/AUTH.md).

## Running the apps (two terminals)

```bash
pnpm dev:backend     # NestJS API on http://localhost:4000
pnpm dev:frontend    # Next.js on http://localhost:3000
```

> The apps import `@splendor/engine` from its built `dist`. If you change engine
> code, rebuild it (`pnpm engine:build`) so the apps pick up the change. (A
> `tsc -w` watch can be added later for smoother DX.)

## Root scripts

| Command | Does |
|---------|------|
| `pnpm build` | Build every package in dependency order (engine → apps). |
| `pnpm typecheck` | Typecheck every package. |
| `pnpm test` | Run tests where present (engine unit suite today). |
| `pnpm lint` | Lint packages that define a lint script (frontend today). |
| `pnpm engine:build` | Build just `@splendor/engine`. |

Target a single package with `pnpm --filter <name> <script>`, e.g.
`pnpm --filter @splendor/engine test`.

## Changing game rules
All rules/data live in **`packages/engine`** — there is no copy to sync. Update
the code, add/adjust tests in `packages/engine/src/__tests__`, run
`pnpm --filter @splendor/engine test`, then `pnpm engine:build` so the apps see it.

## Changing the database schema
Edit `backend/prisma/schema.prisma`, then:
```bash
pnpm --filter @splendor/backend prisma:migrate   # creates a migration + regenerates client
```
See [docs/DATA_MODEL.md](./docs/DATA_MODEL.md).

## Tests
- **Engine unit tests** (no DB): `pnpm --filter @splendor/engine test`.
- **Backend e2e** (needs a running DB): `pnpm --filter @splendor/backend test:e2e`.

## Conventions
- TypeScript strict everywhere; Prettier + ESLint (frontend). Match the
  surrounding style.
- The engine stays pure (no I/O, no framework imports).
- Keep user-facing strings in both `en` and `ar` message files (frontend i18n).
