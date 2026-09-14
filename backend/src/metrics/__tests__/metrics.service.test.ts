import type { PrismaService } from "../../prisma/prisma.service";
import { MetricsService } from "../metrics.service";

const prismaMock = () =>
  ({ game: { count: jest.fn().mockResolvedValue(2) } }) as unknown as PrismaService;

describe("MetricsService", () => {
  it("renders Prometheus exposition with our custom metrics", async () => {
    const m = new MetricsService(prismaMock());
    const out = await m.render();
    expect(m.contentType).toContain("text/plain");
    expect(out).toContain("splendor_active_games");
    expect(out).toContain("splendor_connected_sockets");
    expect(out).toContain("splendor_matchmaking_queue_depth");
    expect(out).toContain("splendor_turn_duration_seconds");
    expect(out).toContain("splendor_errors_total");
    // A default process metric confirms collectDefaultMetrics is wired.
    expect(out).toContain("process_cpu_user_seconds_total");
  });

  it("records turn observations and error counts", async () => {
    const m = new MetricsService(prismaMock());
    m.observeTurn(0.01, true);
    m.observeTurn(0.02, false);
    m.incError("TypeError", "http");
    const out = await m.render();
    expect(out).toMatch(/splendor_turns_total\{[^}]*online="true"[^}]*\} 1/);
    expect(out).toMatch(
      /splendor_errors_total\{[^}]*type="TypeError"[^}]*scope="http"[^}]*\} 1/,
    );
  });

  it("reads registered gauge sources at scrape time", async () => {
    const m = new MetricsService(prismaMock());
    m.registerQueueDepthSource(() => 7);
    const out = await m.render();
    expect(out).toMatch(/splendor_matchmaking_queue_depth\{[^}]*\} 7/);
    // active_games gauge pulls from the (mocked) DB count.
    expect(out).toMatch(/splendor_active_games\{[^}]*online="true"[^}]*\} 2/);
  });
});
