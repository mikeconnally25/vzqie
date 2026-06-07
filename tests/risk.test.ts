import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AltDetector, calculateRisk } from "../src/risk.js";

describe("calculateRisk", () => {
  it("returns LOW for established users", () => {
    const result = calculateRisk({
      username: "viewer1",
      accountAgeDays: 90,
      followAgeDays: 30,
      messageCount: 20,
    });

    assert.deepEqual(result, { score: 0, level: "LOW" });
  });

  it("returns MEDIUM for partially risky profiles", () => {
    const result = calculateRisk({
      username: "viewer2",
      accountAgeDays: 10,
      followAgeDays: 30,
      messageCount: 20,
    });

    assert.equal(result.level, "MEDIUM");
    assert.equal(result.score, 25);
  });

  it("returns HIGH when multiple risk factors are present", () => {
    const result = calculateRisk({
      username: "viewer3",
      accountAgeDays: 1,
      followAgeDays: 0,
      messageCount: 0,
    });

    assert.equal(result.level, "HIGH");
    assert.equal(result.score, 60);
  });

  it("ignores undefined profile fields instead of comparing them unpredictably", () => {
    const result = calculateRisk({ username: "viewer4" });

    assert.equal(result.level, "LOW");
    assert.equal(result.score, 0);
  });
});

describe("AltDetector", () => {
  const detector = new AltDetector();

  it("flags suspicious accounts for manual review", () => {
    assert.equal(
      detector.requiresReview({
        username: "alt1",
        accountAgeDays: 1,
        followAgeDays: 0,
        messageCount: 0,
      }),
      true
    );
  });

  it("does not require review for normal accounts", () => {
    assert.equal(
      detector.requiresReview({
        username: "regular",
        accountAgeDays: 100,
        followAgeDays: 30,
        messageCount: 50,
      }),
      false
    );
  });
});
