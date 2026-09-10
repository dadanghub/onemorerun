/**
 * Run state model. The run state is shared between the client and the
 * server. The server treats it as untrusted input and re-validates every
 * field.
 */

import type { RoomSpec } from './rooms';
import type { RelicDef } from './relics';

export type RunStatus =
  | 'in_progress'
  | 'extracted'
  | 'died'
  | 'invalid';        // server verdict

export interface RunStats {
  /** Run Gold accumulated this run, including current room. */
  runGold: number;
  /** Lifetime gold this run, including amounts already spent. */
  totalRunGoldEarned: number;
  /** Server-computable Reward Score. Client sends a provisional value; server finalises. */
  rewardScore: number;
  enemiesKilled: number;
  bossesKilled: number;
  /** Deepest floor reached. */
  floor: number;
  /** Greed level at time of cash-out or death. */
  greed: number;
  /** Rooms cleared this run. */
  roomsCleared: number;
  /** Wall-clock duration in seconds. */
  durationSec: number;
  /** Relic ids currently held. */
  relics: string[];
  /** Room sequence (canonical). */
  rooms: RoomSpec[];
}

export interface RunSummary {
  runId: string;
  walletAddress: string | null;     // null in guest mode
  startedAt: number;                 // ms epoch
  endedAt: number;
  status: RunStatus;
  stats: RunStats;
  /** Server-issued reward in OMR (whole units). 0 if invalid/died. */
  rewardOmr: number;
  /** Transaction hash on Ronin, once claimed. */
  txHash?: string;
  /** Failure reason if status === 'invalid'. */
  invalidReason?: string;
}

/**
 * What the client POSTs at the end of a run. Only ids and counters —
 * the server recomputes everything else.
 */
export interface RunSubmission {
  runId: string;
  startedAt: number;
  endedAt: number;
  status: Exclude<RunStatus, 'invalid'>;
  /** Wallet address that will receive the reward. Required for claim. */
  walletAddress: string | null;
  /** Sequence of room seeds + types. */
  rooms: Array<{ index: number; type: string; seed: number; cleared: boolean }>;
  /** Counters the client tracks for client-side UI. */
  stats: {
    runGold: number;
    rewardScore: number;
    enemiesKilled: number;
    bossesKilled: number;
    floor: number;
    greed: number;
    roomsCleared: number;
    relics: string[];
  };
}

export function makeEmptyStats(): RunStats {
  return {
    runGold: 0,
    totalRunGoldEarned: 0,
    rewardScore: 0,
    enemiesKilled: 0,
    bossesKilled: 0,
    floor: 0,
    greed: 0,
    roomsCleared: 0,
    durationSec: 0,
    relics: [],
    rooms: [],
  };
}
