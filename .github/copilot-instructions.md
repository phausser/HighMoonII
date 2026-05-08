# Copilot Instructions

## Ziel
Dieses Dokument definiert, wie Copilot in `HighMoon2` arbeiten soll.

## Projektkontext
- Sprache: TypeScript 6
- Laufzeit: Browser mit Canvas 2D + Web Audio API
- Einstiegspunkt: `src/index.ts` (minimal, ruft nur Initialisierungsfunktionen auf)
- Build-Ausgabe: `dist/` (`tsc && cp assets/* dist/`)
- HTML-Start: `index.html` lädt `dist/index.js` (ES-Module, `type="module"`)
- Spiellogik ist in 14 TypeScript-Module aufgeteilt (siehe unten)

## Modulstruktur
| Datei | Inhalt |
|---|---|
| `src/types.ts` | Typen: `Star`, `Circle`, `ShipState`, `InputState`, `Projectile`, `Particle`, `EnemyShipState` |
| `src/constants.ts` | Alle Spielkonstanten (Gruppen: `STAR_*`, `SHIP_*`, `PROJECTILE_*`, `ZOOM_*`, `ENEMY_*`, `PARTICLE_*`, …) |
| `src/state.ts` | Canvas-Erstellung, `context`, globales `state`-Objekt |
| `src/utils.ts` | `randomBetween()`, `clamp()` |
| `src/stars.ts` | `createStars()`, `updateBlink()`, `drawStars()` |
| `src/asteroids.ts` | `calculateAsteroidMass()`, `createCircles()`, `drawCenterCircles()` |
| `src/physics.ts` | Kollisionsfunktionen, `calculateProjectileEnergy()`, `updateZoom()` |
| `src/particles.ts` | `spawnParticles()`, `triggerShake()`, `updateParticles()`, `drawParticles()` |
| `src/ship.ts` | `initializeOrClampShip()`, `spawnProjectile()`, `drawEnergyBar()`, `drawShip()`, `updateShip()`, `updateProjectiles()`, `drawProjectiles()` |
| `src/enemy.ts` | `initializeEnemyShip()`, `respawnEnemyShip()`, `spawnEnemyProjectile()`, `updateEnemyShip()`, `drawEnemyShip()`, `updateEnemyProjectiles()`, `drawEnemyProjectiles()` |
| `src/audio.ts` | `getAudioContext()`, `playShootSound()`, `playExplosionSound()`, `startMusic()` |
| `src/input.ts` | `setupInput()` – Tastatur-Events, Spielstart/-neustart |
| `src/render.ts` | `resizeCanvas()`, `render()` – Render-Loop, Score-Overlay, Spielzustand-Prompt |
| `src/index.ts` | Einstiegspunkt: ruft `resizeCanvas()`, `setupInput()`, `requestAnimationFrame(render)` auf |

## Arbeitsstil
- Bevorzuge kleine, gezielte Änderungen.
- Vermeide grosse Refactorings ohne explizite Anforderung.
- Erhalte bestehendes Verhalten, wenn nichts anderes verlangt ist.
- Nutze bestehende Muster und Konventionen in den jeweiligen Modulen.
- Neue Logik in das thematisch passende Modul; kein Aufbrechen der Modulstruktur ohne explizite Anforderung.

## Änderungen an der Szene
- Passe zuerst Konstanten in `src/constants.ts` an, bevor Logik umgebaut wird.
- Relevante Konstanten-Gruppen: `STAR_*`, `MIN_CIRCLE_*`, `MAX_CIRCLE_*`, `SHIP_*`, `PROJECTILE_*`, `ZOOM_*`, `ENEMY_*`, `PARTICLE_*`.
- Abstand zur Asteroidenfläche wird über Konstanten gesteuert: `SHIP_MAX_ASTEROID_DISTANCE_PX` (Spieler) und `ENEMY_MAX_ASTEROID_DISTANCE_PX` (Gegner).
- Halte Render-Reihenfolge stabil, ausser es ist explizit angefragt (definiert in `render.ts`).
- Beachte, dass die Szene browserbasiert bleibt (kein Framework/Bundler einführen).
- Standardverhalten beibehalten: Spielerschiff startet rechts mittig, schaut nach links (`angle = Math.PI`).
- Projektilverhalten beibehalten: `Space` schiesst eine kleine Kugel in Blickrichtung, geradlinig, max. 5 Sekunden Lebensdauer.
- **Zoom-System**: Kamera zoomt sanft heraus, wenn **Spieler-Projektile** den Bildschirmrand nähern (20 px Margin). Feind-Projektile beeinflussen den Zoom nicht. Sterne bleiben unverändert, nur Vordergrund-Objekte (Schiff, Projektile, Asteroiden) werden skaliert.

