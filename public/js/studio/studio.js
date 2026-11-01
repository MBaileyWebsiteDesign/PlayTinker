// PlayTinker Creator Studio: chat with Pip, code with Pip's lines highlighted, safe preview,
// automatic tests and checks, a test plan, versions and export.
import { $, $$, esc, carryAuthors, changedRange, diffLines, timeAgo, uid } from './util.js';
import { CodeEditor } from './editor.js';
import { makeZip } from './zip.js';
import * as store from './store.js';

const studio = $('#studio');
let templates = [];
let project = null;
let pipMode = 'demo';
let runId = 0;
let lastRuntime = null;      // results from the hidden tester for the code that last ran
let lastRunCode = null;
let testsWaiters = [];
let consoleLines = [];
let busy = false;

/* ---------------- setup ---------------- */
const editor = new CodeEditor($('#editor'), {
  onChange: (code, authors) => {
    project.code = code; project.authors = authors;
    autosave();
    updateDirty();
  },
  onRun: () => run(),
  onSave: () => openSave(),
});

let saveTimer;
function autosave() {
  clearTimeout(saveTimer);
  setStatus('Saving…');
  saveTimer = setTimeout(() => { store.touch(project); updateDirty(); }, 400);
}

function setStatus(text) { $('#st-status').textContent = text; }
function updateDirty() {
  const dirty = store.isDirty(project);
  setStatus(store.isMemoryOnly() ? 'Not saved: this browser blocks storage' : dirty ? 'Unsaved changes · draft kept on this device' : 'Saved on this device');
  $('#st-save').classList.toggle('pulse', dirty);
}

