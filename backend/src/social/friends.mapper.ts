import type { FriendshipWithUsers, PublicUserRow } from "./friends.repository";
import type { PresenceTracker } from "./presence.tracker";
import type {
  BlockedView,
  FriendView,
  RequestView,
} from "./friends.types";

/** The endpoint of an edge that ISN'T the caller. */
export function otherUser(
  edge: FriendshipWithUsers,
  selfId: string,
): PublicUserRow {
  return edge.requesterId === selfId ? edge.addressee : edge.requester;
}

export function toFriendView(
  edge: FriendshipWithUsers,
  selfId: string,
  presence: PresenceTracker,
): FriendView {
  const u = otherUser(edge, selfId);
  return {
    friendshipId: edge.id,
    userId: u.id,
    displayName: u.displayName,
    handle: u.handle,
    avatar: u.avatar,
    online: presence.isOnline(u.id),
    since: edge.updatedAt,
  };
}

export function toRequestView(
  edge: FriendshipWithUsers,
  selfId: string,
): RequestView {
  const u = otherUser(edge, selfId);
  return {
    id: edge.id,
    userId: u.id,
    displayName: u.displayName,
    handle: u.handle,
    avatar: u.avatar,
    createdAt: edge.createdAt,
  };
}

export function toBlockedView(
  edge: FriendshipWithUsers,
  selfId: string,
): BlockedView {
  const u = otherUser(edge, selfId);
  return {
    userId: u.id,
    displayName: u.displayName,
    handle: u.handle,
    avatar: u.avatar,
  };
}
