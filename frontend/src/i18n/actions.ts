"use server";

import { cookies } from "next/headers";
import { COOKIE_NAME, isLocale, type Locale } from "./config";

export async function setLocaleCookie(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
