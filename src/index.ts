export { AUDIT_LOG_SCHEMA, InMemoryAuditLogger } from "./audit.js";
export { allowed } from "./blacklist.js";
export { canWin, getLastWin } from "./canWin.js";
export {
  ALT_SCORE_THRESHOLD,
  PARTICIPATION_WINDOW_MS,
  RISK_THRESHOLDS,
  RISK_WEIGHTS,
  WIN_COOLDOWN_MS,
} from "./constants.js";
export { dedupeParticipants, drawWinners } from "./drawWinners.js";
export type { DrawWinnersOptions } from "./drawWinners.js";
export {
  BlackjackGame,
  cardValue,
  compareHands,
  createDeck,
  formatCard,
  formatHand,
  handValue,
  isBlackjack,
  isBusted,
} from "./blackjack.js";
export type { Card, HandOutcome, Rank, Suit } from "./blackjack.js";
export { BlackjackGiveawayBot } from "./blackjackGiveaway.js";
export type {
  BlackjackGiveawayOptions,
  BlackjackPhase,
  BlackjackRoundState,
  BotReply,
  VoteChoice,
  VoteSnapshot,
} from "./blackjackGiveaway.js";
export { GiveawayEngine } from "./giveawayEngine.js";
export type {
  EntryResult,
  EntryStatus,
  GiveawayEngineOptions,
} from "./giveawayEngine.js";
export { AltDetector, calculateRisk } from "./risk.js";
export type {
  ApprovalQueueEntry,
  AuditAction,
  AuditLogEntry,
  AuditLogger,
  ChatMessage,
  ChatProvider,
  Participant,
  RiskLevel,
  RiskResult,
  RiskUpdatePayload,
  UserProfile,
  WinRecord,
} from "./types.js";
export {
  normalizeUsername,
  resolveMessageTimestamp,
  safeCount,
} from "./utils.js";
