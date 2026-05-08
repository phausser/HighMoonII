import {
  ENEMY_MARGIN_LEFT, ENEMY_MAX_ENERGY, ENEMY_FIRE_INTERVAL_MS,
  ENEMY_AIM_SPREAD_RAD, ENEMY_STAY_MIN_MS, ENEMY_STAY_MAX_MS,
  ENEMY_MOVE_MIN_PX, ENEMY_MOVE_MAX_PX, ENEMY_ENTRY_SPEED,
  ENEMY_PROJECTILE_HOMING_ACCELERATION, ENEMY_STILL_THRESHOLD_MS,
  ENEMY_STILL_AIM_SPREAD_RAD, ENEMY_STILL_SIM_STEP,
  ENEMY_STILL_SIM_ANGLE_OFFSETS, ENEMY_STILL_SIM_Y_OFFSETS,
  ENEMY_COLOR_RGB, ENEMY_SPEED_Y,
  ENEMY_MAX_COUNT, ENEMY_SPAWN_INTERVAL_MS,
  ENEMY_MIN_SEPARATION, ENEMY_SEPARATION_FORCE,
  ENEMY_MAX_ASTEROID_DISTANCE_PX,
  PROJECTILE_SPEED, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME_MS,
  PROJECTILE_SHIP_COLLISION_GRACE_MS, PROJECTILE_GRAVITY_CONSTANT,
  PROJECTILE_GRAVITY_MIN_DISTANCE, PROJECTILE_MAX_GRAVITY_ACCELERATION,
} from './constants.js';
import type { EnemyShipState, Projectile } from './types.js';
import { state, canvas, context } from './state.js';
import { clamp, randomBetween } from './utils.js';
import { playShootSound } from './audio.js';
import {
  isProjectileCollidingWithAsteroid,
  isProjectileCollidingWithTarget,
  calculateProjectileEnergy,
} from './physics.js';
import { spawnParticles, triggerShake } from './particles.js';
import { drawEnergyBar } from './ship.js';

function makeEnemyShip(): EnemyShipState {
  return {
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
  };
}

function pickSafeY(excludeShip?: EnemyShipState): number {
  const h = 33 / 2;
  const minY = h;
  const maxY = canvas.height - h;
  const others = state.enemyShips.filter(
    (s) => s.active && s !== excludeShip,
  );
  let bestY = randomBetween(minY, maxY);
  let bestDist = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = randomBetween(minY, maxY);
    const minDist = others.length === 0
      ? Infinity
      : Math.min(...others.map((s) => Math.abs(s.y - candidate)));
    if (minDist >= ENEMY_MIN_SEPARATION) {
      return candidate;
    }
    if (minDist > bestDist) {
      bestDist = minDist;
      bestY = candidate;
    }
  }
  return bestY;
}

export function initializeEnemyShip(width: number, height: number): void {
  if (state.enemyShips.length === 0) {
    state.enemyShips.push(makeEnemyShip());
  }
  const ship = state.enemyShips[0];
  if (ship.x === 0 && ship.y === 0) {
    ship.x = ENEMY_MARGIN_LEFT;
    ship.y = height / 2;
  }
  const h = ship.length / 2;
  const asteroidAreaLeft = state.asteroids.reduce(
    (minLeft, asteroid) => Math.min(minLeft, asteroid.x - asteroid.radius),
    width / 4,
  );
  const minShipX = Math.max(
    h,
    asteroidAreaLeft - ENEMY_MAX_ASTEROID_DISTANCE_PX,
  );
  ship.x = clamp(ship.x, minShipX, width - h);
  ship.y = clamp(ship.y, h, height - h);
  ship.targetY = ship.y;
}

export function respawnEnemyShip(ship: EnemyShipState, now: number): void {
  ship.x = -ship.length * 2;
  ship.y = pickSafeY(ship);
  ship.angle = 0;
  ship.energy = ENEMY_MAX_ENERGY;
  ship.active = true;
  ship.entering = true;
  ship.lastFiredAt = now;
  ship.nextMoveAt = -1;
  ship.targetY = ship.y;
  ship.respawnAt = -1;
  state.enemyShotCount = 0;
}

