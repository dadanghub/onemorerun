# ONE MORE RUN

> How greedy are you?

A fast-paced roguelike dungeon crawler on **Ronin Network**. Defeat enemies,
collect relics, hit extraction portals, and decide: **CASH OUT** or **ONE
MORE ROOM?** If you die, you only lose your unsecured run rewards — your
wallet is never touched.

## Status

| Milestone | Status | Notes |
| --- | --- | --- |
| M1 — Playable prototype | **Done** | WASD/mouse combat, 5 enemies, rooms, loot, death |
| M2 — Procedural dungeon + Greed + Extraction | **Done (in code)** | See `apps/game/src/scenes` |
| M3 — Server validation + run history | Scaffolded | `apps/server` |
| M4 — Ronin Wallet + smart contract + claims | Scaffolded | `@sky-mavis/tanto-connect` + `contracts/` |
| M5 — Polish, leaderboards, daily seed, social | Pending | |

See `docs/MILESTONES.md` for the full plan.

## Quick start

```bash
# install
npm install

# play the game (browser, no wallet required for guest mode)
npm run dev:game
# open the URL printed by Vite (default http://localhost:5173)
```

The game works without a wallet. Wallet is only required to claim on-chain
rewards.

## Architecture

```
/apps
  /game        Vite + React + Phaser 3 client
  /server      Express + Postgres backend (run validation, claim signing)
/packages
  /shared      Shared types + network config
  /game-engine Headless Phaser systems reused by client & server
/contracts     Solidity (Hardhat): RewardDistributor + OMR test token
/scripts       Deployment & dev utilities
/docs          Architecture, milestones
```

## Network config

Edit `packages/shared/src/network.ts` to switch between Saigon testnet
(chain ID `2021`) and Ronin mainnet (`2020`). RPC, explorer, and contract
addresses all live in one file.

## Ronin Wallet

Uses the official [`@sky-mavis/tanto-connect`](https://www.npmjs.com/package/@sky-mavis/tanto-connect)
SDK (EIP-6963 injected provider + WalletConnect for mobile). See
`docs/RONIN.md`.

## Security

- Wallet private keys are never requested or stored.
- Reward amounts are computed server-side and signed with EIP-712.
- The smart contract verifies the signer, the runId nonce, the recipient,
  the chainId, and the expiry before transferring tokens.
- The browser cannot forge rewards.

## License

UNLICENSED — internal prototype.
