import localFont from "next/font/local";

// Thmanyah — the Arabic-native display + text family from font.thmanyah.com
// (self-hosted woff2, free for web/app use). Both variants carry full Latin
// AND Arabic glyph sets, so one family serves LTR (English) and RTL (Arabic)
// without a separate Arabic face.
//
// Serif Display carries the ceremonial layer — the wordmark, titles, prestige
// numbers and small-caps ornament labels (it replaces Georgia). Sans carries
// the running body text of play (it replaces the system sans stack). The old
// stacks stay on as fallbacks in globals.css.

export const thmanyahSerif = localFont({
  variable: "--font-thmanyah-serif",
  display: "swap",
  src: [
    {
      path: "./fonts/Thmanyah-SerifDisplay-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/Thmanyah-SerifDisplay-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/Thmanyah-SerifDisplay-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/Thmanyah-SerifDisplay-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/Thmanyah-SerifDisplay-Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
});

export const thmanyahSans = localFont({
  variable: "--font-thmanyah-sans",
  display: "swap",
  src: [
    {
      path: "./fonts/Thmanyah-Sans-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/Thmanyah-Sans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/Thmanyah-Sans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/Thmanyah-Sans-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/Thmanyah-Sans-Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
});
