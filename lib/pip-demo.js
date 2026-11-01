/**
 * Pip "practice mode": a small, transparent rule-based helper used when no AI key is set.
 *
 * It understands simple requests about the Settings block at the top of every starter game
 * ("make the basket faster", "background purple", "5 lives", "call it Moon Run"), can explain
 * each section of the code, suggests tests and can start a new game from a starter.
 * It returns exactly the same response shape as the Claude-powered Pip (see lib/pip.js).
 */
const { TEMPLATES, findTemplate, templateCode } = require('./studio-templates');

/* ---------- vocabulary ---------- */
const DIRECTIONS = {
  speed: { up: ['faster', 'quicker', 'speedier', 'speed up', 'more speed', 'zoomier'], down: ['slower', 'slow down', 'less speed', 'slowly'], hint: ['fast', 'slow', 'quick', 'speed'] },
  size: { up: ['bigger', 'larger', 'wider', 'huge', 'giant', 'grow', 'fatter'], down: ['smaller', 'tinier', 'narrower', 'tiny', 'shrink', 'thinner'], hint: ['size', 'big', 'small', 'wide', 'width', 'pixels'] },
  amount: { up: ['more', 'lots', 'loads', 'often', 'extra', 'increase', 'harder'], down: ['fewer', 'less', 'reduce', 'rarely', 'no ', 'none', 'easier'], hint: ['amount', 'number of', 'how many'] },
  height: { up: ['higher', 'bigger', 'stronger', 'further', 'more', 'taller'], down: ['lower', 'smaller', 'weaker', 'less', 'shorter'], hint: ['jump', 'height'] },
  time: { up: ['more', 'longer', 'extra', 'increase'], down: ['less', 'shorter', 'fewer', 'decrease'], hint: ['time', 'timer'] },
  gravity: { up: ['heavier', 'heavy', 'stronger', 'more', 'faster'], down: ['floaty', 'floatier', 'lighter', 'moon', 'weaker', 'less', 'slower'], hint: ['gravity'] },
};

// Each setting: words that name it, which direction words apply, and safe limits.
const SETTINGS = {
  PLAYER_SPEED: { nouns: ['player', 'basket', 'me', 'hero', 'character', 'square', 'move', 'moving', 'movement', 'i move', 'hedgehog'], dir: 'speed', min: 1, max: 25, mode: 'mult', label: 'how fast you move' },
  PLAYER_SIZE: { nouns: ['player', 'basket', 'me', 'hero', 'character', 'square', 'hedgehog'], dir: 'size', min: 8, max: 300, mode: 'mult', int: true, label: 'how big you are' },
  FALL_SPEED: { nouns: ['fall', 'falling', 'drop', 'stars', 'things', 'items', 'objects'], dir: 'speed', min: 0.5, max: 15, mode: 'mult', label: 'how fast things fall' },
  DROP_EVERY: { nouns: ['things', 'stars', 'items', 'drops', 'stuff', 'objects', 'falling'], dir: 'amount', min: 8, max: 200, mode: 'mult', int: true, invert: true, label: 'frames between drops (smaller means more things)' },
  BAD_CHANCE: { nouns: ['bad', 'rock', 'rocks', 'meteor', 'meteors', 'baddies', 'enemies', 'enemy', 'asteroid', 'asteroids', 'bombs'], dir: 'amount', min: 0, max: 1, mode: 'add', step: 0.15, label: 'the chance a falling thing is bad (0 to 1)' },
  LIVES: { nouns: ['life', 'lives', 'heart', 'hearts', 'health'], dir: 'amount', min: 1, max: 20, mode: 'add', step: 1, int: true, label: 'how many lives you start with' },
  JUMP_POWER: { nouns: ['jump', 'jumps', 'jumping'], dir: 'height', min: 4, max: 40, mode: 'mult', label: 'how high you jump' },
  GRAVITY: { nouns: ['gravity', 'floaty', 'floatier', 'heavy', 'heavier', 'moon'], dir: 'gravity', min: 0.1, max: 3, mode: 'mult', label: 'how quickly you fall back down' },
  GAME_SPEED: { nouns: ['game', 'world', 'scroll', 'scrolling', 'level', 'everything', 'it '], dir: 'speed', min: 1, max: 25, mode: 'mult', label: 'how fast the world scrolls' },
  OBSTACLE_EVERY: { nouns: ['obstacle', 'obstacles', 'logs', 'rocks', 'walls', 'spikes'], dir: 'amount', min: 20, max: 300, mode: 'mult', int: true, invert: true, label: 'frames between obstacles (smaller means more)' },
  ENEMY_COUNT: { nouns: ['enemy', 'enemies', 'baddies', 'monsters', 'ghosts'], dir: 'amount', min: 0, max: 15, mode: 'add', step: 2, int: true, label: 'how many enemies there are at the start' },
  ENEMY_SPEED: { nouns: ['enemy', 'enemies', 'baddies', 'monsters', 'ghosts'], dir: 'speed', min: 0.5, max: 12, mode: 'mult', label: 'how fast enemies move' },
  GEMS_TO_WIN: { nouns: ['gems', 'gem', 'win', 'to win'], dir: 'amount', min: 1, max: 100, mode: 'add', step: 5, int: true, label: 'how many gems you need to win' },
  TIME_LIMIT: { nouns: ['time', 'timer', 'seconds', 'clock'], dir: 'time', min: 10, max: 600, mode: 'add', step: 15, int: true, label: 'seconds before time runs out' },
};

