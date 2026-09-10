/**
 * EIP-712 claim signer (only loaded when DEV_REWARDS=false).
 *
 * Signs `(runId, player, amount, nonce, expiry)` over a domain bound to
 * the deployed RewardDistributor contract. The on-chain contract then
 * verifies the signer via ecrecover and refuses to pay twice for the
 * same runId.
 */
import { privateKeyToAccount } from 'viem/accounts';
import {
  ACTIVE_NETWORK,
  REWARD_DISTRIBUTOR_ADDRESS,
  CLAIM_TYPES,
  type ClaimPayload,
} from '@omr/shared';

const pk = process.env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
if (!pk || pk === '0x0000000000000000000000000000000000000000000000000000000000000001') {
  throw new Error('BACKEND_SIGNER_PRIVATE_KEY must be set to a real key in production mode');
}
const account = privateKeyToAccount(pk);

export async function signClaim(payload: ClaimPayload): Promise<{ signature: `0x${string}`; payload: ClaimPayload }> {
  const domain = {
    name: 'OneMoreRun',
    version: '1',
    chainId: ACTIVE_NETWORK.chainId,
    verifyingContract: REWARD_DISTRIBUTOR_ADDRESS as `0x${string}`,
  };
  const message = {
    runId:  payload.runId,
    player: payload.player,
    amount: BigInt(Math.round(Number(payload.amountOmr) * 1e18)),
    nonce:  BigInt(payload.nonce),
    expiry: BigInt(payload.expiry),
  };
  const signature = await account.signTypedData({ domain, types: CLAIM_TYPES as any, primaryType: 'Claim', message });
  return { signature, payload };
}
