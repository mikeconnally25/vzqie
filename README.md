# Kick Giveaway

TypeScript giveaway engine and web dashboard for Kick live-stream chat. Includes risk scoring, manual approval for high-risk entries, and audited winner draws.

## Quick start

1. Copy `.env.example` to `.env` and set your Kick channel and chatroom ID.
2. Install dependencies: `npm install`
3. Start the dashboard: `npm run web`
4. Open http://localhost:3000

```env
KICK_CHANNEL=blakjac21
KICK_CHATROOM_ID=282833
GIVEAWAY_KEYWORD=!enter
PORT=3000
```

Kick's channel API often blocks datacenter IPs. Use `KICK_CHATROOM_ID` (find it in the channel page source or network tab) to connect chat directly via Pusher.

## Scripts

- `npm run web` — start the web dashboard
- `npm start` — same as `npm run web`
- `npm run build` — compile TypeScript to `dist/`
- `npm test` — run unit tests

## Dashboard

The web UI shows:

- Live chat entries matching the giveaway keyword
- Eligible draw pool (3-minute participation window)
- Approval queue for high-risk entries
- CS:GO-style winner draw reel
- Winner history with clear/reset

## Layout

- `src/` — giveaway engine, Kick chat, and service layer
- `server.ts` — Express + Socket.io API and static dashboard
- `public/` — dashboard HTML, CSS, and client JS
- `tests/` — unit tests for cooldown, eligibility, and approval flows
