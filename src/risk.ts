import {
  ALT_SCORE_THRESHOLD,
  RISK_THRESHOLDS,
  RISK_WEIGHTS,
} from "./constants.js";
import type { RiskResult, UserProfile } from "./types.js";

export function calculateRisk(user: UserProfile): RiskResult {
  let score = 0;

  if (user.accountAgeDays !== undefined && user.accountAgeDays < 30) {
    score += RISK_WEIGHTS.YOUNG_ACCOUNT;
  }

  if (user.followAgeDays !== undefined && user.followAgeDays < 7) {
    score += RISK_WEIGHTS.NEW_FOLLOWER;
  }

  if (user.messageCount !== undefined && user.messageCount < 3) {
    score += RISK_WEIGHTS.LOW_MESSAGES;
  }

  if (score >= RISK_THRESHOLDS.HIGH) {
    return { score, level: "HIGH" };
  }

  if (score >= RISK_THRESHOLDS.MEDIUM) {
    return { score, level: "MEDIUM" };
  }

  return { score, level: "LOW" };
}

export class AltDetector {
  evaluate(user: UserProfile): number {
    let score = 0;

    if (user.accountAgeDays !== undefined && user.accountAgeDays < 7) {
      score += 40;
    }

    if (user.messageCount !== undefined && user.messageCount < 5) {
      score += 20;
    }

    if (user.followAgeDays !== undefined && user.followAgeDays < 1) {
      score += 30;
    }

    return score;
  }

  requiresReview(user: UserProfile): boolean {
    return this.evaluate(user) >= ALT_SCORE_THRESHOLD;
  }
}
