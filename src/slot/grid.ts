import { GRID_COLS, GRID_ROWS, BASE_REEL_STRIPS, RIVALRY_REEL_STRIPS } from './constants.js';
import type { GamePhase, Position, StickyWild, SymbolId } from './types.js';
import { pickRandom } from './rng.js';
import type { Rng } from './rng.js';

export function createEmptyGrid(): SymbolId[][] {
  return Array.from({ length: GRID_ROWS }, () => Array<SymbolId>(GRID_COLS).fill('WHISTLE'));
}

export function spinGrid(phase: GamePhase, rng: Rng): SymbolId[][] {
  const strips = phase === 'rivalry' ? RIVALRY_REEL_STRIPS : BASE_REEL_STRIPS;
  const grid = createEmptyGrid();

  for (let col = 0; col < GRID_COLS; col++) {
    const strip = strips[col];
    const start = Math.floor(rng() * strip.length);
    for (let row = 0; row < GRID_ROWS; row++) {
      grid[row][col] = strip[(start + row) % strip.length];
    }
  }

  return grid;
}

export function applyStickyWilds(grid: SymbolId[][], stickyWilds: StickyWild[]): SymbolId[][] {
  const next = grid.map((row) => [...row]);
  for (const wild of stickyWilds) {
    next[wild.row][wild.col] = 'WILD';
  }
  return next;
}

export function placeChampionshipWilds(
  grid: SymbolId[][],
  wildCount: number,
  rng: Rng,
): SymbolId[][] {
  const next = grid.map((row) => [...row]);
  const positions: Position[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      positions.push({ row, col });
    }
  }

  const shuffled = [...positions].sort(() => rng() - 0.5);
  const count = Math.min(wildCount, shuffled.length);
  for (let i = 0; i < count; i++) {
    const { row, col } = shuffled[i];
    next[row][col] = 'WILD';
  }
  return next;
}

export function countScatters(grid: SymbolId[][]): Partial<Record<'SCATTER_COMEBACK' | 'SCATTER_RIVALRY' | 'SCATTER_CHAMPIONSHIP', number>> {
  const counts: Partial<Record<'SCATTER_COMEBACK' | 'SCATTER_RIVALRY' | 'SCATTER_CHAMPIONSHIP', number>> = {};
  for (const row of grid) {
    for (const symbol of row) {
      if (symbol === 'SCATTER_COMEBACK' || symbol === 'SCATTER_RIVALRY' || symbol === 'SCATTER_CHAMPIONSHIP') {
        counts[symbol] = (counts[symbol] ?? 0) + 1;
      }
    }
  }
  return counts;
}

export function findNewWildPositions(grid: SymbolId[][], existing: StickyWild[]): StickyWild[] {
  const occupied = new Set(existing.map((w) => `${w.row},${w.col}`));
  const found: StickyWild[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const key = `${row},${col}`;
      if (grid[row][col] === 'WILD' && !occupied.has(key)) {
        found.push({ row, col });
        occupied.add(key);
      }
    }
  }
  return found;
}

export function collectChampionshipSymbols(grid: SymbolId[][], rng: Rng): { wilds: number; multiplier: number } {
  let wilds = 0;
  let multiplier = 0;
  for (const row of grid) {
    for (const symbol of row) {
      if (symbol === 'WILD') wilds += 1;
      if (symbol === 'VS') multiplier += pickChampionshipMultiplierValue(rng);
    }
  }
  return { wilds, multiplier };
}

function pickChampionshipMultiplierValue(rng: Rng): number {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 31];
  return pickRandom(values, rng);
}
