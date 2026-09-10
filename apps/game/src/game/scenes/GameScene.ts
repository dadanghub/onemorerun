import Phaser from 'phaser';
import { pregenerateRun } from '@omr/game-engine';
import { Rng } from '@omr/game-engine';
import { ENEMIES, scaleEnemy, greedTier, type EnemyId, RELICS, type RelicDef, type RoomSpec, type RoomType, greedLabel } from '@omr/shared';
import { GAME_W, GAME_H, TILE } from '../main';

/**
 * Visual weapon tiers. As the player's attack stat climbs, the
 * projectile becomes visibly larger, brighter, and trails a longer
 * streak. This is the "gun upgrade" feedback.
 *
 * Each tier has a minimum attack stat; the highest matching tier wins.
 */
interface WeaponTier {
  name: string;
  minAttack: number;
  size: number;          // projectile scale
  color: number;         // tint
  trailLength: number;   // number of after-images per shot
  trailAlpha: number;    // 0..1
  glow: number;          // outer alpha (0 = no glow)
}
const WEAPON_TIERS: WeaponTier[] = [
  { name: 'Bone',       minAttack:   0, size: 1.0, color: 0xffb347, trailLength: 0, trailAlpha: 0,   glow: 0    },
  { name: 'Iron',       minAttack:  28, size: 1.1, color: 0xc8b790, trailLength: 1, trailAlpha: 0.4, glow: 0    },
  { name: 'Steel',      minAttack:  42, size: 1.2, color: 0xe8e8ee, trailLength: 2, trailAlpha: 0.5, glow: 0.2  },
  { name: 'Silver',     minAttack:  60, size: 1.3, color: 0x5fb6ff, trailLength: 3, trailAlpha: 0.6, glow: 0.35 },
  { name: 'Gold',       minAttack:  85, size: 1.5, color: 0xffb347, trailLength: 4, trailAlpha: 0.7, glow: 0.5  },
  { name: 'Mythic',     minAttack: 120, size: 1.7, color: 0xb86bff, trailLength: 5, trailAlpha: 0.8, glow: 0.65 },
  { name: 'Legendary',  minAttack: 170, size: 2.0, color: 0xff8a1a, trailLength: 6, trailAlpha: 0.9, glow: 0.8  },
];
function tierForAttack(atk: number): WeaponTier {
  let chosen = WEAPON_TIERS[0];
  for (const t of WEAPON_TIERS) {
    if (atk >= t.minAttack) chosen = t;
  }
  return chosen;
}

/**
 * Game state shared with the React UI.
 * Mutations to this object are picked up by the UI scene each frame.
 */
export interface GameUiState {
  hp: number;
  maxHp: number;
  runGold: number;
  floor: number;
  roomIndex: number;
  greed: number;
  greedMult: string;
  rewardScore: number;
  enemiesKilled: number;
  bossesKilled: number;
  relics: RelicDef[];
  status:
    | 'menu'
    | 'playing'
    | 'room_cleared'
    | 'extraction'
    | 'cashed_out'
    | 'died'
    | 'paused';
  currentRoomType: RoomType | '';
  currentRoomName: string;
  wallet: { address: string; chainId: number } | null;
  toasts: Array<{ id: number; text: string; color: string; ts: number }>;
  flash: { color: string; ts: number } | null;
  shake: number;
  paused: boolean;
  rooms: RoomSpec[];
  corruption: 0 | 1 | 2 | 3;
  startedAt: number;
  endedAt: number;
  potentialReward: number;
  /** Last room summary (for the room_cleared interstitial). */
  lastRoomSummary: {
    name: string;
    index: number;
    enemiesKilledInRoom: number;
    goldLootedInRoom: number;
    relicsFoundInRoom: number;
  } | null;
  /** Live combat stats for the HUD. */
  combat: {
    attack: number;
    attackSpeed: number;
    critChance: number;
    moveSpeed: number;
    dodge: number;
    /** 0..6 visual weapon tier, derived from attack power. */
    weaponTier: number;
    /** Color hint for the projectile (matches weapon tier). */
    projectileColor: number;
  };
}

export class GameScene extends Phaser.Scene {
  // --- state
  uiState!: GameUiState;
  private runSeed = 0;
  private rooms: RoomSpec[] = [];
  private roomIndex = 0;
  private greed = 0;

  // --- gameplay
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private pointer!: Phaser.Input.Pointer;
  private mouseDown = false;
  private dodgeCooldown = 0;
  private iFrameUntil = 0;
  private attackCooldown = 0;
  private facing = new Phaser.Math.Vector2(1, 0);

  // --- room contents
  private enemies!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private playerProjectiles!: Phaser.Physics.Arcade.Group;
  private loot!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private portal: Phaser.Physics.Arcade.Sprite | null = null;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private damageNumbers!: Phaser.GameObjects.Container;

  // --- effects
  private vignette!: Phaser.GameObjects.Rectangle;
  private bgOverlay!: Phaser.GameObjects.Rectangle;

  // --- per-room stats (for room_cleared summary)
  private roomEnemiesKilled = 0;
  private roomGoldLooted = 0;
  private roomRelicsFound = 0;

  // --- the "exit" arrow that appears when the room is won
  private exitArrow: Phaser.GameObjects.Container | null = null;

  constructor() { super('Game'); }

