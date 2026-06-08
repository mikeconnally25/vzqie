import {
  SYMBOLS,
  MIN_BET,
  MAX_BET,
  createGameState,
  canSpin,
  spin,
  setBet,
  bonusDisplayName,
} from '../src/slot/index.js';
import type { GameState, SymbolId } from '../src/slot/types.js';

const BET_STEPS = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const gridEl = $('grid');
const balanceEl = $('balance');
const lastWinEl = $('lastWin');
const totalWonEl = $('totalWon');
const betValueEl = $('betValue');
const spinBtn = $('spinBtn') as HTMLButtonElement;
const spinSubEl = $('spinSub');
const betUpBtn = $('betUp') as HTMLButtonElement;
const betDownBtn = $('betDown') as HTMLButtonElement;
const autoBtn = $('autoBtn') as HTMLButtonElement;
const winLineEl = $('winLine');
const phaseBannerEl = $('phaseBanner');
const duelOverlayEl = $('duelOverlay');
const duelMultiplierEl = $('duelMultiplier');
const bonusPanelEl = $('bonusPanel');
const bonusTitleEl = $('bonusTitle');
const bonusDescEl = $('bonusDesc');
const championshipPanelEl = $('championshipPanel');
const champWildsEl = $('champWilds');
const champMultEl = $('champMult');
const champSpinsEl = $('champSpins');

let state: GameState = createGameState();
let spinning = false;
let autoSpinsLeft = 0;

const SPIN_SYMBOLS: SymbolId[] = Object.keys(SYMBOLS) as SymbolId[];

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function phaseLabel(phase: GameState['phase']): string {
  switch (phase) {
    case 'base': return 'Base Game';
    case 'comeback': return '🔥 The Great Comeback — Free Spins';
    case 'rivalry': return '⚡ Rivalry Match — Free Spins';
    case 'championship_collect': return '👑 Championship Run — Collect Phase';
    case 'championship_showdown': return '👑 Championship Run — Showdown!';
    default: return 'Base Game';
  }
}

function bonusDescription(type: string): string {
  switch (type) {
    case 'comeback':
      return '10 free spins! Wild medals stick to the reels for the entire bonus.';
    case 'rivalry':
      return '10 free spins with extra Head-to-Head VS symbols for bigger multipliers.';
    case 'championship':
      return 'Collect wilds and multipliers, then unleash them in a 3-spin showdown.';
    default:
      return '';
  }
}

function renderSymbol(cell: HTMLElement, def: (typeof SYMBOLS)[SymbolId]) {
  if (def.customRender === 'lebron-jersey') {
    cell.classList.add('has-lebron-jersey');
    const img = document.createElement('img');
    img.src = '/lebron-jersey.svg';
    img.alt = def.label;
    img.className = 'symbol-img lebron-jersey';
    cell.appendChild(img);
    return;
  }
  cell.textContent = def.emoji;
}

function renderGrid(grid: SymbolId[][], winningPositions: Set<string>, duelCols: Set<number>, duelMults: Map<number, number>) {
  gridEl.innerHTML = '';
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const symbol = grid[row][col];
      const def = SYMBOLS[symbol];
      const cell = document.createElement('div');
      cell.className = 'cell';
      const key = `${row},${col}`;
      if (winningPositions.has(key)) cell.classList.add('winning');
      if (duelCols.has(col)) cell.classList.add('wild-reel');
      renderSymbol(cell, def);
      cell.title = def.label;

      const mult = duelMults.get(col);
      if (mult && duelCols.has(col)) {
        const badge = document.createElement('span');
        badge.className = 'mult-badge';
        badge.textContent = `×${mult}`;
        cell.appendChild(badge);
      }

      gridEl.appendChild(cell);
    }
  }
}

function renderSpinningGrid() {
  gridEl.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell spinning';
    const randomSymbol = SPIN_SYMBOLS[Math.floor(Math.random() * SPIN_SYMBOLS.length)];
    renderSymbol(cell, SYMBOLS[randomSymbol]);
    gridEl.appendChild(cell);
  }
}

