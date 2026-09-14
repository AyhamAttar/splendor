"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { useSocial } from "@/components/SocialProvider";
import { useMessages } from "@/i18n/I18nProvider";
import { isApiError } from "@/lib/api";
import type { BlockedView, FriendView, RequestView } from "@/lib/social";

type Tab = "friends" | "requests" | "blocked";

/** Map a backend friend error `code` to a localized message. */
function useFriendError() {
  const m = useMessages();
  return (e: unknown): string => {
    if (isApiError(e)) {
      const map: Record<string, string> = {
        USER_NOT_FOUND: m.social.errors.userNotFound,
        ALREADY_FRIENDS: m.social.errors.alreadyFriends,
        REQUEST_ALREADY_SENT: m.social.errors.requestPending,
        CANNOT_FRIEND_SELF: m.social.errors.self,
      };
      return map[String(e.code)] ?? e.message ?? m.social.errors.generic;
    }
    return m.social.errors.generic;
  };
}

export function FriendsPanel({ onClose }: { onClose: () => void }) {
  const m = useMessages();
  const social = useSocial();
  const toError = useFriendError();
  const [tab, setTab] = useState<Tab>("friends");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const value = handle.trim();
    if (!value) {
      setError(m.social.add.noHandle);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { accepted } = await social.sendRequest(value);
      setNotice(accepted ? m.social.add.accepted : m.social.add.sent);
      setHandle("");
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  };

  const incomingBadge = social.incoming.length;

  return (
    <Modal title={m.social.title} onClose={onClose} size="md">
      {/* Add by handle */}
      <div className="mb-4">
        <label className="mb-1 block text-xs text-parchment-300/70">
          {m.social.add.label}
        </label>
        <div className="flex gap-2">
          <span className="pointer-events-none flex items-center ps-1 text-parchment-300/50">
            @
          </span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={20}
            dir="ltr"
            placeholder={m.social.add.placeholder}
            className="gold-hairline min-w-0 flex-1 rounded-md bg-navy-950/50 px-3 py-2 text-parchment-50 transition placeholder:text-parchment-300/50 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
            onKeyDown={(e) => e.key === "Enter" && void send()}
          />
          <Button size="sm" onClick={() => void send()} disabled={busy}>
            {busy ? m.social.add.sending : m.social.add.button}
          </Button>
        </div>
        {notice && <p className="mt-2 text-sm text-gem-green">{notice}</p>}
        {error && <p className="mt-2 text-sm text-gem-red">{error}</p>}
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-1 border-b border-gold-700/25">
        <TabButton active={tab === "friends"} onClick={() => setTab("friends")}>
          {m.social.tabs.friends} ({social.friends.length})
        </TabButton>
        <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>
          {m.social.tabs.requests}
          {incomingBadge > 0 && (
            <span className="ms-1.5 rounded-full bg-gem-red px-1.5 text-[10px] font-bold text-white">
              {incomingBadge}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "blocked"} onClick={() => setTab("blocked")}>
          {m.social.tabs.blocked}
        </TabButton>
      </div>

      <div className="max-h-[50vh] overflow-y-auto pe-1">
        {tab === "friends" && (
          <FriendsList
            friends={social.friends}
            isOnline={social.isOnline}
            busy={busy}
            onClose={onClose}
            onRemove={(id) => run(() => social.remove(id))}
            onBlock={(id) => run(() => social.block(id))}
          />
        )}
        {tab === "requests" && (
          <RequestsList
            incoming={social.incoming}
            outgoing={social.outgoing}
            busy={busy}
            onClose={onClose}
            onAccept={(id) => run(() => social.accept(id))}
            onDecline={(id) => run(() => social.decline(id))}
            onCancel={(uid) => run(() => social.remove(uid))}
          />
        )}
        {tab === "blocked" && (
          <BlockedList
            blocked={social.blocked}
            busy={busy}
            onUnblock={(id) => run(() => social.unblock(id))}
          />
        )}
      </div>
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px inline-flex items-center border-b-2 px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-gold-400 text-gold-300"
          : "border-transparent text-parchment-300/60 hover:text-parchment-100"
      }`}
    >
      {children}
    </button>
  );
}

/** Avatar + display name + @handle — the shared identity block of a list row. */
function UserLabel({
  displayName,
  handle,
  avatar,
}: {
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
}) {
  return (
    <>
      <Avatar src={avatar} name={displayName} handle={handle} size={34} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-parchment-50">
          <bdi>{displayName || handle || "—"}</bdi>
        </span>
        {handle && (
          <span dir="ltr" className="block truncate text-xs text-parchment-300/55">
            @{handle}
          </span>
        )}
      </span>
    </>
  );
}

/** UserLabel wrapped in a link to the profile — used by friend/request rows. */
function Identity({
  userId,
  displayName,
  handle,
  avatar,
  onClose,
}: {
  userId: string;
  displayName: string | null;
  handle: string | null;
  avatar: string | null;
  onClose: () => void;
}) {
  const m = useMessages();
  return (
    <Link
      href={`/profile/${userId}`}
      onClick={onClose}
      title={m.social.actions.viewProfile}
      className="flex min-w-0 flex-1 items-center gap-2.5"
    >
      <UserLabel displayName={displayName} handle={handle} avatar={avatar} />
    </Link>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="gold-hairline flex items-center gap-2 rounded-lg bg-navy-900/50 px-3 py-2">
      {children}
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-parchment-300/55">{children}</p>
  );
}

function FriendsList({
  friends,
  isOnline,
  busy,
  onClose,
  onRemove,
  onBlock,
}: {
  friends: FriendView[];
  isOnline: (id: string) => boolean;
  busy: boolean;
  onClose: () => void;
  onRemove: (userId: string) => void;
  onBlock: (userId: string) => void;
}) {
  const m = useMessages();
  if (friends.length === 0) return <Empty>{m.social.empty.friends}</Empty>;
  return (
    <ul className="flex flex-col gap-2">
      {friends.map((f) => {
        const online = isOnline(f.userId);
        return (
          <Row key={f.friendshipId}>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                online
                  ? "bg-gem-green shadow-[0_0_8px] shadow-gem-green/60"
                  : "bg-parchment-300/25"
              }`}
              title={online ? m.social.online : m.social.offline}
            />
            <Identity {...f} onClose={onClose} />
            <button
              onClick={() => onRemove(f.userId)}
              disabled={busy}
              className="rounded px-2 py-1 text-xs text-parchment-300/60 transition hover:bg-navy-700 hover:text-parchment-100 disabled:opacity-40"
            >
              {m.social.actions.remove}
            </button>
            <button
              onClick={() => onBlock(f.userId)}
              disabled={busy}
              className="rounded px-2 py-1 text-xs text-parchment-300/50 transition hover:bg-gem-red/15 hover:text-gem-red disabled:opacity-40"
            >
              {m.social.actions.block}
            </button>
          </Row>
        );
      })}
    </ul>
  );
}

