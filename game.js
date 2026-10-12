'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// Forma fija de asteroide grande, vértices normalizados (radio = 1)
const BIG_SHAPE = [
  [-0.113, -0.979], [0.444, -0.810], [0.331, -0.218], [0.894, -0.049],
  [0.732, 0.563], [0.239, 0.542], [0.007, 0.937], [-0.676, 0.606],
  [-1.0, 0.028], [-0.852, -0.585],
];
const BIG_SHAPE_CHANCE = 0.25;  // probabilidad de que un asteroide grande use esta forma

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    this.verts = [];
    if (size === 3 && Math.random() < BIG_SHAPE_CHANCE) {
      // Variante fija (forma de la imagen proporcionada)
      for (const [ux, uy] of BIG_SHAPE)
        this.verts.push([ux * this.radius, uy * this.radius]);
    } else {
      // Polígono irregular
      const n = randInt(8, 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (tripleShotTimer > 0) {
      const SPREAD = 0.2;  // rad entre balas del abanico
      return [-SPREAD, 0, SPREAD].map(d => new Bullet(ox, oy, this.angle + d));
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-ups: Disparo Triple y Escudo Temporal ───────────────────────────────
const TRIPLE_DURATION = 8;   // segundos de efecto
const SHIELD_DURATION = 8;  // segundos de efecto (o hasta recibir un golpe)
const SHIELD_PAD      = 9;   // holgura del escudo respecto al radio de la nave
const POWERUP_TYPES = {
  triple: { color: '#0ff', label: '3' },
  shield: { color: '#4f4', label: 'E' },
  bomb:   { color: '#f80', label: 'B' },
};
const BOMB_CHANCE = 0.3;     // probabilidad por ronda de que aparezca la Bomba Nova
const BOMB_FLASH  = 0.5;     // segundos del destello al detonar

class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * 40;
    this.vy = Math.sin(angle) * 40;
    this.radius = 12;
    this.ttl  = 12;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo durante los últimos 3 s
    if (this.ttl < 3 && Math.floor(this.ttl * 8) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    const { color, label } = POWERUP_TYPES[this.type];
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let score, lives, level;
let powerUps, powerUpSpawned, powerUpSpawnTimer, tripleShotTimer, tripleLevel;
let shieldSpawned, shieldSpawnTimer, shieldTimer;
let bombSpawnTimer, hasBomb, bombFlash;   // bombSpawnTimer < 0: no aparece esta ronda
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  powerUps          = [];
  powerUpSpawned    = false;      // el triple aparece una sola vez por partida...
  tripleLevel       = randInt(1, 3); // ...en esta ronda
  tripleShotTimer   = 0;
  shieldTimer       = 0;
  hasBomb           = false;
  bombFlash         = 0;
  resetRoundPowerUps();
  spawnAsteroids(4);
}

// El escudo aparece una vez por ronda, salvo en la ronda del disparo triple
function resetRoundPowerUps() {
  powerUpSpawnTimer = rand(5, 12);
  shieldSpawned     = level === tripleLevel;
  shieldSpawnTimer  = rand(6, 18);
  // La Bomba Nova es escasa: solo aparece en algunas rondas
  bombSpawnTimer    = Math.random() < BOMB_CHANCE ? rand(8, 25) : -1;
}

// Destruye todos los asteroides en pantalla (sin fragmentarlos)
function detonateBomb() {
  hasBomb = false;
  bombFlash = BOMB_FLASH;
  for (const a of asteroids) {
    score += POINTS[a.size];
    explode(a.x, a.y, a.size * 5);
  }
  asteroids = [];
}

function spawnPowerUp(type) {
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (dist({ x, y }, ship) < 150);
  powerUps.push(new PowerUp(x, y, type));
}

function nextLevel() {
  level++;
  resetRoundPowerUps();
  bullets   = [];
  particles = [];
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  tripleShotTimer = 0;
  shieldTimer = 0;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }
  if (pressed('KeyB') && hasBomb) detonateBomb();
  if (bombFlash > 0) bombFlash = Math.max(0, bombFlash - dt);

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    const reach = ship.radius + (shieldTimer > 0 ? SHIELD_PAD : 0);
    for (const a of asteroids) {
      if (dist(ship, a) < reach + a.radius * 0.82) {
        if (shieldTimer > 0) {
          // El escudo absorbe el impacto y destruye el asteroide
          shieldTimer = 0;
          a.dead = true;
          explode(a.x, a.y, a.size * 5);
          asteroids = asteroids.filter(x => !x.dead).concat(a.split());
        } else {
          killShip();
        }
        break;
      }
    }
  }

  // Power-ups: aparición, recogida y duración del efecto
  if (tripleShotTimer > 0) tripleShotTimer = Math.max(0, tripleShotTimer - dt);
  if (shieldTimer > 0)     shieldTimer     = Math.max(0, shieldTimer - dt);
  if (!powerUpSpawned && level === tripleLevel) {
    powerUpSpawnTimer -= dt;
    if (powerUpSpawnTimer <= 0) {
      spawnPowerUp('triple');
      powerUpSpawned = true;
    }
  }
  if (!shieldSpawned) {
    shieldSpawnTimer -= dt;
    if (shieldSpawnTimer <= 0) {
      spawnPowerUp('shield');
      shieldSpawned = true;
    }
  }
  if (bombSpawnTimer >= 0) {
    bombSpawnTimer -= dt;
    if (bombSpawnTimer < 0) {
      if (!hasBomb) spawnPowerUp('bomb');
      bombSpawnTimer = -1;
    }
  }
  for (const p of powerUps) {
    p.update(dt);
    if (!p.dead && state === 'playing' && !ship.dead &&
        dist(ship, p) < ship.radius + p.radius) {
      if (p.type === 'triple')      tripleShotTimer = TRIPLE_DURATION;
      else if (p.type === 'shield') shieldTimer = SHIELD_DURATION;
      else                          hasBomb = true;
      p.dead = true;
      explode(p.x, p.y, 6);
    }
  }
  powerUps = powerUps.filter(p => !p.dead);

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  ctx.textAlign = 'left';
  let hudY = 46;
  if (tripleShotTimer > 0) {
    ctx.fillStyle = POWERUP_TYPES.triple.color;
    ctx.fillText(`TRIPLE ${Math.ceil(tripleShotTimer)}s`, 14, hudY);
    hudY += 20;
  }
  if (shieldTimer > 0) {
    ctx.fillStyle = POWERUP_TYPES.shield.color;
    ctx.fillText(`ESCUDO ${Math.ceil(shieldTimer)}s`, 14, hudY);
    hudY += 20;
  }
  if (hasBomb) {
    ctx.fillStyle = POWERUP_TYPES.bomb.color;
    ctx.fillText('BOMBA NOVA [B]', 14, hudY);
  }
}

function drawShield() {
  if (shieldTimer <= 0 || ship.dead) return;
  // Parpadeo durante el último segundo
  if (shieldTimer < 1 && Math.floor(shieldTimer * 10) % 2 === 0) return;
  ctx.save();
  ctx.strokeStyle = POWERUP_TYPES.shield.color;
  ctx.fillStyle   = 'rgba(68,255,68,0.12)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.radius + SHIELD_PAD, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  powerUps.forEach(p => p.draw());
  ship.draw();
  drawShield();

  if (bombFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(bombFlash / BOMB_FLASH * 0.8).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
