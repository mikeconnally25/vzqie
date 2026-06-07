import { WIN_COOLDOWN_MS } from "./constants.js";
import type { WinRecord } from "./types.js";
import { normalizeUsername } from "./utils.js";

export function getLastWin(
  user: string,
  previousWins: WinRecord[]
): WinRecord | undefined {
  const normalized = normalizeUsername(user);

  return previousWins
    .filter((win) => normalizeUsername(win.username) === normalized)
    .reduce<WinRecord | undefined>((latest, win) => {
      if (!latest || win.timestamp > latest.timestamp) {
        return win;
      }
      return latest;
    }, undefined);
}

export function canWin(
  user: string,
  previousWins: WinRecord[],
  now = Date.now()
): boolean {
  const lastWin = getLastWin(user, previousWins);

  if (!lastWin) {
    return true;
  }

  const msSinceWin = now - lastWin.timestamp;
  return msSinceWin > WIN_COOLDOWN_MS;
}
