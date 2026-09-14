# Private Rooms & Lobby — Phase 3

Phase 3 turns the `Room` stub into a full private lobby: a host creates a room,
friends join by invite code, everyone readies up, and the host starts — which
spins up an **online** `Game` (see [REALTIME.md](./REALTIME.md) and
[GAME_LOOP.md](./GAME_LOOP.md)) with seats pre-mapped to the members'
identities and routes everyone to the board.

## Identity, not session tokens

Every room action is authorized by **identity** (a registered user *or* a
durable guest — see [AUTH.md](./AUTH.md)) via `GuestOrUserGuard`. The legacy
per-game `x-session-token` is only for local hotseat play and is never used for
rooms or online games. A guest can host and join rooms exactly like an account.

## Data model

Two tables (see [DATA_MODEL.md](./DATA_MODEL.md)):

- **`Room`** — `code` (unique invite code), `status`, `maxPlayers` (2–4),
  `hostUserId`/`hostGuestId` (exactly one, for a cheap host check), and
  `gameId` (set on start).
- **`RoomMember`** — one row per seat: `seatIndex` (host = 0), `name`,
  `userId`/`guestId`, `ready`, `isHost`. `@@unique([roomId, seatIndex])`
  guarantees no two members hold the same seat.

## Room lifecycle

```
           create                 start (host)
   ∅  ───────────────▶  WAITING ───────────────▶  IN_GAME
                          │  ▲                        │
                    join/ │  │ leave/kick             │ (game plays out)
                 ready/seats │                        ▼
                          └──┘                     (room swept)
        last member leaves → room deleted (CLOSED broadcast)
```

- **WAITING** — accepting players; members join/leave, toggle ready, and the
  host adjusts the seat count.
- **IN_GAME** — the host has started; `gameId` is set and every member is routed
  to `/game/{id}?online=1`. No longer joinable.
- **CLOSED** — emptied; the room row is deleted. A `status: "closed"` snapshot
  is broadcast so any lingering client returns to the lobby.

Idle rooms are swept after `ROOM_TTL_HOURS` (default 6h) by `RoomSweeper`,
mirroring the game sweeper.

## Invite codes

6 characters from an unambiguous uppercase alphabet
(`ABCDEFGHJKMNPQRSTUVWXYZ23456789` — no `0/O/1/I/L`), re-rolled until unique.
Codes are normalised to uppercase on every lookup, so links and typed codes are
case-insensitive. The shareable link is simply `/<frontend>/room/<CODE>`.

## Host permissions

| Action | Who | Notes |
|--------|-----|-------|
| Create room | any identity | becomes host at seat 0, ready by default |
| Join | any identity | lowest free seat; idempotent if already in |
| Leave | any member | host leaving promotes the earliest remaining seat |
| Toggle ready | non-host members | the host is implicitly ready |
| Set seat count (2–4) | host only | cannot drop below current member count |
| Kick | host only | cannot kick the host |
| Start | host only | needs ≥2 members and all non-hosts ready |

Violations return a typed error (`{ code, message }`): `NOT_HOST` (403),
`ROOM_FULL` / `ROOM_NOT_JOINABLE` / `PLAYERS_NOT_READY` / `NOT_ENOUGH_PLAYERS`
(409), `INVALID_SEAT_COUNT` (400), `ROOM_NOT_FOUND` / `MEMBER_NOT_FOUND` (404).

## Join flow

1. **From the lobby** — the player enters a code; the client calls
   `POST /rooms/:code/join` (with their display name) then navigates to
   `/room/:code`.
2. **From a shared link** — opening `/room/:code` directly finds no membership
   (`GET /rooms/:code` → 403), so the room page shows a name prompt that joins
   before rendering the lobby.

## REST surface

All under `GuestOrUserGuard`; bodies validated by class-validator DTOs.

| Method & path | Body | Result |
|---------------|------|--------|
| `POST /rooms` | `{ name }` | `RoomViewForCaller` (201) |
| `POST /rooms/:code/join` | `{ name }` | `RoomViewForCaller` |
| `GET /rooms/:code` | — | `RoomViewForCaller` |
| `POST /rooms/:code/leave` | — | 204 |
| `POST /rooms/:code/ready` | `{ ready }` | `RoomViewForCaller` |
| `POST /rooms/:code/seats` | `{ maxPlayers }` | `RoomViewForCaller` |
| `POST /rooms/:code/kick` | `{ memberId }` | `RoomViewForCaller` |
| `POST /rooms/:code/start` | — | `{ gameId }` |

`POST /rooms` and `/join` are rate-limited (20 and 30 / min).

## Realtime (LobbyGateway)

Room **mutations go through the validated REST pipeline**; the gateway only
**pushes** the resulting state — the same REST-then-push design as the game
gateway. Clients connect with the same handshake auth (access/guest token,
resolved by the shared `SocketIdentityService`) and emit `room:subscribe
{ code }` after joining.

Events:

- `room:state` — the neutral `RoomView` (code, status, maxPlayers, members,
  gameId) on subscribe and after every change. The start transition arrives as
  a `room:state` with `status: "in_game"` + `gameId`, which triggers client
  navigation into the game.
- `room:presence` — `{ online: string[] }` of connected member ids.
- `room:error` — `{ code, message }` (e.g. `NOT_A_MEMBER`).

The broadcast is **viewer-agnostic** (one emit per room). A client recognises
itself by matching the `memberId` it got from its REST create/join response
against `members[].id` — no per-viewer room broadcasts, and identity tokens are
never exposed (only the opaque member id).

## Frontend

- `lib/rooms.ts` — `roomsApi` (identity-authed via `authedFetch`).
- `lib/realtime.ts` — `connectRoom(code, creds, callbacks)`.
- `hooks/useRoom.ts` — REST membership + socket updates + start navigation;
  exposes `ready/leave/start/kick/setSeats`.
- `components/RoomScreen.tsx` — seat list with presence dots, host badge, ready
  state, host controls (seat count, kick, start), invite code + copy link, and
  the join-by-link prompt. All copy is in `online.*` / `online.room.*`
  (en + ar).
