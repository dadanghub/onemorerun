/**
 * Centralized Ronin network configuration.
 *
 * Edit this file to switch between Saigon (testnet) and Ronin mainnet.
 * All other code MUST import chain IDs / RPC URLs from here.
 *
 * Sources (consulted Sept 2026):
 *   - https://docs.roninchain.com/developers/network/
 *   - https://docs.skymavis.com/ronin/wallet/tutorials/connect-web
 *
 * The official Ronin Wallet SDK is `@sky-mavis/tanto-connect` (latest
 * 0.0.22 at time of writing). It exposes `ChainIds.RoninMainnet` and
 * `ChainIds.RoninTestnet`.
 */

export type NetworkName = 'testnet' | 'mainnet';

export interface NetworkConfig {
  name: NetworkName;
  chainId: number;          // EIP-155 chain ID, decimal
  chainIdHex: `0x${string}`;
  rpcUrl: string;
  explorer: string;         // block explorer base URL
  currencySymbol: 'RON';
  displayName: string;
}

export const SAIGON_TESTNET: NetworkConfig = {
  name: 'testnet',
  chainId: 2021,
  chainIdHex: '0x7e5',
  rpcUrl: 'https://saigon-testnet.roninchain.com/rpc',
  explorer: 'https://saigon-explorer.roninchain.com',
  currencySymbol: 'RON',
  displayName: 'Saigon Testnet',
};

export const RONIN_MAINNET: NetworkConfig = {
  name: 'mainnet',
  chainId: 2020,
  chainIdHex: '0x7e4',
  rpcUrl: 'https://api.roninchain.com/rpc',
  explorer: 'https://app.roninchain.com',
  currencySymbol: 'RON',
  displayName: 'Ronin Mainnet',
};

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  testnet: SAIGON_TESTNET,
  mainnet: RONIN_MAINNET,
};

/**
 * Pick the network we should target. Override at build time with
 * `VITE_NETWORK=mainnet`.
 */
export const ACTIVE_NETWORK: NetworkConfig =
  (typeof process !== 'undefined' && process.env?.NETWORK === 'mainnet')
    ? RONIN_MAINNET
    : SAIGON_TESTNET;

/**
 * Contract addresses — overridden at deploy time.
 * In dev/test mode they are zero addresses; the server returns
 * unsigned demo claims.
 */
export const REWARD_DISTRIBUTOR_ADDRESS =
  (typeof process !== 'undefined' && process.env?.REWARD_DISTRIBUTOR_ADDRESS) ||
  '0x0000000000000000000000000000000000000000';

export const OMR_TOKEN_ADDRESS =
  (typeof process !== 'undefined' && process.env?.OMR_TOKEN_ADDRESS) ||
  '0x0000000000000000000000000000000000000000';

/** Daily emission budget, in OMR (whole units, not wei). */
export const DAILY_REWARD_POOL = 10_000;

/** Per-player cap per UTC day, in OMR. */
export const PER_PLAYER_DAILY_CAP = 500;

/** When true, server returns fake/demo claims (no signing, no on-chain tx). */
export const DEV_REWARDS =
  (typeof process !== 'undefined' && process.env?.DEV_REWARDS === 'false')
    ? false
    : true;

/** Shorten a 0x address for display: `0x1234…ABCD`. */
export function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length < head + tail) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
