# Kick Giveaway

TypeScript giveaway engine for live-stream chat with risk scoring, manual approval, and audited winner draws.

Also includes **Game Day Showdown**, a sports-themed 5×5 slot machine inspired by high-volatility duel-reel slots like *Wanted Dead or a Wild*.

## Scripts

- `npm run build` — compile TypeScript to `dist/`
- `npm test` — run unit tests
- `npm run dev:slot` — launch the sports slot machine in the browser
- `npm run build:slot` — build the slot web app to `dist-web/`

## Layout

- `src/` — chat ingest, risk scoring, eligibility, and draw logic
- `src/slot/` — sports slot engine (Head-to-Head reels, paylines, bonus features)
- `web/` — playable slot machine UI
- `tests/` — unit tests for cooldown, eligibility, and approval flows

## Game Day Showdown (Sports Slot)

A 5×5 grid with **15 fixed paylines** and these features:

| Feature | Description |
|---------|-------------|
| **Head-to-Head Reels** | VS symbols trigger an athlete duel. The winner expands the reel wild with a 2×–100× multiplier. |
| **The Great Comeback** | 3 🔥 scatters → 10 free spins with sticky wild medals |
| **Rivalry Match** | 3 ⚡ scatters → 10 free spins with extra VS symbols |
| **Championship Run** | 3 👑 scatters → collect wilds/multipliers, then a 3-spin showdown finale |

For entertainment only — no real-money gambling.
