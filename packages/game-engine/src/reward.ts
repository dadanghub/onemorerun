/**
 * Server-side reward calculation.
 *
 * Pure function: same inputs → same output. The client cannot influence
 * the final OMR amount; it can only influence the *inputs* (floors,
 * kills, greed, time), all of which the server re-derives from the
 * submitted event log.
 *
 * Final reward = floor(rewardScore * scoreMult) and capped by
 * DAILY_REWARD_POOL / PER_PLAYER_DAILY_CAP.
 */

import {
  greedTier,
  DAILY_REWARD_POOL,
  PER_PLAYER_DAILY_CAP,
  type RunSubmission,
} from '@omr/shared';

export interface RewardInput {
  submission: RunSubmission;
  /** How much of the daily pool has already been paid out today. */
  dailyPoolSpent: number;
  /** How much the same wallet has already earned today. */
  playerSpentToday: number;
}

export interface RewardResult {
  rewardScore: number;
  rewardOmr: number;
  capped: boolean;
  reason?: string;
}

const FLOOR_WEIGHT = 1.0;
const KILL_WEIGHT = 0.6;
const BOSS_WEIGHT = 25;
const CHALLENGE_WEIGHT = 15;

export function computeRewardScore(sub: RunSubmission): number {
  const s = sub.stats;
  let score = 0;
  score += s.floor * FLOOR_WEIGHT;
  score += s.enemiesKilled * KILL_WEIGHT;
  score += s.bossesKilled * BOSS_WEIGHT;
  // Bonus for time efficiency (rewards fast skilled play).
  if (s.floor > 0) {
    const floorsPerMinute = s.floor / Math.max(1, (sub.endedAt - sub.startedAt) / 60000);
    score += Math.max(0, floorsPerMinute - 1.5) * 20;
  }
  // Greed multiplier.
  const tier = greedTier(s.greed);
  score *= tier.scoreMult;
  return Math.round(score);
}

export function computeRewardOmr(score: number, greed: number): number {
  // 1 OMR per 10 score, scaled by greed reward mult.
  const tier = greedTier(greed);
  const omr = (score / 10) * tier.rewardMult;
  return Math.max(0, Math.floor(omr * 100) / 100); // 2dp
}

export function capReward(input: RewardInput, raw: number): { omr: number; capped: boolean; reason?: string } {
  const poolRemaining = Math.max(0, DAILY_REWARD_POOL - input.dailyPoolSpent);
  const playerRemaining = Math.max(0, PER_PLAYER_DAILY_CAP - input.playerSpentToday);
  const ceiling = Math.min(poolRemaining, playerRemaining);
  if (raw <= ceiling) return { omr: raw, capped: false };
  if (ceiling <= 0) return { omr: 0, capped: true, reason: 'Daily cap exhausted' };
  return { omr: Math.floor(ceiling * 100) / 100, capped: true, reason: 'Capped by daily limits' };
}

export function evaluateReward(input: RewardInput): RewardResult {
  if (input.submission.status === 'died') {
    return { rewardScore: 0, rewardOmr: 0, capped: false, reason: 'Player died — no reward' };
  }
  const rewardScore = computeRewardScore(input.submission);
  const raw = computeRewardOmr(rewardScore, input.submission.stats.greed);
  const { omr, capped, reason } = capReward(input, raw);
  return { rewardScore, rewardOmr: omr, capped, reason };
}
