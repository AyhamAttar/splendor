// The display name a player uses in online games (rooms / quick-match). Kept in
// localStorage so it persists across visits and is shared by the create/join/
// quick-match flows and the room page (which may need it to auto-join a link).
const NAME_KEY = "splendor.name";

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function setPlayerName(name: string): void {
  window.localStorage.setItem(NAME_KEY, name);
}
