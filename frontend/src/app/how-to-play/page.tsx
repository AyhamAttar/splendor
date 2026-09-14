import type { Metadata } from "next";
import Link from "next/link";
import { CARDS } from "@splendor/engine";
import { NOBLES } from "@splendor/engine";
import { TOKEN_ORDER } from "@/lib/gems";
import { getMessages } from "@/i18n/server";
import { TokenChip } from "@/components/TokenChip";
import { GemPip } from "@/components/GemPip";
import { CostPips } from "@/components/CostPips";
import { DevCard, CardBack } from "@/components/DevCard";
import { NobleTile } from "@/components/NobleTile";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return {
    title: m.meta.howToPlayTitle,
    description: m.meta.howToPlayDescription,
  };
}

const L1 = CARDS.find((c) => c.id === 8)!;
const L2 = CARDS.find((c) => c.id === 64)!;
const L3 = CARDS.find((c) => c.id === 76)!;
const NOBLE = NOBLES.find((n) => n.id === 1)!;

export default async function HowToPlayPage() {
  const m = await getMessages();
  const h = m.howToPlay;
  const s = h.sections;

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-6 py-12">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="rise-in w-full max-w-2xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-parchment-300/60 transition underline-offset-2 hover:text-parchment-100 hover:underline"
        >
          <BackArrow />
          {h.backToLobby}
        </Link>
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-wide text-gold-300 [text-shadow:0_1px_0_rgba(255,255,255,0.14),0_2px_22px_rgba(217,180,91,0.28),0_4px_3px_rgba(3,7,18,0.6)] sm:text-6xl">
            {h.title}
          </h1>
          <div
            className="mx-auto mt-4 flex items-center justify-center gap-3"
            aria-hidden
          >
            <span className="h-px w-16 bg-linear-to-r from-transparent to-gold-500/70" />
            <span className="h-2 w-2 rotate-45 bg-gold-400 shadow-[0_0_10px_rgba(217,180,91,0.65)]" />
            <span className="h-px w-16 bg-linear-to-l from-transparent to-gold-500/70" />
          </div>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-parchment-300/80">
            {h.intro_a}{" "}
            <strong className="text-parchment-100">{h.intro_strong}</strong>{" "}
            {h.intro_b}
          </p>
        </div>
      </header>

      {/* ── Game Items ───────────────────────────────────────── */}
      <Panel delay={80} aria-label={s.gameItems.heading}>
        <SectionHeading>{s.gameItems.heading}</SectionHeading>

        {/* Gem Tokens */}
        <div className="mt-5">
          <Subheading>{s.gameItems.gemTokens.subheading}</Subheading>
          <div dir="ltr" className="mt-3 flex flex-wrap gap-5">
            {TOKEN_ORDER.map((color) => (
              <div key={color} className="flex flex-col items-center gap-1.5">
                <TokenChip color={color} size="md" />
                <span className="text-[10px] leading-none text-parchment-300/65">
                  {m.gems[color]}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-parchment-300/80">
            {s.gameItems.gemTokens.body_a}{" "}
            <span className="text-parchment-100" dir="ltr">
              {s.gameItems.gemTokens.body_count}
            </span>{" "}
            {s.gameItems.gemTokens.body_b}{" "}
            <span className="text-parchment-100">{s.gameItems.gemTokens.body_gold}</span>{" "}
            {s.gameItems.gemTokens.body_c}
          </p>
        </div>

        <Divider />

        {/* Development Cards */}
        <div>
          <Subheading>{s.gameItems.devCards.subheading}</Subheading>
          <div dir="ltr" className="mt-3 flex flex-wrap items-end gap-4">
            {[L1, L2, L3].map((card, i) => (
              <div key={card.id} className="flex flex-col items-center gap-1.5">
                <DevCard card={card} />
                <span className="ornament-label">
                  {s.gameItems.devCards.level.replace("{n}", String(i + 1))}
                </span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5">
              <CardBack level={2} />
              <span className="ornament-label">{s.gameItems.devCards.faceDown}</span>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-parchment-300/80">
            {s.gameItems.devCards.body_a}{" "}
            <span className="text-parchment-100">{s.gameItems.devCards.body_prestige}</span>{" "}
            {s.gameItems.devCards.body_b}{" "}
            <span className="text-parchment-100">{s.gameItems.devCards.body_gem}</span>{" "}
            {s.gameItems.devCards.body_c}{" "}
            <span className="text-parchment-100">{s.gameItems.devCards.body_cost}</span>{" "}
            {s.gameItems.devCards.body_d}
          </p>
        </div>

        <Divider />

        {/* Noble Tiles */}
        <div>
          <Subheading>{s.gameItems.nobles.subheading}</Subheading>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <NobleTile noble={NOBLE} />
            <p className="min-w-50 flex-1 text-sm leading-relaxed text-parchment-300/80">
              {s.gameItems.nobles.body_a}{" "}
              <span className="text-parchment-100">{s.gameItems.nobles.body_prestige}</span>
              {s.gameItems.nobles.body_b}
            </p>
          </div>
        </div>
      </Panel>

      {/* ── Your Turn ───────────────────────────────────────── */}
      <Panel delay={160} aria-label={s.yourTurn.heading}>
        <SectionHeading>{s.yourTurn.heading}</SectionHeading>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionTile icon={<Take3Icon />} title={s.yourTurn.take3.title}>
            {s.yourTurn.take3.body}
          </ActionTile>
          <ActionTile icon={<Take2Icon />} title={s.yourTurn.take2.title}>
            {s.yourTurn.take2.body_a}{" "}
            <strong className="text-parchment-100" dir="ltr">{s.yourTurn.take2.body_count}</strong>{" "}
            {s.yourTurn.take2.body_b}
          </ActionTile>
          <ActionTile icon={<ReserveIcon />} title={s.yourTurn.reserve.title}>
            {s.yourTurn.reserve.body_a}{" "}
            <strong className="text-parchment-100">{s.yourTurn.reserve.body_gold}</strong>{" "}
            {s.yourTurn.reserve.body_b}{" "}
            <strong className="text-parchment-100" dir="ltr">{s.yourTurn.reserve.body_max}</strong>{" "}
            {s.yourTurn.reserve.body_c}
          </ActionTile>
          <ActionTile icon={<BuyIcon />} title={s.yourTurn.buy.title}>
            {s.yourTurn.buy.body}
          </ActionTile>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-parchment-300/50">
          {s.yourTurn.tokenLimit_a}{" "}
          <span className="text-parchment-300/75">{s.yourTurn.tokenLimit_tokens}</span>{" "}
          {s.yourTurn.tokenLimit_b}
        </p>
      </Panel>

      {/* ── Bonuses & Buying ────────────────────────────────── */}
      <Panel delay={240} aria-label={s.bonuses.heading}>
        <SectionHeading>{s.bonuses.heading}</SectionHeading>

        <p className="mt-4 text-sm leading-relaxed text-parchment-300/80">
          {s.bonuses.body_a}{" "}
          <span className="text-parchment-100">{s.bonuses.body_bonus}</span>{" "}
          {s.bonuses.body_b}{" "}
          <span className="text-parchment-100">{s.bonuses.body_discount}</span>{" "}
          {s.bonuses.body_c}
        </p>

        <div dir="ltr" className="mt-4 gold-hairline flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-navy-900/60 px-4 py-3 text-sm text-parchment-300/80">
          <span>{s.bonuses.example_cost}</span>
          <CostPips cost={{ blue: 3 }} size="sm" />
          <span className="text-parchment-300/40">{s.bonuses.example_minus}</span>
          <span className="inline-flex items-center gap-1">
            1&nbsp;
            <GemPip color="blue" size="sm" shape="square" title="Sapphire bonus" />
            <span className="text-parchment-300/60">{s.bonuses.example_bonus}</span>
          </span>
          <span className="text-parchment-300/40">{s.bonuses.example_equals}</span>
          <span>{s.bonuses.example_pay}</span>
          <CostPips cost={{ blue: 2 }} size="sm" />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-parchment-300/80">
          <span className="text-parchment-100">{s.bonuses.gold_a}</span>{" "}
          {s.bonuses.gold_b}
        </p>
      </Panel>

      {/* ── Winning ─────────────────────────────────────────── */}
      <Panel delay={320} aria-label={s.winning.heading}>
        <SectionHeading>{s.winning.heading}</SectionHeading>

        <p className="mt-4 text-sm leading-relaxed text-parchment-300/80">
          {s.winning.body_a}{" "}
          <strong className="text-parchment-100">{s.winning.body_prestige}</strong>
          {s.winning.body_b}{" "}
          <span className="text-parchment-100">{s.winning.body_tiebreak}</span>
          {s.winning.body_c}
        </p>
      </Panel>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <div
        className="rise-in flex flex-col items-center gap-3 pb-4"
        style={{ animationDelay: "400ms" }}
      >
        <Link
          href="/"
          className="group relative overflow-hidden rounded-lg bg-gold-500 px-8 py-3 font-display text-lg font-semibold text-navy-950 shadow-raise-2 transition hover:bg-gold-400 active:translate-y-px"
        >
          <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/25 to-transparent" />
          <span className="relative">{h.startGame}</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-parchment-300/55 underline-offset-2 transition hover:text-parchment-100 hover:underline"
        >
          {h.backToLobbyBottom}
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
      className="rise-in gold-frame relative w-full max-w-2xl overflow-hidden rounded-xl bg-navy-800/65 p-6 shadow-raise-3 backdrop-blur-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold-300/45 to-transparent" />
      {children}
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-linear-to-r from-transparent to-gold-500/40" />
      <h2 className="ornament-label">{children}</h2>
      <span className="h-px flex-1 bg-linear-to-l from-transparent to-gold-500/40" />
    </div>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-gold-400">
      {children}
    </h3>
  );
}

function Divider() {
  return <hr className="my-5 border-gold-500/15" />;
}

function ActionTile({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="gold-hairline flex gap-3 rounded-lg bg-navy-900/50 p-4">
      <div className="mt-0.5 shrink-0 text-gold-300">{icon}</div>
      <div>
        <p className="font-semibold text-parchment-100">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-parchment-300/70">
          {children}
        </p>
      </div>
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────── */

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

function Take3Icon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <circle cx="5" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="19" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function Take2Icon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <circle cx="8.5" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15.5" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ReserveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="2.5"
        width="12"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M7 7.5h5M7 11h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="18" cy="17" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M16.5 17l1.5 1.5 2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BuyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="2.5"
        width="12"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M7 7.5h5M7 11h3.5M7 14.5h2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14.5 19l2 2 4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
