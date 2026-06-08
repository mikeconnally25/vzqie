import {
  SYMBOLS,
  PAYLINES,
  GRID_ROWS,
  GRID_COLS,
  DEFAULT_BALANCE,
  createGameState,
  canSpin,
  spin,
  setBet,
  resetGame,
  bonusDisplayName,
} from '../src/slot/index.js';
import type { DuelReel, GameState, PaylineWin, SpinResult, StickyWild, SymbolId } from '../src/slot/types.js';

const BET_STEPS = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
const STORAGE_KEY = 'game-day-showdown-state';
const REEL_SYMBOLS: SymbolId[] = [
  'WHISTLE', 'CONE', 'BOTTLE', 'JERSEY', 'FOOTBALL', 'BASKETBALL', 'SOCCER', 'BASEBALL',
  'TROPHY', 'MVP', 'RING', 'WILD', 'VS',
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const gridEl = $('grid');
const balanceEl = $('balance');
const lastWinEl = $('lastWin');
const totalWonEl = $('totalWon');
const betValueEl = $('betValue');
const spinBtn = $('spinBtn') as HTMLButtonElement;
const spinTextEl = $('spinText');
const spinSubEl = $('spinSub');
const betUpBtn = $('betUp') as HTMLButtonElement;
const betDownBtn = $('betDown') as HTMLButtonElement;
const autoBtn = $('autoBtn') as HTMLButtonElement;
const winLineEl = $('winLine');
const winDetailsEl = $('winDetails');
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
const paytableBtn = $('paytableBtn');
const paytableModal = $('paytableModal') as HTMLDialogElement;
const paytableContent = $('paytableContent');
const closePaytable = $('closePaytable');
const resetBtn = $('resetBtn');
const gameOverModal = $('gameOverModal') as HTMLDialogElement;
const gameOverReset = $('gameOverReset');
const reelFrameEl = $('reelFrame');
const bigWinEl = $('bigWin');

interface SavedSpin {
  grid: SymbolId[][];
  wins: PaylineWin[];
  duelReels: DuelReel[];
  totalWin: number;
}

let state: GameState = loadState() ?? createGameState();
let spinning = false;
let autoSpinsLeft = 0;
let gameOverShown = false;

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function saveState(): void {
  const payload = {
    balance: state.balance,
    bet: state.bet,
    phase: state.phase,
    freeSpinsRemaining: state.freeSpinsRemaining,
    stickyWilds: state.stickyWilds,
    championship: state.championship,
    totalWon: state.totalWon,
    lastSpin: state.lastSpin
      ? {
          grid: state.lastSpin.grid,
          wins: state.lastSpin.wins,
          duelReels: state.lastSpin.duelReels,
          totalWin: state.lastSpin.totalWin,
        }
      : undefined,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<GameState> & { lastSpin?: SavedSpin };
    const base = createGameState(data.balance ?? DEFAULT_BALANCE, data.bet ?? 0.2);
    const restored: GameState = {
      ...base,
      phase: data.phase ?? 'base',
      freeSpinsRemaining: data.freeSpinsRemaining ?? 0,
      stickyWilds: data.stickyWilds ?? [],
      championship: data.championship,
      totalWon: data.totalWon ?? 0,
    };
    if (data.lastSpin) {
      restored.lastSpin = {
        ...data.lastSpin,
        scatterCount: {},
        triggeredBonus: null,
        phase: restored.phase,
        freeSpinsAwarded: 0,
        freeSpinsRemaining: restored.freeSpinsRemaining,
        championship: restored.championship,
        stickyWilds: restored.stickyWilds,
        events: [],
      };
    }
    return restored;
  } catch {
    return null;
  }
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

function stickySet(stickyWilds: StickyWild[]): Set<string> {
  return new Set(stickyWilds.map((w) => `${w.row},${w.col}`));
}

function renderGrid(
  grid: SymbolId[][],
  winningPositions: Set<string>,
  duelCols: Set<number>,
  duelMults: Map<number, number>,
  stickyWilds: StickyWild[] = [],
) {
  const sticky = stickySet(stickyWilds);
  gridEl.innerHTML = '';

  for (let col = 0; col < GRID_COLS; col++) {
    const column = document.createElement('div');
    column.className = 'reel-col';
    column.dataset.col = String(col);

    for (let row = 0; row < GRID_ROWS; row++) {
      const symbol = grid[row][col];
      const def = SYMBOLS[symbol];
      const cell = document.createElement('div');
      cell.className = 'cell';
      const key = `${row},${col}`;
      if (winningPositions.has(key)) cell.classList.add('winning');
      if (duelCols.has(col)) cell.classList.add('wild-reel');
      if (sticky.has(key)) cell.classList.add('sticky-wild');
      renderSymbol(cell, def);
      cell.title = def.label;

      const mult = duelMults.get(col);
      if (mult && duelCols.has(col)) {
        const badge = document.createElement('span');
        badge.className = 'mult-badge';
        badge.textContent = `×${mult}`;
        cell.appendChild(badge);
      }

      column.appendChild(cell);
    }

    gridEl.appendChild(column);
  }
}

function randomSymbol(): SymbolId {
  return REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)];
}

