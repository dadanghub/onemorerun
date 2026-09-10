# Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Browser (Vite + React)                     │
│ ┌──────────────────────┐   ┌──────────────────────────────────────┐│
│ │  React UI            │   │  Phaser 3 game (GameScene)           ││
│ │  - MainMenu          │◄─►│  - Player, enemies, projectiles      ││
│ │  - HUD               │   │  - Room builder (tilemap)            ││
│ │  - ExtractionModal   │   │  - Procedural room sequence          ││
│ │  - EndScreen         │   │  - Greed & corruption                ││
│ │  - Wallet button     │   │  - Loot, relics, mystery events      ││
│ └──────────┬───────────┘   └──────────────────┬───────────────────┘│
│            │   shared uiState (30Hz poll)    │                    │
│            ▼                                  ▼                    │
│       useWallet() ──── @sky-mavis/tanto-connect ──► Ronin Wallet   │
└────────────────────────────────────────────────────────────────────┘
             │                                       ▲
   POST /run/complete (claim submission)             │  eth_sendTransaction
   GET  /runs/<wallet>                               │  (signed claim)
   GET  /leaderboard                                 │
             ▼                                       │
┌────────────────────────────────────────────────────────────────────┐
│                  Node/Express server (apps/server)                 │
│   - validate RunSubmission (floor/gold/enemies sanity)            │
│   - compute Reward Score (game-engine)                             │
│   - cap by daily pool & per-player cap                             │
│   - sign EIP-712 Claim(runId,player,amount,nonce,expiry)           │
│   - record run history (in-memory now; Postgres in prod)            │
└────────────────────────────────────────────────────────────────────┘
             │                                       ▲
             │                              ETH RPC │  write
             ▼                                       │
┌────────────────────────────────────────────────────────────────────┐
│                        Ronin (Saigon / Mainnet)                    │
│   OMR (ERC-20)  ◄───  RewardDistributor  ─── verify EIP-712 sig    │
│                                   └── transfer OMR ──► player      │
└────────────────────────────────────────────────────────────────────┘
```

## Why this shape

- **Phaser for gameplay, React for chrome.** Phaser is great for the
  game world, but DOM/CSS is far easier for menus, modals, and the
  wallet button. They communicate via a `uiState` object on
  `GameScene` that the React tree polls at 30Hz.
- **`@omr/game-engine` is shared between client and server.** The
  server runs `evaluateReward(...)` — the same pure function the
  client uses for its local prediction — so there is exactly one
  source of truth for reward math.
- **The server is the only thing that knows `amount`.** The browser
  cannot forge a larger amount because the smart contract will
  recover a different signer when the digest is rebuilt with the
  tampered value.
- **Wallets are never touched by gameplay code.** Death, extraction,
  and Greed all happen off-chain. Only the final `claim(...)` call
  costs gas.

## Daily seed

`dailySeed(date)` in `packages/game-engine/src/rng.ts` returns a
deterministic 32-bit number from the UTC date. Once a daily-run feature
ships, the server will distribute the same seed to all players at UTC
midnight so they race the same dungeon.
