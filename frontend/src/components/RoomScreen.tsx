"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMessages, useT } from "@/i18n/I18nProvider";
import { useRoom } from "@/hooks/useRoom";
import { useAuth } from "@/components/AuthProvider";
import { useSocial } from "@/components/SocialProvider";
import { Avatar } from "@/components/Avatar";
import { getPlayerName, setPlayerName } from "@/lib/playerName";
import { isApiError } from "@/lib/api";
import { Loader } from "@/components/Loader";
import { Button } from "./Button";
import { LanguageToggle } from "./LanguageToggle";

export function RoomScreen({ code }: { code: string }) {
  const m = useMessages();
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const room = useRoom(code);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Route everyone into the game the moment the host starts.
  useEffect(() => {
    if (room.startedGameId) {
      router.push(`/game/${room.startedGameId}?online=1`);
    }
  }, [room.startedGameId, router]);

  const defaultName =
    getPlayerName() || user?.displayName || user?.email?.split("@")[0] || "";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(isApiError(e) ? e.message : m.online.errors.failed);
    } finally {
      setBusy(false);
    }
  };

  if (room.phase === "loading") {
    return (
      <Centered>
        <Loader label={m.online.room.connecting} />
      </Centered>
    );
  }

  if (room.phase === "error") {
    return (
      <Centered>
        <Panel>
          <p className="text-parchment-100">
            {room.error?.message ?? m.online.errors.failed}
          </p>
          <BackToLobby />
        </Panel>
      </Centered>
    );
  }

  if (room.phase === "removed") {
    return (
      <Centered>
        <Panel>
          <p className="font-display text-lg text-gold-300">
            {m.online.room.removedTitle}
          </p>
          <p className="mt-1 text-sm text-parchment-300/80">
            {m.online.room.removedBody}
          </p>
          <BackToLobby />
        </Panel>
      </Centered>
    );
  }

  if (room.phase === "needJoin") {
    return <JoinPrompt code={code} defaultName={defaultName} onJoin={room.join} />;
  }

  // phase === "in"
  const view = room.room!;
  const me = view.members.find((x) => x.id === room.memberId) ?? null;
  const isHost = me?.isHost ?? false;
  const nonHostReady = view.members.filter((x) => !x.isHost).every((x) => x.ready);
  const canStart = view.members.length >= 2 && nonHostReady;
  const seats = Array.from({ length: view.maxPlayers }, (_, i) => i);

  const copyLink = () => {
    void navigator.clipboard?.writeText(window.location.href);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-parchment-300/70 underline-offset-2 transition hover:text-gold-300 hover:underline"
        >
          {m.online.room.backToLobby}
        </Link>
        <LanguageToggle />
      </div>

      <header className="text-center">
        <h1 className="font-display text-4xl font-bold text-gold-300">
          {m.online.room.title}
        </h1>
        <p className="mt-2 text-sm text-parchment-300/80">
          {m.online.room.inviteHint}
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <span
            dir="ltr"
            className="gold-frame rounded-lg bg-navy-950/60 px-4 py-2 font-display text-3xl font-bold tracking-[0.3em] text-parchment-50"
          >
            {view.code}
          </span>
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {m.online.room.copyLink}
          </Button>
        </div>
      </header>

      <section className="gold-frame rounded-xl bg-navy-800/65 p-5 shadow-raise-2">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-linear-to-r from-transparent to-gold-500/40" />
          <h2 className="ornament-label">
            {t("online.room.players", {
              count: view.members.length,
              max: view.maxPlayers,
            })}
          </h2>
          <span className="h-px flex-1 bg-linear-to-l from-transparent to-gold-500/40" />
        </div>

        <ul className="flex flex-col gap-2">
          {seats.map((i) => {
            const member = view.members.find((x) => x.seatIndex === i) ?? null;
            if (!member) {
              return (
                <li
                  key={i}
                  className="gold-hairline flex items-center gap-3 rounded-lg border-dashed bg-navy-950/30 px-3 py-2.5 text-sm text-parchment-300/40"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full text-xs">
                    <bdi>{i + 1}</bdi>
                  </span>
                  {m.online.room.emptySeat}
                </li>
              );
            }
            const isOnline = room.online.includes(member.id);
            const isMe = member.id === room.memberId;
            return (
              <li
                key={member.id}
                className="gold-hairline flex items-center gap-3 rounded-lg bg-navy-900/50 px-3 py-2.5"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-gold-300">
                  <bdi>{i + 1}</bdi>
                </span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    isOnline ? "bg-gem-green shadow-[0_0_8px] shadow-gem-green/60" : "bg-parchment-300/30"
                  }`}
                  title={isOnline ? m.online.room.online : m.online.room.offline}
                />
                <span className="min-w-0 flex-1 truncate text-parchment-50">
                  <bdi>{member.name}</bdi>
                  {isMe && (
                    <span className="ms-2 text-xs text-parchment-300/60">
                      {m.online.room.you}
                    </span>
                  )}
                </span>
                {member.isHost ? (
                  <span className="rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-300">
                    {m.online.room.host}
                  </span>
                ) : member.ready ? (
                  <span className="rounded-full bg-gem-green/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gem-green">
                    {m.online.room.ready}
                  </span>
                ) : (
                  <span className="rounded-full bg-navy-950/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-parchment-300/50">
                    {m.online.room.notReady}
                  </span>
                )}
                {isHost && !member.isHost && (
                  <button
                    onClick={() => void run(() => room.kick(member.id))}
                    disabled={busy}
                    aria-label={m.online.room.kick}
                    title={m.online.room.kick}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-parchment-300/50 transition hover:bg-gem-red/15 hover:text-gem-red disabled:opacity-30"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {isHost && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-parchment-300/70">
              {m.online.room.seats}
            </span>
            <div className="flex gap-1.5">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => void run(() => room.setSeats(n))}
                  disabled={busy || n < view.members.length}
                  className={`h-8 w-8 rounded-md text-sm font-semibold transition disabled:opacity-30 ${
                    view.maxPlayers === n
                      ? "bg-gold-500 text-navy-950"
                      : "gold-hairline text-parchment-200 hover:bg-navy-800"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <InviteFriends code={view.code} />

      {actionError && <p className="text-center text-sm text-gem-red">{actionError}</p>}

      <div className="flex items-center justify-center gap-3">
        {isHost ? (
          <>
            <Button
              onClick={() => void run(room.start)}
              disabled={busy || !canStart}
            >
              {m.online.room.start}
            </Button>
            {!canStart && (
              <span className="text-xs text-parchment-300/60">
                {view.members.length < 2
                  ? m.online.room.needPlayers
                  : m.online.room.waitingReady}
              </span>
            )}
          </>
        ) : (
          <Button
            variant={me?.ready ? "ghost" : "primary"}
            onClick={() => void run(() => room.ready(!me?.ready))}
            disabled={busy}
          >
            {me?.ready ? m.online.room.cancelReady : m.online.room.readyUp}
          </Button>
        )}
        <Button variant="ghost" onClick={() => void run(room.leave)} disabled={busy}>
          {m.online.room.leave}
        </Button>
      </div>
    </main>
  );
}

function JoinPrompt({
  code,
  defaultName,
  onJoin,
}: {
  code: string;
  defaultName: string;
  onJoin: (name: string) => Promise<void>;
}) {
  const m = useMessages();
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const clean = name.trim();
    if (!clean) {
      setError(m.online.errors.needName);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setPlayerName(clean);
      await onJoin(clean);
    } catch (e) {
      setError(isApiError(e) ? e.message : m.online.errors.failed);
      setBusy(false);
    }
  };

  return (
    <Centered>
      <Panel>
        <h1 className="font-display text-2xl font-bold text-gold-300">
          {m.online.join.title}
        </h1>
        <p className="mt-1 text-sm text-parchment-300/80">
          <span dir="ltr" className="font-mono tracking-widest text-parchment-100">
            {code}
          </span>
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder={m.online.namePlaceholder}
          className="gold-hairline mt-4 w-full rounded-md bg-navy-950/50 px-3 py-2.5 text-parchment-50 placeholder:text-parchment-300/50 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
          onKeyDown={(e) => e.key === "Enter" && void submit()}
        />
        {error && <p className="mt-2 text-sm text-gem-red">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? m.online.join.joining : m.online.join.join}
          </Button>
          <Link
            href="/"
            className="inline-flex items-center text-sm text-parchment-300/70 underline-offset-2 hover:text-gold-300 hover:underline"
          >
            {m.online.room.backToLobby}
          </Link>
        </div>
      </Panel>
    </Centered>
  );
}

/**
 * Host/member tool to invite online friends into this room (Phase 4). Renders
 * only for signed-in users with at least one friend; each online friend gets an
 * Invite button that pushes a room invite over the social channel. Guests and
 * users with no friends see nothing.
 */
function InviteFriends({ code }: { code: string }) {
  const m = useMessages();
  const social = useSocial();
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  if (!social.isUser || social.friends.length === 0) return null;

  const online = social.friends.filter((f) => social.isOnline(f.userId));

  const invite = async (userId: string) => {
    setBusy(userId);
    try {
      await social.invite(userId, code);
      setInvited((prev) => new Set(prev).add(userId));
    } catch {
      // Best-effort; the friend simply won't get a push.
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="gold-frame rounded-xl bg-navy-800/65 p-5 shadow-raise-2">
      <div className="mb-3 flex items-center gap-3">
        <span className="h-px flex-1 bg-linear-to-r from-transparent to-gold-500/40" />
        <h2 className="ornament-label">{m.social.invite.heading}</h2>
        <span className="h-px flex-1 bg-linear-to-l from-transparent to-gold-500/40" />
      </div>
      {online.length === 0 ? (
        <p className="text-center text-sm text-parchment-300/55">
          {m.social.invite.noneOnline}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {online.map((f) => {
            const done = invited.has(f.userId);
            return (
              <li
                key={f.userId}
                className="gold-hairline flex items-center gap-2.5 rounded-lg bg-navy-900/50 px-3 py-2"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-gem-green shadow-[0_0_8px] shadow-gem-green/60"
                  title={m.social.online}
                />
                <Avatar src={f.avatar} name={f.displayName} handle={f.handle} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm text-parchment-50">
                  <bdi>{f.displayName || f.handle || "—"}</bdi>
                </span>
                <Button
                  size="xs"
                  variant={done ? "ghost" : "primary"}
                  onClick={() => void invite(f.userId)}
                  disabled={done || busy === f.userId}
                >
                  {done ? m.social.actions.invited : m.social.actions.invite}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      {children}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="gold-frame max-w-sm rounded-xl bg-navy-800/70 p-6 text-center shadow-raise-2">
      {children}
    </div>
  );
}

function BackToLobby() {
  const m = useMessages();
  return (
    <Link
      href="/"
      className="mt-4 inline-block text-gold-300 underline-offset-2 hover:underline"
    >
      {m.online.room.backToLobby}
    </Link>
  );
}
