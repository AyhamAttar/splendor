import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { TokenService } from "../token.service";
import { GuestService } from "../guest.service";
import { extractBearer } from "../extract-token";
import { GUEST_TOKEN_HEADER } from "../auth.constants";
import type { AuthenticatedIdentity, AuthenticatedUser } from "../types";

/**
 * Accepts either an access-token JWT (a registered user) or a durable guest
 * token, and attaches `req.identity` with exactly one of `userId`/`guestId`.
 * This is the guard online game/room endpoints use from Phase 2 onward, where a
 * seat may be owned by a guest or an account alike.
 */
@Injectable()
export class GuestOrUserGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly guests: GuestService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { identity?: AuthenticatedIdentity; user?: AuthenticatedUser }
    >();

    const bearer = extractBearer(req);
    if (bearer) {
      try {
        const payload = await this.tokens.verifyAccessToken(bearer);
        req.user = { userId: payload.sub, email: payload.email };
        req.identity = { userId: payload.sub };
        return true;
      } catch {
        // Fall through to try a guest token.
      }
    }

    const guestToken = req.headers[GUEST_TOKEN_HEADER];
    if (typeof guestToken === "string" && guestToken) {
      try {
        const { guestId } = await this.guests.validate(guestToken);
        req.identity = { guestId };
        return true;
      } catch {
        // Fall through to the rejection below.
      }
    }

    throw new UnauthorizedException({
      code: "NO_IDENTITY",
      message: "A guest or user identity is required.",
    });
  }
}