## Spielzustand (`state.ts`)
- `state.gameActive`: `false` = Splash-Screen oder Game-Over, `true` = Spiel läuft.
- `state.score`: Aktueller Score, wird 5-stellig oben mittig angezeigt.
- `state.enemyShotCount`: Schüsse des Spielers seit dem letzten Kill (für Score-Berechnung).
- `state.playerLastMovedAt`, `state.playerStillCheckX/Y`: Tracking der Spielerbewegung für intelligentes Gegner-Zielen.
- `state.shakeUntil`: Zeitstempel bis zum Ende des Bildschirmwackelns.
- `state.zoomLevel`: Aktueller Zoom-Faktor (0.5–1.0).
- `state.enemyShips`: Array aller aktiven `EnemyShipState`-Objekte (ersetzt das frühere `state.enemyShip`).
- `state.nextEnemySpawnAt`: Zeitstempel, wann das nächste Gegnerschiff gespawnt wird (`ENEMY_SPAWN_INTERVAL_MS`).

## Spielstart / Game-Over
- Erster `Enter`-Druck: `state.gameActive = true`, Energie zurücksetzen, `state.score = 0`, Musik starten (`startMusic()`), `state.enemyShips` mit einem frischen Gegner initialisieren.
- `Enter` während `!state.gameActive`: Neustart (gleiche Logik).
- Wenn `ship.energy <= 0` während `gameActive`: `gameActive = false`, Projektile leeren.
- Prompt blinkt synchron mit dem Schiff (300 ms Takt).
- `Space` feuert ein Projektil (nur während `gameActive`); startet/neustartet das Spiel **nicht** mehr.

## Zoom-Verhalten
- Zoom gilt ausschliesslich für Spieler-Projektile; Gegner-Projektile werden vollständig ignoriert.
- Präzise Berechnung des minimalen Zoom-Levels für alle Spieler-Projektile mit `PROJECTILE_MARGIN_FROM_EDGE`.
- Maximale Verkleinerung: `MIN_ZOOM = 0.5` (50 %). Jenseits dieser Grenze dürfen Projektile den sichtbaren Bereich verlassen.
- Automatisches Reinzoomen auf 1.0 wenn keine Spieler-Projektile mehr vorhanden sind.
- Zoom-Übergänge sind immer gleichmässig und nie ruckhaft – in beide Richtungen.
- Sternenhintergrund bleibt von Zoom unbeeinflusst.
- Zoom-Level zwischen `MIN_ZOOM` (0.5) und 1.0 begrenzt.

## Gegner-Verhalten
- Gegner-Schiff (rot) startet links auf Höhe `ENEMY_MARGIN_LEFT`.
- Gegner halten horizontal maximal `ENEMY_MAX_ASTEROID_DISTANCE_PX` Abstand zur linken Asteroidenfläche.
- Bewegt sich vertikal in Zufallsintervallen; Winkel zeigt immer auf Spielerschiff.
- Feuert alle `ENEMY_FIRE_INTERVAL_MS` ms ein lenkendes Projektil (Homing).
- **Intelligentes Zielen** (`ENEMY_STILL_*`-Konstanten): Steht der Spieler länger als `ENEMY_STILL_THRESHOLD_MS` still, simuliert `simulateHitsPlayer()` Projektilbahnen für verschiedene Winkel- und Y-Versatz-Kombinationen und wählt den treffsichersten.
- **Respawn**: Nach dem Tod fliegt nach `ENEMY_RESPAWN_DELAY_MS` ms ein neuer Gegner von links ausserhalb des Bildschirms ins Spielfeld (`entering`-Phase). Während der Entry-Phase kein Schuss.
- Entry-Stop ist dynamisch: `max(ENEMY_MARGIN_LEFT, asteroidAreaLeft - ENEMY_MAX_ASTEROID_DISTANCE_PX)`.
- Relevante Felder in `EnemyShipState`: `active`, `entering`, `respawnAt`, `targetY`, `nextMoveAt`, `lastFiredAt`.
- Respawn-Logik: `respawnEnemyShip(now)` setzt Position, Energie und Flags; `updateEnemyShip` steuert Entry-Bewegung und prüft `respawnAt`.

