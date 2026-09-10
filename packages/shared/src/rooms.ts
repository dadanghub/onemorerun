/**
 * Procedural dungeon room model.
 *
 * A run is a sequence of rooms. Each room has a `type` and a difficulty
 * scaling factor. The next room is picked with weighted randomness that
 * depends on floor number, Greed level, and what rooms have already been
 * shown.
 */

export type RoomType =
  | 'combat'
  | 'treasure'
  | 'merchant'
  | 'elite'
  | 'mystery'
  | 'risk'
  | 'healing'
  | 'challenge'
  | 'boss'
  | 'extraction';

export interface RoomTemplate {
  type: RoomType;
  /** Display name in HUD. */
  name: string;
  /** Minimum floor on which this room can appear. */
  minFloor: number;
  /** Base weight before Greed modifiers. */
  weight: number;
  /** Whether this room is a candidate for the "forced" extraction slot. */
  canBeExtraction: boolean;
  /** Short description. */
  flavor: string;
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  { type: 'combat',     name: 'Combat',     minFloor: 1, weight: 40, canBeExtraction: false, flavor: 'Skulks of bone and rot.' },
  { type: 'treasure',   name: 'Treasure',   minFloor: 1, weight: 12, canBeExtraction: false, flavor: 'Something glints in the dark.' },
  { type: 'merchant',   name: 'Merchant',   minFloor: 2, weight: 6,  canBeExtraction: false, flavor: 'A figure in a hooded cloak.' },
  { type: 'elite',      name: 'Elite',      minFloor: 3, weight: 8,  canBeExtraction: false, flavor: 'A champion guards this room.' },
  { type: 'mystery',    name: 'Mystery',    minFloor: 1, weight: 8,  canBeExtraction: false, flavor: 'A choice. Always a choice.' },
  { type: 'risk',       name: 'Risk',       minFloor: 2, weight: 6,  canBeExtraction: false, flavor: 'High risk. High gold.' },
  { type: 'healing',    name: 'Shrine',     minFloor: 1, weight: 7,  canBeExtraction: false, flavor: 'A small mercy.' },
  { type: 'challenge',  name: 'Challenge',  minFloor: 2, weight: 6,  canBeExtraction: false, flavor: 'Beat the clock. Beat them all.' },
  { type: 'boss',       name: 'Boss',       minFloor: 5, weight: 0,  canBeExtraction: false, flavor: 'The Collector awaits.' },
  { type: 'extraction', name: 'Extraction', minFloor: 1, weight: 0,  canBeExtraction: true,  flavor: 'A portal of warm, golden light.' },
];

export interface RoomSpec {
  index: number;     // 1-based room index in the run
  floor: number;     // 1-based floor (= index in MVP, but room for biomes)
  type: RoomType;
  name: string;
  flavor: string;
  /** Server-issued seed for any RNG used inside this room. */
  seed: number;
  /** 1.0 baseline; scales rewards and difficulty within the room. */
  difficulty: number;
  /** Visual palette hint (biome). For MVP: 'crypt'. */
  biome: 'crypt' | 'corrupted';
}

/** Cosmetic palette tweak for high Greed. */
export function biomeForGreed(greed: number): 'crypt' | 'corrupted' {
  return greed >= 4 ? 'corrupted' : 'crypt';
}
