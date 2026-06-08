export type SymbolId =
  | 'WHISTLE'
  | 'CONE'
  | 'BOTTLE'
  | 'JERSEY'
  | 'FOOTBALL'
  | 'BASKETBALL'
  | 'SOCCER'
  | 'BASEBALL'
  | 'TROPHY'
  | 'MVP'
  | 'RING'
  | 'WILD'
  | 'VS'
  | 'SCATTER_COMEBACK'
  | 'SCATTER_RIVALRY'
  | 'SCATTER_CHAMPIONSHIP';

export type BonusType = 'comeback' | 'rivalry' | 'championship' | null;

export type GamePhase = 'base' | 'comeback' | 'rivalry' | 'championship_collect' | 'championship_showdown';

export interface Position {
  row: number;
  col: number;
}

export interface PaylineWin {
  paylineIndex: number;
  symbol: SymbolId;
  count: number;
  positions: Position[];
  basePayout: number;
  multiplier: number;
  totalPayout: number;
}

export interface DuelReel {
  col: number;
  multiplier: number;
  expanded: boolean;
}

export interface StickyWild {
  row: number;
  col: number;
}

export interface ChampionshipState {
  collectedWilds: number;
  collectedMultiplier: number;
  spinsRemaining: number;
  phase: 'collect' | 'showdown';
  showdownSpinsRemaining: number;
}

export interface SpinResult {
  /** Grid before VS duel expansion (shows VS symbols on reels). */
  rawGrid: SymbolId[][];
  grid: SymbolId[][];
  duelReels: DuelReel[];
  wins: PaylineWin[];
  scatterCount: Partial<Record<'SCATTER_COMEBACK' | 'SCATTER_RIVALRY' | 'SCATTER_CHAMPIONSHIP', number>>;
  triggeredBonus: BonusType;
  totalWin: number;
  phase: GamePhase;
  freeSpinsAwarded: number;
  freeSpinsRemaining: number;
  championship?: ChampionshipState;
  stickyWilds: StickyWild[];
  events: SpinEvent[];
}

export type SpinEvent =
  | { type: 'duel'; col: number; multiplier: number }
  | { type: 'bonus_trigger'; bonus: BonusType }
  | { type: 'championship_collect'; wilds: number; multiplier: number }
  | { type: 'championship_showdown_start'; wilds: number; multiplier: number };

export interface GameState {
  balance: number;
  bet: number;
  phase: GamePhase;
  freeSpinsRemaining: number;
  stickyWilds: StickyWild[];
  championship?: ChampionshipState;
  lastSpin?: SpinResult;
  totalWon: number;
  /** Test-only grid override; never persisted by the UI. */
  forcedGrid?: SymbolId[][];
}

export interface SymbolDefinition {
  id: SymbolId;
  label: string;
  emoji: string;
  tier: 'low' | 'mid' | 'high' | 'special';
  pays: Partial<Record<3 | 4 | 5, number>>;
  customRender?: 'lebron-jersey';
}
