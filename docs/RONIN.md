# Ronin integration

The game uses the **official `@sky-mavis/tanto-connect` SDK** for wallet
connection and transactions. Docs consulted (Sept 2026):

- https://docs.skymavis.com/ronin/wallet/tutorials/connect-web
- https://docs.skymavis.com/ronin/wallet/tutorials/connect-mobile
- https://docs.roninchain.com/developers/network/

## Network config

Centralized in `packages/shared/src/network.ts`. To switch networks,
edit `ACTIVE_NETWORK` (or override via the `NETWORK` env var).

| Network | Chain ID | RPC | Explorer |
|---------|----------|-----|----------|
| Saigon (testnet) | 2021 | `https://saigon-testnet.roninchain.com/rpc` | `https://saigon-explorer.roninchain.com` |
| Ronin (mainnet) | 2020 | `https://api.roninchain.com/rpc` | `https://app.roninchain.com` |

## Wallet flow

1. `useWallet()` calls `requestRoninWalletConnector()` to get an EIP-6963
   injected provider. If the extension is not installed the user is
   pointed at https://wallet.roninchain.com.
2. `connect()` requests accounts, gets `chainId`, and prompts a
   `switchChain(2021)` if the user is on the wrong network.
3. `disconnect()` clears the local cache. We do NOT store any wallet
   secrets — the wallet extension owns the keys.
4. `sendClaim(contract, payload, signature)` encodes the
   `claim(bytes32,address,uint256,uint256,uint256,bytes)` call and sends
   it via `eth_sendTransaction` through the wallet's provider.

## Statuses we surface to the UI

- wallet installed
- wallet connected
- wallet disconnected
- wrong network
- transaction pending
- transaction successful (we link the hash to the Saigon explorer)
- transaction rejected (caught from the RPC error)
- transaction failed

## What we never do

- Request a private key, seed phrase, or recovery phrase.
- Sign transactions on behalf of the user.
- Store anything beyond the public address and chainId.
- Touch the user's RON or NFTs in any way. On death, only the
  *unsecured current-run* reward is lost. Wallet balances are
  unaffected.
