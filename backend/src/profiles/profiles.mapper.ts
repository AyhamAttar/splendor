import type { PublicProfile } from "./profiles.types";

/** Project any user-ish row to the viewer-agnostic public profile (no email). */
export function toPublicProfile(user: {
  id: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
  createdAt: Date;
}): PublicProfile {
  return {
    id: user.id,
    displayName: user.displayName,
    handle: user.handle,
    avatar: user.avatar,
    createdAt: user.createdAt,
  };
}
