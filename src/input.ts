import {
  SHIP_MAX_ENERGY, ENEMY_MAX_ENERGY, ENEMY_SPEED_Y,
  ENEMY_SPAWN_INTERVAL_MS, ENEMY_MARGIN_LEFT,
} from './constants.js';
import { state, canvas } from './state.js';
import type { EnemyShipState } from './types.js';
import { spawnProjectile } from './ship.js';
import { initializeEnemyShip } from './enemy.js';
import { startMusic } from './audio.js';

function setInputByKey(key: string, isPressed: boolean): void {
  switch (key) {
    case "ArrowLeft": state.input.left = isPressed; break;
    case "ArrowRight": state.input.right = isPressed; break;
    case "ArrowUp": state.input.up = isPressed; break;
    case "ArrowDown": state.input.down = isPressed; break;
    default: break;
  }
}

export function setupInput(): void {
  window.addEventListener("keydown", (event) => {
    if (event.key.startsWith("Arrow") || event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
    }

    if (event.code === "Enter" && !event.repeat && !state.gameActive) {
      state.gameActive = true;
      state.ship.energy = SHIP_MAX_ENERGY;
      state.score = 0;
      state.enemyShotCount = 0;
      state.projectiles = [];
      state.enemyProjectiles = [];
      state.enemyShips = [
        {
          x: ENEMY_MARGIN_LEFT,
          y: canvas.height / 2,
          angle: 0,
          length: 33,
          width: 20,
          speedY: ENEMY_SPEED_Y,
          energy: ENEMY_MAX_ENERGY,
          lastFiredAt: -Infinity,
          active: true,
          targetY: canvas.height / 2,
          nextMoveAt: -1,
          entering: false,
          respawnAt: -1,
        } as EnemyShipState,
      ];
      initializeEnemyShip(canvas.width, canvas.height);
      state.nextEnemySpawnAt = performance.now() + ENEMY_SPAWN_INTERVAL_MS;
      startMusic();
    }

    if (event.code === "Space" && !event.repeat && state.gameActive) {
      spawnProjectile(performance.now());
    }

    setInputByKey(event.key, true);
  });

  window.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow") || event.code === "Space") {
      event.preventDefault();
    }
    setInputByKey(event.key, false);
  });
}

