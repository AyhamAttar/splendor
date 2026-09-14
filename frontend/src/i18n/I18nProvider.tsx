"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./config";
import { dirFor } from "./config";
import type { Messages } from "./messages/en";

interface I18nContext {
  locale: Locale;
  messages: Messages;
  dir: "ltr" | "rtl";
}

const Ctx = createContext<I18nContext | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  return (
    <Ctx.Provider value={{ locale, messages, dir: dirFor(locale) }}>
      {children}
    </Ctx.Provider>
  );
}

function useI18n(): I18nContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

export function useDir(): "ltr" | "rtl" {
  return useI18n().dir;
}

/** Resolve a dotted key path like "game.errors.cannotAfford" through the messages tree. */
function resolve(messages: Messages, path: string): string {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = messages;
  for (const p of parts) {
    node = node?.[p];
  }
  return typeof node === "string" ? node : path;
}

/**
 * Returns a translation function `t(key, params?)`.
 * Keys are dotted paths into the Messages tree (e.g. "game.errors.cannotAfford").
 * Params replace `{name}` style placeholders.
 */
export function useT() {
  const { messages } = useI18n();
  return function t(
    path: string,
    params?: Record<string, string | number>,
  ): string {
    let str = resolve(messages, path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replaceAll(`{${k}}`, String(v));
      }
    }
    return str;
  };
}

/** Access the full messages object when you need multiple strings at once. */
export function useMessages(): Messages {
  return useI18n().messages;
}
