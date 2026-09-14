import type { ConfigService } from "@nestjs/config";

/** Dev fallback used only when CORS_ORIGINS is unset (never in production). */
export const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/**
 * The single source of truth for allowed browser origins, shared by the REST
 * layer (main.ts) and the Socket.IO adapter (CorsIoAdapter) so HTTP and
 * WebSocket enforce the *same* env-driven allow-list. Previously each gateway
 * reflected every origin (`cb(null, true)`) — a CSRF/hijack vector online.
 */
export function corsOrigins(config: ConfigService): string[] {
  const origins = (config.get<string>("CORS_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : DEFAULT_ORIGINS;
}
