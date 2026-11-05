// Небольшой подсветчик синтаксиса (JS / HTML / CSS / JSON / bash) без зависимостей.
// Возвращает безопасный HTML: весь текст экранируется до вставки в разметку.

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const span = (cls, s) => `<span class="tk-${cls}">${esc(s)}</span>`;

const KEYWORDS = new Set(
  'import export from default const let var function return if else for while do of in new class extends super async await try catch finally throw typeof instanceof switch case break continue static get set yield delete void null undefined true false this'.split(' ')
);

function highlightJs(code) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(\s*\()?|([\s\S])/g;
  let out = '', m, prev = '';
  while ((m = re.exec(code))) {
    if (m[1]) out += span('c', m[1]);
    else if (m[2]) out += span('s', m[2]);
    else if (m[3]) out += span('n', m[3]);
    else if (m[4]) {
      const w = m[4];
      if (KEYWORDS.has(w)) out += span('k', w);
      else if (m[5]) out += span('f', w);
      else if (prev === '.') out += span('p', w);
      else out += esc(w);
      if (m[5]) out += esc(m[5]);
      prev = m[5] ? '(' : 'w';
      continue;
    } else out += esc(m[6]);
    prev = m[6] || 'x';
  }
  return out;
}

function highlightHtml(code) {
  const re = /(<!--[\s\S]*?-->)|(<\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)(\s*\/?>)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    last = re.lastIndex;
    if (m[1]) { out += span('c', m[1]); continue; }
    out += span('p', m[2]) + span('t', m[3]);
    out += m[4].replace(/(\s+)([^\s=>\/]+)(?:(=)("[^"]*"|'[^']*'|[^\s>]+))?/g, (_, ws, name, eq, val) =>
      esc(ws) + span('a', name) + (eq ? esc(eq) + span('s', val) : '')
    );
    out += span('p', m[5]);
  }
  return out + esc(code.slice(last));
}

function highlightCss(code) {
  const re = /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(@[\w-]+)|(\{)|(\})|([\w-]+)(\s*:)(?!:)|(#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|ms|s|vh|vw|deg|fr)?\b)|([\s\S])/g;
  let out = '', depth = 0, m;
  while ((m = re.exec(code))) {
    if (m[1]) out += span('c', m[1]);
    else if (m[2]) out += span('s', m[2]);
    else if (m[3]) out += span('k', m[3]);
    else if (m[4]) { depth++; out += '{'; }
    else if (m[5]) { depth = Math.max(0, depth - 1); out += '}'; }
    else if (m[6]) out += depth > 0 ? span('a', m[6]) + esc(m[7]) : esc(m[6] + m[7]);
    else if (m[8]) out += depth > 0 ? span('n', m[8]) : esc(m[8]);
    else out += esc(m[9]);
  }
  return out;
}

function highlightBash(code) {
  return code.split('\n').map((line) => {
    if (/^\s*#/.test(line)) return span('c', line);
    return esc(line).replace(/^(\s*)(\$?\s*)(npm|npx|node|git|cd|mkdir|cp)\b/, '$1$2<span class="tk-f">$3</span>');
  }).join('\n');
}

export function highlight(code, lang) {
  switch (lang) {
    case 'js': case 'javascript': case 'json': case 'mjs': return highlightJs(code);
    case 'html': return highlightHtml(code);
    case 'css': return highlightCss(code);
    case 'bash': case 'sh': return highlightBash(code);
    default: return esc(code);
  }
}

export { esc };
