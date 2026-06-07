import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PARTICIPATION_WINDOW_MS, WIN_COOLDOWN_MS } from "../src/constants.js";
import { GiveawayEngine } from "../src/giveawayEngine.js";
import { InMemoryAuditLogger } from "../src/audit.js";
import type { ChatMessage } from "../src/types.js";

const baseTime = 1_700_000_000_000;

function message(
  username: string,
  timestamp = baseTime,
  overrides: Partial<ChatMessage> = {}
): ChatMessage {
  return {
    username,
    message: "!enter",
    timestamp,
    ...overrides,
  };
}

describe("GiveawayEngine", () => {
  it("blocks bots from entering", () => {
    const engine = new GiveawayEngine({ now: () => baseTime });
    const result = engine.addMessage(message("Nightbot"));

    assert.deepEqual(result, { status: "blocked", username: "Nightbot" });
    assert.equal(engine.getEligibleParticipants().length, 0);
  });

  it("uses the chat message timestamp for eligibility", () => {
    const now = baseTime;
    const engine = new GiveawayEngine({ now: () => now });

    engine.addMessage(message("viewer1", now - PARTICIPATION_WINDOW_MS + 1_000));

    assert.equal(engine.getEligibleParticipants(now).length, 1);

    assert.equal(
      engine.getEligibleParticipants(now + PARTICIPATION_WINDOW_MS + 1).length,
      0
    );
  });

  it("auto-enters high-risk users into the draw pool", () => {
    const engine = new GiveawayEngine({ now: () => baseTime });
    const result = engine.addMessage(message("risky"), {
      accountAgeDays: 1,
      followAgeDays: 0,
      messageCount: 0,
    });

    assert.equal(result?.status, "entered");
    assert.equal(engine.getEligibleParticipants().length, 1);
  });

  it("excludes recent winners from draws", () => {
    const auditLogger = new InMemoryAuditLogger();
    const engine = new GiveawayEngine({
      now: () => baseTime,
      auditLogger,
    });

    engine.addMessage(message("viewer1"));
    engine.addMessage(message("viewer2"));

    const winners = engine.draw(1, [
      { username: "viewer1", timestamp: baseTime - WIN_COOLDOWN_MS + 1 },
    ]);

    assert.deepEqual(winners.map((winner) => winner.username), ["viewer2"]);
    assert.ok(auditLogger.entries.some((entry) => entry.action === "WINNER_DRAWN"));
  });

});