/* ---------------- view (simple / technical) ---------------- */
function setView(view) {
  studio.dataset.view = view;
  $$('.st-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  try { localStorage.setItem('playtinker.studio.view', view); } catch (e) { /* ignore */ }
  if (view === 'simple') {
    const active = $('.st-tabs [aria-selected=true]');
    if (active && active.classList.contains('tech-only')) $('#t-code').click();
  }
}
$$('.st-switch button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

/* ---------------- preview sizes ---------------- */
const SIZES = { phone: [390, 760], 'phone-land': [760, 390], tablet: [820, 600], desktop: [1000, 625] };
let size = 'desktop';
if (innerWidth <= 600) {
  size = 'phone-land';
  $('#device').dataset.size = size;
  $$('.st-sizes button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.size === size)));
}
function fitDevice() {
  const stage = $('#stage'), device = $('#device');
  const [w, h] = SIZES[size];
  // On narrow screens the stage takes the shape of the chosen device
  stage.style.height = innerWidth <= 900 ? Math.min(stage.clientWidth * h / w, innerHeight * 0.7) + 'px' : '';
  const scale = Math.min(stage.clientWidth / w, stage.clientHeight / h, 1);
  device.style.width = w + 'px';
  device.style.height = h + 'px';
  device.style.transform = `scale(${scale})`;
  device.style.marginLeft = Math.max(0, (stage.clientWidth - w * scale) / 2) + 'px';
  device.style.marginTop = Math.max(0, (stage.clientHeight - h * scale) / 2) + 'px';
}
$$('.st-sizes button').forEach((b) => b.addEventListener('click', () => {
  size = b.dataset.size;
  $('#device').dataset.size = size;
  $$('.st-sizes button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  fitDevice();
}));
new ResizeObserver(fitDevice).observe($('#stage'));
$('#st-full').addEventListener('click', () => {
  const f = $('#preview');
  (f.requestFullscreen || f.webkitRequestFullscreen || (() => {})).call(f);
});

/* ---------------- running games safely ---------------- */
// Two sandboxed frames: the visible preview, and a hidden tester that runs automatic tests.
const frames = { preview: $('#preview'), tester: $('#tester') };
const pending = {};

function load(name, code, test) {
  const id = ++runId;
  pending[name] = { id, code, test };
  frames[name].src = '/sandbox/run?r=' + id;
}

function run() {
  const code = editor.getCode();
  lastRunCode = code;
  lastRuntime = null;
  consoleLines = [];
  renderConsole();
  editor.setError(0);
  setRun('running', 'Running… click the game, then use the controls.');
  $('#auto-tests').innerHTML = '<li class="small">Testing…</li>';
  load('preview', code, false);
  load('tester', code, true);
}

function setRun(kind, html) {
  const el = $('#run-status');
  el.className = 'st-run-status ' + kind;
  el.innerHTML = html;
}

addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.pt !== 1) return;
  const name = e.source === frames.preview.contentWindow ? 'preview' : e.source === frames.tester.contentWindow ? 'tester' : null;
  if (!name) return;

  if (d.type === 'ready' && pending[name]) {
    frames[name].contentWindow.postMessage({ type: 'run', code: pending[name].code, test: pending[name].test }, '*');
    return;
  }
  if (name === 'preview') {
    if (d.type === 'started' && !$('#run-status').classList.contains('bad')) setRun('ok', '▶ Running. Click or tap the game to play.');
    if (d.type === 'error') {
      const er = d.error;
      log('error', `Line ${er.line || '?'}: ${er.message}`);
      editor.setError(er.line);
      setRun('bad', `⚠ Error on line ${er.line || '?'}: ${esc(er.message)} <button type="button" class="btn btn-sm btn-lilac" id="fix-btn">Ask Pip to help</button>`);
      $('#fix-btn').addEventListener('click', () => sendToPip(`My game has an error on line ${er.line || '?'}: "${er.message}". Please help me fix it and explain what was wrong.`));
    }
    if (d.type === 'console') log(d.level, d.text);
    if (d.type === 'blocked') log('warn', 'Blocked by the sandbox: ' + d.what);
  }
  if (name === 'tester' && d.type === 'tests') {
    lastRuntime = d.results;
    renderAutoTests();
    testsWaiters.splice(0).forEach((fn) => fn(lastRuntime));
  }
});

function waitForTests() {
  if (lastRuntime && lastRunCode === editor.getCode()) return Promise.resolve(lastRuntime);
  if (lastRunCode !== editor.getCode()) run();
  return new Promise((resolve) => {
    testsWaiters.push(resolve);
    setTimeout(() => resolve(lastRuntime), 9000);
  });
}

function renderAutoTests() {
  const r = lastRuntime;
  const items = [
    [r.errors.length === 0, 'Runs without errors', r.errors.length ? `Line ${r.errors[0].line || '?'}: ${r.errors[0].message}` : `Ran for ${(r.ranFor / 1000).toFixed(1)}s`],
    [r.draws, 'Shows something on screen', r.draws ? `${r.colours} colours seen` : 'The screen stayed blank'],
    [r.fps >= 20, 'Animates smoothly', `About ${r.fps} frames a second`],
    [r.listens.keyboard, 'Listens for the keyboard', r.listens.keyboard ? 'Key presses are handled' : 'No keyboard controls found'],
    [r.listens.touch, 'Works with touch and mouse', r.listens.touch ? 'Taps and clicks are handled' : 'Phone players can\'t play yet'],
    [r.blocked.length === 0 && !r.stopped, 'Stays inside the sandbox', r.stopped ? 'A loop ran too long and was stopped' : r.blocked.length ? 'Tried to: ' + r.blocked[0] : 'Nothing blocked'],
  ];
  const passed = items.filter((i) => i[0]).length;
  $('#auto-tests').innerHTML = items.map(([ok, label, why]) =>
    `<li class="${ok ? 'ok' : 'no'}"><span aria-hidden="true">${ok ? '✓' : '✗'}</span><div><b>${esc(label)}</b><br><span class="small">${esc(why)}</span></div></li>`).join('');
  const s = $('#run-status');
  if (!s.classList.contains('bad')) setRun(passed === items.length ? 'ok' : 'warn', `▶ Running · automatic tests: <b>${passed}/${items.length}</b> passed <button type="button" class="linkish" data-goto="t-tests">see tests</button>`);
}

/* ---------------- console ---------------- */
function log(level, text) {
  consoleLines.push({ level, text, at: new Date() });
  if (consoleLines.length > 300) consoleLines.shift();
  renderConsole();
}
function renderConsole() {
  $('#console').innerHTML = consoleLines.map((l) => `<span class="c-${l.level}">[${l.at.toLocaleTimeString('en-GB')}] ${esc(l.text)}</span>`).join('\n') || '<span class="small">Nothing yet. Try console.log("hello") in your code.</span>';
  const errs = consoleLines.filter((l) => l.level === 'error').length;
  $('#console-count').textContent = errs ? errs : '';
}
$('#console-clear').addEventListener('click', () => { consoleLines = []; renderConsole(); });

/* ---------------- Pip chat ---------------- */
function chatBubble(m) {
  const div = document.createElement('div');
  div.className = 'msg ' + m.role + (m.blocked ? ' blocked' : '');
  let html = `<div class="bubble">${esc(m.text).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>')}</div>`;
  if (m.explain && m.explain.length) html += `<details class="pip-explain"><summary>How it works</summary><ul>${m.explain.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`;
  if (m.coach) html += `<div class="coach" title="${esc(m.coach.tip)}">Prompt score <b>${m.coach.score}</b>${m.coach.score < 100 ? ` · Tip: ${esc(m.coach.label)}. ${esc(m.coach.tip)}` : ' · Brilliant prompt!'}</div>`;
  if (m.version) html += `<div class="meta">Saved as version ${m.version} · <button type="button" class="linkish" data-diff="${m.version}">see changes</button></div>`;
  div.innerHTML = html;
  return div;
}
function renderChat() {
  const logEl = $('#chat-log');
  logEl.innerHTML = '';
  if (!project.chat.length) {
    logEl.appendChild(chatBubble({ role: 'assistant', text: `Hi, I'm Pip! This is your ${templateName()} game. Press ▶ Run to play it. Then tell me one thing you'd like to change. Small steps work best. I'll explain everything I do.` }));
  }
  project.chat.forEach((m) => logEl.appendChild(chatBubble(m)));
  logEl.scrollTop = logEl.scrollHeight;
}
function templateName() { const t = templates.find((x) => x.id === project.template); return t ? t.name : 'new'; }

function renderChips() {
  const code = project.code;
  const ideas = [];
  if (/PLAYER_SPEED/.test(code)) ideas.push('Make the player faster');
  if (/JUMP_POWER/.test(code)) ideas.push('Make the jump higher');
  if (/BG_COLOUR/.test(code)) ideas.push('Make the background purple');
  if (/ENEMY_COUNT/.test(code)) ideas.push('Add more enemies');
  if (/BAD_CHANCE/.test(code)) ideas.push('More rocks please');
  if (/LIVES/.test(code)) ideas.push('Give me 5 lives');
  ideas.push('Explain the game loop', 'What should I test?');
  $('#chips').innerHTML = ideas.slice(0, 6).map((t) => `<button type="button" class="chip">${esc(t)}</button>`).join('');
}
$('#chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (b) { $('#chat-input').value = b.textContent; $('#chat-input').focus(); }
});