const COLOUR_TARGETS = {
  BG_COLOUR: ['background', 'sky', 'bg', 'screen', 'space'],
  PLAYER_COLOUR: ['player', 'basket', 'me', 'hero', 'character', 'square', 'hedgehog'],
  GOOD_COLOUR: ['star', 'stars', 'good', 'things to catch'],
  BAD_COLOUR: ['bad', 'rock', 'rocks', 'meteor', 'meteors', 'bombs'],
  GROUND_COLOUR: ['ground', 'floor', 'grass'],
  OBSTACLE_COLOUR: ['obstacle', 'obstacles', 'log', 'logs', 'wall', 'walls'],
  COIN_COLOUR: ['coin', 'coins'],
  ENEMY_COLOUR: ['enemy', 'enemies', 'baddies', 'monsters'],
  GEM_COLOUR: ['gem', 'gems', 'diamond'],
};

const COLOURS = {
  'light blue': '#8FD3FF', 'sky blue': '#8FD3FF', 'dark blue': '#14234A', 'navy': '#14234A',
  'dark green': '#1E5631', 'light green': '#9BE29B', 'dark purple': '#2A1B5C', 'light purple': '#C9B8FF',
  red: '#FF4D4D', orange: '#FF9842', yellow: '#FFD24A', gold: '#FFC107', green: '#4CAF50', lime: '#B6F04A',
  teal: '#21B6AB', turquoise: '#2ED3C6', cyan: '#3EE0F0', blue: '#3D7BFF', purple: '#7B4DFF', violet: '#8F5CFF',
  lilac: '#9B8AFB', pink: '#FF6FB5', magenta: '#E040FB', brown: '#8B5A2B', black: '#111111', white: '#FFFFFF',
  grey: '#8A8F98', gray: '#8A8F98', silver: '#C0C7D1', cream: '#FFF7E8', rainbow: null,
};

