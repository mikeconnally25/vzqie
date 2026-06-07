import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { InMemoryAuditLogger } from "./src/audit.js";
import { KickChatProvider } from "./src/kick/KickChatProvider.js";
import { GiveawayEngine } from "./src/giveawayEngine.js";
import type { WinRecord } from "./src/types.js";

const RISK_ICON = { LOW: "🟢", MEDIUM: "🟡", HIGH: "🔴" } as const;

const channel = process.env.KICK_CHANNEL?.trim();
const entryKeyword = (process.env.GIVEAWAY_KEYWORD ?? "!enter").toLowerCase();

if (!channel) {
  console.error("Missing KICK_CHANNEL environment variable.");
  console.error("Example: KICK_CHANNEL=yourname npm run bot");
  process.exit(1);
}

const previousWins: WinRecord[] = [];
const auditLogger = new InMemoryAuditLogger();

const engine = new GiveawayEngine({
  auditLogger,
  onRiskUpdate: (pending) => {
    if (pending.length === 0) {
      return;
    }

    console.log("\n⚠️  Approval needed:");
    for (const user of pending) {
      console.log(
        `   ${user.username.padEnd(14)} ${user.riskLevel.padEnd(6)} ${RISK_ICON[user.riskLevel]}`
      );
    }
    console.log("   Commands: approve <user> | reject <user>\n");
  },
});

const chat = new KickChatProvider({
  channel,
  debug: process.env.KICK_DEBUG === "1",
});

function logEntry(username: string, text: string, status: string): void {
  console.log(`<${username}> ${text}`);
  console.log(`   └─ ${status}\n`);
}

chat.onMessage((message) => {
  if (!message.message.toLowerCase().includes(entryKeyword)) {
    return;
  }

  const result = engine.addMessage(message);
  if (!result) {
    return;
  }

  const risk = result.riskLevel
    ? `${RISK_ICON[result.riskLevel]} ${result.riskLevel}`
    : "";

  switch (result.status) {
    case "blocked":
      logEntry(message.username, message.message, "🚫 BLOCKED (bot)");
      break;
    case "pending_approval":
      logEntry(message.username, message.message, `⏸  PENDING ${risk}`);
      break;
    case "rejected":
      logEntry(message.username, message.message, "❌ REJECTED");
      break;
    case "entered":
      logEntry(message.username, message.message, `✅ ENTERED ${risk}`);
      break;
  }
});

async function handleCommand(line: string): Promise<void> {
  const [command, ...args] = line.trim().split(/\s+/);
  const target = args.join(" ");

  switch (command?.toLowerCase()) {
    case "approve":
      if (!target) {
        console.log("Usage: approve <username>");
        return;
      }
      console.log(
        engine.approve(target)
          ? `✅ Approved ${target}`
          : `⚠️  ${target} is not in the approval queue`
      );
      break;

    case "reject":
      if (!target) {
        console.log("Usage: reject <username>");
        return;
      }
      console.log(
        engine.reject(target)
          ? `❌ Rejected ${target}`
          : `⚠️  ${target} is not in the approval queue`
      );
      break;

    case "queue": {
      const queue = engine.getApprovalQueue();
      if (queue.length === 0) {
        console.log("Approval queue is empty.");
        return;
      }
      for (const entry of queue) {
        console.log(
          `${entry.username.padEnd(14)} ${entry.riskLevel.padEnd(6)} ${RISK_ICON[entry.riskLevel]} ${entry.approved ? "(approved)" : "(pending)"}`
        );
      }
      break;
    }

    case "eligible": {
      const eligible = engine.getEligibleParticipants();
      console.log(`Eligible (${eligible.length}):`);
      for (const participant of eligible) {
        console.log(
          `  ${participant.username} ${RISK_ICON[participant.riskLevel]} ${participant.riskLevel}`
        );
      }
      break;
    }

    case "draw": {
      const count = Number(target) || 1;
      const winners = engine.draw(count, previousWins);
      if (winners.length === 0) {
        console.log("No winners drawn — pool may be empty or on cooldown.");
        return;
      }
      for (const winner of winners) {
        console.log(`🏆 Winner: ${winner.username}`);
        previousWins.push({
          username: winner.username,
          timestamp: Date.now(),
        });
      }
      break;
    }

    case "help":
      console.log(`Commands:
  approve <user>   Approve a pending high-risk entry
  reject <user>    Reject a pending entry
  queue            Show approval queue
  eligible         Show current draw pool
  draw [n]         Draw winner(s), default 1
  quit             Disconnect and exit`);
      break;

    case "quit":
    case "exit":
      await chat.disconnect();
      process.exit(0);

    default:
      if (command) {
        console.log(`Unknown command: ${command} (type 'help')`);
      }
  }
}

async function main(): Promise<void> {
  console.log(`Connecting to Kick chat: ${channel}`);
  console.log(`Entry keyword: ${entryKeyword}`);
  console.log("Type 'help' for streamer commands.\n");

  await chat.connect();
  console.log(`✅ Connected to #${chat.getChannelName()}\n`);

  const rl = readline.createInterface({ input, output });

  process.on("SIGINT", async () => {
    await chat.disconnect();
    rl.close();
    process.exit(0);
  });

  while (true) {
    const line = await rl.question("giveaway> ");
    await handleCommand(line);
  }
}

main().catch((error: unknown) => {
  console.error("Bot failed:", error);
  process.exit(1);
});
