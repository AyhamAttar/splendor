/** Name of the httpOnly cookie carrying the (rotating) refresh token. */
export const REFRESH_COOKIE = "refresh_token";

/** Header the client uses to present its durable guest token. */
export const GUEST_TOKEN_HEADER = "x-guest-token";

/** Path the refresh cookie is scoped to — only the auth endpoints need it. */
export const REFRESH_COOKIE_PATH = "/auth";