$('#chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#chat-input').value.trim();
  if (text) sendToPip(text);
});
$('#chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chat-form').requestSubmit(); }
});

async function sendToPip(text) {
  if (busy) return;
  busy = true;
  $('#chat-input').value = '';
  const userMsg = { role: 'user', text };
  project.chat.push(userMsg);
  const logEl = $('#chat-log');
  const userEl = chatBubble(userMsg);
  logEl.appendChild(userEl);
  const thinking = chatBubble({ role: 'assistant', text: 'Pip is thinking…' });
  thinking.classList.add('thinking');
  logEl.appendChild(thinking);
  logEl.scrollTop = logEl.scrollHeight;

  let r;
  try {
    const history = project.chat.slice(-8, -1).map((m) => ({ role: m.role, text: m.text }));
    const res = await fetch('/api/pip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, code: editor.getCode(), history }) });
    r = await res.json();
  } catch (err) {
    r = { reply: 'I couldn\'t connect. Check your internet and try again.', mode: 'error' };
  }
  thinking.remove();
  userMsg.coach = r.coach;
  userEl.replaceWith(chatBubble(userMsg));

  const pipMsg = { role: 'assistant', text: r.reply, explain: r.explain, blocked: r.mode === 'blocked' };
  if (r.code && typeof r.code === 'string') {
    const before = editor.getCode();
    if (r.replaceAll) {
      if (store.isDirty(project)) store.addVersion(project, { by: 'you', message: 'Saved before starting a new game' });
      project.template = r.template || project.template;
      project.code = r.code;
      project.authors = '.'.repeat(r.code.split('\n').length);
      const t = templates.find((x) => x.id === project.template);
      if (t) mergeTests(t.tests, 'starter', true);
    } else {
      project.code = r.code;
      project.authors = carryAuthors(before, project.authors, r.code, 'p');
    }
    editor.setCode(project.code, project.authors);
    const v = store.addVersion(project, { by: 'pip', message: (r.summary || 'Pip made a change').slice(0, 100) });
    if (v) pipMsg.version = v.n;
    const range = r.focus || changedRange(before, r.code);
    if (range) setTimeout(() => editor.focusLines(range[0], range[1]), 50);
    renderVersions();
    renderChips();
    run();
  } else if (r.focus) {
    selectTab('t-code');
    editor.focusLines(r.focus[0], r.focus[1]);
  }
  if (r.testIdeas && r.testIdeas.length) mergeTests(r.testIdeas, 'pip');
  project.chat.push(pipMsg);
  if (project.chat.length > 80) project.chat.splice(0, project.chat.length - 80);
  logEl.appendChild(chatBubble(pipMsg));
  logEl.scrollTop = logEl.scrollHeight;
  store.touch(project);
  updateDirty();
  busy = false;
}

$('#chat-log').addEventListener('click', (e) => {
  const b = e.target.closest('[data-diff]');
  if (b) showDiff(Number(b.dataset.diff));
});
studio.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g) selectTab(g.dataset.goto);
});

