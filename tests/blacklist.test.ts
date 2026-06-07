import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowed } from "../src/blacklist.js";

describe("allowed", () => {
  it("blocks known bots regardless of casing", () => {
    assert.equal(allowed("Nightbot"), false);
    assert.equal(allowed("streamelements"), false);
    assert.equal(allowed("Fossabot"), false);
  });

  it("allows regular viewers", () => {
    assert.equal(allowed("viewer123"), true);
  });
});
