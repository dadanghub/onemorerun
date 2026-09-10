# Milestones

| # | Milestone | Status | Notes |
|---|-----------|--------|-------|
| M1 | Playable prototype: WASD/mouse combat, 5 enemies, room transitions, loot, death | **DONE** | `apps/game/src/game/scenes` |
| M2 | Procedural dungeon + Greed + Extraction | **DONE** | `packages/game-engine/src/rooms.ts`, Greed table in `packages/shared/src/greed.ts`, Extraction modal in `apps/game/src/ui/ExtractionModal.tsx` |
| M3 | Backend validation + run history | **DONE (in-memory)** | `apps/server` — swap with Postgres before mainnet |
| M4 | Ronin Wallet + smart contract + claims | **Scaffolded** | `@sky-mavis/tanto-connect`, `contracts/src/RewardDistributor.sol`. Real on-chain claims require `DEV_REWARDS=false` and a deployed contract. |
| M5 | Polish, leaderboards, daily seed, social | **In progress** | Leaderboard endpoint exists; daily seed helper exists (`dailySeed()` in `packages/game-engine/src/rng.ts`). |

## How to flip to production mode

1. Deploy `OMR` and `RewardDistributor` to Saigon:
   ```bash
   cd contracts
   DEPLOYER_PRIVATE_KEY=0x... BACKEND_SIGNER=0x... npx hardhat run scripts/deploy.ts --network saigon
   ```
2. Run the contract test suite:
   ```bash
   npx hardhat test
   ```
3. Fill the `.env` of the server:
   ```env
   NETWORK=testnet
   DEV_REWARDS=false
   BACKEND_SIGNER_PRIVATE_KEY=0x...          # EIP-712 signer (must match BACKEND_SIGNER above)
   REWARD_DISTRIBUTOR_ADDRESS=0x...
   OMR_TOKEN_ADDRESS=0x...
   ```
4. `npm run dev:server` then `npm run dev:game`.
5. Connect Ronin Wallet, extract a run, claim. The wallet will prompt for a `claim(...)` transaction.

## Remaining work before mainnet

- [ ] Independent security audit of `RewardDistributor`.
- [ ] Postgres persistence (replace in-memory `runsByWallet`).
- [ ] Anti-cheat heuristics: speed, impossible damage, mutated seeds.
- [ ] Replace `OMR` test token with an approved Ronin ecosystem asset (or upgrade OMR for production use).
- [ ] Daily emission cap dashboard & admin tools.
- [ ] Server signer key in HSM/KMS, not env var.
- [ ] Mobile controls (touch joystick, tap-to-attack).
- [ ] Localization & accessibility.
- [ ] Daily run seed distributed to all clients at UTC midnight.
- [ ] More relics, enemies, biomes, bosses.
- [ ] Social share-card image export.
- [ ] Legal review (transferable token, jurisdiction-specific gaming laws).
