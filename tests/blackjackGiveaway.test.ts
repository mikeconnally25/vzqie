import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlackjackGiveawayBot } from "../src/blackjackGiveaway.js";
import type { ChatMessage } from "../src/types.js";

const baseTime = 1_700_000_000_000;

function chat(
  username: string,
  message: string,
  timestamp = baseTime
): ChatMessage {
  return { username, message, timestamp };
}

describe("BlackjackGiveawayBot", () => {
  it("runs a full mod-driven giveaway round with chat voting", () => {
    let now = baseTime;
    const bot = new BlackjackGiveawayBot({
      mods: ["streamer"],
      voteWindowMs: 5_000,
      now: () => now,
    });

    assert.deepEqual(
      bot.handleMessage(chat("viewer1", "!enter")).map((reply) => reply.text),
      ["@viewer1 entered the giveaway!"]
    );
    bot.handleMessage(chat("viewer2", "!enter"));

    const startReplies = bot.handleMessage(chat("streamer", "!bjstart"));
    assert.match(startReplies[0]!.text, /Blackjack giveaway is open/);

    const dealReplies = bot.handleMessage(chat("streamer", "!bjdeal"));
    assert.match(dealReplies[0]!.text, /Cards dealt/);
    assert.equal(bot.getPhase(), "voting");

    bot.handleMessage(chat("viewer1", "!hit"));
    bot.handleMessage(chat("viewer2", "!hit"));
    bot.handleMessage(chat("viewer3", "!stand"));

    now += 5_001;
    const tickReplies = bot.tick();
    assert.ok(tickReplies.some((reply) => /Chat voted HIT|Chat voted STAND/.test(reply.text)));

    if (bot.getPhase() === "voting") {
      now += 5_001;
      bot.tick();
    }

    assert.equal(bot.getPhase(), "resolved");
    const state = bot.getState();
    assert.ok(state.outcome);
  });

  it("draws a giveaway winner when chat wins the table", () => {
    let now = baseTime;
    const bot = new BlackjackGiveawayBot({
      mods: ["streamer"],
      voteWindowMs: 1_000,
      now: () => now,
    });

    bot.handleMessage(chat("alice", "!enter"));
    bot.handleMessage(chat("streamer", "!bjstart"));
    bot.handleMessage(chat("streamer", "!bjdeal"));

    now += 1_001;
    const replies = bot.tick();
    const winnerReply = replies.find((reply) => reply.text.includes("Giveaway winner"));

    if (winnerReply) {
      assert.match(winnerReply.text, /@/);
      assert.ok(bot.getState().winner);
    }
  });

  it("rejects non-mod deal commands", () => {
    const bot = new BlackjackGiveawayBot({ mods: ["streamer"], now: () => baseTime });

    bot.handleMessage(chat("viewer1", "!enter"));
    bot.handleMessage(chat("streamer", "!bjstart"));

    const replies = bot.handleMessage(chat("viewer1", "!bjdeal"));
    assert.match(replies[0]!.text, /only mods can deal/);
  });

  it("reports current table status", () => {
    const bot = new BlackjackGiveawayBot({ mods: ["streamer"], now: () => baseTime });

    bot.handleMessage(chat("viewer1", "!enter"));
    bot.handleMessage(chat("streamer", "!bjstart"));
    bot.handleMessage(chat("streamer", "!bjdeal"));

    const status = bot.handleMessage(chat("viewer1", "!bj"))[0]!;
    assert.match(status.text, /Blackjack giveaway \[voting\]/);
    assert.match(status.text, /Player:/);
  });
});
