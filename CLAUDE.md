# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Asteroids clone in plain HTML5 Canvas + vanilla JS. No dependencies, bundler, linter or tests. UI text and comments are in Spanish.

## Running

Open `index.html` in a browser, or serve statically: `npx serve .` (then http://localhost:3000). There is no build step.

## Architecture

All game logic lives in `game.js` (loaded by `index.html` via a plain `<script>`, strict mode). The canvas is fixed at 800x600 (`W`/`H` constants in `game.js` must match the `<canvas>` attributes in `index.html`).

- **Entities** (`Bullet`, `Asteroid`, `Ship`, `Particle`): each has `update(dt)` and `draw()`, uses a `dead` flag, and draws directly to the global `ctx`. Space is toroidal — positions use `wrap()`, except particles, which don't wrap.
- **Game state**: module-level globals (`ship`, `bullets`, `asteroids`, `particles`, `score`, `lives`, `level`) plus `state` = `'playing' | 'dead' | 'gameover'`. `dead` is the respawn delay (`deadTimer`); during it only particles/asteroids update.
- **Loop**: `loop()` → `update(dt)` → `draw()`; `dt` is in seconds and clamped to 0.05. Entity arrays are reassigned via `.filter()` each frame to drop dead entries.
- **Input**: `keys[code]` is held state; `pressed(code)` is a one-shot "just pressed" read that consumes the flag (used for Space, so shooting is not auto-repeat).
- **Per-size asteroid tables** `RADII`, `SPEEDS`, `POINTS` are indexed by size 1–3 (index 0 unused). `split()` produces two asteroids of size-1.
- Collisions are circle-based using `dist()`; ship-vs-asteroid uses `a.radius * 0.82` for leniency, and is skipped while `ship.invincible > 0`.
- Level progression: when `asteroids` is empty, `nextLevel()` spawns `3 + level` large asteroids outside a safe radius around the center.

## Note

`README.md` mentions power-ups and a "shooting star" asteroid type. Two power-ups are implemented (`PowerUp` class with a `type`, held in the `powerUps` array; config in `POWERUP_TYPES`): **Disparo Triple** (globals `powerUpSpawned`, `tripleShotTimer`, `tripleLevel`; spawns once per game, in the random level `tripleLevel`; 8 s fan-shot handled in `Ship.tryShoot()`) and **Escudo Temporal** (globals `shieldSpawned`, `shieldSpawnTimer`, `shieldTimer`; spawns once per level except in `tripleLevel`; lasts 8 s or until it absorbs one asteroid hit, which also destroys that asteroid). Per-level spawn timers are reset in `resetRoundPowerUps()`. A third, **Bomba Nova** (globals `bombSpawnTimer`, `hasBomb`, `bombFlash`), is rare (`BOMB_CHANCE` per level, independent of the other two): picking it up stores one charge, and pressing `B` runs `detonateBomb()`, which destroys every asteroid (no splitting, points awarded) with a white flash. The shooting-star asteroid is not implemented.
