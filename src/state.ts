import type { Star, Asteroid, ShipState, InputState, Projectile, Particle, EnemyShipState } from './types.js';
import {
  SHIP_MAX_ENERGY, ENEMY_MAX_ENERGY, ENEMY_SPEED_Y, ENEMY_SPAWN_INTERVAL_MS,
} from './constants.js';

export const canvas = document.createElement("canvas");
const contextMaybe = canvas.getContext("2d");

if (!contextMaybe) {
  throw new Error("Canvas 2D Kontext konnte nicht erstellt werden.");
}

export const context = contextMaybe;

document.body.appendChild(canvas);

export const state = {
  stars: [] as Star[],
  asteroids: [] as Asteroid[],
  projectiles: [] as Projectile[],
  enemyProjectiles: [] as Projectile[],
  particles: [] as Particle[],
  ship: {
    x: 0,
    y: 0,
    angle: Math.PI,
    length: 33,
    width: 20,
    speedY: 220,
    turnSpeed: 2.8,
    energy: SHIP_MAX_ENERGY,
  } as ShipState,
  enemyShips: [
    {
      x: 0,
      y: 0,
      angle: 0,
      length: 33,
      width: 20,
      speedY: ENEMY_SPEED_Y,
      energy: ENEMY_MAX_ENERGY,
      lastFiredAt: -Infinity,
      active: true,
      targetY: 0,
      nextMoveAt: -1,
      entering: false,
      respawnAt: -1,
    } as EnemyShipState,
  ],
  input: {
    left: false,
    right: false,
    up: false,
    down: false,
  } as InputState,
  blinkingStarIndex: -1,
  blinkUntil: 0,
  nextBlinkAt: 0,
  lastFrameTime: 0,
  zoomLevel: 1.0,
  shakeUntil: 0,
  playerLastMovedAt: 0,
  playerStillCheckX: 0,
  playerStillCheckY: 0,
  gameActive: false,
  score: 0,
  enemyShotCount: 0,
  nextEnemySpawnAt: ENEMY_SPAWN_INTERVAL_MS,
};

