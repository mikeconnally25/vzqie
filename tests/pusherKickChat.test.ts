import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseKickChatFrame } from "../src/kick/pusherKickChat.js";

describe("parseKickChatFrame", () => {
  it("parses Kick chat message events from Pusher frames", () => {
    const payload = {
      content: "!enter",
      created_at: "2024-01-15T12:00:00.000Z",
      sender: { username: "viewer1" },
    };

    const frame = JSON.stringify({
      event: "App\\Events\\ChatMessageEvent",
      data: JSON.stringify(payload),
    });

    assert.deepEqual(parseKickChatFrame(frame), payload);
  });

  it("ignores Pusher system frames", () => {
    const frame = JSON.stringify({
      event: "pusher:connection_established",
      data: "{}",
    });

    assert.equal(parseKickChatFrame(frame), null);
  });
});
