import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { TokenService } from "../token.service";
import { extractBearer } from "../extract-token";
import type { AuthenticatedUser } from "../types";

/** Requires a valid access-token JWT. Attaches `req.user`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractBearer(req);
    if (!token) {
      throw new UnauthorizedException({
        code: "NO_TOKEN",
        message: "Authentication required.",
      });
    }
    try {
      const payload = await this.tokens.verifyAccessToken(token);
      (req as Request & { user: AuthenticatedUser }).user = {
        userId: payload.sub,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Invalid or expired token.",
      });
    }
  }
}
