import type { SymbolDefinition, SymbolId } from './types.js';

export const GRID_ROWS = 5;
export const GRID_COLS = 5;
export const MIN_BET = 0.2;
export const MAX_BET = 100;
export const DEFAULT_BALANCE = 1000;
export const MAX_WIN_MULTIPLIER = 12500;

/** 15 fixed paylines for the 5x5 grid (row indices per column). */
export const PAYLINES: number[][] = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3],
  [4, 4, 4, 4, 4],
  [0, 1, 2, 1, 0],
  [4, 3, 2, 3, 4],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [4, 4, 3, 2, 2],
  [2, 2, 3, 4, 4],
  [0, 1, 1, 1, 0],
  [4, 3, 3, 3, 4],
  [1, 2, 3, 2, 1],
  [3, 2, 1, 2, 3],
];

export const SYMBOLS: Record<SymbolId, SymbolDefinition> = {
  WHISTLE: { id: 'WHISTLE', label: 'Whistle', emoji: '📯', tier: 'low', pays: { 3: 0.2, 4: 0.5, 5: 1 } },
  CONE: { id: 'CONE', label: 'Cone', emoji: '🔶', tier: 'low', pays: { 3: 0.2, 4: 0.5, 5: 1 } },
  BOTTLE: { id: 'BOTTLE', label: 'Bottle', emoji: '🧴', tier: 'low', pays: { 3: 0.3, 4: 0.6, 5: 1.2 } },
  JERSEY: { id: 'JERSEY', label: 'LeBron James Jersey', emoji: '👕', tier: 'high', pays: { 3: 2.5, 4: 12, 5: 25 }, customRender: 'lebron-jersey' },
  FOOTBALL: { id: 'FOOTBALL', label: 'Football', emoji: '🏈', tier: 'mid', pays: { 3: 0.5, 4: 1.5, 5: 3 } },
  BASKETBALL: { id: 'BASKETBALL', label: 'Basketball', emoji: '🏀', tier: 'mid', pays: { 3: 0.5, 4: 1.5, 5: 3 } },
  SOCCER: { id: 'SOCCER', label: 'Soccer', emoji: '⚽', tier: 'mid', pays: { 3: 0.6, 4: 2, 5: 4 } },
  BASEBALL: { id: 'BASEBALL', label: 'Baseball', emoji: '⚾', tier: 'mid', pays: { 3: 0.6, 4: 2, 5: 4 } },
  TROPHY: { id: 'TROPHY', label: 'Trophy', emoji: '🏆', tier: 'high', pays: { 3: 1, 4: 5, 5: 10 } },
  MVP: { id: 'MVP', label: 'MVP', emoji: '🥇', tier: 'high', pays: { 3: 1.5, 4: 7.5, 5: 15 } },
  RING: { id: 'RING', label: 'Championship Ring', emoji: '💍', tier: 'high', pays: { 3: 2, 4: 10, 5: 20 } },
  WILD: { id: 'WILD', label: 'Wild Medal', emoji: '🏅', tier: 'special', pays: { 5: 25 } },
  VS: { id: 'VS', label: 'Head-to-Head', emoji: '⚔️', tier: 'special', pays: {} },
  SCATTER_COMEBACK: { id: 'SCATTER_COMEBACK', label: 'Comeback', emoji: '🔥', tier: 'special', pays: {} },
  SCATTER_RIVALRY: { id: 'SCATTER_RIVALRY', label: 'Rivalry', emoji: '⚡', tier: 'special', pays: {} },
  SCATTER_CHAMPIONSHIP: { id: 'SCATTER_CHAMPIONSHIP', label: 'Championship', emoji: '👑', tier: 'special', pays: {} },
};

