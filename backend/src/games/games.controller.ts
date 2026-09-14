import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { GamesService } from "./games.service";
import { CreateGameDto } from "./dto/create-game.dto";
import { TurnCommandDto } from "./dto/turn-command.dto";
import { OptionalIdentityGuard } from "../auth/guards/optional-identity.guard";
import type { AuthenticatedIdentity } from "../auth/types";

type AuthReq = Request & { identity?: AuthenticatedIdentity };

@Controller()
@UseGuards(OptionalIdentityGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post("games")
  create(@Body() dto: CreateGameDto) {
    return this.games.create(dto);
  }

  @Get("games/:gameId")
  getState(
    @Param("gameId") gameId: string,
    @Headers("x-session-token") token: string,
    @Req() req: AuthReq,
  ) {
    return this.games.getState(gameId, token, req.identity);
  }

  @Post("games/:gameId/actions")
  @HttpCode(200)
  act(
    @Param("gameId") gameId: string,
    @Headers("x-session-token") token: string,
    @Body() dto: TurnCommandDto,
    @Req() req: AuthReq,
  ) {
    return this.games.act(gameId, token, dto, req.identity);
  }

  @Get("resume/:token")
  resume(@Param("token") token: string) {
    return this.games.resume(token);
  }

  @Delete("games/:gameId")
  @HttpCode(204)
  remove(
    @Param("gameId") gameId: string,
    @Headers("x-session-token") token: string,
    @Req() req: AuthReq,
  ) {
    return this.games.remove(gameId, token, req.identity);
  }
}
