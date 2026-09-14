"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  friendsApi,
  type BlockedView,
  type FriendView,
  type FriendsOverview,
  type RequestView,
  type SendRequestResult,
} from "@/lib/social";
import {
  connectSocial,
  type RealtimeHandle,
  type RoomInvitePush,
} from "@/lib/realtime";
import { getAccessToken } from "@/lib/auth";
import { getGuestToken } from "@/lib/session";
import { useAuth } from "@/components/AuthProvider";
import { RoomInviteToast } from "@/components/RoomInviteToast";

interface SocialContextValue {
  /** True for a signed-in account (friends are account-only). */
  isUser: boolean;
  /** True once the initial friends overview has loaded. */
  ready: boolean;
  friends: FriendView[];
  incoming: RequestView[];
  outgoing: RequestView[];
  blocked: BlockedView[];
  /** Live presence for a user id (merges the socket feed). */
  isOnline: (userId: string) => boolean;
  /** Number of incoming requests awaiting a response. */
  pendingCount: number;
  refresh: () => Promise<void>;
  sendRequest: (handle: string) => Promise<SendRequestResult>;
  accept: (id: string) => Promise<void>;
  decline: (id: string) => Promise<void>;
  remove: (userId: string) => Promise<void>;
  block: (userId: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
  invite: (userId: string, code: string) => Promise<void>;
}

const EMPTY: FriendsOverview = {
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
};

const NEVER_ONLINE = () => false;

const Ctx = createContext<SocialContextValue | null>(null);

/**
 * Client-side social state (Phase 4): the friends overview plus a live `/social`
 * socket for presence, incoming requests, friend-graph changes, and room
 * invites. Active only for signed-in accounts; guests get an inert context so
 * consumers can call `useSocial()` unconditionally. Rendered inside AuthProvider.
 */
export function SocialProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, user } = useAuth();
  const isUser = status === "user" && !!user;

  const [overview, setOverview] = useState<FriendsOverview>(EMPTY);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [invite, setInvite] = useState<RoomInvitePush | null>(null);
  const handleRef = useRef<RealtimeHandle | null>(null);

  const refresh = useCallback(async () => {
    if (!isUser) return;
    try {
      const data = await friendsApi.overview();
      setOverview(data);
      setOnline((prev) => {
        const next = new Set(prev);
        for (const f of data.friends) {
          if (f.online) next.add(f.userId);
        }
        return next;
      });
      setReady(true);
    } catch {
      // Leave prior state; a socket event or retry will reconcile.
    }
  }, [isUser]);

  // Load overview + open the social socket for a signed-in user; tear down on
  // logout or account switch. State isn't reset here (that would be a synchronous
  // setState-in-effect) — the context value below is gated by `isUser`, so a
  // signed-out viewer never sees a previous account's data, and the next login's
  // refresh() overwrites it.
  useEffect(() => {
    if (!isUser) return;

    // refresh() only sets state after an await (never synchronously here).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    handleRef.current?.disconnect();
    handleRef.current = connectSocial(
      () => ({ accessToken: getAccessToken(), guestToken: getGuestToken() }),
      {
        onReady: ({ online: ids }) => setOnline(new Set(ids)),
        onPresence: ({ userId, online: isUp }) =>
          setOnline((prev) => {
            // Skip the state churn (and consumer re-renders) on a no-op update.
            if (isUp === prev.has(userId)) return prev;
            const next = new Set(prev);
            if (isUp) next.add(userId);
            else next.delete(userId);
            return next;
          }),
        onRequest: () => void refresh(),
        onChanged: () => void refresh(),
        onRoomInvite: (inv) => setInvite(inv),
      },
    );

    return () => {
      handleRef.current?.disconnect();
      handleRef.current = null;
      // Drop any un-dismissed invite so it can't leak into a next login/account.
      setInvite(null);
    };
  }, [isUser, user?.id, refresh]);

  const isOnline = useCallback((userId: string) => online.has(userId), [online]);

  const sendRequest = useCallback(
    async (handle: string) => {
      const result = await friendsApi.sendRequest(handle);
      await refresh();
      return result;
    },
    [refresh],
  );

  // Stable action callbacks so the context value's identity only changes when
  // the underlying data does (avoids re-rendering every useSocial consumer).
  const accept = useCallback(
    async (id: string) => {
      await friendsApi.accept(id);
      await refresh();
    },
    [refresh],
  );
  const decline = useCallback(
    async (id: string) => {
      await friendsApi.decline(id);
      await refresh();
    },
    [refresh],
  );
  const remove = useCallback(
    async (userId: string) => {
      await friendsApi.remove(userId);
      await refresh();
    },
    [refresh],
  );
  const block = useCallback(
    async (userId: string) => {
      await friendsApi.block(userId);
      await refresh();
    },
    [refresh],
  );
  const unblock = useCallback(
    async (userId: string) => {
      await friendsApi.unblock(userId);
      await refresh();
    },
    [refresh],
  );
  const invite_ = useCallback(
    (userId: string, code: string) => friendsApi.invite(userId, code),
    [],
  );

  // Gate everything by `isUser` so a signed-out viewer never sees leftover data
  // from a previous account (state is intentionally not reset on logout).
  const value = useMemo<SocialContextValue>(() => {
    const data = isUser ? overview : EMPTY;
    return {
      isUser,
      ready: isUser && ready,
      friends: data.friends,
      incoming: data.incoming,
      outgoing: data.outgoing,
      blocked: data.blocked,
      isOnline: isUser ? isOnline : NEVER_ONLINE,
      pendingCount: data.incoming.length,
      refresh,
      sendRequest,
      accept,
      decline,
      remove,
      block,
      unblock,
      invite: invite_,
    };
  }, [
    isUser,
    ready,
    overview,
    isOnline,
    refresh,
    sendRequest,
    accept,
    decline,
    remove,
    block,
    unblock,
    invite_,
  ]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {isUser && invite && (
        <RoomInviteToast
          invite={invite}
          onJoin={() => {
            const code = invite.code;
            setInvite(null);
            router.push(`/room/${code}`);
          }}
          onDismiss={() => setInvite(null)}
        />
      )}
    </Ctx.Provider>
  );
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSocial must be used inside SocialProvider");
  return ctx;
}
