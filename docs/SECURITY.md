# Security

Phase 5, Major Task 10. How Splendor defends its API, realtime layer, and game
integrity. The rules engine is server-authoritative and pure; everything here is
about controlling what reaches it and who may act.

## Threat model (summary)

| Threat | Mitigation |
| --- | --- |
| Cheating (act out of turn / on another seat / stale state) | Seat-ownership + turn + `expectedTurn` checks in `GamesService.act` (see [GAME_LOOP](GAME_LOOP.md) once written; enforced today in `games.service.ts`). |
| Information leak (deck order, opponents' blind reserves) | Per-viewer redaction (`redactStateFor`) on every REST/WS state payload. |
| Hostile payloads (extra fields, wrong types, oversized) | Strict validation on REST **and** WS (below). |
| Cross-origin hijack / CSRF | Env-driven CORS allow-list for HTTP and WS; refresh token in httpOnly, SameSite cookie. |
| Brute force / spam | Per-route REST throttling + per-socket token-bucket flood protection. |
| Token theft | Access token in memory (short TTL); refresh token hashed at rest, rotated, revocable (see [AUTH](AUTH.md)). |
| Secret leakage | No secrets in the repo; all via env; logs redact auth headers/cookies. |

## Input validation

**REST.** A single global `ValidationPipe` (`app.setup.ts → configureApp`) runs
with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Unknown
keys are not just stripped — a body that carries them is rejected `400`. Every
controller body is a `class-validator` DTO.

**WebSocket.** Socket messages go through `WsValidationPipe`
(`common/ws-validation.pipe.ts`), the same strict settings, applied per handler
(`@MessageBody(new WsValidationPipe())`) against a DTO (`SubscribeDto`,
`RoomSubscribeDto`). Failures surface as a structured `WsException`
(`{ code: "BAD_PAYLOAD" }`) delivered on the client's `exception` event, never a
stack trace. The Socket.IO server also caps frame size (`maxHttpBufferSize`
64 KiB in `CorsIoAdapter`).

Validation stays intentionally shallow on the game action itself — the engine is
the authority and re-validates every action shape (`INVALID_ACTION_SHAPE`),
which keeps a single source of truth for the rules.

## CORS

`common/cors.ts` is the one source of allowed origins, read from
`CORS_ORIGINS` (comma-separated). It is applied to HTTP (`enableCors`) and to
**every** Socket.IO namespace via `CorsIoAdapter` — replacing the previous
per-gateway `cb(null, true)` "reflect any origin" behaviour, which was a
hijack vector online. Node socket clients (tests/load) send no `Origin` and are
unaffected, exactly like browser-less HTTP.

## Rate limiting

**REST** — `@nestjs/throttler` global guard (300 req/min default), tightened per
route:

| Route(s) | Limit / min |
| --- | --- |
| `POST /auth/register` | 5 |
| `POST /auth/login` | 10 |
| `POST /auth/guest` | 30 |
| `POST /auth/refresh` | 60 |
| `POST /rooms`, `POST /matchmaking/queue` | 20 |
| `POST /rooms/:code/join` | 30 |
| friends / profiles mutations | 20–30 |
| `/health`, `/ready`, `/metrics` | exempt (`@SkipThrottle`) |

**WebSocket** — `WsRateLimitGuard` (`common/ws-rate-limit.guard.ts`) is a
per-socket token bucket stored on `socket.data` (GC'd with the socket, no global
map to leak). Each inbound message spends a token; an empty bucket yields a
`RATE_LIMITED` `WsException`. Tunable via `WS_RATE_BURST` /
`WS_RATE_REFILL_PER_SEC`.

## Transport & headers

- `helmet()` sets hardened response headers and removes `x-powered-by`. CSP is
  disabled deliberately: the API serves only JSON.
- Refresh cookie: `httpOnly`, `SameSite` (env), `Secure` in production, scoped
  path. See `auth.controller.ts`.
- Access tokens are short-lived and kept in memory on the client.

## Anti-cheat posture

Three guarantees, all server-side:

1. **Server-authoritative.** Clients never compute state; they submit intents
   and receive the engine's result.
2. **Fog of war.** `redactStateFor(state, seat)` strips deck contents/order and
   opponents' hidden reserved card ids before any payload leaves the server.
3. **Seat/turn enforcement.** An action is accepted only if the authenticated
   identity owns the current seat, it is that seat's turn, and `expectedTurn`
   matches `turnNumber` (optimistic concurrency). Otherwise `403`/`409`.

The malicious-payload suite (`test/security.e2e-spec.ts`) exercises these on
both transports.

## Secrets policy

No secrets in the repo. `JWT_ACCESS_SECRET` and `GUEST_TOKEN_SECRET` are
**required** in production (the app refuses insecure fallbacks when
`NODE_ENV=production`). CI uses throwaway test-only secrets. Logs redact
`authorization`, `cookie`, `x-guest-token`, `x-session-token`, and
`set-cookie`.

## Vulnerability scanning (CI)

`.github/workflows/ci.yml → security-scan`:

- `pnpm audit --prod --audit-level=high` — informational (does not block on
  unfixable transitive advisories).
- **Trivy** filesystem scan — hard gate on `CRITICAL` (ignore-unfixed).

Container **image** scanning is added with the Dockerfiles in Phase 6 (scan the
built backend/frontend images before deploy).

## Tests

- `src/common/__tests__/*` — WS validation pipe, rate-limit guard, CORS parsing.
- `src/observability/__tests__/all-exceptions.filter.test.ts` — error handling.
- `test/security.e2e-spec.ts` — REST field/type rejection, helmet headers, auth
  throttling (`429`), WS unauthorized disconnect, malformed-payload rejection,
  and socket flood limiting, against a real app + DB.
