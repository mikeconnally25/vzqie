import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canWin, getLastWin } from "../src/canWin.js";
import { WIN_COOLDOWN_MS } from "../src/constants.js";
import type { WinRecord } from "../src/types.js";

describe("canWin", () => {
  const now = 1_700_000_000_000;

  it("allows users with no prior wins", () => {
    assert.equal(canWin("viewer1", [], now), true);
  });

  it("uses the most recent win when multiple records exist", () => {
    const wins: WinRecord[] = [
      { username: "viewer1", timestamp: now - WIN_COOLDOWN_MS - 1 },
      { username: "viewer1", timestamp: now - 1_000 },
    ];

    assert.equal(canWin("viewer1", wins, now), false);
  });

  it("allows users after the cooldown expires", () => {
    const wins: WinRecord[] = [
      { username: "viewer1", timestamp: now - WIN_COOLDOWN_MS - 1 },
    ];

    assert.equal(canWin("viewer1", wins, now), true);
  });

  it("blocks users exactly at the cooldown boundary", () => {
    const wins: WinRecord[] = [
      { username: "viewer1", timestamp: now - WIN_COOLDOWN_MS },
    ];

    assert.equal(canWin("viewer1", wins, now), false);
  });

  it("matches usernames case-insensitively", () => {
    const wins: WinRecord[] = [
      { username: "Viewer1", timestamp: now - 1_000 },
    ];

    assert.equal(canWin("viewer1", wins, now), false);
  });
});

describe("getLastWin", () => {
  it("returns undefined when no wins exist for the user", () => {
    assert.equal(getLastWin("viewer1", []), undefined);
  });

  it("returns the latest win by timestamp", () => {
    const wins: WinRecord[] = [
      { username: "viewer1", timestamp: 100 },
      { username: "viewer2", timestamp: 500 },
      { username: "viewer1", timestamp: 300 },
    ];

    assert.deepEqual(getLastWin("viewer1", wins), {
      username: "viewer1",
      timestamp: 300,
    });
  });
});
