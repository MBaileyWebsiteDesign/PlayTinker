// Basic tests: run with `npm test`. Uses Node's built-in test runner, no extra packages.
const test = require('node:test');
const assert = require('node:assert');
const app = require('../server');
const { checkPrompt, creatorsCheck } = require('../lib/checks');

let server, base;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); }); }));
test.after(() => server.close());

for (const p of ['/', '/play', '/create', '/studio', '/academy', '/build-your-own', '/parents', '/safety', '/about']) {
  test(`page ${p} loads with security headers`, async () => {
    const res = await fetch(base + p);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(await res.text(), /PlayTinker/);
  });
}

test('unknown page returns 404', async () => {
  assert.strictEqual((await fetch(base + '/nope')).status, 404);
});

test('vague prompt needs work and explains why', () => {
  const r = checkPrompt('make me a game');
  assert.strictEqual(r.result, 'needs-work');
  assert.ok(r.criteria.every((c) => c.justification && c.status));
});

test('strong prompt is ready', () => {
  const r = checkPrompt("I'm making a game where a hedgehog collects apples. Add a jump when I press space, only if it's on the ground. It should feel like a trampoline. Explain each part to me.");
  assert.strictEqual(r.result, 'ready');
});

test('personal information triggers a review', () => {
  const r = checkPrompt('My name is Sam and my email is sam@example.com, make a game');
  assert.strictEqual(r.review.recommended, true);
});

test('empty Creator\'s Check is not badge eligible and flags review', () => {
  const r = creatorsCheck({ intent: '', ownership: '', functionality: '', quality: '', improvement: '' });
  assert.strictEqual(r.badgeEligible, false);
  assert.strictEqual(r.review.recommended, true);
});

test('API returns a full check record', async () => {
  const res = await fetch(base + '/api/prompt-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'add a jump' }) });
  const r = await res.json();
  for (const k of ['checker', 'checkedAt', 'score', 'result', 'criteria', 'review', 'disclaimer']) assert.ok(k in r, k);
});
