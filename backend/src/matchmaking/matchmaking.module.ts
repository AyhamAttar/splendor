import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GamesModule } from "../games/games.module";
import { MatchmakingController } from "./matchmaking.controller";
import { MatchmakingService } from "./matchmaking.service";
import {
  InMemoryMatchmakingQueue,
  MatchmakingQueue,
} from "./matchmaking.queue";

/**
 * Public quick-match queue (Phase 3). GamesModule supplies online-game creation;
 * AuthModule supplies the GuestOrUserGuard. The queue is bound to the in-memory
 * implementation via its abstract DI token so a Redis store can swap in later.
 */
@Module({
  imports: [AuthModule, GamesModule],
  controllers: [MatchmakingController],
  providers: [
    MatchmakingService,
    { provide: MatchmakingQueue, useClass: InMemoryMatchmakingQueue },
  ],
})
export class MatchmakingModule {}
