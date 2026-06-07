import type { Participant } from "./types.js";
import { normalizeUsername } from "./utils.js";

export interface DrawWinnersOptions {
  random?: () => number;
}

function secureRandom(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]! / (0xffffffff + 1);
}

export function dedupeParticipants(users: Participant[]): Participant[] {
  const byUsername = new Map<string, Participant>();

  for (const user of users) {
    const key = user.normalizedUsername || normalizeUsername(user.username);
    const existing = byUsername.get(key);

    if (!existing || user.timestamp > existing.timestamp) {
      byUsername.set(key, user);
    }
  }

  return [...byUsername.values()];
}

export function drawWinners(
  users: Participant[],
  count: number,
  options: DrawWinnersOptions = {}
): Participant[] {
  if (count <= 0) {
    return [];
  }

  const random = options.random ?? secureRandom;
  const pool = dedupeParticipants(users);
  const winners: Participant[] = [];

  while (winners.length < count && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    winners.push(pool.splice(index, 1)[0]!);
  }

  return winners;
}
