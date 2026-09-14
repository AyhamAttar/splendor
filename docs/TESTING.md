# Testing

Phase 5, Major Task 12. The test pyramid, how to run each layer, and the
load-test targets.

## Test pyramid

```
        ▲  few, slow, high-value
        │   Load     backend/test/load/k6-turns.js   (turn latency under load)
        │   E2E      backend/test/*.e2e-spec.ts       (real app + real Postgres)
        │   Unit     src/**/__tests__/*.test.ts       (pure / mocked, no DB)
        │   Engine   packages/engine  (70 rules + fuzz tests, deterministic)
        ▼  many, fast
```

- **Engine** — the rules are the crown jewels; they're pure and deterministic,
  so they carry the deepest coverage (unit + fuzz) in `@splendor/engine`.
- **Unit (backend)** — cross-cutting logic that needs no database: the WS
  validation pipe, the per-socket rate-limit guard, CORS parsing, the metrics
  service, the global exception filter, the in-memory matchmaking queue.
- **E2E** — the DB-backed contract: full games over REST + WebSocket, seat/turn
  auth, redaction, rooms, and the Phase 5 security/observability hardening.
- **Load** — turn latency under concurrency.

## Running the layers

```bash
# Engine (fast, no deps)
pnpm --filter @splendor/engine test

# Backend unit tests
pnpm --filter @splendor/backend test

# Backend unit tests with coverage (enforces thresholds)
pnpm --filter @splendor/backend test:cov

# Backend E2E — needs Postgres + a migrated DB
docker compose up -d postgres
pnpm --filter @splendor/backend prisma:deploy
pnpm --filter @splendor/backend test:e2e

# Everything unit-level across the workspace
pnpm -r test
```

## Coverage thresholds

`backend/jest.config.js` enforces coverage over the pure/mockable units this
suite targets (security guards & pipes, metrics, the exception filter, the queue):
statements ≥ 85, lines ≥ 85, functions ≥ 80, branches ≥ 70. DB-heavy services are
excluded here on purpose — their contract is verified end-to-end — so the number
stays honest instead of averaging in files the unit suite can't exercise.

## E2E suites

| File | Covers |
| --- | --- |
| `game-flow.e2e-spec.ts` | Hotseat: create/resume, a full scripted game, auth/concurrency/rules errors. |
| `online-game.e2e-spec.ts` | Online: seat/turn authorization, redaction, WebSocket push, hotseat regression. |
| `rooms.e2e-spec.ts` | Private rooms / lobby flow. |
| `security.e2e-spec.ts` | **Phase 5:** REST field/type rejection, helmet headers, health/ready/metrics, auth throttling (429), WS unauthorized disconnect, malformed-payload rejection, socket flood limiting. |

E2E apps are configured through `src/app.setup.ts → configureApp`, the same
helmet/validation/CORS/WS-adapter setup `main.ts` uses — so tests exercise the
real production hardening with no drift.

## Load testing

`test/load/k6-turns.js` drives the server-authoritative turn path (the same
validate → apply → persist critical path the WS loop commits, and where
`splendor_turn_duration_seconds` is recorded). N virtual users ≈ N concurrent
games.

```bash
# Start the stack first (backend + Postgres), then:
k6 run -e BASE_URL=http://localhost:4000 -e VUS=50 -e DURATION=1m \
  backend/test/load/k6-turns.js
```

**Targets (single-host spec — tune once measured):**

| Metric | Budget |
| --- | --- |
| `turn_latency_ms` p95 | < 200 ms |
| `turn_errors` rate | < 5% |
| `http_req_failed` rate | < 5% |

Watch memory during the run via `GET /metrics`
(`process_resident_memory_bytes`) or `docker stats`. For a WebSocket-native
scenario (connect/subscribe fan-out), extend with Artillery's socket.io engine;
the k6 script above is the primary latency gate because it targets the turn path
directly.

## CI

`.github/workflows/ci.yml` runs on every push/PR to `main`:

1. **build-test** — spins up a Postgres service, installs, generates Prisma
   client, builds (engine → backend → frontend), typechecks, runs engine +
   backend unit tests (with coverage), applies migrations, runs the E2E suite.
2. **security-scan** — `pnpm audit` (informational) + Trivy filesystem scan
   (gates on `CRITICAL`).

Lint runs but is currently non-blocking (pre-existing React-hooks findings in the
game UI, tracked separately). Container image scanning joins CI with the
Dockerfiles in Phase 6.
