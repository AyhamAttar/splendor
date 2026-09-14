"use client";

// Last-resort error boundary. It replaces the root layout when a render error
// escapes every nested boundary, so globals.css / the i18n provider are NOT in
// scope here — hence inline styles and a tiny inline en/ar dictionary keyed off
// the <html lang> the server rendered. It reports the error to Sentry (a no-op
// unless configured) and offers a retry.
import { useEffect } from "react";
import { captureException } from "@/lib/sentry";

const COPY = {
  en: {
    title: "Something went wrong",
    body: "An unexpected error occurred. You can try again.",
    retry: "Try again",
  },
  ar: {
    title: "حدث خطأ ما",
    body: "حدث خطأ غير متوقع. يمكنك إعادة المحاولة.",
    retry: "إعادة المحاولة",
  },
} as const;

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  const lang =
    typeof document !== "undefined" && document.documentElement.lang === "ar"
      ? "ar"
      : "en";
  const t = COPY[lang];

  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f1a",
          color: "#e8eaf0",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>
            {t.title}
          </h1>
          <p style={{ opacity: 0.8, margin: "0 0 1.5rem" }}>{t.body}</p>
          <button
            onClick={() => retry()}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: 8,
              border: "none",
              background: "#6366f1",
              color: "white",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            {t.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
