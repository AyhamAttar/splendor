import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { GamesService } from "../games/games.service";
import { RoomRepository, SEAT_TAKEN, type RoomWithMembers } from "./room.repository";
import { LobbyGateway } from "./lobby.gateway";
import {
  findMember,
  isHostIdentity,
  toCallerView,
  toRoomView,
} from "./rooms.mapper";
import type { RoomViewForCaller } from "./rooms.types";
import type { AuthenticatedIdentity } from "../auth/types";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

/**
 * Private lobby rooms (Phase 3, Major Task 7). A host creates a room, others
 * join by invite code, everyone readies up, and the host starts — which spins
 * up an ONLINE game (GamesService.createOnline) with seats pre-mapped to the
 * members' identities and routes everyone to the board. All reads/writes are
 * identity-scoped; realtime fan-out happens through LobbyGateway.
 */
@Injectable()
export class RoomsService {
  constructor(
    private readonly repo: RoomRepository,
    private readonly games: GamesService,
    private readonly lobby: LobbyGateway,
  ) {}

  async create(
    identity: AuthenticatedIdentity,
    name: string,
  ): Promise<RoomViewForCaller> {
    const code = await this.repo.newCode();
    const room = await this.repo.createRoom(code, identity, name, MAX_PLAYERS);
    const member = findMember(room, identity)!;
    return toCallerView(room, member);
  }

