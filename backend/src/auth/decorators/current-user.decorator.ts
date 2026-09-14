import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "../types";

/** Injects `req.user` (set by `JwtAuthGuard`) into a route handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<
      Request & { user: AuthenticatedUser }
    >();
    return req.user;
  },
);
