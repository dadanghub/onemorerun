import Phaser from 'phaser';
import type { GameScene } from './GameScene';

/**
 * UI scene mirrors the GameScene state to a tiny set of in-canvas
 * toasts/overlays. Most of the HUD lives in React (see App.tsx) because
 * it's easier to style with CSS.
 */
export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    const game = this.scene.get('Game') as GameScene;
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (!game || !game.uiState) return;
        // We don't render anything in-canvas here; React reads game.uiState
        // via a ref. The scene exists so Phaser can keep two scenes alive
        // and so we have a place to add canvas overlays later.
      },
    });
  }
}
