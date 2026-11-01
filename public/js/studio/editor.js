// A small dependency-free code editor: a transparent <textarea> over a highlighted <pre>.
// Shows line numbers, simple JavaScript colouring and who wrote each line (Pip or you).
import { esc, carryAuthors } from './util.js';

const TOKENS = /(\/\/[^\n]*)|(\/\*[\s\S]*?(?:\*\/|$))|('(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?|`(?:\\[\s\S]|[^`\\])*`?)|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|var|function|return|if|else|for|while|do|new|true|false|null|undefined|of|in|break|continue|switch|case|default|this|class|typeof|async|await)\b)|(\b[A-Z][A-Z0-9_]{2,}\b)/g;
const CLASSES = ['c-com', 'c-com', 'c-str', 'c-num', 'c-kw', 'c-set'];

function highlight(code) {
  const lines = [''];
  let last = 0;
  const push = (text, cls) => {
    text.split('\n').forEach((piece, i) => {
      if (i > 0) lines.push('');
      if (piece) lines[lines.length - 1] += cls ? `<span class="${cls}">${esc(piece)}</span>` : esc(piece);
    });
  };
  code.replace(TOKENS, (m, ...groups) => {
    const index = groups[groups.length - 2];
    push(code.slice(last, index));
    const g = groups.slice(0, 6).findIndex((x) => x !== undefined);
    push(m, CLASSES[g]);
    last = index + m.length;
    return m;
  });
  push(code.slice(last));
  return lines;
}

export class CodeEditor {
  constructor(root, { onChange, onRun, onSave } = {}) {
    this.onChange = onChange; this.onRun = onRun; this.onSave = onSave;
    this.code = ''; this.authors = ''; this.errorLine = 0; this.flash = null; this.escaped = false;
    root.innerHTML = `
      <div class="ed">
        <div class="ed-scroll">
          <div class="ed-gutter" aria-hidden="true"></div>
          <div class="ed-code">
            <pre class="ed-hl" aria-hidden="true"></pre>
            <textarea class="ed-input" data-nogrow spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Game code (JavaScript)"></textarea>
          </div>
        </div>
      </div>`;
    this.scroll = root.querySelector('.ed-scroll');
    this.gutter = root.querySelector('.ed-gutter');
    this.pre = root.querySelector('.ed-hl');
    this.ta = root.querySelector('.ed-input');
    this.ta.addEventListener('input', () => this.handleInput());
    this.ta.addEventListener('keydown', (e) => this.handleKey(e));
  }

  setCode(code, authors) {
    this.code = code;
    const n = code.split('\n').length;
    this.authors = (authors || '').padEnd(n, '.').slice(0, n);
    this.ta.value = code;
    this.errorLine = 0;
    this.render();
  }

  getCode() { return this.ta.value; }

  handleInput() {
    const next = this.ta.value;
    this.authors = carryAuthors(this.code, this.authors, next, 'y');
    this.code = next;
    this.errorLine = 0;
    this.render();
    if (this.onChange) this.onChange(next, this.authors);
  }

  insert(text) {
    // execCommand keeps the browser's undo history working; fall back if unavailable
    if (!document.execCommand || !document.execCommand('insertText', false, text)) {
      const { selectionStart: s, selectionEnd: e, value } = this.ta;
      this.ta.value = value.slice(0, s) + text + value.slice(e);
      this.ta.selectionStart = this.ta.selectionEnd = s + text.length;
      this.handleInput();
    }
  }

  handleKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') { e.preventDefault(); if (this.onRun) this.onRun(); return; }
    if (mod && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (this.onSave) this.onSave(); return; }
    if (e.key === 'Escape') { this.escaped = true; return; }
    if (e.key === 'Tab' && !this.escaped && !e.shiftKey) { e.preventDefault(); this.insert('  '); return; }
    if (e.key === 'Enter' && !mod) {
      const v = this.ta.value, s = this.ta.selectionStart;
      const lineStart = v.lastIndexOf('\n', s - 1) + 1;
      const indent = v.slice(lineStart, s).match(/^\s*/)[0];
      const extra = /[{([]\s*$/.test(v.slice(lineStart, s)) ? '  ' : '';
      e.preventDefault();
      this.insert('\n' + indent + extra);
      return;
    }
    this.escaped = false;
  }

  setError(line) { this.errorLine = line || 0; this.render(); }

  focusLines(a, b) {
    if (!a) return;
    this.flash = [a, b || a];
    this.render();
    const lineH = parseFloat(getComputedStyle(this.pre).lineHeight) || 20;
    const top = (a - 1) * lineH;
    if (top < this.scroll.scrollTop || top > this.scroll.scrollTop + this.scroll.clientHeight - lineH * 2) {
      this.scroll.scrollTo({ top: Math.max(0, top - lineH * 3), behavior: 'smooth' });
    }
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => { this.flash = null; this.render(); }, 2600);
  }

  render() {
    const lines = highlight(this.code);
    const cls = (i) => {
      const a = this.authors[i];
      let c = a === 'p' ? 'ln pip' : a === 'y' ? 'ln you' : 'ln';
      if (this.errorLine === i + 1) c += ' err';
      if (this.flash && i + 1 >= this.flash[0] && i + 1 <= this.flash[1]) c += ' flash';
      return c;
    };
    this.pre.innerHTML = lines.map((l, i) => `<span class="${cls(i)}">${l || ' '}</span>`).join('');
    this.gutter.innerHTML = lines.map((_, i) => {
      const a = this.authors[i];
      return `<span class="${a === 'p' ? 'g pip' : a === 'y' ? 'g you' : 'g'}${this.errorLine === i + 1 ? ' err' : ''}">${i + 1}</span>`;
    }).join('');
  }
}

export { highlight };
