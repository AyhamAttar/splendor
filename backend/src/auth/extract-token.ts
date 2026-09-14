import type { Request } from "express";

/** Pull the bearer token out of an `Authorization: Bearer <token>` header. */
export function extractBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}