function addEnemyShip(now: number): void {
  const ship = makeEnemyShip();
  ship.x = -ship.length * 2;
  ship.y = pickSafeY();
  ship.entering = true;
  ship.lastFiredAt = now;
  ship.targetY = ship.y;
  state.enemyShips.push(ship);
  state.nextEnemySpawnAt = now + ENEMY_SPAWN_INTERVAL_MS;
}

function simulateHitsPlayer(
  ship: EnemyShipState,
  startX: number,
  startY: number,
  angle: number,
): boolean {
  let x = startX + Math.cos(angle) * (ship.length / 2);
  let y = startY + Math.sin(angle) * (ship.length / 2);
  let vx = Math.cos(angle) * PROJECTILE_SPEED;
  let vy = Math.sin(angle) * PROJECTILE_SPEED;
  const maxSteps = Math.ceil(
    (PROJECTILE_MAX_LIFETIME_MS / 1000) / ENEMY_STILL_SIM_STEP,
  );
  const scr = Math.max(state.ship.length, state.ship.width) / 2;
  for (let step = 0; step < maxSteps; step++) {
    if (state.asteroids.some((c) => isProjectileCollidingWithAsteroid(x, y, c))) {
      return false;
    }
    if (isProjectileCollidingWithTarget(x, y, state.ship.x, state.ship.y, scr)) {
      return true;
    }
    let ax = 0;
    let ay = 0;
    for (const asteroid of state.asteroids) {
      const dx = asteroid.x - x;
      const dy = asteroid.y - y;
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
    const hdx = state.ship.x - x;
    const hdy = state.ship.y - y;
    const hdist = Math.hypot(hdx, hdy);
    if (hdist > 0) {
      ax += (hdx / hdist) * ENEMY_PROJECTILE_HOMING_ACCELERATION;
      ay += (hdy / hdist) * ENEMY_PROJECTILE_HOMING_ACCELERATION;
    }
    vx += ax * ENEMY_STILL_SIM_STEP;
    vy += ay * ENEMY_STILL_SIM_STEP;
    x += vx * ENEMY_STILL_SIM_STEP;
    y += vy * ENEMY_STILL_SIM_STEP;
  }
  return false;
}

function findEnemyAimAngle(ship: EnemyShipState, now: number): number {
  const base = Math.atan2(
    state.ship.y - ship.y,
    state.ship.x - ship.x,
  );
  if (now - state.playerLastMovedAt < ENEMY_STILL_THRESHOLD_MS) {
    return base + (Math.random() - 0.5) * 2 * ENEMY_AIM_SPREAD_RAD;
  }
  for (const off of ENEMY_STILL_SIM_ANGLE_OFFSETS) {
    if (simulateHitsPlayer(ship, ship.x, ship.y, base + off)) {
      return base + off + (Math.random() - 0.5) * 2 * ENEMY_STILL_AIM_SPREAD_RAD;
    }
  }
  const h = ship.length / 2;
  for (const yOff of ENEMY_STILL_SIM_Y_OFFSETS) {
    if (yOff === 0) {
      continue;
    }
    const testY = clamp(ship.y + yOff, h, canvas.height - h);
    const testAngle = Math.atan2(
      state.ship.y - testY,
      state.ship.x - ship.x,
    );
    let found = false;
    for (const aOff of ENEMY_STILL_SIM_ANGLE_OFFSETS) {
      if (simulateHitsPlayer(ship, ship.x, testY, testAngle + aOff)) {
        found = true;
        break;
      }
    }
    if (found) {
      ship.targetY = testY;
      ship.nextMoveAt = now + ENEMY_STAY_MAX_MS;
      break;
    }
  }
  return base + (Math.random() - 0.5) * 2 * ENEMY_STILL_AIM_SPREAD_RAD;
}

export function spawnEnemyProjectile(ship: EnemyShipState, now: number): void {
  const angle = findEnemyAimAngle(ship, now);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nose = ship.length / 2;
  state.enemyProjectiles.push({
    x: ship.x + dx * nose,
    y: ship.y + dy * nose,
    vx: dx * PROJECTILE_SPEED,
    vy: dy * PROJECTILE_SPEED,
    createdAt: now,
    canHitShipAfter: now + PROJECTILE_SHIP_COLLISION_GRACE_MS,
  });
  playShootSound(420);
}

function updateSingleEnemyShip(
  ship: EnemyShipState,
  deltaSeconds: number,
  now: number,
): void {
  if (!ship.active) {
    return;
  }
  if (ship.entering) {
    ship.x += ENEMY_ENTRY_SPEED * deltaSeconds;
    ship.angle = 0;
    const asteroidAreaLeft = state.asteroids.reduce(
      (minLeft, asteroid) => Math.min(minLeft, asteroid.x - asteroid.radius),
      canvas.width / 4,
    );
    const entryStopX = Math.max(
      ENEMY_MARGIN_LEFT,
      asteroidAreaLeft - ENEMY_MAX_ASTEROID_DISTANCE_PX,
    );
    if (ship.x >= entryStopX) {
      ship.x = entryStopX;
      ship.entering = false;
      ship.nextMoveAt = now + randomBetween(ENEMY_STAY_MIN_MS, ENEMY_STAY_MAX_MS);
    }
    return;
  }
  if (ship.nextMoveAt < 0) {
    ship.nextMoveAt = now + randomBetween(ENEMY_STAY_MIN_MS, ENEMY_STAY_MAX_MS);
  }
  if (now >= ship.nextMoveAt) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const h = ship.length / 2;
    let newTargetY = clamp(
      ship.y + dir * randomBetween(ENEMY_MOVE_MIN_PX, ENEMY_MOVE_MAX_PX),
      h,
      canvas.height - h,
    );
    const others = state.enemyShips.filter((s) => s.active && s !== ship);
    for (const other of others) {
      const dist = Math.abs(other.y - newTargetY);
      if (dist < ENEMY_MIN_SEPARATION) {
        const push = ENEMY_MIN_SEPARATION - dist;
        const sign = newTargetY >= other.y ? 1 : -1;
        newTargetY = clamp(
          newTargetY + sign * push,
          h,
          canvas.height - h,
        );
      }
    }
    ship.targetY = newTargetY;
    ship.nextMoveAt = now + randomBetween(ENEMY_STAY_MIN_MS, ENEMY_STAY_MAX_MS);
  }
  const dy = ship.targetY - ship.y;
  if (Math.abs(dy) > 2) {
    ship.y += Math.sign(dy) * ship.speedY * deltaSeconds;
    const h = ship.length / 2;
    ship.y = clamp(ship.y, h, canvas.height - h);
  }
  const others = state.enemyShips.filter((s) => s.active && s !== ship);
  for (const other of others) {
    const dist = Math.abs(other.y - ship.y);
    if (dist < ENEMY_MIN_SEPARATION && dist > 0) {
      const sign = ship.y >= other.y ? 1 : -1;
      const strength = (ENEMY_MIN_SEPARATION - dist) / ENEMY_MIN_SEPARATION;
      const h = ship.length / 2;
      ship.y = clamp(
        ship.y + sign * ENEMY_SEPARATION_FORCE * strength * deltaSeconds,
        h,
        canvas.height - h,
      );
    }
  }
  ship.angle = Math.atan2(
    state.ship.y - ship.y,
    state.ship.x - ship.x,
  );
  if (now - ship.lastFiredAt >= ENEMY_FIRE_INTERVAL_MS) {
    spawnEnemyProjectile(ship, now);
    ship.lastFiredAt = now;
  }
}

