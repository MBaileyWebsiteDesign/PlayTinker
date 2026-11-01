/**
 * PlayTinker concept website (working name).
 *
 * A deliberately small Express app:
 *  - wraps each page in /pages with a shared layout
 *  - serves static assets and the sandboxed games from /public
 *  - exposes two demo API endpoints that show the shape of the future AI gateway
 *
 * No AI keys are needed to run the concept. See docs/ARCHITECTURE.md.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { checkPrompt, creatorsCheck } = require('./lib/checks');
const { gameCheck } = require('./lib/game-check');
const { pip, aiEnabled, MODEL } = require('./lib/pip');
const { listTemplates } = require('./lib/studio-templates');

const app = express();
const PORT = process.env.PORT || 8080;
const PAGES_DIR = path.join(__dirname, 'pages');
const layout = fs.readFileSync(path.join(__dirname, 'layout.html'), 'utf8');

// Page registry: slug -> metadata. Order drives the main navigation.
const PAGES = {
  '':               { file: 'home',     title: 'Imagine it. Tinker with it. Play it.', nav: null },
  'play':           { file: 'play',     title: 'Play',                    nav: 'Play' },
  'create':         { file: 'create',   title: 'Create',                  nav: 'Create' },
  'studio':         { file: 'studio',   title: 'Creator Studio',          nav: 'Studio' },
  'academy':        { file: 'academy',  title: 'Academy',                 nav: 'Academy' },
  'build-your-own': { file: 'build',    title: 'Build your own',          nav: 'Build your own' },
  'parents':        { file: 'parents',  title: 'Parents & Educators',     nav: 'Parents & Educators' },
  'safety':         { file: 'safety',   title: 'Privacy & Safety',        nav: 'Privacy & Safety' },
  'about':          { file: 'about',    title: 'About',                   nav: 'About' },
};

// Security headers. Games are additionally isolated in sandboxed iframes.
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  });
  next();
});

// ---- Safe preview runner for creators' games ----
// Served with its own, much stricter policy: sandboxed opaque origin, no network at all,
// no forms, no storage. User code can only draw on its canvas and talk to the Studio.
const runnerHtml = fs.readFileSync(path.join(__dirname, 'sandbox', 'runner.html'), 'utf8');
app.get('/sandbox/run', (req, res) => {
  res.set({
    'Content-Security-Policy': [
      'sandbox allow-scripts',
      "default-src 'none'",
      "script-src 'unsafe-inline' blob:",
      "style-src 'unsafe-inline'",
      'img-src data: blob:',
      'media-src data: blob:',
      'font-src data:',
      "connect-src 'none'",
      "form-action 'none'",
      "base-uri 'none'",
      "frame-ancestors 'self'",
    ].join('; '),
    'Cache-Control': 'no-store',
  });
  res.type('html').send(runnerHtml);
});

app.use('/api/studio', express.json({ limit: '200kb' }));
app.use('/api/pip', express.json({ limit: '200kb' }));
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', index: false }));

function renderPage(slug) {
  const meta = PAGES[slug];
  const body = fs.readFileSync(path.join(PAGES_DIR, `${meta.file}.html`), 'utf8');
  const nav = Object.entries(PAGES)
    .filter(([, m]) => m.nav)
    .map(([s, m]) => `<a href="/${s}"${s === slug ? ' aria-current="page"' : ''}>${m.nav}</a>`)
    .join('');
  return layout
    .replace('{{title}}', meta.title)
    .replace('{{nav}}', nav)
    .replace('{{body}}', body)
    .replace('{{page}}', meta.file);
}

// Cache rendered pages in production; re-read in development for fast editing.
const cache = new Map();
const isProd = process.env.NODE_ENV === 'production';

app.get(['/', '/:slug'], (req, res, next) => {
  const slug = req.params.slug || '';
  if (!(slug in PAGES)) return next();
  if (!isProd || !cache.has(slug)) cache.set(slug, renderPage(slug));
  res.type('html').send(cache.get(slug));
});

// ---- Demo API: the shape of the future AI gateway ----
app.post('/api/prompt-check', (req, res) => {
  const prompt = String(req.body?.prompt || '').slice(0, 2000);
  res.json(checkPrompt(prompt));
});

app.post('/api/creators-check', (req, res) => {
  const b = req.body || {};
  const input = ['intent', 'ownership', 'functionality', 'quality', 'improvement']
    .reduce((o, k) => ({ ...o, [k]: String(b[k] || '').slice(0, 1500) }), {});
  res.json(creatorsCheck(input));
});

// ---- Creator Studio API ----
app.get('/api/studio/templates', (req, res) => res.json({ templates: listTemplates() }));

app.get('/api/pip/status', (req, res) => res.json({ mode: aiEnabled() ? 'claude' : 'demo', model: aiEnabled() ? MODEL : null }));

app.post('/api/pip', async (req, res) => {
  const b = req.body || {};
  const history = Array.isArray(b.history) ? b.history.slice(-6) : [];
  res.json(await pip({ message: b.message, code: b.code, history, ip: req.get('fly-client-ip') || req.ip }));
});

app.post('/api/studio/check', (req, res) => {
  const b = req.body || {};
  res.json(gameCheck({ code: String(b.code || ''), runtime: b.runtime || null, testPlan: Array.isArray(b.testPlan) ? b.testPlan.slice(0, 50) : [] }));
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).type('html').send(
  layout.replace('{{title}}', 'Not found').replace('{{nav}}', '').replace('{{page}}', 'notfound')
    .replace('{{body}}', '<section class="wrap pad center"><h1>Oops, that page wandered off.</h1><p><a class="btn btn-orange" href="/">Back home</a></p></section>')
));

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`PlayTinker concept running on http://localhost:${PORT}`));
}
module.exports = app;
