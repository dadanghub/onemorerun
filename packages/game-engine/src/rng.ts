/**
 * Deterministic RNG so the server can re-run a dungeon with the same seed
 * and check that the client reported consistent outcomes.
 *
 * Mulberry32: 32-bit state, fast, good enough for game RNG. NOT for
 * cryptography.
 */
export class Rng {
  private state: number;
  constructor(seed: number) {
    // Force into uint32 range.
    this.state = (seed >>> 0) || 1;
  }
  /** [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, maxExclusive: number): number {
    return Math.floor(this.next() * (maxExclusive - min)) + min;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length)];
  }
  /** Weighted pick. `weights` need not be normalised. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

/** Hash a string into a 32-bit seed. */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
    return h >>> 0;
}

/** UTC date string "YYYY-MM-DD" → stable seed. */
export function dailySeed(date = new Date()): number {
  const s = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  return hashSeed(`OMR_DAILY_${s}`);
}
