import { allowed } from "./blacklist.js";
import { canWin } from "./canWin.js";
import { PARTICIPATION_WINDOW_MS } from "./constants.js";
import { drawWinners } from "./drawWinners.js";
import { calculateRisk } from "./risk.js";
import type {
  AuditLogger,
  ChatMessage,
  Participant,
  RiskLevel,
  UserProfile,
  WinRecord,
} from "./types.js";
import { normalizeUsername, resolveMessageTimestamp } from "./utils.js";

export interface GiveawayEngineOptions {
  auditLogger?: AuditLogger;
  now?: () => number;
}

export type EntryStatus = "entered" | "blocked";

export interface EntryResult {
  status: EntryStatus;
  username: string;
  riskLevel?: RiskLevel;
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
  private readonly auditLogger?: AuditLogger;
  private readonly now: () => number;

  constructor(options: GiveawayEngineOptions = {}) {
    this.auditLogger = options.auditLogger;
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
    const userProfile = profileFromMessage(message, profile);
    const risk = calculateRisk(userProfile);
    const timestamp = resolveMessageTimestamp(message.timestamp, this.now());

    const participant: Participant = {
      username: message.username,
      normalizedUsername: normalized,
      timestamp,
      riskScore: risk.score,
      riskLevel: risk.level,
      isSubscriber: message.isSubscriber,
      isFollower: message.isFollower,
    };

    this.participants.set(normalized, participant);

    void this.auditLogger?.log({
      action: "ENTRY",
      username: message.username,
      metadata: { riskScore: risk.score, riskLevel: risk.level },
    });

    return { status: "entered", username: message.username, riskLevel: risk.level };
  }

  getEligibleParticipants(referenceTime = this.now()): Participant[] {
    const cutoff = referenceTime - PARTICIPATION_WINDOW_MS;

    return [...this.participants.values()].filter(
      (participant) => participant.timestamp > cutoff
    );
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
}
