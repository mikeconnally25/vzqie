import { DUEL_MULTIPLIER_WEIGHTS, GRID_ROWS, PAYLINES, SYMBOLS, WILD_SUBSTITUTES } from './constants.js';
import type { DuelReel, PaylineWin, Position, SymbolId } from './types.js';
import { pickWeighted } from './rng.js';
import type { Rng } from './rng.js';

export function findVsColumns(grid: SymbolId[][]): number[] {
  const cols = new Set<number>();
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === 'VS') cols.add(col);
    }
  }
  return [...cols];
}

export function resolveDuelReels(grid: SymbolId[][], rng: Rng): { grid: SymbolId[][]; duelReels: DuelReel[] } {
  const vsCols = findVsColumns(grid);
  if (vsCols.length === 0) {
    return { grid, duelReels: [] };
  }

  const expandedGrid = grid.map((row) => [...row]);
  const duelReels: DuelReel[] = [];

  for (const col of vsCols) {
    const multiplier = pickWeighted(DUEL_MULTIPLIER_WEIGHTS, rng).value;
    for (let row = 0; row < GRID_ROWS; row++) {
      expandedGrid[row][col] = 'WILD';
    }
    duelReels.push({ col, multiplier, expanded: true });
  }

  const winsWithoutExpansion = evaluatePaylines(grid, []);
  const winsWithExpansion = evaluatePaylines(expandedGrid, duelReels);

  if (winsWithExpansion.totalPayout > winsWithoutExpansion.totalPayout) {
    return { grid: expandedGrid, duelReels };
  }

  return { grid, duelReels: [] };
}

export function evaluatePaylines(
  grid: SymbolId[][],
  duelReels: DuelReel[],
): { wins: PaylineWin[]; totalPayout: number } {
  const wins: PaylineWin[] = [];
  let totalPayout = 0;

  for (let paylineIndex = 0; paylineIndex < PAYLINES.length; paylineIndex++) {
    const line = PAYLINES[paylineIndex];
    const symbols = line.map((row, col) => grid[row][col]);
    const result = evaluateLine(symbols, paylineIndex, line, duelReels);
    if (result) {
      wins.push(result);
      totalPayout += result.totalPayout;
    }
  }

  return { wins, totalPayout };
}

function evaluateLine(
  symbols: SymbolId[],
  paylineIndex: number,
  line: number[],
  duelReels: DuelReel[],
): PaylineWin | null {
  const anchor = findLineAnchor(symbols);
  if (!anchor) return null;

  let count = 0;
  for (const symbol of symbols) {
    if (matchesSymbol(symbol, anchor)) {
      count += 1;
    } else {
      break;
    }
  }

  if (count < 3) return null;

  const definition = SYMBOLS[anchor];
  const basePayout = definition.pays[count as 3 | 4 | 5];
  if (!basePayout) return null;

  const positions: Position[] = line.slice(0, count).map((row, col) => ({ row, col }));
  const duelMultiplier = sumDuelMultipliers(positions, duelReels);
  const lineMultiplier = duelMultiplier > 0 ? duelMultiplier : 1;
  const totalPayout = basePayout * lineMultiplier;

  return {
    paylineIndex,
    symbol: anchor,
    count,
    positions,
    basePayout,
    multiplier: lineMultiplier,
    totalPayout,
  };
}

function findLineAnchor(symbols: SymbolId[]): SymbolId | null {
  for (const symbol of symbols) {
    if (symbol === 'WILD') continue;
    if (WILD_SUBSTITUTES.includes(symbol)) return symbol;
    return null;
  }

  if (symbols.length >= 5 && symbols.every((symbol) => symbol === 'WILD')) {
    return 'WILD';
  }

  return null;
}

function sumDuelMultipliers(positions: Position[], duelReels: DuelReel[]): number {
  const contributing = new Set<number>();
  for (const pos of positions) {
    const duel = duelReels.find((d) => d.col === pos.col && d.expanded);
    if (duel) contributing.add(duel.col);
  }
  if (contributing.size === 0) return 0;
  let sum = 0;
  for (const col of contributing) {
    const duel = duelReels.find((d) => d.col === col);
    if (duel) sum += duel.multiplier;
  }
  return sum;
}

function matchesSymbol(symbol: SymbolId, target: SymbolId): boolean {
  if (symbol === 'WILD') return true;
  return symbol === target;
}
