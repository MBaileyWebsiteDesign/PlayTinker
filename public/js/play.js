// Game library: Play, Inspect, Remix.
(async function () {
  const lib = document.getElementById('library');
  const studio = document.getElementById('studio');
  if (!lib) return;
  const games = await (await fetch('/games/games.json')).json();

  lib.innerHTML = games.map((g) => `
    <article class="card game-card">
      <img class="cover" src="${g.image}" alt="">
      <h3>${g.title}</h3>
      <p>${g.blurb}</p>
      <p class="small">${g.controls} · <span class="tag">${g.visibility}</span></p>
      <div class="actions">
        <a class="btn btn-orange btn-sm" href="?game=${g.id}#play">Play</a>
        <a class="btn btn-teal btn-sm" href="?game=${g.id}#inspect">Inspect</a>
        <a class="btn btn-lilac btn-sm" href="?game=${g.id}#remix">Remix</a>
      </div>
    </article>`).join('') + `
    <article class="card mint">
      <h3>Your game here?</h3>
      <p>Games made by creators can appear here once they pass the Creator's Check <b>and</b> a parent or guardian allows public sharing.</p>
      <a class="btn btn-dark btn-sm" href="/create">Start creating</a>
    </article>`;

  const id = new URLSearchParams(location.search).get('game');
  const game = games.find((g) => g.id === id);
  if (!game) return;
  studio.hidden = false;
  document.getElementById('studio-title').textContent = game.title;
  document.getElementById('studio-controls').textContent = game.controls;
  const frame = document.getElementById('game-frame');
  const base = `/games/${game.id}/index.html`;
  frame.src = base;
  frame.title = game.title;

  // Inspect: show the real source code, with comments highlighted
  const src = await (await fetch(`/games/${game.id}/game.js`)).text();
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  document.getElementById('source').innerHTML = src.split('\n')
    .map((l) => (/^\s*\/\//.test(l) ? `<span class="c">${esc(l)}</span>` : esc(l))).join('\n');
  document.getElementById('explain').innerHTML = game.explain
    .map(([h, t]) => `<li><b>${h}</b><br>${t}</li>`).join('');

  // Remix: sliders write to the URL the game reads its settings from
  const form = document.getElementById('remix-form');
  form.innerHTML = game.params.map((p) => p.type === 'color'
    ? `<div class="field"><label for="p-${p.key}">${p.label}</label><input id="p-${p.key}" name="${p.key}" type="color" value="${p.value}"><span class="hint">${p.hint}</span></div>`
    : `<div class="field"><div class="range-row"><label for="p-${p.key}">${p.label}</label><output id="o-${p.key}">${p.value}</output></div>
       <input id="p-${p.key}" name="${p.key}" type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}"><span class="hint">${p.hint}</span></div>`
  ).join('') + `<div class="btn-row"><button class="btn btn-lilac" type="submit">Try my remix</button><button class="btn btn-ghost" type="reset">Reset</button></div>`;
  form.addEventListener('input', (e) => { const o = document.getElementById('o-' + e.target.name); if (o) o.textContent = e.target.value; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    frame.src = base + '?' + new URLSearchParams(new FormData(form)).toString();
    frame.focus();
    document.getElementById('remix-note').hidden = false;
  });
  form.addEventListener('reset', () => setTimeout(() => {
    game.params.forEach((p) => { const o = document.getElementById('o-' + p.key); if (o) o.textContent = p.value; });
    frame.src = base;
  }));

  studio.scrollIntoView({ block: 'start' });
})();
