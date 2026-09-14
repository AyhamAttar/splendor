"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useAuth } from "@/components/AuthProvider";
import { useMessages } from "@/i18n/I18nProvider";
import { isApiError, type ApiError } from "@/lib/api";
import type { Messages } from "@/i18n/messages/en";

export type AuthMode = "login" | "register";

function errorMessage(e: unknown, m: Messages): string {
  if (!isApiError(e)) return m.auth.errors.generic;
  const err = e as ApiError;
  switch (err.code) {
    case "INVALID_CREDENTIALS":
      return m.auth.errors.invalidCredentials;
    case "EMAIL_TAKEN":
      return m.auth.errors.emailTaken;
    case "NETWORK":
      return m.auth.errors.network;
    default:
      // class-validator returns message as string[]; join it if so.
      return Array.isArray(err.message)
        ? (err.message as string[]).join(" ")
        : err.message || m.auth.errors.generic;
  }
}

export function AuthDialog({
  initialMode = "login",
  onClose,
}: {
  initialMode?: AuthMode;
  onClose: () => void;
}) {
  const m = useMessages();
  const { login, register, status } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const d = m.auth.dialog;
  const isRegister = mode === "register";
  // Registering while a guest is an upgrade — reassure that history is kept.
  const showUpgradeHint = isRegister && status === "guest";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isRegister) {
        await register(email, password, displayName.trim() || undefined);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err, m));
      setBusy(false);
    }
  };

  return (
    <Modal title={isRegister ? d.registerTitle : d.loginTitle} onClose={onClose}>
      {showUpgradeHint && (
        <p className="mb-4 rounded-md bg-gold-500/10 px-3 py-2 text-sm text-gold-200">
          {d.upgradeHint}
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-parchment-200">
          {d.email}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={d.emailPlaceholder}
            maxLength={254}
            className="gold-hairline rounded-md bg-navy-950/50 px-3 py-2.5 text-parchment-50 transition placeholder:text-parchment-300/50 focus:bg-navy-950/70 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-parchment-200">
          {d.password}
          <input
            type="password"
            required
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={isRegister ? 8 : undefined}
            maxLength={128}
            className="gold-hairline rounded-md bg-navy-950/50 px-3 py-2.5 text-parchment-50 transition placeholder:text-parchment-300/50 focus:bg-navy-950/70 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
          />
          {isRegister && (
            <span className="text-xs text-parchment-300/60">
              {d.passwordHint}
            </span>
          )}
        </label>

        {isRegister && (
          <label className="flex flex-col gap-1 text-sm text-parchment-200">
            {d.displayName}
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={20}
              className="gold-hairline rounded-md bg-navy-950/50 px-3 py-2.5 text-parchment-50 transition placeholder:text-parchment-300/50 focus:bg-navy-950/70 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
            />
          </label>
        )}

        {error && <p className="text-sm text-gem-red">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="group relative mt-1 w-full overflow-hidden rounded-lg bg-gold-500 py-2.5 font-display text-base font-semibold text-navy-950 shadow-raise-2 transition hover:bg-gold-400 active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0"
        >
          <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/25 to-transparent" />
          <span className="relative">
            {busy
              ? d.submitting
              : isRegister
                ? d.submitRegister
                : d.submitLogin}
          </span>
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(isRegister ? "login" : "register");
          setError(null);
        }}
        className="mt-4 w-full text-center text-sm text-gold-300 underline-offset-2 transition hover:text-gold-400 hover:underline"
      >
        {isRegister ? d.switchToLogin : d.switchToRegister}
      </button>
    </Modal>
  );
}
