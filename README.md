# Kick Giveaway

TypeScript giveaway engine for live-stream chat with risk scoring, manual approval, and audited winner draws.

## Connect to your Kick chat

Kick chat is delivered over a public **Pusher WebSocket** (read-only, no OAuth needed to listen). This project uses [`kick-wss`](https://www.npmjs.com/package/kick-wss) to subscribe to your channel and feed messages into `GiveawayEngine`.

### 1. Install

```bash
npm install
```

### 2. Set your channel

Use your Kick **channel slug** (the name in `kick.com/yourname`):

```bash
export KICK_CHANNEL=yourname
export KICK_CHATROOM_ID=123456   # recommended — bypasses blocked API lookup
export GIVEAWAY_KEYWORD=!enter   # optional, default: !enter
```

### 3. Run the bot

```bash
npm run bot
```

While you are live, viewers type `!enter` in chat. The bot logs entries and flags high-risk users for approval.

### 4. Streamer commands (in the bot terminal)

| Command | Action |
|---------|--------|
| `approve viewer2` | Allow a pending high-risk entry |
| `reject viewer2` | Remove a pending entry |
| `queue` | Show approval queue |
| `eligible` | Show who can win |
| `draw` | Pick a winner |
| `draw 3` | Pick multiple winners |
| `quit` | Disconnect |

### How it works

```
Kick chat (Pusher) → KickChatProvider → GiveawayEngine → approve/draw
```

`KickChatProvider` implements the `ChatProvider` interface from `src/types.ts`, so you can swap in a mock provider for tests or a different transport later.

### Find your chatroom ID

Open this in a browser while logged into Kick:

`https://kick.com/api/v2/channels/yourname`

Look for `chatroom.id` in the JSON and set `KICK_CHATROOM_ID` in `.env`. This skips the slug lookup API, which is often blocked outside your home network.

### Sending messages back to chat

`kick-wss` is **read-only**. To announce winners in chat you need Kick OAuth with the `chat:write` scope via the [Kick Developer Portal](https://kick.com/settings/developer). That is a separate integration on top of this engine.

## Scripts

- `npm run bot` — connect to live Kick chat
- `npm run demo` — offline simulated giveaway
- `npm run build` — compile TypeScript to `dist/`
- `npm test` — run unit tests

## Layout

- `src/` — chat ingest, risk scoring, eligibility, and draw logic
- `src/kick/` — Kick WebSocket adapter
- `bot.ts` — live chat runner
- `tests/` — unit tests for cooldown, eligibility, and approval flows
