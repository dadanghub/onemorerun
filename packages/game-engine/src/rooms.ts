import {
  ROOM_TEMPLATES,
  type RoomSpec,
  type RoomType,
  biomeForGreed,
} from '@omr/shared';
import { Rng } from './rng';

export interface GenerateOptions {
  /** Length of the room sequence to pre-generate. */
  length: number;
  /** Master seed for the whole run. */
  seed: number;
  /** Current Greed level (affects elite weight, biome, portal frequency). */
  greed: number;
  /** After how many rooms the boss must appear. */
  bossEvery?: number;
}

const COMBAT = ['combat', 'combat', 'combat', 'elite', 'risk'];
const CHILL = ['treasure', 'merchant', 'healing', 'mystery'];

/**
 * Generate a deterministic room sequence. The server can re-run this
 * function with the same `seed` and Greed history to verify the client
 * reported rooms.
 */
export function generateRun(opts: GenerateOptions): RoomSpec[] {
  const rng = new Rng(opts.seed);
  const bossEvery = opts.bossEvery ?? 10;
  const rooms: RoomSpec[] = [];

  for (let i = 0; i < opts.length; i++) {
    const index = i + 1;
    const isExtraction = index % 5 === 0 && index < opts.length - 1;
    const isBoss = index % bossEvery === 0;

    let type: RoomType;
    if (isBoss) {
      type = 'boss';
    } else if (isExtraction) {
      type = 'extraction';
    } else {
      // Mix combat / chill weighted by greed (more elites at high greed).
      const eliteBoost = Math.min(0.45, 0.05 + opts.greed * 0.06);
      const combatWeight = 70;
      const chillWeight = 30;
      const eliteSpecial = eliteBoost * 100;
      const bucket = rng.next() * (combatWeight + chillWeight + eliteSpecial);
      if (bucket < combatWeight) {
        type = rng.weighted(COMBAT as RoomType[], [50, 30, 20, 25, 15]) as RoomType;
      } else if (bucket < combatWeight + chillWeight) {
        type = rng.pick(CHILL as RoomType[]);
      } else {
        type = 'elite';
      }
      // Floor gating.
      const def = ROOM_TEMPLATES.find(r => r.type === type)!;
      if (index < def.minFloor) type = 'combat';
    }

    const tpl = ROOM_TEMPLATES.find(r => r.type === type)!;
    rooms.push({
      index,
      floor: index,
      type,
      name: tpl.name,
      flavor: tpl.flavor,
      seed: rng.int(1, 2 ** 30),
      difficulty: 1 + (index - 1) * 0.08,
      biome: biomeForGreed(opts.greed),
    });
  }
  // Force last room to be boss or extraction.
  if (rooms.length > 0) {
    const last = rooms[rooms.length - 1];
    if (last.type !== 'boss' && last.type !== 'extraction') {
      last.type = 'boss';
      last.name = 'Boss';
    }
  }
  return rooms;
}

/** Pre-allocate enough rooms for a deep run. */
export function pregenerateRun(seed: number, greed: number, target = 30): RoomSpec[] {
  return generateRun({ length: target, seed, greed });
}
