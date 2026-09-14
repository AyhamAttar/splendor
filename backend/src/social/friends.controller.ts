import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { FriendsService } from "./friends.service";
import { InviteToRoomDto, SendRequestDto } from "./dto/friends.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types";

/**
 * Friends & blocking (Phase 4). Friends are between accounts only, so the whole
 * controller is behind JwtAuthGuard (guests can't have friends). Static routes
 * (`requests`) are declared before the `:userId` routes so they win the match.
 */
@Controller("friends")
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.friends.overview(user.userId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("requests")
  @HttpCode(200)
  send(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendRequestDto) {
    return this.friends.sendRequestByHandle(user.userId, dto.handle);
  }

  @Post("requests/:id/accept")
  @HttpCode(204)
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.friends.accept(user.userId, id);
  }

  @Post("requests/:id/decline")
  @HttpCode(204)
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.friends.decline(user.userId, id);
  }

  @Delete(":userId")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
  ) {
    return this.friends.removeOrCancel(user.userId, userId);
  }

  @Post(":userId/block")
  @HttpCode(204)
  block(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
  ) {
    return this.friends.block(user.userId, userId);
  }

  @Delete(":userId/block")
  @HttpCode(204)
  unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
  ) {
    return this.friends.unblock(user.userId, userId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(":userId/invite")
  @HttpCode(204)
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body() dto: InviteToRoomDto,
  ) {
    return this.friends.inviteToRoom(user.userId, userId, dto.code);
  }
}
