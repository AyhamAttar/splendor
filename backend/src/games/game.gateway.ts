import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Injectable, OnApplicationShutdown, UseGuards } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { ConfigService } from "@nestjs/config";
import type { GameState } from "@splendor/engine";
import { redactStateFor } from "@splendor/engine";
import { SocketIdentityService } from "../auth/socket-identity.service";
import { GameRepository } from "./game.repository";
import { WsValidationPipe } from "../common/ws-validation.pipe";
import { WsRateLimitGuard } from "../common/ws-rate-limit.guard";
import { SubscribeDto } from "./dto/subscribe.dto";
import { MetricsService } from "../metrics/metrics.service";
import type { AuthenticatedIdentity } from "../auth/types";

const ROOM = (gameId: string) => `game:${gameId}`;

interface SocketData {
  identity: AuthenticatedIdentity;
  seat: number | null; // null = spectator
  gameId: string;
}

// @Injectable() is required explicitly because @WebSocketGateway() alone does not
// register the class as DI-injectable when the websockets package major version
// differs from the core package major version.
// CORS for the socket is enforced centrally by CorsIoAdapter (env allow-list).
@Injectable()
@UseGuards(WsRateLimitGuard)
@WebSocketGateway()
export class GameGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnApplicationShutdown
{
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly identities: SocketIdentityService,
    private readonly store: GameRepository,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  // The default and /social namespaces share one underlying engine, so binding
  // the server here lets MetricsService report total connected sockets.
  afterInit(server: Server): void {
    this.metrics.bindSocketServer(server);
  }

  // Drain sockets on SIGTERM: tell every connected client the server is going
  // away (so it can show a reconnecting state) before Nest closes the io server.
  onApplicationShutdown(): void {
    if (!this.server) return;
    this.server.emit("server:shutdown", { reason: "restart" });
    this.server.disconnectSockets(true);
  }

  async handleConnection(socket: Socket): Promise<void> {
    // Proactively disconnect sockets with no valid identity. Note: onSubscribe
    // also resolves identity independently to avoid a race where the client
    // sends "subscribe" before this async handler completes.
    const identity = await this.identities.resolve(socket);
    if (!identity) {
      socket.disconnect(true);
      return;
    }
    (socket.data as SocketData).identity = identity;
  }

  handleDisconnect(socket: Socket): void {
    const data = socket.data as Partial<SocketData>;
    if (data.gameId) {
      this.emitPresence(data.gameId);
    }
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  /** Client subscribes to a game room to start receiving pushed state. */
  @SubscribeMessage("subscribe")
  async onSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new WsValidationPipe()) payload: SubscribeDto,
  ): Promise<void> {
    // Resolve identity directly from the handshake — handleConnection is async
    // and may not have completed by the time the client sends "subscribe".
    const identity =
      (socket.data as Partial<SocketData>).identity ??
      (await this.identities.resolve(socket));
    if (!identity) {
      socket.emit("error", { code: "UNAUTHORIZED", message: "No valid identity." });
      socket.disconnect(true);
      return;
    }

    const { gameId } = payload;
    const game = await this.store.getByGameId(gameId);
    if (!game?.online) {
      socket.emit("error", { code: "NOT_ONLINE", message: "Game is not an online game." });
      return;
    }

    const seat = await this.store.getSeatForIdentity(gameId, identity);
    (socket.data as SocketData).seat = seat;
    (socket.data as SocketData).gameId = gameId;

    await socket.join(ROOM(gameId));

    // Send the viewer their redacted snapshot immediately on subscribe.
    socket.emit("state", redactStateFor(game.state, seat));

    this.emitPresence(gameId);
  }

  // ---------------------------------------------------------------------------
  // Server-to-client push (called by GamesService after each committed turn)
  // ---------------------------------------------------------------------------

  async broadcast(gameId: string, state: GameState): Promise<void> {
    const room = this.server.sockets.adapter.rooms.get(ROOM(gameId));
    if (!room) return;

    for (const socketId of room) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) continue;
      const data = socket.data as Partial<SocketData>;
      const seat = data.seat ?? null;
      socket.emit("state", redactStateFor(state, seat));
    }
  }

  // ---------------------------------------------------------------------------
  // Presence helpers
  // ---------------------------------------------------------------------------

  private emitPresence(gameId: string): void {
    const room = this.server.sockets.adapter.rooms.get(ROOM(gameId));
    const connectedSeats: (number | null)[] = [];
    if (room) {
      for (const socketId of room) {
        const s = this.server.sockets.sockets.get(socketId);
        if (s) {
          const data = s.data as Partial<SocketData>;
          connectedSeats.push(data.seat ?? null);
        }
      }
    }
    this.server.to(ROOM(gameId)).emit("presence", { connectedSeats });
  }
}
