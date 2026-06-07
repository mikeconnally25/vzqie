# Kick Giveaway

TypeScript giveaway engine for live-stream chat with risk scoring and audited winner draws.

## Connect to your Kick chat

Kick chat is delivered over a public **Pusher WebSocket** (read-only, no OAuth needed to listen). This project connects to your channel and feeds messages into `GiveawayEngine`.

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

### 3. Run the web dashboard

```bash
npm run web
```

Open [http://localhost:3000](http://localhost:3000) while you are live. Viewers type `!enter` in chat and entries appear instantly.

### Terminal bot (optional)

```bash
npm run bot
```

| Command | Action |
|---------|--------|
| `eligible` | Show who can win |
| `draw` | Pick a winner |
| `draw 3` | Pick multiple winners |
| `quit` | Disconnect |

### Find your chatroom ID

Open this in a browser while logged into Kick:

`https://kick.com/api/v2/channels/yourname`

Look for `chatroom.id` in the JSON and set `KICK_CHATROOM_ID` in `.env`.

## Scripts

- `npm run web` — web dashboard at `http://localhost:3000`
- `npm run bot` — terminal-only giveaway bot
- `npm run demo` — offline simulated giveaway
- `npm run build` — compile TypeScript to `dist/`
- `npm test` — run unit tests

## Layout

- `src/` — chat ingest, risk scoring, eligibility, and draw logic
- `src/kick/` — Kick WebSocket adapter
- `server.ts` — web dashboard server
- `public/` — dashboard UI
- `bot.ts` — terminal chat runner
- `tests/` — unit tests
