export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ChatMessage {
  username: string;
  message: string;
  timestamp: number;
  isSubscriber?: boolean;
  isFollower?: boolean;
  accountAgeDays?: number;
}

export interface ChatProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onMessage(callback: (message: ChatMessage) => void): () => void;
}

export interface UserProfile {
  username: string;
  accountAgeDays?: number;
  followAgeDays?: number;
  messageCount?: number;
}

export interface Participant {
  username: string;
  normalizedUsername: string;
  timestamp: number;
  riskScore: number;
  riskLevel: RiskLevel;
  approved: boolean;
  isSubscriber?: boolean;
  isFollower?: boolean;
}

export interface WinRecord {
  username: string;
  timestamp: number;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
}

export interface ApprovalQueueEntry {
  username: string;
  riskScore: number;
  riskLevel: RiskLevel;
  approved: boolean;
  participant?: Participant;
}

export type AuditAction =
  | "ENTRY_APPROVED"
  | "ENTRY_REJECTED"
  | "ENTRY_PENDING"
  | "WINNER_DRAWN";

export interface AuditLogEntry {
  action: AuditAction;
  username: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogger {
  log(entry: AuditLogEntry): Promise<void>;
}

export interface RiskUpdatePayload {
  username: string;
  riskLevel: RiskLevel;
  riskScore: number;
}
