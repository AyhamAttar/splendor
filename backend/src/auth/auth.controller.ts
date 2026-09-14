import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import { AuthService } from "./auth.service";
import { GuestService } from "./guest.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import {
  GUEST_TOKEN_HEADER,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from "./auth.constants";
import type { AuthenticatedUser } from "./types";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly guests: GuestService,
    private readonly config: ConfigService,
  ) {}

  /** Issue (or refresh) a durable guest identity. Idempotent for a valid token. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("guest")
  @HttpCode(200)
  guest(@Headers(GUEST_TOKEN_HEADER) token?: string) {
    return this.guests.ensure(token);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Headers(GUEST_TOKEN_HEADER) guestToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.register(
      dto,
      guestToken,
      req.headers["user-agent"],
    );
    this.setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(dto, req.headers["user-agent"]);
    this.setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
    return { user: session.user, accessToken: session.accessToken };
  }

  /** Rotate the refresh cookie and mint a fresh access token (silent refresh). */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) {
      throw new UnauthorizedException({
        code: "NO_REFRESH",
        message: "No refresh session.",
      });
    }
    try {
      const session = await this.auth.refresh(raw, req.headers["user-agent"]);
      this.setRefreshCookie(
        res,
        session.refreshToken,
        session.refreshExpiresAt,
      );
      return { user: session.user, accessToken: session.accessToken };
    } catch (err) {
      // The presented cookie is now invalid (rotated, revoked, or reused) —
      // drop it so the client falls back to guest/anonymous cleanly.
      this.clearRefreshCookie(res);
      throw err;
    }
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    this.clearRefreshCookie(res);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return { user: await this.auth.me(user.userId) };
  }

  private cookieOptions(expiresAt?: Date): CookieOptions {
    const sameSite = (this.config.get<string>("COOKIE_SAMESITE") ??
      "lax") as CookieOptions["sameSite"];
    return {
      httpOnly: true,
      sameSite,
      secure: this.config.get<string>("COOKIE_SECURE") === "true",
      domain: this.config.get<string>("COOKIE_DOMAIN") || undefined,
      path: REFRESH_COOKIE_PATH,
      ...(expiresAt ? { expires: expiresAt } : {}),
    };
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE, token, this.cookieOptions(expiresAt));
  }

  private clearRefreshCookie(res: Response): void {
    // clearCookie must be given the same path/domain/flags used when setting it.
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }
}
