import {
  PROJECTILE_RADIUS, PROJECTILE_COLLISION_MARGIN, PROJECTILE_MAX_LIFETIME_MS,
  PROJECTILE_MARGIN_FROM_EDGE, MIN_ZOOM, ZOOM_IN_SPEED, ZOOM_OUT_SPEED,
} from './constants.js';
import type { Asteroid, Projectile } from './types.js';
import { state, canvas } from './state.js';

export function isProjectileCollidingWithAsteroid(px: number, py: number, circle: Asteroid): boolean {
  const dx = circle.x - px;
  const dy = circle.y - py;
  const collisionDistance = circle.radius + PROJECTILE_RADIUS + PROJECTILE_COLLISION_MARGIN;
  return dx * dx + dy * dy <= collisionDistance * collisionDistance;
}

export function isProjectileCollidingWithTarget(
  px: number, py: number,
  targetX: number, targetY: number,
  targetCollisionRadius: number,
): boolean {
  const dx = targetX - px;
  const dy = targetY - py;
  const collisionDistance = targetCollisionRadius + PROJECTILE_RADIUS + PROJECTILE_COLLISION_MARGIN;
  return dx * dx + dy * dy <= collisionDistance * collisionDistance;
}

export function isProjectileCollidingWithShip(px: number, py: number): boolean {
  const shipCollisionRadius = Math.max(state.ship.length, state.ship.width) / 2;
  return isProjectileCollidingWithTarget(px, py, state.ship.x, state.ship.y, shipCollisionRadius);
}

export function calculateProjectileEnergy(projectile: Projectile, now: number): number {
  const age = now - projectile.createdAt;
  const energyPercent = Math.max(0, 1 - age / PROJECTILE_MAX_LIFETIME_MS);
  return energyPercent * 100;
}

export function updateZoom(deltaSeconds: number): void {
  if (state.projectiles.length === 0) {
    state.zoomLevel = Math.min(1.0, state.zoomLevel + ZOOM_IN_SPEED * deltaSeconds);
    return;
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of state.projectiles) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const cW = maxX - minX, cH = maxY - minY;
  const cX = (minX + maxX) / 2, cY = (minY + maxY) / 2;
  const oX = Math.abs(cX - canvas.width / 2), oY = Math.abs(cY - canvas.height / 2);
  const rW = cW + 2 * PROJECTILE_RADIUS + 2 * PROJECTILE_MARGIN_FROM_EDGE + 2 * oX;
  const rH = cH + 2 * PROJECTILE_RADIUS + 2 * PROJECTILE_MARGIN_FROM_EDGE + 2 * oY;
  const target = Math.max(MIN_ZOOM, Math.min(1.0, Math.min(canvas.width / rW, canvas.height / rH)));
  if (target < state.zoomLevel) {
    state.zoomLevel = Math.max(target, state.zoomLevel - ZOOM_OUT_SPEED * deltaSeconds);
  } else {
    state.zoomLevel = Math.min(target, state.zoomLevel + ZOOM_IN_SPEED * deltaSeconds);
  }
}