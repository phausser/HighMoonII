import { randomBetween } from './utils.js';
import { state, canvas } from './state.js';
import { resizeCanvas, render } from './render.js';
import { createAsteroids } from './asteroids.js';
import { setupInput } from './input.js';

resizeCanvas();
state.asteroids = createAsteroids(canvas.width, canvas.height);
state.nextBlinkAt = performance.now() + randomBetween(600, 1800);
window.addEventListener("resize", resizeCanvas);
setupInput();
requestAnimationFrame(render);
