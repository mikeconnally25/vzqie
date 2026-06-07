# Kick Giveaway

TypeScript giveaway engine for Kick live-stream chat with a web dashboard, viewer registration, risk scoring, and audited winner draws.

## Quick start

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
KICK_CHANNEL=yourname
KICK_CHATROOM_ID=123456
GIVEAWAY_KEYWORD=!enter
PORT=3000
SESSION_SECRET=change-this-to-a-long-random-string
```

```bash
npm run web
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. **Streamer setup** — On first launch, create a streamer account from the **Streamer** button in the header. This unlocks draws, keyword settings, and clearing winners.
2. **Viewer signup** — Viewers create an account linked to their Kick username in the **Viewer signup** panel. Only registered viewers count when they type the entry keyword in chat.
3. **Live chat** — The server connects to Kick chat via Pusher using `KICK_CHATROOM_ID`.
4. **Draw** — Signed-in streamers click **Draw Winner** to spin the case-opening style reel and pick a winner from the eligible pool.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KICK_CHANNEL` | Recommended | Your Kick channel slug (`kick.com/yourname`) |
| `KICK_CHATROOM_ID` | Recommended | Chatroom ID for Pusher connection |
| `GIVEAWAY_KEYWORD` | Optional | Entry keyword (default: `!enter`) |
| `GIVEAWAY_KEYWORD_ENABLED` | Optional | Set to `0` to count all chat |
| `SESSION_SECRET` | Recommended | Session signing secret |
| `PORT` | Optional | Web server port (default: `3000`) |
| `KICK_DEBUG` | Optional | Set to `1` for chat debug logs |
| `KICK_CLIENT_ID` | For OAuth | Kick developer app client ID |
| `KICK_CLIENT_SECRET` | For OAuth | Kick developer app client secret |
| `KICK_REDIRECT_URI` | For OAuth | OAuth callback URL |

If `KICK_CHANNEL` or `KICK_CHATROOM_ID` is missing, the dashboard still runs but chat stays offline until configured.

### Find your chatroom ID

Open in a browser while logged into Kick:

`https://kick.com/api/v2/channels/yourname`

Copy `chatroom.id` from the JSON response into `.env`.

If Kick blocks the lookup API, enter the chatroom ID manually during viewer signup.

## Viewer Kick OAuth

Viewers can link their Kick account with OAuth instead of manual username lookup.

1. Create a Kick developer app at https://docs.kick.com/getting-started/kick-apps-setup
2. Add to `.env`:

```env
KICK_CLIENT_ID=your-client-id
KICK_CLIENT_SECRET=your-client-secret
KICK_REDIRECT_URI=http://localhost:3000/api/kick/oauth/callback
```

3. Viewers click **Link with Kick** on the signup form
4. After Kick redirects back, they set a password to finish creating their account

The callback route is also available at `/api/callback` if you prefer that redirect URI in your Kick app settings.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run web` | Web dashboard at `http://localhost:3000` |
| `npm start` | Same as `npm run web` |
| `npm run bot` | Terminal-only giveaway bot |
| `npm run demo` | Offline simulated giveaway |
| `npm test` | Run unit tests |

## Dashboard features

- Live entry log and draw pool
- CS:GO-style winner draw reel
- Keyword toggle and custom entry keyword
- Clear winners (resets win history for cooldown)
- Viewer Kick account linking
- Streamer authentication for admin actions

## Project layout

- `src/` — giveaway engine, auth, Kick chat adapter
- `server.ts` — Express + Socket.io web server
- `public/` — dashboard UI
- `bot.ts` — terminal chat runner
- `tests/` — unit tests
