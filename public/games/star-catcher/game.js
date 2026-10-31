// Star Catcher: catch falling stars, dodge the space rocks.
// Move with the LEFT/RIGHT arrow keys, or drag your finger or mouse.

// ---- 1. Settings you can remix ----
const params = new URLSearchParams(location.search);
const FALL_SPEED = Number(params.get('fall') || 3);        // how fast things fall
const BASKET_WIDTH = Number(params.get('basket') || 110);  // size of your basket
const ROCK_CHANCE = Number(params.get('rocks') || 0.25);   // 0 = no rocks, 1 = all rocks
const LIVES = Number(params.get('lives') || 3);

// ---- 2. Drawing area ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---- 3. Game objects ----
const basket = { x: W / 2, y: H - 50, speed: 9 };
let things = [];   // falling stars and rocks
let score = 0, lives = LIVES, frame = 0, state = 'ready';
const keys = {};
const twinkles = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.4 }));

// ---- 4. Controls: keyboard and pointer ----
addEventListener('keydown', (e) => { keys[e.code] = true; if (state !== 'playing' && (e.code === 'Space' || e.code === 'Enter')) start(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', (e) => { if (state !== 'playing') start(); moveTo(e); });
canvas.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') moveTo(e); });
function moveTo(e) {
  const rect = canvas.getBoundingClientRect();
  basket.x = ((e.clientX - rect.left) / rect.width) * W;
}
function start() { things = []; score = 0; lives = LIVES; frame = 0; state = 'playing'; }

// ---- 5. Update ----
function update() {
  if (state !== 'playing') return;
  frame++;
  if (keys.ArrowLeft) basket.x -= basket.speed;
  if (keys.ArrowRight) basket.x += basket.speed;
  basket.x = Math.max(BASKET_WIDTH / 2, Math.min(W - BASKET_WIDTH / 2, basket.x));

  // Drop something new; it gets a little faster as your score grows
  if (frame % 40 === 0) {
    things.push({ x: 30 + Math.random() * (W - 60), y: -20, rock: Math.random() < ROCK_CHANCE,
      speed: FALL_SPEED + Math.random() * 1.5 + score / 40, spin: Math.random() * 6 });
  }
  for (const t of things) {
    t.y += t.speed; t.spin += 0.05;
    const caught = t.y > basket.y - 20 && t.y < basket.y + 10 && Math.abs(t.x - basket.x) < BASKET_WIDTH / 2;
    if (caught) {
      t.done = true;
      if (t.rock) lives--; else score++;
    } else if (t.y > H + 20) {
      t.done = true;
    }
  }
  things = things.filter((t) => !t.done);
  if (lives <= 0) state = 'over';
}

// ---- 6. Draw ----
function star(x, y, r, spin) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = spin + (i * Math.PI) / 5, rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fill();
}
function draw() {
  ctx.fillStyle = '#14234A'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  twinkles.forEach((s, i) => { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(frame / 20 + i); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1;

  for (const t of things) {
    if (t.rock) { ctx.fillStyle = '#8A7F9E'; ctx.beginPath(); ctx.arc(t.x, t.y, 16, 0, 7); ctx.fill(); ctx.fillStyle = '#6B6280'; ctx.beginPath(); ctx.arc(t.x - 5, t.y - 4, 4, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#FFD24A'; star(t.x, t.y, 16, t.spin); }
  }

  // basket
  ctx.fillStyle = '#FF9842';
  ctx.beginPath();
  ctx.moveTo(basket.x - BASKET_WIDTH / 2, basket.y - 14);
  ctx.lineTo(basket.x + BASKET_WIDTH / 2, basket.y - 14);
  ctx.lineTo(basket.x + BASKET_WIDTH / 2 - 14, basket.y + 18);
  ctx.lineTo(basket.x - BASKET_WIDTH / 2 + 14, basket.y + 18);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#21B6AB'; ctx.fillRect(basket.x - BASKET_WIDTH / 2, basket.y - 18, BASKET_WIDTH, 6);

  ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Stars ' + score, 20, 40);
  ctx.fillText('Lives ' + '♥'.repeat(Math.max(lives, 0)), W - 200, 40);

  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(11,24,48,0.75)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(state === 'ready' ? 'Star Catcher' : 'Game over: ' + score + ' stars', W / 2, H / 2 - 10);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Tap, or press SPACE, to ' + (state === 'ready' ? 'start' : 'play again'), W / 2, H / 2 + 34);
    ctx.textAlign = 'left';
  }
}

// ---- 7. Game loop ----
function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
