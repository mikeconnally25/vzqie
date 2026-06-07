import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveMessageTimestamp } from "../src/utils.js";

describe("resolveMessageTimestamp", () => {
  const now = 1_700_000_000_000;

  it("uses valid message timestamps", () => {
    assert.equal(resolveMessageTimestamp(now - 5_000, now), now - 5_000);
  });

  it("falls back to now for invalid timestamps", () => {
    assert.equal(resolveMessageTimestamp(-1, now), now);
    assert.equal(resolveMessageTimestamp(now + 1_000, now), now);
    assert.equal(resolveMessageTimestamp(Number.NaN, now), now);
  });
});
