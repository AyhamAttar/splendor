import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GamesModule } from "../games/games.module";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";
import { RoomRepository } from "./room.repository";
import { LobbyGateway } from "./lobby.gateway";
import { RoomSweeper } from "./room.sweeper";
import { CommonModule } from "../common/common.module";

/**
 * Private lobby rooms (Phase 3). Imports GamesModule so the host-start flow can
 * create an online game, and AuthModule for the shared socket identity resolver
 * (LobbyGateway) and the GuestOrUserGuard (RoomsController).
 */
@Module({
  imports: [AuthModule, GamesModule, CommonModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomRepository, LobbyGateway, RoomSweeper],
  // RoomRepository is exported so the social layer (Phase 4) can verify a caller
  // is in a room before letting them invite a friend to it.
  exports: [RoomRepository],
})
export class RoomsModule {}
