# Runbook

Operational procedures for running Splendor in production. Pairs with
[OBSERVABILITY](OBSERVABILITY.md) (what to watch) and [SECURITY](SECURITY.md)
(how it's defended). Deployment specifics land in `docs/DEPLOYMENT.md` (Phase 6).

## Endpoints at a glance

| Endpoint | Purpose | Expected |
| --- | --- | --- |
| `GET /health` | Liveness probe | `200 {status:"ok"}` always while the process runs |
| `GET /ready` | Readiness probe (DB) | `200` when DB reachable, `503` otherwise |
| `GET /metrics` | Prometheus scrape | `200` text/plain (bearer if `METRICS_TOKEN` set) |

Wire the orchestrator's **liveness** probe to `/health` and **readiness** to
`/ready`. Never point liveness at `/ready` — a DB blip would restart-loop pods.

## Key signals & suggested alerts

| Signal (PromQL) | Meaning | Suggested alert |
| --- | --- | --- |
| `histogram_quantile(0.95, sum(rate(splendor_turn_duration_seconds_bucket[5m])) by (le))` | Turn latency p95 | > 200 ms for 10 m |
| `rate(splendor_errors_total[5m])` | Server error rate | > 0 sustained for 5 m |
| `splendor_connected_sockets` | Live players | Drops to 0 unexpectedly |
| `splendor_active_games` | Games in progress | Baseline / capacity tracking |
| `splendor_matchmaking_queue_depth` | Quick-match backlog | High + not draining |
| `process_resident_memory_bytes` | Memory | Sustained climb (leak) |
| `up{job="splendor-backend"}` | Scrape health | `== 0` for 2 m |

## Common procedures

### Deploy / restart (graceful)
Send `SIGTERM` (orchestrators do this on rollout). The app drains sockets
(clients get `server:shutdown` and reconnect), finishes in-flight turns
(the DB write is awaited), closes the DB pool, and flushes Sentry. Give it a
termination grace period of ≥ 10 s. See [OBSERVABILITY §Graceful shutdown].

### Apply DB migrations
`pnpm --filter @splendor/backend prisma:deploy` (run as a release step before the
new version serves traffic). This is idempotent and safe to re-run.

### "Readiness is failing (503)"
1. `GET /ready` → check `info.database`.
2. Verify PostgreSQL is up and `DATABASE_URL` is correct/reachable.
3. Check DB connection limits; inspect logs (filter by the failing request's
   `x-request-id`).
The LB will resume routing automatically once `/ready` returns `200`.

### "Turn latency is high"
1. Confirm via the p95 query above; check `splendor_turns_total` rate for load.
2. Correlate with `process_resident_memory_bytes` / CPU and DB latency.
3. Inspect slow turns in logs by `x-request-id`.
4. Load-test to reproduce (`test/load/k6-turns.js`, see [TESTING](TESTING.md)).

### "Error rate spiking"
1. `splendor_errors_total{type,scope}` shows the exception class and whether it's
   `http` or `ws`.
2. Open Sentry (if `SENTRY_DSN` set) for stack traces grouped by release.
3. Grep logs by `x-request-id` / correlation for the full request trail.

### "A player is stuck / a game is wedged"
Games are server-authoritative; a client can't corrupt state. If a seat won't
advance, verify it's that seat's turn and `expectedTurn` matches. Idle games are
swept after `GAME_TTL_HOURS`; idle rooms after `ROOM_TTL_HOURS`.

### Abuse / spike
REST throttling and per-socket flood limits absorb most abuse (see SECURITY).
To tighten transiently, lower `WS_RATE_BURST`/`WS_RATE_REFILL_PER_SEC` and the
throttler limits, then redeploy. Confirm `CORS_ORIGINS` lists only your
front-ends.

## Configuration checklist (production)

- [ ] `JWT_ACCESS_SECRET`, `GUEST_TOKEN_SECRET` set to strong random values.
- [ ] `DATABASE_URL` points at production PostgreSQL.
- [ ] `CORS_ORIGINS` lists exactly the production front-end origin(s).
- [ ] `COOKIE_SECURE=true`, `COOKIE_SAMESITE` appropriate for your domains.
- [ ] `METRICS_TOKEN` set (and the metrics port firewalled).
- [ ] `SENTRY_DSN` set (backend + `NEXT_PUBLIC_SENTRY_DSN` frontend), `LOG_LEVEL=info`.
- [ ] Liveness → `/health`, readiness → `/ready`; termination grace ≥ 10 s.
