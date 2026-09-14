# Social: Friends, History & Profiles — Phase 4

Phase 4 turns the `Friendship` and `MatchResult` stubs into real features and adds
public profiles: players get a durable **@handle**, a **profile** with lifetime
stats and match history, a **friends** graph with live presence, and the ability
to **invite a friend into a room**.

Friends are between **accounts only** — a guest has no friends until they register
(guest → account upgrade keeps their game history; see [AUTH.md](./AUTH.md)).
Match history and profiles work for anyone who has played, guest or account.

## Identity: the @handle

Discovery is by a unique, public **handle** (`User.handle`, stored lowercase,
3–20 of `[a-z0-9_]`). You add a friend by their handle; nothing else about an
account (email especially) is exposed. `handle` is null until claimed on the
profile edit screen. `avatar` is an optional image URL rendered client-side.

## Match history & stats

When a game finishes, the games layer writes an immutable `MatchResult` **in the
same transaction** that flips `Game.status` to `FINISHED` (see
[`game.repository.ts`](../backend/src/games/game.repository.ts) `recordResult` and
the pure [`match-summary.ts`](../backend/src/games/match-summary.ts)). So a
finished game always has exactly one history row (idempotent — a re-finish is a
no-op).

`MatchResult.summary` is a self-contained snapshot: seed, total turns, duration,
and a per-seat breakdown (name, owning `userId`/`guestId`, final prestige, cards,
nobles, gem bonuses, purchased card ids, `won`). Because the owning identity is
denormalized into the summary, stats and history need no live game state — they
survive even if the raw game is later swept.

- **History** — every `MatchResult` whose game has a `GamePlayer` owned by the
  user **or** the guest identity they upgraded from (so pre-signup games count).
  Paginated newest-first with an opaque cursor.
- **Stats** — folded from a user's summaries: games, wins, win rate, favorite gem
  (most-accumulated bonus color), best/total prestige, total cards.

The game **sweeper retains FINISHED games** (it only deletes idle `ACTIVE` ones),
so history and the `seed` + `Move` replay data persist. **Replay** is designed-for
but not built in this phase — the data is all there.

## Friends: the relationship edge

One `Friendship` row per ordered `(requester, addressee)` pair; the service keeps
**at most one relationship per pair** across directions.

```
                request (by handle)            accept
   (none) ──────────────────────────▶ PENDING ────────▶ ACCEPTED
      ▲                                   │                  │
      │           decline / cancel        │   remove friend  │
      └───────────────────────────────────┴──────────────────┘

   block (from either state) ───▶ BLOCKED (requester = blocker)  ──unblock──▶ (none)
```

- **Send** by handle. If the target already sent *you* a request, it auto-accepts
  into a mutual friendship instead of creating a second edge.
- **Accept / decline** an incoming request; **cancel** an outgoing one;
  **remove** a friend — all collapse to deleting the pair's non-blocked edge.
- **Block** removes any existing edge and writes a `BLOCKED` edge from blocker →
  blocked (atomic). A block hides the pair both ways and **prevents requests and
  invites**. **Unblock** deletes it.

## Presence & the `/social` channel

Presence and social notifications ride a dedicated Socket.IO namespace,
**`/social`**, isolated from the game (`/`) and lobby sockets so it never
intercepts guest play. Only signed-in accounts connect (the client gates on
sign-in; the gateway disconnects any socket with no user identity). Presence is
reference-counted per user in an in-memory `PresenceTracker`, abstracted behind a
token so a Redis tracker can drop in for multi-instance presence later (mirrors
the matchmaking queue).

Server → client events:

- `social:ready` `{ online: string[] }` — which of your friends are online (on
  connect).
- `friend:presence` `{ userId, online }` — a friend came online / went offline
  (fanned out to their friends on the 0↔1 connection transition).
- `friend:request` `RequestView` — a new incoming request.
- `friend:changed` — your friend graph changed (accept/decline/remove/block);
  the client refetches `/friends`.
