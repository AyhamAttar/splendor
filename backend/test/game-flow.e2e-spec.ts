import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import {
  canAfford,
  getCard,
  GEMS,
  LEVELS,
  type Action,
  type GameState,
  type PlayerState,
  type TokenBag,
  type TokenColor,
} from "../src/engine";

// A deterministic scripted policy (same shape as the engine's fuzz bot).
function chooseAction(state: GameState): Action {
  const p = state.players[state.currentPlayer];
  const aff: number[] = [];
  for (const l of LEVELS)
    for (const cid of state.board[l])
      if (cid != null && canAfford(p, getCard(cid))) aff.push(cid);
  for (const r of p.reserved) if (canAfford(p, getCard(r.cardId))) aff.push(r.cardId);
  if (aff.length) {
    let best = aff[0];
    for (const id of aff) if (getCard(id).points > getCard(best).points) best = id;
    return { type: "PURCHASE", cardId: best };
  }
  const avail = GEMS.filter((g) => state.bank[g] > 0);
  if (avail.length) return { type: "TAKE_DIFFERENT", gems: avail.slice(0, Math.min(3, avail.length)) };
  const decks = LEVELS.filter((l) => state.decks[l].length > 0);
  if (p.reserved.length < 3 && decks.length) return { type: "RESERVE_DECK", level: decks[0] };
  return { type: "PASS" };
}

function chooseReturn(p: PlayerState, action: Action, mustReturn: number, goldAvail: boolean): TokenBag {
  const proj: Record<TokenColor, number> = { ...p.tokens };
  if (action.type === "TAKE_DIFFERENT") for (const g of action.gems) proj[g]++;
  else if (action.type === "TAKE_SAME") proj[action.gem] += 2;
  else if ((action.type === "RESERVE_DECK" || action.type === "RESERVE_BOARD") && goldAvail) proj.gold++;
  const ret: TokenBag = {};
  let rem = mustReturn;
  for (const c of ["white", "blue", "green", "red", "black", "gold"] as TokenColor[]) {
    if (rem <= 0) break;
    const take = Math.min(proj[c], rem);
    if (take > 0) {
      ret[c] = take;
      rem -= take;
    }
  }
  return ret;
}

describe("Splendor API (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it("creates a game and round-trips the session via /resume", async () => {
    const res = await http().post("/games").send({ playerNames: ["Ana", "Ben"], seed: 123 }).expect(201);
    expect(res.body.gameId).toBeTruthy();
    expect(res.body.sessionToken).toBeTruthy();
    expect(res.body.state.players).toHaveLength(2);

    const resume = await http().get(`/resume/${res.body.sessionToken}`).expect(200);
    expect(resume.body.gameId).toBe(res.body.gameId);
    expect(resume.body.state.turnNumber).toBe(0);
  });

  it("plays a full scripted game to completion over HTTP", async () => {
    const create = await http().post("/games").send({ playerNames: ["Ana", "Ben", "Cy"], seed: 42 }).expect(201);
    const { gameId, sessionToken } = create.body;
    let state: GameState = create.body.state;

    let guard = 0;
    while (state.status === "active" && guard++ < 4000) {
      const action = chooseAction(state);
      const body: Record<string, unknown> = { expectedTurn: state.turnNumber, action };

      let resp = await http().post(`/games/${gameId}/actions`).set("x-session-token", sessionToken).send(body);
      let attempts = 0;
      while (resp.status === 422 && attempts++ < 3) {
        if (resp.body.code === "TOKEN_RETURN_REQUIRED") {
          body.returnTokens = chooseReturn(state.players[state.currentPlayer], action, resp.body.mustReturn, state.bank.gold > 0);
        } else if (resp.body.code === "NOBLE_CHOICE_REQUIRED") {
          body.nobleId = resp.body.eligible[0];
        } else {
          break;
        }
        resp = await http().post(`/games/${gameId}/actions`).set("x-session-token", sessionToken).send(body);
      }

      expect(resp.status).toBe(200);
      state = resp.body.state;
    }

    expect(state.status).toBe("finished");
    expect(state.winners!.length).toBeGreaterThanOrEqual(1);
    expect(state.turnNumber % 3).toBe(0);
  });

  it("enforces auth, existence, concurrency, and rules over HTTP", async () => {
    const create = await http().post("/games").send({ playerNames: ["A", "B"], seed: 5 }).expect(201);
    const { gameId, sessionToken } = create.body;

    await http().get(`/games/${gameId}`).set("x-session-token", "wrong-token").expect(403);
    await http().get(`/games/does-not-exist`).set("x-session-token", sessionToken).expect(404);

    const stale = await http()
      .post(`/games/${gameId}/actions`)
      .set("x-session-token", sessionToken)
      .send({ expectedTurn: 999, action: { type: "TAKE_DIFFERENT", gems: ["white"] } });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("STALE_TURN");

    const illegal = await http()
      .post(`/games/${gameId}/actions`)
      .set("x-session-token", sessionToken)
      .send({ expectedTurn: 0, action: { type: "PASS" } });
    expect(illegal.status).toBe(422);
    expect(illegal.body.code).toBe("PASS_NOT_ALLOWED");
  });

  it("rejects invalid create payloads with 400", async () => {
    await http().post("/games").send({ playerNames: ["Solo"] }).expect(400);
    await http().post("/games").send({ playerNames: ["A", "B", "C", "D", "E"] }).expect(400);
  });
});
