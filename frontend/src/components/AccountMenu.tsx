"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { AuthDialog, type AuthMode } from "@/components/AuthDialog";
import { useMessages } from "@/i18n/I18nProvider";

/**
 * Lobby identity control: shows the signed-in account (with sign-out) or a guest
 * badge offering sign-in / create-account. "Continue as guest" is the implicit
 * default — a visitor can start a game without ever opening this.
 */
export function AccountMenu() {
  const m = useMessages();
  const { status, user, logout } = useAuth();
  const [dialogMode, setDialogMode] = useState<AuthMode | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  if (status === "loading") {
    return (
      <div
        className="h-7 w-32 animate-pulse rounded-full bg-navy-800/60"
        aria-hidden
      />
    );
  }

  if (status === "user" && user) {
    const name = user.displayName || user.email || "";
    return (
      <div className="gold-hairline flex items-center gap-2 rounded-full bg-navy-800/60 py-1 pe-1 ps-3 text-xs">
        <Link
          href={`/profile/${user.id}`}
          title={m.auth.profile}
          className="max-w-40 truncate text-parchment-300/80 underline-offset-2 transition hover:text-parchment-100 hover:underline"
        >
          {m.auth.signedIn} <bdi className="text-parchment-100">{name}</bdi>
        </Link>
        <button
          onClick={async () => {
            setLoggingOut(true);
            await logout();
            setLoggingOut(false);
          }}
          disabled={loggingOut}
          className="rounded-full px-2.5 py-1 font-semibold text-gold-300 transition hover:bg-navy-700 hover:text-gold-200 disabled:opacity-50"
        >
          {m.auth.signOut}
        </button>
      </div>
    );
  }

  // Guest (or unresolved identity): offer sign-in / account creation.
  return (
    <>
      <div className="gold-hairline flex items-center gap-1 rounded-full bg-navy-800/60 py-1 pe-1 ps-3 text-xs">
        <span className="text-parchment-300/70">{m.auth.guestBadge}</span>
        <button
          onClick={() => setDialogMode("login")}
          className="rounded-full px-2.5 py-1 font-semibold text-parchment-200 transition hover:bg-navy-700 hover:text-parchment-50"
        >
          {m.auth.signIn}
        </button>
        <button
          onClick={() => setDialogMode("register")}
          className="rounded-full bg-gold-500/20 px-2.5 py-1 font-semibold text-gold-300 transition hover:bg-gold-500/30 hover:text-gold-200"
        >
          {m.auth.createAccount}
        </button>
      </div>
      {dialogMode && (
        <AuthDialog
          initialMode={dialogMode}
          onClose={() => setDialogMode(null)}
        />
      )}
    </>
  );
}
