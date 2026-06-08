import {
  DEFAULT_BALANCE,
  MAX_WIN_MULTIPLIER,
  MIN_BET,
} from './constants.js';
import {
  advanceChampionshipShowdown,
  applyChampionshipCollect,
  bonusPhaseFor,
  detectBonusTrigger,
  freeSpinsForBonus,
  initChampionshipState,
  isChampionshipComplete,
} from './bonus.js';
import { evaluatePaylines, resolveDuelReels } from './duelReels.js';
import {
  applyStickyWilds,
  collectChampionshipSymbols,
  countScatters,
  findNewWildPositions,
  placeChampionshipWilds,
  spinGrid,
} from './grid.js';
import type { Rng } from './rng.js';
import { defaultRng } from './rng.js';
import type { BonusType, GamePhase, GameState, SpinEvent, SpinResult } from './types.js';

export function createGameState(balance = DEFAULT_BALANCE, bet = MIN_BET): GameState {
  return {
    balance,
    bet,
    phase: 'base',
    freeSpinsRemaining: 0,
    stickyWilds: [],
    totalWon: 0,
  };
}

export function canSpin(state: GameState): boolean {
  if (state.freeSpinsRemaining > 0) return true;
  if (state.phase === 'championship_collect' || state.phase === 'championship_showdown') return true;
  return state.balance >= state.bet;
}

export function spin(state: GameState, rng: Rng = defaultRng): { state: GameState; result: SpinResult } {
  if (!canSpin(state)) {
    throw new Error('Insufficient balance to spin');
  }

  const isFreeSpin = state.freeSpinsRemaining > 0
    || state.phase === 'championship_collect'
    || state.phase === 'championship_showdown';

  const bet = state.bet;
  let balance = isFreeSpin ? state.balance : state.balance - bet;
  let phase: GamePhase = state.phase;
  let freeSpinsRemaining = state.freeSpinsRemaining;
  let stickyWilds = [...state.stickyWilds];
  let championship = state.championship ? { ...state.championship } : undefined;
  const events: SpinEvent[] = [];

  let rawGrid = spinGrid(phase === 'championship_showdown' ? 'base' : phase, rng);

  if (phase === 'comeback') {
    rawGrid = applyStickyWilds(rawGrid, stickyWilds);
  }

  if (phase === 'championship_showdown' && championship) {
    rawGrid = placeChampionshipWilds(rawGrid, championship.collectedWilds, rng);
  }

  const { grid: duelGrid, duelReels } = resolveDuelReels(rawGrid, rng);
  for (const duel of duelReels) {
    events.push({ type: 'duel', col: duel.col, multiplier: duel.multiplier });
  }

  let winEvaluation = evaluatePaylines(duelGrid, duelReels);
  let totalWin = winEvaluation.totalPayout * bet;

  if (phase === 'championship_showdown' && championship && championship.collectedMultiplier > 0) {
    totalWin *= championship.collectedMultiplier;
  }

  totalWin = Math.min(totalWin, bet * MAX_WIN_MULTIPLIER);
  balance += totalWin;

  const scatterCount = countScatters(rawGrid);
  let triggeredBonus: BonusType = null;

  if (phase === 'base') {
    triggeredBonus = detectBonusTrigger(scatterCount, phase);
    if (triggeredBonus) {
      events.push({ type: 'bonus_trigger', bonus: triggeredBonus });
      phase = bonusPhaseFor(triggeredBonus);
      freeSpinsRemaining = freeSpinsForBonus(triggeredBonus);
      stickyWilds = [];
      if (triggeredBonus === 'championship') {
        championship = initChampionshipState();
      }
    }
  }

  if (phase === 'comeback') {
    const newWilds = findNewWildPositions(duelGrid, stickyWilds);
    stickyWilds = [...stickyWilds, ...newWilds];
    freeSpinsRemaining = Math.max(0, freeSpinsRemaining - 1);
    if (freeSpinsRemaining === 0) {
      phase = 'base';
      stickyWilds = [];
    }
  }

  if (phase === 'rivalry') {
    freeSpinsRemaining = Math.max(0, freeSpinsRemaining - 1);
    if (freeSpinsRemaining === 0) {
      phase = 'base';
    }
  }

  if (phase === 'championship_collect' && championship) {
    const collected = collectChampionshipSymbols(rawGrid, rng);
    if (collected.wilds > 0 || collected.multiplier > 0) {
      events.push({
        type: 'championship_collect',
        wilds: collected.wilds,
        multiplier: collected.multiplier,
      });
    }
    championship = applyChampionshipCollect(championship, collected.wilds, collected.multiplier);
    if (championship.phase === 'showdown') {
      phase = 'championship_showdown';
      events.push({
        type: 'championship_showdown_start',
        wilds: championship.collectedWilds,
        multiplier: championship.collectedMultiplier,
      });
    }
  }

  if (phase === 'championship_showdown' && championship) {
    championship = advanceChampionshipShowdown(championship);
    if (isChampionshipComplete(championship)) {
      phase = 'base';
      championship = undefined;
    }
  }

  if (freeSpinsRemaining > 0 && phase !== 'championship_collect' && phase !== 'championship_showdown') {
    // free spin counter already decremented above for comeback/rivalry
  }

  const result: SpinResult = {
    grid: duelGrid,
    duelReels,
    wins: winEvaluation.wins,
    scatterCount,
    triggeredBonus,
    totalWin,
    phase,
    freeSpinsAwarded: triggeredBonus ? freeSpinsForBonus(triggeredBonus) : 0,
    freeSpinsRemaining,
    championship,
    stickyWilds: [...stickyWilds],
    events,
  };

  const nextState: GameState = {
    balance,
    bet,
    phase,
    freeSpinsRemaining,
    stickyWilds,
    championship,
    lastSpin: result,
    totalWon: state.totalWon + totalWin,
  };

  return { state: nextState, result };
}

export function setBet(state: GameState, bet: number): GameState {
  return { ...state, bet };
}