/* ---------------- test plan ---------------- */
function mergeTests(texts, source, reset) {
  if (reset) project.testPlan = project.testPlan.filter((t) => t.source === 'you');
  const have = new Set(project.testPlan.map((t) => t.text.toLowerCase()));
  for (const text of texts) {
    if (!have.has(text.toLowerCase())) { project.testPlan.push({ id: uid(), text, status: 'todo', source }); have.add(text.toLowerCase()); }
  }
  renderTests();
}
function renderTests() {
  const plan = project.testPlan;
  $('#test-plan').innerHTML = plan.map((t) => `
    <li class="t-${t.status}" data-id="${t.id}">
      <div class="t-text">${esc(t.text)} ${t.source === 'pip' ? '<span class="tag">from Pip</span>' : t.source === 'you' ? '<span class="tag">yours</span>' : ''}</div>
      <div class="t-btns" role="group" aria-label="Result for: ${esc(t.text)}">
        <button type="button" data-st="pass" aria-pressed="${t.status === 'pass'}">✓ Works</button>
        <button type="button" data-st="fail" aria-pressed="${t.status === 'fail'}">✗ Broken</button>
        ${t.source !== 'starter' ? '<button type="button" data-st="del" aria-label="Remove test">🗑</button>' : ''}
      </div>
    </li>`).join('') || '<li class="small">No tests yet. Add one below.</li>';
  const done = plan.filter((t) => t.status === 'pass').length;
  $('#tests-count').textContent = plan.length ? `${done}/${plan.length}` : '';
}
$('#test-plan').addEventListener('click', (e) => {
  const b = e.target.closest('[data-st]');
  if (!b) return;
  const id = b.closest('li').dataset.id;
  const t = project.testPlan.find((x) => x.id === id);
  if (b.dataset.st === 'del') project.testPlan = project.testPlan.filter((x) => x.id !== id);
  else t.status = t.status === b.dataset.st ? 'todo' : b.dataset.st;
  if (t && t.status === 'fail' && b.dataset.st === 'fail') {
    $('#chat-input').value = `This test failed: "${t.text}". What might be wrong?`;
  }
  renderTests();
  store.touch(project);
});
$('#test-add').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#test-new').value.trim();
  if (!v) return;
  project.testPlan.push({ id: uid(), text: v, status: 'todo', source: 'you' });
  $('#test-new').value = '';
  renderTests();
  store.touch(project);
});

