import type { Room, RoomMember, RoomStatus } from "@prisma/client";
import type { RoomWithMembers } from "./room.repository";
import type {
  RoomMemberView,
  RoomStatusView,
  RoomView,
  RoomViewForCaller,
} from "./rooms.types";
import type { AuthenticatedIdentity } from "../auth/types";

function statusView(status: RoomStatus): RoomStatusView {
  switch (status) {
    case "IN_GAME":
      return "in_game";
    case "CLOSED":
      return "closed";
    default:
      return "waiting";
  }
}

function memberView(m: RoomMember): RoomMemberView {
  return {
    id: m.id,
    seatIndex: m.seatIndex,
    name: m.name,
    isHost: m.isHost,
    ready: m.ready,
    kind: m.userId ? "user" : "guest",
  };
}

/** Neutral, viewer-agnostic snapshot broadcast to a whole room. */
export function toRoomView(room: RoomWithMembers): RoomView {
  return {
    code: room.code,
    status: statusView(room.status),
    maxPlayers: room.maxPlayers,
    members: room.members.map(memberView),
    gameId: room.gameId,
  };
}

/** Does this identity own this room member row? */
export function memberOwnedBy(
  m: Pick<RoomMember, "userId" | "guestId">,
  identity: AuthenticatedIdentity,
): boolean {
  return identity.userId
    ? m.userId === identity.userId
    : m.guestId === identity.guestId;
}

/** Find the member row owned by an identity, if any. */
export function findMember(
  room: RoomWithMembers,
  identity: AuthenticatedIdentity,
): RoomMember | undefined {
  return room.members.find((m) => memberOwnedBy(m, identity));
}

/** Is this identity the room's host? */
export function isHostIdentity(
  room: Pick<Room, "hostUserId" | "hostGuestId">,
  identity: AuthenticatedIdentity,
): boolean {
  return identity.userId
    ? room.hostUserId === identity.userId
    : room.hostGuestId === identity.guestId;
}

/** REST view: the neutral snapshot plus which row belongs to the caller. */
export function toCallerView(
  room: RoomWithMembers,
  member: RoomMember,
): RoomViewForCaller {
  return {
    ...toRoomView(room),
    memberId: member.id,
    seatIndex: member.seatIndex,
    isHost: member.isHost,
  };
}
