/** Claims carried by a short-lived access-token JWT (Authorization: Bearer). */
export interface AccessTokenPayload {
  sub: string;
  email: string | null;
  typ: "access";
}

/** Claims carried by the durable, signed guest token. `jti` is matched against
 *  `GuestIdentity.token` so a guest token can be revoked/rotated server-side. */
export interface GuestTokenPayload {
  sub: string;
  typ: "guest";
  jti: string;
}

/** Attached to the request by `JwtAuthGuard` for user-authenticated routes. */
export interface AuthenticatedUser {
  userId: string;
  email: string | null;
}

/** Attached by `GuestOrUserGuard`: exactly one of `userId`/`guestId` is set. */
export interface AuthenticatedIdentity {
  userId?: string;
  guestId?: string;
}

/** Public shape of a registered account returned to the client. */
export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  /** Unique public @handle (Phase 4); null until claimed. */
  handle: string | null;
  /** Avatar image URL (Phase 4); null if unset. */
  avatar: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

/** Public shape of a guest identity returned to the client. */
export interface GuestProfile {
  id: string;
  createdAt: Date;
}

/** A freshly issued session: an access token plus the raw refresh token (the
 *  controller turns the refresh token into an httpOnly cookie; it never reaches
 *  the response body). */
export interface IssuedSession {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}
