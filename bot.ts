import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { GiveawayService, loadGiveawayConfig } from "./src/app/giveawayService.js";

const RISK_ICON = { LOW: "🟢", MEDIUM: "🟡", HIGH: "🔴" } as const;

const service = new GiveawayService(loadGiveawayConfig());

async function handleCommand(line: string): Promise<void> {
  const [command, ...args] = line.trim().split(/\s+/);
  const target = args.join(" ");

  switch (command?.toLowerCase()) {
    case "eligible": {
      const eligible = service.getState().eligible;
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
      const winners = service.draw(count);
      if (winners.length === 0) {
        console.log("No winners drawn — pool may be empty or on cooldown.");
        return;
      }
      for (const winner of winners) {
        console.log(`🏆 Winner: ${winner.username}`);
      }
      break;
    }

    case "help":
      console.log(`Commands:
  eligible         Show current draw pool
  draw [n]         Draw winner(s), default 1
  quit             Disconnect and exit`);
      break;

    case "quit":
    case "exit":
      await service.stop();
      process.exit(0);

    default:
      if (command) {
        console.log(`Unknown command: ${command} (type 'help')`);
      }
  }
}

async function main(): Promise<void> {
  const config = loadGiveawayConfig();
  console.log(`Connecting to Kick chat: ${config.channel}`);
  if (config.chatroomId) {
    console.log(`Using chatroom ID: ${config.chatroomId}`);
  }
  console.log(`Entry keyword: ${config.entryKeyword ?? "!enter"}`);
  console.log("Type 'help' for streamer commands.\n");

  service.onEvent((event) => {
    if (event.type !== "entry") return;
    const { username, message, status, riskLevel } = event.payload;
    const risk = riskLevel ? `${RISK_ICON[riskLevel]} ${riskLevel}` : "";
    console.log(`<${username}> ${message}`);
    console.log(`   └─ ${status}${risk ? ` ${risk}` : ""}\n`);
  });

  await service.start();
  console.log(`✅ Connected to #${config.channel}\n`);

  const rl = readline.createInterface({ input, output });

  process.on("SIGINT", async () => {
    await service.stop();
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
