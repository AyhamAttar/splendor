import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { HISTORY_DEFAULT_LIMIT, ProfilesService } from "./profiles.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types";

/**
 * Profiles + match history (Phase 4). Public reads (`GET /users/:id` and
 * `/history`) need no identity; the self-edit and handle lookup require a
 * signed-in account (JwtAuthGuard). Static routes are declared before `:id` so
 * they win the match.
 */
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  /** Update the caller's own profile (POST — CORS allows GET/POST/DELETE only). */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("users/me")
  @HttpCode(200)
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return { user: await this.profiles.updateMe(user.userId, dto) };
  }

  /** Resolve a handle to a public profile (add-friend preview). */
  @UseGuards(JwtAuthGuard)
  @Get("users/by-handle/:handle")
  async lookup(@Param("handle") handle: string) {
    return { profile: await this.profiles.lookupByHandle(handle) };
  }

  // Public reads: getProfile aggregates every match summary for the user, so
  // keep a per-endpoint throttle tighter than the global default.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get("users/:id")
  getProfile(@Param("id") id: string) {
    return this.profiles.getProfile(id);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get("users/:id/history")
  getHistory(
    @Param("id") id: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : NaN;
    return this.profiles.getHistory(
      id,
      Number.isNaN(parsed) ? HISTORY_DEFAULT_LIMIT : parsed,
      cursor,
    );
  }
}
