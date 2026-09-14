// Runs on the client after the document loads and before React hydration
// (Next.js instrumentation-client convention). We use it to initialise error
// tracking as early as possible so uncaught errors during hydration are caught.
import { initSentry } from "./lib/sentry";

try {
  initSentry();
} catch {
  // Instrumentation must never break app startup.
}