## Score-System
- Pro Abschuss: `Math.max(1, 101 - state.enemyShotCount)` Punkte.
- `state.enemyShotCount` wird bei jedem Spieler-Schuss (`spawnProjectile`) erhöht und bei jedem Respawn des Gegners (`respawnEnemyShip`) auf 0 zurückgesetzt.
- Score-Reset beim Spielstart (`Space` auf Splash/Game-Over-Screen).

## Input und Interaktion
- Vorhandene Steuerung mit Pfeiltasten nicht stillschweigend ändern.
- Neue Eingaben nur ergänzen, wenn gefordert.
- Bei Eingabeänderungen auf konsistentes `keydown`/`keyup` Verhalten achten.
- `Space` feuert ein Projektil pro Tastendruck (nur während `gameActive`); kein Dauerfeuer oder geändertes Repeat-Verhalten einführen.
- `Enter` startet/neustartet das Spiel, wenn `!state.gameActive`.

## Build und Validierung
- Nach jeder Codeänderung `npm run build` ausführen (`tsc && cp assets/* dist/`).
- TypeScript-Fehler vor Abschluss beheben.
- Bei visuellen Änderungen kurze manuelle Browser-Prüfung empfehlen.

## Abhängigkeiten
- Keine unnötigen neuen Pakete installieren.
- Vorhandenes Setup mit `tsc` beibehalten (kein Bundler einführen).
- Web Audio API ist bereits genutzt (kein externes Audio-Paket einführen).

## Sound-System
- Audio wird per Web Audio API synthetisiert; keine externen Audio-Dateien für Effekte.
- `getAudioContext()` initialisiert den `AudioContext` lazy (erst bei erster Nutzerinteraktion).
- `playShootSound(pitchHz)` erzeugt einen kurzen Sinuston mit Frequenzabfall (Spieler: 880 Hz, Gegner: 420 Hz).
- `playExplosionSound(energy)` erzeugt einen White-Noise-Burst mit Tiefpassfilter; Lautstärke und Grenzfrequenz skalieren mit `energy` (0–100).
- `startMusic()` spielt `dist/cosmic-coin-chase.mp3` als geloopte Hintergrundmusik.
- Neue Soundeffekte immer in `try/catch` kapseln – Audio-Fehler stillschweigend ignorieren.
- Kein Autoplay-Problem: `AudioContext` wird nur nach Nutzerinteraktion erstellt/resumed.

## Code Style
Massgeblicher Style Guide: **[ts.dev/style](https://ts.dev/style/)** (Google TypeScript Style Guide).

| Thema | Regel |
|---|---|
| **Anführungszeichen** | Einfache Quotes `'…'` für alle String-Literale; Template-Literal `` `…` `` wenn der String selbst `'` enthält |
| **Statements** | Genau ein Statement pro Zeile – kein `;`-getrenntes Mehrfach-Statement |
| **Variablen-Deklarationen** | Kein Komma-Mehrfach-`const`/`let` in einer Zeile (`const a = 1, b = 2` → zwei Zeilen) |
| **Naming** | `camelCase` Variablen/Funktionen/Parameter · `PascalCase` Typen · `UPPER_SNAKE_CASE` Modul-Konstanten |
| **Typen** | `type` statt `interface` für Objekt-Shapes |
| **Imports** | `import type` für reine Typ-Imports; kein `import *`; Pfade enden auf `.js` |
| **Exports** | Nur benannte Exports – kein `export default` |
| **Return-Typen** | Explizite Return-Typen an allen exportierten Funktionen |
| **Blöcke** | Immer geschweifte Klammern bei `if`/`for`/`else` – kein einzeiliges Statement ohne Block |
| **null vs. undefined** | `undefined` bevorzugen; `null` nur wo die Browser-API es erwartet |
| **Zeilenlänge** | ≤ 80 Zeichen anstreben |

## Dateigrenzen
- Logik gehört in das thematisch passende Modul in `src/`; keine weitere Aufteilung ohne explizite Anforderung.
- `src/index.ts` bleibt der minimale Einstiegspunkt.
- `dist/` ist Build-Artefakt und wird aus TypeScript sowie `assets/` erzeugt.
- `assets/` enthält Quell-Assets (CSS, MP3), die beim Build nach `dist/` kopiert werden.
