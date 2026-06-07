import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapKickMessage, stripKickEmotes } from "../src/kick/mapKickMessage.js";

describe("stripKickEmotes", () => {
  it("removes emote tokens from message content", () => {
    assert.equal(
      stripKickEmotes("hello [emote:37225:KEKLEO] world"),
      "hello  world"
    );
  });
});

describe("mapKickMessage", () => {
  it("maps Kick chat payloads into giveaway messages", () => {
    const mapped = mapKickMessage({
      content: "!enter [emote:1:Wave]",
      created_at: "2024-01-15T12:00:00.000Z",
      sender: {
        username: "Viewer1",
        identity: {
          badges: [{ type: "subscriber" }],
        },
      },
    });

    assert.equal(mapped.username, "Viewer1");
    assert.equal(mapped.message, "!enter");
    assert.equal(mapped.isSubscriber, true);
    assert.equal(mapped.timestamp, Date.parse("2024-01-15T12:00:00.000Z"));
  });
});
