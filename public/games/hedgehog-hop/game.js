// Hedgehog Hop: a tiny runner game.
// Jump over logs, collect apples. Press SPACE or tap the screen to jump.

// ---- 1. Settings you can remix (read from the web address) ----
const params = new URLSearchParams(location.search);
const GRAVITY = Number(params.get('gravity') || 0.7);   // how fast you fall
const JUMP = Number(params.get('jump') || 13);          // how strong a jump is
const SPEED = Number(params.get('speed') || 5);         // how fast the world scrolls
const COLOUR = params.get('colour') || '#8B5A2B';       // hedgehog colour

// ---- 2. Set up the drawing area ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const FLOOR = H - 80;

// ---- 3. The things in our game ----
const hog = { x: 120, y: FLOOR, vy: 0, size: 34, onGround: true };
let logs = [];        // obstacles
let apples = [];      // collectables
let score = 0;
let best = 0;
let frame = 0;
let state = 'ready';  // 'ready' | 'playing' | 'over'

// ---- 4. Controls ----
function jump() {
  if (state !== 'playing') { restart(); return; }
  if (hog.onGround) {
    hog.vy = -JUMP;      // negative = upwards on a canvas
    hog.onGround = false;
  }
}
addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); } });
canvas.addEventListener('pointerdown', jump);

function restart() {
  logs = []; apples = []; score = 0; frame = 0;
  hog.y = FLOOR; hog.vy = 0; hog.onGround = true;
  state = 'playing';
}

// ---- 5. Update: move everything a tiny bit each frame ----
function update() {
  if (state !== 'playing') return;
  frame++;

  // Gravity pulls the hedgehog down every frame
  hog.vy += GRAVITY;
  hog.y += hog.vy;
  if (hog.y >= FLOOR) { hog.y = FLOOR; hog.vy = 0; hog.onGround = true; }

  // Add a new log every so often, with a little randomness
  if (frame % Math.max(45, 110 - Math.floor(score / 5)) === 0) {
    logs.push({ x: W + 20, w: 30 + Math.random() * 30, h: 30 + Math.random() * 25 });
  }
  if (frame % 70 === 35) apples.push({ x: W + 20, y: FLOOR - 90 - Math.random() * 90 });

  logs.forEach((l) => (l.x -= SPEED));
  apples.forEach((a) => (a.x -= SPEED));
  logs = logs.filter((l) => l.x + l.w > -10);
  apples = apples.filter((a) => a.x > -20 && !a.eaten);

  // Collisions: is the hedgehog's box touching another box?
  for (const l of logs) {
    if (hog.x + hog.size * 0.8 > l.x && hog.x - hog.size * 0.8 < l.x + l.w && hog.y > FLOOR - l.h) {
      state = 'over';
      best = Math.max(best, score);
    }
  }
  for (const a of apples) {
    if (Math.abs(a.x - hog.x) < 30 && Math.abs(a.y - (hog.y - 20)) < 34) { a.eaten = true; score += 5; }
  }
  if (frame % 10 === 0) score++;
}

// ---- 6. Draw: paint the picture for this frame ----
function draw() {
  // sky and hills
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#8FD3FF'); sky.addColorStop(1, '#DDF4FF');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#9ED99B';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 300 - frame * SPEED * 0.3) % 1200 + 1200) % 1200 - 200;
    ctx.beginPath(); ctx.arc(x, FLOOR + 40, 160, Math.PI, 0); ctx.fill();
  }
  // ground
  ctx.fillStyle = '#5DBB63'; ctx.fillRect(0, FLOOR, W, 14);
  ctx.fillStyle = '#8B5E3C'; ctx.fillRect(0, FLOOR + 14, W, H - FLOOR);

  // logs
  ctx.fillStyle = '#7A4A26';
  logs.forEach((l) => { ctx.fillRect(l.x, FLOOR - l.h, l.w, l.h); ctx.fillStyle = '#A8703F'; ctx.fillRect(l.x + 4, FLOOR - l.h + 4, l.w - 8, 6); ctx.fillStyle = '#7A4A26'; });

  // apples
  apples.forEach((a) => {
    ctx.fillStyle = '#E8423F'; ctx.beginPath(); ctx.arc(a.x, a.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3E8E41'; ctx.fillRect(a.x - 1, a.y - 17, 3, 7);
  });

  // hedgehog: a body, spikes and a face
  const bob = hog.onGround ? Math.sin(frame / 3) * 2 : 0;
  ctx.save(); ctx.translate(hog.x, hog.y - 20 + bob);
  ctx.fillStyle = COLOUR;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 8 - 6, -6); ctx.lineTo(i * 8, -30); ctx.lineTo(i * 8 + 6, -6); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(0, 0, 32, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F2C79A'; ctx.beginPath(); ctx.ellipse(22, 4, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#172B45'; ctx.beginPath(); ctx.arc(26, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(36, 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // score
  ctx.fillStyle = '#172B45'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Score ' + score, 20, 40);
  ctx.font = 'bold 16px sans-serif'; ctx.fillText('Best ' + best, 20, 64);

  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(23,43,69,0.75)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(state === 'ready' ? 'Hedgehog Hop' : 'Bonk! Score ' + score, W / 2, H / 2 - 10);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press SPACE or tap to ' + (state === 'ready' ? 'start' : 'try again'), W / 2, H / 2 + 34);
    ctx.textAlign = 'left';
  }
}

// ---- 7. The game loop: update, draw, repeat about 60 times a second ----
function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
