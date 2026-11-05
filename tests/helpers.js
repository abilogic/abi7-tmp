// Тестовое окружение: jsdom + заглушки того, чего в jsdom нет (layout, ResizeObserver).
import { JSDOM } from 'jsdom';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export class FakeRO {
  static all = [];
  constructor(cb) { this.cb = cb; this.targets = new Set(); FakeRO.all.push(this); }
  observe(t) { this.targets.add(t); }
  unobserve(t) { this.targets.delete(t); }
  disconnect() { this.targets.clear(); }
}

export function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  Object.assign(globalThis, {
    window: w, document: w.document,
    requestAnimationFrame: w.requestAnimationFrame.bind(w),
    cancelAnimationFrame: w.cancelAnimationFrame.bind(w),
    ResizeObserver: FakeRO,
    // jsdom принимает в addEventListener только собственный AbortSignal.
    AbortController: w.AbortController,
    AbortSignal: w.AbortSignal
  });
  delete globalThis.IntersectionObserver;
  return w;
}

/** Контейнер с управляемыми размерами и скроллом (в jsdom clientWidth всегда 0). */
export function makeContainer(width = 620, height = 500) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const box = { width, height };
  Object.defineProperty(el, 'clientWidth', { get: () => box.width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { get: () => box.height, configurable: true });
  Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true });
  Object.defineProperty(el, 'scrollLeft', { value: 0, writable: true, configurable: true });
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: box.width, bottom: box.height, width: box.width, height: box.height, x: 0, y: 0 });
  el.box = box;
  return el;
}

export function resize(el, width, height = el.box.height) {
  el.box.width = width;
  el.box.height = height;
  for (const ro of FakeRO.all) if (ro.targets.has(el)) ro.cb([{ target: el }]);
}

export function fireMeasure(target, h) {
  for (const ro of FakeRO.all) if (ro.targets.has(target)) ro.cb([{ target, borderBoxSize: [{ blockSize: h }], contentRect: { height: h } }]);
}

export function scrollTo(el, top, left = 0) {
  el.scrollTop = top;
  el.scrollLeft = left;
  el.dispatchEvent(new window.Event('scroll'));
}

export function photos(n, start = 0) {
  return Array.from({ length: n }, (_, i) => ({ id: 'p' + (start + i), width: 400, height: 300 + ((start + i) % 5) * 60, title: 'Photo ' + (start + i) }));
}

export function pointer(type, target, init = {}) {
  const ev = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.clientX ?? 0, clientY: init.clientY ?? 0, button: 0 });
  Object.defineProperties(ev, { pointerId: { value: 1 }, isPrimary: { value: true }, pointerType: { value: init.pointerType || 'mouse' } });
  target.dispatchEvent(ev);
  return ev;
}

export function overlaps(a, b) {
  return a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
}

export function assertNoOverlap(rects, assert) {
  const sorted = [...rects].sort((a, b) => a.y - b.y);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j].y < sorted[i].bottom; j++) {
      assert.ok(!overlaps(sorted[i], sorted[j]), `items ${sorted[i].index} and ${sorted[j].index} overlap`);
    }
  }
}

export async function loadLib(kind) {
  const file = kind === 'min' ? 'dist/abi7-grid.min.js' : 'src/abi7-grid.js';
  return import(pathToFileURL(resolve(ROOT, file)).href + '?t=' + kind);
}

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

export async function makeGrid(lib, opts = {}, size = {}) {
  const el = makeContainer(size.width ?? 620, size.height ?? 500);
  const grid = new lib.ABI7Grid(el, { animation: { enabled: false }, ...opts });
  await grid.whenReady();
  return { grid, el };
}
