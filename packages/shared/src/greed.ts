/**
 * The Greed system.
 *
 * Every time the player rejects an extraction portal, `greed` increments by 1
 * and the run gets meaningfully more dangerous AND more rewarding.
 *
 * All values are data-driven so designers can rebalance from one file.
 */

export interface GreedTier {
  /** Threshold inclusive lower bound. */
  greed: number;
  /** Multiplier applied to Run Gold earned this run. */
  rewardMult: number;
  /** Multiplier applied to enemy HP, damage, projectile count. */
  enemyMult: number;
  /** Multiplier applied to Reward Score (which maps to OMR). */
  scoreMult: number;
  /** 0..1 chance that the next offered room is an Elite. */
  eliteChance: number;
  /** 0..1 chance that treasure is replaced by a cursed treasure. */
  cursedChance: number;
  /** How often extraction portals appear (lower = rarer). */
  portalFrequency: number;
  /** 0..3 visual corruption tier (lighting, particles, edge vignette). */
  corruption: 0 | 1 | 2 | 3;
  /** Short flavor text shown when this tier is reached. */
  flavor: string;
}

export const GREED_TIERS: GreedTier[] = [
  { greed: 0, rewardMult: 1.00, enemyMult: 1.00, scoreMult: 1.00, eliteChance: 0.05, cursedChance: 0.00, portalFrequency: 1.00, corruption: 0, flavor: 'Cautious.' },
  { greed: 1, rewardMult: 1.25, enemyMult: 1.10, scoreMult: 1.20, eliteChance: 0.10, cursedChance: 0.05, portalFrequency: 0.90, corruption: 0, flavor: 'Tempting.' },
  { greed: 2, rewardMult: 1.50, enemyMult: 1.20, scoreMult: 1.45, eliteChance: 0.18, cursedChance: 0.10, portalFrequency: 0.80, corruption: 1, flavor: 'Greedy.' },
  { greed: 3, rewardMult: 1.80, enemyMult: 1.35, scoreMult: 1.75, eliteChance: 0.25, cursedChance: 0.18, portalFrequency: 0.70, corruption: 1, flavor: 'Reckless.' },
  { greed: 4, rewardMult: 2.15, enemyMult: 1.55, scoreMult: 2.10, eliteChance: 0.32, cursedChance: 0.25, portalFrequency: 0.60, corruption: 2, flavor: 'Hungry.' },
  { greed: 5, rewardMult: 2.60, enemyMult: 1.80, scoreMult: 2.55, eliteChance: 0.40, cursedChance: 0.32, portalFrequency: 0.50, corruption: 2, flavor: 'Obsessed.' },
  { greed: 6, rewardMult: 3.20, enemyMult: 2.10, scoreMult: 3.10, eliteChance: 0.48, cursedChance: 0.40, portalFrequency: 0.45, corruption: 3, flavor: 'Corrupted.' },
  { greed: 7, rewardMult: 3.90, enemyMult: 2.45, scoreMult: 3.80, eliteChance: 0.55, cursedChance: 0.50, portalFrequency: 0.40, corruption: 3, flavor: 'Insatiable.' },
  { greed: 8, rewardMult: 4.80, enemyMult: 2.85, scoreMult: 4.70, eliteChance: 0.62, cursedChance: 0.60, portalFrequency: 0.35, corruption: 3, flavor: 'Legendary greed.' },
];

export function greedTier(greed: number): GreedTier {
  return GREED_TIERS[Math.min(Math.max(greed, 0), GREED_TIERS.length - 1)];
}

/** Short label like "x1.8" used in HUD and extraction modal. */
export function greedLabel(greed: number): string {
  const t = greedTier(greed);
  return `x${t.rewardMult.toFixed(2)}`;
}
