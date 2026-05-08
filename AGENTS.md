# AGENTS.md

## Zweck
Dieses Dokument gibt Agenten einen schnellen, verlässlichen Überblick über das Projekt `HighMoon2` und die erwartete Arbeitsweise bei Änderungen.

## Projektstatus (Ist-Zustand)
- Sprache: TypeScript 6
- Laufzeit: Browser (Canvas 2D + Web Audio API)
- Build: `tsc && cp assets/* dist/` (kein Bundler, kein Framework)
- Einstiegscode: `src/index.ts` (minimal – ruft nur Initialisierungsfunktionen auf)
- Kompilat: `dist/` (JS-Module + kopierte Assets)
- HTML-Einstieg: `index.html` lädt `dist/index.js` als ES-Modul
- Spielerschiff startet rechts mittig, schaut nach links (`angle = Math.PI`).
- Gegnerschiff startet links, schaut auf den Spieler.
- Horizontaler Abstand zur Asteroidenfläche ist begrenzt über `SHIP_MAX_ASTEROID_DISTANCE_PX` (Spieler) und `ENEMY_MAX_ASTEROID_DISTANCE_PX` (Gegner).

## Relevante Dateien
- `package.json`: Build-Skript (`tsc && cp assets/* dist/`) und Abhängigkeiten (nur `typescript`)
- `tsconfig.json`: `rootDir: src`, `outDir: dist`, `module: es2015`, `moduleResolution: bundler`, `strict: true`
- `index.html`: Vollbild-Canvas-Seite; lädt `dist/styles.css` und `dist/index.js`
- `assets/styles.css`: Quell-Stylesheet (wird beim Build nach `dist/` kopiert)
- `assets/cosmic-coin-chase.mp3`: Hintergrundmusik (wird beim Build nach `dist/` kopiert)

## Modulstruktur (`src/`)
| Modul | Exportierte Funktionen / Inhalte |
|---|---|
| `types.ts` | `Star`, `Circle`, `ShipState`, `InputState`, `Projectile`, `Particle`, `EnemyShipState` |
| `constants.ts` | Alle Spielkonstanten (`STAR_*`, `SHIP_*`, `PROJECTILE_*`, `ZOOM_*`, `ENEMY_*`, `PARTICLE_*`, …) |
| `state.ts` | `canvas`, `context`, `state` (globales Spielzustand-Objekt) |
| `utils.ts` | `randomBetween(min, max)`, `clamp(value, min, max)` |
| `stars.ts` | `createStars(w, h)`, `updateBlink(now)`, `drawStars(now)` |
| `asteroids.ts` | `calculateAsteroidMass(radius)`, `createCircles(w, h)`, `drawCenterCircles()` |
| `physics.ts` | `isProjectileCollidingWithAsteroid()`, `isProjectileCollidingWithTarget()`, `isProjectileCollidingWithShip()`, `calculateProjectileEnergy()`, `updateZoom(dt)` |
| `particles.ts` | `spawnParticles(x, y, energy, colorRGB, now)`, `triggerShake(now)`, `updateParticles(dt, now)`, `drawParticles(now)` |
| `ship.ts` | `initializeOrClampShip(w, h)`, `spawnProjectile(now)`, `drawEnergyBar(x, y, energy, max)`, `drawShip()`, `updateShip(dt, now)`, `updateProjectiles(dt, now)`, `drawProjectiles(now)` |
| `enemy.ts` | `initializeEnemyShip(w, h)`, `respawnEnemyShip(now)`, `spawnEnemyProjectile(now)`, `updateEnemyShip(dt, now)`, `drawEnemyShip()`, `updateEnemyProjectiles(dt, now)`, `drawEnemyProjectiles(now)` |
| `audio.ts` | `getAudioContext()`, `playShootSound(pitchHz)`, `playExplosionSound(energy)`, `startMusic()` |
| `input.ts` | `setupInput()` |
| `render.ts` | `resizeCanvas()`, `render(now)` |
| `index.ts` | Einstiegspunkt: `resizeCanvas()`, `setupInput()`, `requestAnimationFrame(render)` |

## Build und Ausführung
### Build
```bash
npm run build
```
Kompiliert TypeScript nach `dist/` und kopiert `assets/*` nach `dist/`.

### Im Browser starten
Nach dem Build `index.html` im Browser öffnen.