export function updateEnemyShip(deltaSeconds: number, now: number): void {
  if (!state.gameActive) {
    return;
  }
  for (const ship of state.enemyShips) {
    updateSingleEnemyShip(ship, deltaSeconds, now);
  }
  state.enemyShips = state.enemyShips.filter((s) => s.active || s.entering);
  const activeCount = state.enemyShips.filter((s) => s.active).length;
  if (
    state.enemyShips.length < ENEMY_MAX_COUNT &&
    activeCount < ENEMY_MAX_COUNT &&
    now >= state.nextEnemySpawnAt
  ) {
    addEnemyShip(now);
  }
}

export function drawEnemyShip(): void {
  for (const ship of state.enemyShips) {
    if (!ship.active) {
      continue;
    }
    const zx = ship.x * state.zoomLevel +
      (canvas.width * (1 - state.zoomLevel)) / 2;
    const zy = ship.y * state.zoomLevel +
      (canvas.height * (1 - state.zoomLevel)) / 2;
    const zl = ship.length * state.zoomLevel;
    const zw = ship.width * state.zoomLevel;
    context.save();
    context.translate(zx, zy);
    context.rotate(ship.angle);
    context.fillStyle = '#ff4444';
    context.beginPath();
    context.moveTo(zl / 2, 0);
    context.lineTo(-zl / 2, -zw / 2);
    context.lineTo(-zl / 2, zw / 2);
    context.closePath();
    context.fill();
    context.restore();
    drawEnergyBar(zx, zy, ship.energy, ENEMY_MAX_ENERGY, ENEMY_COLOR_RGB);
  }
}

