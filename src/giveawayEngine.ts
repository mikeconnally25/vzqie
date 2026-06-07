import { allowed } from "./blacklist.js";
import { canWin } from "./canWin.js";
import { PARTICIPATION_WINDOW_MS } from "./constants.js";
import { drawWinners } from "./drawWinners.js";
import { AltDetector, calculateRisk } from "./risk.js";
import type {
  ApprovalQueueEntry,
  AuditLogger,
  ChatMessage,
  Participant,
  RiskUpdatePayload,
  UserProfile,
  WinRecord,
} from "./types.js";
import { normalizeUsername, resolveMessageTimestamp } from "./utils.js";

export interface GiveawayEngineOptions {
  auditLogger?: AuditLogger;
  onRiskUpdate?: (updates: RiskUpdatePayload[]) => void;
  altDetector?: AltDetector;
  now?: () => number;
}

export type EntryStatus = "entered" | "pending_approval" | "rejected" | "blocked";

export interface EntryResult {
  status: EntryStatus;
  username: string;
  riskLevel?: ApprovalQueueEntry["riskLevel"];
}

function profileFromMessage(
  message: ChatMessage,
  profile?: Partial<UserProfile>
): UserProfile {
  return {
    username: message.username,
    accountAgeDays: profile?.accountAgeDays ?? message.accountAgeDays,
    followAgeDays: profile?.followAgeDays,
    messageCount: profile?.messageCount,
  };
}

export class GiveawayEngine {
  private readonly participants = new Map<string, Participant>();
  private readonly approvalQueue = new Map<string, ApprovalQueueEntry>();
  private readonly rejected = new Set<string>();
  private readonly auditLogger?: AuditLogger;
  private readonly onRiskUpdate?: (updates: RiskUpdatePayload[]) => void;
  private readonly altDetector: AltDetector;
  private readonly now: () => number;

  constructor(options: GiveawayEngineOptions = {}) {
    this.auditLogger = options.auditLogger;
    this.onRiskUpdate = options.onRiskUpdate;
    this.altDetector = options.altDetector ?? new AltDetector();
    this.now = options.now ?? Date.now;
  }

  addMessage(
    message: ChatMessage,
    profile?: Partial<UserProfile>
  ): EntryResult | null {
    if (!allowed(message.username)) {
      return { status: "blocked", username: message.username };
    }

    const normalized = normalizeUsername(message.username);

    if (this.rejected.has(normalized)) {
      return { status: "rejected", username: message.username };
    }

    const userProfile = profileFromMessage(message, profile);
    const risk = calculateRisk(userProfile);
    const timestamp = resolveMessageTimestamp(message.timestamp, this.now());

    const participant: Participant = {
      username: message.username,
      normalizedUsername: normalized,
      timestamp,
      riskScore: risk.score,
      riskLevel: risk.level,
      approved: true,
      isSubscriber: message.isSubscriber,
      isFollower: message.isFollower,
    };

    this.participants.set(normalized, participant);

    void this.auditLogger?.log({
      action: "ENTRY_APPROVED",
      username: message.username,
      metadata: { riskScore: risk.score, riskLevel: risk.level },
    });

    return { status: "entered", username: message.username, riskLevel: risk.level };
  }

  approve(username: string): boolean {
    const normalized = normalizeUsername(username);
    const entry = this.approvalQueue.get(normalized);

    if (!entry) {
      return false;
    }

    entry.approved = true;
    this.rejected.delete(normalized);

    if (entry.participant) {
      entry.participant.approved = true;
      this.participants.set(normalized, entry.participant);
    } else {
      const participant = this.participants.get(normalized);
      if (participant) {
        participant.approved = true;
      }
    }

    void this.auditLogger?.log({
      action: "ENTRY_APPROVED",
      username: entry.username,
      metadata: { riskScore: entry.riskScore, riskLevel: entry.riskLevel },
    });

    this.emitRiskUpdates();
    return true;
  }

  reject(username: string): boolean {
    const normalized = normalizeUsername(username);
    const entry = this.approvalQueue.get(normalized);

    if (!entry) {
      return false;
    }

    entry.approved = false;
    this.rejected.add(normalized);
    this.participants.delete(normalized);

    void this.auditLogger?.log({
      action: "ENTRY_REJECTED",
      username: entry.username,
      metadata: { riskScore: entry.riskScore, riskLevel: entry.riskLevel },
    });

    this.emitRiskUpdates();
    return true;
  }

  getApprovalQueue(): ApprovalQueueEntry[] {
    return [...this.approvalQueue.values()];
  }

  getEligibleParticipants(referenceTime = this.now()): Participant[] {
    const cutoff = referenceTime - PARTICIPATION_WINDOW_MS;

    return [...this.participants.values()].filter((participant) => {
      if (participant.timestamp <= cutoff) {
        return false;
      }

      if (participant.riskLevel === "HIGH" && !participant.approved) {
        return false;
      }

      return true;
    });
  }

  draw(
    count: number,
    previousWins: WinRecord[] = [],
    referenceTime = this.now()
  ): Participant[] {
    const eligible = this.getEligibleParticipants(referenceTime).filter(
      (participant) => canWin(participant.username, previousWins, referenceTime)
    );

    const winners = drawWinners(eligible, count);

    for (const winner of winners) {
      void this.auditLogger?.log({
        action: "WINNER_DRAWN",
        username: winner.username,
        metadata: { riskLevel: winner.riskLevel, riskScore: winner.riskScore },
      });
    }

    return winners;
  }

  private emitRiskUpdates(): void {
    if (!this.onRiskUpdate) {
      return;
    }

    const updates: RiskUpdatePayload[] = this.getApprovalQueue()
      .filter((entry) => !entry.approved)
      .map((entry) => ({
        username: entry.username,
        riskLevel: entry.riskLevel,
        riskScore: entry.riskScore,
      }));

    this.onRiskUpdate(updates);
  }
}
