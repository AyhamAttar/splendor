import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { RoomsService } from "./rooms.service";
import {
  CreateRoomDto,
  JoinRoomDto,
  KickDto,
  ReadyDto,
  SeatsDto,
} from "./dto/room.dto";
import { GuestOrUserGuard } from "../auth/guards/guest-or-user.guard";
import { CurrentIdentity } from "../auth/decorators/current-identity.decorator";
import type { AuthenticatedIdentity } from "../auth/types";

/** Invite codes are stored uppercase; normalise the path param before lookup. */
function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

@Controller("rooms")
@UseGuards(GuestOrUserGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  create(
    @Body() dto: CreateRoomDto,
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ) {
    return this.rooms.create(identity, dto.name.trim());
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(":code/join")
  @HttpCode(200)
  join(
    @Param("code") code: string,
    @Body() dto: JoinRoomDto,
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ) {
    return this.rooms.join(normalizeCode(code), identity, dto.name.trim());
  }

  @Post(":code/leave")
  @HttpCode(204)
  leave(
    @Param("code") code: string,
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ) {
    return this.rooms.leave(normalizeCode(code), identity);
  }

  @Post(":code/ready")
  @HttpCode(200)
  ready(
    @Param("code") code: string,
    @Body() dto: ReadyDto,
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ) {
    return this.rooms.setReady(normalizeCode(code), identity, dto.ready);
  }

  @Post(":code/seats")
  @HttpCode(200)
  seats(
    @Param("code") code: string,
    @Body() dto: SeatsDto,
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ) {
    return this.rooms.setMaxPlayers(normalizeCode(code), identity, dto.maxPlayers);
  }

  @Post(":code/kick")
  @HttpCode(200)
  kick(
    @Param("code") code: string,
    @Body() dto: KickDto,
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ) {
    return this.rooms.kick(normalizeCode(code), identity, dto.memberId);
  }

  @Post(":code/start")
  @HttpCode(200)
  start(
    @Param("code") code: string,
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ) {
    return this.rooms.start(normalizeCode(code), identity);
  }

  @Get(":code")
  get(
    @Param("code") code: string,
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ) {
    return this.rooms.getView(normalizeCode(code), identity);
  }
}
