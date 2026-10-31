/**
 * Demo checkers for the concept site.
 *
 * These are simple, transparent rule-based checks so the concept runs with no AI keys.
 * In the real platform the same OUTPUT SCHEMA would come from Claude via the server-side
 * AI gateway. The important design decision is the output, not the engine:
 *   every check returns its verdict AND its justification, the evidence it used,
 *   a confidence level, and whether a human review is recommended.
 * That record is kept so a parent, teacher or moderator can audit any decision.
 */

const VERSION = '0.1.0';

const PII = [
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, what: 'an email address' },
  { re: /(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}\b/, what: 'a phone number' },
  { re: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i, what: 'a postcode' },
  { re: /\bmy (full )?name is\b/i, what: 'a full name' },
  { re: /\b(i go to|my school is)\b/i, what: 'a school name' },
  { re: /\b(i live (in|at|on)|my address)\b/i, what: 'where someone lives' },
];

function piiFindings(text) {
  return PII.filter((p) => p.re.test(text)).map((p) => p.what);
}

function quote(text, re) {
  const m = text.match(re);
  if (!m) return null;
  const i = Math.max(0, m.index - 20);
  return (i > 0 ? '…' : '') + text.slice(i, m.index + m[0].length + 25).trim() + '…';
}

function base(kind) {
  return {
    kind,
    checker: { mode: 'demo-rules', engine: 'PlayTinker rule-based demo', version: VERSION,
      futureEngine: 'Claude via server-side AI gateway (same output schema)' },
    checkedAt: new Date().toISOString(),
  };
}

function finish(out, criteria, extraReview = []) {
  const weights = { pass: 1, work: 0.5, missing: 0 };
  const score = Math.round((criteria.reduce((s, c) => s + weights[c.status], 0) / criteria.length) * 100);
  const reasons = [...extraReview];
  if (criteria.some((c) => c.confidence === 'low')) reasons.push('Some answers were too short for a confident decision.');
  if (score >= 55 && score < 75) reasons.push('Borderline result: a person may judge this differently.');
  return {
    ...out,
    score,
    result: score >= 75 ? 'ready' : 'needs-work',
    criteria,
    review: { recommended: reasons.length > 0, reasons },
    disclaimer: 'Automated check. It explains its reasoning so a parent, teacher or moderator can review and overrule it.',
  };
}

