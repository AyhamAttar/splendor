"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, isApiError } from "@/lib/api";
import {
  clearSessionToken,
  getSessionToken,
  setSessionToken,
} from "@/lib/session";
import { roomsApi } from "@/lib/rooms";
import { getPlayerName, setPlayerName } from "@/lib/playerName";
import { useMessages, useT } from "@/i18n/I18nProvider";
import { useQuickMatch } from "@/hooks/useQuickMatch";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/Button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AccountMenu } from "@/components/AccountMenu";
import { FriendsButton } from "@/components/FriendsButton";

interface ResumeInfo {
  gameId: string;
  names: string[];
  turn: number;
  finished: boolean;
}

export default function Lobby() {
  const router = useRouter();
  const m = useMessages();
  const t = useT();
  const { user } = useAuth();
  const [names, setNames] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<ResumeInfo | null>(null);

  // --- Online play (rooms + quick-match) ---
  const [onlineName, setOnlineName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const qm = useQuickMatch();

  // Seed the online display name from a saved value or the signed-in account.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnlineName(
      getPlayerName() || user?.displayName || user?.email?.split("@")[0] || "",
    );
  }, [user]);

  // When quick-match pairs us up, drop straight into the game.
  useEffect(() => {
    if (qm.gameId) router.push(`/game/${qm.gameId}?online=1`);
  }, [qm.gameId, router]);

  const requireOnlineName = (): string | null => {
    const name = onlineName.trim();
    if (!name) {
      setOnlineError(m.online.errors.needName);
      return null;
    }
    setPlayerName(name);
    setOnlineError(null);
    return name;
  };

  const createRoom = async () => {
    const name = requireOnlineName();
    if (!name) return;
    setOnlineBusy(true);
    try {
      const { code } = await roomsApi.create(name);
      router.push(`/room/${code}`);
    } catch (e) {
      setOnlineError(isApiError(e) ? e.message : m.online.errors.failed);
      setOnlineBusy(false);
    }
  };

  const joinRoom = async () => {
    const name = requireOnlineName();
    if (!name) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setOnlineError(m.online.errors.invalidCode);
      return;
    }
    setOnlineBusy(true);
    try {
      await roomsApi.join(code, name);
      router.push(`/room/${code}`);
    } catch (e) {
      setOnlineError(isApiError(e) ? e.message : m.online.errors.failed);
      setOnlineBusy(false);
    }
  };

  const quickMatch = () => {
    const name = requireOnlineName();
    if (!name) return;
    void qm.find(name);
  };

  useEffect(() => {
    const token = getSessionToken();
    if (!token) return;
    api
      .resume(token)
      .then(({ gameId, state }) =>
        setResume({
          gameId,
          names: state.players.map((p) => p.name),
          turn: state.turnNumber,
          finished: state.status === "finished",
        }),
      )
      .catch((e: unknown) => {
        if (isApiError(e) && e.status >= 400 && e.status < 500)
          clearSessionToken();
      });
  }, []);

  const setName = (i: number, v: string) =>
    setNames((prev) => prev.map((n, idx) => (idx === i ? v : n)));
  const addPlayer = () => setNames((p) => (p.length < 4 ? [...p, ""] : p));
  const removePlayer = (i: number) =>
    setNames((p) => (p.length > 2 ? p.filter((_, idx) => idx !== i) : p));

  const start = async () => {
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (clean.length < 2) {
      setError(m.lobby.errors.needTwoPlayers);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { gameId, sessionToken } = await api.createGame(clean);
      setSessionToken(sessionToken);
      router.push(`/game/${gameId}`);
    } catch (e) {
      setError(isApiError(e) ? e.message : m.lobby.errors.failedToCreate);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 px-6 py-12">
      <div className="absolute end-4 top-4 flex items-center gap-3">
        <FriendsButton />
        <AccountMenu />
        <LanguageToggle />
      </div>

      <header className="rise-in text-center">
        <h1 className="font-display text-6xl font-bold tracking-wide text-gold-300 [text-shadow:0_1px_0_rgba(255,255,255,0.14),0_2px_22px_rgba(217,180,91,0.28),0_4px_3px_rgba(3,7,18,0.6)] sm:text-7xl">
          {m.brand}
        </h1>
        <div
          className="mx-auto mt-4 flex items-center justify-center gap-3"
          aria-hidden
        >
          <span className="h-px w-16 bg-linear-to-r from-transparent to-gold-500/70" />
          <span className="h-2 w-2 rotate-45 bg-gold-400 shadow-[0_0_10px_rgba(217,180,91,0.65)]" />
          <span className="h-px w-16 bg-linear-to-l from-transparent to-gold-500/70" />
        </div>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-parchment-300/80">
          {m.lobby.tagline}
        </p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <Link
            href="/how-to-play"
            className="text-sm text-parchment-300/55 underline-offset-2 transition hover:text-parchment-100 hover:underline"
          >
            {m.lobby.howToPlay}
          </Link>
          <span className="text-parchment-300/30" aria-hidden>
            ·
          </span>
          <Link
            href="/collection"
            className="text-sm text-parchment-300/55 underline-offset-2 transition hover:text-parchment-100 hover:underline"
          >
            {m.lobby.viewContent}
          </Link>
        </div>
      </header>

      {resume && (
        <div
          className="rise-in gold-frame relative w-full max-w-md overflow-hidden rounded-lg bg-navy-800/70 p-4 shadow-raise-2 backdrop-blur-sm"
          style={{ animationDelay: "80ms" }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold-300/40 to-transparent" />
          <p className="text-sm text-parchment-100">
            {m.lobby.resume.inProgress}{" "}
            <b>
              <bdi>{resume.names.join(", ")}</bdi>
            </b>{" "}
            <span className="text-parchment-300/75">
              {t("lobby.resume.turn", { turn: resume.turn })}
              {resume.finished ? m.lobby.resume.finished : ""}
            </span>
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => router.push(`/game/${resume.gameId}`)}
            >
              {m.lobby.resume.resume}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearSessionToken();
                setResume(null);
              }}
            >
              {m.lobby.resume.discard}
            </Button>
          </div>
        </div>
      )}

      {/* Online play — private rooms and public quick-match. */}
      <div
        className="rise-in gold-frame relative w-full max-w-md overflow-hidden rounded-xl bg-navy-800/65 p-6 shadow-raise-3 backdrop-blur-sm"
        style={{ animationDelay: "110ms" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold-300/45 to-transparent" />
        <div className="mb-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-linear-to-r from-transparent to-gold-500/40" />
          <h2 className="ornament-label">{m.online.heading}</h2>
          <span className="h-px flex-1 bg-linear-to-l from-transparent to-gold-500/40" />
        </div>

        <label className="mb-1 block text-xs text-parchment-300/70">
          {m.online.nameLabel}
        </label>
        <input
          value={onlineName}
          onChange={(e) => setOnlineName(e.target.value)}
          maxLength={20}
          placeholder={m.online.namePlaceholder}
          className="gold-hairline w-full rounded-md bg-navy-950/50 px-3 py-2.5 text-parchment-50 transition placeholder:text-parchment-300/50 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
        />

        <div className="mt-4 flex flex-col gap-3">
          <Button onClick={createRoom} disabled={onlineBusy}>
            {m.online.createRoom}
          </Button>

          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-gold-700/25" />
            <span className="text-[10px] uppercase tracking-wider text-parchment-300/40">
              {m.online.or}
            </span>
            <span className="h-px flex-1 bg-gold-700/25" />
          </div>

          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder={m.online.codePlaceholder}
              dir="ltr"
              className="gold-hairline min-w-0 flex-1 rounded-md bg-navy-950/50 px-3 py-2.5 font-mono uppercase tracking-[0.3em] text-parchment-50 transition placeholder:tracking-normal placeholder:text-parchment-300/50 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
              onKeyDown={(e) => e.key === "Enter" && void joinRoom()}
            />
            <button
              onClick={joinRoom}
              disabled={onlineBusy}
              className="gold-hairline shrink-0 rounded-md px-4 text-sm font-semibold text-parchment-100 transition hover:bg-navy-800 disabled:opacity-40"
            >
              {m.online.joinButton}
            </button>
          </div>

          <button
            onClick={quickMatch}
            disabled={onlineBusy}
            className="group inline-flex items-center justify-center gap-1.5 text-sm text-gold-300 transition hover:text-gold-400 disabled:opacity-40"
          >
            <span className="underline-offset-2 group-hover:underline">
              {m.online.quickMatch}
            </span>
          </button>
        </div>

        {onlineError && (
          <p className="mt-3 text-sm text-gem-red">{onlineError}</p>
        )}
      </div>

      <div
        className="rise-in gold-frame relative w-full max-w-md overflow-hidden rounded-xl bg-navy-800/65 p-6 shadow-raise-3 backdrop-blur-sm"
        style={{ animationDelay: "150ms" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold-300/45 to-transparent" />
        <div className="mb-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-linear-to-r from-transparent to-gold-500/40" />
          <h2 className="ornament-label">{m.lobby.newGame}</h2>
          <span className="h-px flex-1 bg-linear-to-l from-transparent to-gold-500/40" />
        </div>
        <p className="-mt-3 mb-4 text-center text-xs text-parchment-300/55">
          {m.lobby.localHint}
        </p>
        <div className="flex flex-col gap-2.5">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="gold-hairline grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-gold-300">
                <bdi>{i + 1}</bdi>
              </span>
              <input
                value={name}
                onChange={(e) => setName(i, e.target.value)}
                maxLength={20}
                placeholder={
                  i === 0
                    ? m.lobby.playerPlaceholder.first
                    : t("lobby.playerPlaceholder.other", { n: i + 1 })
                }
                className="gold-hairline flex-1 rounded-md bg-navy-950/50 px-3 py-2.5 text-parchment-50 transition placeholder:text-parchment-300/60 focus:bg-navy-950/70 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
              />
              {names.length > 2 && (
                <button
                  onClick={() => removePlayer(i)}
                  aria-label={t("lobby.removePlayer", { n: i + 1 })}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-parchment-300/50 transition hover:bg-gem-red/15 hover:text-gem-red"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={addPlayer}
            disabled={names.length >= 4}
            className="group inline-flex items-center gap-1.5 text-sm text-gold-300 transition hover:text-gold-400 disabled:opacity-30"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              aria-hidden
            >
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="underline-offset-2 group-hover:underline">
              {m.lobby.addPlayer}
            </span>
          </button>
          <span className="text-xs text-parchment-300/70">
            {t("lobby.playerCount", { count: names.length })}
          </span>
        </div>

        {error && <p className="mt-3 text-sm text-gem-red">{error}</p>}

        <button
          onClick={start}
          disabled={busy}
          className="group relative mt-5 w-full overflow-hidden rounded-lg bg-gold-500 py-3 font-display text-lg font-semibold text-navy-950 shadow-raise-2 transition hover:bg-gold-400 active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0"
        >
          <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/25 to-transparent" />
          <span className="relative">
            {busy ? m.lobby.dealing : m.lobby.startGame}
          </span>
        </button>
      </div>

      {(qm.phase === "searching" || qm.phase === "matched") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm">
          <div className="gold-frame w-full max-w-sm rounded-xl bg-navy-800/90 p-8 text-center shadow-raise-3">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gold-500/30 border-t-gold-400" />
            <p className="font-display text-xl text-gold-300">
              {qm.phase === "matched"
                ? m.online.match.found
                : m.online.match.searching}
            </p>
            <p className="mt-1 text-sm text-parchment-300/70">
              {t("online.match.waiting", { count: qm.size })}
            </p>
            {qm.phase === "searching" && (
              <Button
                variant="ghost"
                className="mt-5"
                onClick={() => void qm.cancel()}
              >
                {m.online.match.cancel}
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
