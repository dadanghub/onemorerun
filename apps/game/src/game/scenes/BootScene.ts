import Phaser from 'phaser';

/**
 * Boot scene. Procedurally generates all sprites as textures so the
 * game has zero external asset dependencies. This is fine for the MVP
 * and lets us hand off to art later by just replacing texture generators.
 */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.makePlayerTextures();
    this.makeEnemyTextures();
    this.makeProjectileTextures();
    this.makeLootTextures();
    this.makeTileTextures();
    this.makePortalTexture();
    this.scene.start('Game');
  }

  // ---------- player ----------
  private makePlayerTextures() {
    // The Rogue: dark blue cloak, gold trim, sword.
    const g = this.add.graphics();
    // shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(16, 30, 22, 6);
    // body
    g.fillStyle(0x1c2540, 1);
    g.fillRect(10, 8, 12, 16);
    // hood
    g.fillStyle(0x0e1326, 1);
    g.fillTriangle(8, 8, 24, 8, 16, 0);
    // gold trim
    g.lineStyle(1, 0xffb347, 1);
    g.strokeRect(10, 8, 12, 16);
    // face slit
    g.fillStyle(0xffb347, 1);
    g.fillRect(13, 12, 6, 2);
    // sword (right side)
    g.fillStyle(0xe8e8ee, 1);
    g.fillRect(24, 10, 2, 8);
    g.fillStyle(0xffb347, 1);
    g.fillRect(23, 18, 4, 1);
    g.generateTexture('player', 32, 32);
    g.destroy();

    // dodge blink variant
    const g2 = this.add.graphics();
    g2.fillStyle(0xffffff, 0.6);
    g2.fillRect(0, 0, 32, 32);
    g2.generateTexture('player_dodge', 32, 32);
    g2.destroy();
  }

  // ---------- enemies ----------
  private makeEnemyTextures() {
    // Skeleton: bone-white
    let g = this.add.graphics();
    g.fillStyle(0x000000, 0.4); g.fillEllipse(16, 30, 22, 6);
    g.fillStyle(0xe8e3d2, 1);
    g.fillRect(10, 8, 12, 12);
    g.fillStyle(0x0a0a0a, 1);
    g.fillRect(13, 12, 2, 2);
    g.fillRect(17, 12, 2, 2);
    g.fillRect(13, 16, 6, 1);
    g.fillStyle(0xc8b790, 1);
    g.fillRect(10, 20, 2, 8);
    g.fillRect(20, 20, 2, 8);
    g.generateTexture('enemy_skeleton', 32, 32);
    g.destroy();

    // Archer: green cloak
    g = this.add.graphics();
    g.fillStyle(0x000000, 0.4); g.fillEllipse(16, 30, 22, 6);
    g.fillStyle(0x1f4030, 1);
    g.fillRect(10, 8, 12, 14);
    g.fillStyle(0x14271d, 1);
    g.fillTriangle(8, 8, 24, 8, 16, 0);
    g.fillStyle(0xffb347, 1);
    g.fillRect(13, 12, 6, 2);
    // bow
    g.lineStyle(1, 0xc8b790, 1);
    g.strokeRect(24, 10, 1, 10);
    g.generateTexture('enemy_archer', 32, 32);
    g.destroy();

    // Slime: green blob
    g = this.add.graphics();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(16, 30, 22, 6);
    g.fillStyle(0x4ade80, 1);
    g.fillCircle(16, 20, 12);
    g.fillStyle(0x16a34a, 1);
    g.fillCircle(12, 18, 3);
    g.fillCircle(20, 22, 3);
    g.fillStyle(0x07080f, 1);
    g.fillRect(13, 16, 2, 2);
    g.fillRect(18, 16, 2, 2);
    g.generateTexture('enemy_slime', 32, 32);
    g.destroy();

    // Charger: red bull
    g = this.add.graphics();
    g.fillStyle(0x000000, 0.4); g.fillEllipse(16, 30, 26, 6);
    g.fillStyle(0x7a1f1f, 1);
    g.fillRect(6, 10, 20, 14);
    g.fillStyle(0x4a0e0e, 1);
    g.fillTriangle(2, 12, 8, 12, 8, 22);
    g.fillStyle(0xffb347, 1);
    g.fillRect(20, 10, 4, 4);
    g.fillStyle(0xffffff, 1);
    g.fillRect(22, 11, 1, 1);
    g.generateTexture('enemy_charger', 32, 32);
    g.destroy();

    // Necromancer: purple robe
    g = this.add.graphics();
    g.fillStyle(0x000000, 0.4); g.fillEllipse(16, 30, 22, 6);
    g.fillStyle(0x3b1f5e, 1);
    g.fillRect(8, 6, 16, 22);
    g.fillStyle(0x1f0e36, 1);
    g.fillTriangle(6, 6, 26, 6, 16, -2);
    g.fillStyle(0xb86bff, 1);
    g.fillRect(13, 12, 6, 2);
    // staff
    g.fillStyle(0x6e4226, 1);
    g.fillRect(26, 6, 1, 22);
    g.fillStyle(0xb86bff, 1);
    g.fillCircle(26, 6, 2);
    g.generateTexture('enemy_necromancer', 32, 32);
    g.destroy();

    // Boss: The Collector (large gold-armored skeleton king)
    g = this.add.graphics();
    g.fillStyle(0x000000, 0.4); g.fillEllipse(32, 60, 56, 12);
    g.fillStyle(0x2a2010, 1);
    g.fillRect(16, 16, 32, 36);
    g.fillStyle(0xffb347, 1);
    g.fillRect(14, 14, 36, 4);
    g.fillStyle(0xff8a1a, 1);
    g.fillRect(18, 22, 4, 4);
    g.fillRect(42, 22, 4, 4);
    g.fillStyle(0xff2a2a, 1);
    g.fillRect(28, 30, 8, 2);
    // crown
    g.fillStyle(0xffd24a, 1);
    g.fillTriangle(16, 14, 22, 4, 28, 14);
    g.fillTriangle(28, 14, 36, 0, 44, 14);
    g.fillTriangle(36, 14, 42, 4, 48, 14);
    g.fillStyle(0xc2362d, 1);
    g.fillRect(20, 6, 2, 2);
    g.fillRect(38, 6, 2, 2);
    g.generateTexture('enemy_boss', 64, 64);
    g.destroy();
  }

  // ---------- projectiles ----------
  private makeProjectileTextures() {
    // arrow
    let g = this.add.graphics();
    g.fillStyle(0xc8b790, 1);
    g.fillRect(0, 3, 8, 2);
    g.fillStyle(0x6e4226, 1);
    g.fillTriangle(8, 1, 8, 7, 11, 4);
    g.generateTexture('proj_arrow', 12, 8);
    g.destroy();

    // bone
    g = this.add.graphics();
    g.fillStyle(0xe8e3d2, 1);
    g.fillRect(0, 2, 8, 4);
    g.fillCircle(1, 4, 2);
    g.fillCircle(7, 4, 2);
    g.generateTexture('proj_bone', 8, 8);
    g.destroy();

    // dark bolt (necromancer)
    g = this.add.graphics();
    g.fillStyle(0xb86bff, 0.8);
    g.fillCircle(6, 6, 6);
    g.fillStyle(0x1f0e36, 1);
    g.fillCircle(6, 6, 3);
    g.generateTexture('proj_dark', 12, 12);
    g.destroy();
  }

  // ---------- loot ----------
  private makeLootTextures() {
    // chest closed
    let g = this.add.graphics();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(16, 30, 22, 4);
    g.fillStyle(0x6e4226, 1);
    g.fillRect(4, 14, 24, 16);
    g.fillStyle(0x4a2a14, 1);
    g.fillRect(4, 14, 24, 4);
    g.fillStyle(0xffb347, 1);
    g.fillRect(14, 20, 4, 6);
    g.generateTexture('loot_chest', 32, 32);
    g.destroy();

    // gold pile
    g = this.add.graphics();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(12, 22, 18, 3);
    g.fillStyle(0xffb347, 1);
    g.fillCircle(8, 14, 6);
    g.fillCircle(16, 12, 7);
    g.fillCircle(22, 16, 5);
    g.fillStyle(0xff8a1a, 1);
    g.fillRect(10, 12, 4, 1);
    g.fillRect(18, 10, 4, 1);
    g.generateTexture('loot_gold', 24, 24);
    g.destroy();

    // relic orb
    g = this.add.graphics();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(12, 22, 18, 3);
    g.fillStyle(0xb86bff, 0.6);
    g.fillCircle(12, 12, 10);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(9, 9, 3);
    g.generateTexture('loot_relic', 24, 24);
    g.destroy();

    // shrine (healing)
    g = this.add.graphics();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(16, 30, 22, 4);
    g.fillStyle(0x3a3530, 1);
    g.fillRect(8, 8, 16, 22);
    g.fillStyle(0x4ade80, 1);
    g.fillRect(15, 12, 2, 12);
    g.fillRect(11, 16, 10, 2);
    g.generateTexture('shrine', 32, 32);
    g.destroy();
  }

  // ---------- tiles ----------
  private makeTileTextures() {
    // floor tile
    let g = this.add.graphics();
    g.fillStyle(0x1a1d2e, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x232744, 1);
    g.fillRect(0, 0, 1, 32);
    g.fillRect(0, 0, 32, 1);
    g.lineStyle(1, 0x0e1020, 1);
    g.strokeRect(0, 0, 32, 32);
    g.generateTexture('tile_floor', 32, 32);
    g.destroy();

    // wall
    g = this.add.graphics();
    g.fillStyle(0x0a0c18, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x161a2e, 1);
    g.fillRect(2, 2, 28, 28);
    g.fillStyle(0x2a2538, 1);
    g.fillRect(4, 4, 24, 4);
    g.generateTexture('tile_wall', 32, 32);
    g.destroy();

    // corrupted floor (high greed)
    g = this.add.graphics();
    g.fillStyle(0x1a0a0e, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x3a1414, 1);
    g.fillRect(0, 0, 1, 32);
    g.fillRect(0, 0, 32, 1);
    g.lineStyle(1, 0x0e0810, 1);
    g.strokeRect(0, 0, 32, 32);
    g.fillStyle(0x5a2a14, 0.4);
    for (let i = 0; i < 5; i++) {
      g.fillRect(2 + i * 6, 4 + (i % 2) * 10, 2, 2);
    }
    g.generateTexture('tile_floor_corrupt', 32, 32);
    g.destroy();

    // corrupted wall
    g = this.add.graphics();
    g.fillStyle(0x0a0608, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x2a1410, 1);
    g.fillRect(2, 2, 28, 28);
    g.fillStyle(0x4a1a14, 1);
    g.fillRect(4, 4, 24, 4);
    g.fillStyle(0xff6b1a, 0.3);
    g.fillRect(8, 14, 16, 1);
    g.generateTexture('tile_wall_corrupt', 32, 32);
    g.destroy();

    // crack overlay
    g = this.add.graphics();
    g.lineStyle(1, 0x0a0a0a, 0.4);
    g.beginPath();
    g.moveTo(0, 16);
    g.lineTo(12, 18);
    g.lineTo(20, 12);
    g.lineTo(32, 20);
    g.strokePath();
    g.generateTexture('tile_crack', 32, 32);
    g.destroy();
  }

  // ---------- portal ----------
  private makePortalTexture() {
    const g = this.add.graphics();
    // base
    g.fillStyle(0x000000, 0.4); g.fillEllipse(24, 56, 40, 8);
    // frame
    g.lineStyle(2, 0xffb347, 1);
    g.strokeRect(8, 8, 32, 48);
    // glow
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      g.fillStyle(0xffb347, 0.18 - t * 0.15);
      g.fillRect(8 - i, 8 - i, 32 + i * 2, 48 + i * 2);
    }
    // center
    g.fillStyle(0xff8a1a, 0.4);
    g.fillRect(12, 14, 24, 36);
    g.fillStyle(0xfff5dc, 0.9);
    g.fillRect(22, 28, 4, 8);
    g.generateTexture('portal', 48, 64);
    g.destroy();
  }
}
