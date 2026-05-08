import { BACKGROUND_COLOR, SHAKE_DURATION_MS, SHAKE_INTENSITY } from './constants.js';
import { state, canvas, context } from './state.js';
import { createStars, updateBlink, drawStars } from './stars.js';
import { createAsteroids, drawAsteroids } from './asteroids.js';
import { updateZoom } from './physics.js';
import { updateParticles, drawParticles } from './particles.js';
import {
  initializeOrClampShip, updateShip, drawShip,
  updateProjectiles, drawProjectiles,
} from './ship.js';
import {
  initializeEnemyShip, updateEnemyShip, drawEnemyShip,
  updateEnemyProjectiles, drawEnemyProjectiles,
} from './enemy.js';

export function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.stars = createStars(canvas.width, canvas.height);
  state.asteroids = createAsteroids(canvas.width, canvas.height);
  initializeOrClampShip(canvas.width, canvas.height);
  initializeEnemyShip(canvas.width, canvas.height);
}

export function render(now: number): void {
  const deltaSeconds = state.lastFrameTime === 0 ? 0 : (now - state.lastFrameTime) / 1000;
  state.lastFrameTime = now;

  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, canvas.width, canvas.height);

  updateBlink(now);
  updateShip(deltaSeconds, now);
  updateEnemyShip(deltaSeconds, now);
  updateProjectiles(deltaSeconds, now);
  updateEnemyProjectiles(deltaSeconds, now);
  updateParticles(deltaSeconds, now);
  updateZoom(deltaSeconds);

  if (state.gameActive && state.ship.energy <= 0) {
    state.gameActive = false;
    state.projectiles = [];
    state.enemyProjectiles = [];
  }

  context.save();
  if (now < state.shakeUntil) {
    const progress = (state.shakeUntil - now) / SHAKE_DURATION_MS;
    const intensity = SHAKE_INTENSITY * progress;
    context.translate(
      (Math.random() * 2 - 1) * intensity,
      (Math.random() * 2 - 1) * intensity,
    );
  }

  drawStars(now);
  drawAsteroids();
  drawParticles(now);
  drawProjectiles(now);
  drawEnemyProjectiles(now);
  drawEnemyShip();
  drawShip();
  context.restore();

  // Score-Overlay oben mittig
  context.save();
  context.font = `normal 16px 'Varela Round', monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.fillStyle = 'rgba(255, 255, 255, 0.85)';
  context.fillText(`SCORE ${('00000' + state.score).slice(-5)}`, canvas.width / 2, 16);
  context.restore();

  // Prompt anzeigen wenn Spiel nicht aktiv (blinkt synchron mit dem Schiff)
  if (!state.gameActive && Math.floor(performance.now() / 300) % 2 !== 0) {
    const promptText = state.ship.energy <= 0
      ? 'GAME OVER \u2013 PRESS RETURN'
      : 'PRESS RETURN TO START';
    context.save();
    context.font = `normal 32px 'Varela Round', monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(255, 255, 255, 0.85)';
    context.fillText(promptText, canvas.width / 2, canvas.height / 2);
    context.restore();
  }

  requestAnimationFrame(render);
}

