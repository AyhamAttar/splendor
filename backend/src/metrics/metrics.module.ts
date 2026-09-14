import { Global, Module } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";

/**
 * Prometheus metrics (Phase 5). Global so any feature module can inject
 * MetricsService to push measurements (e.g. turn latency) without re-importing.
 */
@Global()
@Module({
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