## Render-Reihenfolge (pro Frame, in `render.ts`)
1. Hintergrundfüllung (`BACKGROUND_COLOR`)
2. Bildschirmwackeln (`context.translate` bei aktivem Shake)
3. Sterne – `drawStars(now)` (vom Zoom unberührt)
4. Asteroiden – `drawCenterCircles()` (skaliert durch Zoom)
5. Partikel – `drawParticles(now)` (skaliert durch Zoom)
6. Spieler-Projektile – `drawProjectiles(now)` (skaliert durch Zoom)
7. Gegner-Projektile – `drawEnemyProjectiles(now)` (skaliert durch Zoom)
8. Gegnerschiff – `drawEnemyShip()` (skaliert durch Zoom)
9. Spielerschiff – `drawShip()` (skaliert durch Zoom)
10. Score-Overlay – `SCORE 00000` oben mittig (kein Zoom)
11. Spielzustand-Prompt – „PRESS SPACE TO START" / „GAME OVER – PRESS SPACE" (blinkt, kein Zoom)

## Globales State-Objekt (`state.ts`)
```typescript
state = {
  stars, circles, projectiles, enemyProjectiles, particles,
  ship: ShipState,
  enemyShips: EnemyShipState[],  // Array – ersetzt das frühere enemyShip
  input: InputState,
  blinkingStarIndex, blinkUntil, nextBlinkAt,
  lastFrameTime,
  zoomLevel,         // aktueller Zoom-Faktor (0.5–1.0)
  shakeUntil,        // Zeitstempel Ende Bildschirmwackeln
  playerLastMovedAt, // für intelligentes Gegner-Zielen
  playerStillCheckX, playerStillCheckY,
  gameActive,        // false = Splash/Game-Over, true = Spiel läuft
  score,             // aktueller Score (5-stellig angezeigt)
  enemyShotCount,    // Spieler-Schüsse seit letztem Kill (für Score)
  nextEnemySpawnAt,  // Zeitstempel nächster Gegner-Spawn (ENEMY_SPAWN_INTERVAL_MS)
}
```

## Spielstart / Game-Over-Logik
- Erster `Enter`-Druck → `gameActive = true`, Energie reset, `score = 0`, `startMusic()`, `enemyShips` mit einem frischen Gegner initialisiert, `nextEnemySpawnAt` gesetzt.
- Während `gameActive`: `ship.energy <= 0` → `gameActive = false`, Projektile leeren.
- Prompt „PRESS ENTER TO START" oder „GAME OVER – PRESS ENTER" blinkt im 300 ms Takt.
- Nächster `Enter`-Druck → Neustart.
- `Space` feuert während `gameActive` ein Projektil; startet/neustartet das Spiel nicht.

## Score-System
- Pro Gegner-Kill: `state.score += Math.max(1, 101 - state.enemyShotCount)`
- `state.enemyShotCount` inkrementiert in `spawnProjectile()`; wird in `respawnEnemyShip()` auf 0 zurückgesetzt.
- Score-Reset beim Spielstart.

## Spieler-Projektile
- Fliegen geradlinig in Blickrichtung, werden von Asteroiden gravitativ abgelenkt.
- Maximal 5 Sekunden Lebensdauer (`PROJECTILE_MAX_LIFETIME_MS`); Schaden nimmt mit Alter ab.
- Zoom-System in `physics.ts`: Kamera zoomt sanft und gleichmässig heraus, um Spieler-Projektile mit 20 px Margin (`PROJECTILE_MARGIN_FROM_EDGE`) sichtbar zu halten.
- Maximale Verkleinerung: 50 % (`MIN_ZOOM = 0.5`). Jenseits dieser Grenze dürfen Projektile den Bildschirm verlassen.
- Feind-Projektile beeinflussen den Zoom **nicht**.

## Gegner-System
- `EnemyShipState`: `active`, `entering`, `respawnAt`, `targetY`, `nextMoveAt`, `lastFiredAt` u. a.
- Konstanten-Gruppe: `ENEMY_*` (z. B. `ENEMY_MARGIN_LEFT`, `ENEMY_MAX_ASTEROID_DISTANCE_PX`, `ENEMY_FIRE_INTERVAL_MS`, `ENEMY_RESPAWN_DELAY_MS`, `ENEMY_ENTRY_SPEED`, `ENEMY_STILL_THRESHOLD_MS`).
- Gegner zielt immer auf den Spieler und feuert Homing-Projektile (rote Kugeln).
- **Intelligentes Zielen**: Bewegt sich der Spieler länger als `ENEMY_STILL_THRESHOLD_MS` nicht, simuliert `simulateHitsPlayer()` Projektilbahnen für Winkel- und Y-Versatz-Kombinationen (`ENEMY_STILL_SIM_ANGLE_OFFSETS`, `ENEMY_STILL_SIM_Y_OFFSETS`). `findEnemyAimAngle()` wählt den treffsichersten Winkel.
- **Respawn-Ablauf**:
  1. `active = false`, `respawnAt = now + ENEMY_RESPAWN_DELAY_MS` bei Tod.
  2. `updateEnemyShip` prüft `respawnAt` und ruft `respawnEnemyShip(now)` auf.
  3. `respawnEnemyShip` positioniert den Gegner links ausserhalb des Bildschirms (`x = -length * 2`), setzt `entering = true` und `active = true`.
  4. Entry-Phase: Gegner bewegt sich mit `ENEMY_ENTRY_SPEED` nach rechts bis `max(ENEMY_MARGIN_LEFT, asteroidAreaLeft - ENEMY_MAX_ASTEROID_DISTANCE_PX)`; kein Schuss in dieser Phase.
  5. Nach Ankunft: `entering = false`, normaler Kampfmodus.