/** Base-game reel strips — weighted symbol distribution per column. */
export const BASE_REEL_STRIPS: SymbolId[][] = [
  ['WHISTLE', 'CONE', 'FOOTBALL', 'BOTTLE', 'JERSEY', 'BASKETBALL', 'WHISTLE', 'SOCCER', 'CONE', 'VS', 'BASEBALL', 'BOTTLE', 'JERSEY', 'TROPHY', 'WHISTLE', 'FOOTBALL', 'SCATTER_COMEBACK', 'CONE', 'MVP', 'BASKETBALL'],
  ['JERSEY', 'BOTTLE', 'SOCCER', 'WHISTLE', 'BASEBALL', 'CONE', 'FOOTBALL', 'JERSEY', 'VS', 'BASKETBALL', 'WHISTLE', 'RING', 'CONE', 'SOCCER', 'BOTTLE', 'SCATTER_RIVALRY', 'FOOTBALL', 'JERSEY', 'BASEBALL', 'WHISTLE'],
  ['FOOTBALL', 'WHISTLE', 'BASKETBALL', 'JERSEY', 'CONE', 'SOCCER', 'VS', 'BOTTLE', 'TROPHY', 'WHISTLE', 'BASEBALL', 'JERSEY', 'CONE', 'FOOTBALL', 'SCATTER_CHAMPIONSHIP', 'BASKETBALL', 'WHISTLE', 'MVP', 'SOCCER', 'BOTTLE'],
  ['CONE', 'FOOTBALL', 'WHISTLE', 'BASKETBALL', 'JERSEY', 'VS', 'SOCCER', 'BOTTLE', 'BASEBALL', 'WHISTLE', 'RING', 'CONE', 'FOOTBALL', 'JERSEY', 'BASKETBALL', 'WHISTLE', 'SOCCER', 'SCATTER_COMEBACK', 'BOTTLE', 'TROPHY'],
  ['WHISTLE', 'JERSEY', 'CONE', 'BASKETBALL', 'FOOTBALL', 'BOTTLE', 'VS', 'SOCCER', 'WHISTLE', 'BASEBALL', 'JERSEY', 'CONE', 'MVP', 'BASKETBALL', 'WHISTLE', 'FOOTBALL', 'SCATTER_RIVALRY', 'SOCCER', 'BOTTLE', 'RING'],
];

/** Rivalry bonus uses more VS symbols on the strips. */
export const RIVALRY_REEL_STRIPS: SymbolId[][] = BASE_REEL_STRIPS.map((strip) => {
  const boosted = [...strip];
  boosted.splice(5, 0, 'VS', 'VS');
  boosted.splice(12, 0, 'VS');
  return boosted;
});

/** Comeback bonus favors wild medals landing on the reels. */
export const COMEBACK_REEL_STRIPS: SymbolId[][] = BASE_REEL_STRIPS.map((strip) => {
  const boosted = [...strip];
  boosted.splice(4, 0, 'WILD', 'WILD');
  boosted.splice(14, 0, 'WILD');
  return boosted;
});

/** Championship collect phase favors wilds and VS multiplier symbols. */
export const CHAMPIONSHIP_COLLECT_STRIPS: SymbolId[][] = BASE_REEL_STRIPS.map((strip) => {
  const boosted = [...strip];
  boosted.splice(2, 0, 'WILD', 'VS', 'WILD', 'VS');
  boosted.splice(16, 0, 'WILD', 'VS');
  return boosted;
});

export const FREE_SPINS_AWARDED = 10;
export const CHAMPIONSHIP_COLLECT_SPINS = 3;
export const CHAMPIONSHIP_SHOWDOWN_SPINS = 3;
export const MAX_CHAMPIONSHIP_WILDS = 20;
export const MAX_CHAMPIONSHIP_MULTIPLIER = 31;

/** DuelReels multiplier weights (2x–100x). */
export const DUEL_MULTIPLIER_WEIGHTS: Array<{ value: number; weight: number }> = [
  { value: 2, weight: 30 },
  { value: 3, weight: 22 },
  { value: 4, weight: 15 },
  { value: 5, weight: 10 },
  { value: 10, weight: 8 },
  { value: 15, weight: 5 },
  { value: 20, weight: 4 },
  { value: 25, weight: 3 },
  { value: 50, weight: 2 },
  { value: 100, weight: 1 },
];

export const WILD_SUBSTITUTES: SymbolId[] = [
  'WHISTLE', 'CONE', 'BOTTLE', 'JERSEY',
  'FOOTBALL', 'BASKETBALL', 'SOCCER', 'BASEBALL',
  'TROPHY', 'MVP', 'RING',
];
