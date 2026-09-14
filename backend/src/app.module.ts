import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AllExceptionsFilter } from "./observability/all-exceptions.filter";
import { LifecycleService } from "./observability/lifecycle.service";
import { pinoConfig } from "./observability/logger.config";
import { GamesModule } from "./games/games.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { RoomsModule } from "./rooms/rooms.module";
import { MatchmakingModule } from "./matchmaking/matchmaking.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { SocialModule } from "./social/social.module";
import { HealthModule } from "./health/health.module";
import { MetricsModule } from "./metrics/metrics.module";

@Module({
  imports: [
    // Loads backend/.env into process.env before providers construct (Prisma
    // reads DATABASE_URL, main.ts reads PORT/CORS_ORIGINS).
    ConfigModule.forRoot({ isGlobal: true }),
    // Structured JSON logging with per-request correlation ids (Phase 5).
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: pinoConfig,
    }),
    // Global in-memory rate limiting. The generous default guards against
    // gameplay abuse without impeding normal turns; auth routes tighten it with
    // @Throttle. (A Redis store swaps in for multi-instance — see Phase 7.)
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 300 }],
    }),
    PrismaModule,
    MetricsModule,
    HealthModule,
    AuthModule,
    GamesModule,
    RoomsModule,
    MatchmakingModule,
    ProfilesModule,
    SocialModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Captures unhandled errors to Sentry + the error metric, uniformly for
    // REST and WS, without swallowing Nest's normal HTTP/WS error responses.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    LifecycleService,
  ],
})
export class AppModule {}
