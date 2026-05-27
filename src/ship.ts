import {
  SHIP_MARGIN_RIGHT, SHIP_MAX_ENERGY, SHIP_COLOR, SHIP_COLOR_RGB,
  SHIP_MAX_ASTEROID_DISTANCE_PX,
  PROJECTILE_SPEED, PROJECTILE_RADIUS,
  PROJECTILE_SHIP_COLLISION_GRACE_MS, PROJECTILE_GRAVITY_CONSTANT,
  PROJECTILE_GRAVITY_MIN_DISTANCE, PROJECTILE_MAX_GRAVITY_ACCELERATION,
  ENERGY_BAR_WIDTH, ENERGY_BAR_HEIGHT, ENERGY_BAR_OFFSET_Y,
  ENEMY_RESPAWN_DELAY_MS, ENEMY_STILL_THRESHOLD_PX,
} from './constants.js';
import type { Projectile } from './types.js';
import { state, canvas, context } from './state.js';
import { clamp } from './utils.js';
import { playShootSound } from './audio.js';
import {
  isProjectileCollidingWithAsteroid, isProjectileCollidingWithShip,
  isProjectileCollidingWithTarget, calculateProjectileEnergy,
} from './physics.js';
import { spawnParticles, triggerShake } from './particles.js';

export function initializeOrClampShip(width: number, height: number): void {
  if (state.ship.x === 0 && state.ship.y === 0) {
    state.ship.x = width - SHIP_MARGIN_RIGHT;
    state.ship.y = height / 2;
    state.ship.angle = Math.PI;
  }
  const h = state.ship.length / 2;
  const asteroidAreaRight = state.asteroids.reduce(
    (maxRight, asteroid) => Math.max(maxRight, asteroid.x + asteroid.radius),
    (width * 3) / 4,
  );
  const maxShipX = Math.min(
    width - h,
    asteroidAreaRight + SHIP_MAX_ASTEROID_DISTANCE_PX,
  );
  state.ship.x = clamp(state.ship.x, h, maxShipX);
  state.ship.y = clamp(state.ship.y, h, height - h);
}

export function spawnProjectile(now: number): void {
  const dx = Math.cos(state.ship.angle);
  const dy = Math.sin(state.ship.angle);
  const nose = state.ship.length / 2;
  state.projectiles.push({
    x: state.ship.x + dx * nose,
    y: state.ship.y + dy * nose,
    vx: dx * PROJECTILE_SPEED,
    vy: dy * PROJECTILE_SPEED,
    createdAt: now,
    canHitShipAfter: now + PROJECTILE_SHIP_COLLISION_GRACE_MS,
  });
  state.enemyShotCount++;
  playShootSound(880);
}

export function drawEnergyBar(
  shipX: number,
  shipY: number,
  energy: number,
  maxEnergy: number,
  colorRGB: string,
): void {
  const bx = shipX - (ENERGY_BAR_WIDTH * state.zoomLevel) / 2;
  const by = shipY - (ENERGY_BAR_OFFSET_Y * state.zoomLevel);
  const bw = ENERGY_BAR_WIDTH * state.zoomLevel;
  const bh = ENERGY_BAR_HEIGHT * state.zoomLevel;
  context.fillStyle = '#333333';
  context.fillRect(bx, by, bw, bh);
  const pct = energy / maxEnergy;
  context.fillStyle = `rgb(${colorRGB})`;
  context.fillRect(bx, by, bw * pct, bh);
}

export function drawShip(): void {
  const zx = state.ship.x * state.zoomLevel + (canvas.width * (1 - state.zoomLevel)) / 2;
  const zy = state.ship.y * state.zoomLevel + (canvas.height * (1 - state.zoomLevel)) / 2;
  const zl = state.ship.length * state.zoomLevel;
  const zw = state.ship.width * state.zoomLevel;
  if (!state.gameActive && Math.floor(performance.now() / 300) % 2 === 0) {
    drawEnergyBar(zx, zy, state.ship.energy, SHIP_MAX_ENERGY, SHIP_COLOR_RGB);
    return;
  }
  context.save();
  context.translate(zx, zy);
  context.rotate(state.ship.angle);
  context.fillStyle = SHIP_COLOR;
  context.beginPath();
  context.moveTo(zl / 2, 0);
  context.lineTo(-zl / 2, -zw / 2);
  context.lineTo(-zl / 2, zw / 2);
  context.closePath();
  context.fill();
  context.restore();
  drawEnergyBar(zx, zy, state.ship.energy, SHIP_MAX_ENERGY, SHIP_COLOR_RGB);
}

