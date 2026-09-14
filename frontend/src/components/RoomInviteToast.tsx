"use client";

import { useMessages } from "@/i18n/I18nProvider";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import type { RoomInvitePush } from "@/lib/realtime";

/**
 * The bottom-center toast shown when a friend invites the user to a room
 * (Phase 4). Presentational only — SocialProvider owns the invite state and
 * wires Join (navigate) / Dismiss.
 */
export function RoomInviteToast({
  invite,
  onJoin,
  onDismiss,
}: {
  invite: RoomInvitePush;
  onJoin: () => void;
  onDismiss: () => void;
}) {
  const m = useMessages();
  const from =
    invite.from.displayName || invite.from.handle || m.social.invite.someone;

  return (
    <div className="rise-in fixed inset-x-0 bottom-4 z-60 flex justify-center px-4">
      <div className="gold-frame flex items-center gap-3 rounded-xl bg-navy-800/95 p-3 pe-4 shadow-raise-3 backdrop-blur-sm">
        <Avatar
          src={invite.from.avatar}
          name={invite.from.displayName}
          handle={invite.from.handle}
          size={36}
        />
        <div className="min-w-0">
          <p className="text-sm text-parchment-100">
            <bdi className="font-semibold text-gold-300">{from}</bdi>{" "}
            {m.social.invite.invitedYou}
          </p>
          <p className="text-xs text-parchment-300/60">
            {m.social.invite.roomCode}{" "}
            <span dir="ltr" className="font-mono tracking-widest">
              {invite.code}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={onJoin}>
            {m.social.invite.join}
          </Button>
          <button
            onClick={onDismiss}
            aria-label={m.social.invite.dismiss}
            className="grid h-7 w-7 place-items-center rounded-full text-parchment-300/60 transition hover:bg-navy-700 hover:text-parchment-100"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
