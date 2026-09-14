import { Injectable } from "@nestjs/common";
import type { Socket } from "socket.io";
import { TokenService } from "./token.service";
import { GuestService } from "./guest.service";
import { GUEST_TOKEN_HEADER } from "./auth.constants";
import type { AuthenticatedIdentity } from "./types";

/**
 * Resolve an authenticated identity from a Socket.IO handshake. Shared by the
 * game gateway (Phase 2) and the lobby gateway (Phase 3) so both apply the same
 * rule as the HTTP `GuestOrUserGuard`: an access-token JWT wins; otherwise the
 * durable guest token (from the handshake `auth` payload or the guest header).
 * Returns `null` when neither presents a valid identity.
 */
@Injectable()
export class SocketIdentityService {
  constructor(
    private readonly tokens: TokenService,
    private readonly guests: GuestService,
  ) {}

  async resolve(socket: Socket): Promise<AuthenticatedIdentity | null> {
    const auth = (socket.handshake.auth ?? {}) as Record<
      string,
      string | undefined
    >;

    const bearer = auth.accessToken;
    if (bearer) {
      try {
        const payload = await this.tokens.verifyAccessToken(bearer);
        return { userId: payload.sub };
      } catch {
        // Fall through to guest.
      }
    }

    const guestToken =
      auth.guestToken ??
      (socket.handshake.headers[GUEST_TOKEN_HEADER] as string | undefined);
    if (guestToken) {
      try {
        const { guestId } = await this.guests.validate(guestToken);
        return { guestId };
      } catch {
        // Fall through — no valid identity.
      }
    }

    return null;
  }
}
