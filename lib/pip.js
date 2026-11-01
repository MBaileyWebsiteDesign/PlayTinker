/**
 * Pip: the Creator Studio helper.
 *
 * - With ANTHROPIC_API_KEY set (a Fly secret), Pip uses Claude, server-side only.
 * - Without it, Pip runs in practice mode (lib/pip-demo.js), so the studio always works.
 *
 * Every request first goes through the personal-information filter. If the message looks
 * like it contains personal details, it is NOT sent to any AI and the child is told why.
 * Both modes return the same response shape:
 *   { mode, reply, code|null, replaceAll, summary, explain[], testIdeas[], focus|null, coach }
 */
const { piiFindings, checkPrompt } = require('./checks');
const demo = require('./pip-demo');

const MODEL = process.env.PIP_MODEL || 'claude-sonnet-5-5';
const MAX_CODE = 60000;

function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/* Simple in-memory rate limit: protects the free service from runaway costs. */
const hits = new Map();
const LIMIT = Number(process.env.PIP_RATE_LIMIT || 30); // requests per 10 minutes per IP
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > LIMIT;
}

/* Prompt coaching: every message is a chance to get better at prompting. */
function coach(message) {
  const r = checkPrompt(message);
  const weak = r.criteria.find((c) => c.status === 'missing') || r.criteria.find((c) => c.status === 'work');
  return { score: r.score, label: weak ? weak.label : 'Great prompt', tip: weak ? weak.justification : 'Clear goal, context, details and you asked to understand. Brilliant!' };
}

const SYSTEM = `You are Pip, a friendly robot helper inside PlayTinker's Creator Studio, where people (often children aged 8 to 16) build small browser games. The user is the creator; you are their helper. Learning is the point.

How you help:
- Make ONE small, focused change per request. If the request is big or vague, make a sensible first step and ask a question about the next one.
- Explain what you changed in simple British English, short sentences, no jargon without a quick explanation.
- If the request is unclear, ask a clarifying question and return "code": null.
- Encourage them to predict what will happen and to test it.
- Never ask for or repeat personal information (names, schools, addresses, emails, photos of real people).
- Refuse anything unkind, scary, violent beyond cartoon level, or not suitable for children, and suggest a friendly alternative.

The game code contract (you MUST keep it):
- One file of plain modern JavaScript. No libraries, no imports, no fetch/XMLHttpRequest/WebSocket, no external URLs or images, no localStorage, no alert/prompt/confirm, no eval.
- Draw on the existing canvas: const canvas = document.getElementById('game'); its size is 800x500. Do not create other canvases or change its size.
- Keep the "Settings" block at the top: one "const NAME = value; // what it does" per line. Put new tweakable values there.
- Keep the numbered section comments like "// ---- 5. Update ----" and add a short comment for anything new.
- Support keyboard AND touch/pointer controls so it works on phones.
- Always use braces for loops. Keep it under 400 lines.
- Shapes only (no image files). Sound is allowed only with the Web Audio API after a user tap or key press.

Reply ONLY with a JSON object, no markdown fences:
{
  "reply": "what you say to the creator (max 120 words)",
  "code": "the COMPLETE updated game code, or null if you did not change it",
  "summary": "max 12 words describing the change, for version history",
  "explain": ["1 to 3 short bullet explanations of the new or changed code"],
  "testIdeas": ["1 to 3 specific things to test"]
}`;

function extractJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON in reply');
  return JSON.parse(t.slice(start, end + 1));
}

function clean(out) {
  const arr = (a, n) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, n).map((x) => x.slice(0, 300)) : []);
  let code = typeof out.code === 'string' && out.code.trim() ? out.code : null;
  if (code && code.length > MAX_CODE) code = null;
  return {
    reply: String(out.reply || 'Done!').slice(0, 1500),
    code,
    summary: String(out.summary || '').slice(0, 120),
    explain: arr(out.explain, 3),
    testIdeas: arr(out.testIdeas, 3),
  };
}

async function askClaude({ message, code, history }) {
  const messages = [];
  for (const h of (history || []).slice(-6)) {
    if ((h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string' && h.text.trim()) {
      messages.push({ role: h.role, content: h.text.slice(0, 1500) });
    }
  }
  // The API needs alternating turns starting with the user
  while (messages.length && messages[0].role !== 'user') messages.shift();
  const merged = [];
  for (const m of messages) {
    if (merged.length && merged[merged.length - 1].role === m.role) merged[merged.length - 1].content += '\n' + m.content;
    else merged.push({ ...m });
  }
  const turn = `Here is my game code right now:\n<game_code>\n${code}\n</game_code>\n\nMy request: ${message}`;
  if (merged.length && merged[merged.length - 1].role === 'user') merged.pop();
  merged.push({ role: 'user', content: turn });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 12000, system: SYSTEM, messages: merged }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`AI service error ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return clean(extractJson(text));
}

async function pip({ message, code, history, ip }) {
  message = String(message || '').slice(0, 2000);
  code = String(code || '').slice(0, MAX_CODE);
  const base = { code: null, replaceAll: false, summary: '', explain: [], testIdeas: [], focus: null, coach: coach(message) };

  const pii = piiFindings(message);
  if (pii.length) {
    return { ...base, mode: 'blocked', reply: `I didn't send that to the AI because it looks like it might contain ${pii.join(' and ')}. Never share personal details with an AI. Try again without them!` };
  }
  const codePii = piiFindings(code);
  if (aiEnabled() && codePii.length) {
    return { ...base, mode: 'blocked', reply: `Your code looks like it might contain ${codePii.join(' and ')}. Please take that out before asking the AI for help.` };
  }

  if (!aiEnabled()) return { ...base, ...demo.respond({ message, code }), coach: base.coach };

  if (rateLimited(ip || 'unknown')) {
    return { ...base, mode: 'demo', ...demo.respond({ message, code }), coach: base.coach,
      reply: "You've asked a lot of questions very quickly, so I'm in practice mode for a few minutes. " + demo.respond({ message, code }).reply };
  }
  try {
    const out = await askClaude({ message, code, history });
    return { ...base, mode: 'claude', model: MODEL, ...out };
  } catch (err) {
    console.error('Pip AI error:', err.message);
    const d = demo.respond({ message, code });
    return { ...base, ...d, mode: 'demo', coach: base.coach, reply: "I couldn't reach my AI brain just now, so I'm using practice mode. " + d.reply };
  }
}

module.exports = { pip, aiEnabled, MODEL };
