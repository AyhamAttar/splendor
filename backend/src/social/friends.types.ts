/** An accepted friend, with live presence. */
export interface FriendView {
  /** The friendship row id (used to key list updates). */
  friendshipId: string;
  /** The friend's account id. */
  userId: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
  online: boolean;
  /** When the friendship was accepted. */
  since: Date;
}

/** A pending friend request (incoming or outgoing), showing the OTHER user. */
export interface RequestView {
  /** The friendship row id — the handle used to accept/decline. */
  id: string;
  userId: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
  createdAt: Date;
}

/** A user the caller has blocked. */
export interface BlockedView {
  userId: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
}

/** The full `GET /friends` payload. */
export interface FriendsOverview {
  friends: FriendView[];
  /** Requests awaiting the caller's response. */
  incoming: RequestView[];
  /** Requests the caller has sent, still pending. */
  outgoing: RequestView[];
  /** Users the caller has blocked. */
  blocked: BlockedView[];
}

/** Result of sending a friend request. `accepted` is true when the request
 *  auto-completed a mutual pair (the other user had already requested us). */
export interface SendRequestResult {
  accepted: boolean;
}

/** Payload pushed to a friend when invited to a room. */
export interface RoomInvitePush {
  code: string;
  from: {
    userId: string;
    displayName: string | null;
    handle: string | null;
    avatar: string | null;
  };
}
