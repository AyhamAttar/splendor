import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { initSentry } from "./observability/sentry";

async function bootstrap() {
  // Initialise error tracking before anything else can throw (no-op without DSN).
  initSentry();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Route all Nest logs through pino (structured JSON + correlation ids).
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);

  // Close Prisma / release the pool and drain sockets cleanly on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // Helmet, strict validation, cookie parsing, and the CORS-aware WS adapter —
  // shared with the E2E/security suites via configureApp.
  configureApp(app, config);

  const port = Number(config.get("PORT")) || 4000;
  // Bind to 0.0.0.0 so the container is reachable from the platform's router
  // (Railway/Render/Fly). Without an explicit host Nest binds the IPv6 wildcard
  // "::", which some proxies can't reach — surfacing as "Application failed to
  // respond" even though the process is up.
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`Splendor API listening on http://0.0.0.0:${port}`);
}

void bootstrap();
