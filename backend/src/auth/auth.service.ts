import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "./token.service";
import { GuestService } from "./guest.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { toUserProfile } from "./user-profile.mapper";
import type { IssuedSession, UserProfile } from "./types";

const BCRYPT_COST = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly guests: GuestService,
  ) {}

  /**
   * Register an account. If a valid guest token is supplied the guest identity
   * is claimed by the new user (guest → account upgrade), so games the guest
   * played — linked via `GamePlayer.guestId` — remain attributable to them.
   */
  async register(
    dto: RegisterDto,
    guestToken: string | undefined,
    userAgent: string | undefined,
  ): Promise<IssuedSession> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: "EMAIL_TAKEN",
        message: "That email is already registered.",
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: dto.displayName?.trim() || null,
      },
    });

    if (guestToken) {
      try {
        const { guestId } = await this.guests.validate(guestToken);
        // Only claim a guest that isn't already linked to another account.
        await this.prisma.guestIdentity.updateMany({
          where: { id: guestId, userId: null },
          data: { userId: user.id },
        });
      } catch {
        // A bad/expired guest token shouldn't fail an otherwise-valid signup.
      }
    }

    return this.issueSession(user, userAgent);
  }

  async login(
    dto: LoginDto,
    userAgent: string | undefined,
  ): Promise<IssuedSession> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Same generic error whether the email is unknown or the password is wrong,
    // and always run a compare to blunt timing/enumeration signals.
    const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinva";
    const ok = await bcrypt.compare(dto.password, hash);
    if (!user || !user.passwordHash || !ok) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Incorrect email or password.",
      });
    }
    return this.issueSession(user, userAgent);
  }

  async refresh(
    rawRefresh: string,
    userAgent: string | undefined,
  ): Promise<IssuedSession> {
    const { userId, raw, expiresAt } = await this.tokens.rotateRefreshToken(
      rawRefresh,
      userAgent,
    );
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({
        code: "INVALID_REFRESH",
        message: "Invalid refresh token.",
      });
    }
    return {
      user: toUserProfile(user),
      accessToken: await this.tokens.signAccessToken(user),
      refreshToken: raw,
      refreshExpiresAt: expiresAt,
    };
  }

  async logout(rawRefresh: string | undefined): Promise<void> {
    if (rawRefresh) await this.tokens.revokeRefreshToken(rawRefresh);
  }

  async me(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Account no longer exists.",
      });
    }
    return toUserProfile(user);
  }

  private async issueSession(
    user: User,
    userAgent: string | undefined,
  ): Promise<IssuedSession> {
    const accessToken = await this.tokens.signAccessToken(user);
    const { raw, expiresAt } = await this.tokens.issueRefreshToken(
      user.id,
      userAgent,
    );
    return {
      user: toUserProfile(user),
      accessToken,
      refreshToken: raw,
      refreshExpiresAt: expiresAt,
    };
  }
}
