/**
 * Relic system.
 *
 * Relics are data-defined. Each relic has a list of `tags` and one or more
 * `effects`. Effects are simple stat modifiers and triggers. Synergies
 * emerge from overlapping tags (e.g. CRIT + LIFESTEAL).
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'cursed';

export type RelicTag =
  | 'CRIT' | 'LIFESTEAL' | 'ATTACK_SPEED' | 'DAMAGE'
  | 'GOLD' | 'DODGE' | 'PROJECTILE' | 'CHAIN' | 'LIGHTNING'
  | 'SHIELD' | 'REGEN' | 'CURSE';

export interface RelicEffect {
  /** Which stat this effect targets. */
  stat?:
    | 'maxHp' | 'attack' | 'attackSpeed' | 'critChance' | 'moveSpeed' | 'dodge' | 'goldMult' | 'damageTakenMult';
  /** Additive modifier, e.g. +0.25 means +25%. */
  add?: number;
  /** Multiplicative modifier, e.g. 1.75 means x1.75. */
  mul?: number;
  /** Trigger key (e.g. 'onCritHeal', 'everyFifthHitChainLightning'). */
  trigger?: string;
  /** Numeric argument for the trigger, e.g. 0.1 (10% heal). */
  value?: number;
}

export interface RelicDef {
  id: string;
  name: string;
  rarity: Rarity;
  tags: RelicTag[];
  effects: RelicEffect[];
  flavor: string;
}

export const RELICS: RelicDef[] = [
  { id: 'blood_fang',       name: 'Blood Fang',       rarity: 'rare',     tags: ['CRIT', 'LIFESTEAL'],          effects: [{ trigger: 'onCritHeal', value: 0.10 }], flavor: 'Every crit tastes iron.' },
  { id: 'storm_ring',       name: 'Storm Ring',       rarity: 'epic',     tags: ['ATTACK_SPEED', 'CHAIN', 'LIGHTNING'], effects: [{ trigger: 'everyFifthHitChainLightning', value: 3 }], flavor: 'Thunder walks with you.' },
  { id: 'phantom_cloak',    name: 'Phantom Cloak',    rarity: 'rare',     tags: ['DODGE'],                    effects: [{ trigger: 'onDodgeInvisible', value: 0.7 }], flavor: 'Vanish. Strike. Vanish again.' },
  { id: 'golden_heart',     name: 'Golden Heart',     rarity: 'uncommon', tags: ['GOLD'],                     effects: [{ stat: 'goldMult', mul: 1.25 }, { stat: 'damageTakenMult', mul: 1.10 }], flavor: 'Heavy. Warm. Hungry.' },
  { id: 'glass_cannon',     name: 'Glass Cannon',     rarity: 'cursed',   tags: ['DAMAGE', 'CURSE'],           effects: [{ stat: 'attack', mul: 1.75 }, { stat: 'maxHp', mul: 0.60 }], flavor: 'More. More. More. Until there is none.' },
  { id: 'cursed_crown',     name: 'Cursed Crown',     rarity: 'cursed',   tags: ['GOLD', 'CURSE'],             effects: [{ stat: 'goldMult', mul: 2.0 }, { stat: 'damageTakenMult', mul: 1.30 }, { stat: 'attackSpeed', mul: 1.20 }], flavor: 'Power is just fear with better lighting.' },
  { id: 'iron_skin',        name: 'Iron Skin',        rarity: 'common',   tags: ['SHIELD'],                   effects: [{ stat: 'maxHp', add: 25 }], flavor: 'You stop flinching.' },
  { id: 'swift_boots',      name: 'Swift Boots',      rarity: 'common',   tags: ['DODGE'],                    effects: [{ stat: 'moveSpeed', add: 40 }], flavor: 'Light feet, longer life.' },
  { id: 'raging_heart',     name: 'Raging Heart',     rarity: 'uncommon', tags: ['ATTACK_SPEED'],             effects: [{ stat: 'attackSpeed', mul: 1.20 }], flavor: 'Faster. Harder.' },
  { id: 'vampire_fang',     name: 'Vampire Fang',     rarity: 'epic',     tags: ['LIFESTEAL'],                effects: [{ trigger: 'onHitHeal', value: 0.03 }], flavor: 'A little sip each time.' },
  { id: 'thunder_gauntlet', name: 'Thunder Gauntlet', rarity: 'rare',     tags: ['CHAIN', 'LIGHTNING'],       effects: [{ trigger: 'onHitChainLightning', value: 2 }], flavor: 'Snap, crackle, drop.' },
  { id: 'eagle_eye',        name: "Eagle's Eye",      rarity: 'uncommon', tags: ['CRIT'],                     effects: [{ stat: 'critChance', add: 0.10 }], flavor: 'You see it before it happens.' },
  { id: 'soul_lantern',     name: 'Soul Lantern',     rarity: 'common',   tags: ['REGEN'],                    effects: [{ trigger: 'regenPerSec', value: 1 }], flavor: 'A warm glow follows you.' },
  { id: 'blood_pact',       name: 'Blood Pact',       rarity: 'rare',     tags: ['CRIT', 'LIFESTEAL'],        effects: [{ stat: 'critChance', add: 0.15 }, { trigger: 'onCritHeal', value: 0.05 }], flavor: 'Trade certainty for carnage.' },
  { id: 'midas_glove',      name: "Midas's Glove",    rarity: 'epic',     tags: ['GOLD'],                     effects: [{ stat: 'goldMult', mul: 1.6 }], flavor: 'Even the dust turns to coin.' },
  { id: 'mirror_shield',    name: 'Mirror Shield',    rarity: 'epic',     tags: ['SHIELD', 'DODGE'],          effects: [{ stat: 'dodge', add: 0.10 }, { stat: 'maxHp', add: 15 }], flavor: 'Glance away. Live longer.' },
  { id: 'reaper_signet',    name: 'Reaper Signet',    rarity: 'legendary',tags: ['CRIT', 'DAMAGE'],           effects: [{ stat: 'critChance', add: 0.20 }, { stat: 'attack', mul: 1.35 }], flavor: 'You hear it hum your name.' },
  { id: 'phoenix_feather',  name: 'Phoenix Feather',  rarity: 'legendary',tags: ['REGEN', 'SHIELD'],         effects: [{ trigger: 'oncePerRunRevive', value: 0.30 }], flavor: 'Once. Just once.' },
  { id: 'sapper_ring',      name: 'Sapper Ring',      rarity: 'rare',     tags: ['PROJECTILE'],               effects: [{ trigger: 'extraProjectile', value: 1 }], flavor: 'Two where there was one.' },
  { id: 'chaos_charm',      name: 'Chaos Charm',      rarity: 'cursed',   tags: ['CURSE', 'DAMAGE'],          effects: [{ stat: 'attack', mul: 1.5 }, { stat: 'dodge', add: -0.05 }], flavor: 'It bites. You bite back.' },
];
