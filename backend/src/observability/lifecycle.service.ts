import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { flushSentry } from "./sentry";

/**
 * Graceful-shutdown hook (Phase 5). `app.enableShutdownHooks()` in main.ts wires
 * SIGTERM/SIGINT to Nest's shutdown sequence, which closes the HTTP + Socket.IO
 * servers (draining sockets) and runs PrismaService.onModuleDestroy (releasing
 * the pool). This hook rounds it off by flushing any buffered Sentry events so
 * a crash-on-exit report is never lost.
 */
@Injectable()
export class LifecycleService implements OnApplicationShutdown {
  private readonly logger = new Logger("Lifecycle");

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutting down${signal ? ` (${signal})` : ""}…`);
    await flushSentry();
  }
}
