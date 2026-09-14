"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { GemPip } from "@/components/GemPip";
import { LanguageToggle } from "@/components/LanguageToggle";
import { EditProfileDialog } from "@/components/EditProfileDialog";
import { useMessages, useT, useLocale } from "@/i18n/I18nProvider";
import { isApiError } from "@/lib/api";
import {
  profilesApi,
  type MatchHistoryEntry,
  type ProfileView,
} from "@/lib/profiles";

export function ProfileScreen({ userId }: { userId: string }) {
  const m = useMessages();
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const isMe = user?.id === userId;

  const [view, setView] = useState<ProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<MatchHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editing, setEditing] = useState(false);
  // Tracks the profile currently being viewed so an out-of-order or
  // post-navigation fetch can't commit another user's data under this id.
  const latestUserId = useRef(userId);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const loadProfile = useCallback(async () => {
    try {
      const v = await profilesApi.get(userId);
      if (latestUserId.current !== userId) return; // navigated away
      setView(v);
      setError(null);
    } catch (e) {
      if (latestUserId.current !== userId) return;
      setError(
        isApiError(e) && e.status === 404 ? m.profile.notFound : m.social.errors.generic,
      );
    }
  }, [userId, m.profile.notFound, m.social.errors.generic]);

  useEffect(() => {
    latestUserId.current = userId;
    // loadProfile sets state only after an await, and guards on latestUserId.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile, userId]);

  // First page of history.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await profilesApi.history(userId);
        if (cancelled) return;
        setEntries(page.entries);
        setCursor(page.nextCursor);
      } catch {
        /* history is best-effort; the profile still renders */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loadMore = async () => {
    if (!cursor) return;
    const uid = userId;
    setLoadingMore(true);
    try {
      const page = await profilesApi.history(uid, cursor);
      if (uid !== userId) return; // navigated to a different profile mid-fetch
      setEntries((prev) => [...prev, ...page.entries]);
      setCursor(page.nextCursor);
    } catch {
      /* ignore; user can retry */
    } finally {
      if (uid === userId) setLoadingMore(false);
    }
  };

  if (error) {
    return (
      <Shell>
        <div className="gold-frame mx-auto max-w-sm rounded-xl bg-navy-800/70 p-6 text-center shadow-raise-2">
          <p className="text-parchment-100">{error}</p>
          <Link
            href="/"
            className="mt-4 inline-block text-gold-300 underline-offset-2 hover:underline"
          >
            {m.profile.backToLobby}
          </Link>
        </div>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell>
        <p className="animate-pulse text-center text-parchment-300/70">
          {m.profile.loading}
        </p>
      </Shell>
    );
  }

  const { profile, stats } = view;
  const winPct = Math.round(stats.winRate * 100);

  return (
    <Shell>
      {/* Header */}
      <section className="gold-frame rounded-xl bg-navy-800/65 p-6 shadow-raise-2">
        <div className="flex items-center gap-4">
          <Avatar
            src={profile.avatar}
            name={profile.displayName}
            handle={profile.handle}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold text-gold-300">
              <bdi>{profile.displayName || profile.handle || "—"}</bdi>
            </h1>
            <p dir="ltr" className="truncate text-sm text-parchment-300/70">
              {profile.handle ? `@${profile.handle}` : m.profile.noHandle}
            </p>
            <p className="mt-0.5 text-xs text-parchment-300/50">
              {t("profile.joined", { date: dateFmt.format(new Date(profile.createdAt)) })}
            </p>
          </div>
          {isMe && user && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              {m.profile.edit}
            </Button>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="gold-frame rounded-xl bg-navy-800/65 p-5 shadow-raise-2">
        <h2 className="ornament-label mb-4">{m.profile.stats.heading}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={m.profile.stats.games} value={String(stats.games)} />
          <Stat label={m.profile.stats.wins} value={String(stats.wins)} />
          <Stat label={m.profile.stats.winRate} value={`${winPct}%`} />
          <Stat
            label={m.profile.stats.favoriteGem}
            value={
              stats.favoriteGem ? (
                <span className="inline-flex items-center gap-1.5">
                  <GemPip color={stats.favoriteGem} size="sm" jewel />
                  <span className="text-sm">{m.gems[stats.favoriteGem]}</span>
                </span>
              ) : (
                m.profile.stats.none
              )
            }
          />
          <Stat label={m.profile.stats.bestPrestige} value={String(stats.bestPrestige)} />
          <Stat label={m.profile.stats.totalCards} value={String(stats.totalCards)} />
        </div>
      </section>

      {/* History */}
      <section className="gold-frame rounded-xl bg-navy-800/65 p-5 shadow-raise-2">
        <h2 className="ornament-label mb-4">{m.history.heading}</h2>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-parchment-300/55">
            {m.history.empty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <HistoryRow key={e.gameId} entry={e} dateFmt={dateFmt} />
            ))}
          </ul>
        )}
        {cursor && (
          <div className="mt-4 flex justify-center">
            <Button size="sm" variant="ghost" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? m.history.loading : m.history.loadMore}
            </Button>
          </div>
        )}
      </section>

      {editing && user && (
        <EditProfileDialog
          user={user}
          onClose={() => setEditing(false)}
          onSaved={() => void loadProfile()}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const m = useMessages();
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-parchment-300/70 underline-offset-2 transition hover:text-gold-300 hover:underline"
        >
          {m.profile.backToLobby}
        </Link>
        <LanguageToggle />
      </div>
      {children}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="gold-hairline rounded-lg bg-navy-950/40 px-3 py-2.5">
      <div className="text-xs text-parchment-300/60">{label}</div>
      <div className="mt-0.5 font-display text-lg text-parchment-50">{value}</div>
    </div>
  );
}

function HistoryRow({
  entry,
  dateFmt,
}: {
  entry: MatchHistoryEntry;
  dateFmt: Intl.DateTimeFormat;
}) {
  const m = useMessages();
  const t = useT();
  const won =
    entry.yourSeatIndex !== null &&
    entry.winnerSeatIndices.includes(entry.yourSeatIndex);
  const minutes = Math.max(1, Math.round(entry.durationMs / 60000));
  const ordered = [...entry.players].sort((a, b) => b.prestige - a.prestige);

  return (
    <li className="gold-hairline rounded-lg bg-navy-900/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            won ? "bg-gold-500/20 text-gold-300" : "bg-navy-950/60 text-parchment-300/60"
          }`}
        >
          {won ? m.history.won : m.history.lost}
        </span>
        <span className="text-xs text-parchment-300/50">
          {dateFmt.format(new Date(entry.finishedAt))}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
        {ordered.map((p) => {
          const isWinner = entry.winnerSeatIndices.includes(p.seatIndex);
          const isYou = p.seatIndex === entry.yourSeatIndex;
          return (
            <span
              key={p.seatIndex}
              className={isWinner ? "text-gold-300" : "text-parchment-100/75"}
            >
              <bdi>{p.name}</bdi>
              {isYou && (
                <span className="ms-1 text-[10px] text-parchment-300/50">
                  ({m.history.you})
                </span>
              )}{" "}
              <span className="text-parchment-300/50">{p.prestige}</span>
            </span>
          );
        })}
      </div>
      <div className="mt-1 text-xs text-parchment-300/45">
        {t("history.players", { count: entry.players.length })} ·{" "}
        {t("history.turns", { count: entry.turnNumber })} ·{" "}
        {t("history.duration", { minutes })}
      </div>
    </li>
  );
}
