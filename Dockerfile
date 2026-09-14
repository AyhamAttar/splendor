# Production image for the Splendor NestJS backend (@splendor/backend).
#
# This backend is a *persistent* realtime server — Socket.IO gateways, in-memory
# matchmaking/presence, and background sweepers — so it must run as a long-lived
# process, NOT on a serverless/functions platform. Build context is the repo
# ROOT (the pnpm workspace) so the `@splendor/engine` workspace dependency and
# the Prisma client resolve exactly as they do locally.
#
#   docker build -t splendor-backend .
#   docker run -p 4000:4000 --env-file backend/.env splendor-backend
#
# Works as-is on Railway / Render (auto-detect this Dockerfile) and Fly.io
# (`fly launch`). Set the environment variables listed in backend/DEPLOY.md.

FROM node:20-bookworm-slim

# Prisma's query engine needs OpenSSL at build (generate) and run time.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH="/pnpm:$PATH"
RUN corepack enable
# NOTE: NODE_ENV is deliberately left unset until after the build — setting it to
# "production" would make `pnpm install` skip the devDependencies (typescript, the
# prisma CLI) that the build needs. It is set for runtime just before CMD below.

WORKDIR /repo

# 1) Install with the full workspace graph. Copy every workspace manifest first
#    so `--frozen-lockfile` can validate the lockfile and Docker can cache the
#    install layer across source-only changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/engine/package.json packages/engine/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# `pnpm install` runs allow-listed build scripts (prisma, @prisma/*) via the
# allowBuilds entries in pnpm-workspace.yaml — no interactive approval prompt.
RUN pnpm install --frozen-lockfile

# 2) Copy the sources the backend build needs (engine + backend only; the
#    frontend is deployed separately on Vercel).
COPY packages/engine packages/engine
COPY backend backend

# 3) Build: compiles @splendor/engine, generates the Prisma client, then tsc.
#    (See the backend `build` script — it chains all three.)
RUN pnpm --filter @splendor/backend build

WORKDIR /repo/backend

# Runtime env: production turns on the app's security requirements (JWT/guest
# secrets become mandatory). devDependencies stay installed so the `prisma` CLI
# is available for `prisma migrate deploy` on start.
ENV NODE_ENV=production

# The app reads PORT (defaults to 4000); platforms inject their own PORT.
EXPOSE 4000

# Apply pending migrations, then start the server. `prisma` (a devDependency) is
# present because this single-stage image keeps the full install.
CMD ["pnpm", "run", "start:prod"]