/* ---------- helpers ---------- */
const has = (text, words) => words.find((w) => new RegExp(`(^|[^a-z])${w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text));

function readSettings(code) {
  const out = {};
  code.split('\n').forEach((line, i) => {
    const m = line.match(/^const\s+([A-Z][A-Z0-9_]*)\s*=\s*([^;]+);/);
    if (m) out[m[1]] = { raw: m[2].trim(), line: i + 1 };
  });
  return out;
}

function setSetting(code, name, raw) {
  const re = new RegExp(`^(const\\s+${name}\\s*=\\s*)([^;]+)(;.*)$`, 'm');
  return code.replace(re, (_, a, _b, c) => `${a}${raw}${c}`);
}

function niceNumber(n, int) {
  if (int) return String(Math.round(n));
  return String(Math.round(n * 100) / 100);
}

function sections(code) {
  const lines = code.split('\n');
  const found = [];
  lines.forEach((l, i) => {
    const m = l.match(/^\/\/\s*-{2,}\s*(\d+)\.\s*(.+?)\s*-*\s*$/);
    if (m) found.push({ num: Number(m[1]), title: m[2], start: i + 1 });
  });
  found.forEach((s, i) => { s.end = (found[i + 1] ? found[i + 1].start : lines.length + 1) - 1; });
  return found;
}

/* ---------- explain ---------- */
const TOPICS = [
  { num: 1, words: ['setting', 'settings', 'const', 'constant', 'constants'], text: 'The Settings are named values at the very top. `const` means the value stays the same while the game runs. Putting them in one place means you can change how the game feels without hunting through the code. Try changing one number and pressing Run.' },
  { num: 2, words: ['canvas', 'ctx', 'drawing area', 'context', 'width', 'height'], text: 'The canvas is the rectangle the game is drawn on (800 by 500 pixels). `ctx` is the "pen" you draw with. `W` and `H` are short names for its width and height.' },
  { num: 3, words: ['object', 'objects', 'variable', 'variables', 'let', 'array', 'state', 'score'], text: 'These variables remember everything about the game right now: where the player is, the list of things on screen, the score and lives. `let` means the value can change. `state` says whether we are on the start screen, playing or game over.' },
  { num: 4, words: ['control', 'controls', 'key', 'keys', 'keyboard', 'touch', 'pointer', 'mouse', 'event', 'addeventlistener', 'tap'], text: 'Controls use event listeners. `addEventListener("keydown", ...)` runs code when a key is pressed. `pointerdown` works for mouse clicks and finger taps, which is why the game works on phones too.' },
  { num: 5, words: ['update', 'collision', 'collide', 'catch', 'overlap', 'overlaps', 'hit', 'gravity', 'jump', 'move', 'timer'], text: 'Update runs about 60 times a second. It moves everything a tiny bit, then checks for collisions (is the player touching something?). Changing score and lives happens here.' },
  { num: 6, words: ['draw', 'drawing', 'fillrect', 'arc', 'colour', 'color', 'paint', 'text', 'filltext'], text: 'Draw paints the whole picture again every frame: background first, then objects, then the player, then the score on top. Things drawn later appear in front.' },
  { num: 7, words: ['loop', 'game loop', 'requestanimationframe', 'frame', 'frames'], text: 'The game loop is the heartbeat of the game: update, draw, then ask the browser to call `loop` again before the next screen refresh, about 60 times a second.' },
];

function explain(text, code) {
  const secs = sections(code);
  const settings = readSettings(code);
  // A specific setting by name or by its words?
  const named = Object.keys(settings).find((n) => text.toUpperCase().includes(n));
  if (named && SETTINGS[named]) {
    return { reply: `\`${named}\` (line ${settings[named].line}) is ${SETTINGS[named].label}. It's set to ${settings[named].raw} right now. Try a bigger and a smaller number, then press Run to feel the difference.`, focus: [settings[named].line, settings[named].line] };
  }
  const topic = TOPICS.find((t) => has(text, t.words));
  if (topic) {
    const s = secs.find((x) => x.num === topic.num);
    return { reply: topic.text + (s ? ` I've highlighted section ${s.num}, "${s.title}" (lines ${s.start} to ${s.end}).` : ''), focus: s ? [s.start, s.end] : null };
  }
  return {
    reply: 'Your game has ' + (secs.length || 'a few') + ' sections: ' + secs.map((s) => `${s.num}. ${s.title}`).join(', ') + '. Ask me about one, like "explain the game loop" or "how do the controls work?"',
    focus: null,
  };
}

