import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Injectable, UseGuards } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { SocketIdentityService } from "../auth/socket-identity.service";
import { RoomRepository } from "./room.repository";
import { findMember, toRoomView } from "./rooms.mapper";
import { WsValidationPipe } from "../common/ws-validation.pipe";
import { WsRateLimitGuard } from "../common/ws-rate-limit.guard";
import { RoomSubscribeDto } from "./dto/room-subscribe.dto";
import type { RoomView } from "./rooms.types";
import type { AuthenticatedIdentity } from "../auth/types";

const ROOM = (code: string) => `room:${code}`;

interface LobbySocketData {
  identity: AuthenticatedIdentity;
  roomCode: string;
  memberId: string;
}

/**
 * Realtime lobby transport (Phase 3). Mirrors the GameGateway pattern: clients
 * subscribe to `room:{code}` and receive the neutral room snapshot on every
 * change (member join/leave, ready, seat-count, and the start transition which
 * carries `status: "in_game"` + `gameId` so everyone routes into the game).
 *
 * Room mutations still go through the validated REST pipeline (RoomsController);
 * this gateway only pushes the resulting state and connection presence.
 */
// CORS for the socket is enforced centrally by CorsIoAdapter (env allow-list).
@Injectable()
@UseGuards(WsRateLimitGuard)
@WebSocketGateway()
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly identities: SocketIdentityService,
    private readonly rooms: RoomRepository,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const identity = await this.identities.resolve(socket);
    if (!identity) {
      socket.disconnect(true);
      return;
    }
    (socket.data as Partial<LobbySocketData>).identity = identity;
  }

  handleDisconnect(socket: Socket): void {
    const data = socket.data as Partial<LobbySocketData>;
    if (data.roomCode) this.emitPresence(data.roomCode);
  }

  /** Subscribe to a room the caller is a member of. */
  @SubscribeMessage("room:subscribe")
  async onSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new WsValidationPipe()) payload: RoomSubscribeDto,
  ): Promise<void> {
    const identity =
      (socket.data as Partial<LobbySocketData>).identity ??
      (await this.identities.resolve(socket));
    if (!identity) {
      socket.emit("room:error", { code: "UNAUTHORIZED", message: "No valid identity." });
      socket.disconnect(true);
      return;
    }

    const code = payload.code;
    const room = await this.rooms.findByCode(code);
    if (!room) {
      socket.emit("room:error", { code: "ROOM_NOT_FOUND", message: "Room not found." });
      return;
    }
    const member = findMember(room, identity);
    if (!member) {
      socket.emit("room:error", { code: "NOT_A_MEMBER", message: "You are not in this room." });
      return;
    }

    const data = socket.data as LobbySocketData;
    data.roomCode = room.code;
    data.memberId = member.id;
    await socket.join(ROOM(room.code));

    socket.emit("room:state", toRoomView(room));
    this.emitPresence(room.code);
  }

  @SubscribeMessage("room:unsubscribe")
  async onUnsubscribe(@ConnectedSocket() socket: Socket): Promise<void> {
    const data = socket.data as Partial<LobbySocketData>;
    if (!data.roomCode) return;
    const code = data.roomCode;
    await socket.leave(ROOM(code));
    data.roomCode = undefined;
    data.memberId = undefined;
    this.emitPresence(code);
  }

  // --- Server → client push (called by RoomsService after each mutation) -----

  /** Push the latest neutral snapshot to everyone in the room. */
  broadcast(view: RoomView): void {
    this.server?.to(ROOM(view.code)).emit("room:state", view);
  }

  private emitPresence(code: string): void {
    const room = this.server?.sockets.adapter.rooms.get(ROOM(code));
    const online: string[] = [];
    if (room) {
      for (const socketId of room) {
        const s = this.server.sockets.sockets.get(socketId);
        const memberId = (s?.data as Partial<LobbySocketData> | undefined)?.memberId;
        if (memberId) online.push(memberId);
      }
    }
    this.server?.to(ROOM(code)).emit("room:presence", { online });
  }
}
