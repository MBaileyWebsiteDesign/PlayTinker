// Runner: jump over the obstacles and grab the coins.
// Press SPACE or the UP arrow to jump, or tap the screen.

// ---- 1. Settings: try changing these! ----
const TITLE = 'Hedgehog Hop';
const JUMP_POWER = 15;             // how high you jump
const GRAVITY = 0.8;               // how quickly you fall back down
const GAME_SPEED = 6;              // how fast the world scrolls
const OBSTACLE_EVERY = 90;         // frames between obstacles (smaller = more)
const PLAYER_SIZE = 44;            // how big you are
const LIVES = 3;                   // bumps before game over
const BG_COLOUR = '#8FD3FF';       // the sky
const GROUND_COLOUR = '#4CAF50';   // the ground
const PLAYER_COLOUR = '#8B5A2B';   // you
const OBSTACLE_COLOUR = '#5D4037'; // things to jump over
const COIN_COLOUR = '#FFD24A';     // coins to collect

// ---- 2. Drawing area ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const GROUND_Y = H - 70;

// ---- 3. Game objects ----
const player = { x: 120, y: GROUND_Y - PLAYER_SIZE, vy: 0, onGround: true, hurt: 0 };
let obstacles = [], coins = [];
let score = 0, lives = LIVES, frame = 0, state = 'ready';

// ---- 4. Controls: keyboard and touch ----
addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (state !== 'playing') start(); else jump();
  }
});
canvas.addEventListener('pointerdown', () => { if (state !== 'playing') start(); else jump(); });
function jump() {
  if (player.onGround) { player.vy = -JUMP_POWER; player.onGround = false; }
}
function start() {
  obstacles = []; coins = []; score = 0; lives = LIVES; frame = 0; state = 'playing';
  player.y = GROUND_Y - PLAYER_SIZE; player.vy = 0; player.onGround = true; player.hurt = 0;
}

// ---- 5. Update: gravity, scrolling and collisions ----
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function update() {
  if (state !== 'playing') return;
  frame++;

  // gravity pulls you down every frame
  player.vy += GRAVITY;
  player.y += player.vy;
  if (player.y >= GROUND_Y - PLAYER_SIZE) {
    player.y = GROUND_Y - PLAYER_SIZE; player.vy = 0; player.onGround = true;
  }
  if (player.hurt > 0) player.hurt--;

  if (frame % OBSTACLE_EVERY === 0) {
    const h = 30 + Math.random() * 30;
    obstacles.push({ x: W, y: GROUND_Y - h, w: 30, h });
  }
  if (frame % 70 === 35) {
    coins.push({ x: W, y: GROUND_Y - 80 - Math.random() * 120, w: 22, h: 22 });
  }

  const me = { x: player.x, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE };
  for (const o of obstacles) {
    o.x -= GAME_SPEED;
    if (!o.hit && player.hurt === 0 && overlaps(me, o)) { o.hit = true; lives--; player.hurt = 60; }
  }
  for (const c of coins) {
    c.x -= GAME_SPEED;
    if (!c.taken && overlaps(me, c)) { c.taken = true; score++; }
  }
  obstacles = obstacles.filter((o) => o.x > -50);
  coins = coins.filter((c) => c.x > -50 && !c.taken);
  if (lives <= 0) state = 'over';
}

// ---- 6. Draw: paint the picture every frame ----
function draw() {
  ctx.fillStyle = BG_COLOUR;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = GROUND_COLOUR;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  ctx.fillStyle = OBSTACLE_COLOUR;
  for (const o of obstacles) ctx.fillRect(o.x, o.y, o.w, o.h);

  ctx.fillStyle = COIN_COLOUR;
  for (const c of coins) {
    ctx.beginPath();
    ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // you (flash when hurt)
  if (player.hurt % 10 < 5) {
    ctx.fillStyle = PLAYER_COLOUR;
    ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x + PLAYER_SIZE * 0.6, player.y + PLAYER_SIZE * 0.2, 8, 8);
  }

  ctx.fillStyle = '#172B45';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Coins ' + score, 20, 40);
  ctx.textAlign = 'right';
  ctx.fillText('Lives ' + Math.max(lives, 0), W - 20, 40);

  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(state === 'ready' ? TITLE : 'Game over! ' + score + ' coins', W / 2, H / 2 - 10);
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