function renderSpinningGrid() {
  gridEl.innerHTML = '';
  for (let col = 0; col < GRID_COLS; col++) {
    const column = document.createElement('div');
    column.className = 'reel-col spinning-col';
    column.dataset.col = String(col);
    for (let row = 0; row < GRID_ROWS; row++) {
      const cell = document.createElement('div');
      cell.className = 'cell spinning';
      renderSymbol(cell, SYMBOLS[randomSymbol()]);
      column.appendChild(cell);
    }
    gridEl.appendChild(column);
  }
}

async function animateReelStop(
  finalGrid: SymbolId[][],
  wins: PaylineWin[],
  duelReels: DuelReel[],
  stickyWilds: StickyWild[],
): Promise<void> {
  const columns = [...gridEl.querySelectorAll<HTMLElement>('.reel-col')];
  for (let col = 0; col < columns.length; col++) {
    await delay(120 + col * 90);
    const column = columns[col];
    column.classList.remove('spinning-col');
    const cells = column.querySelectorAll<HTMLElement>('.cell');
    cells.forEach((cell, row) => {
      cell.classList.remove('spinning');
      cell.innerHTML = '';
      cell.className = 'cell landed';
      renderSymbol(cell, SYMBOLS[finalGrid[row][col]]);
      cell.title = SYMBOLS[finalGrid[row][col]].label;
    });
    applyColumnVisuals(col, wins, duelReels, stickyWilds);
  }
}

function applyColumnVisuals(
  col: number,
  wins: PaylineWin[],
  duelReels: DuelReel[],
  stickyWilds: StickyWild[],
) {
  const winningPositions = new Set<string>();
  for (const win of wins) {
    for (const pos of win.positions) {
      winningPositions.add(`${pos.row},${pos.col}`);
    }
  }
  const duelCol = duelReels.find((d) => d.col === col && d.expanded);
  const column = gridEl.querySelector<HTMLElement>(`.reel-col[data-col="${col}"]`);
  if (!column) return;

  const cells = column.querySelectorAll<HTMLElement>('.cell');
  cells.forEach((cell, row) => {
    const key = `${row},${col}`;
    cell.classList.remove('winning', 'wild-reel', 'sticky-wild');
    cell.querySelector('.mult-badge')?.remove();

    if (stickySet(stickyWilds).has(key)) cell.classList.add('sticky-wild');
    if (winningPositions.has(key)) cell.classList.add('winning');
    if (duelCol) {
      cell.classList.add('wild-reel');
      const badge = document.createElement('span');
      badge.className = 'mult-badge';
      badge.textContent = `×${duelCol.multiplier}`;
      cell.appendChild(badge);
    }
  });
}

function applyResultVisuals(result: SpinResult, stickyWilds: StickyWild[]) {
  for (let col = 0; col < GRID_COLS; col++) {
    applyColumnVisuals(col, result.wins, result.duelReels, stickyWilds);
  }
}

function renderWinDetails(wins: PaylineWin[]) {
  if (wins.length === 0) {
    winDetailsEl.innerHTML = '';
    return;
  }

  winDetailsEl.innerHTML = wins
    .map((win) => {
      const label = SYMBOLS[win.symbol].label;
      const mult = win.multiplier > 1 ? ` ×${win.multiplier}` : '';
      return `<span class="win-chip">Line ${win.paylineIndex + 1}: ${win.count}× ${label}${mult} → ${formatMoney(win.totalPayout * state.bet)}</span>`;
    })
    .join('');
}