function updateUI() {
  balanceEl.textContent = formatMoney(state.balance);
  lastWinEl.textContent = formatMoney(state.lastSpin?.totalWin ?? 0);
  totalWonEl.textContent = formatMoney(state.totalWon);
  betValueEl.textContent = formatMoney(state.bet);
  phaseBannerEl.textContent = phaseLabel(state.phase);

  const inBonus = state.phase !== 'base';
  spinSubEl.textContent = inBonus && state.freeSpinsRemaining > 0
    ? `${state.freeSpinsRemaining} free spins left`
    : inBonus
      ? ''
      : '';

  spinBtn.disabled = spinning || !canSpin(state);
  betUpBtn.disabled = spinning || inBonus;
  betDownBtn.disabled = spinning || inBonus;

  if (state.phase === 'championship_collect' || state.phase === 'championship_showdown') {
    championshipPanelEl.classList.remove('hidden');
    const champ = state.championship;
    champWildsEl.textContent = String(champ?.collectedWilds ?? 0);
    champMultEl.textContent = `×${champ?.collectedMultiplier ?? 0}`;
    champSpinsEl.textContent = String(
      state.phase === 'championship_showdown'
        ? champ?.showdownSpinsRemaining ?? 0
        : champ?.spinsRemaining ?? 0,
    );
  } else {
    championshipPanelEl.classList.add('hidden');
  }

  if (state.lastSpin) {
    const winningPositions = new Set<string>();
    for (const win of state.lastSpin.wins) {
      for (const pos of win.positions) {
        winningPositions.add(`${pos.row},${pos.col}`);
      }
    }
    const duelCols = new Set(state.lastSpin.duelReels.map((d) => d.col));
    const duelMults = new Map(state.lastSpin.duelReels.map((d) => [d.col, d.multiplier]));
    renderGrid(state.lastSpin.grid, winningPositions, duelCols, duelMults);

    if (state.lastSpin.totalWin > 0) {
      winLineEl.textContent = `WIN ${formatMoney(state.lastSpin.totalWin)}`;
    } else {
      winLineEl.textContent = '';
    }
  }
}

async function playDuelAnimation(multiplier: number): Promise<void> {
  duelMultiplierEl.textContent = `×${multiplier}`;
  duelOverlayEl.classList.remove('hidden');
  await delay(1400);
  duelOverlayEl.classList.add('hidden');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function doSpin(): Promise<void> {
  if (spinning || !canSpin(state)) return;
  spinning = true;
  spinBtn.disabled = true;
  winLineEl.textContent = '';
  bonusPanelEl.classList.add('hidden');
  renderSpinningGrid();

  await delay(600);

  const { state: nextState, result } = spin(state);
  state = nextState;

  for (const event of result.events) {
    if (event.type === 'duel') {
      await playDuelAnimation(event.multiplier);
    }
    if (event.type === 'bonus_trigger') {
      bonusPanelEl.classList.remove('hidden');
      bonusTitleEl.textContent = `${bonusDisplayName(event.bonus)} Triggered!`;
      bonusDescEl.textContent = bonusDescription(event.bonus ?? '');
      await delay(1200);
    }
    if (event.type === 'championship_showdown_start') {
      bonusPanelEl.classList.remove('hidden');
      bonusTitleEl.textContent = 'Showdown Phase!';
      bonusDescEl.textContent = `${event.wilds} wilds and ×${event.multiplier} multiplier ready to fire.`;
      await delay(1000);
    }
  }

  updateUI();
  spinning = false;

  if (autoSpinsLeft > 0 && canSpin(state)) {
    autoSpinsLeft -= 1;
    await delay(400);
    void doSpin();
  }
}

function changeBet(direction: 1 | -1) {
  const idx = BET_STEPS.indexOf(state.bet);
  const nextIdx = Math.max(0, Math.min(BET_STEPS.length - 1, idx + direction));
  state = setBet(state, BET_STEPS[nextIdx]);
  updateUI();
}

spinBtn.addEventListener('click', () => void doSpin());
betUpBtn.addEventListener('click', () => changeBet(1));
betDownBtn.addEventListener('click', () => changeBet(-1));
autoBtn.addEventListener('click', () => {
  if (spinning) return;
  autoSpinsLeft = 10;
  void doSpin();
});

const initialGrid: SymbolId[][] = Array.from({ length: 5 }, (_, row) =>
  Array.from({ length: 5 }, () => (row === 0 ? 'JERSEY' : 'FOOTBALL') as SymbolId),
);
renderGrid(initialGrid, new Set(), new Set(), new Map());
updateUI();
