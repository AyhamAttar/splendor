import { Injectable, Logger } from "@nestjs/common";
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";
import type { Server } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Prometheus metrics for the game server (Phase 5). Everything lives on a
 * private Registry (not the global default) so repeated instantiation in tests
 * never throws "metric already registered".
 *
 * Coupling flows one way — feature code depends on this service, never the
 * reverse. "Current count" gauges (active games, sockets, queue depth) use a
 * scrape-time `collect()` callback fed by a source the owning module registers,
 * so metrics stays decoupled from matchmaking/socket internals.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  readonly registry = new Registry();

  private readonly turnDuration: Histogram<string>;
  private readonly errorsTotal: Counter<string>;
  private readonly turnsTotal: Counter<string>;

  /** Sources registered by owning modules; read at scrape time. */
  private socketServer: Server | null = null;
  private queueDepthSource: (() => number) | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.registry.setDefaultLabels({ app: "splendor" });
    collectDefaultMetrics({ register: this.registry });

    const self = this;

    new Gauge({
      name: "splendor_active_games",
      help: "Games currently in progress (status=ACTIVE), labelled by online.",
      labelNames: ["online"],
      registers: [this.registry],
      async collect() {
        try {
          const [online, local] = await Promise.all([
            self.prisma.game.count({
              where: { status: "ACTIVE", online: true },
            }),
            self.prisma.game.count({
              where: { status: "ACTIVE", online: false },
            }),
          ]);
          this.set({ online: "true" }, online);
          this.set({ online: "false" }, local);
        } catch (e) {
          // A DB blip must not break the whole scrape; leave the last value.
          self.logger.warn(`active_games collect failed: ${String(e)}`);
        }
      },
    });

    new Gauge({
      name: "splendor_connected_sockets",
      help: "Physically connected Socket.IO clients across all namespaces.",
      registers: [this.registry],
      collect() {
        this.set(self.socketServer?.engine?.clientsCount ?? 0);
      },
    });

    new Gauge({
      name: "splendor_matchmaking_queue_depth",
      help: "Players currently waiting in the quick-match queue.",
      registers: [this.registry],
      collect() {
        this.set(self.queueDepthSource?.() ?? 0);
      },
    });

    this.turnDuration = new Histogram({
      name: "splendor_turn_duration_seconds",
      help: "Wall-clock time to validate, apply and persist a game turn.",
      labelNames: ["online"],
      // Turns are fast; buckets centre on single-digit to low-hundred ms.
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });

    this.turnsTotal = new Counter({
      name: "splendor_turns_total",
      help: "Total turns successfully committed.",
      labelNames: ["online"],
      registers: [this.registry],
    });

    this.errorsTotal = new Counter({
      name: "splendor_errors_total",
      help: "Unhandled/server errors surfaced by the global exception filter.",
      labelNames: ["type", "scope"],
      registers: [this.registry],
    });
  }

  // --- Registration hooks (called once by the owning module) -----------------

  bindSocketServer(server: Server): void {
    this.socketServer = server;
  }

  registerQueueDepthSource(source: () => number): void {
    this.queueDepthSource = source;
  }

  // --- Push points -----------------------------------------------------------

  observeTurn(seconds: number, online: boolean): void {
    const labels = { online: String(online) };
    this.turnDuration.observe(labels, seconds);
    this.turnsTotal.inc(labels);
  }

  /** `scope` is "http" or "ws"; `type` is the exception class name. */
  incError(type: string, scope: string): void {
    this.errorsTotal.inc({ type, scope });
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
