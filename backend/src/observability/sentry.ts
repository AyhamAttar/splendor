import * as Sentry from "@sentry/node";

let enabled = false;

/**
 * Initialise Sentry error tracking (Phase 5). Entirely env-gated: with no
 * SENTRY_DSN this is a no-op, so local dev and CI never ship errors anywhere.
 * Call once, as early as possible, before the Nest app is created.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    // Off by default (0); opt into performance tracing via env in production.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
  enabled = true;
}

export function sentryEnabled(): boolean {
  return enabled;
}

/** Report an exception to Sentry when configured; otherwise a no-op. */
export function captureException(
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  if (!enabled) return;
  Sentry.captureException(err, extra ? { extra } : undefined);
}

/** Flush buffered events on shutdown so nothing is lost on SIGTERM. */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // Best-effort on shutdown.
  }
}
