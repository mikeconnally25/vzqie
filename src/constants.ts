export const PARTICIPATION_WINDOW_MS = 180_000;
export const WIN_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
export const ALT_SCORE_THRESHOLD = 50;

export const RISK_WEIGHTS = {
  YOUNG_ACCOUNT: 25,
  NEW_FOLLOWER: 20,
  LOW_MESSAGES: 15,
} as const;

export const RISK_THRESHOLDS = {
  HIGH: 45,
  MEDIUM: 25,
} as const;
