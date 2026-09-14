import { Module } from "@nestjs/common";
import { WsRateLimitGuard } from "./ws-rate-limit.guard";

/**
 * Cross-cutting providers shared by feature modules. `WsRateLimitGuard` is
 * DI-instantiated (it reads ConfigService), so any gateway that guards its
 * message handlers with it must import this module.
 */
@Module({
  providers: [WsRateLimitGuard],
  exports: [WsRateLimitGuard],
})
export class CommonModule {}
