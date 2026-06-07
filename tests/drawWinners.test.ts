import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeParticipants, drawWinners } from "../src/drawWinners.js";
import type { Participant } from "../src/types.js";

function participant(
  username: string,
  timestamp: number,
  overrides: Partial<Participant> = {}
): Participant {
  return {
    username,
    normalizedUsername: username.toLowerCase(),
    timestamp,
    riskScore: 0,
    riskLevel: "LOW",
    ...overrides,
  };
}

describe("dedupeParticipants", () => {
  it("keeps the most recent entry per username", () => {
    const deduped = dedupeParticipants([
      participant("Viewer1", 100),
      participant("viewer1", 200),
      participant("viewer2", 150),
    ]);

    assert.equal(deduped.length, 2);
    assert.equal(
      deduped.find((entry) => entry.username === "viewer1")?.timestamp,
      200
    );
  });
});

describe("drawWinners", () => {
  it("returns an empty list when count is zero", () => {
    const winners = drawWinners([participant("viewer1", 1)], 0, {
      random: () => 0,
    });

    assert.deepEqual(winners, []);
  });

  it("never returns more winners than unique participants", () => {
    const pool = [
      participant("viewer1", 1),
      participant("viewer2", 2),
      participant("viewer1", 3),
    ];

    const winners = drawWinners(pool, 5, {
      random: () => 0,
    });

    assert.equal(winners.length, 2);
  });

  it("uses the injected random source for deterministic draws", () => {
    const pool = [
      participant("viewer1", 1),
      participant("viewer2", 2),
      participant("viewer3", 3),
    ];

    const winners = drawWinners(pool, 1, {
      random: () => 0.99,
    });

    assert.deepEqual(winners.map((winner) => winner.username), ["viewer3"]);
  });
});
