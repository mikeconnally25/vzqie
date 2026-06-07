import { normalizeUsername } from "./utils.js";

const BOT_BLACKLIST = new Set([
  "nightbot",
  "streamelements",
  "fossabot",
  "moobot",
]);

export function allowed(username: string): boolean {
  return !BOT_BLACKLIST.has(normalizeUsername(username));
}
