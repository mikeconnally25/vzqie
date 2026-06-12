# Kick Giveaway

TypeScript giveaway engine for live-stream chat with risk scoring, manual approval, audited winner draws, and a collaborative blackjack mode where chat votes on hit or stand.

## Scripts

- `npm run build` — compile TypeScript to `dist/`
- `npm test` — run unit tests
- `npm run demo:blackjack` — run a scripted blackjack giveaway round in the terminal

## Blackjack giveaway flow

1. Viewers type `!enter` to join the giveaway pool (existing risk/eligibility rules apply).
2. A mod types `!bjstart` to open the round.
3. A mod types `!bjdeal` to deal a shared player hand against the dealer.
4. Chat votes with `!hit` or `!stand` during the 15-second voting window.
5. When the timer expires, the majority vote is applied. If the hand is still live, another vote window opens.
6. If the table wins, a winner is drawn from eligible entrants. If the table loses, no prize is awarded (configurable).

### Chat commands

| Command | Who | Action |
|---------|-----|--------|
| `!enter` | Viewers | Join the giveaway pool |
| `!bjstart` | Mods | Open a blackjack giveaway round |
| `!bjdeal` | Mods | Deal cards and start voting |
| `!hit` | Chat | Vote to draw another card |
| `!stand` | Chat | Vote to hold the current hand |
| `!bj` | Anyone | Show current table status |

### Quick start

```ts
import { BlackjackGiveawayBot } from "kick-giveaway";

const bot = new BlackjackGiveawayBot({
  mods: ["YourStreamerName"],
  voteWindowMs: 15_000,
});

// Wire into your chat provider's onMessage callback:
function onChatMessage({ username, message, timestamp }) {
  const replies = bot.handleMessage({ username, message, timestamp });

  for (const reply of replies) {
    sendToChat(reply.text);
  }
}

// Poll on an interval to resolve vote timers:
setInterval(() => {
  for (const reply of bot.tick()) {
    sendToChat(reply.text);
  }
}, 1_000);
```

## Layout

- `src/` — chat ingest, risk scoring, eligibility, draw logic, and blackjack giveaway bot
- `tests/` — unit tests for cooldown, eligibility, approval flows, and blackjack rounds
