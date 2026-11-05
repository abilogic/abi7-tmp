// «Виртуальная файловая система» сайта документации.
//
// Исходники примеров, плагинов и ядра подключаются в сборку как текст (?raw) — ОДИН раз.
// Из этого же текста:
//   1) собирается страница-iframe, в которой пример реально запускается;
//   2) формируется вкладка с кодом в просмотрщике.
// Поэтому показанный код всегда совпадает с запущенным.
//
// Для запуска относительные импорты (../../dist/abi7-grid.js, ../shared/photos.js, ...)
// заменяются на blob:-URL соответствующих файлов. Больше код не изменяется.

import coreJs from '../src/abi7-grid.js?raw';
import coreCss from '../src/abi7-grid.css?raw';

const globbed = {
  ...import.meta.glob('../examples/**/*.{js,html,css}', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../plugins/**/*.{js,css}', { query: '?raw', import: 'default', eager: true })
};

const files = new Map();
for (const [k, v] of Object.entries(globbed)) files.set(k.replace(/^\.\.\//, ''), v);
// dist/abi7-grid.js — побайтовая копия src/abi7-grid.js (см. tools/build.js, проверяется тестом).
files.set('dist/abi7-grid.js', coreJs);
files.set('dist/abi7-grid.css', coreCss);

const MIME = { js: 'text/javascript', css: 'text/css', html: 'text/html' };
const blobs = new Map();

const resolvePath = (from, spec) => new URL(spec, 'file:///' + from).pathname.slice(1);

export const hasFile = (path) => files.has(path);
export const getSource = (path) => {
  if (!files.has(path)) throw new Error('VFS: file not found: ' + path);
  return files.get(path);
};
export const lineCount = (path) => getSource(path).replace(/\n$/, '').split('\n').length;

function blobUrl(path) {
  if (blobs.has(path)) return blobs.get(path);
  let text = getSource(path);
  const ext = path.split('.').pop();
  if (ext === 'js') {
    text = text.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\2/g, (_, pre, q, spec) => `${pre}${q}${blobUrl(resolvePath(path, spec))}${q}`);
  }
  const url = URL.createObjectURL(new Blob([text], { type: MIME[ext] || 'text/plain' }));
  blobs.set(path, url);
  return url;
}

/** Собирает srcdoc для iframe из HTML-файла примера. */
export function buildSrcdoc(htmlPath) {
  return getSource(htmlPath).replace(/\b(href|src)="(\.{1,2}\/[^"]+)"/g, (_, attr, spec) => `${attr}="${blobUrl(resolvePath(htmlPath, spec))}"`);
}
