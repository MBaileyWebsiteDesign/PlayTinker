/**
 * Starter games for the Creator Studio.
 *
 * Every starter follows the same simple contract so Pip, the checks and the preview all
 * understand it:
 *   - one file of plain JavaScript, no libraries
 *   - draws on <canvas id="game" width="800" height="500"> (the sandbox provides it)
 *   - a "Settings" block at the top: one `const NAME = value; // what it does` per line
 *   - numbered sections marked with `// ---- N. Name ----` comments
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'templates');

const TEMPLATES = [
  {
    id: 'catcher', name: 'Catcher', emoji: '⭐', file: 'catcher.js',
    blurb: 'Things fall from the sky. Catch the good ones and dodge the bad ones.',
    words: ['catch', 'catcher', 'falling', 'fall', 'basket', 'stars', 'drop'],
    tests: [
      'The game starts when I tap or press Space',
      'The basket moves left and right with the arrow keys',
      'On a phone, dragging my finger moves the basket',
      'Catching a good thing adds 1 to the score',
      'Catching a bad thing takes away a life',
      'When lives reach 0, "Game over" appears and I can play again',
    ],
  },
  {
    id: 'runner', name: 'Runner', emoji: '🦔', file: 'runner.js',
    blurb: 'The world scrolls past. Jump over obstacles and grab the coins.',
    words: ['run', 'runner', 'jump', 'jumping', 'platform', 'platformer', 'hop', 'endless'],
    tests: [
      'Space, the up arrow or a tap makes the player jump',
      'I can only jump when I am on the ground (no flying!)',
      'Hitting an obstacle takes away a life and the player flashes',
      'Touching a coin adds 1 to the coins score',
      'When lives reach 0, "Game over" appears and I can play again',
      'The jump is high enough to clear the tallest obstacle',
    ],
  },
  {
    id: 'dodge', name: 'Gem Dash', emoji: '💎', file: 'dodge.js',
    blurb: 'Move anywhere to collect gems against the clock while enemies bounce around.',
    words: ['dodge', 'avoid', 'gem', 'gems', 'collect', 'maze', 'chase', 'enemies', 'top down', 'top-down', 'timer'],
    tests: [
      'The player moves in all four directions with the arrows or WASD',
      'On a phone, holding my finger makes the player move towards it',
      'Collecting a gem adds 1 and a new gem appears',
      'An extra enemy appears every 3 gems',
      'Touching an enemy takes away a life',
      'Collecting enough gems shows "You win!"',
      'When the timer reaches 0, "Game over" appears',
    ],
  },
  {
    id: 'blank', name: 'Blank starter', emoji: '🟪', file: 'blank.js',
    blurb: 'A tiny starting point: a square that collects a coin. Build anything from here.',
    words: ['blank', 'empty', 'own', 'scratch', 'starter', 'simple'],
    tests: [
      'The square moves with the arrow keys or WASD',
      'Tapping the screen makes the square move to that spot',
      'The square cannot leave the screen',
      'Collecting the coin adds 1 and the coin moves',
    ],
  },
];

const GENERAL_TESTS = [
  'The game works on a phone-sized screen',
  'Someone else played it without me explaining how',
];

const cache = new Map();
function templateCode(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return null;
  if (!cache.has(id)) cache.set(id, fs.readFileSync(path.join(DIR, t.file), 'utf8'));
  return cache.get(id);
}

function listTemplates() {
  return TEMPLATES.map(({ id, name, emoji, blurb, tests }) => ({
    id, name, emoji, blurb, tests: [...tests, ...GENERAL_TESTS], code: templateCode(id),
  }));
}

function findTemplate(text) {
  const t = String(text || '').toLowerCase();
  let best = null, bestHits = 0;
  for (const tpl of TEMPLATES) {
    const hits = tpl.words.filter((w) => t.includes(w)).length;
    if (hits > bestHits) { best = tpl; bestHits = hits; }
  }
  return best;
}

module.exports = { TEMPLATES, GENERAL_TESTS, listTemplates, templateCode, findTemplate };