/* ---------------- checks ---------------- */
const LABEL = { pass: 'Looks good', work: 'Could improve', missing: 'Missing' };
function renderReport(r) {
  const el = $('#check-report');
  el.hidden = false;
  el.innerHTML = `
    <div class="score">
      <div class="ring" style="--p:${r.score}"><span>${r.score}</span></div>
      <div>
        <h3 style="margin:0">${r.shareReady ? 'Ready for the Creator\'s Check!' : r.result === 'ready' ? 'Nearly there' : 'Keep going'}</h3>
        <p class="small" style="margin:0">Checked ${new Date(r.checkedAt).toLocaleString('en-GB')} · ${esc(r.checker.engine)} v${esc(r.checker.version)}</p>
      </div>
    </div>
    <div class="review ${r.review.recommended ? 'yes' : 'no'}">${r.review.recommended ? 'Human review recommended: ' + r.review.reasons.map(esc).join(' ') : 'No review needed. The reasoning is saved with this version in case anyone wants to look.'}</div>
    <ul class="crit">${r.criteria.map((c) => `
      <li><span class="st ${c.status}">${LABEL[c.status]}</span>
        <div><b>${esc(c.label)}</b><p>${esc(c.justification)}</p>
        ${c.evidence && c.evidence.length ? `<p class="small"><i>Evidence: ${c.evidence.map(esc).join(' · ')}</i></p>` : ''}
        <p class="small">Confidence: ${esc(c.confidence)}</p></div></li>`).join('')}
    </ul>
    <p><b>${esc(r.nextStep)}</b></p>
    ${r.shareReady ? '<p><a class="btn btn-teal btn-sm" href="/academy#creators-check">Do the Creator\'s Check</a></p>' : ''}
    <p class="small">${esc(r.disclaimer)}</p>
    <details class="json"${studio.dataset.view === 'tech' ? ' open' : ''}><summary>The full check record (what reviewers see)</summary><pre>${esc(JSON.stringify(r, null, 2))}</pre></details>`;
}
$('#run-checks').addEventListener('click', async () => {
  const btn = $('#run-checks');
  btn.disabled = true; btn.textContent = 'Checking…';
  const runtime = await waitForTests();
  try {
    const res = await fetch('/api/studio/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: editor.getCode(), runtime, testPlan: project.testPlan.map(({ text, status }) => ({ text, status })) }) });
    const r = await res.json();
    project.lastCheck = r;
    const last = project.versions[project.versions.length - 1];
    if (last && last.code === project.code) last.score = r.score;
    store.touch(project);
    renderReport(r);
    renderVersions();
  } catch (e) {
    $('#check-report').hidden = false;
    $('#check-report').textContent = 'Could not run the checks. Check your connection and try again.';
  }
  btn.disabled = false; btn.textContent = 'Run checks';
});

/* ---------------- versions ---------------- */
function renderVersions() {
  const vs = project.versions;
  $('#versions-count').textContent = vs.length;
  const who = { pip: '🤖 Pip', you: '🧑 You', starter: '⭐ Starter', restore: '↩ Restored' };
  $('#versions').innerHTML = vs.slice().reverse().map((v) => `
    <li value="${v.n}">
      <div><b>v${v.n}</b> · ${who[v.by] || v.by} · ${esc(v.message)}${v.score != null ? ` <span class="tag">check ${v.score}</span>` : ''}<br><span class="small">${timeAgo(v.at)} · ${v.code.split('\n').length} lines</span></div>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost btn-sm" data-diff="${v.n}">See changes</button>
        ${v.code !== project.code ? `<button type="button" class="btn btn-ghost btn-sm" data-restore="${v.n}">Go back to this</button>` : '<span class="small">← you are here</span>'}
      </div>
    </li>`).join('');
}
$('#versions').addEventListener('click', (e) => {
  const d = e.target.closest('[data-diff]');
  if (d) return showDiff(Number(d.dataset.diff));
  const r = e.target.closest('[data-restore]');
  if (!r) return;
  const v = project.versions.find((x) => x.n === Number(r.dataset.restore));
  if (store.isDirty(project)) store.addVersion(project, { by: 'you', message: 'Saved before going back' });
  project.code = v.code; project.authors = v.authors;
  editor.setCode(project.code, project.authors);
  store.addVersion(project, { by: 'restore', message: `Went back to v${v.n}` });
  renderVersions(); updateDirty(); run();
});

function showDiff(n) {
  const i = project.versions.findIndex((x) => x.n === n);
  if (i < 0) return;
  const v = project.versions[i];
  const prev = project.versions[i - 1];
  const from = prev ? prev.code : '';
  const ops = diffLines(from.split('\n'), v.code.split('\n'));
  // Show only changed lines with 2 lines of context
  const keep = new Set();
  ops.forEach((o, k) => { if (o.type !== 'same') for (let j = k - 2; j <= k + 2; j++) keep.add(j); });
  let out = '', gap = false;
  ops.forEach((o, k) => {
    if (!keep.has(k)) { if (!gap) { out += '<span class="gap">⋯</span>'; gap = true; } return; }
    gap = false;
    const num = o.type === 'del' ? '' : o.b + 1;
    out += `<span class="${o.type}"><i>${num}</i>${o.type === 'add' ? '+' : o.type === 'del' ? '−' : ' '} ${esc(o.text)}</span>`;
  });
  $('#diff-title').textContent = `v${v.n}: ${v.message}` + (prev ? ` (compared with v${prev.n})` : '');
  $('#diff-view').innerHTML = keep.size ? out : 'No changes.';
  $('#diff-dialog').showModal();
}

/* ---------------- save ---------------- */
function openSave() {
  if (!store.isDirty(project)) { setStatus('Nothing new to save'); return; }
  $('#save-msg').value = '';
  $('#save-dialog').showModal();
}
$('#st-save').addEventListener('click', openSave);
$('#save-dialog').addEventListener('close', () => {
  if ($('#save-dialog').returnValue !== 'save') return;
  store.addVersion(project, { by: 'you', message: $('#save-msg').value.trim() || 'Saved by you' });
  renderVersions(); updateDirty();
});
$('#st-run').addEventListener('click', run);
addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && studio.contains(document.activeElement)) { e.preventDefault(); openSave(); }
});

