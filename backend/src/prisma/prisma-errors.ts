import { Prisma } from "@prisma/client";

/**
 * True when `e` is a Prisma known-request error with the given code
 * (e.g. "P2002" unique violation, "P2003" FK violation, "P2025" record not
 * found). Small shared guard so services don't repeat the `instanceof` check.
 */
export function isPrismaError(e: unknown, code: string): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;
}
