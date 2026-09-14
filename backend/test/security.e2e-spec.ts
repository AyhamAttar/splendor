/**
 * Phase 5 — Production Hardening: security & observability e2e.
 *
 * Runs against a real NestJS app (configured exactly like production via
 * configureApp) and a real PostgreSQL database. Verifies the hardening actually
 * rejects hostile input on both REST and WebSocket, that health/metrics probes
 * work, and that abusive request rates are throttled.
 *
 * Requires a database (DATABASE_URL) — it is part of the CI e2e stage.
 */

import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function issueGuest(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer()).post("/auth/guest").expect(200);
  return res.body.guestToken as string;
}

function connectSocket(app: INestApplication, auth: object): ClientSocket {
  const addr = app.getHttpServer().address() as { port: number };
  return ioClient(`http://localhost:${addr.port}`, {
    transports: ["websocket"],
    auth,
    reconnection: false,
  });
}

function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
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

describe("Security & observability hardening (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Make the WS flood test deterministic: tiny bucket, no refill.
    process.env.WS_RATE_BURST = "5";
    process.env.WS_RATE_REFILL_PER_SEC = "0";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureApp(app, app.get(ConfigService));
    await app.init();
    await app.listen(0); // random free port for WS
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  // -------------------------------------------------------------------------
  // REST payload validation
  // -------------------------------------------------------------------------

  describe("REST payload validation", () => {
    it("rejects unknown / smuggled fields (forbidNonWhitelisted)", async () => {
      await http()
        .post("/games")
        .send({ playerNames: ["Ana", "Ben"], seed: 1, isAdmin: true })
        .expect(400);
    });

    it("rejects wrong-typed fields", async () => {
      await http().post("/games").send({ playerNames: "not-an-array" }).expect(400);
      await http()
        .post("/games")
        .send({ playerNames: ["A", "B"], seed: "NaN" })
        .expect(400);
    });

    it("rejects an oversized/garbage action shape on a turn (never 500)", async () => {
      const created = await http()
        .post("/games")
        .send({ playerNames: ["A", "B"], seed: 9 })
        .expect(201);
      const { gameId, sessionToken } = created.body;

      const res = await http()
        .post(`/games/${gameId}/actions`)
        .set("x-session-token", sessionToken)
        .send({ expectedTurn: 0, action: { type: "🤖".repeat(1000), junk: [1, 2, 3] } });

      // Either DTO validation (400) or the engine's shape guard (422) — but the
      // server must classify it as client error, not crash with a 500.
      expect([400, 422]).toContain(res.status);
    });
  });

  // -------------------------------------------------------------------------
  // Security headers
  // -------------------------------------------------------------------------

  it("sets hardened response headers (helmet)", async () => {
    const res = await http().post("/auth/guest").expect(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    // helmet hides the Express fingerprint.
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Health / readiness / metrics
  // -------------------------------------------------------------------------

  describe("Observability endpoints", () => {
    it("GET /health is up without touching the DB", async () => {
      const res = await http().get("/health").expect(200);
      expect(res.body.status).toBe("ok");
    });

    it("GET /ready reports the database as up", async () => {
      const res = await http().get("/ready").expect(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.info?.database?.status).toBe("up");
    });

    it("GET /metrics exposes Prometheus metrics", async () => {
      const res = await http().get("/metrics").expect(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("splendor_active_games");
      expect(res.text).toContain("splendor_connected_sockets");
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  it("throttles brute-forced auth login attempts (429)", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 15 }, () =>
        http()
          .post("/auth/login")
          .send({ email: "nobody@example.com", password: "wrong-password" })
          .then((r) => r.status),
      ),
    );
    expect(attempts).toContain(429);
  });

  // -------------------------------------------------------------------------
  // WebSocket hardening
  // -------------------------------------------------------------------------

  describe("WebSocket hardening", () => {
    it("disconnects sockets with no valid identity", async () => {
      const socket = connectSocket(app, {}); // no token
      try {
        await waitFor(socket, "disconnect");
      } finally {
        socket.disconnect();
      }
    });

    it("rejects malformed subscribe payloads with an exception event", async () => {
      const guestToken = await issueGuest(app);
      const socket = connectSocket(app, { guestToken });
      try {
        await waitFor(socket, "connect");
        const exc = waitFor(socket, "exception");
        socket.emit("subscribe", { notGameId: 1, isAdmin: true }); // missing gameId + extra
        await exc; // pipe rejects → exception delivered
      } finally {
        socket.disconnect();
      }
    });

    it("rate-limits a socket that floods messages", async () => {
      const guestToken = await issueGuest(app);
      const socket = connectSocket(app, { guestToken });
      try {
        await waitFor(socket, "connect");
        const exceptions: unknown[] = [];
        socket.on("exception", (d) => exceptions.push(d));
        for (let i = 0; i < 20; i++) socket.emit("subscribe", { gameId: "nope" });
        await new Promise((r) => setTimeout(r, 500));
        const dump = JSON.stringify(exceptions);
        expect(dump).toContain("RATE_LIMITED");
      } finally {
        socket.disconnect();
      }
    });
  });
});