/* ---------------- name ---------------- */
$('#st-name').addEventListener('input', () => { project.title = $('#st-name').value.trim() || 'My game'; autosave(); });

/* ---------------- new / open games ---------------- */
function renderNewDialog() {
  $('#template-list').innerHTML = templates.map((t) => `
    <button type="button" class="st-template" data-template="${t.id}">
      <span class="emoji" aria-hidden="true">${t.emoji}</span><b>${esc(t.name)}</b><span class="small">${esc(t.blurb)}</span>
    </button>`).join('');
  const games = store.list();
  $('#my-games-wrap').hidden = !games.length;
  $('#my-games').innerHTML = games.map((g) => `
    <li><div><b>${esc(g.title)}</b>${project && g.id === project.id ? ' <span class="tag">open now</span>' : ''}<br><span class="small">${esc(g.template)} · ${g.versions.length} versions · ${timeAgo(g.updated)}</span></div>
    <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-open="${g.id}">Open</button><button type="button" class="btn btn-ghost btn-sm" data-delete="${g.id}" aria-label="Delete ${esc(g.title)}">Delete</button></div></li>`).join('');
}
$('#st-new').addEventListener('click', () => { renderNewDialog(); $('#new-dialog').showModal(); });
$('#new-dialog').addEventListener('click', (e) => {
  const t = e.target.closest('[data-template]');
  if (t) {
    const tpl = templates.find((x) => x.id === t.dataset.template);
    const n = store.list().filter((g) => g.template === tpl.id).length;
    openProject(store.create({ title: n ? `${tpl.name} ${n + 1}` : `My ${tpl.name}`, template: tpl.id, code: tpl.code, tests: tpl.tests }));
    $('#new-dialog').close();
    return;
  }
  const o = e.target.closest('[data-open]');
  if (o) { openProject(store.open(o.dataset.open)); $('#new-dialog').close(); return; }
  const d = e.target.closest('[data-delete]');
  if (d) {
    const g = store.list().find((x) => x.id === d.dataset.delete);
    if (d.dataset.confirm) {
      store.remove(g.id);
      if (project && project.id === g.id) project = null;
      renderNewDialog();
    } else {
      d.dataset.confirm = '1';
      d.textContent = 'Really delete?';
    }
  }
});
$('#new-dialog').addEventListener('close', () => {
  if (!project) { // must have something open
    const t = templates[0];
    openProject(store.create({ title: `My ${t.name}`, template: t.id, code: t.code, tests: t.tests }));
  }
});

function openProject(p) {
  project = p;
  $('#st-name').value = p.title;
  editor.setCode(p.code, p.authors);
  $('#check-report').hidden = true;
  if (p.lastCheck) renderReport(p.lastCheck);
  renderChat(); renderChips(); renderTests(); renderVersions(); updateDirty();
  run();
}

