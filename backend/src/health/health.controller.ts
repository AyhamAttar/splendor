import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Liveness and readiness probes for the orchestrator / load balancer.
 *
 *  - `GET /health` — liveness: the process is up and the event loop responds.
 *    It deliberately touches no dependencies so a transient DB blip does not
 *    trigger a pod restart loop.
 *  - `GET /ready` — readiness: the DB answers a ping. A failing check returns
 *    503 so the LB stops routing traffic until PostgreSQL is reachable again.
 *
 * Both skip rate limiting so frequent probe traffic never trips the throttler.
 */
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get("health")
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck("database", this.prisma),
    ]);
  }
}
