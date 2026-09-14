import { randomUUID } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import type { Params } from "nestjs-pino";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Structured JSON logging (Phase 5). Every HTTP request gets a correlation id:
 * we honour an inbound `x-request-id` (so a value set by an upstream proxy or
 * the frontend flows through) and otherwise mint a UUID, echoing it back on the
 * response header. The same id tags every log line for that request, so a turn
 * can be traced end to end. Sensitive headers are redacted so tokens/cookies
 * never land in logs. WS logs correlate via a per-connection id set in the
 * gateway (see game.gateway/lobby.gateway).
 */
export function pinoConfig(config: ConfigService): Params {
  const level = config.get<string>("LOG_LEVEL") ?? "info";
  return {
    pinoHttp: {
      level,
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const existing = req.headers["x-request-id"];
        const id =
          (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      // Never log secrets. These headers can carry tokens/cookies.
      redact: {
        paths: [
          'req.headers["authorization"]',
          'req.headers["cookie"]',
          'req.headers["x-guest-token"]',
          'req.headers["x-session-token"]',
          'res.headers["set-cookie"]',
        ],
        censor: "[redacted]",
      },
      // Health/readiness/metrics probes are noise at info level.
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          const url = req.url ?? "";
          return (
            url.startsWith("/health") ||
            url.startsWith("/ready") ||
            url.startsWith("/metrics")
          );
        },
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    },
  };
}
