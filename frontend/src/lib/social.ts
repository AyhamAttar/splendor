import { authedFetch } from "./auth";

/** An accepted friend, with presence (as of the last fetch; live updates arrive
 *  over the social socket). */
export interface FriendView {
  friendshipId: string;
  userId: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
  online: boolean;
  since: string;
}

/** A pending request, incoming or outgoing, describing the OTHER user. */
export interface RequestView {
  id: string;
  userId: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
  createdAt: string;
}

export interface BlockedView {
  userId: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
}

export interface FriendsOverview {
  friends: FriendView[];
  incoming: RequestView[];
  outgoing: RequestView[];
  blocked: BlockedView[];
}

export interface SendRequestResult {
  accepted: boolean;
}

/**
 * Friends API — accounts only (guests have no friends). All calls go through
 * `authedFetch` (access token, silent refresh). Mirrors the backend
 * FriendsController surface.
 */
export const friendsApi = {
  overview: () => authedFetch<FriendsOverview>("/friends"),

  sendRequest: (handle: string) =>
    authedFetch<SendRequestResult>("/friends/requests", {
      method: "POST",
      body: { handle },
    }),

  accept: (id: string) =>
    authedFetch<void>(`/friends/requests/${id}/accept`, { method: "POST" }),

  decline: (id: string) =>
    authedFetch<void>(`/friends/requests/${id}/decline`, { method: "POST" }),

  /** Remove a friend, cancel an outgoing request, or decline an incoming one. */
  remove: (userId: string) =>
    authedFetch<void>(`/friends/${userId}`, { method: "DELETE" }),

  block: (userId: string) =>
    authedFetch<void>(`/friends/${userId}/block`, { method: "POST" }),

  unblock: (userId: string) =>
    authedFetch<void>(`/friends/${userId}/block`, { method: "DELETE" }),

  /** Invite a friend into a room the caller is in, by invite code. */
  invite: (userId: string, code: string) =>
    authedFetch<void>(`/friends/${userId}/invite`, {
      method: "POST",
      body: { code },
    }),
};
