"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  authApi,
  setAccessToken,
  type GuestProfile,
  type UserProfile,
} from "@/lib/auth";
import { getGuestToken, setGuestToken } from "@/lib/session";

type AuthStatus = "loading" | "user" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  guest: GuestProfile | null;
  /** True once bootstrap has resolved (user or guest). */
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Register a new account; upgrades the current guest if one exists. */
  register: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  /** Replace the signed-in profile in place (e.g. after a profile edit). */
  updateUser: (next: UserProfile) => void;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [guest, setGuest] = useState<GuestProfile | null>(null);

  const becomeUser = useCallback((next: UserProfile, token: string) => {
    setAccessToken(token);
    setUser(next);
    setGuest(null);
    setStatus("user");
  }, []);

  /** Fall back to the durable guest identity (mint one if needed). */
  const ensureGuest = useCallback(async () => {
    try {
      const { guestToken, guest: g } = await authApi.guest(getGuestToken());
      setGuestToken(guestToken);
      setGuest(g);
    } catch {
      // Server unreachable — stay in guest mode without a fresh identity.
    }
    setUser(null);
    setStatus("guest");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // On load the in-memory access token is gone; re-mint it from the
      // httpOnly refresh cookie. Success ⇒ signed in; failure ⇒ guest.
      try {
        const { user: u, accessToken } = await authApi.refresh();
        if (cancelled) return;
        becomeUser(u, accessToken);
        return;
      } catch {
        /* not signed in */
      }
      if (!cancelled) await ensureGuest();
    })();
    return () => {
      cancelled = true;
    };
  }, [becomeUser, ensureGuest]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: u, accessToken } = await authApi.login({ email, password });
      becomeUser(u, accessToken);
    },
    [becomeUser],
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { user: u, accessToken } = await authApi.register(
        { email, password, ...(displayName ? { displayName } : {}) },
        getGuestToken(),
      );
      becomeUser(u, accessToken);
    },
    [becomeUser],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* revoke best-effort; clear locally regardless */
    }
    setAccessToken(null);
    await ensureGuest();
  }, [ensureGuest]);

  const updateUser = useCallback((next: UserProfile) => {
    setUser((prev) => (prev ? next : prev));
  }, []);

  return (
    <Ctx.Provider
      value={{
        status,
        user,
        guest,
        ready: status !== "loading",
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
