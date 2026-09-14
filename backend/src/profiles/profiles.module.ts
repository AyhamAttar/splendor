import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";
import { ProfilesRepository } from "./profiles.repository";

/**
 * Public profiles, editable self-profile, handle lookup, and per-user match
 * history + stats (Phase 4). Imports AuthModule for JwtAuthGuard on the write /
 * lookup routes. Match results are written by the games layer when a game ends.
 */
@Module({
  imports: [AuthModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, ProfilesRepository],
})
export class ProfilesModule {}
