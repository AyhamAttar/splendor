import type { Metadata } from "next";
import { thmanyahSans, thmanyahSerif } from "./fonts";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { SocialProvider } from "@/components/SocialProvider";
import { getLocale, getMessages } from "@/i18n/server";
import { dirFor } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();
  return {
    title: messages.meta.title,
    description: messages.meta.description,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = dirFor(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${thmanyahSans.variable} ${thmanyahSerif.variable}`}
    >
      <body>
        <I18nProvider locale={locale} messages={messages}>
          <AuthProvider>
            <SocialProvider>{children}</SocialProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
