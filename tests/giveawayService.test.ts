import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import { GiveawayService } from "../src/app/giveawayService.js";
import { ViewerStore } from "../src/auth/viewerStore.js";

describe("GiveawayService viewer gating", () => {
  let tempDir = "";
  let service: GiveawayService;

  before(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "giveaway-service-"));
    const viewerStore = new ViewerStore(tempDir);
    await viewerStore.createViewer(
      {
        kickUsername: "registered_viewer",
        kickChatroomId: 123456,
      },
      "hash"
    );

    service = new GiveawayService(
      {
        channel: "testchannel",
        chatroomId: 999,
        entryKeyword: "!enter",
        keywordEnabled: true,
      },
      viewerStore
    );
    await service.loadRegisteredViewers();
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("blocks chat entries from viewers who have not signed up", () => {
    service["handleChatMessage"]({
      username: "random_user",
      message: "!enter",
      timestamp: Date.now(),
    });

    const state = service.getState();
    assert.equal(state.eligible.length, 0);
    assert.equal(state.recentEntries[0]?.status, "blocked");
    assert.match(state.recentEntries[0]?.blockedReason ?? "", /Sign up/);
  });

  it("accepts chat entries from registered viewers", () => {
    service["handleChatMessage"]({
      username: "Registered_Viewer",
      message: "!enter",
      timestamp: Date.now(),
    });

    const state = service.getState();
    assert.equal(state.eligible.length, 1);
    assert.equal(state.recentEntries[0]?.status, "entered");
  });
});
