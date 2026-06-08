import {
  CHAMPIONSHIP_COLLECT_SPINS,
  CHAMPIONSHIP_SHOWDOWN_SPINS,
  FREE_SPINS_AWARDED,
  MAX_CHAMPIONSHIP_MULTIPLIER,
  MAX_CHAMPIONSHIP_WILDS,
} from './constants.js';
import type { BonusType, ChampionshipState, GamePhase, SpinResult } from './types.js';

export function detectBonusTrigger(
  scatterCount: SpinResult['scatterCount'],
  currentPhase: GamePhase,
): BonusType {
  if (currentPhase !== 'base') return null;

  if ((scatterCount.SCATTER_COMEBACK ?? 0) >= 3) return 'comeback';
  if ((scatterCount.SCATTER_RIVALRY ?? 0) >= 3) return 'rivalry';
  if ((scatterCount.SCATTER_CHAMPIONSHIP ?? 0) >= 3) return 'championship';
  return null;
}

export function initChampionshipState(): ChampionshipState {
  return {
    collectedWilds: 0,
    collectedMultiplier: 0,
    spinsRemaining: CHAMPIONSHIP_COLLECT_SPINS,
    phase: 'collect',
    showdownSpinsRemaining: CHAMPIONSHIP_SHOWDOWN_SPINS,
  };
}

export function applyChampionshipCollect(
  state: ChampionshipState,
  wilds: number,
  multiplier: number,
): ChampionshipState {
  const next: ChampionshipState = { ...state };
  if (wilds > 0 || multiplier > 0) {
    next.collectedWilds = Math.min(MAX_CHAMPIONSHIP_WILDS, next.collectedWilds + wilds);
    next.collectedMultiplier = Math.min(MAX_CHAMPIONSHIP_MULTIPLIER, next.collectedMultiplier + multiplier);
    next.spinsRemaining = CHAMPIONSHIP_COLLECT_SPINS;
  } else {
    next.spinsRemaining -= 1;
  }

  if (next.spinsRemaining <= 0) {
    next.phase = 'showdown';
    next.showdownSpinsRemaining = CHAMPIONSHIP_SHOWDOWN_SPINS;
  }

  return next;
}

export function advanceChampionshipShowdown(state: ChampionshipState): ChampionshipState {
  return {
    ...state,
    showdownSpinsRemaining: state.showdownSpinsRemaining - 1,
  };
}

export function isChampionshipComplete(state: ChampionshipState): boolean {
  return state.phase === 'showdown' && state.showdownSpinsRemaining <= 0;
}

export function bonusPhaseFor(type: BonusType): GamePhase {
  switch (type) {
    case 'comeback':
      return 'comeback';
    case 'rivalry':
      return 'rivalry';
    case 'championship':
      return 'championship_collect';
    default:
      return 'base';
  }
}

export function freeSpinsForBonus(type: BonusType): number {
  if (type === 'comeback' || type === 'rivalry') return FREE_SPINS_AWARDED;
  return 0;
}

export function bonusDisplayName(type: BonusType): string {
  switch (type) {
    case 'comeback':
      return 'The Great Comeback';
    case 'rivalry':
      return 'Rivalry Match';
    case 'championship':
      return 'Championship Run';
    default:
      return '';
  }
}