/* ---------- main ---------- */
function findColour(text) {
  const hex = text.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i);
  if (hex) return { name: hex[0], hex: hex[0].toUpperCase() };
  const name = Object.keys(COLOURS).find((c) => has(text, [c]));
  if (!name) return null;
  if (name === 'rainbow') return { name, hex: null };
  return { name, hex: COLOURS[name] };
}

function direction(text, kind) {
  const d = DIRECTIONS[kind];
  if (has(text, d.down)) return -1;
  if (has(text, d.up)) return 1;
  return 0;
}

function splitClauses(text) {
  return text.split(/\s*(?:,|\.|;|!|\band then\b|\bthen\b|\band also\b|\balso\b|\band\b)\s*/).map((s) => s.trim()).filter(Boolean);
}

function respond({ message, code }) {
  const raw = String(message || '').trim();
  const text = ' ' + raw.toLowerCase().replace(/\bcolor/g, 'colour') + ' ';
  const base = { mode: 'demo', code: null, focus: null, summary: '', explain: [], testIdeas: [], replaceAll: false };

  if (!raw) return { ...base, reply: 'Tell me what you want to change. For example: "make the basket faster" or "make the background purple".' };

  // Start a new game
  if (/\b(new|another|different|start|make|build|create)\b.*\bgame\b/.test(text) && !/\b(this|my|the) game\b.*\b(faster|slower|harder|easier)\b/.test(text)) {
    const tpl = findTemplate(text);
    if (tpl) {
      return {
        ...base,
        reply: `Let's start a new ${tpl.name} game! I've loaded the starter. Your old version is saved in Versions if you want it back. Press Run to play it, then tell me the first thing you'd like to change.`,
        code: templateCode(tpl.id), replaceAll: true, template: tpl.id,
        summary: `Started a new ${tpl.name} game`,
        testIdeas: tpl.tests.slice(0, 3),
      };
    }
    return { ...base, reply: 'What kind of game? I have starters for: ' + TEMPLATES.map((t) => `${t.emoji} ${t.name} (${t.blurb.toLowerCase()})`).join(' ') + ' Say something like "start a new runner game".' };
  }

  // What should I test?
  if (/\b(test|testing|check|bugs?)\b/.test(text) && /\b(what|how|should|ideas?|help)\b/.test(text)) {
    return {
      ...base,
      reply: 'Good testers try to break things! Here are some tests for your game. I\'ve added them to your Test plan. Play the game and tick each one that works.',
      testIdeas: ['Press lots of keys at once: does anything go wrong?', 'Play until game over, then play again: does everything reset?', 'Try the game on the phone size preview', 'Ask someone else to play without telling them the controls'],
    };
  }

  // Help with an error
  const errMatch = raw.match(/error on line (\d+|\?)[^"]*"([^"]+)"/i);
  if (errMatch) {
    const line = Number(errMatch[1]) || null, msg = errMatch[2];
    let why = 'Read the line carefully, and the line just above it. Most errors are a small typo.';
    const plain = msg.replace(/^\w*Error:\s*/, '');
    if (/is not defined/.test(msg)) why = `"${plain.split(' ')[0]}" is a name the computer doesn't know. It's probably spelt differently somewhere else (capital letters count!), or it was deleted.`;
    else if (/Unexpected token|Unexpected end|missing \)|Invalid or unexpected|Unexpected identifier/.test(msg)) why = 'The computer got confused reading your code. Usually a bracket ( ) { } or a quote mark is missing or extra. Count them: every opening one needs a closing one.';
    else if (/Cannot read prop|undefined|null/.test(msg)) why = 'The code tried to use something that does not exist (yet). Check the name, and that it was created before this line runs.';
    else if (/is not a function/.test(msg)) why = 'The code tried to call something with ( ) that is not a function. Check the spelling of the function name.';
    else if (/already been declared/.test(msg)) why = 'The same name was created twice with const or let. Rename one of them, or remove the extra const/let.';
    else if (/Assignment to constant/.test(msg)) why = 'A const value can\'t be changed while the game runs. Use let instead of const if it needs to change.';
    else if (/loop ran for too long/i.test(msg)) why = 'A loop never finished, so PlayTinker stopped it. Check the loop\'s condition can become false.';
    return { ...base, reply: `Let's be bug detectives! ${why}${line ? ` I've highlighted line ${line}.` : ''} In practice mode I can't rewrite code for you, but you can fix it, or go back to an earlier version in Versions.`, focus: line ? [line, line] : null };
  }

  // A test failed
  if (/test failed/i.test(raw)) {
    return { ...base, reply: 'Good testing! A failed test is useful: now you know where the bug is. Look for the section of code about that part of the game (ask me "explain the controls", for example). Change one thing at a time and Run again. If a setting is the problem, tell me exactly what should change, with a number.' };
  }

  // Explain
  if (/\b(explain|what does|what is|what's|how does|how do|why does|tell me about|teach)\b/.test(text)) {
    const e = explain(text, code);
    return { ...base, reply: e.reply, focus: e.focus, explain: [e.reply] };
  }

  // Changes to settings
  const settings = readSettings(code);
  let newCode = code;
  const changes = [];
  const problems = [];
  let subject = null; // remembered noun for "make the basket bigger and faster"
  let askAbout = null;

  for (const clause of splitClauses(text)) {
    const c = ' ' + clause + ' ';

    // Title
    const title = clause.match(/\b(?:call it|name it|rename it|call the game|name the game|title(?: it)?|called)\s+["']?([^"']{1,40}?)["']?$/i)
      || raw.match(/\b(?:call it|name it|rename it|call the game|name the game|called)\s+["']([^"']{1,40})["']/i);
    if (title && settings.TITLE) {
      const t = title[1].trim().replace(/[^\w !?&'-]/g, '');
      if (t) {
        const cased = t.replace(/\b\w/g, (ch) => ch.toUpperCase());
        newCode = setSetting(newCode, 'TITLE', `'${cased.replace(/'/g, "\\'")}'`);
        changes.push({ name: 'TITLE', from: settings.TITLE.raw, to: `'${cased}'`, label: 'the name of your game' });
        continue;
      }
    }

    // Colours
    const colour = findColour(c);
    if (colour) {
      const target = Object.entries(COLOUR_TARGETS).find(([name, words]) => settings[name] && has(c, words));
      if (!target) {
        const opts = Object.keys(COLOUR_TARGETS).filter((n) => settings[n]).map((n) => n.replace('_COLOUR', '').toLowerCase());
        askAbout = `Which part should be ${colour.name}? You can colour: ${opts.join(', ')}.`;
        continue;
      }
      if (!colour.hex) { problems.push('Rainbow is a great idea but needs real code (changing colour every frame). That\'s a job for full AI mode. Pick one colour for now!'); continue; }
      newCode = setSetting(newCode, target[0], `'${colour.hex}'`);
      changes.push({ name: target[0], from: settings[target[0]].raw, to: `'${colour.hex}'`, label: `the ${({ BG: 'background', GOOD: 'good things', BAD: 'bad things' })[target[0].replace('_COLOUR', '')] || target[0].replace('_COLOUR', '').toLowerCase()} colour (${colour.name})` });
      subject = target[1][0];
      continue;
    }

    // Numbers and directions
    const num = c.match(/(-?\d+(?:\.\d+)?)/);
    const candidates = Object.entries(SETTINGS).filter(([name]) => settings[name]);
    let matched = candidates.filter(([, s]) => has(c, s.nouns) && (direction(c, s.dir) !== 0 || num || has(c, DIRECTIONS[s.dir].hint)));
    if (!matched.length && subject) {
      matched = candidates.filter(([, s]) => s.nouns.includes(subject) && direction(c, s.dir) !== 0);
    }
    if (matched.length > 1) {
      // Prefer settings whose direction words appear, then hint words, then the longest noun
      const rank = ([, s]) => (direction(c, s.dir) !== 0 ? 4 : 0) + (has(c, DIRECTIONS[s.dir].hint) ? 2 : 0) + (has(c, s.nouns) || '').length / 100;
      matched.sort((a, b) => rank(b) - rank(a));
      matched = [matched[0]];
    }
    if (!matched.length) {
      const dirKinds = Object.keys(DIRECTIONS).filter((k) => direction(c, k) !== 0);
      if (dirKinds.length) {
        const opts = candidates.filter(([, s]) => dirKinds.includes(s.dir)).map(([n, s]) => `${n} (${s.label})`);
        if (opts.length) askAbout = `Which part do you mean? I can change: ${opts.slice(0, 4).join('; ')}.`;
      }
      continue;
    }
    const [name, s] = matched[0];
    const current = Number(settings[name].raw);
    if (Number.isNaN(current)) { problems.push(`\`${name}\` isn't a plain number any more, so I won't guess. You can edit line ${settings[name].line} yourself.`); continue; }
    let next;
    if (num) next = Number(num[1]);
    else if (s.dir === 'amount' && /\b(no|none|zero)\b/.test(c)) next = s.min;
    else {
      let d = direction(c, s.dir);
      if (s.invert) d = -d;
      next = s.mode === 'mult' ? current * (d > 0 ? 1.4 : 1 / 1.4) : current + d * s.step;
    }
    const clamped = Math.max(s.min, Math.min(s.max, next));
    if (clamped !== next) problems.push(`${next} is outside the safe range for \`${name}\`, so I used ${niceNumber(clamped, s.int)} instead (range ${s.min} to ${s.max}).`);
    const val = niceNumber(clamped, s.int);
    if (val === String(current)) { problems.push(`\`${name}\` is already ${val}.`); continue; }
    newCode = setSetting(newCode, name, val);
    changes.push({ name, from: settings[name].raw, to: val, label: s.label });
    subject = has(c, s.nouns) ? has(c, s.nouns).trim() : subject;
  }

  if (!changes.length) {
    const ideas = Object.keys(settings).filter((n) => SETTINGS[n]).slice(0, 4).map((n) => SETTINGS[n].label);
    return {
      ...base,
      reply: (askAbout || problems.join(' ') || "I'm in practice mode, so I can only change the Settings at the top of your game, explain the code and suggest tests.")
        + (askAbout ? '' : ` Try something like: "make the player faster", "background purple", "5 lives", "call it Moon Run", or "explain the game loop". In your game you can change ${ideas.join(', ')}.`),
    };
  }

  const lines = changes.map((ch) => `\`${ch.name}\` ${ch.from} → ${ch.to} (${ch.label}, line ${settings[ch.name].line})`);
  const first = changes[0];
  return {
    ...base,
    code: newCode,
    summary: changes.map((ch) => `${ch.name} ${ch.from} → ${ch.to}`).join(', '),
    reply: `Done! I changed ${changes.length === 1 ? 'one setting' : changes.length + ' settings'}:\n• ${lines.join('\n• ')}\n`
      + (problems.length ? problems.join(' ') + '\n' : '')
      + 'The changed lines are highlighted in your code. Before you press Run: what do you think will happen?',
    explain: changes.map((ch) => `${ch.name} controls ${ch.label}.`),
    testIdeas: [`After changing ${first.name}: the game still feels fair and fun`],
    focus: [settings[first.name].line, settings[changes[changes.length - 1].name].line].sort((a, b) => a - b),
  };
}

module.exports = { respond, readSettings, sections, SETTINGS };
