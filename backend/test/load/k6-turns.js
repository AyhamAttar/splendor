/*
 * k6 load test — server-authoritative turn path.
 *
 * Each virtual user creates a game and plays a burst of turns over the REST
 * action endpoint (the same validate → apply → persist path the WebSocket loop
 * commits, and where splendor_turn_duration_seconds is recorded). Running many
 * VUs approximates N concurrent games and measures per-turn latency under load.
 *
 * Run (needs a running API + DB):
 *   k6 run -e BASE_URL=http://localhost:4000 -e VUS=50 -e DURATION=1m \
 *     backend/test/load/k6-turns.js
 *
 * Watch memory in parallel via GET /metrics (process_resident_memory_bytes) or
 * `docker stats`. Tune the thresholds below to your single-host target.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const GEMS = ["white", "blue", "green", "red", "black"];

const turnLatency = new Trend("turn_latency_ms", true);
const turnErrors = new Rate("turn_errors");

export const options = {
  vus: Number(__ENV.VUS) || 25,
  duration: __ENV.DURATION || "30s",
  thresholds: {
    // Adjust to the agreed single-host budget once measured.
    turn_latency_ms: ["p(95)<200"],
    turn_errors: ["rate<0.05"],
    http_req_failed: ["rate<0.05"],
  },
};

function createGame() {
  const res = http.post(
    `${BASE_URL}/games`,
    JSON.stringify({ playerNames: ["L1", "L2"] }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(res, { "game created": (r) => r.status === 201 });
  if (res.status !== 201) return null;
  const body = res.json();
  return { gameId: body.gameId, token: body.sessionToken, state: body.state };
}

export default function () {
  const game = createGame();
  if (!game) {
    sleep(1);
    return;
  }
  let state = game.state;

  for (let i = 0; i < 8 && state.status === "active"; i++) {
    const avail = GEMS.filter((g) => state.bank[g] > 0).slice(0, 3);
    const action =
      avail.length >= 1
        ? { type: "TAKE_DIFFERENT", gems: avail }
        : { type: "PASS" };

    const res = http.post(
      `${BASE_URL}/games/${game.gameId}/actions`,
      JSON.stringify({ expectedTurn: state.turnNumber, action }),
      { headers: { "Content-Type": "application/json", "x-session-token": game.token } },
    );

    turnLatency.add(res.timings.duration);
    const ok = res.status === 200;
    turnErrors.add(!ok);
    if (!ok) break; // e.g. token-return required — stop this VU's game
    state = res.json().state;
  }

  sleep(0.5);
}
