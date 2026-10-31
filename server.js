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

const app = express();
const PORT = process.env.PORT || 8080;
const PAGES_DIR = path.join(__dirname, 'pages');
const layout = fs.readFileSync(path.join(__dirname, 'layout.html'), 'utf8');

// Page registry: slug -> metadata. Order drives the main navigation.
const PAGES = {
  '':               { file: 'home',     title: 'Imagine it. Tinker with it. Play it.', nav: null },
  'play':           { file: 'play',     title: 'Play',                    nav: 'Play' },
  'create':         { file: 'create',   title: 'Create',                  nav: 'Create' },
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

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).type('html').send(
  layout.replace('{{title}}', 'Not found').replace('{{nav}}', '').replace('{{page}}', 'notfound')
    .replace('{{body}}', '<section class="wrap pad center"><h1>Oops, that page wandered off.</h1><p><a class="btn btn-orange" href="/">Back home</a></p></section>')
));

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`PlayTinker concept running on http://localhost:${PORT}`));
}
module.exports = app;
