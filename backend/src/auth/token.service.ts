import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { AccessTokenPayload } from "./types";

/**
 * Owns the token lifecycle: signing/verifying short-lived access JWTs and
 * minting/rotating/revoking opaque refresh tokens. Refresh tokens are random
 * high-entropy strings stored only as SHA-256 hashes; the raw value lives solely
 * in the client's httpOnly cookie.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Reads a signing secret from config. In production a missing secret is fatal
   * (no silent insecure fallback); in dev/test we derive a deterministic
   * placeholder so the app boots without a full .env.
   */
  private secret(key: string): string {
    const value = this.config.get<string>(key);
    if (value) return value;
    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new Error(`${key} must be set in production.`);
    }
    return `dev-insecure-secret::${key}`;
  }

  async signAccessToken(user: {
    id: string;
    email: string | null;
  }): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      typ: "access",
    };
    return this.jwt.signAsync(payload, {
      secret: this.secret("JWT_ACCESS_SECRET"),
      // Cast the config string to the exact `ms`-style union `expiresIn` expects.
      expiresIn: (this.config.get<string>("JWT_ACCESS_TTL") ??
        "15m") as JwtSignOptions["expiresIn"],
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.secret("JWT_ACCESS_SECRET"),
    });
    if (payload.typ !== "access") {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Wrong token type.",
      });
    }
    return payload;
  }

  hashRefresh(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  private refreshTtlMs(): number {
    const days = Number(this.config.get("AUTH_REFRESH_TTL_DAYS")) || 30;
    return days * 24 * 60 * 60 * 1000;
  }

  /** Mint a brand-new refresh token row and return its raw value + expiry. */
  async issueRefreshToken(
    userId: string,
    userAgent?: string,
  ): Promise<{ raw: string; expiresAt: Date }> {
    const raw = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefresh(raw),
        expiresAt,
        userAgent: userAgent?.slice(0, 255),
      },
    });
    return { raw, expiresAt };
  }

  /**
   * Rotate a presented refresh token: validate it, revoke it (linking the
   * successor), and issue a replacement. Presenting an already-revoked token is
   * treated as theft/replay and revokes the user's entire token family.
   */
  async rotateRefreshToken(
    rawOld: string,
    userAgent?: string,
  ): Promise<{ userId: string; raw: string; expiresAt: Date }> {
    const oldHash = this.hashRefresh(rawOld);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: oldHash },
    });
    if (!existing) {
      throw new UnauthorizedException({
        code: "INVALID_REFRESH",
        message: "Invalid refresh token.",
      });
    }
    if (existing.revokedAt) {
      await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedException({
        code: "REFRESH_REUSED",
        message: "Session was revoked. Please sign in again.",
      });
    }
    if (existing.expiresAt.getTime() < Date.now()) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        code: "REFRESH_EXPIRED",
        message: "Session expired. Please sign in again.",
      });
    }

    const raw = randomBytes(48).toString("base64url");
    const newHash = this.hashRefresh(raw);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedByHash: newHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: newHash,
          expiresAt,
          userAgent: userAgent?.slice(0, 255),
        },
      }),
    ]);
    return { userId: existing.userId, raw, expiresAt };
  }

  /** Revoke a single refresh token by raw value (logout). No-op if unknown. */
  async revokeRefreshToken(raw: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashRefresh(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke every active refresh token for a user (reuse detection / "sign out
   *  everywhere"). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
