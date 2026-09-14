/**
 * Phase 2 — Realtime Multiplayer Core: end-to-end tests.
 *
 * These tests exercise the online-game machinery against a real NestJS app and
 * a real PostgreSQL database (same as the hotseat e2e suite).  Each test creates
 * online game fixtures by:
 *   1. Minting guest identities via /auth/guest.
 *   2. Creating a game via /games (which starts as hotseat).
 *   3. Flipping online=true and mapping GamePlayer rows to the guest identities
 *      directly via PrismaService (no lobby/join flow yet — that is Phase 3).
 *
 * Tests cover:
 *  - REST authorization: only the current-seat owner may act; others get 403.
 *  - Redaction: getState returns deck counts, not arrays; opponent blind-reserves
 *    have cardId=null.
 *  - WebSocket push: after the seat-owner acts, the other connected socket
 *    receives a "state" event with the updated game.
 *  - Regression: hotseat games (online=false) still work exactly as before.
 */

import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { GUEST_TOKEN_HEADER } from "../src/auth/auth.constants";
import type { RedactedGameState } from "@splendor/engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function issueGuest(
  app: INestApplication,
): Promise<{ guestToken: string; guestId: string }> {
  const res = await request(app.getHttpServer())
    .post("/auth/guest")
    .expect(200);
  return { guestToken: res.body.guestToken, guestId: res.body.guest.id };
}

async function createGame(
  app: INestApplication,
): Promise<{ gameId: string; sessionToken: string }> {
  const res = await request(app.getHttpServer())
    .post("/games")
    .send({ playerNames: ["Alice", "Bob"], seed: 77 })
    .expect(201);
  return { gameId: res.body.gameId, sessionToken: res.body.sessionToken };
}

/** Flip a game to online and assign guest identities to its seats. */
async function makeOnline(
  prisma: PrismaService,
  gameId: string,
  guests: { guestId: string; seat: number }[],
): Promise<void> {
  await prisma.game.update({
    where: { id: gameId },
    data: { online: true },
  });
  for (const { guestId, seat } of guests) {
    await prisma.gamePlayer.update({
      where: { gameId_seatIndex: { gameId, seatIndex: seat } },
      data: { guestId },
    });
  }
}

/** Connect a socket.io client to the test server. */
function connectSocket(
  app: INestApplication,
  guestToken: string,
): ClientSocket {
  const addr = app.getHttpServer().address() as { port: number };
  return ioClient(`http://localhost:${addr.port}`, {
    transports: ["websocket"],
    auth: { guestToken },
  });
}

