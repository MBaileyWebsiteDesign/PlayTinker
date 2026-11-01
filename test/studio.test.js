// Creator Studio tests: Pip (practice mode + Claude gateway), game checks and the safe runner.
const test = require('node:test');
const assert = require('node:assert');
const app = require('../server');
const { respond } = require('../lib/pip-demo');
const { templateCode, listTemplates } = require('../lib/studio-templates');
const { gameCheck } = require('../lib/game-check');

let server, base;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); }); }));
test.after(() => server.close());

const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

test('studio page loads', async () => {
  const res = await fetch(base + '/studio');
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /Creator Studio|chat-form/);
});

test('safe runner has a strict sandbox policy with no network', async () => {
  const res = await fetch(base + '/sandbox/run');
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /sandbox allow-scripts/);
  assert.match(csp, /connect-src 'none'/);
  assert.doesNotMatch(csp, /allow-same-origin/);
});

test('every starter game follows the contract', () => {
  for (const t of listTemplates()) {
    assert.match(t.code, /getElementById\('game'\)/, t.id);
    assert.match(t.code, /requestAnimationFrame/, t.id);
    assert.match(t.code, /^const TITLE = /m, t.id);
    assert.ok(t.tests.length >= 4, t.id);
    const r = gameCheck({ code: t.code, runtime: { errors: [], draws: true, colours: 10, fps: 60, listens: { keyboard: true, touch: true }, blocked: [] }, testPlan: [] });
    assert.ok(r.criteria.find((c) => c.id === 'safe').status === 'pass', t.id);
  }
});

test('practice-mode Pip changes settings and explains them', () => {
  const r = respond({ message: 'make the basket faster and the background purple', code: templateCode('catcher') });
  assert.match(r.code, /^const PLAYER_SPEED = 11\.2;/m);
  assert.match(r.code, /^const BG_COLOUR = '#7B4DFF';/m);
  assert.strictEqual(r.explain.length, 2);
  assert.ok(r.focus);
});

test('practice-mode Pip asks when a request is ambiguous', () => {
  const r = respond({ message: 'make it faster', code: templateCode('catcher') });
  assert.strictEqual(r.code, null);
  assert.match(r.reply, /Which part/);
});

test('practice-mode Pip keeps values in a safe range', () => {
  const r = respond({ message: 'make the basket 999 wide', code: templateCode('catcher') });
  assert.match(r.code, /^const PLAYER_SIZE = 300;/m);
});

test('Pip API blocks personal information before any AI call', async () => {
  const r = await post('/api/pip', { message: 'my email is sam@example.com, add a jump', code: templateCode('runner') });
  assert.strictEqual(r.mode, 'blocked');
  assert.strictEqual(r.code, null);
});

test('Pip API coaches prompting on every message', async () => {
  const r = await post('/api/pip', { message: 'jump higher', code: templateCode('runner') });
  assert.ok(r.coach && typeof r.coach.score === 'number');
  assert.match(r.code, /^const JUMP_POWER = 21;/m);
});

test('Pip uses Claude when a key is set, and validates the reply', async () => {
  const pipPath = require.resolve('../lib/pip');
  delete require.cache[pipPath];
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const realFetch = global.fetch;
  let sent;
  global.fetch = async (url, opts) => {
    sent = { url, body: JSON.parse(opts.body), headers: opts.headers };
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: '```json\n{"reply":"Added a double jump!","code":"const TITLE = \'X\';\\n","summary":"double jump","explain":["a"],"testIdeas":["b"]}\n```' }] }) };
  };
  try {
    const { pip } = require('../lib/pip');
    const r = await pip({ message: 'add a double jump', code: templateCode('runner'), history: [{ role: 'assistant', text: 'hi' }, { role: 'user', text: 'hello' }], ip: 't' });
    assert.strictEqual(r.mode, 'claude');
    assert.strictEqual(r.summary, 'double jump');
    assert.match(r.code, /TITLE/);
    assert.strictEqual(sent.url, 'https://api.anthropic.com/v1/messages');
    assert.strictEqual(sent.headers['x-api-key'], 'test-key');
    assert.strictEqual(sent.body.messages[0].role, 'user');
    assert.match(sent.body.messages.at(-1).content, /<game_code>/);
  } finally {
    global.fetch = realFetch;
    delete process.env.ANTHROPIC_API_KEY;
    delete require.cache[pipPath];
  }
});

test('game check flags unsafe code and errors, and explains why', async () => {
  const code = templateCode('blank') + "\nfetch('https://example.com');\n";
  const r = await post('/api/studio/check', { code, runtime: { errors: [{ message: 'x is not defined', line: 3 }], draws: true, fps: 60, listens: { keyboard: true, touch: true }, blocked: [] }, testPlan: [] });
  assert.strictEqual(r.kind, 'game-check');
  assert.strictEqual(r.criteria.find((c) => c.id === 'safe').status, 'missing');
  assert.strictEqual(r.criteria.find((c) => c.id === 'runs').status, 'missing');
  assert.strictEqual(r.review.recommended, true);
  assert.strictEqual(r.shareReady, false);
  assert.ok(r.criteria.every((c) => c.justification));
});

test('a tested, working starter is share-ready', () => {
  const plan = [1, 2, 3].map((i) => ({ text: 't' + i, status: 'pass' }));
  const r = gameCheck({ code: templateCode('dodge'), runtime: { errors: [], draws: true, colours: 9, fps: 60, listens: { keyboard: true, touch: true }, blocked: [] }, testPlan: plan });
  assert.strictEqual(r.shareReady, true);
});
