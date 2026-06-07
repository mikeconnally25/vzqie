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
export { KickChatProvider } from "./kick/KickChatProvider.js";
export type { KickChatProviderOptions } from "./kick/KickChatProvider.js";
export { mapKickMessage, stripKickEmotes } from "./kick/mapKickMessage.js";
export type { KickChatMessageEvent } from "./kick/mapKickMessage.js";
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
