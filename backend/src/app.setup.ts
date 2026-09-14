import { INestApplication, ValidationPipe } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { corsOrigins } from "./common/cors";
import { CorsIoAdapter } from "./common/ws-adapter";

/**
 * Apply the production request/transport hardening to a Nest app. Extracted from
 * main.ts so E2E/security tests exercise the *exact* same middleware, pipes and
 * Socket.IO adapter the real server runs — no drift between prod and tests.
 */
export function configureApp(
  app: INestApplication,
  config: ConfigService,
): void {
  // Secure HTTP response headers. The API serves JSON (no HTML/inline scripts),
  // so CSP adds little and its defaults can break JSON clients; disable it only.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Strict global validation: strip unknown keys AND reject payloads that carry
  // them, so no request body can smuggle extra fields past a DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Parse the httpOnly refresh cookie into req.cookies for the auth controller.
  app.use(cookieParser());

  // Apply the same env-driven CORS allow-list to Socket.IO as to HTTP.
  app.useWebSocketAdapter(new CorsIoAdapter(app, config));

  // Allowed browser origins come from CORS_ORIGINS (comma-separated). Custom
  // headers (x-session-token legacy hotseat, x-guest-token, authorization) MUST
  // be allowed or preflight fails; credentials:true lets the refresh cookie ride.
  app.enableCors({
    origin: corsOrigins(config),
    credentials: true,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: [
      "content-type",
      "authorization",
      "x-session-token",
      "x-guest-token",
    ],
  });
}
