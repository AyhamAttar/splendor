import { cookies } from "next/headers";
import { DEFAULT_LOCALE, COOKIE_NAME, isLocale, type Locale } from "./config";
import type { Messages } from "./messages/en";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getMessages(): Promise<Messages> {
  const locale = await getLocale();
  if (locale === "ar") {
    const { default: ar } = await import("./messages/ar");
    return ar;
  }
  const { default: en } = await import("./messages/en");
  return en;
}