/* ---------------- Prompt Builder check ---------------- */
function checkPrompt(prompt) {
  const p = prompt.trim();
  const words = p ? p.split(/\s+/).length : 0;
  const out = base('prompt-check');
  const criteria = [];

  const goalRe = /\b(make|build|create|add|change|fix|design|write|draw|move|show|turn|let|help me|can you)\b/i;
  criteria.push(goalRe.test(p)
    ? { id: 'goal', label: 'Clear goal', status: 'pass', confidence: 'high', evidence: [quote(p, goalRe)],
        justification: 'The prompt asks for a specific action, so the AI knows what to do.' }
    : { id: 'goal', label: 'Clear goal', status: 'missing', confidence: words > 3 ? 'high' : 'low', evidence: [],
        justification: 'I could not find an action word (make, add, change, fix…). Say exactly what you want done.' });

  const ctxRe = /\b(i'?m making|my game|in my|the player|game where|level|character|project|so far|already)\b/i;
  criteria.push(ctxRe.test(p)
    ? { id: 'context', label: 'Context', status: 'pass', confidence: 'high', evidence: [quote(p, ctxRe)],
        justification: 'You explained what you are working on, which helps the AI fit its answer to your project.' }
    : { id: 'context', label: 'Context', status: words > 25 ? 'work' : 'missing', confidence: 'medium', evidence: [],
        justification: 'Tell the AI about your project: what game it is, what already works, who it is for.' });

  const detRe = /(\d+|\b(when|if|only|until|every|don'?t|never|always|must|should|press|key|space|arrow|colour|color|speed|faster|slower)\b)/i;
  const detCount = (p.match(new RegExp(detRe.source, 'gi')) || []).length;
  criteria.push(detCount >= 2
    ? { id: 'details', label: 'Details and rules', status: 'pass', confidence: 'high', evidence: [quote(p, detRe)],
        justification: `Found ${detCount} specific details or rules (numbers, keys, conditions). Specifics give better results.` }
    : { id: 'details', label: 'Details and rules', status: detCount === 1 ? 'work' : 'missing', confidence: 'medium', evidence: detCount ? [quote(p, detRe)] : [],
        justification: 'Add specifics: which key, how fast, what happens if…? Rules stop the AI guessing.' });

  const exRe = /\b(like|for example|e\.g\.|such as|similar to|a bit like)\b/i;
  criteria.push(exRe.test(p)
    ? { id: 'example', label: 'Example', status: 'pass', confidence: 'medium', evidence: [quote(p, exRe)],
        justification: 'You gave an example or comparison, which shows the AI what you imagine.' }
    : { id: 'example', label: 'Example', status: 'work', confidence: 'medium', evidence: [],
        justification: 'Optional but powerful: compare it to something ("like a trampoline bounce").' });

  const learnRe = /\b(explain|why|how does|what does|teach|step by step|one step|small steps|comment)\b/i;
  criteria.push(learnRe.test(p)
    ? { id: 'learning', label: 'Asks to understand', status: 'pass', confidence: 'high', evidence: [quote(p, learnRe)],
        justification: 'You asked the AI to explain, so you will understand and own the result.' }
    : { id: 'learning', label: 'Asks to understand', status: 'missing', confidence: 'high', evidence: [],
        justification: 'Ask the AI to explain its answer or work in small steps. You are the creator, so you need to understand it.' });

  const bigRe = /\b(whole game|entire game|everything|full game|complete game|all of it|make me a game)\b/i;
  criteria.push(bigRe.test(p)
    ? { id: 'size', label: 'Small, manageable step', status: 'work', confidence: 'high', evidence: [quote(p, bigRe)],
        justification: 'This asks for a lot at once. Big requests are harder to check. Try one feature at a time.' }
    : { id: 'size', label: 'Small, manageable step', status: words ? 'pass' : 'missing', confidence: words > 5 ? 'high' : 'low', evidence: [],
        justification: words ? 'The request is focused enough to test and understand.' : 'Write a prompt to check.' });

  const pii = piiFindings(p);
  const extra = pii.length ? [`Possible personal information found (${pii.join(', ')}). Remove it before sending to any AI.`] : [];
  if (pii.length) criteria.push({ id: 'privacy', label: 'Privacy', status: 'missing', confidence: 'medium', evidence: [],
    justification: `This looks like it may contain ${pii.join(', ')}. Never share personal details with AI tools.` });

  const res = finish(out, criteria, extra);
  res.improvedPromptTemplate =
    'I\'m making [what your game is]. Right now [what already works]. ' +
    'Please add [one feature] so that [what should happen, with numbers/keys]. ' +
    'It should feel like [example]. Keep the code simple and explain each part to me.';
  return res;
}

/* ---------------- Creator's Check ---------------- */
const CC = [
  { id: 'intent', label: 'Intent', ask: 'Can you explain what you wanted to build?',
    re: /\b(player|goal|win|lose|score|collect|avoid|fun|wanted|idea|feel)\b/i, min: 12,
    pass: 'Clearly describes what the game is for and how it should play.',
    work: 'Describes the idea a little. Add what the player does and how they win.',
    missing: 'No clear description of the idea yet.' },
  { id: 'ownership', label: 'Ownership', ask: 'Can you explain the parts AI helped with?',
    re: /\b(ai|pip|helped|code|function|variable|because|loop|if|gravity|speed|works by|means)\b/i, min: 15,
    pass: 'Explains what the AI-assisted parts do in their own words.',
    work: 'Mentions AI help but does not yet explain how that part works.',
    missing: 'Does not explain the AI-assisted work. This is needed to show understanding.' },
  { id: 'functionality', label: 'Functionality', ask: 'Does it actually work?',
    re: /\b(works|working|runs|played|playable|no errors|loads|it does)\b/i, min: 6,
    pass: 'States that the game runs and describes what works.',
    work: 'Unclear whether everything works. Describe what you checked.',
    missing: 'No evidence that the game works.' },
  { id: 'quality', label: 'Quality', ask: 'Have you tested it on different devices and situations?',
    re: /\b(tested|test|phone|tablet|laptop|chromebook|browser|friend|sister|brother|mum|dad|family|edge case|tried)\b/i, min: 10,
    pass: 'Describes testing on devices or with other people.',
    work: 'Some testing mentioned. Try another device or another player.',
    missing: 'No testing described yet.' },
  { id: 'improvement', label: 'Improvement', ask: 'Did you make it better after testing or feedback?',
    re: /\b(changed|fixed|improved|added|made it|after|feedback|said|because|so i|now)\b/i, min: 10,
    pass: 'Describes a specific improvement made after testing or feedback.',
    work: 'Mentions improving it. Say what changed and why.',
    missing: 'No improvement described yet.' },
];

function creatorsCheck(input) {
  const out = base('creators-check');
  const criteria = CC.map((c) => {
    const t = (input[c.id] || '').trim();
    const words = t ? t.split(/\s+/).length : 0;
    const hit = c.re.test(t);
    let status = 'missing';
    if (words >= c.min && hit) status = 'pass';
    else if (words >= 4) status = 'work';
    return {
      id: c.id, label: c.label, question: c.ask, status,
      confidence: words < 6 ? 'low' : words < c.min ? 'medium' : 'high',
      evidence: hit ? [quote(t, c.re)] : [],
      justification: `${c[status]} (${words} words${hit ? ', relevant detail found' : ''}.)`,
    };
  });
  const all = Object.values(input).join(' ');
  const pii = piiFindings(all);
  const extra = pii.length ? [`Possible personal information found (${pii.join(', ')}).`] : [];
  const res = finish(out, criteria, extra);
  res.badgeEligible = res.result === 'ready' && criteria.every((c) => c.status !== 'missing');
  res.nextStep = res.badgeEligible
    ? 'Great work. A parent or teacher can confirm this, and the creator badge can be awarded.'
    : `Next: work on ${criteria.filter((c) => c.status !== 'pass').map((c) => c.label).join(', ')}.`;
  return res;
}

module.exports = { checkPrompt, creatorsCheck, piiFindings };
