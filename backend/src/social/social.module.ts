import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RoomsModule } from "../rooms/rooms.module";
import { FriendsController } from "./friends.controller";
import { FriendsService } from "./friends.service";
import { FriendsRepository } from "./friends.repository";
import { PresenceGateway } from "./presence.gateway";
import {
  InMemoryPresenceTracker,
  PresenceTracker,
} from "./presence.tracker";

/**
 * Social layer (Phase 4): friends, blocking, per-user presence, and room
 * invites. AuthModule supplies JwtAuthGuard (REST) and SocketIdentityService
 * (the /social gateway handshake). Presence is bound to the in-memory tracker
 * via its abstract token so a Redis tracker can swap in for multi-instance
 * presence later (mirrors MatchmakingQueue). RoomsModule is imported so a room
 * invite can be verified against the caller's actual room membership.
 */
@Module({
  imports: [AuthModule, RoomsModule],
  controllers: [FriendsController],
  providers: [
    FriendsService,
    FriendsRepository,
    PresenceGateway,
    { provide: PresenceTracker, useClass: InMemoryPresenceTracker },
  ],
})
export class SocialModule {}
