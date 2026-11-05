// Просмотрщик кода и карточка «живой пример». Использует тот же исходный текст, что и iframe (см. vfs.js).

import { highlight, esc } from './highlight.js';
import { getSource, buildSrcdoc, lineCount } from './vfs.js';

const shared = { label: 'photos.js', path: 'examples/shared/photos.js' };
const lang = (p) => p.split('.').pop();

function ex(id, title, height, { extra = [], css = false } = {}) {
  const files = [{ label: 'HTML', path: `examples/${id}/index.html` }, { label: 'JavaScript', path: `examples/${id}/demo.js` }];
  if (css) files.push({ label: 'CSS', path: `examples/${id}/demo.css` });
  files.push(...extra, shared);
  return { id, title, height, files };
}

export const EXAMPLES = {
  basic: ex('basic', 'Basic — минимальный грид', 500),
  masonry: ex('masonry', 'Masonry — добавление, удаление, refresh, rebuild', 760),
  grid: ex('grid', 'Grid — колонки, aspect ratio, gap', 680),
  justified: ex('justified', 'Justified — ряды одинаковой высоты', 680),
  virtualization: ex('virtualization', 'Virtualization — большие массивы, DOM Pool, overscan', 760),
  selection: ex('selection', 'Selection plugin', 580, { extra: [{ label: 'selection.js (плагин)', path: 'plugins/selection/selection.js' }, { label: 'selection.css', path: 'plugins/selection/selection.css' }] }),
  lightbox: ex('lightbox', 'Lightbox plugin', 600, { extra: [{ label: 'lightbox.js (плагин)', path: 'plugins/lightbox/lightbox.js' }, { label: 'lightbox.css', path: 'plugins/lightbox/lightbox.css' }] }),
  horizontal: ex('horizontal', 'Horizontal Layout plugin', 440, { extra: [{ label: 'horizontal.js (плагин)', path: 'plugins/layout-horizontal/horizontal.js' }] }),
  'connected-grids': ex('connected-grids', 'Connected Grids plugin', 660, { extra: [{ label: 'connected-grids.js (плагин)', path: 'plugins/connected-grids/connected-grids.js' }, { label: 'connected-grids.css', path: 'plugins/connected-grids/connected-grids.css' }] }),
  'custom-plugin': {
    ...ex('custom-plugin', 'Custom plugin — CounterPlugin с нуля', 580, { css: true }),
    files: [
      { label: 'HTML', path: 'examples/custom-plugin/index.html' },
      { label: 'JavaScript', path: 'examples/custom-plugin/demo.js' },
      { label: 'counter-plugin.js', path: 'examples/custom-plugin/counter-plugin.js' },
      { label: 'CSS', path: 'examples/custom-plugin/demo.css' },
      shared
    ]
  }
};

let uid = 0;

/** HTML просмотрщика с вкладками. files: [{ label, path }]. */
export function viewerHtml(files, { collapsed = true } = {}) {
  const id = 'v' + ++uid;
  const tabs = files.map((f, i) => `<button type="button" class="tab-btn${i ? '' : ' active'}" data-tab="${id}-${i}">${esc(f.label)}</button>`).join('');
  const panels = files.map((f, i) =>
    `<div class="viewer-panel${i ? '' : ' active'}" id="${id}-${i}" data-lines="${lineCount(f.path)}" data-path="${esc(f.path)}"><pre><code>${highlight(getSource(f.path).replace(/\n$/, ''), lang(f.path))}</code></pre></div>`
  ).join('');
  const lines = lineCount(files[0].path);
  return (
    `<div class="viewer" data-collapsed="${collapsed}"><div class="viewer-tabs">${tabs}<span class="spacer"></span>` +
    `<span class="viewer-meta">${lines} строк</span><button type="button" class="copy-btn" data-copy-viewer>Copy</button>` +
    `<button type="button" class="expand-btn">${collapsed ? 'Развернуть' : 'Свернуть'}</button></div>${panels}</div>`
  );
}

/** Карточка примера: заголовок, работающая демонстрация (iframe) и код. */
export function demoHtml(id) {
  const meta = EXAMPLES[id];
  if (!meta) return `<div class="callout">Пример «${esc(id)}» не найден.</div>`;
  return (
    `<section class="demo" id="demo-${id}"><div class="demo-head"><h3>${esc(meta.title)}</h3>` +
    `<span class="spacer"></span><span class="demo-path">examples/${id}/</span>` +
    `<button type="button" class="restart-btn" data-demo="${id}">Перезапустить</button></div>` +
    `<iframe class="demo-frame" data-demo="${id}" style="height:${meta.height}px" title="${esc(meta.title)}" loading="lazy"></iframe>` +
    viewerHtml(meta.files) + `</section>`
  );
}

/** Запускает примеры в iframe лениво — когда карточка приближается к экрану. */
export function mountDemos(root, getTheme) {
  const frames = root.querySelectorAll('iframe.demo-frame');
  const start = (frame) => {
    const meta = EXAMPLES[frame.dataset.demo];
    frame.srcdoc = buildSrcdoc(meta.files[0].path);
  };
  frames.forEach((frame) => {
    frame.addEventListener('load', () => frame.contentWindow && frame.contentWindow.postMessage({ abi7Theme: getTheme() }, '*'));
  });
  if (!('IntersectionObserver' in window)) return frames.forEach(start);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        io.unobserve(e.target);
        start(e.target);
      }
    }
  }, { rootMargin: '400px 0px' });
  frames.forEach((f) => io.observe(f));
  return () => io.disconnect();
}

export function restartDemo(id, root) {
  const frame = root.querySelector(`iframe[data-demo="${id}"]`);
  if (frame) {
    frame.srcdoc = '';
    requestAnimationFrame(() => (frame.srcdoc = buildSrcdoc(EXAMPLES[id].files[0].path)));
  }
}

export function postTheme(root, theme) {
  root.querySelectorAll('iframe.demo-frame').forEach((f) => f.contentWindow && f.contentWindow.postMessage({ abi7Theme: theme }, '*'));
}
