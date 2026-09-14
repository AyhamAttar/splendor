# Realtime Multiplayer — Phase 2

Phase 2 adds the realtime core that enables networked play across devices. It
builds on the identity layer (Phase 1) and forms the foundation that the lobby
and matchmaking layer (Phase 3) connects to.

## Design decisions

### REST actions + WebSocket push

Turn submission stays on the validated REST pipeline (`POST /games/:id/actions`).
After each committed turn the **GameGateway** broadcasts the updated state to every
socket subscribed to that game room. This approach:

- Reuses existing DTO validation, throttling, engine-error mapping, and
  optimistic-concurrency checks with zero duplication.
- Keeps authentication simple: HTTP headers carry access/guest tokens and are
  handled by `OptionalIdentityGuard` (no WS re-validation of action payloads).
- Makes the REST API independently testable without a live WebSocket context.

### `online` flag gates all new behaviour

A `Game.online boolean` column (default `false`) gates every Phase 2 behaviour —
seat ownership checks, redaction, and WS push. Legacy hotseat games
(`online = false`) behave byte-for-byte as before Phase 2. The flag will be set
to `true` by the Phase 3 room/lobby flow; in Phase 2 it is set directly in
fixtures and e2e tests.

## Authorization

| Route | Guard | Online game | Hotseat game |
|-------|-------|-------------|--------------|
| `GET /games/:id` | `OptionalIdentityGuard` | Caller's `userId`/`guestId` resolved via `GamePlayer`; spectator if none | `x-session-token` |
| `POST /games/:id/actions` | `OptionalIdentityGuard` | Identity must own `currentPlayer` seat | `x-session-token` |
| `DELETE /games/:id` | `OptionalIdentityGuard` | Seat-0 owner (host) only | `x-session-token` |
| WS `subscribe` | Gateway (handshake) | Identity must be a participant | N/A |

`OptionalIdentityGuard` (`backend/src/auth/guards/optional-identity.guard.ts`)
never throws — it silently skips if no valid token is presented, leaving
`req.identity` unset. This lets hotseat routes continue to accept anonymous
callers with only the legacy session token.

## Fog-of-war redaction

`redactStateFor(state, viewerSeat)` in `packages/engine/src/redaction.ts` produces
a `RedactedGameState` from the authoritative full `GameState`:

| Field | Authoritative | Redacted |
|-------|--------------|---------|
| `decks` | `Record<Level, number[]>` ordered draw piles | Removed |
| `deckCounts` | — | `Record<Level, number>` remaining counts |
| `players[i].reserved` where `i ≠ viewerSeat` and `hidden: true` | `{ cardId: number, hidden: true }` | `{ cardId: null, hidden: true }` |
| `log` reserve events for another seat with a `cardId` | carries the real id | `cardId` stripped |
| Everything else | unchanged | unchanged |

`viewerSeat = null` (spectator) hides all blind reserves. The function is
exported from `@splendor/engine` and consumed by both the REST responses
and the WebSocket push.

## WebSocket protocol

**Connection:** The client connects with identity credentials in the Socket.IO
handshake `auth` object (`{ accessToken? }` or `{ guestToken? }`). The gateway
disconnects unauthenticated sockets immediately.

**Subscribe:** After connecting the client emits `subscribe` with `{ gameId }`.
The gateway:
1. Verifies the game is `online`.
2. Resolves the caller's seat (or `null` for a spectator).
3. Joins the socket to the room `game:{gameId}`.
4. Emits `state` (redacted for this seat) back to the subscriber.
5. Emits `presence` to the room.

**State push:** When `GamesService.act` commits a turn for an online game it
calls `GameGateway.broadcast(gameId, newState)`. The gateway iterates every
socket in the room and emits `state` redacted for that socket's individual seat.

**Presence:** The gateway emits `presence: { connectedSeats: (number|null)[] }`
to the room on each subscribe and disconnect.

**Reconnection:** Socket.IO's built-in reconnection is sufficient; the client
re-emits `subscribe` on `connect` and receives a fresh snapshot.

## Frontend API

`frontend/src/lib/realtime.ts` — `connectGame(gameId, creds, callbacks)`:
```ts
const handle = connectGame(gameId, { guestToken }, {
  onState: (s: RedactedGameState) => { /* replace local state */ },
  onPresence: ({ connectedSeats }) => { /* update UI */ },
});
// cleanup:
handle.disconnect();
```

`frontend/src/hooks/useGameSocket.ts` — `useGameSocket(gameId)`:
Returns `{ state, connectedSeats, status }`. Mounts a single connection for the
component lifetime; use alongside `useGame` for REST-based turn submission.

## Phase 3 boundary — now delivered

Phase 2 built and tested the realtime machinery; **Phase 3 makes it reachable**:

- Online games are created with seats pre-mapped to identities by
  `GamesService.createOnline`, called from the room-start and quick-match flows
  (the public `POST /games` still creates `online: false` hotseat games).
- The lobby, private rooms (`LobbyGateway`), and quick-match queue provide the
  join/find/enter UI. See [ROOMS.md](./ROOMS.md) and
  [MATCHMAKING.md](./MATCHMAKING.md).
- The frontend game board plays online end-to-end: `GET /games/:id` and
  `POST /games/:id/actions` also return the caller's `seat`; the client submits
  turns via the identity-authed REST pipeline and receives opponents' moves over
  the Phase 2 push. Because the client holds only a redacted state (no deck
  order), it submits actions straight to the server rather than previewing them
  locally, and `canPass` reads `deckCounts` so it works on a redacted state.

The two gateways (`GameGateway`, `LobbyGateway`) share the default Socket.IO
server and a single `SocketIdentityService` for handshake auth.
