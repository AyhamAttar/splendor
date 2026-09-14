"use client";

import { useState } from "react";
import { useSocial } from "@/components/SocialProvider";
import { FriendsPanel } from "@/components/FriendsPanel";
import { useMessages } from "@/i18n/I18nProvider";

/**
 * Lobby control that opens the friends panel, with a badge for pending incoming
 * requests. Renders nothing for guests (friends are account-only).
 */
export function FriendsButton() {
  const m = useMessages();
  const social = useSocial();
  const [open, setOpen] = useState(false);

  if (!social.isUser) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="gold-hairline relative flex items-center gap-1.5 rounded-full bg-navy-800/60 px-3 py-1 text-xs font-semibold text-parchment-200 transition hover:bg-navy-700 hover:text-parchment-50"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M16 11a4 4 0 10-4-4 4 4 0 004 4zm-8 1a3 3 0 10-3-3 3 3 0 003 3zm0 2c-2.7 0-6 1.34-6 4v2h7v-2c0-1.1.44-2.07 1.16-2.86A9.2 9.2 0 008 14zm8 0c-3.3 0-8 1.34-8 4v2h16v-2c0-2.66-4.7-4-8-4z" />
        </svg>
        {m.social.open}
        {social.pendingCount > 0 && (
          <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gem-red px-1 text-[10px] font-bold text-white">
            {social.pendingCount}
          </span>
        )}
      </button>
      {open && <FriendsPanel onClose={() => setOpen(false)} />}
    </>
  );
}