export function updateShip(deltaSeconds: number, now: number): void {
  if (!state.gameActive) return;
  if (state.input.left) state.ship.angle -= state.ship.turnSpeed * deltaSeconds;
  if (state.input.right) state.ship.angle += state.ship.turnSpeed * deltaSeconds;
  if (state.input.up) state.ship.y -= state.ship.speedY * deltaSeconds;
  if (state.input.down) state.ship.y += state.ship.speedY * deltaSeconds;
  const h = state.ship.length / 2;
  state.ship.y = clamp(state.ship.y, h, canvas.height - h);
  const mx = Math.abs(state.ship.x - state.playerStillCheckX);
  const my = Math.abs(state.ship.y - state.playerStillCheckY);
  if (mx > ENEMY_STILL_THRESHOLD_PX || my > ENEMY_STILL_THRESHOLD_PX) {
    state.playerLastMovedAt = now;
    state.playerStillCheckX = state.ship.x;
    state.playerStillCheckY = state.ship.y;
  }
}

function handleProjectileHitEnemy(projectile: Projectile, now: number): boolean {
  for (const enemy of state.enemyShips) {
    if (!enemy.active || enemy.entering) {
      continue;
    }
    const er = Math.max(enemy.length, enemy.width) / 2;
    if (!isProjectileCollidingWithTarget(
      projectile.x, projectile.y, enemy.x, enemy.y, er,
    )) {
      continue;
    }
    const e = calculateProjectileEnergy(projectile, now);
    enemy.energy = Math.max(0, enemy.energy - e);
    spawnParticles(projectile.x, projectile.y, e, SHIP_COLOR_RGB, now);
    triggerShake(now);
    if (enemy.energy <= 0) {
      enemy.active = false;
      enemy.respawnAt = -1;
      state.score += Math.max(1, 101 - state.enemyShotCount);
      state.enemyShotCount = 0;
      const anyActive = state.enemyShips.some((s) => s.active);
      if (!anyActive) {
        state.nextEnemySpawnAt = now;
      }
    }
    return true;
  }
  return false;
}

export function updateProjectiles(deltaSeconds: number, now: number): void {
  const surviving: Projectile[] = [];
  for (const p of state.projectiles) {
    if (state.asteroids.some((c) => isProjectileCollidingWithAsteroid(p.x, p.y, c))) {
      spawnParticles(p.x, p.y, calculateProjectileEnergy(p, now), SHIP_COLOR_RGB, now);
      continue;
    }
    if (now >= p.canHitShipAfter && isProjectileCollidingWithShip(p.x, p.y)) {
      const e = calculateProjectileEnergy(p, now);
      state.ship.energy = Math.max(0, state.ship.energy - e);
      spawnParticles(p.x, p.y, e, SHIP_COLOR_RGB, now);
      triggerShake(now);
      continue;
    }
    if (handleProjectileHitEnemy(p, now)) continue;

    let ax = 0;
    let ay = 0;
    for (const asteroid of state.asteroids) {
      const dx = asteroid.x - p.x;
      const dy = asteroid.y - p.y;
      const dSq = dx * dx + dy * dy;
      const minD = Math.max(PROJECTILE_GRAVITY_MIN_DISTANCE, asteroid.radius * 0.35);
      const cdSq = Math.max(dSq, minD * minD);
      const d = Math.sqrt(cdSq);
      const mag = Math.min(
        (PROJECTILE_GRAVITY_CONSTANT * asteroid.mass) / cdSq,
        PROJECTILE_MAX_GRAVITY_ACCELERATION,
      );
      ax += (dx / d) * mag;
      ay += (dy / d) * mag;
    }
    p.vx += ax * deltaSeconds;
    p.vy += ay * deltaSeconds;
    p.x += p.vx * deltaSeconds;
    p.y += p.vy * deltaSeconds;

    if (state.asteroids.some((c) => isProjectileCollidingWithAsteroid(p.x, p.y, c))) {
      spawnParticles(p.x, p.y, calculateProjectileEnergy(p, now), SHIP_COLOR_RGB, now);
      continue;
    }
    if (now >= p.canHitShipAfter && isProjectileCollidingWithShip(p.x, p.y)) {
      const e = calculateProjectileEnergy(p, now);
      state.ship.energy = Math.max(0, state.ship.energy - e);
      spawnParticles(p.x, p.y, e, SHIP_COLOR_RGB, now);
      triggerShake(now);
      continue;
    }
    if (handleProjectileHitEnemy(p, now)) continue;
    surviving.push(p);
  }
  state.projectiles = surviving.filter(
    (p) => now - p.createdAt <= state.projectileMaxLifetimeMs,
  );
}

export function drawProjectiles(now: number): void {
  for (const p of state.projectiles) {
    const alpha = Math.max(
      0,
      1 - (now - p.createdAt) / state.projectileMaxLifetimeMs,
    );
    const zx = p.x * state.zoomLevel + (canvas.width * (1 - state.zoomLevel)) / 2;
    const zy = p.y * state.zoomLevel + (canvas.height * (1 - state.zoomLevel)) / 2;
    context.fillStyle = `rgba(${SHIP_COLOR_RGB}, ${alpha})`;
    context.beginPath();
    context.arc(zx, zy, PROJECTILE_RADIUS * state.zoomLevel, 0, Math.PI * 2);
    context.fill();
  }
}
