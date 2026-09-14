import { Module, forwardRef } from "@nestjs/common";
import { GamesController } from "./games.controller";
import { GamesService } from "./games.service";
import { GameRepository } from "./game.repository";
import { GameSweeper } from "./game.sweeper";
import { GameGateway } from "./game.gateway";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [GamesController],
  providers: [GamesService, GameRepository, GameSweeper, GameGateway],
  // Exported so the lobby (rooms) and matchmaking modules can spin up online
  // games (GamesService.createOnline) without duplicating engine/DB wiring.
  exports: [GamesService],
})
export class GamesModule {}