  init() {
    this.uiState = {
      hp: 100,
      maxHp: 100,
      runGold: 0,
      floor: 0,
      roomIndex: 0,
      greed: 0,
      greedMult: 'x1.00',
      rewardScore: 0,
      enemiesKilled: 0,
      bossesKilled: 0,
      relics: [],
      status: 'menu',
      currentRoomType: '',
      currentRoomName: '',
      wallet: null,
      toasts: [],
      flash: null,
      shake: 0,
      paused: false,
      rooms: [],
      corruption: 0,
      startedAt: 0,
      endedAt: 0,
      potentialReward: 0,
      lastRoomSummary: null,
      combat: { attack: 22, attackSpeed: 1.8, critChance: 0.10, moveSpeed: 200, dodge: 0.10, weaponTier: 0, projectileColor: 0xffb347 },
    };
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  create() {
    // --- Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyW = this.input.keyboard!.addKey('W');
    this.keyA = this.input.keyboard!.addKey('A');
    this.keyS = this.input.keyboard!.addKey('S');
    this.keyD = this.input.keyboard!.addKey('D');
    this.keySpace = this.input.keyboard!.addKey('SPACE');
    this.keyE = this.input.keyboard!.addKey('E');
    this.pointer = this.input.activePointer;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown()) this.mouseDown = true;
    });
    this.input.on('pointerup', () => { this.mouseDown = false; });

    // --- Groups
    this.walls = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.playerProjectiles = this.physics.add.group();
    this.loot = this.physics.add.group();
    this.pickups = this.physics.add.group();

    // --- Visual layers
    this.bgOverlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.0)
      .setDepth(-2);
    this.vignette = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0)
      .setDepth(900)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.damageNumbers = this.add.container(0, 0).setDepth(800);

    // --- Camera
    this.cameras.main.setBackgroundColor('#07080f');

    // --- World event
    this.events.on('startRun', this.startRun, this);
    this.events.on('cashOut', () => this.cashOut(), this);
    this.events.on('oneMoreRoom', () => this.oneMoreRoom(), this);
    this.events.on('continueToNextRoom', () => this.continueToNextRoom(), this);
    this.events.on('setPaused', (p: boolean) => { this.uiState.paused = p; }, this);
    this.events.on('togglePause', () => this.togglePause(), this);

    // --- ESC handled inside Phaser so it works even when the canvas has focus.
    // The keyboard plugin is driven by the global input manager, not the
    // scene's update loop, so this listener fires even when the scene is
    // paused (which is exactly what we need for "ESC resumes the game").
    this.input.keyboard!.on('keydown-ESC', () => {
      this.togglePause();
    });

    // --- Launch UI scene
    this.scene.launch('UI');

    // --- Initial idle frame: just draw the menu backdrop
    this.drawMenuBackdrop();
  }

  private drawMenuBackdrop() {
    this.add.text(GAME_W / 2, GAME_H / 2 - 60, 'ONE MORE RUN', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '52px',
      color: '#fff5dc',
      stroke: '#ffb347',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(10);
    this.add.text(GAME_W / 2, GAME_H / 2 + 0, 'HOW  GREEDY  ARE  YOU?', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '14px',
      color: '#c8b790',
    }).setOrigin(0.5).setDepth(10);
  }

  // ---------------------------------------------------------------------------
  // RUN START
  // ---------------------------------------------------------------------------

  startRun(seed?: number) {
    this.runSeed = seed ?? Math.floor(Math.random() * 2 ** 30);
    this.rooms = pregenerateRun(this.runSeed, 0, 30);
    this.roomIndex = 0;
    this.greed = 0;
    this.uiState.relics = [];
    this.uiState.runGold = 0;
    this.uiState.rewardScore = 0;
    this.uiState.enemiesKilled = 0;
    this.uiState.bossesKilled = 0;
    this.uiState.rooms = this.rooms.slice();
    this.uiState.startedAt = Date.now();
    this.uiState.endedAt = 0;
    this.uiState.status = 'playing';

    // Build player if first run
    if (!this.player) {
      this.player = this.physics.add.sprite(GAME_W / 2, GAME_H / 2, 'player');
      this.player.setCollideWorldBounds(true);
      this.player.setDepth(50);
    } else {
      this.player.setPosition(GAME_W / 2, GAME_H / 2);
      this.player.setActive(true).setVisible(true);
    }
    this.playerStats = this.baseStats();

    this.uiState.hp = this.playerStats.maxHp;
    this.uiState.maxHp = this.playerStats.maxHp;
    this.syncCombatToUi();

    // Clear leftovers
    this.enemies.clear(true, true);
    this.projectiles.clear(true, true);
    this.playerProjectiles.clear(true, true);
    this.loot.clear(true, true);
    this.pickups.clear(true, true);
    this.damageNumbers.removeAll(true);

    // Hide menu backdrop if present
    this.children.list
      .filter(c => c instanceof Phaser.GameObjects.Text && (c.text === 'ONE MORE RUN' || c.text === 'HOW  GREEDY  ARE  YOU?'))
      .forEach(c => c.destroy());

    this.advanceRoom();
  }

  // Player stats, mutated by relics.
  private baseStats() {
    return {
      maxHp: 100,
      attack: 22,
      attackSpeed: 1.8,           // attacks per second
      critChance: 0.10,
      moveSpeed: 200,
      dodge: 0.10,
      goldMult: 1.0,
      damageTakenMult: 1.0,
      // triggers
      onCritHeal: 0,
      onHitHeal: 0,
      onDodgeInvisible: 0,
      onHitChainLightning: 0,
      everyFifthHitChainLightning: 0,
      regenPerSec: 0,
      oncePerRunRevive: 0,
      extraProjectile: 0,
    };
  }
  private playerStats = this.baseStats();
  private hitCounter = 0;
  private hasRevivedThisRun = false;
  private regenAccum = 0;
  private attackHits: number[] = []; // timestamps of recent attacks for chain trigger

  // ---------------------------------------------------------------------------
  // ROOMS
  // ---------------------------------------------------------------------------

  advanceRoom() {
    if (this.roomIndex >= this.rooms.length) {
      this.rooms = pregenerateRun(this.runSeed, this.greed, this.rooms.length + 20);
      this.uiState.rooms = this.rooms.slice();
    }
    const room = this.rooms[this.roomIndex];
    this.roomIndex++;
    this.uiState.roomIndex = this.roomIndex;
    this.uiState.floor = room.floor;
    this.uiState.currentRoomType = room.type;
    this.uiState.currentRoomName = `${room.index}. ${room.name}`;
    this.uiState.greed = this.greed;
    this.uiState.greedMult = greedLabel(this.greed);
    const tier = greedTier(this.greed);
    this.uiState.corruption = tier.corruption;
    this.bgOverlay.setFillStyle(0x000000, 0.0);

    // Clear previous room
    this.enemies.clear(true, true);
    this.projectiles.clear(true, true);
    this.playerProjectiles.clear(true, true);
    this.loot.clear(true, true);
    this.pickups.clear(true, true);
    this.damageNumbers.removeAll(true);
    if (this.portal) { this.portal.destroy(); this.portal = null; }
    this.walls.clear();

    this.buildRoom(room);
    this.populateRoom(room);

    // reset per-room counters for the next room_cleared summary
    this.roomEnemiesKilled = 0;
    this.roomGoldLooted = 0;
    this.roomRelicsFound = 0;
    this.uiState.lastRoomSummary = null;
    this.hideExitArrow();

    this.toast(`${room.name} — Floor ${room.floor}`, room.type === 'boss' ? '#ff6b1a' : '#c8b790');
  }

  private buildRoom(room: RoomSpec) {
    const w = Math.floor(GAME_W / TILE);
    const h = Math.floor(GAME_H / TILE);
    const corrupt = room.biome === 'corrupted';
    const floorTex = corrupt ? 'tile_floor_corrupt' : 'tile_floor';
    const wallTex = corrupt ? 'tile_wall_corrupt' : 'tile_wall';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const isBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        if (isBorder) {
          const wall = this.walls.create(x * TILE + TILE / 2, y * TILE + TILE / 2, wallTex) as Phaser.Physics.Arcade.Image;
          wall.setImmovable(true).setDepth(2);
        } else {
          this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, floorTex).setDepth(0);
          if (Math.random() < 0.05 && !corrupt) {
            this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, 'tile_crack').setDepth(1).setAlpha(0.6);
          }
        }
      }
    }
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.projectiles, this.walls, (p) => (p as Phaser.Physics.Arcade.Sprite).destroy());
    this.physics.add.collider(this.playerProjectiles, this.walls, (p) => (p as Phaser.Physics.Arcade.Sprite).destroy());
  }

  private populateRoom(room: RoomSpec) {
    const rng = new Rng(room.seed);
    const tier = greedTier(this.greed);

    switch (room.type) {
      case 'combat': {
        const count = 3 + Math.floor(rng.next() * 3) + Math.floor(this.greed / 2);
        for (let i = 0; i < count; i++) this.spawnEnemy(rng, false);
        break;
      }
      case 'elite': {
        for (let i = 0; i < 2; i++) this.spawnEnemy(rng, true);
        break;
      }
      case 'boss': {
        this.spawnBoss(room);
        break;
      }
      case 'treasure': {
        const chest = this.physics.add.sprite(GAME_W / 2, GAME_H / 2, 'loot_chest');
        chest.setDepth(20);
        chest.setData('kind', 'chest');
        this.pickups.add(chest);
        this.physics.add.overlap(this.player, chest, () => this.openChest(chest));
        break;
      }
      case 'merchant': {
        // simple gold-for-relic swap: drop 2 relics, take gold
        for (let i = 0; i < 2; i++) {
          const r = this.pickRandomRelic(rng, room.floor);
          this.dropRelicPickup(GAME_W / 2 - 60 + i * 80, GAME_H / 2 - 60, r);
        }
        this.dropGold(200 + Math.floor(rng.next() * 200));
        this.toast('A merchant appears. Free samples today.', '#c8b790');
        break;
      }
      case 'healing': {
        const shrine = this.physics.add.sprite(GAME_W / 2, GAME_H / 2, 'shrine');
        shrine.setDepth(20);
        shrine.setData('kind', 'shrine');
        this.pickups.add(shrine);
        this.physics.add.overlap(this.player, shrine, () => this.useShrine(shrine));
        break;
      }
      case 'mystery': {
        this.runMysteryEvent(rng, room);
        break;
      }
      case 'risk': {
        // mix of treasure + combat
        for (let i = 0; i < 3; i++) this.spawnEnemy(rng, false);
        this.dropGold(300 + Math.floor(rng.next() * 200));
        this.toast('High risk. High gold.', '#ffb347');
        break;
      }
      case 'challenge': {
        // 5 enemies, lots of gold if you clear fast
        for (let i = 0; i < 5; i++) this.spawnEnemy(rng, true);
        this.toast('Challenge room. Clear them all.', '#ff6b1a');
        break;
      }
      case 'extraction': {
        this.spawnPortal();
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // ENEMIES
  // ---------------------------------------------------------------------------

  private spawnEnemy(rng: Rng, elite: boolean) {
    const defId: EnemyId = (['skeleton', 'archer', 'slime', 'charger', 'necromancer'] as EnemyId[])[rng.int(0, 5)];
    const def = ENEMIES.find(e => e.id === defId)!;
    const tier = greedTier(this.greed);
    const stats = scaleEnemy(def, this.rooms[this.roomIndex - 1].floor, tier.enemyMult);
    const eliteMult = elite ? 1.8 : 1.0;

    // spawn off-screen or near a corner
    const angle = rng.next() * Math.PI * 2;
    const r = 280 + rng.next() * 80;
    const x = GAME_W / 2 + Math.cos(angle) * r;
    const y = GAME_H / 2 + Math.sin(angle) * r;
    const e = this.physics.add.sprite(x, y, `enemy_${defId}`);
    e.setDepth(30);
    e.setData('def', def);
    e.setData('hp', Math.round(stats.maxHp * eliteMult));
    e.setData('maxHp', Math.round(stats.maxHp * eliteMult));
    e.setData('attack', Math.round(stats.attack * eliteMult));
    e.setData('cooldown', 0);
    e.setData('gold', Math.round(stats.gold * eliteMult * this.playerStats.goldMult));
    e.setData('score', Math.round(stats.score * eliteMult));
    e.setData('elite', elite);
    e.setData('flash', 0);
    e.setData('behavior', def.behavior);
    e.setData('chargeT', 0);
    e.setData('chargeDir', new Phaser.Math.Vector2(1, 0));
    e.setData('summonT', 0);
    e.setData('rng', rng);
    if (elite) {
      e.setTint(0xffb347);
      e.setScale(1.15);
    }
    this.enemies.add(e);
  }

  private spawnBoss(room: RoomSpec) {
    const boss = this.physics.add.sprite(GAME_W / 2, GAME_H / 2 - 60, 'enemy_boss');
    boss.setDepth(40);
    const tier = greedTier(this.greed);
    const hp = Math.round(180 * (1 + (room.floor - 1) * 0.10) * tier.enemyMult);
    boss.setData('def', { id: 'necromancer', name: 'The Collector', maxHp: hp, attack: 12, speed: 80, range: 280, attackCooldown: 2.0, behavior: 'summoner', score: 200, gold: 500, flavor: '' });
    boss.setData('hp', hp);
    boss.setData('maxHp', hp);
    boss.setData('attack', 14);
    boss.setData('cooldown', 0);
    boss.setData('gold', 500);
    boss.setData('score', 200);
    boss.setData('elite', false);
    boss.setData('flash', 0);
    boss.setData('behavior', 'boss');
    boss.setData('chargeT', 0);
    boss.setData('chargeDir', new Phaser.Math.Vector2(1, 0));
    boss.setData('summonT', 0);
    boss.setData('rng', new Rng(room.seed));
    boss.setData('isBoss', true);
    boss.setData('goldStolen', 0);
    this.enemies.add(boss);
    this.toast('THE COLLECTOR AWAKENS', '#ff6b1a');
  }

  // ---------------------------------------------------------------------------
  // PORTAL
  // ---------------------------------------------------------------------------

  private spawnPortal() {
    const p = this.physics.add.sprite(GAME_W - 100, GAME_H / 2, 'portal');
    p.setDepth(20);
    p.setData('kind', 'portal');
    this.portal = p;
    this.physics.add.overlap(this.player, p, () => this.reachPortal());
    this.tweens.add({
      targets: p,
      y: GAME_H / 2 + Math.sin(0) * 8,
      yoyo: true,
      duration: 1200,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.toast('EXTRACTION PORTAL DETECTED', '#ffb347');
  }

  private reachPortal() {
    if (this.uiState.status !== 'playing') return;
    this.uiState.status = 'extraction';
    this.computePotentialReward();
    this.toast('EXTRACTION AVAILABLE', '#ffb347');
  }

  private computePotentialReward() {
    // Mirror the server formula approximately (server is authoritative).
    const s = this.uiState;
    let score = 0;
    score += s.floor * 1.0;
    score += s.enemiesKilled * 0.6;
    score += s.bossesKilled * 25;
    const tier = greedTier(this.greed);
    score *= tier.scoreMult;
    s.rewardScore = Math.round(score);
    s.potentialReward = Math.max(0, Math.floor((score / 10) * tier.rewardMult * 100) / 100);
  }

  private cashOut() {
    this.uiState.status = 'cashed_out';
    this.uiState.endedAt = Date.now();
    this.computePotentialReward();
    this.toast(`CASHED OUT — ${this.uiState.potentialReward.toFixed(2)} OMR`, '#4ade80');
  }

  private oneMoreRoom() {
    this.greed++;
    this.uiState.greed = this.greed;
    this.uiState.greedMult = greedLabel(this.greed);
    const tier = greedTier(this.greed);
    this.uiState.corruption = tier.corruption;
    this.bgOverlay.setFillStyle(0x5a1a14, 0.05 + tier.corruption * 0.05);
    this.toast(`ONE MORE ROOM — Greed ${greedLabel(this.greed)}`, '#ff6b1a');
    this.shake(8);
    this.advanceRoom();
  }

  /**
   * Show a "Room Cleared" interstitial so the player gets a beat between
   * rooms. The React UI renders a CONTINUE button (and an AUTO timer).
   * Only triggers once per room.
   *
   * Triggers as soon as enemies are dead — the player doesn't have to
   * chase every gold pile to leave. Loot on the ground is auto-collected
   * by magnetToPlayer() so the player keeps their rewards.
   */
  private showRoomCleared() {
    if (this.uiState.status !== 'playing') return;
    // Auto-collect remaining loot so nothing is left behind.
    this.magnetToPlayer();
    this.uiState.status = 'room_cleared';
    this.uiState.lastRoomSummary = {
      name: this.uiState.currentRoomName,
      index: this.uiState.roomIndex,
      enemiesKilledInRoom: this.roomEnemiesKilled,
      goldLootedInRoom: this.roomGoldLooted,
      relicsFoundInRoom: this.roomRelicsFound,
    };
    this.toast('ROOM CLEARED', '#4ade80');
  }

  /**
   * Pull all loose loot toward the player and auto-collect it. Called
   * when the room is cleared so the player doesn't have to chase gold.
   */
  private magnetToPlayer() {
    for (const item of this.loot.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (!item.active) continue;
      // Give it a velocity toward the player; collision will pick it up.
      const dx = this.player.x - item.x;
      const dy = this.player.y - item.y;
      const len = Math.hypot(dx, dy) || 1;
      item.setVelocity((dx / len) * 400, (dy / len) * 400);
    }
  }

  /**
   * Show a pulsing "EXIT →" arrow on the right edge of the room.
   * Tells the player the room is won and how to leave.
   */
  private showExitArrow() {
    if (this.exitArrow) return;
    const cx = GAME_W - 60;
    const cy = GAME_H / 2;
    const container = this.add.container(cx, cy).setDepth(45);
    // Outer halo
    const halo = this.add.circle(0, 0, 28, 0xffb347, 0.18);
    // Inner ring
    const ring = this.add.circle(0, 0, 18, 0x000000, 0).setStrokeStyle(2, 0xffb347, 0.9);
    // Arrow chevron
    const arrow = this.add.text(0, 0, '▶', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '20px',
      color: '#ffb347',
    }).setOrigin(0.5);
    const label = this.add.text(0, 30, 'EXIT', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '10px',
      color: '#ffb347',
    }).setOrigin(0.5);
    container.add([halo, ring, arrow, label]);
    // Pulse animation
    this.tweens.add({
      targets: [halo, ring],
      scaleX: 1.25, scaleY: 1.25,
      alpha: 0.05,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: arrow,
      x: 4,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.exitArrow = container;
  }

  private hideExitArrow() {
    if (!this.exitArrow) return;
    this.exitArrow.destroy();
    this.exitArrow = null;
  }

  /** Player clicked CONTINUE on the room_cleared interstitial. */
  private continueToNextRoom() {
    if (this.uiState.status !== 'room_cleared') return;
    this.advanceRoom();
    this.uiState.status = 'playing';
  }

  /**
   * Toggle pause. Toggles the Phaser scene pause and the uiState flag so
   * the React overlay can show. ESC is wired in create().
   *
   * We remember the pre-pause status so unpausing restores the right
   * game state (playing, extraction, room_cleared, etc.).
   */
  private prePauseStatus: GameUiState['status'] = 'playing';
  private togglePause() {
    if (this.uiState.status === 'paused') {
      // resume
      this.uiState.status = this.prePauseStatus;
      this.uiState.paused = false;
      this.scene.resume();
      this.events.emit('pauseChanged', false);
    } else {
      this.prePauseStatus = this.uiState.status;
      this.uiState.status = 'paused';
      this.uiState.paused = true;
      this.scene.pause();
      this.events.emit('pauseChanged', true);
    }
  }

  // ---------------------------------------------------------------------------
  // COMBAT
  // ---------------------------------------------------------------------------

  private firePlayerAttack(time: number) {
    if (this.attackCooldown > time) return;
    const dir = new Phaser.Math.Vector2(
      this.pointer.worldX - this.player.x,
      this.pointer.worldY - this.player.y
    );
    if (dir.lengthSq() < 1) return;
    dir.normalize();
    this.facing = dir;

    const stats = this.playerStats;
    const baseCooldown = 1000 / stats.attackSpeed;
    this.attackCooldown = time + baseCooldown;
    this.hitCounter++;

    const tier = tierForAttack(stats.attack);
    const projCount = 1 + (stats.extraProjectile | 0);
    // Projectiles get faster with higher tiers so the gun feels punchier.
    const projSpeed = 620 + tier.trailLength * 30;
    for (let i = 0; i < projCount; i++) {
      const spread = (i - (projCount - 1) / 2) * 0.1;
      const angle = Math.atan2(dir.y, dir.x) + spread;
      const vx = Math.cos(angle) * projSpeed;
      const vy = Math.sin(angle) * projSpeed;
      const p = this.playerProjectiles.create(this.player.x, this.player.y, 'proj_bone') as Phaser.Physics.Arcade.Image;
      p.setDepth(40);
      p.setTint(tier.color);
      p.setScale(tier.size);
      p.setData('damage', stats.attack);
      p.setData('critChance', stats.critChance);
      p.setData('life', 700);
      p.setData('tier', this.uiState.combat.weaponTier);
      p.setVelocity(vx, vy);
      p.body!.setSize(8 * tier.size, 8 * tier.size);
      // Outer glow sprite, only at higher tiers.
      if (tier.glow > 0) {
        const glow = this.add.circle(p.x, p.y, 10 * tier.size, tier.color, tier.glow * 0.4)
          .setDepth(39);
        this.tweens.add({ targets: glow, alpha: 0, duration: 220, onUpdate: () => {
          if (p.active) glow.setPosition(p.x, p.y);
        }, onComplete: () => glow.destroy() });
      }
    }

    // Trigger: every 5th attack chain lightning
    this.attackHits.push(time);
    this.attackHits = this.attackHits.filter(t => t > time - 1000);
    if (stats.everyFifthHitChainLightning > 0 && this.hitCounter % 5 === 0) {
      this.castChainLightning();
    }

    // Muzzle flash on the player facing the cursor direction.
    this.spawnMuzzleFlash(dir, tier);
  }

  private spawnMuzzleFlash(dir: Phaser.Math.Vector2, tier: ReturnType<typeof tierForAttack>) {
    const px = this.player.x + dir.x * 14;
    const py = this.player.y + dir.y * 14;
    const flash = this.add.circle(px, py, 4 + tier.size * 2, tier.color, 0.8).setDepth(45);
    this.tweens.add({
      targets: flash,
      alpha: 0, scaleX: 2, scaleY: 2, duration: 120,
      onComplete: () => flash.destroy(),
    });
  }

  private castChainLightning() {
    const targets = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    if (targets.length === 0) return;
    targets.sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y));
    let prev: { x: number; y: number } = { x: this.player.x, y: this.player.y };
    const dmg = Math.round(this.playerStats.attack * 0.6);
    const hits = Math.min(3, targets.length);
    for (let i = 0; i < hits; i++) {
      const t = targets[i];
      this.drawLightning(prev.x, prev.y, t.x, t.y, 0xb86bff);
      this.hitEnemy(t, dmg, false, 0);
      prev = { x: t.x, y: t.y };
    }
  }

  private drawLightning(x1: number, y1: number, x2: number, y2: number, color: number) {
    const g = this.add.graphics().setDepth(60);
    g.lineStyle(2, color, 1);
    g.beginPath();
    g.moveTo(x1, y1);
    const segs = 8;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 18;
      const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 18;
      g.lineTo(x, y);
    }
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  private hitEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number, isCrit: boolean, knockback: number) {
    let hp = (enemy.getData('hp') as number) - damage;
    enemy.setData('hp', hp);
    enemy.setData('flash', 80);
    this.flash(isCrit ? '#ff3a3a' : '#ffffff', isCrit ? 0.5 : 0.2);
    this.spawnDamageNumber(enemy.x, enemy.y - 8, damage, isCrit);
    if (knockback > 0) {
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const len = Math.hypot(dx, dy) || 1;
      enemy.setVelocity((dx / len) * knockback, (dy / len) * knockback);
    }
    if (hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!enemy.active) return;
    const gold = enemy.getData('gold') as number;
    const score = enemy.getData('score') as number;
    const isBoss = !!enemy.getData('isBoss');
    const elite = !!enemy.getData('elite');
    this.uiState.runGold += Math.round(gold * this.playerStats.goldMult);
    this.uiState.rewardScore += score;
    this.uiState.enemiesKilled++;
    this.roomEnemiesKilled++;
    if (isBoss) this.uiState.bossesKilled++;

    // drop loot
    if (Math.random() < (isBoss ? 1 : (elite ? 0.9 : 0.45))) this.dropRelicPickup(enemy.x, enemy.y);
    if (isBoss || Math.random() < 0.6) this.dropGold(gold, enemy.x, enemy.y);

    if (isBoss) {
      this.toast('THE COLLECTOR FALLS', '#ffb347');
      this.shake(16);
    } else {
      this.shake(3);
    }

    // death effect
    this.tweens.add({
      targets: enemy,
      alpha: 0,
      scale: 1.3,
      duration: 200,
      onComplete: () => enemy.destroy(),
    });
  }

  private spawnDamageNumber(x: number, y: number, dmg: number, crit: boolean) {
    const t = this.add.text(x, y, `${Math.round(dmg)}${crit ? '!' : ''}`, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: crit ? '20px' : '14px',
      color: crit ? '#ff3a3a' : '#fff5dc',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(70);
    this.tweens.add({
      targets: t,
      y: y - 24,
      alpha: 0,
      duration: 600,
      onComplete: () => t.destroy(),
    });
  }

  // ---------------------------------------------------------------------------
  // LOOT
  // ---------------------------------------------------------------------------

  private dropGold(amount: number, x?: number, y?: number) {
    const g = this.loot.create(x ?? this.player.x, y ?? this.player.y, 'loot_gold') as Phaser.Physics.Arcade.Image;
    g.setDepth(25);
    g.setData('amount', amount);
    g.setData('kind', 'gold');
    this.physics.add.overlap(this.player, g, () => this.collectGold(g));
    // little bounce
    this.tweens.add({ targets: g, y: g.y - 6, yoyo: true, repeat: 2, duration: 180 });
  }

  private collectGold(g: Phaser.Physics.Arcade.Image) {
    if (!g.active) return;
    const amt = g.getData('amount') as number;
    this.uiState.runGold += Math.round(amt * this.playerStats.goldMult);
    this.uiState.rewardScore += Math.round(amt * 0.05);
    this.roomGoldLooted += Math.round(amt * this.playerStats.goldMult);
    g.destroy();
  }

  private dropRelicPickup(x: number, y: number, def?: RelicDef) {
    const r = def ?? this.pickRandomRelic(new Rng(Math.floor(Math.random() * 2 ** 30)), this.uiState.floor);
    const p = this.loot.create(x, y, 'loot_relic') as Phaser.Physics.Arcade.Image;
    p.setDepth(26);
    p.setData('kind', 'relic');
    p.setData('relic', r);
    this.physics.add.overlap(this.player, p, () => this.collectRelic(p));
    this.tweens.add({ targets: p, y: y - 8, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
  }

  private pickRandomRelic(rng: Rng, floor: number): RelicDef {
    // cursed chance scales with greed
    const tier = greedTier(this.greed);
    const cursed = rng.next() < tier.cursedChance;
    let pool = RELICS.filter(r => r.rarity !== 'cursed');
    if (cursed) pool = RELICS.filter(r => r.rarity === 'cursed');
    return pool[rng.int(0, pool.length)];
  }

  private collectRelic(p: Phaser.Physics.Arcade.Image) {
    if (!p.active) return;
    const r = p.getData('relic') as RelicDef;
    this.uiState.relics.push(r);
    this.roomRelicsFound++;
    // applyRelic pushes the HUD update AND emits the rich toast.
    this.applyRelic(r);
    p.destroy();
  }

  private applyRelic(r: RelicDef) {
    // Compute the stat changes for the toast (and to feed the HUD).
    const deltas: string[] = [];
    for (const eff of r.effects) {
      if (eff.stat) {
        const stat = eff.stat as keyof typeof this.playerStats;
        const cur = (this.playerStats as any)[stat] as number;
        const before = cur;
        if (eff.add !== undefined) {
          (this.playerStats as any)[stat] = cur + eff.add;
          deltas.push(`+${eff.add} ${stat}`);
        }
        if (eff.mul !== undefined) {
          (this.playerStats as any)[stat] = cur * eff.mul;
          const after = (this.playerStats as any)[stat] as number;
          const pct = Math.round((after / before - 1) * 100);
          deltas.push(`${pct >= 0 ? '+' : ''}${pct}% ${stat}`);
        }
      }
      if (eff.trigger && eff.value !== undefined) {
        (this.playerStats as any)[eff.trigger] = eff.value;
        deltas.push(`${eff.trigger.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`);
      }
    }
    // Recompute derived UI state.
    this.uiState.maxHp = Math.round(this.playerStats.maxHp);
    if (this.uiState.hp > this.uiState.maxHp) this.uiState.hp = this.uiState.maxHp;
    // Push combat stats + weapon tier to the UI.
    this.syncCombatToUi();

    // Build a richer toast so the player SEES what they got.
    const summary = deltas.length > 0 ? deltas.slice(0, 3).join(' · ') : r.flavor;
    this.toast(`+ ${r.name.toUpperCase()} — ${summary}`.slice(0, 80), this.rarityColor(r.rarity));
  }

  /** Push live combat stats + weapon tier into uiState.combat. */
  private syncCombatToUi() {
    const tier = tierForAttack(this.playerStats.attack);
    const tierIndex = WEAPON_TIERS.indexOf(tier);
    this.uiState.combat = {
      attack: Math.round(this.playerStats.attack * 10) / 10,
      attackSpeed: Math.round(this.playerStats.attackSpeed * 10) / 10,
      critChance: this.playerStats.critChance,
      moveSpeed: this.playerStats.moveSpeed,
      dodge: this.playerStats.dodge,
      weaponTier: tierIndex,
      projectileColor: tier.color,
    };
  }

  private rarityColor(r: string): string {
    switch (r) {
      case 'common': return '#c8b790';
      case 'uncommon': return '#5fb6ff';
      case 'rare': return '#b86bff';
      case 'epic': return '#ffd24a';
      case 'legendary': return '#ff8a1a';
      case 'cursed': return '#c2362d';
      default: return '#fff5dc';
    }
  }

  // ---------------------------------------------------------------------------
  // TREASURE / SHRINE / MYSTERY
  // ---------------------------------------------------------------------------

  private openChest(chest: Phaser.GameObjects.Sprite) {
    if (chest.getData('opened')) return;
    chest.setData('opened', true);
    this.tweens.add({ targets: chest, scale: 0, duration: 200, onComplete: () => chest.destroy() });
    const rng = new Rng(Math.floor(Math.random() * 2 ** 30));
    const r = this.pickRandomRelic(rng, this.uiState.floor);
    this.dropRelicPickup(chest.x, chest.y, r);
    this.dropGold(150);
    this.toast('CHEST OPENED', '#ffb347');
  }

  private useShrine(shrine: Phaser.GameObjects.Sprite) {
    if (shrine.getData('used')) return;
    shrine.setData('used', true);
    const heal = Math.round(this.uiState.maxHp * 0.5);
    this.uiState.hp = Math.min(this.uiState.maxHp, this.uiState.hp + heal);
    this.toast(`+${heal} HP`, '#4ade80');
    this.tweens.add({ targets: shrine, alpha: 0.4, duration: 300 });
  }

  private runMysteryEvent(rng: Rng, room: RoomSpec) {
    const r = rng.next();
    if (r < 0.5) {
      // The Stranger: take 500 gold, get a relic (or get robbed)
      const taken = 500;
      if (this.uiState.runGold >= taken) {
        this.uiState.runGold -= taken;
        if (rng.next() < 0.7) {
          this.dropRelicPickup(GAME_W / 2, GAME_H / 2, this.pickRandomRelic(rng, room.floor));
          this.toast('The Stranger smiles.', '#ffb347');
        } else {
          this.toast('The Stranger took it and vanished.', '#c2362d');
        }
      } else {
        this.toast('A stranger watches, then leaves.', '#c8b790');
      }
    } else if (r < 0.8) {
      // Altar: lose 40% HP, get epic/legendary
      this.uiState.hp = Math.round(this.uiState.hp * 0.6);
      const epics = RELICS.filter(x => x.rarity === 'epic' || x.rarity === 'legendary');
      this.dropRelicPickup(GAME_W / 2, GAME_H / 2, epics[rng.int(0, epics.length)]);
      this.toast('The altar hungers. You fed it.', '#b86bff');
    } else {
      // Golden chest: open for big reward or ambush
      if (rng.next() < 0.6) {
        this.dropRelicPickup(GAME_W / 2, GAME_H / 2, RELICS.find(r => r.rarity === 'legendary')!);
        this.dropGold(1000);
        this.toast('A golden chest. Pure luck.', '#ffb347');
      } else {
        for (let i = 0; i < 4; i++) this.spawnEnemy(rng, true);
        this.toast('AMBIUSH!', '#c2362d');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // MAIN LOOP
  // ---------------------------------------------------------------------------

  update(time: number, delta: number) {
    if (this.uiState.status === 'menu') return;
    if (this.uiState.paused) return;
    if (this.uiState.status === 'cashed_out' || this.uiState.status === 'died') return;
    if (this.uiState.status === 'extraction') {
      // freeze gameplay, wait for user choice
      return;
    }
    if (this.uiState.status === 'room_cleared') {
      // freeze gameplay, wait for the player to click CONTINUE
      return;
    }

    // --- player movement
    let mx = 0, my = 0;
    if (this.keyA.isDown || this.cursors.left!.isDown) mx -= 1;
    if (this.keyD.isDown || this.cursors.right!.isDown) mx += 1;
    if (this.keyW.isDown || this.cursors.up!.isDown) my -= 1;
    if (this.keyS.isDown || this.cursors.down!.isDown) my += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my) || 1;
      this.player.setVelocity((mx / len) * this.playerStats.moveSpeed, (my / len) * this.playerStats.moveSpeed);
    } else {
      this.player.setVelocity(0, 0);
    }

    // --- dodge
    if (Phaser.Input.Keyboard.JustDown(this.keySpace) && this.dodgeCooldown < time) {
      const len = Math.hypot(mx, my) || 1;
      const speed = 480;
      this.player.setVelocity((mx / len) * speed, (my / len) * speed);
      this.dodgeCooldown = time + 600;
      this.iFrameUntil = time + 300;
      this.toast('DODGE', '#5fb6ff');
      this.player.setTexture('player_dodge');
      this.time.delayedCall(120, () => this.player && this.player.setTexture('player'));
    }

    // --- attack
    if (this.mouseDown) this.firePlayerAttack(time);

    // --- aim rotation
    const aim = new Phaser.Math.Vector2(this.pointer.worldX - this.player.x, this.pointer.worldY - this.player.y);
    if (aim.lengthSq() > 1) {
      const ang = Math.atan2(aim.y, aim.x);
      this.facing = new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang));
    }

    // --- enemy AI
    for (const e of this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!e.active) continue;
      const beh = e.getData('behavior') as string;
      const toPlayer = new Phaser.Math.Vector2(this.player.x - e.x, this.player.y - e.y);
      const dist = toPlayer.length();
      if (dist < 0.001) continue;
      toPlayer.normalize();
      let cooldown = (e.getData('cooldown') as number) - delta;

      if (beh === 'melee') {
        e.setVelocity(toPlayer.x * 80, toPlayer.y * 80);
        if (dist < 32 && cooldown <= 0) {
          this.damagePlayer(e.getData('attack') as number);
          cooldown = 1000;
        }
      } else if (beh === 'ranged') {
        // strafe and shoot
        const strafe = new Phaser.Math.Vector2(-toPlayer.y, toPlayer.x);
        if (dist > 220) {
          e.setVelocity(toPlayer.x * 50, toPlayer.y * 50);
        } else {
          e.setVelocity(strafe.x * 30, strafe.y * 30);
        }
        if (cooldown <= 0 && dist < 280) {
          this.enemyShoot(e, 'proj_arrow', 4);
          cooldown = 1600;
        }
      } else if (beh === 'charger') {
        let chargeT = e.getData('chargeT') as number;
        const dir = e.getData('chargeDir') as Phaser.Math.Vector2;
        if (chargeT > 0) {
          e.setVelocity(dir.x * 280, dir.y * 280);
          chargeT -= delta;
          e.setData('chargeT', chargeT);
          if (dist < 28 && cooldown <= 0) {
            this.damagePlayer(e.getData('attack') as number);
            cooldown = 1500;
          }
        } else {
          // telegraph
          e.setVelocity(0, 0);
          if (dist < 260) {
            chargeT = 700;
            dir.x = toPlayer.x;
            dir.y = toPlayer.y;
            e.setTint(0xff3a3a);
            this.time.delayedCall(180, () => e.clearTint());
          }
        }
      } else if (beh === 'summoner') {
        e.setVelocity(0, 0);
        let summonT = (e.getData('summonT') as number) - delta;
        if (summonT <= 0) {
          summonT = 4000;
          this.spawnEnemy(new Rng(Math.floor(Math.random() * 2 ** 30)), false);
          e.setData('summonT', summonT);
        } else {
          e.setData('summonT', summonT);
        }
        if (cooldown <= 0 && dist < 260) {
          this.enemyShoot(e, 'proj_dark', 6);
          cooldown = 2500;
        }
      } else if (beh === 'boss') {
        // The Collector: summon, shoot, occasionally steal gold
        let summonT = (e.getData('summonT') as number) - delta;
        if (summonT <= 0) {
          summonT = 5000;
          for (let i = 0; i < 2; i++) this.spawnEnemy(new Rng(Math.floor(Math.random() * 2 ** 30)), false);
          this.toast('The Collector summons minions.', '#ff6b1a');
        } else {
          e.setData('summonT', summonT);
        }
        // strafe
        const strafe = new Phaser.Math.Vector2(-toPlayer.y, toPlayer.x);
        if (dist < 200) {
          e.setVelocity(strafe.x * 50, strafe.y * 50);
        } else if (dist > 280) {
          e.setVelocity(toPlayer.x * 50, toPlayer.y * 50);
        } else {
          e.setVelocity(0, 0);
        }
        if (cooldown <= 0 && dist < 320) {
          this.enemyShoot(e, 'proj_dark', 8, 3);
          cooldown = 2000;
        }
        // gold steal: when player is near, occasionally drain 50
        if (dist < 60 && Math.random() < 0.02) {
          const stolen = Math.min(50, this.uiState.runGold);
          if (stolen > 0) {
            this.uiState.runGold -= stolen;
            const prev = (e.getData('goldStolen') as number) || 0;
            e.setData('goldStolen', prev + stolen);
            this.toast(`- ${stolen} GOLD (STOLEN)`, '#c2362d');
            this.spawnDamageNumber(e.x, e.y - 28, stolen, false);
          }
        }
      }
      e.setData('cooldown', cooldown);

      // hit flash decay
      let flash = e.getData('flash') as number;
      if (flash > 0) {
        flash -= delta;
        e.setData('flash', flash);
        if (flash <= 0) e.clearTint();
      }
    }

    // --- enemy projectiles hit player
    for (const p of this.projectiles.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (!p.active) continue;
      let life = (p.getData('life') as number) - delta;
      p.setData('life', life);
      if (life <= 0) p.destroy();
    }

    // --- player projectiles hit enemies
    for (const p of this.playerProjectiles.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (!p.active) continue;
      let life = (p.getData('life') as number) - delta;
      p.setData('life', life);
      if (life <= 0) { p.destroy(); continue; }
      const tier = (p.getData('tier') as number) ?? 0;
      const hitR = 14 + tier * 2;
      for (const e of this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
        if (!e.active) continue;
        if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < hitR) {
          const dmg = p.getData('damage') as number;
          const cc = p.getData('critChance') as number;
          const isCrit = Math.random() < cc;
          const total = isCrit ? dmg * 2 : dmg;
          this.hitEnemy(e, total, isCrit, 60);
          p.destroy();
          break;
        }
      }
    }

    // --- collisions: enemy bodies with player
    for (const e of this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!e.active) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < 22) {
        const beh = e.getData('behavior') as string;
        if (beh === 'melee' || beh === 'charger' || beh === 'boss') {
          // damage is handled in AI per-tick
        }
      }
    }

    // --- regen
    if (this.playerStats.regenPerSec > 0) {
      this.regenAccum += delta;
      if (this.regenAccum >= 1000) {
        this.regenAccum -= 1000;
        this.uiState.hp = Math.min(this.uiState.maxHp, this.uiState.hp + this.playerStats.regenPerSec);
      }
    }

    // --- room cleared? surface the room_cleared interstitial as soon as
    // enemies are dead. Loot is auto-magnetized to the player in
    // showRoomCleared() so the player doesn't have to chase gold piles.
    // Pickups (chests, shrines) are still consumed by overlap so the
    // room is genuinely "won" when an enemy-heavy room with a chest
    // empties out.
    if (this.uiState.currentRoomType !== 'extraction' &&
        this.uiState.status === 'playing' &&
        this.enemies.countActive(true) === 0) {
      this.showExitArrow();
      // Wait until the player has also grabbed any open pickup
      // (chest/shrine/portal) before showing the modal.
      if (this.pickups.countActive(true) === 0 && this.loot.countActive(true) === 0) {
        this.showRoomCleared();
      } else if (this.pickups.countActive(true) === 0) {
        // Just loot left — give it a short window to magnetize, then
        // force the room-cleared modal so the player isn't stuck.
        this.magnetToPlayer();
        this.time.delayedCall(450, () => {
          if (this.uiState.status === 'playing' && this.enemies.countActive(true) === 0) {
            this.magnetToPlayer();
            this.showRoomCleared();
          }
        });
      }
    } else {
      this.hideExitArrow();
    }

    // --- visual: shake decay
    if (this.uiState.shake > 0) {
      this.uiState.shake = Math.max(0, this.uiState.shake - delta * 0.02);
      this.cameras.main.setScroll(
        (Math.random() - 0.5) * this.uiState.shake,
        (Math.random() - 0.5) * this.uiState.shake,
      );
    } else {
      this.cameras.main.setScroll(0, 0);
    }

    // --- visual: corruption
    const t = greedTier(this.greed);
    this.bgOverlay.setFillStyle(0x5a1a14, 0.05 + t.corruption * 0.05);
    this.vignette.setFillStyle(0x000000, 0.1 + t.corruption * 0.12);
  }

  private enemyShoot(e: Phaser.Physics.Arcade.Sprite, tex: string, damage: number, projectiles = 1) {
    const base = new Phaser.Math.Vector2(this.player.x - e.x, this.player.y - e.y).normalize();
    for (let i = 0; i < projectiles; i++) {
      const spread = (i - (projectiles - 1) / 2) * 0.18;
      const ang = Math.atan2(base.y, base.x) + spread;
      const p = this.projectiles.create(e.x, e.y, tex) as Phaser.Physics.Arcade.Image;
      p.setDepth(40);
      p.setData('damage', damage);
      p.setData('life', 1200);
      // Slower than the player so they CAN dodge.
      p.setVelocity(Math.cos(ang) * 195, Math.sin(ang) * 195);
      if (p.body) p.body.setSize(8, 8);
    }
  }

  // ---------------------------------------------------------------------------
  // PLAYER DAMAGE / DEATH
  // ---------------------------------------------------------------------------

  damagePlayer(amount: number) {
    if (this.time.now < this.iFrameUntil) return;
    // dodge
    if (Math.random() < this.playerStats.dodge) {
      this.toast('DODGE', '#5fb6ff');
      this.iFrameUntil = this.time.now + 200;
      if (this.playerStats.onDodgeInvisible > 0) {
        this.player.setAlpha(0.4);
        this.time.delayedCall(this.playerStats.onDodgeInvisible * 1000, () => this.player.setAlpha(1));
      }
      return;
    }
    const final = Math.round(amount * this.playerStats.damageTakenMult);
    this.uiState.hp = Math.max(0, this.uiState.hp - final);
    this.flash('#c2362d', 0.6);
    this.shake(8);
    this.spawnDamageNumber(this.player.x, this.player.y - 16, final, false);
    this.iFrameUntil = this.time.now + 400;

    if (this.uiState.hp <= 0) {
      // Phoenix feather?
      if (this.playerStats.oncePerRunRevive > 0 && !this.hasRevivedThisRun) {
        this.hasRevivedThisRun = true;
        this.uiState.hp = Math.round(this.uiState.maxHp * this.playerStats.oncePerRunRevive);
        this.toast('PHOENIX FEATHER', '#ff8a1a');
        this.flash('#ff8a1a', 1.0);
        return;
      }
      this.die();
    }
  }

  die() {
    this.uiState.status = 'died';
    this.uiState.endedAt = Date.now();
    this.uiState.runGold = 0;
    this.uiState.rewardScore = 0;
    this.uiState.potentialReward = 0;
    this.toast('YOU GOT GREEDY', '#c2362d');
    this.shake(20);
    this.cameras.main.flash(400, 80, 0, 0);
  }

  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------

  toast(text: string, color: string) {
    const id = Date.now() + Math.random();
    this.uiState.toasts.push({ id, text, color, ts: Date.now() });
    this.time.delayedCall(2000, () => {
      this.uiState.toasts = this.uiState.toasts.filter(t => t.id !== id);
    });
  }

  flash(color: string, alpha: number) {
    this.uiState.flash = { color, ts: Date.now() };
    this.time.delayedCall(120, () => { this.uiState.flash = null; });
    this.cameras.main.flash(60, parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16));
  }

  shake(intensity: number) {
    this.uiState.shake = Math.max(this.uiState.shake, intensity);
  }
}
