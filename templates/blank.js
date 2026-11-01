// My Game: a tiny starting point. Move the square to collect the coin.
// Move with the ARROW keys or WASD, or tap where you want to go.

// ---- 1. Settings: try changing these! ----
const TITLE = 'My Game';
const PLAYER_SPEED = 5;           // how fast you move
const PLAYER_SIZE = 40;           // how big you are
const BG_COLOUR = '#FFF7E8';      // background
const PLAYER_COLOUR = '#5B47D6';  // you
const COIN_COLOUR = '#FF9842';    // the coin

// ---- 2. Drawing area ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---- 3. Game objects ----
const player = { x: W / 2, y: H / 2 };
let coin = { x: 100, y: 100 };
let target = null;
let score = 0;
const keys = {};

// ---- 4. Controls: keyboard and touch ----
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  target = { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
});

// ---- 5. Update: move and check for the coin ----
function update() {
  if (keys.ArrowLeft || keys.KeyA) { player.x -= PLAYER_SPEED; target = null; }
  if (keys.ArrowRight || keys.KeyD) { player.x += PLAYER_SPEED; target = null; }
  if (keys.ArrowUp || keys.KeyW) { player.y -= PLAYER_SPEED; target = null; }
  if (keys.ArrowDown || keys.KeyS) { player.y += PLAYER_SPEED; target = null; }
  if (target) {
    const dx = target.x - player.x, dy = target.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > PLAYER_SPEED) { player.x += (dx / d) * PLAYER_SPEED; player.y += (dy / d) * PLAYER_SPEED; }
  }
  player.x = Math.max(PLAYER_SIZE / 2, Math.min(W - PLAYER_SIZE / 2, player.x));
  player.y = Math.max(PLAYER_SIZE / 2, Math.min(H - PLAYER_SIZE / 2, player.y));

  if (Math.hypot(coin.x - player.x, coin.y - player.y) < PLAYER_SIZE / 2 + 14) {
    score++;
    coin = { x: 30 + Math.random() * (W - 60), y: 60 + Math.random() * (H - 90) };
  }
}

// ---- 6. Draw: paint the picture every frame ----
function draw() {
  ctx.fillStyle = BG_COLOUR;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = COIN_COLOUR;
  ctx.beginPath();
  ctx.arc(coin.x, coin.y, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PLAYER_COLOUR;
  ctx.fillRect(player.x - PLAYER_SIZE / 2, player.y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);

  ctx.fillStyle = '#172B45';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(TITLE + ' · Score ' + score, 20, 36);
}

// ---- 7. Game loop: update, draw, repeat ----
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
