import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";
import { GuestService } from "./guest.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { GuestOrUserGuard } from "./guards/guest-or-user.guard";
import { OptionalIdentityGuard } from "./guards/optional-identity.guard";
import { SocketIdentityService } from "./socket-identity.service";

/**
 * Identity & accounts (Phase 1): durable guest identities plus email/password
 * accounts with rotating JWT access + refresh tokens. Guards and token/guest
 * services are exported so later phases (game seat ownership, rooms) can
 * authorize against the same identities.
 */
@Module({
  // Secrets are passed per-sign/verify call (access vs guest use different
  // secrets), so JwtModule needs no global signing config here.
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    GuestService,
    JwtAuthGuard,
    GuestOrUserGuard,
    OptionalIdentityGuard,
    SocketIdentityService,
  ],
  exports: [
    TokenService,
    GuestService,
    JwtAuthGuard,
    GuestOrUserGuard,
    OptionalIdentityGuard,
    SocketIdentityService,
  ],
})
export class AuthModule {}
