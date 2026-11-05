// Сайт документации ABI7 Grid: роутер по hash (#/страница/якорь), навигация, тема, просмотрщик кода.
// Чистый JavaScript без фреймворков. Страницы — Markdown-файлы из docs/pages.

import { renderMarkdown, codeBlock } from './markdown.js';
import { demoHtml, mountDemos, restartDemo, postTheme } from './viewer.js';
import { getSource } from './vfs.js';

const pages = import.meta.glob('./pages/*.md', { query: '?raw', import: 'default', eager: true });
const pageSource = (name) => pages[`./pages/${name}.md`];

const NAV = [
  { group: 'Введение', items: [['overview', 'Overview'], ['getting-started', 'Getting Started'], ['architecture', 'Архитектура Core']] },
  { group: 'Руководство', items: [['layouts', 'Layouts'], ['virtualization', 'Virtualization'], ['plugins', 'Plugins'], ['plugin-development', 'Создание плагина']] },
  { group: 'API Reference', items: [['api-methods', 'Methods'], ['api-events', 'Events'], ['api-options', 'Options'], ['api-plugin', 'Plugin API & Layout API']] },
  { group: 'Практика', items: [['examples', 'Examples'], ['migration', 'Migration']] }
];
const ORDER = NAV.flatMap((g) => g.items);
const TITLES = Object.fromEntries(ORDER);

const $ = (sel, root = document) => root.querySelector(sel);

let cleanup = null;
let currentPage = null;

const getTheme = () => document.documentElement.dataset.theme || 'light';
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('abi7-docs-theme', t); } catch (_) { /* приватный режим */ }
  postTheme(document, t);
}

function shell(root) {
  root.innerHTML =
    `<header class="topbar"><button id="menu" class="icon-btn" aria-label="Меню">☰</button>` +
    `<a class="brand" href="#/overview">ABI7 <b>Grid</b></a><span class="ver">v1.0.0</span><span class="spacer"></span>` +
    `<a class="top-link" href="#/examples">Examples</a><a class="top-link" href="#/api-methods">API</a>` +
    `<button id="theme" class="icon-btn" aria-label="Переключить тему" title="Светлая / тёмная тема">◐</button></header>` +
    `<div class="layout"><nav id="nav" class="sidebar" aria-label="Разделы"></nav>` +
    `<main id="content" class="content"></main><aside id="toc" class="toc" aria-label="На этой странице"></aside></div>`;
  $('#nav', root).innerHTML = NAV.map((g) => `<div class="nav-group"><div class="nav-title">${g.group}</div>${g.items.map(([id, t]) => `<a href="#/${id}" data-page="${id}">${t}</a>`).join('')}</div>`).join('');
}

function parseHash() {
  const [, page, anchor] = location.hash.split('/');
  return { page: pageSource(page) !== undefined ? page : 'overview', anchor: anchor ? decodeURIComponent(anchor) : '' };
}

function scrollToAnchor(anchor) {
  if (!anchor) return window.scrollTo(0, 0);
  const el = document.getElementById(anchor);
  if (el) el.scrollIntoView({ block: 'start' });
}

function route() {
  const { page, anchor } = parseHash();
  if (page === currentPage) return scrollToAnchor(anchor);
  currentPage = page;
  if (cleanup) cleanup();
  const content = $('#content');
  const { html, toc } = renderMarkdown(pageSource(page), {
    demo: demoHtml,
    file: (path) => codeBlock(getSource(path), path.split('.').pop())
  });
  const idx = ORDER.findIndex(([id]) => id === page);
  const prev = ORDER[idx - 1], next = ORDER[idx + 1];
  content.innerHTML = html +
    `<nav class="pager">${prev ? `<a href="#/${prev[0]}">← ${prev[1]}</a>` : '<span></span>'}${next ? `<a href="#/${next[0]}">${next[1]} →</a>` : ''}</nav>`;
  document.title = `${TITLES[page]} — ABI7 Grid`;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
  $('#toc').innerHTML = toc.length ? `<div class="toc-title">На этой странице</div>` + toc.map((t) => `<a class="l${t.level}" href="#/${page}/${t.id}" data-id="${t.id}">${t.text}</a>`).join('') : '';
  document.body.classList.remove('nav-open');
  const stop = mountDemos(content, getTheme);
  const spy = tocSpy();
  cleanup = () => { if (stop) stop(); if (spy) spy(); };
  scrollToAnchor(anchor);
}

function tocSpy() {
  if (!('IntersectionObserver' in window)) return null;
  const links = new Map([...document.querySelectorAll('#toc a')].map((a) => [a.dataset.id, a]));
  if (!links.size) return null;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        links.forEach((a) => a.classList.remove('active'));
        const a = links.get(e.target.id);
        if (a) a.classList.add('active');
      }
    }
  }, { rootMargin: '-70px 0px -75% 0px' });
  links.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  return () => io.disconnect();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function onClick(e) {
  const t = e.target.closest('button, a');
  if (!t) return;
  if (t.matches('.copy-btn')) {
    const pre = t.hasAttribute('data-copy-viewer') ? $('.viewer-panel.active pre', t.closest('.viewer')) : document.getElementById(t.dataset.copy);
    if (pre) copyText(pre.textContent).then(() => { t.textContent = 'Copied ✓'; setTimeout(() => (t.textContent = 'Copy'), 1400); });
  } else if (t.matches('.tab-btn')) {
    const v = t.closest('.viewer');
    v.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === t));
    v.querySelectorAll('.viewer-panel').forEach((p) => p.classList.toggle('active', p.id === t.dataset.tab));
    $('.viewer-meta', v).textContent = document.getElementById(t.dataset.tab).dataset.lines + ' строк';
  } else if (t.matches('.expand-btn')) {
    const v = t.closest('.viewer');
    const collapsed = v.dataset.collapsed === 'true';
    v.dataset.collapsed = String(!collapsed);
    t.textContent = collapsed ? 'Свернуть' : 'Развернуть';
  } else if (t.matches('.restart-btn')) restartDemo(t.dataset.demo, document);
  else if (t.matches('a.anchor[data-anchor]')) {
    e.preventDefault();
    location.hash = `#/${currentPage}/${t.dataset.anchor}`;
  }
}

export function bootDocs(root = document.getElementById('docs-root')) {
  let saved = null;
  try { saved = localStorage.getItem('abi7-docs-theme'); } catch (_) { /* ignore */ }
  document.documentElement.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  shell(root);
  $('#theme').onclick = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  $('#menu').onclick = () => document.body.classList.toggle('nav-open');
  document.addEventListener('click', onClick);
  window.addEventListener('hashchange', route);
  route();
}

export { getSource };
