# Deploying the Splendor backend

The backend is a **persistent realtime server** (Socket.IO gateways, in-memory
matchmaking/presence, background sweepers). It **cannot** run on Vercel /
serverless functions — deploy it to a platform that runs a long-lived Node
process with WebSocket support: **Railway**, **Render**, or **Fly.io**. The
frontend stays on Vercel and talks to this server over HTTPS/WSS.

> ⚠️ Run a **single instance**. Matchmaking and presence are in-memory, so
> horizontal scaling would split state across instances. (A Redis adapter is
> the documented Phase 7 upgrade before scaling out.)

## 1. Provision PostgreSQL

Create a managed Postgres (Railway/Render both offer one in the same project).
Copy its connection string into `DATABASE_URL`.

## 2. Set environment variables

Required in production (the app refuses insecure fallbacks):

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the managed Postgres URL |
| `JWT_ACCESS_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `GUEST_TOKEN_SECRET` | a *different* value from the same command |
| `CORS_ORIGINS` | your frontend origin, e.g. `https://splendor.vercel.app` (comma-separated for several) |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `none` — required: the frontend (vercel.app) and API (railway/render/fly) are different sites, so the refresh cookie must be SameSite=None + Secure |

`PORT` is injected by the platform; the app falls back to `4000`. All other keys
in [`.env.example`](.env.example) are optional and have sane defaults.

## 3. Deploy

The repo-root [`Dockerfile`](../Dockerfile) builds `@splendor/engine`, generates
the Prisma client, compiles the backend, then on start runs
`prisma migrate deploy` before `node dist/main.js`.

- **Railway / Render** — point the service at the repo, let it auto-detect the
  root `Dockerfile` (build context = repo root). Add the Postgres plugin and the
  env vars above. Health check path: `/health`.
- **Fly.io** — `fly launch` (uses the root `Dockerfile`), set `internal_port =
  4000` in `fly.toml`, `fly secrets set` the vars above, attach Postgres.

Without Docker you can instead use native build/start commands (verified):
- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm --filter @splendor/backend build`
- Start: `pnpm --filter @splendor/backend start:prod`

## 4. Point the frontend at the backend (on Vercel)

Set on the Vercel **frontend** project and redeploy:

```
NEXT_PUBLIC_API_URL = https://<your-backend-host>
```

This one variable drives both REST and the Socket.IO connection
(`frontend/src/lib/{api,auth,realtime}.ts`). Then add that backend host's
frontend origin to `CORS_ORIGINS` above so browsers are allowed through.

> The old root `vercel.json` routed `/api/backend` to a Vercel "service" — that
> approach is dead now that the backend lives elsewhere. The frontend calls
> `NEXT_PUBLIC_API_URL` directly, so that rewrite is unused and can be removed.
