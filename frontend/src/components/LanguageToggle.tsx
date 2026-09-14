"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, type Locale } from "@/i18n/config";
import { setLocaleCookie } from "@/i18n/actions";
import { useLocale, useMessages } from "@/i18n/I18nProvider";

export function LanguageToggle() {
  const router = useRouter();
  const locale = useLocale();
  const messages = useMessages();
  const [isPending, startTransition] = useTransition();

  function handleSelect(next: Locale) {
    startTransition(async () => {
      await setLocaleCookie(next);
      router.refresh();
    });
  }

  return (
    <div
      className="gold-hairline flex items-center divide-x divide-gold-700/40 overflow-hidden rounded-full text-xs font-semibold"
      aria-busy={isPending}
    >
      {LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => handleSelect(loc)}
          disabled={locale === loc || isPending}
          className={`px-3 py-1 transition ${
            locale === loc
              ? "bg-gold-500/20 text-gold-300 cursor-default"
              : "text-parchment-300/60 hover:text-parchment-100 hover:bg-navy-800"
          }`}
          aria-pressed={locale === loc}
        >
          {messages.langToggle[loc]}
        </button>
      ))}
    </div>
  );
}