## Arbeitsregeln für Agenten
- Kleine, gezielte Änderungen bevorzugen; bestehendes Verhalten nur ändern, wenn angefordert.
- Bei visuellen Parametern zuerst Konstanten in `src/constants.ts` anpassen statt Logik gross umzubauen.
- Neue Logik in das thematisch passende Modul – keine Änderung der Modulstruktur ohne explizite Anforderung.
- Nach Codeänderungen `npm run build` ausführen und TypeScript-Fehler beheben.
- Keine unnötigen neuen Abhängigkeiten einführen.
- Ausgabe bleibt browserbasiert über `index.html` + `dist/`.

## Sound-System
- Audio wird ausschliesslich per Web Audio API synthetisiert – keine externen Audiodateien für Soundeffekte.
- `getAudioContext()` erzeugt den `AudioContext` lazy (erst nach erster Nutzerinteraktion); kein Autoplay-Problem.
- `playShootSound(pitchHz)`: kurzer Sinuston mit exponentiell fallender Frequenz. Spieler → 880 Hz, Gegner → 420 Hz.
- `playExplosionSound(energy)`: White-Noise-Burst durch einen Tiefpassfilter; Lautstärke und Grenzfrequenz skalieren mit `energy` (0–100).
- `startMusic()`: Spielt `dist/cosmic-coin-chase.mp3` geloopt mit 0.5 Lautstärke; Fehler werden ignoriert.
- Alle Audio-Funktionen sind in `try/catch` gekapselt – Fehler werden still ignoriert.
- Aufrufstellen: `spawnProjectile` (Spieler-Schuss), `spawnEnemyProjectile` (Gegner-Schuss), `spawnParticles` (Explosion), `setupInput` (Spielstart → Musik).

## Code Style
Massgeblicher Style Guide: **[ts.dev/style](https://ts.dev/style/)** (Google TypeScript Style Guide).

| Thema | Regel |
|---|---|
| **Anführungszeichen** | Einfache Quotes `'…'` für alle String-Literale; Template-Literal `` `…` `` wenn der String selbst `'` enthält |
| **Statements** | Genau ein Statement pro Zeile – kein `;`-getrenntes Mehrfach-Statement |
| **Variablen-Deklarationen** | Kein Komma-Mehrfach-`const`/`let` (`const a = 1, b = 2` → zwei separate Zeilen) |
| **Naming** | `camelCase` Variablen/Funktionen/Parameter · `PascalCase` Typen · `UPPER_SNAKE_CASE` Modul-Konstanten |
| **Typen** | `type` statt `interface` für Objekt-Shapes |
| **Imports** | `import type` für reine Typ-Imports; kein `import *`; Pfade enden auf `.js` |
| **Exports** | Nur benannte Exports – kein `export default` |
| **Return-Typen** | Explizite Return-Typen an allen exportierten Funktionen |
| **Blöcke** | Immer geschweifte Klammern bei `if`/`for`/`else` – kein einzeiliges Statement ohne Block |
| **null vs. undefined** | `undefined` bevorzugen; `null` nur wo die Browser-API es erwartet |
| **Zeilenlänge** | ≤ 80 Zeichen anstreben |

Durchsetzung erfolgt durch Code-Review und diese Dokumentation (kein Linter konfiguriert).
Optional: `npx gts init` würde ESLint mit ts.dev/style-Regeln einrichten – nur auf explizite Anforderung.

## Bekannte Besonderheiten
- `dist/` ist Build-Artefakt aus `tsc` + `cp assets/* dist/`.
- Es gibt aktuell keine automatisierten Tests; Absicherung erfolgt primär über Build und manuelle Sichtprüfung im Browser.
- `tsconfig.json` nutzt `moduleResolution: bundler` – Imports in Quelldateien enden auf `.js` (Laufzeit-Auflösung durch den Browser).
