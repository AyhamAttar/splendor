import type { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import type { ConfigService } from "@nestjs/config";
import type { ServerOptions } from "socket.io";
import { corsOrigins } from "./cors";

/**
 * Socket.IO adapter that applies the env-driven CORS allow-list centrally to
 * every namespace (default, `/social`). Setting CORS here — rather than in each
 * `@WebSocketGateway({ cors })` decorator — keeps HTTP and WS in lockstep and
 * removes the previous per-gateway `cb(null, true)` "reflect any origin" hole.
 *
 * Node Socket.IO clients (our e2e/load tests) send no `Origin` header, so this
 * only gates real browsers, exactly like HTTP CORS.
 */
export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: corsOrigins(this.config),
        credentials: true,
      },
      // Cap the accepted payload so a single oversized frame can't exhaust
      // memory before validation runs (default is 1 MiB).
      maxHttpBufferSize: 64 * 1024,
    });
  }
}
