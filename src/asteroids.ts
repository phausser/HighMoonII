import {
  ASTEROID_COUNT, MIN_ASTEROID_RADIUS, MAX_ASTEROID_RADIUS, MIN_ASTEROID_GAP,
  MAX_ATTEMPTS_PER_ASTEROID, ASTEROID_GRAY_MIN, ASTEROID_GRAY_MAX, ASTEROID_DENSITY,
  CRATER_COUNT_MIN, CRATER_COUNT_MAX, CRATER_RADIUS_MIN, CRATER_RADIUS_MAX,
  CRATER_EDGE_MARGIN,
} from './constants.js';
import type { Asteroid, Crater } from './types.js';
import { randomBetween } from './utils.js';
import { state, canvas, context } from './state.js';

export function calculateAsteroidMass(radius: number): number {
  return ASTEROID_DENSITY * ((4 / 3) * Math.PI * radius * radius * radius);
}

function generateCraters(radius: number): Crater[] {
  const craters: Crater[] = [];
  const craterCount = Math.floor(
    randomBetween(CRATER_COUNT_MIN, CRATER_COUNT_MAX + 1),
  );
  for (let i = 0; i < craterCount; i++) {
    let craterCandidate: Crater | undefined = undefined;
    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = randomBetween(0, Math.PI * 2);
      const craterRadius = randomBetween(CRATER_RADIUS_MIN, CRATER_RADIUS_MAX);
      const maxDistanceFromCenter = Math.max(
        0,
        radius - craterRadius - radius * CRATER_EDGE_MARGIN / 100,
      );
      const distance =
        Math.sqrt(randomBetween(0, 1)) * maxDistanceFromCenter;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      const candidate: Crater = { offsetX, offsetY, radius: craterRadius };

      let overlaps = false;
      for (const existing of craters) {
        const dist = Math.hypot(
          candidate.offsetX - existing.offsetX,
          candidate.offsetY - existing.offsetY,
        );
        if (dist < candidate.radius + existing.radius + 1) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        craterCandidate = candidate;
        break;
      }
    }

    if (craterCandidate) {
      craters.push(craterCandidate);
    }
  }
  return craters;
}

export function createAsteroids(width: number, height: number): Asteroid[] {
  const minX = width / 4, maxX = (width * 3) / 4;
  const minY = height / 4, maxY = (height * 3) / 4;
  const result: Asteroid[] = [];
  let minGap = MIN_ASTEROID_GAP;
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    let selected: Asteroid | null = null;
    let bestCandidate: Asteroid | null = null;
    let bestGap = -Infinity;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_ASTEROID; attempt++) {
      const candidate: Asteroid = {
        x: randomBetween(minX, maxX), y: randomBetween(minY, maxY),
        radius: randomBetween(MIN_ASTEROID_RADIUS, MAX_ASTEROID_RADIUS), mass: 0,
        grayShade: Math.floor(randomBetween(ASTEROID_GRAY_MIN, ASTEROID_GRAY_MAX)),
        craters: [],
      };
      candidate.mass = calculateAsteroidMass(candidate.radius);
      candidate.craters = generateCraters(candidate.radius);
      let smallestEdgeGap = Infinity;
      for (const existing of result) {
        const edgeGap = Math.hypot(candidate.x - existing.x, candidate.y - existing.y) - (candidate.radius + existing.radius);
        smallestEdgeGap = Math.min(smallestEdgeGap, edgeGap);
      }
      if (result.length === 0 || smallestEdgeGap >= minGap) { selected = candidate; break; }
      if (smallestEdgeGap > bestGap) { bestGap = smallestEdgeGap; bestCandidate = candidate; }
    }
    if (!selected) {
      minGap = Math.max(6, minGap * 0.85);
      selected = bestCandidate ?? {
        x: randomBetween(minX, maxX), y: randomBetween(minY, maxY),
        radius: randomBetween(MIN_ASTEROID_RADIUS, MAX_ASTEROID_RADIUS), mass: 0,
        grayShade: Math.floor(randomBetween(ASTEROID_GRAY_MIN, ASTEROID_GRAY_MAX)),
        craters: [],
      };
      if (selected.mass === 0) selected.mass = calculateAsteroidMass(selected.radius);
      if (selected.craters.length === 0) {
        selected.craters = generateCraters(selected.radius);
      }
    }
    result.push(selected);
  }
  return result;
}

export function drawAsteroids(): void {
  for (const asteroid of state.asteroids) {
    const g = asteroid.grayShade;
    const d = g * 0.7;
    const zx =
      asteroid.x * state.zoomLevel +
      (canvas.width * (1 - state.zoomLevel)) / 2;
    const zy =
      asteroid.y * state.zoomLevel +
      (canvas.height * (1 - state.zoomLevel)) / 2;
    const zr = asteroid.radius * state.zoomLevel;

    // Grundkörper
    context.fillStyle = `rgb(${d}, ${d}, ${d})`;
    context.beginPath();
    context.arc(zx, zy, zr, 0, Math.PI * 2);
    context.fill();

    // per clip() auf den Asteroiden-Bereich begrenzt → Sichelform
    context.save();
    context.beginPath();
    context.arc(zx, zy, zr, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = `rgb(${g}, ${g}, ${g})`;
    context.beginPath();
    context.arc(
      zx - zr * 0.15,
      zy - zr * 0.15,
      zr * 0.90,
      0, Math.PI * 2,
    );
    context.fill();
    context.restore();

    // Krater als kleine dunkle Halbmonde auf der Schattenseite
    for (const crater of asteroid.craters) {
      const craterX = zx - zr * 0.15 + crater.offsetX * state.zoomLevel;
      const craterY = zy - zr * 0.15 + crater.offsetY * state.zoomLevel;
      const craterR = crater.radius * state.zoomLevel;

      context.save();
      context.beginPath();
      context.arc(craterX, craterY, craterR, 0, Math.PI * 2);
      context.clip();

      context.fillStyle = `rgb(${d}, ${d}, ${d})`;
      context.beginPath();
      context.arc(
        craterX,
        craterY,
        craterR,
        0, Math.PI * 2,
      );
      context.fill();

      context.fillStyle = `rgb(${g}, ${g}, ${g})`;
      context.beginPath();
      context.arc(
        craterX + craterR * 0.15,
        craterY + craterR * 0.15,
        craterR * 0.8,
        0, Math.PI * 2
      );
      context.fill();

      context.restore();
    }
  }
}
