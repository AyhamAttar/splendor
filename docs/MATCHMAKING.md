# Public Quick-Match — Phase 3

Quick-match lets a player click one button and get dropped into an online game
with strangers. It reuses the same online-game machinery as private rooms
(identity-owned seats, fog-of-war redaction, WebSocket push) — it only adds a
queue in front of game creation.

## Flow

1. Client `POST /matchmaking/queue` with a display name → enters the queue.
2. Client polls `GET /matchmaking/status` (~every 1.5s).
3. A server-side tick groups waiting players and creates an online game via
   `GamesService.createOnline`, stamping each grouped entry with the `gameId`.
4. The next `status` poll returns `{ status: "matched", gameId }`; the client
   navigates to `/game/:id?online=1`. `DELETE /matchmaking/queue` cancels.

Matchmaking results are **pull-based (polling), not socket-pushed** — simple and
robust for a single-host queue, and it sidesteps reconnect/identity edge cases
on a transient searching socket. Rooms use sockets (live lobby is their whole
point); the quick-match queue does not.

## Queue algorithm

A periodic tick (every ~1s) processes the queue, oldest-waiting first:

- **Instant match:** whenever ≥ `MATCH_TARGET` players are waiting (default 4),
  form a full game immediately.
- **Timeout match:** otherwise, once the oldest waiter has waited
  `MATCH_WAIT_MS` (default 12s) and ≥2 players are waiting, form a smaller
  (2–3 player) game with everyone currently waiting (capped at the target).
- A lone waiter keeps waiting.

```
waiting (oldest→newest), now:
  remaining ≥ target            → take `target`           (instant)
  remaining ≥ 2 and waited ≥ W  → take min(target, remaining)  (timeout)
  else                          → stop (wait for more)
```

One identity = one queue entry (keyed `user:<id>` / `guest:<id>`); re-joining is
idempotent and preserves queue position. Ticks are guarded against re-entrancy
so a slow `createOnline` can't double-process the queue.

### Match consumption & cleanup

A matched entry keeps its `gameId` until the client reads it via `status`
(consume-on-read: the entry is removed on that poll). As a safety net, matched
entries a client never returns for are pruned after `MATCHED_TTL` (60s).

## Configuration

| Env | Default | Meaning |
|-----|---------|---------|
| `MATCH_TARGET` | `4` | group size that matches instantly |
| `MATCH_WAIT_MS` | `12000` | wait before forming a 2–3 player game |

(Fixed in code: `MIN_PLAYERS = 2`, tick `1000ms`, matched TTL `60000ms`.)

## REST surface

Under `GuestOrUserGuard`; identity-scoped.

| Method & path | Body | Result |
|---------------|------|--------|
| `POST /matchmaking/queue` | `{ name }` | `QueueStatus` (200) |
| `DELETE /matchmaking/queue` | — | 204 |
| `GET /matchmaking/status` | — | `QueueStatus` |

`QueueStatus` = `{ status: "idle" }` · `{ status: "searching", size, target }` ·
`{ status: "matched", gameId }`. Join is rate-limited (20/min); status is looser
(120/min) since searching clients poll it.

## Scale-out note

The queue lives behind an abstract `MatchmakingQueue` DI token with an
in-memory implementation (`InMemoryMatchmakingQueue`). For multi-instance
deployment (deferred — see PLAN "Horizontal scale-out"), a Redis-backed
implementation can replace it without touching `MatchmakingService`, so a single
tick (or a distributed lock) drains one shared queue across instances. Optional
bot backfill to fill a slow queue is documented but **not built**.

## Frontend

- `lib/matchmaking.ts` — `matchmakingApi` (join / leave / status).
- `hooks/useQuickMatch.ts` — join + poll loop; exposes `find/cancel` and
  `phase` (`idle | searching | matched`), navigating on match.
- Lobby (`app/page.tsx`) — "Quick match" button + a searching overlay with a
  live waiting count and cancel. Copy in `online.match.*` (en + ar).
