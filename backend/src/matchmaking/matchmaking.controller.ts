import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { MatchmakingService } from "./matchmaking.service";
import { JoinQueueDto } from "./dto/join-queue.dto";
import { GuestOrUserGuard } from "../auth/guards/guest-or-user.guard";
import { CurrentIdentity } from "../auth/decorators/current-identity.decorator";
import type { AuthenticatedIdentity } from "../auth/types";

@Controller("matchmaking")
@UseGuards(GuestOrUserGuard)
export class MatchmakingController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("queue")
  @HttpCode(200)
  join(
    @Body() dto: JoinQueueDto,
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ) {
    return this.matchmaking.join(identity, dto.name.trim());
  }

  @Delete("queue")
  @HttpCode(204)
  leave(@CurrentIdentity() identity: AuthenticatedIdentity) {
    this.matchmaking.leave(identity);
  }

  // Polled frequently by a searching client, so it gets a looser throttle.
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get("status")
  status(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return this.matchmaking.status(identity);
  }
}
