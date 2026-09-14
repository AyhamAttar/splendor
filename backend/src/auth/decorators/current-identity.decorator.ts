import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedIdentity } from "../types";

/** Injects `req.identity` (set by `GuestOrUserGuard`) into a route handler param. */
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedIdentity => {
    const req = ctx.switchToHttp().getRequest<
      Request & { identity: AuthenticatedIdentity }
    >();
    return req.identity;
  },
);
