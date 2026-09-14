import * as Sentry from "@sentry/browser";

let enabled = false;

/**
 * Env-gated client error tracking (Phase 5). With no NEXT_PUBLIC_SENTRY_DSN this
 * is a no-op, so dev builds ship nothing to Sentry. Sentry's default browser
 * integrations install window.onerror / unhandledrejection handlers, so most
 * uncaught errors are captured automatically once initialised; the App Router
 * error boundaries (global-error.tsx) report React render errors on top.
 *
 * We use @sentry/browser (not @sentry/nextjs) deliberately: it needs no
 * next.config wrapping, keeping this Next 16 build untouched and stable.
 */
export function initSentry(): void {
  if (typeof window === "undefined" || enabled) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENV ??
      process.env.NODE_ENV ??
      "development",
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: 0,
  });
  enabled = true;
}

export function captureException(error: unknown): void {
  if (!enabled) return;
  Sentry.captureException(error);
}