/* ---------------- export ---------------- */
function exportFiles() {
  const slug = (project.title || 'my-game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-game';
  const html = indexHtml(project.title);
  const plan = project.testPlan.map((t) => `- [${t.status === 'pass' ? 'x' : ' '}] ${t.text}${t.status === 'fail' ? ' (BROKEN)' : ''}`).join('\n');
  const readme = `# ${project.title}\n\nA browser game made with PlayTinker's Creator Studio (made with help from Pip, an AI helper).\n\n## Play it\n\nOpen \`index.html\` in a web browser. That's it: no installs needed.\n\n## Files\n\n- \`index.html\`: the page with the game canvas\n- \`game.js\`: all the game code (settings are at the top)\n- \`TEST-PLAN.md\`: how this game was tested\n- \`check-record.json\`: the latest automatic check, with its reasoning\n\n## Put it online with GitHub Pages\n\n1. Create a new public repository on GitHub.\n2. Choose **Add file → Upload files** and upload these files.\n3. Go to **Settings → Pages**, pick the \`main\` branch and save.\n4. After a minute your game is live at \`https://<your-username>.github.io/<repository-name>/\`.\n\nVersion ${project.versions[project.versions.length - 1].n}, exported ${new Date().toLocaleDateString('en-GB')}.\n`;
  const files = [
    { name: `${slug}/index.html`, text: html },
    { name: `${slug}/game.js`, text: project.code },
    { name: `${slug}/README.md`, text: readme },
    { name: `${slug}/TEST-PLAN.md`, text: `# Test plan: ${project.title}\n\n${plan}\n` },
  ];
  if (project.lastCheck) files.push({ name: `${slug}/check-record.json`, text: JSON.stringify(project.lastCheck, null, 2) });
  return { slug, files };
}
function indexHtml(title) {
  return `<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(title)}</title>\n<style>\n  html, body { margin: 0; height: 100%; background: #0B1830; overflow: hidden; }\n  body { display: flex; align-items: center; justify-content: center; }\n  canvas { display: block; touch-action: none; max-width: 100vw; max-height: 100vh; aspect-ratio: 8 / 5; width: min(100vw, 160vh); }\n</style>\n</head>\n<body>\n<canvas id="game" width="800" height="500" aria-label="${esc(title)}"></canvas>\n<script src="game.js"></script>\n</body>\n</html>\n`;
}
$('#export-zip').addEventListener('click', () => {
  const { slug, files } = exportFiles();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(makeZip(files));
  a.download = slug + '.zip';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  $('#export-msg').textContent = `Downloaded ${slug}.zip`;
});
$('#copy-code').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(project.code); $('#export-msg').textContent = 'game.js copied.'; }
  catch (e) { $('#export-msg').textContent = 'Copy is blocked here. Select the code in the Code tab instead.'; }
});
$('#show-html').addEventListener('click', (e) => {
  const showing = e.currentTarget.getAttribute('aria-pressed') === 'true';
  e.currentTarget.setAttribute('aria-pressed', String(!showing));
  e.currentTarget.classList.toggle('on', !showing);
  e.currentTarget.previousElementSibling.classList.toggle('on', showing);
  e.currentTarget.previousElementSibling.setAttribute('aria-pressed', String(showing));
  $('#html-view').hidden = showing;
  $('#editor').hidden = !showing;
  $('#html-view').textContent = indexHtml(project.title) + '\n<!-- index.html is created for you and is read-only. Your code lives in game.js. -->';
});
$('.st-files button.on').addEventListener('click', () => { if ($('#show-html').getAttribute('aria-pressed') === 'true') $('#show-html').click(); });

/* ---------------- tabs helper ---------------- */
function selectTab(id) { const t = document.getElementById(id); if (t) t.click(); }

/* ---------------- start ---------------- */
(async function init() {
  let view = 'simple';
  try { view = localStorage.getItem('playtinker.studio.view') || 'simple'; } catch (e) { /* ignore */ }
  setView(view);
  try {
    const [t, s] = await Promise.all([
      fetch('/api/studio/templates').then((r) => r.json()),
      fetch('/api/pip/status').then((r) => r.json()).catch(() => ({ mode: 'demo' })),
    ]);
    templates = t.templates;
    pipMode = s.mode;
  } catch (e) {
    setRun('bad', 'Could not load the studio. Check your connection and refresh.');
    return;
  }
  const modeEl = $('#pip-mode');
  modeEl.textContent = pipMode === 'claude' ? 'AI mode' : 'practice mode';
  modeEl.title = pipMode === 'claude' ? 'Pip is using Claude to write code.' : 'No AI is connected yet. Pip can change settings, explain code and suggest tests.';

  store.load();
  const params = new URLSearchParams(location.search);
  const wanted = templates.find((x) => x.id === params.get('template'));
  if (wanted) {
    openProject(store.create({ title: `My ${wanted.name}`, template: wanted.id, code: wanted.code, tests: wanted.tests }));
    history.replaceState(null, '', location.pathname + location.hash);
  } else if (store.current()) {
    openProject(store.current());
  } else {
    renderNewDialog();
    $('#new-dialog').showModal();
  }
  fitDevice();
})();