/** Wait for a single named event on a socket, with a timeout. */
function waitFor<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}" (connected=${socket.connected})`)),
      timeoutMs,
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Online Game — Phase 2 (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    // Bind to a random free port for the WS tests.
    await app.listen(0);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  // -------------------------------------------------------------------------
  // REST authorization
  // -------------------------------------------------------------------------

  describe("REST authorization", () => {
    it("rejects a non-participant trying to act", async () => {
      const { guestToken: hostToken, guestId: hostId } = await issueGuest(app);
      const { guestToken: outsiderToken } = await issueGuest(app);
      const { gameId } = await createGame(app);
      await makeOnline(prisma, gameId, [{ guestId: hostId, seat: 0 }]);

      const res = await http()
        .post(`/games/${gameId}/actions`)
        .set(GUEST_TOKEN_HEADER, outsiderToken)
        .send({ expectedTurn: 0, action: { type: "PASS" } });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_A_PLAYER");
    });

    it("rejects the non-current-seat owner trying to act", async () => {
      const { guestToken: aliceToken, guestId: aliceId } = await issueGuest(app);
      const { guestToken: bobToken, guestId: bobId } = await issueGuest(app);
      const { gameId } = await createGame(app);
      await makeOnline(prisma, gameId, [
        { guestId: aliceId, seat: 0 },
        { guestId: bobId, seat: 1 },
      ]);

      // Turn 0 belongs to seat 0 (Alice); Bob tries to act — should be rejected.
      const res = await http()
        .post(`/games/${gameId}/actions`)
        .set(GUEST_TOKEN_HEADER, bobToken)
        .send({ expectedTurn: 0, action: { type: "PASS" } });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_YOUR_TURN");
    });

    it("allows the current-seat owner to act", async () => {
      const { guestToken: aliceToken, guestId: aliceId } = await issueGuest(app);
      const { guestId: bobId } = await issueGuest(app);
      const { gameId } = await createGame(app);
      await makeOnline(prisma, gameId, [
        { guestId: aliceId, seat: 0 },
        { guestId: bobId, seat: 1 },
      ]);

      // Find a valid action for seat 0 — take some gems.
      const stateRes = await http()
        .get(`/games/${gameId}`)
        .set(GUEST_TOKEN_HEADER, aliceToken)
        .expect(200);

      const state = stateRes.body.state as RedactedGameState;
      const availableGem = (["white", "blue", "green", "red", "black"] as const).find(
        (g) => state.bank[g] > 0,
      );
      expect(availableGem).toBeDefined();

      const res = await http()
        .post(`/games/${gameId}/actions`)
        .set(GUEST_TOKEN_HEADER, aliceToken)
        .send({
          expectedTurn: state.turnNumber,
          action: { type: "TAKE_DIFFERENT", gems: [availableGem] },
        });

      expect(res.status).toBe(200);
      expect(res.body.state.turnNumber).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Redaction
  // -------------------------------------------------------------------------

  describe("Redaction via getState", () => {
    it("returns deckCounts (not deck arrays) for online games", async () => {
      const { guestToken, guestId } = await issueGuest(app);
      const { gameId } = await createGame(app);
      await makeOnline(prisma, gameId, [{ guestId, seat: 0 }]);

      const res = await http()
        .get(`/games/${gameId}`)
        .set(GUEST_TOKEN_HEADER, guestToken)
        .expect(200);

      const state = res.body.state as RedactedGameState;
      expect(state.deckCounts).toBeDefined();
      expect(typeof state.deckCounts[1]).toBe("number");
      expect((state as unknown as { decks?: unknown }).decks).toBeUndefined();
    });

    it("hides opponents' blind reserves (cardId: null)", async () => {
      const { guestToken: aliceToken, guestId: aliceId } = await issueGuest(app);
      const { guestToken: bobToken, guestId: bobId } = await issueGuest(app);
      const { gameId } = await createGame(app);
      await makeOnline(prisma, gameId, [
        { guestId: aliceId, seat: 0 },
        { guestId: bobId, seat: 1 },
      ]);

      // Alice reserves a card from a deck (blind reserve) so Bob can see the redaction.
      const aliceStateRes = await http()
        .get(`/games/${gameId}`)
        .set(GUEST_TOKEN_HEADER, aliceToken)
        .expect(200);
      const aliceState = aliceStateRes.body.state as RedactedGameState;
      const deckLevel = ([1, 2, 3] as const).find(
        (l) => aliceState.deckCounts[l] > 0,
      );
      if (!deckLevel) return; // no cards in decks — skip

      const reserveRes = await http()
        .post(`/games/${gameId}/actions`)
        .set(GUEST_TOKEN_HEADER, aliceToken)
        .send({
          expectedTurn: aliceState.turnNumber,
          action: { type: "RESERVE_DECK", level: deckLevel },
        });
      expect(reserveRes.status).toBe(200);

      // Bob now reads state — Alice's blind reserve should have cardId: null.
      const bobStateRes = await http()
        .get(`/games/${gameId}`)
        .set(GUEST_TOKEN_HEADER, bobToken)
        .expect(200);
      const bobState = bobStateRes.body.state as RedactedGameState;
      const aliceForBob = bobState.players[0];
      const blindReserve = aliceForBob.reserved.find((r) => r.hidden);
      expect(blindReserve).toBeDefined();
      expect(blindReserve?.cardId).toBeNull();

      // Alice reads her own state — her own blind reserve shows the real cardId.
      const aliceCheck = await http()
        .get(`/games/${gameId}`)
        .set(GUEST_TOKEN_HEADER, aliceToken)
        .expect(200);
      const aliceRead = aliceCheck.body.state as RedactedGameState;
      const aliceOwn = aliceRead.players[0].reserved.find((r) => r.hidden);
      expect(aliceOwn?.cardId).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // WebSocket push
  // -------------------------------------------------------------------------

  describe("WebSocket push", () => {
    it("both sockets receive pushed state when the current-seat owner acts", async () => {
      const { guestToken: aliceToken, guestId: aliceId } = await issueGuest(app);
      const { guestToken: bobToken, guestId: bobId } = await issueGuest(app);
      const { gameId } = await createGame(app);
      await makeOnline(prisma, gameId, [
        { guestId: aliceId, seat: 0 },
        { guestId: bobId, seat: 1 },
      ]);

      // Create sockets — connection happens async on next tick, so all listeners
      // set up immediately after io() will fire before "connect" arrives.
      const aliceSocket = connectSocket(app, aliceToken);
      const bobSocket = connectSocket(app, bobToken);

      // Set up connect listeners BEFORE any await (strictly synchronous after io()).
      const aliceConnected = waitFor<void>(aliceSocket, "connect");
      const bobConnected = waitFor<void>(bobSocket, "connect");
      await Promise.all([aliceConnected, bobConnected]);

      // Set up initial-state listeners BEFORE emitting subscribe to avoid the race
      // where subscribe response arrives before the listener is registered.
      const aliceInitState = waitFor<RedactedGameState>(aliceSocket, "state");
      const bobInitState = waitFor<RedactedGameState>(bobSocket, "state");

      aliceSocket.emit("subscribe", { gameId });
      bobSocket.emit("subscribe", { gameId });

      // Consume the initial "state" snapshots.
      await Promise.all([aliceInitState, bobInitState]);

      // Find a valid gem from Alice's redacted state (don't need a separate REST call).
      const aliceStateRes = await http()
        .get(`/games/${gameId}`)
        .set(GUEST_TOKEN_HEADER, aliceToken)
        .expect(200);
      const aliceState = aliceStateRes.body.state as RedactedGameState;
      const gem = (["white", "blue", "green", "red", "black"] as const).find(
        (g) => aliceState.bank[g] > 0,
      )!;

      // Set up Bob's push listener BEFORE submitting Alice's action so the event
      // cannot arrive before the listener is registered.
      const bobPushPromise = waitFor<RedactedGameState>(bobSocket, "state");

      await http()
        .post(`/games/${gameId}/actions`)
        .set(GUEST_TOKEN_HEADER, aliceToken)
        .send({
          expectedTurn: aliceState.turnNumber,
          action: { type: "TAKE_DIFFERENT", gems: [gem] },
        })
        .expect(200);

      const pushed = await bobPushPromise;
      expect(pushed.turnNumber).toBe(1);
      expect(pushed.deckCounts).toBeDefined();

      aliceSocket.disconnect();
      bobSocket.disconnect();
    });
  });

  // -------------------------------------------------------------------------
  // Regression: hotseat games unchanged
  // -------------------------------------------------------------------------

  describe("Hotseat regression", () => {
    it("hotseat games still work with session token and return full state", async () => {
      const res = await http()
        .post("/games")
        .send({ playerNames: ["Ana", "Ben"], seed: 123 })
        .expect(201);

      const { gameId, sessionToken } = res.body;
      expect(res.body.state.decks).toBeDefined(); // full decks returned at create

      const stateRes = await http()
        .get(`/games/${gameId}`)
        .set("x-session-token", sessionToken)
        .expect(200);
      expect(stateRes.body.state.decks).toBeDefined(); // full decks on GET too

      const availableGem = (["white", "blue", "green", "red", "black"] as const).find(
        (g) => stateRes.body.state.bank[g] > 0,
      )!;

      const actRes = await http()
        .post(`/games/${gameId}/actions`)
        .set("x-session-token", sessionToken)
        .send({
          expectedTurn: 0,
          action: { type: "TAKE_DIFFERENT", gems: [availableGem] },
        })
        .expect(200);

      expect(actRes.body.state.turnNumber).toBe(1);
      expect(actRes.body.state.decks).toBeDefined(); // full state returned
    });
  });
});
