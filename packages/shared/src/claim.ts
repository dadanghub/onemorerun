/**
 * On-chain claim model.
 *
 * The server is the only party that knows the `amount`. It produces an
 * EIP-712 typed-data signature. The smart contract verifies the signer,
 * the runId nonce, the recipient, the chainId, the contract, and the
 * expiry — and then transfers the ERC-20 reward.
 *
 * EIP-712 domain is bound to the deployed RewardDistributor contract
 * address and the Ronin chainId, so signatures cannot be replayed across
 * chains or contracts.
 */

export interface ClaimPayload {
  /** Server-issued run id (bytes32 on-chain). */
  runId: `0x${string}`;
  /** Recipient (player wallet). */
  player: `0x${string}`;
  /** Reward amount in OMR **whole units** (the contract multiplies by 1e18). */
  amountOmr: string;
  /** Server nonce to defeat replays within the same contract instance. */
  nonce: string;
  /** Unix seconds after which the signature is invalid. */
  expiry: number;
}

export const CLAIM_TYPES = {
  Claim: [
    { name: 'runId',  type: 'bytes32' },
    { name: 'player', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce',  type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
} as const;

/** Result of `/run/complete`. */
export interface ClaimResponse {
  ok: true;
  runId: string;
  rewardOmr: number;
  /** Server-signed EIP-712 signature. Absent in DEV_REWARDS mode. */
  signature?: `0x${string}`;
  /** Typed-data payload the wallet must sign / send. */
  payload: ClaimPayload;
  /** Network config the client should use for the on-chain call. */
  network: {
    chainId: number;
    chainIdHex: `0x${string}`;
    contractAddress: `0x${string}`;
    tokenAddress: `0x${string}`;
  };
  dev: boolean;
}

export interface ClaimError {
  ok: false;
  reason: string;
}