  async join(
    code: string,
    identity: AuthenticatedIdentity,
    name: string,
  ): Promise<RoomViewForCaller> {
    let room = await this.requireRoom(code);

    // Idempotent rejoin — already seated (e.g. page reload, second tab).
    const existing = findMember(room, identity);
    if (existing) return toCallerView(room, existing);

    if (room.status !== "WAITING") {
      throw new ConflictException({
        code: "ROOM_NOT_JOINABLE",
        message: "This room is no longer accepting players.",
      });
    }

    // Seat the newcomer at the lowest free slot; retry if a rival grabbed it.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (room.members.length >= room.maxPlayers) {
        throw new ConflictException({
          code: "ROOM_FULL",
          message: "This room is full.",
        });
      }
      const seat = this.lowestFreeSeat(room);
      try {
        await this.repo.addMember(room.id, seat, identity, name);
        break;
      } catch (e) {
        if ((e as Error).message === SEAT_TAKEN) {
          room = await this.requireRoom(code);
          continue;
        }
        throw e;
      }
    }

    room = await this.requireRoom(code);
    this.lobby.broadcast(toRoomView(room));
    const member = findMember(room, identity)!;
    return toCallerView(room, member);
  }

  async leave(code: string, identity: AuthenticatedIdentity): Promise<void> {
    const room = await this.repo.findByCode(code);
    if (!room) return;
    const member = findMember(room, identity);
    // Only waiting-room seats can be vacated here; an in-progress game is left
    // via the game itself (abandonment is Phase 2/6 territory).
    if (!member || room.status !== "WAITING") return;

    await this.repo.removeMember(member.id);

    const fresh = await this.repo.findByCode(code);
    if (!fresh || fresh.members.length === 0) {
      // Empty room — tear it down.
      if (fresh) await this.repo.deleteRoom(fresh.id);
      this.lobby.broadcast({ ...toRoomView(room), status: "closed", members: [] });
      return;
    }

    // If the host left, hand the crown to the earliest remaining seat.
    if (member.isHost) {
      await this.repo.promoteHost(fresh.id, fresh.members[0]);
    }
    this.lobby.broadcast(toRoomView(await this.requireRoom(code)));
  }

  async setReady(
    code: string,
    identity: AuthenticatedIdentity,
    ready: boolean,
  ): Promise<RoomViewForCaller> {
    const room = await this.requireRoom(code);
    const member = this.requireMember(room, identity);
    // The host is implicitly ready; only non-hosts toggle.
    if (!member.isHost) await this.repo.setReady(member.id, ready);
    const fresh = await this.requireRoom(code);
    this.lobby.broadcast(toRoomView(fresh));
    return toCallerView(fresh, this.requireMember(fresh, identity));
  }

  async setMaxPlayers(
    code: string,
    identity: AuthenticatedIdentity,
    maxPlayers: number,
  ): Promise<RoomViewForCaller> {
    const room = await this.requireHost(code, identity);
    if (room.status !== "WAITING") {
      throw new ConflictException({
        code: "ROOM_NOT_JOINABLE",
        message: "The game has already started.",
      });
    }
    if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) {
      throw new BadRequestException({
        code: "INVALID_SEAT_COUNT",
        message: `Seats must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}.`,
      });
    }
    if (maxPlayers < room.members.length) {
      throw new ConflictException({
        code: "TOO_FEW_SEATS",
        message: "Remove players before lowering the seat count.",
      });
    }
    await this.repo.setMaxPlayers(room.id, maxPlayers);
    const fresh = await this.requireRoom(code);
    this.lobby.broadcast(toRoomView(fresh));
    return toCallerView(fresh, this.requireMember(fresh, identity));
  }

  async kick(
    code: string,
    identity: AuthenticatedIdentity,
    targetMemberId: string,
  ): Promise<RoomViewForCaller> {
    const room = await this.requireHost(code, identity);
    if (room.status !== "WAITING") {
      throw new ConflictException({
        code: "ROOM_NOT_JOINABLE",
        message: "The game has already started.",
      });
    }
    const target = room.members.find((m) => m.id === targetMemberId);
    if (!target) {
      throw new NotFoundException({
        code: "MEMBER_NOT_FOUND",
        message: "That player is not in the room.",
      });
    }
    if (target.isHost) {
      throw new ForbiddenException({
        code: "CANNOT_KICK_HOST",
        message: "The host cannot be removed.",
      });
    }
    await this.repo.removeMember(target.id);
    const fresh = await this.requireRoom(code);
    this.lobby.broadcast(toRoomView(fresh));
    return toCallerView(fresh, this.requireMember(fresh, identity));
  }

  async start(
    code: string,
    identity: AuthenticatedIdentity,
  ): Promise<{ gameId: string }> {
    const room = await this.requireHost(code, identity);
    if (room.status !== "WAITING") {
      throw new ConflictException({
        code: "ALREADY_STARTED",
        message: "The game has already started.",
      });
    }
    if (room.members.length < MIN_PLAYERS) {
      throw new ConflictException({
        code: "NOT_ENOUGH_PLAYERS",
        message: `Need at least ${MIN_PLAYERS} players to start.`,
      });
    }
    if (room.members.some((m) => !m.isHost && !m.ready)) {
      throw new ConflictException({
        code: "PLAYERS_NOT_READY",
        message: "All players must be ready before starting.",
      });
    }

    // Engine seat order follows the room's seat order (host = seat 0 = first turn).
    const participants = [...room.members]
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((m) => ({
        identity: {
          ...(m.userId ? { userId: m.userId } : {}),
          ...(m.guestId ? { guestId: m.guestId } : {}),
        } as AuthenticatedIdentity,
        name: m.name,
      }));

    const { gameId } = await this.games.createOnline(participants);
    await this.repo.transitionToGame(room.id, gameId);
    this.lobby.broadcast(toRoomView(await this.requireRoom(code)));
    return { gameId };
  }

  async getView(
    code: string,
    identity: AuthenticatedIdentity,
  ): Promise<RoomViewForCaller> {
    const room = await this.requireRoom(code);
    return toCallerView(room, this.requireMember(room, identity));
  }

  // --- helpers ---------------------------------------------------------------

  private lowestFreeSeat(room: RoomWithMembers): number {
    const taken = new Set(room.members.map((m) => m.seatIndex));
    for (let i = 0; i < room.maxPlayers; i++) if (!taken.has(i)) return i;
    return room.members.length; // should be unreachable (caller checks capacity)
  }

  private async requireRoom(code: string): Promise<RoomWithMembers> {
    const room = await this.repo.findByCode(code);
    if (!room) {
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "Room not found.",
      });
    }
    return room;
  }

  private requireMember(room: RoomWithMembers, identity: AuthenticatedIdentity) {
    const member = findMember(room, identity);
    if (!member) {
      throw new ForbiddenException({
        code: "NOT_A_MEMBER",
        message: "You are not a member of this room.",
      });
    }
    return member;
  }

  private async requireHost(
    code: string,
    identity: AuthenticatedIdentity,
  ): Promise<RoomWithMembers> {
    const room = await this.requireRoom(code);
    if (!isHostIdentity(room, identity)) {
      throw new ForbiddenException({
        code: "NOT_HOST",
        message: "Only the host can do that.",
      });
    }
    return room;
  }
}
