export type Rng = () => number;

export const defaultRng: Rng = () => Math.random();

export function pickWeighted<T extends { weight: number }>(items: T[], rng: Rng = defaultRng): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export function pickRandom<T>(items: T[], rng: Rng = defaultRng): T {
  return items[Math.floor(rng() * items.length)];
}