- `room:invite` `{ code, from }` — a friend invited you to a room.

Correctness of the friend list's online dots is guaranteed by the `/friends`
refetch (which reads current presence); the delta events are a live nicety.

## Invite a friend to a room

From a room, a signed-in member can invite any **online** friend
(`POST /friends/:userId/invite { code }`). The server verifies an `ACCEPTED`
friendship (so blocks are honored) and pushes `room:invite` to the friend's
`/social` sockets. The recipient sees a toast (rendered by `SocialProvider`) and
can **Join** — which routes them to `/room/{code}`, where the normal join flow
seats them. Invites are ephemeral (not persisted); an offline friend simply
doesn't receive one.

## REST surface

Profiles (`ProfilesController`) — public reads need no auth; writes/lookup require
a signed-in account (`JwtAuthGuard`). Edits are **POST** (the API's CORS allows
GET/POST/DELETE only).

| Method & path | Auth | Result |
|---------------|------|--------|
| `GET /users/:id` | public | `{ profile, stats }` |
| `GET /users/:id/history?limit=&cursor=` | public | `{ entries, nextCursor }` |
| `GET /users/by-handle/:handle` | user | `{ profile \| null }` |
| `POST /users/me` | user | `{ user }` (update displayName / handle / avatar) |

Friends (`FriendsController`) — all `JwtAuthGuard` (accounts only):

| Method & path | Body | Result |
|---------------|------|--------|
| `GET /friends` | — | `{ friends, incoming, outgoing, blocked }` |
| `POST /friends/requests` | `{ handle }` | `{ accepted }` |
| `POST /friends/requests/:id/accept` | — | 204 |
| `POST /friends/requests/:id/decline` | — | 204 |
| `DELETE /friends/:userId` | — | 204 (remove / cancel / decline) |
| `POST /friends/:userId/block` | — | 204 |
| `DELETE /friends/:userId/block` | — | 204 (unblock) |
| `POST /friends/:userId/invite` | `{ code }` | 204 |

Sending requests and invites are rate-limited (30/min). Typed errors
(`{ code, message }`): `USER_NOT_FOUND` (404), `ALREADY_FRIENDS` /
`REQUEST_ALREADY_SENT` / `BLOCKED_BY_YOU` (409), `CANNOT_FRIEND_SELF` /
`CANNOT_BLOCK_SELF` (400), `REQUEST_BLOCKED` / `NOT_FRIENDS` (403),
`REQUEST_NOT_FOUND` (404), and `HANDLE_TAKEN` (409) on profile edit.

## Frontend

- `lib/social.ts` / `lib/profiles.ts` — identity-authed APIs (`authedFetch`).
- `lib/realtime.ts` — `connectSocial(creds, callbacks)` on the `/social`
  namespace.
- `components/SocialProvider.tsx` — root-level context: friends overview + live
  presence + the incoming room-invite toast; exposes `useSocial()`. Inert for
  guests (data gated by `isUser`).
- `components/FriendsButton.tsx` / `FriendsPanel.tsx` — lobby control (with a
  pending-request badge) opening a tabbed panel: add-by-handle, friends (with
  presence), requests, blocked.
- `components/ProfileScreen.tsx` (route `app/profile/[id]`) — avatar, handle,
  stats, and paginated match history; the owner gets `EditProfileDialog.tsx`.
- `components/Avatar.tsx` — image URL with a monogram fallback (colored disc; the
  gem-image rule for `TokenChip` is untouched — `GemPip` stays a colored disc).
- `RoomScreen.tsx` — an "Invite friends" section listing online friends.

All new copy ships in `en` + `ar` (`social.*`, `profile.*`, `history.*`) with RTL
handled by the existing layout `dir`.

## Scale-out note (deferred)

Presence and the social fan-out are in-memory and single-host. The
`PresenceTracker` abstraction and per-user `user:{id}` rooms are the seam for a
Redis adapter + shared presence store when multi-instance is needed (Phase 7).
