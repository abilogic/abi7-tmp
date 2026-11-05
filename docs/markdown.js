// Мини-рендерер Markdown для страниц документации.
// Поддерживает: заголовки, абзацы, списки, таблицы, блоки кода, цитаты-«врезки», ссылки, **жирный**, `код`
// и специальные директивы:
//   :::demo <id>            — живой пример + просмотрщик кода
//   :::method <сигнатура>   — карточка метода (см. parseCard)
//   :::event <имя>          — карточка события
// Сырой HTML в Markdown НЕ допускается: весь текст экранируется.

import { esc, highlight } from './highlight.js';

export const slug = (s) => String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

export function inline(text) {
  const codes = [];
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(`<code>${esc(c)}</code>`) - 1}\u0000`);
  s = esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const safe = /^(#|https?:|\.\/|\.\.\/|[\w./-]+$)/.test(u) ? u : '#';
      return `<a href="${safe}"${/^https?:/.test(safe) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    });
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[i]);
}

export function codeBlock(code, lang = '') {
  const id = 'cb' + Math.random().toString(36).slice(2, 9);
  return (
    `<div class="codeblock" data-lang="${esc(lang)}"><div class="codeblock-bar"><span>${esc(lang || 'text')}</span>` +
    `<button type="button" class="copy-btn" data-copy="${id}">Copy</button></div>` +
    `<pre id="${id}"><code>${highlight(code.replace(/\n$/, ''), lang)}</code></pre></div>`
  );
}

function table(lines) {
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  const head = cells(lines[0]);
  const rows = lines.slice(2).map(cells);
  return `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') + `</tbody></table></div>`;
}

/** Разбор «карточки» (method/event): строки «ключ: значение», многострочные значения продолжаются до следующего ключа. */
function parseCard(lines, keys) {
  const out = {};
  let cur = null;
  const re = new RegExp(`^(${keys.join('|')}):\\s?(.*)$`);
  for (const line of lines) {
    const m = re.exec(line);
    if (m) { cur = m[1]; out[cur] = m[2] ? [m[2]] : []; }
    else if (cur) out[cur].push(line);
  }
  for (const k of Object.keys(out)) out[k] = out[k].join('\n').replace(/^\n+|\n+$/g, '');
  return out;
}

const field = (label, html) => (html ? `<div class="card-field"><div class="card-label">${label}</div>${html}</div>` : '');
const para = (t) => (t ? t.split(/\n{2,}/).map((p) => `<p>${inline(p.replace(/\n/g, ' '))}</p>`).join('') : '');
const rowsTable = (head, text) => {
  const rows = text.split('\n').filter((l) => l.trim() && l.trim() !== '—').map((l) => l.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|')));
  return rows.length ? `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, i) => `<td>${inline(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
};

function methodCard(title, lines) {
  const c = parseCard(lines, ['purpose', 'syntax', 'params', 'returns', 'inside', 'use', 'limits', 'errors', 'example', 'related']);
  const id = slug(title);
  return (
    `<section class="card" id="${id}"><h3><a class="anchor" href="#/api-methods/${id}">#</a><code>${esc(title)}</code></h3>` +
    field('Назначение', para(c.purpose)) +
    field('Синтаксис', c.syntax ? codeBlock(c.syntax, 'js') : '') +
    field('Параметры', c.params && c.params.trim() !== '—' ? rowsTable(['Параметр', 'Тип', 'По умолчанию', 'Описание'], c.params) : '<p class="muted">Метод не принимает аргументов.</p>') +
    field('Возвращает', para(c.returns)) +
    field('Что происходит внутри', para(c.inside)) +
    field('Когда использовать', para(c.use)) +
    field('Ограничения', para(c.limits)) +
    field('Возможные ошибки', para(c.errors)) +
    field('Пример', c.example ? codeBlock(c.example, 'js') : '') +
    field('Связанные методы и события', para(c.related)) +
    `</section>`
  );
}

function eventCard(title, lines) {
  const c = parseCard(lines, ['purpose', 'when', 'order', 'payload', 'cancel', 'example', 'related']);
  const id = 'event-' + slug(title);
  return (
    `<section class="card" id="${id}"><h3><a class="anchor" href="#/api-events/${id}">#</a><code>${esc(title)}</code></h3>` +
    field('Назначение', para(c.purpose)) +
    field('Момент вызова', para(c.when)) +
    field('Порядок вызова', para(c.order)) +
    field('Аргументы callback', c.payload && c.payload.trim() !== '—' ? rowsTable(['Поле', 'Тип', 'Описание'], c.payload) : '<p class="muted">Объект события содержит только поле <code>type</code>.</p>') +
    field('Отмена действия', para(c.cancel || 'Событие не отменяемое.')) +
    field('Подписка и отписка', codeBlock(c.example || `const handler = (event) => console.log(event);\ngrid.on('${title}', handler);\n\n// отписка\ngrid.off('${title}', handler);`, 'js')) +
    field('Связанные события', para(c.related)) +
    `</section>`
  );
}

export function renderMarkdown(src, { demo, file } = {}) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const toc = [];
  let i = 0;
  const isBlockStart = (l) => /^(#{1,4}\s|```|:::|>\s?|\s*[-*]\s|\s*\d+\.\s|\|)/.test(l) || l.trim() === '---';
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = /^```(\w*)\s*$/.exec(line))) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html.push(codeBlock(buf.join('\n'), m[1]));
    } else if ((m = /^:::(\w+)\s*(.*)$/.exec(line))) {
      const [, name, arg] = m;
      i++;
      if (name === 'demo') { html.push(demo ? demo(arg.trim()) : ''); continue; }
      // :::file путь — вставляет реальный файл проекта как блок кода (без копирования текста в документацию)
      if (name === 'file') { html.push(file ? file(arg.trim()) : ''); continue; }
      const buf = [];
      while (i < lines.length && lines[i].trim() !== ':::') buf.push(lines[i++]);
      i++;
      if (name === 'method' || name === 'event') {
        const card = name === 'method' ? methodCard(arg, buf) : eventCard(arg, buf);
        html.push(card);
        // карточки попадают в оглавление страницы (уровень 3)
        toc.push({ level: 3, id: /^<section class="card" id="([^"]+)"/.exec(card)[1], text: arg.replace(/\(.*$/, '') });
      }
      else if (name === 'note') html.push(`<div class="callout">${para(buf.join('\n'))}</div>`);
    } else if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      const level = m[1].length, text = m[2].trim(), id = slug(text);
      if (level === 2 || level === 3) toc.push({ level, id, text: text.replace(/`/g, '') });
      html.push(`<h${level} id="${id}">${level > 1 ? `<a class="anchor" href="#" data-anchor="${id}">#</a>` : ''}${inline(text)}</h${level}>`);
      i++;
    } else if (/^\|/.test(line) && /^\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const buf = [];
      while (i < lines.length && /^\|/.test(lines[i])) buf.push(lines[i++]);
      html.push(table(buf));
    } else if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<div class="callout">${para(buf.join('\n'))}</div>`);
    } else if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) {
        let t = lines[i++].replace(/^\s*([-*]|\d+\.)\s/, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i])) t += ' ' + lines[i++].trim();
        items.push(`<li>${inline(t)}</li>`);
      }
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
    } else if (line.trim() === '---') {
      html.push('<hr>');
      i++;
    } else {
      const buf = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
      if (!buf.length) { buf.push(lines[i++]); }
      html.push(`<p>${inline(buf.join(' '))}</p>`);
    }
  }
  return { html: html.join('\n'), toc };
}
