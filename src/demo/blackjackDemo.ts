import { BlackjackGiveawayBot } from "../blackjackGiveaway.js";
import type { ChatMessage } from "../types.js";

const scriptedChat: ChatMessage[] = [
  { username: "alice", message: "!enter", timestamp: Date.now() },
  { username: "bob", message: "!enter", timestamp: Date.now() },
  { username: "carol", message: "!enter", timestamp: Date.now() },
  { username: "streamer", message: "!bjstart", timestamp: Date.now() },
  { username: "streamer", message: "!bjdeal", timestamp: Date.now() },
  { username: "alice", message: "!hit", timestamp: Date.now() },
  { username: "bob", message: "!hit", timestamp: Date.now() },
  { username: "carol", message: "!stand", timestamp: Date.now() },
];

function printReplies(source: string, replies: { channel: string; text: string }[]): void {
  for (const reply of replies) {
    console.log(`[${source}/${reply.channel}] ${reply.text}`);
  }
}

const bot = new BlackjackGiveawayBot({
  mods: ["streamer"],
  voteWindowMs: 3_000,
});

for (const message of scriptedChat) {
  printReplies(message.username, bot.handleMessage(message));
}

setTimeout(() => {
  printReplies("timer", bot.tick());
  console.log("\nFinal state:", bot.getState());
}, 3_100);
