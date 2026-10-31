// Renders check reports from /api/prompt-check and /api/creators-check.
// Every report shows the verdict, the reasoning, the evidence and whether a person should review it.
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LABEL = { pass: 'Looks good', work: 'Could improve', missing: 'Missing' };

  function render(el, r) {
    el.hidden = false;
    el.innerHTML = `
      <div class="score">
        <div class="ring" style="--p:${r.score}"><span>${r.score}</span></div>
        <div>
          <h3 style="margin:0">${r.result === 'ready' ? 'Ready!' : 'Nearly there'}</h3>
          <p class="small" style="margin:0">Checked ${new Date(r.checkedAt).toLocaleString('en-GB')} · ${esc(r.checker.engine)}</p>
        </div>
      </div>
      <div class="review ${r.review.recommended ? 'yes' : 'no'}">
        ${r.review.recommended
          ? 'Human review recommended: ' + r.review.reasons.map(esc).join(' ')
          : 'No review needed. The reasoning is saved in case anyone wants to look.'}
      </div>
      <ul class="crit">
        ${r.criteria.map((c) => `
          <li><span class="st ${c.status}">${LABEL[c.status]}</span>
            <div><b>${esc(c.label)}</b>${c.question ? `<span class="small">${esc(c.question)}</span>` : ''}
              <p>${esc(c.justification)}</p>
              ${c.evidence && c.evidence.length ? `<p><i>Evidence: “${esc(c.evidence[0])}”</i></p>` : ''}
              <p class="small">Confidence: ${esc(c.confidence)}</p>
            </div></li>`).join('')}
      </ul>
      ${r.improvedPromptTemplate ? `<div class="callout"><b>Try this shape:</b><p class="mono" style="margin:6px 0 0;font-size:.9rem">${esc(r.improvedPromptTemplate)}</p></div>` : ''}
      ${r.nextStep ? `<p><b>${esc(r.nextStep)}</b></p>` : ''}
      <p class="small">${esc(r.disclaimer)}</p>
      <details class="json"><summary>See the full check record (what reviewers see)</summary><pre>${esc(JSON.stringify(r, null, 2))}</pre></details>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function post(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  }

  const pf = document.getElementById('prompt-form');
  if (pf) {
    pf.addEventListener('submit', async (e) => {
      e.preventDefault();
      render(document.getElementById('prompt-report'), await post('/api/prompt-check', { prompt: pf.prompt.value }));
    });
    document.querySelectorAll('[data-example]').forEach((b) => b.addEventListener('click', () => {
      pf.prompt.value = b.dataset.example; pf.requestSubmit();
    }));
  }

  const cf = document.getElementById('cc-form');
  if (cf) {
    cf.addEventListener('submit', async (e) => {
      e.preventDefault();
      render(document.getElementById('cc-report'), await post('/api/creators-check', Object.fromEntries(new FormData(cf))));
    });
    const fill = document.getElementById('cc-example');
    if (fill) fill.addEventListener('click', () => {
      cf.intent.value = 'I wanted a game where the player is a hedgehog who has to collect apples and avoid logs. You win points for every apple and lose if you hit a log. I wanted it to feel fast and bouncy.';
      cf.ownership.value = 'Pip (the AI) helped me write the jump. It works because gravity is added to the speed every frame, and jumping sets the speed negative so the hedgehog goes up, then falls. I changed the gravity number myself.';
      cf.functionality.value = 'It works. It loads with no errors and you can play until you hit a log.';
      cf.quality.value = 'I tested it on my laptop and my mum\'s phone. On the phone the jump button did not work at first. My brother tried it too.';
      cf.improvement.value = 'After my brother said it was too easy I made the logs come faster as your score goes up, and I fixed tapping on phones.';
    });
  }
})();