function RequestsList({
  incoming,
  outgoing,
  busy,
  onClose,
  onAccept,
  onDecline,
  onCancel,
}: {
  incoming: RequestView[];
  outgoing: RequestView[];
  busy: boolean;
  onClose: () => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCancel: (userId: string) => void;
}) {
  const m = useMessages();
  if (incoming.length === 0 && outgoing.length === 0) {
    return <Empty>{m.social.empty.incoming}</Empty>;
  }
  return (
    <div className="flex flex-col gap-4">
      {incoming.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs uppercase tracking-wide text-parchment-300/55">
            {m.social.incomingHeading}
          </h4>
          <ul className="flex flex-col gap-2">
            {incoming.map((r) => (
              <Row key={r.id}>
                <Identity {...r} onClose={onClose} />
                <Button size="xs" onClick={() => onAccept(r.id)} disabled={busy}>
                  {m.social.actions.accept}
                </Button>
                <button
                  onClick={() => onDecline(r.id)}
                  disabled={busy}
                  className="rounded px-2 py-1 text-xs text-parchment-300/60 transition hover:bg-navy-700 hover:text-parchment-100 disabled:opacity-40"
                >
                  {m.social.actions.decline}
                </button>
              </Row>
            ))}
          </ul>
        </div>
      )}
      {outgoing.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs uppercase tracking-wide text-parchment-300/55">
            {m.social.outgoingHeading}
          </h4>
          <ul className="flex flex-col gap-2">
            {outgoing.map((r) => (
              <Row key={r.id}>
                <Identity {...r} onClose={onClose} />
                <button
                  onClick={() => onCancel(r.userId)}
                  disabled={busy}
                  className="rounded px-2 py-1 text-xs text-parchment-300/60 transition hover:bg-navy-700 hover:text-parchment-100 disabled:opacity-40"
                >
                  {m.social.actions.cancel}
                </button>
              </Row>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BlockedList({
  blocked,
  busy,
  onUnblock,
}: {
  blocked: BlockedView[];
  busy: boolean;
  onUnblock: (userId: string) => void;
}) {
  const m = useMessages();
  if (blocked.length === 0) return <Empty>{m.social.empty.blocked}</Empty>;
  return (
    <ul className="flex flex-col gap-2">
      {blocked.map((b) => (
        <Row key={b.userId}>
          <UserLabel displayName={b.displayName} handle={b.handle} avatar={b.avatar} />
          <Button size="xs" variant="ghost" onClick={() => onUnblock(b.userId)} disabled={busy}>
            {m.social.actions.unblock}
          </Button>
        </Row>
      ))}
    </ul>
  );
}
