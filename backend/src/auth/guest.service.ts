import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import type { GuestIdentity } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { GuestProfile, GuestTokenPayload } from "./types";

/**
 * Durable per-device guest identity. A guest holds a signed, non-expiring JWT
 * whose `jti` is stored on the `GuestIdentity` row, so the token is both
 * tamper-evident (signature) and revocable (jti mismatch → rejected). A guest
 * can later be upgraded to a full account (see AuthService.register) without
 * losing their game history, which hangs off `GamePlayer.guestId`.
 */
@Injectable()
export class GuestService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private secret(): string {
    const value = this.config.get<string>("GUEST_TOKEN_SECRET");
    if (value) return value;
    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new Error("GUEST_TOKEN_SECRET must be set in production.");
    }
    return "dev-insecure-secret::GUEST_TOKEN_SECRET";
  }

  private toProfile(row: GuestIdentity): GuestProfile {
    return { id: row.id, createdAt: row.createdAt };
  }

  /** Create a fresh guest identity and its signed token. */
  async issue(): Promise<{ guestToken: string; guest: GuestProfile }> {
    const jti = randomBytes(24).toString("base64url");
    const guest = await this.prisma.guestIdentity.create({
      data: { token: jti },
    });
    const guestToken = await this.jwt.signAsync(
      { sub: guest.id, typ: "guest", jti } satisfies GuestTokenPayload,
      { secret: this.secret() }, // no expiresIn → durable
    );
    return { guestToken, guest: this.toProfile(guest) };
  }

  /**
   * Return an existing guest (touching `lastSeen`) when a valid token is
   * presented, otherwise mint a new one. Idempotent entry point for the client
   * on first load / reload.
   */
  async ensure(
    rawToken?: string,
  ): Promise<{ guestToken: string; guest: GuestProfile }> {
    if (rawToken) {
      try {
        const { guestId } = await this.validate(rawToken);
        const guest = await this.prisma.guestIdentity.update({
          where: { id: guestId },
          data: { lastSeen: new Date() },
        });
        return { guestToken: rawToken, guest: this.toProfile(guest) };
      } catch {
        // Fall through and issue a new identity for an invalid/stale token.
      }
    }
    return this.issue();
  }

  /**
   * Verify a guest token's signature and that its `jti` still matches the stored
   * row. Read-only (no writes) so it is cheap to call from a guard. Throws
   * UnauthorizedException on any failure.
   */
  async validate(rawToken: string): Promise<{ guestId: string }> {
    let payload: GuestTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<GuestTokenPayload>(rawToken, {
        secret: this.secret(),
      });
    } catch {
      throw new UnauthorizedException({
        code: "INVALID_GUEST",
        message: "Invalid guest token.",
      });
    }
    if (payload.typ !== "guest") {
      throw new UnauthorizedException({
        code: "INVALID_GUEST",
        message: "Invalid guest token.",
      });
    }
    const guest = await this.prisma.guestIdentity.findUnique({
      where: { id: payload.sub },
    });
    if (!guest || guest.token !== payload.jti) {
      throw new UnauthorizedException({
        code: "INVALID_GUEST",
        message: "Guest identity not found.",
      });
    }
    return { guestId: guest.id };
  }
}
