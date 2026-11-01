// Catcher: catch the good things, dodge the bad ones.
// Move with the LEFT/RIGHT arrow keys, or drag your finger or mouse.

// ---- 1. Settings: try changing these! ----
const TITLE = 'Star Catcher';
const PLAYER_SPEED = 8;          // how fast your basket moves
const PLAYER_SIZE = 110;         // how wide your basket is
const FALL_SPEED = 3;            // how fast things fall
const DROP_EVERY = 40;           // frames between drops (smaller = more things)
const BAD_CHANCE = 0.25;         // 0 = no bad things, 1 = only bad things
const LIVES = 3;                 // hits from bad things before game over
const BG_COLOUR = '#14234A';     // background
const PLAYER_COLOUR = '#FF9842'; // your basket
const GOOD_COLOUR = '#FFD24A';   // things to catch
const BAD_COLOUR = '#8A7F9E';    // things to avoid

// ---- 2. Drawing area ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---- 3. Game objects ----
const player = { x: W / 2, y: H - 50 };
let things = [];
let score = 0, lives = LIVES, frame = 0, state = 'ready';
const keys = {};

// ---- 4. Controls: keyboard and touch ----
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (state !== 'playing' && (e.code === 'Space' || e.code === 'Enter')) start();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', (e) => { if (state !== 'playing') start(); moveTo(e); });
canvas.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') moveTo(e); });
function moveTo(e) {
  const rect = canvas.getBoundingClientRect();
  player.x = ((e.clientX - rect.left) / rect.width) * W;
}
function start() {
  things = []; score = 0; lives = LIVES; frame = 0; state = 'playing';
}

// ---- 5. Update: move everything and check for catches ----
function update() {
  if (state !== 'playing') return;
  frame++;
  if (keys.ArrowLeft || keys.KeyA) player.x -= PLAYER_SPEED;
  if (keys.ArrowRight || keys.KeyD) player.x += PLAYER_SPEED;
  player.x = Math.max(PLAYER_SIZE / 2, Math.min(W - PLAYER_SIZE / 2, player.x));

  if (frame % DROP_EVERY === 0) {
    things.push({
      x: 30 + Math.random() * (W - 60), y: -20,
      bad: Math.random() < BAD_CHANCE,
      speed: FALL_SPEED + Math.random() * 1.5 + score / 40,
    });
  }
  for (const t of things) {
    t.y += t.speed;
    const caught = t.y > player.y - 20 && t.y < player.y + 10 && Math.abs(t.x - player.x) < PLAYER_SIZE / 2;
    if (caught) {
      t.done = true;
      if (t.bad) lives--; else score++;
    } else if (t.y > H + 20) {
      t.done = true;
    }
  }
  things = things.filter((t) => !t.done);
  if (lives <= 0) state = 'over';
}

// ---- 6. Draw: paint the picture every frame ----
function draw() {
  ctx.fillStyle = BG_COLOUR;
  ctx.fillRect(0, 0, W, H);

  for (const t of things) {
    ctx.fillStyle = t.bad ? BAD_COLOUR : GOOD_COLOUR;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // the basket
  ctx.fillStyle = PLAYER_COLOUR;
  ctx.fillRect(player.x - PLAYER_SIZE / 2, player.y - 14, PLAYER_SIZE, 30);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Score ' + score, 20, 40);
  ctx.textAlign = 'right';
  ctx.fillText('Lives ' + Math.max(lives, 0), W - 20, 40);

  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(state === 'ready' ? TITLE : 'Game over! Score ' + score, W / 2, H / 2 - 10);
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
