import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { TokenService } from "../token.service";
import { GuestService } from "../guest.service";
import { extractBearer } from "../extract-token";
import { GUEST_TOKEN_HEADER } from "../auth.constants";
import type { AuthenticatedIdentity, AuthenticatedUser } from "../types";

/**
 * Like GuestOrUserGuard, but never throws — attaches `req.identity` when a
 * valid access or guest token is present, and silently continues otherwise.
 * Used on game routes that must still work for legacy hotseat (no token)
 * while allowing online games to read the caller's identity.
 */
@Injectable()
export class OptionalIdentityGuard implements CanActivate {
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
        // Fall through — maybe a guest token.
      }
    }

    const guestToken = req.headers[GUEST_TOKEN_HEADER];
    if (typeof guestToken === "string" && guestToken) {
      try {
        const { guestId } = await this.guests.validate(guestToken);
        req.identity = { guestId };
        return true;
      } catch {
        // Fall through — anonymous / hotseat caller is fine.
      }
    }

    // No identity present — that is acceptable for hotseat routes.
    return true;
  }
}
