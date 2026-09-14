export type Locale = "en" | "ar";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALES: Locale[] = ["en", "ar"];
export const COOKIE_NAME = "lang";

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}
