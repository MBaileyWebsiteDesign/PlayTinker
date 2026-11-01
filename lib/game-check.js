/**
 * Automatic game checks for the Creator Studio.
 *
 * Combines two kinds of evidence:
 *   1. Static checks on the code (safe? readable? has a goal?)
 *   2. Runtime results reported by the sandboxed runner (did it run, draw, animate, listen for input?)
 * plus the creator's own test plan. Output uses the same explainable check record as every
 * other PlayTinker check: verdict, justification, evidence, confidence and a review flag.
 */
const { piiFindings, base, finish } = require('./checks');

function lineOf(code, re) {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return { line: i + 1, text: lines[i].trim().slice(0, 80) };
  return null;
}
const ev = (hit) => (hit ? [`line ${hit.line}: ${hit.text}`] : []);

const UNSAFE = [
  { re: /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/, what: 'tries to use the internet' },
  { re: /https?:\/\//, what: 'contains a web address' },
  { re: /\bimport\s*\(|^\s*import\s/, what: 'imports outside code' },
  { re: /\beval\s*\(|new\s+Function\s*\(/, what: 'runs code from text (eval)' },
  { re: /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/, what: 'tries to store data in the browser' },
  { re: /\b(window\.open|top\.|parent\.|opener)\b/, what: 'tries to reach outside the game' },
  { re: /\b(getUserMedia|geolocation)\b/, what: 'asks for the camera, microphone or location' },
];

function gameCheck({ code = '', runtime = null, testPlan = [] }) {
  code = String(code).slice(0, 60000);
  const out = { ...base('game-check'), checker: { ...base('game-check').checker, mode: 'automatic', engine: 'PlayTinker game checks (code + sandbox run)' } };
  const c = [];
  const rt = runtime && typeof runtime === 'object' ? runtime : null;
  const errors = rt && Array.isArray(rt.errors) ? rt.errors.slice(0, 5) : [];

  // 1. Runs without errors
  if (!rt) c.push({ id: 'runs', label: 'Runs without errors', status: 'work', confidence: 'low', evidence: [], justification: 'The game has not been run in the safe preview yet, so I cannot tell. Press Run first.' });
  else if (errors.length) c.push({ id: 'runs', label: 'Runs without errors', status: 'missing', confidence: 'high', evidence: errors.map((e) => `line ${e.line || '?'}: ${String(e.message).slice(0, 120)}`),
    justification: `The game hit ${errors.length === 1 ? 'an error' : errors.length + ' errors'} while running. Errors usually stop the game. Look at the line number shown.` });
  else c.push({ id: 'runs', label: 'Runs without errors', status: 'pass', confidence: 'high', evidence: [], justification: `Ran for ${Math.round((rt.ranFor || 3000) / 1000)} seconds in the sandbox with no errors.` });

  // 2. Draws something
  if (rt) c.push(rt.draws
    ? { id: 'draws', label: 'Shows something on screen', status: 'pass', confidence: 'high', evidence: [`${rt.colours || 'several'} different colours seen on the canvas`], justification: 'The canvas is not blank, so the player can see the game.' }
    : { id: 'draws', label: 'Shows something on screen', status: 'missing', confidence: 'medium', evidence: [], justification: 'The canvas stayed blank (one colour). Check your draw function is being called.' });

  // 3. Game loop
  const raf = lineOf(code, /requestAnimationFrame/);
  if (!raf) c.push({ id: 'loop', label: 'Has a game loop', status: 'missing', confidence: 'high', evidence: [], justification: 'I could not find requestAnimationFrame, so the game probably does not animate. Games redraw about 60 times a second.' });
  else if (rt && rt.fps < 20) c.push({ id: 'loop', label: 'Has a game loop', status: 'work', confidence: 'medium', evidence: ev(raf), justification: `The loop exists but only ran about ${Math.round(rt.fps)} times a second in the test. It might stop early or be doing too much work.` });
  else c.push({ id: 'loop', label: 'Has a game loop', status: 'pass', confidence: rt ? 'high' : 'medium', evidence: ev(raf), justification: rt ? `The loop ran smoothly (about ${Math.round(rt.fps)} frames a second).` : 'Found requestAnimationFrame, which drives the game loop.' });

  // 4. Controls (keyboard and touch)
  const kb = (rt && rt.listens && rt.listens.keyboard) || /keydown|keyup|onkeydown/.test(code);
  const touch = (rt && rt.listens && rt.listens.touch) || /pointerdown|touchstart|mousedown|onclick|'click'|"click"/.test(code);
  const kbHit = lineOf(code, /keydown|keyup/), tHit = lineOf(code, /pointerdown|touchstart|mousedown|click/);
  c.push(kb && touch
    ? { id: 'controls', label: 'Keyboard and touch controls', status: 'pass', confidence: 'high', evidence: [...ev(kbHit), ...ev(tHit)], justification: 'Listens for keys and for taps or clicks, so it works on laptops and phones.' }
    : kb || touch
      ? { id: 'controls', label: 'Keyboard and touch controls', status: 'work', confidence: 'high', evidence: ev(kbHit || tHit), justification: kb ? 'Keyboard works, but there is no touch control, so phone players cannot play. Add a pointerdown listener.' : 'Touch works, but there are no keyboard controls. Add a keydown listener.' }
      : { id: 'controls', label: 'Keyboard and touch controls', status: 'missing', confidence: 'high', evidence: [], justification: 'I could not find any controls. How does the player play?' });

  // 5. Goal: score plus a way to win or lose
  const score = lineOf(code, /\bscore\b|\bpoints\b|\bcoins\b/i);
  const end = lineOf(code, /game ?over|'over'|"over"|'won'|"won"|you win|lives\s*<=?\s*0|timeLeft\s*<=?\s*0/i);
  c.push(score && end
    ? { id: 'goal', label: 'Has a goal', status: 'pass', confidence: 'medium', evidence: [...ev(score), ...ev(end)], justification: 'Has a score and a way for the game to end, so the player knows what to aim for.' }
    : { id: 'goal', label: 'Has a goal', status: score || end ? 'work' : 'missing', confidence: 'medium', evidence: ev(score || end),
      justification: score ? 'Has a score, but I could not find a way to win or lose. Games feel better with an ending.' : end ? 'Has an ending, but no score to aim for.' : 'I could not find a score or a way to win or lose. What is the player trying to do?' });

  // 6. Can play again
  const again = lineOf(code, /function\s+(start|reset|restart|newGame)\b|play again/i);
  c.push(again
    ? { id: 'restart', label: 'Can play again', status: 'pass', confidence: 'medium', evidence: ev(again), justification: 'There is a start or reset step, so players can have another go without reloading.' }
    : { id: 'restart', label: 'Can play again', status: 'work', confidence: 'medium', evidence: [], justification: 'I could not find a start or reset function. Players like to try again straight away.' });

  // 7. Safe: stays inside the sandbox
  const unsafe = UNSAFE.map((u) => ({ ...u, hit: lineOf(code, u.re) })).filter((u) => u.hit);
  const blocked = rt && Array.isArray(rt.blocked) ? rt.blocked : [];
  c.push(unsafe.length || blocked.length
    ? { id: 'safe', label: 'Stays safely inside the game', status: 'missing', confidence: 'high', evidence: [...unsafe.flatMap((u) => ev(u.hit)), ...blocked.slice(0, 2).map((b) => `blocked: ${b}`)],
      justification: `The code ${[...new Set(unsafe.map((u) => u.what))].join(', ') || 'tried to do something the sandbox blocked'}. PlayTinker games must not reach outside the game, so this must be removed before sharing.` }
    : { id: 'safe', label: 'Stays safely inside the game', status: 'pass', confidence: 'high', evidence: [], justification: 'No internet use, outside code, storage or attempts to reach outside the game.' });

  // 8. Privacy
  const pii = piiFindings(code);
  c.push(pii.length
    ? { id: 'privacy', label: 'No personal information', status: 'missing', confidence: 'medium', evidence: [], justification: `The code may contain ${pii.join(', ')}. Remove personal details before sharing.` }
    : { id: 'privacy', label: 'No personal information', status: 'pass', confidence: 'medium', evidence: [], justification: 'No email addresses, phone numbers, postcodes, school names or full names found.' });

  // 9. Readable
  const lines = code.split('\n').filter((l) => l.trim());
  const comments = lines.filter((l) => /^\s*\/\/|\/\*/.test(l)).length;
  const settings = lineOf(code, /^const\s+[A-Z][A-Z0-9_]*\s*=/);
  const ratio = lines.length ? comments / lines.length : 0;
  c.push(ratio >= 0.06 && settings
    ? { id: 'readable', label: 'Easy to read', status: 'pass', confidence: 'medium', evidence: [`${comments} comment lines in ${lines.length} lines`], justification: 'Has a Settings block and comments explaining the parts, so others (and future you) can understand it.' }
    : { id: 'readable', label: 'Easy to read', status: 'work', confidence: 'medium', evidence: [`${comments} comment lines in ${lines.length} lines`],
      justification: settings ? 'Add a few more comments explaining what each part does.' : 'Keep tweakable numbers in a Settings block at the top, and add comments.' });

  // 10. Tested by the creator
  const plan = Array.isArray(testPlan) ? testPlan : [];
  const passed = plan.filter((t) => t && t.status === 'pass').length;
  const failed = plan.filter((t) => t && t.status === 'fail').length;
  c.push(passed >= 3 && failed === 0
    ? { id: 'tested', label: 'Tested by you', status: 'pass', confidence: 'high', evidence: [`${passed} of ${plan.length} tests passed`], justification: 'You tested the game yourself and ticked off what works. Automatic checks cannot replace a real player.' }
    : { id: 'tested', label: 'Tested by you', status: passed || failed ? 'work' : 'missing', confidence: 'high', evidence: [`${passed} passed, ${failed} failed, ${plan.length - passed - failed} not tried`],
      justification: failed ? `${failed} test${failed === 1 ? '' : 's'} in your plan failed. Fix ${failed === 1 ? 'it' : 'them'} (or ask Pip for help), then test again.` : 'Work through your Test plan: play the game and mark what works. At least 3 passing tests are needed.' });

  const extra = [];
  if (unsafe.length || blocked.length) extra.push('Unsafe code found: a person should look before this game is shared.');
  if (pii.length) extra.push(`Possible personal information found (${pii.join(', ')}).`);
  const res = finish(out, c, extra);
  res.shareReady = res.result === 'ready' && !c.some((x) => ['runs', 'safe', 'privacy'].includes(x.id) && x.status !== 'pass');
  res.nextStep = res.shareReady
    ? 'Your game passes the automatic checks. Next: the Creator\'s Check, then ask a parent or guardian before sharing.'
    : `Next: ${c.filter((x) => x.status !== 'pass').slice(0, 3).map((x) => x.label.toLowerCase()).join(', ')}.`;
  return res;
}

module.exports = { gameCheck };
