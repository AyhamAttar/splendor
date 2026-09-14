import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";

/**
 * Liveness/readiness probes (Phase 5). PrismaService is provided globally by
 * PrismaModule, so the readiness DB ping resolves it without extra wiring.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
