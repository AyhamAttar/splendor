/**
 * Phase 3 — Lobby, Rooms & Matchmaking: end-to-end tests.
 *
 * Runs against a real NestJS app + PostgreSQL. Covers:
 *  - Rooms: create → join → ready → start, producing an ONLINE game whose seats
 *    are owned by the members' guest identities (seat-ownership enforced).
 *  - Host permissions and join guards (only host starts; full/closed rooms reject).
 *  - Matchmaking: two clients in the queue land in the same online game.
 */

import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { GUEST_TOKEN_HEADER } from "../src/auth/auth.constants";
import type { RedactedGameState } from "@splendor/engine";

async function issueGuest(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer()).post("/auth/guest").expect(200);
  return res.body.guestToken as string;
}

describe("Rooms & Matchmaking — Phase 3 (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Match two players instantly so the matchmaking test doesn't wait out the
    // default timeout window.
    process.env.MATCH_TARGET = "2";
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe("Rooms", () => {
    it("create → join → ready → start yields a playable online game", async () => {
      const host = await issueGuest(app);
      const guest = await issueGuest(app);

      // Host creates a room.
      const createRes = await http()
        .post("/rooms")
        .set(GUEST_TOKEN_HEADER, host)
        .send({ name: "Alice" })
        .expect(201);
      const code = createRes.body.code as string;
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      expect(createRes.body.members).toHaveLength(1);
      expect(createRes.body.isHost).toBe(true);
      expect(createRes.body.seatIndex).toBe(0);

      // Second player joins by code.
      const joinRes = await http()
        .post(`/rooms/${code}/join`)
        .set(GUEST_TOKEN_HEADER, guest)
        .send({ name: "Bob" })
        .expect(200);
      expect(joinRes.body.members).toHaveLength(2);
      expect(joinRes.body.isHost).toBe(false);
      expect(joinRes.body.seatIndex).toBe(1);

      // Host can't start until the non-host readies up.
      const notReady = await http()
        .post(`/rooms/${code}/start`)
        .set(GUEST_TOKEN_HEADER, host)
        .send({});
      expect(notReady.status).toBe(409);
      expect(notReady.body.code).toBe("PLAYERS_NOT_READY");

      // Non-host marks ready.
      await http()
        .post(`/rooms/${code}/ready`)
        .set(GUEST_TOKEN_HEADER, guest)
        .send({ ready: true })
        .expect(200);

      // A non-host cannot start.
      const guestStart = await http()
        .post(`/rooms/${code}/start`)
        .set(GUEST_TOKEN_HEADER, guest)
        .send({});
      expect(guestStart.status).toBe(403);
      expect(guestStart.body.code).toBe("NOT_HOST");

      // Host starts → an online game id.
      const startRes = await http()
        .post(`/rooms/${code}/start`)
        .set(GUEST_TOKEN_HEADER, host)
        .send({})
        .expect(200);
      const gameId = startRes.body.gameId as string;
      expect(gameId).toBeTruthy();

      // The game is online + redacted, and the host owns seat 0.
      const stateRes = await http()
        .get(`/games/${gameId}`)
        .set(GUEST_TOKEN_HEADER, host)
        .expect(200);
      const state = stateRes.body.state as RedactedGameState;
      expect(state.deckCounts).toBeDefined();
      expect((state as unknown as { decks?: unknown }).decks).toBeUndefined();
      expect(stateRes.body.seat).toBe(0);

      // Host (seat 0, first turn) can act; the joiner (seat 1) cannot yet.
      const gem = (["white", "blue", "green", "red", "black"] as const).find(
        (g) => state.bank[g] > 0,
      )!;
      const guestAct = await http()
        .post(`/games/${gameId}/actions`)
        .set(GUEST_TOKEN_HEADER, guest)
        .send({ expectedTurn: 0, action: { type: "TAKE_DIFFERENT", gems: [gem] } });
      expect(guestAct.status).toBe(403);
      expect(guestAct.body.code).toBe("NOT_YOUR_TURN");

      const hostAct = await http()
        .post(`/games/${gameId}/actions`)
        .set(GUEST_TOKEN_HEADER, host)
        .send({ expectedTurn: 0, action: { type: "TAKE_DIFFERENT", gems: [gem] } })
        .expect(200);
      expect(hostAct.body.state.turnNumber).toBe(1);
      expect(hostAct.body.seat).toBe(0);

      // The room is no longer joinable once started.
      const late = await issueGuest(app);
      const lateJoin = await http()
        .post(`/rooms/${code}/join`)
        .set(GUEST_TOKEN_HEADER, late)
        .send({ name: "Cara" });
      expect(lateJoin.status).toBe(409);
      expect(lateJoin.body.code).toBe("ROOM_NOT_JOINABLE");
    });

    it("rejects an unauthenticated (identity-less) room create", async () => {
      const res = await http().post("/rooms").send({ name: "Nobody" });
      expect(res.status).toBe(401);
    });
  });

  describe("Matchmaking", () => {
    it("groups two queued players into the same online game", async () => {
      const a = await issueGuest(app);
      const b = await issueGuest(app);

      await http()
        .post("/matchmaking/queue")
        .set(GUEST_TOKEN_HEADER, a)
        .send({ name: "Ana" })
        .expect(200);
      await http()
        .post("/matchmaking/queue")
        .set(GUEST_TOKEN_HEADER, b)
        .send({ name: "Ben" })
        .expect(200);

      // Poll until both are matched (tick runs every ~1s).
      const waitForMatch = async (token: string): Promise<string> => {
        for (let i = 0; i < 50; i++) {
          const res = await http()
            .get("/matchmaking/status")
            .set(GUEST_TOKEN_HEADER, token)
            .expect(200);
          if (res.body.status === "matched") return res.body.gameId as string;
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error("timed out waiting for match");
      };

      const gameA = await waitForMatch(a);
      const gameB = await waitForMatch(b);
      expect(gameA).toBe(gameB);

      // It's a real online game.
      const stateRes = await http()
        .get(`/games/${gameA}`)
        .set(GUEST_TOKEN_HEADER, a)
        .expect(200);
      expect(stateRes.body.state.deckCounts).toBeDefined();
    });
  });
});