function updateUI(options: { refreshGrid?: boolean } = {}) {
  balanceEl.textContent = formatMoney(state.balance);
  lastWinEl.textContent = formatMoney(state.lastSpin?.totalWin ?? 0);
  totalWonEl.textContent = formatMoney(state.totalWon);
  betValueEl.textContent = formatMoney(state.bet);
  phaseBannerEl.textContent = phaseLabel(state.phase);

  const inBonus = state.phase !== 'base';
  const freeLeft = state.freeSpinsRemaining;

  if (inBonus && freeLeft > 0) {
    spinTextEl.textContent = 'FREE SPIN';
    spinSubEl.textContent = `${freeLeft} remaining`;
  } else if (state.phase === 'championship_collect') {
    spinTextEl.textContent = 'COLLECT';
    spinSubEl.textContent = `${state.championship?.spinsRemaining ?? 0} spins left`;
  } else if (state.phase === 'championship_showdown') {
    spinTextEl.textContent = 'SHOWDOWN';
    spinSubEl.textContent = `${state.championship?.showdownSpinsRemaining ?? 0} spins left`;
  } else {
    spinTextEl.textContent = 'SPIN';
    spinSubEl.textContent = autoSpinsLeft > 0 ? `Auto: ${autoSpinsLeft} left` : '';
  }

  spinBtn.disabled = spinning || !canSpin(state);
  betUpBtn.disabled = spinning || inBonus;
  betDownBtn.disabled = spinning || inBonus;
  autoBtn.textContent = autoSpinsLeft > 0 ? 'Stop Auto' : 'Auto ×10';

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

  if (options.refreshGrid && state.lastSpin) {
    const winningPositions = new Set<string>();
    for (const win of state.lastSpin.wins) {
      for (const pos of win.positions) {
        winningPositions.add(`${pos.row},${pos.col}`);
      }
    }
    const duelCols = new Set(state.lastSpin.duelReels.map((d) => d.col));
    const duelMults = new Map(state.lastSpin.duelReels.map((d) => [d.col, d.multiplier]));
    renderGrid(
      state.lastSpin.grid,
      winningPositions,
      duelCols,
      duelMults,
      state.stickyWilds,
    );
  }

  if (state.lastSpin) {
    renderWinDetails(state.lastSpin.wins);
    if (state.lastSpin.totalWin > 0) {
      winLineEl.textContent = `WIN ${formatMoney(state.lastSpin.totalWin)}`;
    }
  }

  saveState();

  if (!spinning && !canSpin(state) && state.phase === 'base') {
    if (!gameOverShown) {
      gameOverModal.showModal();
      gameOverShown = true;
    }
  } else {
    gameOverShown = false;
  }
}

async function playDuelAnimation(multiplier: number): Promise<void> {
  duelMultiplierEl.textContent = `×${multiplier}`;
  duelOverlayEl.classList.remove('hidden');
  await delay(1200);
  duelOverlayEl.classList.add('hidden');
}

