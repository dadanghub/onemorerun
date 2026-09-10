/**
 * Server reward unit tests. Plain node:test, no test framework.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReward, computeRewardScore, computeRewardOmr } from '@omr/game-engine';
import type { RunSubmission } from '@omr/shared';

function makeSub(over: Partial<RunSubmission> = {}): RunSubmission {
  return {
    runId: 'r1',
    startedAt: Date.now() - 60000,
    endedAt: Date.now(),
    status: 'extracted',
    walletAddress: '0x000000000000000000000000000000000000abcd',
    rooms: [],
    stats: {
      runGold: 1000,
      rewardScore: 0,
      enemiesKilled: 20,
      bossesKilled: 0,
      floor: 10,
      greed: 0,
      roomsCleared: 10,
      relics: [],
    },
    ...over,
  };
}

test('died run yields zero', () => {
  const r = evaluateReward({ submission: { ...makeSub(), status: 'died' }, dailyPoolSpent: 0, playerSpentToday: 0 });
  assert.equal(r.rewardOmr, 0);
});

test('extracted run yields non-zero', () => {
  const r = evaluateReward({ submission: makeSub(), dailyPoolSpent: 0, playerSpentToday: 0 });
  assert.ok(r.rewardOmr > 0, `expected > 0, got ${r.rewardOmr}`);
});

test('higher greed yields higher reward', () => {
  const a = evaluateReward({ submission: { ...makeSub(), stats: { ...makeSub().stats, greed: 0 } }, dailyPoolSpent: 0, playerSpentToday: 0 });
  const b = evaluateReward({ submission: { ...makeSub(), stats: { ...makeSub().stats, greed: 4 } }, dailyPoolSpent: 0, playerSpentToday: 0 });
  assert.ok(b.rewardOmr > a.rewardOmr);
});

test('per-player daily cap applies', () => {
  const r = evaluateReward({ submission: makeSub({ stats: { ...makeSub().stats, floor: 500, enemiesKilled: 5000 } }), dailyPoolSpent: 0, playerSpentToday: 10000 });
  assert.equal(r.capped, true);
});

test('pool cap applies', () => {
  const r = evaluateReward({ submission: makeSub({ stats: { ...makeSub().stats, floor: 500, enemiesKilled: 5000 } }), dailyPoolSpent: 99999999, playerSpentToday: 0 });
  assert.equal(r.capped, true);
});

test('reward score monotonic in floor', () => {
  const a = computeRewardScore({ ...makeSub(), stats: { ...makeSub().stats, floor: 5 } });
  const b = computeRewardScore({ ...makeSub(), stats: { ...makeSub().stats, floor: 25 } });
  assert.ok(b > a);
});

test('reward omr monotonic in score', () => {
  assert.ok(computeRewardOmr(200, 0) > computeRewardOmr(100, 0));
});
