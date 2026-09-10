/**
 * Enemy archetypes.
 *
 * The engine instantiates these with floor / Greed scaling. AI is intentionally
 * simple in the MVP: each archetype is a small state machine.
 */

export type EnemyId = 'skeleton' | 'archer' | 'slime' | 'charger' | 'necromancer';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  maxHp: number;
  attack: number;
  /** Pixels per second. */
  speed: number;
  /** Pixels (attack range). */
  range: number;
  /** Seconds between attacks. */
  attackCooldown: number;
  /** 'melee' | 'ranged' | 'summoner' | 'charger' */
  behavior: 'melee' | 'ranged' | 'summoner' | 'charger';
  /** Score reward (used for Reward Score, not Run Gold). */
  score: number;
  /** Gold drop. */
  gold: number;
  flavor: string;
}

export const ENEMIES: EnemyDef[] = [
  { id: 'skeleton',     name: 'Skeleton',     maxHp: 18,  attack: 5,  speed: 75,  range: 28,   attackCooldown: 1.1, behavior: 'melee',    score: 5,  gold: 8,   flavor: 'Clattering bones.' },
  { id: 'archer',       name: 'Archer',       maxHp: 12,  attack: 4,  speed: 55,  range: 240,  attackCooldown: 1.8, behavior: 'ranged',   score: 7,  gold: 12,  flavor: 'Loose, then loose again.' },
  { id: 'slime',        name: 'Slime',        maxHp: 28,  attack: 3,  speed: 40,  range: 24,   attackCooldown: 1.4, behavior: 'melee',    score: 6,  gold: 10,  flavor: 'It splits. Of course it does.' },
  { id: 'charger',      name: 'Charger',      maxHp: 24,  attack: 9,  speed: 125, range: 220,  attackCooldown: 2.4, behavior: 'charger',  score: 12, gold: 18,  flavor: 'It picks a moment. Then it commits.' },
  { id: 'necromancer',  name: 'Necromancer',  maxHp: 20,  attack: 0,  speed: 50,  range: 220,  attackCooldown: 3.2, behavior: 'summoner', score: 15, gold: 25,  flavor: 'The dead answer when it speaks.' },
];

export function scaleEnemy(def: EnemyDef, floor: number, greedEnemyMult: number) {
  const floorScale = 1 + (floor - 1) * 0.10;
  return {
    maxHp: Math.round(def.maxHp * floorScale * greedEnemyMult),
    attack: Math.round(def.attack * (1 + (floor - 1) * 0.06) * Math.sqrt(greedEnemyMult)),
    speed: def.speed,
    range: def.range,
    attackCooldown: Math.max(0.4, def.attackCooldown / (1 + (floor - 1) * 0.04)),
    score: Math.round(def.score * floorScale),
    gold: Math.round(def.gold * floorScale),
  };
}
