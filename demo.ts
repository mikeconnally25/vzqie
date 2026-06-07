import { InMemoryAuditLogger } from "./src/audit.js";
import { calculateRisk } from "./src/risk.js";
import { GiveawayEngine } from "./src/giveawayEngine.js";
import type { ChatMessage, UserProfile } from "./src/types.js";

const RISK_ICON = { LOW: "🟢", MEDIUM: "🟡", HIGH: "🔴" } as const;
const now = Date.now();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chat(
  username: string,
  message: string,
  profile?: Partial<UserProfile>
): { message: ChatMessage; profile?: Partial<UserProfile> } {
  return {
    message: {
      username,
      message,
      timestamp: now,
      accountAgeDays: profile?.accountAgeDays,
      isSubscriber: profile?.accountAgeDays !== undefined && profile.accountAgeDays > 60,
      isFollower: profile?.followAgeDays !== undefined && profile.followAgeDays > 0,
    },
    profile,
  };
}

function header(title: string): void {
  console.log(`\n${"═".repeat(52)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(52)}\n`);
}

function line(text: string): void {
  console.log(`  ${text}`);
}

async function main(): Promise<void> {
  header("🎁 KICK GIVEAWAY — LIVE DEMO");

  const auditLogger = new InMemoryAuditLogger();
  const engine = new GiveawayEngine({ now: () => now, auditLogger });

  header("💬 Chat messages incoming");

  const incoming = [
    chat("Nightbot", "!enter", {}),
    chat("viewer1", "!enter", { accountAgeDays: 120, followAgeDays: 45, messageCount: 50 }),
    chat("viewer2", "!enter", { accountAgeDays: 3, followAgeDays: 0, messageCount: 1 }),
    chat("viewer3", "!enter", { accountAgeDays: 5, followAgeDays: 2, messageCount: 1 }),
    chat("StreamElements", "!enter", {}),
    chat("loyal_sub", "!enter", { accountAgeDays: 400, followAgeDays: 200, messageCount: 900 }),
  ];

  for (const { message, profile } of incoming) {
    await sleep(400);
    const risk = calculateRisk({
      username: message.username,
      accountAgeDays: profile?.accountAgeDays,
      followAgeDays: profile?.followAgeDays,
      messageCount: profile?.messageCount,
    });

    line(`<${message.username}> ${message.message}`);
    const result = engine.addMessage(message, profile);

    if (result?.status === "blocked") {
      line(`   └─ 🚫 BLOCKED (bot blacklist)`);
    } else if (result?.status === "entered") {
      line(`   └─ ✅ ENTERED  ${RISK_ICON[risk.level]} ${risk.level}`);
    }
    console.log();
  }

  header("🎲 Drawing winners");

  const eligible = engine.getEligibleParticipants();
  line(`Eligible pool (${eligible.length} viewers):`);
  for (const p of eligible) {
    line(`  • ${p.username}  ${RISK_ICON[p.riskLevel]} ${p.riskLevel}`);
  }
  console.log();

  await sleep(500);
  const previousWins = [{ username: "loyal_sub", timestamp: now - 1_000 }];
  line("Previous win: loyal_sub won 1 second ago (on cooldown)\n");

  const winners = engine.draw(1, previousWins);
  line(`🏆 Winner: ${winners[0]?.username ?? "none"}`);
  console.log();

  header("📜 Audit log");
  for (const entry of auditLogger.entries) {
    const meta = entry.metadata
      ? ` ${JSON.stringify(entry.metadata)}`
      : "";
    line(`${entry.action.padEnd(16)} → ${entry.username}${meta}`);
  }

  console.log(`\n${"═".repeat(52)}`);
  console.log("  Demo complete — run `npm run demo` anytime");
  console.log(`${"═".repeat(52)}\n`);
}

main();
