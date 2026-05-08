export type Star = {
  x: number;
  y: number;
  alpha: number;
  size: number;
};
export type Crater = {
  offsetX: number;
  offsetY: number;
  radius: number;
};
export type Asteroid = {
  x: number;
  y: number;
  radius: number;
  mass: number;
  grayShade: number;
  craters: Crater[];
};
export type ShipState = {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  speedY: number;
  turnSpeed: number;
  energy: number;
};
export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};
export type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  createdAt: number;
  canHitShipAfter: number;
};
export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  createdAt: number;
  colorRGB: string;
};
export type EnemyShipState = {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  speedY: number;
  energy: number;
  lastFiredAt: number;
  active: boolean;
  targetY: number;
  nextMoveAt: number;
  entering: boolean;
  respawnAt: number;
};
