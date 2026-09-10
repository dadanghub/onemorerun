/**
 * Tiny client for the local Node/Express server.
 * The server URL is overridable via `VITE_SERVER_URL`.
 */
import type { ClaimResponse, ClaimError, RunSubmission } from '@omr/shared';

const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL ?? 'http://localhost:4000';

export interface RunHistoryItem {
  runId: string;
  endedAt: number;
  status: 'extracted' | 'died' | 'invalid';
  stats: { floor: number; greed: number; enemiesKilled: number; bossesKilled: number };
  rewardOmr: number;
  txHash?: string;
}

export async function claimReward(submission: RunSubmission): Promise<ClaimResponse | ClaimError> {
  try {
    const r = await fetch(`${SERVER_URL}/run/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
    const j = await r.json();
    return j;
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Network error' };
  }
}

export async function getRunHistory(walletAddress: string): Promise<RunHistoryItem[]> {
  try {
    const r = await fetch(`${SERVER_URL}/runs/${walletAddress}`);
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function getLeaderboard(): Promise<RunHistoryItem[]> {
  try {
    const r = await fetch(`${SERVER_URL}/leaderboard`);
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}
