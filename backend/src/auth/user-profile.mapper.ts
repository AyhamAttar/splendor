import type { User } from "@prisma/client";
import type { UserProfile } from "./types";

/**
 * Map a Prisma `User` row to the self-facing `UserProfile` returned by auth and
 * profile endpoints. Includes `email` (private to the account owner); the
 * viewer-agnostic `PublicProfile` (see profiles) deliberately omits it.
 */
export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    handle: user.handle,
    avatar: user.avatar,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt,
  };
}