async function showBigWin(amount: number): Promise<void> {
  if (amount < state.bet * 10) return;
  bigWinEl.textContent = amount >= state.bet * 50 ? 'MEGA WIN!' : 'BIG WIN!';
  bigWinEl.classList.remove('hidden');
  reelFrameEl.classList.add('shake');
  await delay(1400);
  bigWinEl.classList.add('hidden');
  reelFrameEl.classList.remove('shake');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldAutoContinue(): boolean {
  if (autoSpinsLeft > 0) return true;
  if (state.freeSpinsRemaining > 0) return true;
  if (state.phase === 'championship_collect' || state.phase === 'championship_showdown') return true;
  return false;
}

async function doSpin(): Promise<void> {
  if (spinning || !canSpin(state)) return;
  spinning = true;
  spinBtn.disabled = true;
  winLineEl.textContent = '';
  winDetailsEl.innerHTML = '';
  bonusPanelEl.classList.add('hidden');
  renderSpinningGrid();

  const { state: nextState, result } = spin(state);
  await animateReelStop(result.grid, result.wins, result.duelReels, nextState.stickyWilds);
  state = nextState;

  for (const event of result.events) {
    if (event.type === 'duel') {
      await playDuelAnimation(event.multiplier);
    }
    if (event.type === 'bonus_trigger') {
      bonusPanelEl.classList.remove('hidden');
      bonusTitleEl.textContent = `${bonusDisplayName(event.bonus)} Triggered!`;
      bonusDescEl.textContent = bonusDescription(event.bonus ?? '');
      await delay(1000);
    }
    if (event.type === 'championship_collect' && (event.wilds > 0 || event.multiplier > 0)) {
      bonusPanelEl.classList.remove('hidden');
      bonusTitleEl.textContent = 'Collected!';
      bonusDescEl.textContent = `+${event.wilds} wilds, +×${event.multiplier} multiplier`;
      await delay(700);
      bonusPanelEl.classList.add('hidden');
    }
    if (event.type === 'championship_showdown_start') {
      bonusPanelEl.classList.remove('hidden');
      bonusTitleEl.textContent = 'Showdown Phase!';
      bonusDescEl.textContent = `${event.wilds} wilds and ×${event.multiplier} multiplier ready to fire.`;
      await delay(900);
    }
  }

  updateUI();
  await showBigWin(result.totalWin);
  spinning = false;
  applyResultVisuals(result, state.stickyWilds);

  if (shouldAutoContinue() && canSpin(state)) {
    if (autoSpinsLeft > 0) autoSpinsLeft -= 1;
    await delay(500);
    void doSpin();
  }
}

function changeBet(direction: 1 | -1) {
  const idx = BET_STEPS.indexOf(state.bet);
  const nextIdx = Math.max(0, Math.min(BET_STEPS.length - 1, idx + direction));
  state = setBet(state, BET_STEPS[nextIdx]);
  updateUI();
}

function buildPaytable() {
  const rows = Object.values(SYMBOLS)
    .filter((s) => Object.keys(s.pays).length > 0)
    .sort((a, b) => (b.pays[5] ?? 0) - (a.pays[5] ?? 0))
    .map((symbol) => {
      const pays = [5, 4, 3]
        .filter((n) => symbol.pays[n as 3 | 4 | 5])
        .map((n) => `${n}× = ${symbol.pays[n as 3 | 4 | 5]}× bet`)
        .join(' · ');
      return `<div class="pay-row"><span>${symbol.emoji} ${symbol.label}</span><span>${pays}</span></div>`;
    })
    .join('');

  paytableContent.innerHTML = `
    ${rows}
    <div class="pay-row special"><span>⚔️ VS / Head-to-Head</span><span>Expands reel wild with 2×–100× multiplier when it improves a win</span></div>
    <div class="pay-row special"><span>🔥 Comeback ×3</span><span>10 free spins with sticky wilds</span></div>
    <div class="pay-row special"><span>⚡ Rivalry ×3</span><span>10 free spins with extra VS symbols</span></div>
    <div class="pay-row special"><span>👑 Championship ×3</span><span>Collect wilds & multipliers → 3-spin showdown</span></div>
    <p class="pay-note">${PAYLINES.length} fixed paylines · Left to right · Max win 12,500× bet</p>
  `;
}

function hardReset() {
  autoSpinsLeft = 0;
  gameOverShown = false;
  localStorage.removeItem(STORAGE_KEY);
  state = resetGame(state.bet);
  gameOverModal.close();
  bonusPanelEl.classList.add('hidden');
  winLineEl.textContent = '';
  winDetailsEl.innerHTML = '';
  const initialGrid: SymbolId[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_COLS }, () => (row === 0 ? 'JERSEY' : 'FOOTBALL') as SymbolId),
  );
  renderGrid(initialGrid, new Set(), new Set(), new Map());
  updateUI();
}

spinBtn.addEventListener('click', () => void doSpin());
betUpBtn.addEventListener('click', () => changeBet(1));
betDownBtn.addEventListener('click', () => changeBet(-1));
autoBtn.addEventListener('click', () => {
  if (autoSpinsLeft > 0) {
    autoSpinsLeft = 0;
    updateUI();
    return;
  }
  if (spinning) return;
  autoSpinsLeft = 10;
  void doSpin();
});
resetBtn.addEventListener('click', hardReset);
gameOverReset.addEventListener('click', hardReset);
paytableBtn.addEventListener('click', () => paytableModal.showModal());
closePaytable.addEventListener('click', () => paytableModal.close());

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (!spinning && canSpin(state)) void doSpin();
  }
});

buildPaytable();

const initialGrid: SymbolId[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
  Array.from({ length: GRID_COLS }, () => (row === 0 ? 'JERSEY' : 'FOOTBALL') as SymbolId),
);
if (state.lastSpin) {
  const winningPositions = new Set<string>();
  for (const win of state.lastSpin.wins) {
    for (const pos of win.positions) {
      winningPositions.add(`${pos.row},${pos.col}`);
    }
  }
  const duelCols = new Set(state.lastSpin.duelReels.map((d) => d.col));
  const duelMults = new Map(state.lastSpin.duelReels.map((d) => [d.col, d.multiplier]));
  renderGrid(state.lastSpin.grid, winningPositions, duelCols, duelMults, state.stickyWilds);
} else {
  renderGrid(initialGrid, new Set(), new Set(), new Map());
}
updateUI();
