"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/components/AuthProvider";
import { useMessages } from "@/i18n/I18nProvider";
import { profilesApi } from "@/lib/profiles";
import { isApiError } from "@/lib/api";
import type { UserProfile } from "@/lib/auth";

const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;

/**
 * Edit the signed-in account's display name, @handle, and avatar URL. On save,
 * updates the auth context in place so the lobby / menus reflect it immediately.
 */
export function EditProfileDialog({
  user,
  onClose,
  onSaved,
}: {
  user: UserProfile;
  onClose: () => void;
  /** Called after a successful save (the auth context is already updated). */
  onSaved: () => void;
}) {
  const m = useMessages();
  const d = m.profile.editDialog;
  const { updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [handle, setHandle] = useState(user.handle ?? "");
  const [avatar, setAvatar] = useState(user.avatar ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const h = handle.trim();
    if (h && !HANDLE_RE.test(h)) {
      setError(d.errors.invalidHandle);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Only send changed fields; "" clears displayName/avatar server-side.
      const body: { displayName?: string; handle?: string; avatar?: string } = {};
      if (displayName !== (user.displayName ?? "")) body.displayName = displayName.trim();
      if (h !== (user.handle ?? "")) body.handle = h;
      if (avatar !== (user.avatar ?? "")) body.avatar = avatar.trim();

      const { user: next } = await profilesApi.updateMe(body);
      updateUser(next);
      onSaved();
      onClose();
    } catch (e) {
      if (isApiError(e)) {
        if (e.code === "HANDLE_TAKEN") setError(d.errors.handleTaken);
        else if (e.status === 400) setError(d.errors.invalidAvatar);
        else setError(e.message || d.errors.generic);
      } else {
        setError(d.errors.generic);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={d.title} onClose={onClose} size="md">
      <div className="mb-4 flex justify-center">
        <Avatar src={avatar || null} name={displayName} handle={handle} size={72} />
      </div>

      <label className="mb-1 block text-xs text-parchment-300/70">
        {d.displayName}
      </label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={20}
        placeholder={d.displayNamePlaceholder}
        className="gold-hairline mb-3 w-full rounded-md bg-navy-950/50 px-3 py-2 text-parchment-50 transition placeholder:text-parchment-300/50 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
      />

      <label className="mb-1 block text-xs text-parchment-300/70">{d.handle}</label>
      <div className="flex items-center gap-1">
        <span className="text-parchment-300/50">@</span>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          maxLength={20}
          dir="ltr"
          placeholder={d.handlePlaceholder}
          className="gold-hairline min-w-0 flex-1 rounded-md bg-navy-950/50 px-3 py-2 text-parchment-50 transition placeholder:text-parchment-300/50 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
        />
      </div>
      <p className="mb-3 mt-1 text-xs text-parchment-300/50">{d.handleHint}</p>

      <label className="mb-1 block text-xs text-parchment-300/70">{d.avatar}</label>
      <input
        value={avatar}
        onChange={(e) => setAvatar(e.target.value)}
        maxLength={500}
        dir="ltr"
        placeholder={d.avatarPlaceholder}
        className="gold-hairline w-full rounded-md bg-navy-950/50 px-3 py-2 text-parchment-50 transition placeholder:text-parchment-300/50 focus:outline-none focus:ring-2 focus:ring-gold-400/80"
      />
      <p className="mb-4 mt-1 text-xs text-parchment-300/50">{d.avatarHint}</p>

      {error && <p className="mb-3 text-sm text-gem-red">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
          {d.cancel}
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={busy}>
          {busy ? d.saving : d.save}
        </Button>
      </div>
    </Modal>
  );
}
