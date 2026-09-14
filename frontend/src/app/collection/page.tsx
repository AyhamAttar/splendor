import type { Metadata } from "next";
import Link from "next/link";
import type { Level } from "@splendor/engine";
import { NOBLES, cardsByLevel } from "@splendor/engine";
import { TOKEN_ORDER } from "@/lib/gems";
import { nobleItemName } from "@/lib/nobles";
import { getMessages } from "@/i18n/server";
import { TokenChip } from "@/components/TokenChip";
import { DevCard } from "@/components/DevCard";
import { NobleTile } from "@/components/NobleTile";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return {
    title: m.meta.collectionTitle,
    description: m.meta.collectionDescription,
  };
}

const LEVELS: Level[] = [1, 2, 3];

export default async function CollectionPage() {
  const m = await getMessages();
  const c = m.collection;

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-6 py-12">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="rise-in w-full max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-parchment-300/60 transition underline-offset-2 hover:text-parchment-100 hover:underline"
        >
          <BackArrow />
          {c.backToLobby}
        </Link>
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-wide text-gold-300 [text-shadow:0_1px_0_rgba(255,255,255,0.14),0_2px_22px_rgba(217,180,91,0.28),0_4px_3px_rgba(3,7,18,0.6)] sm:text-6xl">
            {c.title}
          </h1>
          <div
            className="mx-auto mt-4 flex items-center justify-center gap-3"
            aria-hidden
          >
            <span className="h-px w-16 bg-linear-to-r from-transparent to-gold-500/70" />
            <span className="h-2 w-2 rotate-45 bg-gold-400 shadow-[0_0_10px_rgba(217,180,91,0.65)]" />
            <span className="h-px w-16 bg-linear-to-l from-transparent to-gold-500/70" />
          </div>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-parchment-300/80">
            {c.intro}
          </p>
        </div>
      </header>

      {/* ── Gem Tokens ───────────────────────────────────────── */}
      <Panel delay={80} aria-label={c.gems.heading}>
        <SectionHeading subtitle={c.gems.subtitle}>
          {c.gems.heading}
        </SectionHeading>
        <div dir="ltr" className="mt-5 flex flex-wrap justify-center gap-7">
          {TOKEN_ORDER.map((color) => (
            <div key={color} className="flex flex-col items-center gap-2">
              <TokenChip color={color} size="lg" />
              <span className="text-[11px] leading-none text-parchment-300/70">
                {m.gems[color]}
              </span>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-parchment-300/70">
          {c.gems.note}
        </p>
      </Panel>

      {/* ── Development Cards ─────────────────────────────────── */}
      <Panel delay={160} aria-label={c.cards.heading}>
        <SectionHeading subtitle={c.cards.subtitle}>
          {c.cards.heading}
        </SectionHeading>
        <div className="mt-5 flex flex-col gap-7">
          {LEVELS.map((lvl) => {
            const cards = cardsByLevel(lvl);
            return (
              <div key={lvl}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gold-400">
                    {c.cards.level.replace("{n}", String(lvl))}
                  </h3>
                  <span className="text-[11px] text-parchment-300/50">
                    {c.cards.count.replace("{n}", String(cards.length))}
                  </span>
                </div>
                <div
                  dir="ltr"
                  className="flex flex-wrap justify-center gap-3 sm:justify-start"
                >
                  {cards.map((card) => (
                    <DevCard key={card.id} card={card} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ── Noble Items ──────────────────────────────────────── */}
      <Panel delay={240} aria-label={c.nobles.heading}>
        <SectionHeading subtitle={c.nobles.subtitle}>
          {c.nobles.heading}
        </SectionHeading>
        <div
          dir="ltr"
          className="mt-5 flex flex-wrap justify-center gap-5 sm:justify-start"
        >
          {NOBLES.map((noble) => (
            <div key={noble.id} className="flex flex-col items-center gap-2">
              <NobleTile noble={noble} />
              <span className="max-w-24 text-center text-[10px] leading-tight text-parchment-300/70">
                {nobleItemName(noble.id)}
              </span>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-parchment-300/70">
          {c.nobles.note}
        </p>
      </Panel>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <div
        className="rise-in flex flex-col items-center gap-3 pb-4"
        style={{ animationDelay: "320ms" }}
      >
        <Link
          href="/"
          className="group relative overflow-hidden rounded-lg bg-gold-500 px-8 py-3 font-display text-lg font-semibold text-navy-950 shadow-raise-2 transition hover:bg-gold-400 active:translate-y-px"
        >
          <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/25 to-transparent" />
          <span className="relative">{c.startGame}</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-parchment-300/55 underline-offset-2 transition hover:text-parchment-100 hover:underline"
        >
          {c.backToLobbyBottom}
        </Link>
      </div>
    </main>
  );
}

/* ── Page-local helpers ─────────────────────────────────────── */

function Panel({
  children,
  delay,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  delay: number;
  "aria-label"?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className="rise-in gold-frame relative w-full max-w-5xl overflow-hidden rounded-xl bg-navy-800/65 p-6 shadow-raise-3 backdrop-blur-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold-300/45 to-transparent" />
      {children}
    </section>
  );
}

function SectionHeading({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-linear-to-r from-transparent to-gold-500/40" />
      <h2 className="ornament-label">{children}</h2>
      {subtitle && (
        <span className="rounded-full gold-hairline px-2 py-0.5 text-[10px] text-gold-300/80">
          {subtitle}
        </span>
      )}
      <span className="h-px flex-1 bg-linear-to-l from-transparent to-gold-500/40" />
    </div>
  );
}

function BackArrow() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="icon-dir-flip h-3.5 w-3.5"
      fill="none"
      aria-hidden
    >
      <path
        d="M10 4L6 8l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
