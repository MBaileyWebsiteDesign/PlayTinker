// Small helpers shared by the Creator Studio modules.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Line diff using longest common subsequence, with common prefix/suffix trimmed first
 * so typing in a big file stays fast. Returns [{ type: 'same'|'add'|'del', a, b, text }].
 */
export function diffLines(aLines, bLines) {
  let start = 0;
  while (start < aLines.length && start < bLines.length && aLines[start] === bLines[start]) start++;
  let endA = aLines.length, endB = bLines.length;
  while (endA > start && endB > start && aLines[endA - 1] === bLines[endB - 1]) { endA--; endB--; }

  const ops = [];
  for (let i = 0; i < start; i++) ops.push({ type: 'same', a: i, b: i, text: aLines[i] });

  const A = aLines.slice(start, endA), B = bLines.slice(start, endB);
  const n = A.length, m = B.length;
  if (n * m > 4e6) {
    // Too big to compare line by line: treat the middle as replaced
    A.forEach((t, i) => ops.push({ type: 'del', a: start + i, text: t }));
    B.forEach((t, j) => ops.push({ type: 'add', b: start + j, text: t }));
  } else {
    const L = new Uint32Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        L[i * (m + 1) + j] = A[i] === B[j] ? L[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(L[(i + 1) * (m + 1) + j], L[i * (m + 1) + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { ops.push({ type: 'same', a: start + i, b: start + j, text: A[i] }); i++; j++; }
      else if (L[(i + 1) * (m + 1) + j] >= L[i * (m + 1) + j + 1]) { ops.push({ type: 'del', a: start + i, text: A[i] }); i++; }
      else { ops.push({ type: 'add', b: start + j, text: B[j] }); j++; }
    }
    while (i < n) { ops.push({ type: 'del', a: start + i, text: A[i] }); i++; }
    while (j < m) { ops.push({ type: 'add', b: start + j, text: B[j] }); j++; }
  }
  for (let k = 0; k < aLines.length - endA; k++) ops.push({ type: 'same', a: endA + k, b: endB + k, text: aLines[endA + k] });
  return ops;
}

/**
 * Work out who wrote each line of the new code. Unchanged lines keep their author;
 * new or changed lines get `author` ('p' = Pip, 'y' = you). '.' = from the starter.
 */
export function carryAuthors(oldCode, oldAuthors, newCode, author) {
  const a = oldCode.split('\n'), b = newCode.split('\n');
  const out = new Array(b.length).fill(author);
  for (const op of diffLines(a, b)) if (op.type === 'same') out[op.b] = (oldAuthors && oldAuthors[op.a]) || '.';
  return out.join('');
}

export function changedRange(oldCode, newCode) {
  const ops = diffLines(oldCode.split('\n'), newCode.split('\n'));
  const added = ops.filter((o) => o.type === 'add').map((o) => o.b + 1);
  return added.length ? [Math.min(...added), Math.max(...added)] : null;
}

export function timeAgo(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return (today ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ') + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
