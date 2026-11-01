// Gem Dash: collect the gems before time runs out, and dodge the enemies.
// Move with the ARROW keys or WASD, or hold your finger where you want to go.

// ---- 1. Settings: try changing these! ----
const TITLE = 'Gem Dash';
const PLAYER_SPEED = 5;           // how fast you move
const PLAYER_SIZE = 18;           // how big you are
const ENEMY_COUNT = 3;            // how many enemies at the start
const ENEMY_SPEED = 2.5;          // how fast enemies move
const GEMS_TO_WIN = 10;           // gems needed to win
const TIME_LIMIT = 60;            // seconds before time runs out
const LIVES = 3;                  // hits before game over
const BG_COLOUR = '#1B1340';      // background
const PLAYER_COLOUR = '#21B6AB';  // you
const ENEMY_COLOUR = '#FF5A5F';   // enemies
const GEM_COLOUR = '#FFD24A';     // gems

// ---- 2. Drawing area ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---- 3. Game objects ----
const player = { x: W / 2, y: H / 2, hurt: 0 };
let enemies = [], gem = null, target = null;
let score = 0, lives = LIVES, timeLeft = TIME_LIMIT, frame = 0, state = 'ready';
const keys = {};

function newGem() {
  return { x: 40 + Math.random() * (W - 80), y: 70 + Math.random() * (H - 110) };
}
function newEnemy() {
  const angle = Math.random() * Math.PI * 2;
  return { x: Math.random() < 0.5 ? 30 : W - 30, y: 60 + Math.random() * (H - 90),
    vx: Math.cos(angle) * ENEMY_SPEED, vy: Math.sin(angle) * ENEMY_SPEED };
}

// ---- 4. Controls: keyboard and touch ----
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (state !== 'playing' && (e.code === 'Space' || e.code === 'Enter')) start();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', (e) => { if (state !== 'playing') start(); aim(e); });
canvas.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') aim(e); });
canvas.addEventListener('pointerup', () => { target = null; });
function aim(e) {
  const rect = canvas.getBoundingClientRect();
  target = { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
}
function start() {
  enemies = Array.from({ length: ENEMY_COUNT }, newEnemy);
  gem = newGem(); score = 0; lives = LIVES; timeLeft = TIME_LIMIT; frame = 0; state = 'playing';
  player.x = W / 2; player.y = H / 2; player.hurt = 0;
}

// ---- 5. Update: movement, timer and collisions ----
function update() {
  if (state !== 'playing') return;
  frame++;
  if (frame % 60 === 0) timeLeft--;

  let dx = 0, dy = 0;
  if (keys.ArrowLeft || keys.KeyA) dx--;
  if (keys.ArrowRight || keys.KeyD) dx++;
  if (keys.ArrowUp || keys.KeyW) dy--;
  if (keys.ArrowDown || keys.KeyS) dy++;
  if (target) {
    const tx = target.x - player.x, ty = target.y - player.y;
    const d = Math.hypot(tx, ty);
    if (d > 4) { dx = tx / d; dy = ty / d; }
  }
  player.x = Math.max(PLAYER_SIZE, Math.min(W - PLAYER_SIZE, player.x + dx * PLAYER_SPEED));
  player.y = Math.max(PLAYER_SIZE + 50, Math.min(H - PLAYER_SIZE, player.y + dy * PLAYER_SPEED));
  if (player.hurt > 0) player.hurt--;

  for (const en of enemies) {
    en.x += en.vx; en.y += en.vy;
    if (en.x < 15 || en.x > W - 15) en.vx *= -1;
    if (en.y < 65 || en.y > H - 15) en.vy *= -1;
    if (player.hurt === 0 && Math.hypot(en.x - player.x, en.y - player.y) < PLAYER_SIZE + 14) {
      lives--; player.hurt = 60;
    }
  }

  if (Math.hypot(gem.x - player.x, gem.y - player.y) < PLAYER_SIZE + 12) {
    score++;
    gem = newGem();
    if (score % 3 === 0) enemies.push(newEnemy()); // it gets harder!
  }

  if (score >= GEMS_TO_WIN) state = 'won';
  else if (lives <= 0 || timeLeft <= 0) state = 'over';
}

// ---- 6. Draw: paint the picture every frame ----
function draw() {
  ctx.fillStyle = BG_COLOUR;
  ctx.fillRect(0, 0, W, H);

  if (gem) {
    ctx.fillStyle = GEM_COLOUR;
    ctx.beginPath();
    ctx.moveTo(gem.x, gem.y - 14); ctx.lineTo(gem.x + 12, gem.y);
    ctx.lineTo(gem.x, gem.y + 14); ctx.lineTo(gem.x - 12, gem.y);
    ctx.closePath(); ctx.fill();
  }

  ctx.fillStyle = ENEMY_COLOUR;
  for (const en of enemies) {
    ctx.beginPath(); ctx.arc(en.x, en.y, 14, 0, Math.PI * 2); ctx.fill();
  }

  if (player.hurt % 10 < 5) {
    ctx.fillStyle = PLAYER_COLOUR;
    ctx.beginPath(); ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Gems ' + score + '/' + GEMS_TO_WIN, 20, 36);
  ctx.textAlign = 'center';
  ctx.fillText('Time ' + Math.max(timeLeft, 0), W / 2, 36);
  ctx.textAlign = 'right';
  ctx.fillText('Lives ' + Math.max(lives, 0), W - 20, 36);

  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px sans-serif';
    const msg = state === 'ready' ? TITLE : state === 'won' ? 'You win!' : 'Game over! ' + score + ' gems';
    ctx.fillText(msg, W / 2, H / 2 - 10);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Tap, or press SPACE, to ' + (state === 'ready' ? 'start' : 'play again'), W / 2, H / 2 + 34);
  }
}

// ---- 7. Game loop: update, draw, repeat ----
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
