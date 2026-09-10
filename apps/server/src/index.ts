/**
 * ONE MORE RUN server.
 *
 * In DEV_REWARDS mode (default for prototype) we skip the database, the
 * real signing, and the on-chain tx. The server:
 *   - validates submissions
 *   - computes the reward using the same engine the client uses
 *   - returns a fake claim
 *
 * To enable real signing: set DEV_REWARDS=false and BACKEND_SIGNER_PRIVATE_KEY=0x...
 * To enable Postgres: see /docs/MILESTONES.md.
 */
import express from 'express';
import cors from 'cors';
import {
  ACTIVE_NETWORK,
  DEV_REWARDS,
  REWARD_DISTRIBUTOR_ADDRESS,
  type ClaimResponse,
  type ClaimError,
  type RunSubmission,
} from '@omr/shared';
import { evaluateReward } from '@omr/game-engine';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.SERVER_PORT || 4000);

/** Pack a string/UUID into a bytes32 hex (0x + 64 hex chars). */
function toBytes32(s: string): `0x${string}` {
  if (s.startsWith('0x') && s.length === 66) return s as `0x${string}`;
  const hex = Buffer.from(s, 'utf8').toString('hex').padEnd(64, '0').slice(-64);
  return `0x${hex}` as `0x${string}`;
}

// In-memory store for prototype. In production swap with Postgres.
const runsByWallet = new Map<string, any[]>();
const dailySpent = { poolSpent: 0, playerSpent: new Map<string, number>() };

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function validateSubmission(sub: RunSubmission): { ok: true } | { ok: false; reason: string } {
  if (!sub || typeof sub !== 'object') return { ok: false, reason: 'Bad submission' };
  if (sub.status !== 'extracted') return { ok: true }; // died is allowed (just no reward)
  if (!sub.walletAddress) return { ok: false, reason: 'Wallet required for extraction' };
  if (!/^0x[0-9a-fA-F]{40}$/.test(sub.walletAddress)) return { ok: false, reason: 'Bad wallet address' };
  if (sub.endedAt - sub.startedAt < 1000) return { ok: false, reason: 'Run impossibly short' };
  if (sub.endedAt - sub.startedAt > 1000 * 60 * 60 * 4) return { ok: false, reason: 'Run impossibly long' };
  if (sub.stats.floor < 0 || sub.stats.floor > 10000) return { ok: false, reason: 'Bad floor' };
  if (sub.stats.greed < 0 || sub.stats.greed > 100) return { ok: false, reason: 'Bad greed' };
  if (sub.stats.enemiesKilled < 0 || sub.stats.enemiesKilled > 100000) return { ok: false, reason: 'Bad enemy count' };
  return { ok: true };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '128kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, dev: DEV_REWARDS, network: ACTIVE_NETWORK.name }));

// End a run. Returns either a ClaimResponse or a ClaimError.
app.post('/run/complete', async (req, res) => {
  const sub: RunSubmission = req.body;
  const v = validateSubmission(sub);
  if (!v.ok) {
    const r: ClaimError = { ok: false, reason: v.reason };
    return res.status(400).json(r);
  }

  // Server reward calculation (authoritative).
  const dailyPoolSpent = dailySpent.poolSpent;
  const playerSpentToday = dailySpent.playerSpent.get(sub.walletAddress ?? '') ?? 0;
  const result = evaluateReward({ submission: sub, dailyPoolSpent, playerSpentToday });

  // In-memory record
  const record = {
    runId: sub.runId,
    endedAt: sub.endedAt,
    status: sub.status,
    stats: sub.stats,
    rewardOmr: result.rewardOmr,
    txHash: undefined as string | undefined,
  };
  if (sub.walletAddress) {
    const arr = runsByWallet.get(sub.walletAddress) ?? [];
    arr.unshift(record);
    runsByWallet.set(sub.walletAddress, arr.slice(0, 100));
    if (sub.status === 'extracted' && result.rewardOmr > 0) {
      dailySpent.poolSpent += result.rewardOmr;
      dailySpent.playerSpent.set(sub.walletAddress, playerSpentToday + result.rewardOmr);
    }
  }

  if (sub.status !== 'extracted' || result.rewardOmr === 0) {
    const r: ClaimError = { ok: false, reason: result.reason || 'No reward for this run' };
    return res.status(200).json(r);
  }

  // DEV mode: skip signing, return dev claim.
  if (DEV_REWARDS) {
    const runIdBytes32 = toBytes32(sub.runId);
    const response: ClaimResponse = {
      ok: true,
      runId: runIdBytes32,
      rewardOmr: result.rewardOmr,
      payload: {
        runId: runIdBytes32,
        player: sub.walletAddress as `0x${string}`,
        amountOmr: result.rewardOmr.toFixed(2),
        nonce: String(Date.now()),
        expiry: Math.floor(Date.now() / 1000) + 3600,
      },
      network: {
        chainId: ACTIVE_NETWORK.chainId,
        chainIdHex: ACTIVE_NETWORK.chainIdHex,
        contractAddress: REWARD_DISTRIBUTOR_ADDRESS as `0x${string}`,
        tokenAddress: '0x0000000000000000000000000000000000000000',
      },
      dev: true,
    };
    return res.json(response);
  }

  // Real mode: sign EIP-712 claim.
  try {
    const { signClaim } = await import('./signer.js');
    const runIdBytes32 = toBytes32(sub.runId);
    const { signature, payload } = await signClaim({
      runId: runIdBytes32,
      player: sub.walletAddress as `0x${string}`,
      amountOmr: result.rewardOmr.toFixed(2),
      nonce: randomUUID().replace(/-/g, '').slice(0, 16),
      expiry: Math.floor(Date.now() / 1000) + 3600,
    });
    const response: ClaimResponse = {
      ok: true,
      runId: runIdBytes32,
      rewardOmr: result.rewardOmr,
      signature,
      payload,
      network: {
        chainId: ACTIVE_NETWORK.chainId,
        chainIdHex: ACTIVE_NETWORK.chainIdHex,
        contractAddress: REWARD_DISTRIBUTOR_ADDRESS as `0x${string}`,
        tokenAddress: '0x0000000000000000000000000000000000000000',
      },
      dev: false,
    };
    return res.json(response);
  } catch (e: any) {
    const r: ClaimError = { ok: false, reason: e?.message || 'Signer error' };
    return res.status(500).json(r);
  }
});

app.get('/runs/:wallet', (req, res) => {
  const arr = runsByWallet.get(req.params.wallet.toLowerCase()) ?? [];
  res.json(arr);
});

app.get('/leaderboard', (_req, res) => {
  const all: any[] = [];
  for (const arr of runsByWallet.values()) all.push(...arr);
  all.sort((a, b) => b.stats.floor - a.stats.floor);
  res.json(all.slice(0, 50));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[omr-server] listening on :${PORT} (network=${ACTIVE_NETWORK.name}, dev=${DEV_REWARDS})`);
});
