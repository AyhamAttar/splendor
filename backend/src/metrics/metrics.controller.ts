import {
  Controller,
  Get,
  Header,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SkipThrottle } from "@nestjs/throttler";
import { MetricsService } from "./metrics.service";

/**
 * Prometheus scrape endpoint. When METRICS_TOKEN is set the endpoint requires
 * `Authorization: Bearer <token>` so the metrics (which can reveal internal
 * volumes) aren't world-readable; when unset it is open for local dev. Skips
 * the throttler so a 15s scrape interval never trips rate limiting.
 */
@SkipThrottle()
@Controller("metrics")
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async scrape(@Headers("authorization") auth?: string): Promise<string> {
    const token = this.config.get<string>("METRICS_TOKEN");
    if (token && auth !== `Bearer ${token}`) {
      throw new UnauthorizedException("Invalid metrics token.");
    }
    return this.metrics.render();
  }
}
