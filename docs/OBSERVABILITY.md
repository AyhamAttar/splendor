# Observability

Phase 5, Major Task 11. Logging, metrics, error tracking, and health probes so a
turn can be traced end to end and the system's health is visible.

## Structured logging

`nestjs-pino` (config in `observability/logger.config.ts`, wired in
`app.module.ts`, installed as the app logger in `main.ts`).

- **JSON** log lines at `LOG_LEVEL` (default `info`).
- **Correlation id per request.** An inbound `x-request-id` is honoured
  (so a value set by a proxy or the frontend flows through); otherwise a UUID is
  minted and echoed on the response header. Every log line for that request
  carries the id — trace a turn from HTTP entry to DB write.
- **Redaction.** `authorization`, `cookie`, `x-guest-token`, `x-session-token`,
  and `set-cookie` are censored — tokens never reach logs.
- **Noise control.** `/health`, `/ready`, `/metrics` are excluded from auto
  request logging; 4xx log at `warn`, 5xx at `error`.
- **WS correlation.** Socket lifecycle/errors log through the same pino instance;
  the global exception filter tags WS errors with `scope: "ws"`.

To pretty-print locally, pipe through pino-pretty: `pnpm dev | npx pino-pretty`
(kept out of the app so production stays pure JSON).

## Metrics (Prometheus)

`prom-client` on a private registry (`metrics/metrics.service.ts`), exposed at
`GET /metrics`. Optionally protected with `METRICS_TOKEN`
(`Authorization: Bearer <token>`).

| Metric | Type | Meaning |
| --- | --- | --- |
| `splendor_active_games{online}` | gauge | Games in progress (`status=ACTIVE`), split local/online. Scrape-time DB count. |
| `splendor_connected_sockets` | gauge | Physically connected Socket.IO clients (all namespaces). |
| `splendor_matchmaking_queue_depth` | gauge | Players waiting in quick-match. |
| `splendor_turn_duration_seconds{online}` | histogram | Validate + apply + persist time per turn (excludes broadcast). |
| `splendor_turns_total{online}` | counter | Turns committed. |
| `splendor_errors_total{type,scope}` | counter | Server (5xx/unknown) errors, by class + `http`/`ws`. |
| `process_*`, `nodejs_*` | — | Default runtime metrics incl. `process_resident_memory_bytes`. |

**Design note.** "Current count" gauges read a source at scrape time via a
`collect()` callback; the owning module *registers* the source
(`registerQueueDepthSource`, `bindSocketServer`) so `MetricsService` never
depends on matchmaking/socket internals. Feature code depends on metrics, never
the reverse.

A ready-to-use scrape config lives in [`monitoring/prometheus.yml`](../monitoring/prometheus.yml).
Point Prometheus at `backend:4000/metrics`; a minimal Grafana dashboard tracks
turn-latency p95, active games, connected sockets, queue depth, and error rate.

## Error tracking (Sentry)

Entirely env-gated — no DSN, no reporting.

- **Backend** (`observability/sentry.ts`): `initSentry()` runs first in
  `main.ts`. The global `AllExceptionsFilter` reports *server* errors
  (5xx/unknown) to Sentry and increments `splendor_errors_total`, while leaving
  expected 4xx / thrown `WsException`s (normal flow) alone. Buffered events are
  flushed on shutdown (`LifecycleService`).
- **Frontend** (`frontend/src/lib/sentry.ts`): initialised from
  `instrumentation-client.ts` (before hydration). `@sentry/browser` installs
  global handlers; `app/global-error.tsx` reports React render errors. Uses
  `@sentry/browser` (not `@sentry/nextjs`) to avoid wrapping the Next 16 config.

Env: `SENTRY_DSN`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` (backend);
`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENV`, `NEXT_PUBLIC_SENTRY_RELEASE`
(frontend).

## Health & readiness

`@nestjs/terminus` (`health/health.controller.ts`), both exempt from throttling:

- `GET /health` — **liveness**. Process up, event loop responsive; touches no
  dependencies (a DB blip must not restart the pod).
- `GET /ready` — **readiness**. Pings PostgreSQL; returns `503` when the DB is
  unreachable so the load balancer stops routing until it recovers.

## Graceful shutdown

`app.enableShutdownHooks()` wires SIGTERM/SIGINT to Nest's shutdown:

1. `GameGateway.onApplicationShutdown` emits `server:shutdown` to clients and
   disconnects sockets (drain) so they show a reconnecting state.
2. Nest closes the HTTP + Socket.IO servers; in-flight turns finish because the
   DB write is awaited before the response.
3. `PrismaService.onModuleDestroy` releases the pool.
4. `LifecycleService.onApplicationShutdown` flushes Sentry.

See [RUNBOOK](RUNBOOK.md) for operational procedures and alert suggestions.