export function updateEnemyProjectiles(
  deltaSeconds: number,
  now: number,
): void {
  const surviving: Projectile[] = [];
  const scr = Math.max(state.ship.length, state.ship.width) / 2;
  for (const p of state.enemyProjectiles) {
    if (state.asteroids.some((c) => isProjectileCollidingWithAsteroid(p.x, p.y, c))) {
      spawnParticles(
        p.x, p.y, calculateProjectileEnergy(p, now), '255, 68, 68', now,
      );
      continue;
    }
    if (
      now >= p.canHitShipAfter &&
      isProjectileCollidingWithTarget(p.x, p.y, state.ship.x, state.ship.y, scr)
    ) {
      const e = calculateProjectileEnergy(p, now);
      state.ship.energy = Math.max(0, state.ship.energy - e);
      spawnParticles(p.x, p.y, e, '255, 68, 68', now);
      triggerShake(now);
      continue;
    }
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
    const hdx = state.ship.x - p.x;
    const hdy = state.ship.y - p.y;
    const hdist = Math.hypot(hdx, hdy);
    if (hdist > 0) {
      ax += (hdx / hdist) * ENEMY_PROJECTILE_HOMING_ACCELERATION;
      ay += (hdy / hdist) * ENEMY_PROJECTILE_HOMING_ACCELERATION;
    }
    p.vx += ax * deltaSeconds;
    p.vy += ay * deltaSeconds;
    p.x += p.vx * deltaSeconds;
    p.y += p.vy * deltaSeconds;
    if (state.asteroids.some((c) => isProjectileCollidingWithAsteroid(p.x, p.y, c))) {
      spawnParticles(
        p.x, p.y, calculateProjectileEnergy(p, now), '255, 68, 68', now,
      );
      continue;
    }
    if (
      now >= p.canHitShipAfter &&
      isProjectileCollidingWithTarget(p.x, p.y, state.ship.x, state.ship.y, scr)
    ) {
      const e = calculateProjectileEnergy(p, now);
      state.ship.energy = Math.max(0, state.ship.energy - e);
      spawnParticles(p.x, p.y, e, '255, 68, 68', now);
      triggerShake(now);
      continue;
    }
    surviving.push(p);
  }
  state.enemyProjectiles = surviving.filter(
    (p) => now - p.createdAt <= PROJECTILE_MAX_LIFETIME_MS,
  );
}

export function drawEnemyProjectiles(now: number): void {
  for (const p of state.enemyProjectiles) {
    const alpha = Math.max(
      0,
      1 - (now - p.createdAt) / PROJECTILE_MAX_LIFETIME_MS,
    );
    const zx = p.x * state.zoomLevel +
      (canvas.width * (1 - state.zoomLevel)) / 2;
    const zy = p.y * state.zoomLevel +
      (canvas.height * (1 - state.zoomLevel)) / 2;
    context.fillStyle = `rgba(255, 68, 68, ${alpha})`;
    context.beginPath();
    context.arc(zx, zy, PROJECTILE_RADIUS * state.zoomLevel, 0, Math.PI * 2);
    context.fill();
  }
}
