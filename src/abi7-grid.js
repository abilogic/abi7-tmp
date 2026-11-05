/*!
 * ABI7 Grid v1.0.0
 * Модульное ядро сеток: раскладки, виртуализация, плагины.
 *
 * (c) Alexander Momot, 2023-2026. MIT License (см. файл LICENSE).
 * Архитектурная переработка оригинального ABI7 Grid (2023-2024, автор Alexander Momot).
 * Ядро состоит ровно из двух файлов: abi7-grid.js и abi7-grid.css.
 */

/* ============================================================
   СОДЕРЖАНИЕ
   1.  Utilities            — вспомогательные функции, ошибки, semver
   2.  EventEmitter         — шина событий
   3.  OptionsManager       — настройки по умолчанию, слияние, валидация
   4.  DataStore            — записи, id, индексы
   5.  GeometryStore        — координаты элементов + пространственный индекс
   6.  Layout Engine        — LayoutRegistry, LayoutManager, Masonry, Grid, Justified
   7.  VirtualizationEngine — какие элементы нужно показать
   8.  DOMRenderer          — единственный компонент, который трогает DOM элементов
   9.  AnimationManager     — анимация перестроений
   10. PluginManager        — установка плагинов, Plugin API
   11. InteractionManager   — click-события и Drag & Drop
   12. LifecycleManager     — AbortController, таймеры, очистка
   13. GridInstance         — внутренний «двигатель» одного грида
   14. Public API           — класс ABI7Grid
   15. Exports
   ============================================================ */

export const VERSION = '1.0.0';
export const API_VERSION = '1.0.0';

/* ============================================================
   1. UTILITIES
   ============================================================ */

const isObject = (v) => v !== null && typeof v === 'object';
const isPlain = (v) => {
  if (!isObject(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};
const isNum = Number.isFinite;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const byNumber = (a, b) => a - b;
// Поле записи может быть именем свойства или функцией-геттером (record) => value.
const readField = (rec, f) => (typeof f === 'function' ? f(rec) : rec == null ? undefined : rec[f]);

/** Ошибка ядра. Поле `code` — стабильный машинный идентификатор причины. */
export class ABI7Error extends Error {
  constructor(message, code = 'ABI7_ERROR', cause) {
    super(message);
    this.name = 'ABI7Error';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

/** Ошибка плагина (установка, совместимость, зависимости). */
export class PluginError extends ABI7Error {
  constructor(message, code = 'PLUGIN_ERROR', plugin = null, cause) {
    super(message, code, cause);
    this.name = 'PluginError';
    this.plugin = plugin;
  }
}

/** Глубокое слияние plain-объектов. Массивы и функции заменяются целиком. Исходники не мутируются. */
function mergeOptions(base, over) {
  const out = {};
  for (const k of Object.keys(base || {})) out[k] = isPlain(base[k]) ? mergeOptions(base[k], null) : base[k];
  if (!over) return out;
  for (const k of Object.keys(over)) {
    const v = over[k];
    if (v === undefined) continue;
    out[k] = isPlain(v) ? mergeOptions(isPlain(out[k]) ? out[k] : {}, v) : v;
  }
  return out;
}

function clonePlain(v) {
  if (Array.isArray(v)) return v.map(clonePlain);
  if (isPlain(v)) {
    const o = {};
    for (const k of Object.keys(v)) o[k] = clonePlain(v[k]);
    return o;
  }
  return v;
}

const getPath = (obj, path) => String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setPath(obj, path, value) {
  const keys = String(path).split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!isObject(o[keys[i]])) o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

const SAFE_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml)[;,]/i;
/** Пропускает только http(s), blob:, data:image/* и относительные URL. Остальное (javascript: и т.д.) → ''. */
function safeUrl(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  const probe = s.replace(/[\u0000-\u0020\u007f]/g, '');
  if (/^(https?:|blob:)/i.test(probe)) return s;
  if (/^data:/i.test(probe)) return SAFE_DATA_URL.test(probe) ? s : '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(probe)) return '';
  return s;
}

/* --- Минимальная реализация semver (^ ~ >= > <= < = x *, «||», пробел = AND) --- */
function parseVersion(s) {
  const m = /^v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/.exec(String(s).trim());
  if (!m) return null;
  const part = (x) => (x == null || x === 'x' || x === '*' ? null : +x);
  return [+m[1], part(m[2]), part(m[3])];
}
const cmpVersion = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function satisfies(version, range) {
  const raw = parseVersion(version);
  if (!raw) return false;
  const v = raw.map((x) => x ?? 0);
  return String(range == null ? '*' : range)
    .split('||')
    .some((group) =>
      group
        .trim()
        .split(/\s+/)
        .every((tok) => {
          if (tok === '' || tok === '*' || tok === 'x') return true;
          const m = /^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(tok);
          const op = m[1] || '=';
          const r = parseVersion(m[2]);
          if (!r) return false;
          const lo = r.map((x) => x ?? 0);
          if (op === '=') return r.every((x, i) => x === null || x === v[i]);
          if (op === '>=') return cmpVersion(v, lo) >= 0;
          if (op === '>') return cmpVersion(v, lo) > 0;
          if (op === '<=') return cmpVersion(v, lo) <= 0;
          if (op === '<') return cmpVersion(v, lo) < 0;
          let hi;
          if (op === '^') hi = r[0] > 0 ? [r[0] + 1, 0, 0] : r[1] > 0 ? [0, r[1] + 1, 0] : [0, 0, (r[2] ?? 0) + 1];
          else hi = r[1] == null ? [r[0] + 1, 0, 0] : [r[0], r[1] + 1, 0]; // ~
          return cmpVersion(v, lo) >= 0 && cmpVersion(v, hi) < 0;
        })
    );
}

function resolveElement(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el || el.nodeType !== 1) throw new ABI7Error('ABI7Grid: container element not found: ' + String(target), 'INVALID_ELEMENT');
  return el;
}

/* ============================================================
   2. EVENT EMITTER
   Ошибки обработчиков не прерывают остальные обработчики:
   они передаются в onError (ядро превращает их в событие 'error').
   ============================================================ */

class EventEmitter {
  constructor(onError) {
    this._map = new Map();
    this._onError = onError;
  }

  on(name, fn, tag) {
    if (typeof name !== 'string' || !name) throw new TypeError('Event name must be a non-empty string');
    if (typeof fn !== 'function') throw new TypeError('Event handler must be a function');
    let list = this._map.get(name);
    if (!list) this._map.set(name, (list = []));
    const rec = { fn, once: false, tag };
    list.push(rec);
    return () => this._remove(name, rec);
  }

  once(name, fn, tag) {
    const off = this.on(name, fn, tag);
    const list = this._map.get(name);
    list[list.length - 1].once = true;
    return off;
  }

  off(name, fn) {
    const list = this._map.get(name);
    if (!list) return false;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].fn === fn) {
        this._remove(name, list[i]);
        return true;
      }
    }
    return false;
  }

  _remove(name, rec) {
    const list = this._map.get(name);
    if (!list) return;
    const i = list.indexOf(rec);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) this._map.delete(name);
  }

  has(name) {
    return this._map.has(name) || this._map.has('*');
  }

  emit(name, payload = {}) {
    if (isObject(payload) && payload.type === undefined) payload.type = name;
    const groups = [this._map.get(name), name === '*' ? null : this._map.get('*')];
    for (const group of groups) {
      if (!group) continue;
      for (const rec of group.slice()) {
        if (rec.once) this._remove(group === groups[0] ? name : '*', rec);
        try {
          rec.fn(payload, name);
        } catch (error) {
          this._onError({ source: rec.tag ? 'plugin:' + rec.tag : 'listener', event: name, error });
        }
      }
    }
  }

  /** Возвращает false, если какой-либо обработчик вызвал event.preventDefault(). */
  emitCancelable(name, payload = {}) {
    payload.defaultPrevented = false;
    payload.preventDefault = function preventDefault() {
      this.defaultPrevented = true;
    };
    this.emit(name, payload);
    return !payload.defaultPrevented;
  }

  clear() {
    this._map.clear();
  }
}

/* ============================================================
   3. OPTIONS MANAGER
   ============================================================ */

const DEFAULTS = Object.freeze({
  layout: 'masonry',
  layoutOptions: {},
  data: null,
  fields: { id: 'id', width: 'width', height: 'height', aspectRatio: 'aspectRatio', src: 'src', title: 'title', alt: 'alt' },
  padding: 0,
  height: null,
  className: '',
  itemClassName: '',
  itemTag: 'div',
  autoRender: true,
  autoResize: true,
  scrollAnchoring: true,
  allowHTML: false,
  renderItem: null,
  releaseItem: null,
  plugins: [],
  virtualization: {
    enabled: true,
    overscan: 400,
    adaptiveOverscan: true,
    maxOverscan: 1600,
    poolSize: 256,
    measure: false,
    estimatedHeight: 200,
    endThreshold: 300
  },
  animation: { enabled: true, duration: 300, easing: 'ease', respectReducedMotion: true },
  interaction: {
    click: true,
    drag: { enabled: false, handle: null, threshold: 5, delay: 220, autoScroll: true, edge: 64, maxSpeed: 22 }
  }
});

function normalizePadding(p) {
  if (isNum(p)) return { top: p, right: p, bottom: p, left: p };
  const o = isPlain(p) ? p : {};
  const n = (v) => (isNum(v) && v > 0 ? v : 0);
  return { top: n(o.top), right: n(o.right), bottom: n(o.bottom), left: n(o.left) };
}

class OptionsManager {
  constructor(user) {
    this.value = OptionsManager.resolve(user);
  }

  static resolve(user, base = DEFAULTS) {
    if (user != null && !isPlain(user)) throw new ABI7Error('Options must be a plain object', 'INVALID_OPTION');
    const o = mergeOptions(base, user);
    const bad = (name, why) => {
      throw new ABI7Error(`Invalid option "${name}": ${why}`, 'INVALID_OPTION');
    };
    if (typeof o.layout !== 'string' || !o.layout) bad('layout', 'must be a non-empty string');
    if (!isPlain(o.layoutOptions)) bad('layoutOptions', 'must be an object');
    if (o.data != null && !Array.isArray(o.data) && typeof o.data !== 'function' && typeof o.data.then !== 'function') {
      bad('data', 'must be an array, a function returning data, or a Promise');
    }
    if (!Array.isArray(o.plugins)) bad('plugins', 'must be an array');
    o.padding = normalizePadding(o.padding);
    const v = o.virtualization;
    v.overscan = isNum(v.overscan) && v.overscan >= 0 ? v.overscan : DEFAULTS.virtualization.overscan;
    v.maxOverscan = isNum(v.maxOverscan) ? Math.max(v.maxOverscan, v.overscan) : v.overscan * 4;
    v.poolSize = isNum(v.poolSize) && v.poolSize >= 0 ? Math.floor(v.poolSize) : 256;
    v.estimatedHeight = isNum(v.estimatedHeight) && v.estimatedHeight > 0 ? v.estimatedHeight : 200;
    v.endThreshold = isNum(v.endThreshold) && v.endThreshold >= 0 ? v.endThreshold : 300;
    const a = o.animation;
    a.duration = isNum(a.duration) && a.duration >= 0 ? a.duration : 300;
    a.easing = typeof a.easing === 'string' && a.easing ? a.easing : 'ease';
    return o;
  }

  get(path) {
    if (path === undefined) {
      const { data, ...rest } = this.value;
      return clonePlain(rest);
    }
    return clonePlain(getPath(this.value, path));
  }

  /** Применяет патч и возвращает true; при ошибке валидации значения не меняются. */
  patch(patch) {
    this.value = OptionsManager.resolve(patch, this.value);
    return true;
  }

  set(path, value) {
    const draft = clonePlain({ ...this.value, data: null });
    draft.data = this.value.data;
    setPath(draft, path, value);
    this.value = OptionsManager.resolve(draft, DEFAULTS);
  }
}

/* ============================================================
   4. DATA STORE
   Хранит записи (копия массива, сами объекты не мутируются),
   параллельный массив id и Map id → индекс.
   ============================================================ */

class DataStore {
  constructor(fields) {
    this.fields = fields;
    this.records = [];
    this.ids = [];
    this.index = new Map();
    this._seq = 0;
  }

  get size() {
    return this.records.length;
  }

  _makeId(rec) {
    const v = readField(rec, this.fields.id);
    if (v === undefined || v === null || v === '') return 'abi7-' + ++this._seq;
    if (typeof v !== 'string' && typeof v !== 'number') throw new ABI7Error('Item id must be a string or a number', 'INVALID_ID');
    return v;
  }

  static check(list) {
    if (!Array.isArray(list)) throw new ABI7Error('Data must be an array', 'INVALID_DATA');
    for (let i = 0; i < list.length; i++) {
      if (!isObject(list[i])) throw new ABI7Error(`Data item #${i} must be an object`, 'INVALID_DATA');
    }
  }

  setAll(list) {
    DataStore.check(list);
    const ids = new Array(list.length);
    const index = new Map();
    for (let i = 0; i < list.length; i++) {
      const id = this._makeId(list[i]);
      if (index.has(id)) throw new ABI7Error(`Duplicate item id: ${String(id)}`, 'DUPLICATE_ID');
      index.set(id, i);
      ids[i] = id;
    }
    this.records = list.slice();
    this.ids = ids;
    this.index = index;
  }

  reindex(from = 0) {
    for (let i = from; i < this.ids.length; i++) this.index.set(this.ids[i], i);
  }

  insert(list, at) {
    DataStore.check(list);
    at = clamp(Number.isInteger(at) ? at : this.size, 0, this.size);
    const newIds = [];
    const seen = new Set();
    for (const rec of list) {
      const id = this._makeId(rec);
      if (this.index.has(id) || seen.has(id)) throw new ABI7Error(`Duplicate item id: ${String(id)}`, 'DUPLICATE_ID');
      seen.add(id);
      newIds.push(id);
    }
    this.records = this.records.slice(0, at).concat(list, this.records.slice(at));
    this.ids = this.ids.slice(0, at).concat(newIds, this.ids.slice(at));
    this.reindex(at);
    return newIds.map((id, k) => ({ id, index: at + k, record: list[k] }));
  }

  remove(idList) {
    const kill = new Set(idList);
    const removed = [];
    const records = [];
    const ids = [];
    for (let i = 0; i < this.ids.length; i++) {
      if (kill.has(this.ids[i])) removed.push({ id: this.ids[i], index: i, record: this.records[i] });
      else {
        records.push(this.records[i]);
        ids.push(this.ids[i]);
      }
    }
    if (!removed.length) return removed;
    this.records = records;
    this.ids = ids;
    this.index = new Map();
    this.reindex(0);
    return removed;
  }

  update(id, patch) {
    const i = this.index.get(id);
    if (i === undefined) return null;
    if (!isObject(patch)) throw new ABI7Error('Update patch must be an object', 'INVALID_DATA');
    const idField = this.fields.id;
    if (typeof idField === 'string' && hasOwn(patch, idField) && patch[idField] !== id) {
      throw new ABI7Error('Changing the id of an item is not supported; remove and insert instead', 'INVALID_ID');
    }
    const previous = this.records[i];
    // Прототип сохраняется, чтобы геттеры класса-записи не терялись.
    const next = Object.assign(Object.create(Object.getPrototypeOf(previous)), previous, patch);
    this.records[i] = next;
    return { index: i, record: next, previous, changed: Object.keys(patch) };
  }

  move(id, to) {
    const from = this.index.get(id);
    if (from === undefined) return null;
    to = clamp(Math.floor(to), 0, this.size - 1);
    if (!isNum(to) || to === from) return null;
    const [rec] = this.records.splice(from, 1);
    const [rid] = this.ids.splice(from, 1);
    this.records.splice(to, 0, rec);
    this.ids.splice(to, 0, rid);
    this.reindex(Math.min(from, to));
    return { from, to };
  }
}
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* ============================================================
   5. GEOMETRY STORE
   Координаты в Float64Array (x, y, w, h) + пространственный индекс
   (корзины по главной оси скролла). Индекс не зависит от типа layout:
   он знает только прямоугольники.
   ============================================================ */

const BUCKET = 512;

class GeometryStore {
  constructor() {
    this.cap = 0;
    this.count = 0;
    this.x = new Float64Array(0);
    this.y = new Float64Array(0);
    this.w = new Float64Array(0);
    this.h = new Float64Array(0);
    this.stamp = new Uint32Array(0);
    this.buckets = [];
    this.axis = 'y';
    this.contentW = 0;
    this.contentH = 0;
    this.epoch = 0;
    this._tick = 0;
  }

  setCount(n) {
    if (n > this.cap) {
      const cap = Math.max(n, (this.cap * 1.5) | 0, 64);
      for (const k of ['x', 'y', 'w', 'h']) {
        const a = new Float64Array(cap);
        a.set(this[k]);
        this[k] = a;
      }
      this.stamp = new Uint32Array(cap);
      this.cap = cap;
    }
    this.count = n;
  }

  set(i, x, y, w, h) {
    this.x[i] = x;
    this.y[i] = y;
    this.w[i] = w;
    this.h[i] = h;
  }

  rect(i, id) {
    const x = this.x[i], y = this.y[i], w = this.w[i], h = this.h[i];
    return { id, index: i, x, y, width: w, height: h, right: x + w, bottom: y + h };
  }

  buildIndex(axis) {
    this.axis = axis;
    const main = axis === 'x' ? this.contentW : this.contentH;
    const nb = Math.max(1, Math.floor(main / BUCKET) + 1);
    const buckets = new Array(nb);
    const mp = axis === 'x' ? this.x : this.y;
    const ms = axis === 'x' ? this.w : this.h;
    for (let i = 0; i < this.count; i++) {
      const a = clamp(Math.floor(mp[i] / BUCKET), 0, nb - 1);
      const b = clamp(Math.floor((mp[i] + ms[i]) / BUCKET), 0, nb - 1);
      for (let k = a; k <= b; k++) (buckets[k] || (buckets[k] = [])).push(i);
    }
    this.buckets = buckets;
  }

  /** Индексы элементов, пересекающих окно [m0,m1] по главной оси и [c0,c1] по поперечной. Отсортированы. */
  query(m0, m1, c0, c1, out = []) {
    out.length = 0;
    const bs = this.buckets;
    if (!bs.length || this.count === 0) return out;
    const a = clamp(Math.floor(m0 / BUCKET), 0, bs.length - 1);
    const b = clamp(Math.floor(m1 / BUCKET), 0, bs.length - 1);
    const x = this.axis === 'x';
    const mp = x ? this.x : this.y, ms = x ? this.w : this.h, cp = x ? this.y : this.x, cs = x ? this.h : this.w;
    const t = ++this._tick;
    for (let k = a; k <= b; k++) {
      const list = bs[k];
      if (!list) continue;
      for (let j = 0; j < list.length; j++) {
        const i = list[j];
        if (this.stamp[i] === t) continue;
        this.stamp[i] = t;
        if (mp[i] + ms[i] <= m0 || mp[i] >= m1) continue;
        if (cp[i] + cs[i] <= c0 || cp[i] >= c1) continue;
        out.push(i);
      }
    }
    return out.sort(byNumber);
  }

  /** Индекс элемента в точке (x, y) координат контента или -1. */
  hitTest(px, py) {
    const bs = this.buckets;
    if (!bs.length) return -1;
    const main = this.axis === 'x' ? px : py;
    const list = bs[clamp(Math.floor(main / BUCKET), 0, bs.length - 1)];
    if (!list) return -1;
    for (let j = 0; j < list.length; j++) {
      const i = list[j];
      if (px >= this.x[i] && px < this.x[i] + this.w[i] && py >= this.y[i] && py < this.y[i] + this.h[i]) return i;
    }
    return -1;
  }
}

/* ============================================================
   6. LAYOUT ENGINE
   Контракт layout-определения:
     { name, axis: 'y'|'x', responsive: 'width'|'height'|'both',
       defaults: {...}, create(options) → { compute(ctx) → {width, height, info?} } }
   ctx (см. LayoutManager.makeContext) даёт layout всё, что нужно, и ничего лишнего:
   у layout нет доступа ни к DOM, ни к внутренним массивам ядра.
   ============================================================ */

const LAYOUT_CHECKPOINT = 128; // как часто Masonry сохраняет снимок высот колонок (частичный перерасчёт)
const pos = (v) => (isNum(v) && v > 0 ? v : 0);

const MasonryLayout = {
  name: 'masonry',
  axis: 'y',
  responsive: 'width',
  defaults: { gap: 12, gapX: null, gapY: null, columns: 0, minWidth: 180, maxWidth: 0, maxColumns: 0, itemHeight: 0, aspectRatio: 0, align: 'center' },
  create() {
    const st = { sig: '', cp: [] };
    return {
      compute(ctx) {
        const o = ctx.options;
        const W = Math.max(1, ctx.width);
        const gx = pos(o.gapX ?? o.gap), gy = pos(o.gapY ?? o.gap);
        let cols = o.columns > 0 ? Math.floor(o.columns) : Math.floor((W + gx) / (Math.max(1, o.minWidth) + gx));
        if (o.maxColumns > 0) cols = Math.min(cols, Math.floor(o.maxColumns));
        cols = Math.max(1, cols);
        let w = Math.floor((W - gx * (cols - 1)) / cols);
        if (o.maxWidth > 0 && w > o.maxWidth) w = Math.floor(o.maxWidth);
        w = Math.max(1, w);
        const total = w * cols + gx * (cols - 1);
        const offX = o.align === 'start' ? 0 : Math.max(0, Math.floor((W - total) / 2));
        const sig = [cols, w, offX, gx, gy].join('|');
        let from = ctx.from;
        if (sig !== st.sig) {
          st.sig = sig;
          st.cp = [];
          from = 0;
        }
        const K = LAYOUT_CHECKPOINT;
        let k = Math.min(Math.floor(from / K), st.cp.length - 1);
        let heights;
        if (k < 0) {
          k = 0;
          heights = new Array(cols).fill(0);
          st.cp = [heights.slice()];
        } else {
          heights = st.cp[k].slice();
          st.cp.length = k + 1;
        }
        for (let i = k * K; i < ctx.count; i++) {
          if (i % K === 0 && i > k * K) st.cp[i / K] = heights.slice();
          let c = 0;
          for (let j = 1; j < cols; j++) if (heights[j] < heights[c]) c = j;
          const h = ctx.resolveHeight(i, w, { height: o.itemHeight, aspectRatio: o.aspectRatio });
          ctx.set(i, offX + c * (w + gx), heights[c], w, h);
          heights[c] += h + gy;
        }
        const maxH = Math.max(0, ...heights);
        return { width: W, height: ctx.count ? Math.max(0, maxH - gy) : 0, info: { columns: cols, itemWidth: w, gapX: gx, gapY: gy } };
      }
    };
  }
};

const GridLayout = {
  name: 'grid',
  axis: 'y',
  responsive: 'width',
  defaults: { gap: 12, gapX: null, gapY: null, columns: 0, minWidth: 160, width: 0, maxColumns: 0, itemHeight: 0, aspectRatio: 1, align: 'start' },
  create() {
    const st = { sig: '', rows: [0] };
    return {
      compute(ctx) {
        const o = ctx.options;
        const W = Math.max(1, ctx.width);
        const gx = pos(o.gapX ?? o.gap), gy = pos(o.gapY ?? o.gap);
        let cols;
        if (o.columns > 0) cols = Math.floor(o.columns);
        else {
          const base = o.width > 0 ? o.width : Math.max(1, o.minWidth);
          cols = Math.max(1, Math.floor((W + gx) / (base + gx)));
          if (o.maxColumns > 0) cols = Math.min(cols, Math.floor(o.maxColumns));
        }
        const fit = Math.max(1, Math.floor((W - gx * (cols - 1)) / cols));
        const w = o.width > 0 ? Math.min(Math.floor(o.width), fit) : fit;
        const total = w * cols + gx * (cols - 1);
        const offX = o.align === 'center' ? Math.max(0, Math.floor((W - total) / 2)) : 0;
        const sig = [cols, w, offX, gx, gy].join('|');
        let from = ctx.from;
        if (sig !== st.sig) {
          st.sig = sig;
          st.rows = [0];
          from = 0;
        }
        const r0 = Math.min(Math.floor(from / cols), st.rows.length - 1);
        st.rows.length = r0 + 1;
        let top = st.rows[r0];
        const rows = Math.ceil(ctx.count / cols);
        for (let r = r0; r < rows; r++) {
          const s = r * cols, e = Math.min(ctx.count, s + cols);
          let rowH = 1;
          for (let i = s; i < e; i++) rowH = Math.max(rowH, ctx.resolveHeight(i, w, { height: o.itemHeight, aspectRatio: o.aspectRatio }));
          for (let i = s; i < e; i++) ctx.set(i, offX + (i - s) * (w + gx), top, w, rowH);
          top += rowH + gy;
          st.rows[r + 1] = top;
        }
        return { width: W, height: ctx.count ? top - gy : 0, info: { columns: cols, itemWidth: w, rows, gapX: gx, gapY: gy } };
      }
    };
  }
};

const JustifiedLayout = {
  name: 'justified',
  axis: 'y',
  responsive: 'width',
  defaults: { targetRowHeight: 240, minRowHeight: 150, maxRowHeight: 320, gap: 10, gapX: null, gapY: null, lastRow: 'left', defaultAspect: 1.5 },
  create() {
    const st = { sig: '', rows: [] };
    return {
      compute(ctx) {
        const o = ctx.options;
        const W = Math.max(1, ctx.width);
        const gx = pos(o.gapX ?? o.gap), gy = pos(o.gapY ?? o.gap);
        const target = Math.max(1, o.targetRowHeight);
        const minH = Math.min(target, Math.max(1, o.minRowHeight));
        const maxH = Math.max(target, o.maxRowHeight);
        const sig = [W, target, minH, maxH, gx, gy, o.lastRow, o.defaultAspect].join('|');
        let from = ctx.from;
        if (sig !== st.sig) {
          st.sig = sig;
          st.rows = [];
          from = 0;
        }
        // Последняя строка с start <= from пересчитывается заново (в ней мог измениться состав).
        let r = st.rows.length;
        while (r > 0 && st.rows[r - 1].start > from) r--;
        const startRow = Math.max(0, r - 1);
        const prev = startRow > 0 ? st.rows[startRow - 1] : null;
        st.rows.length = startRow;
        let i = prev ? prev.end : 0;
        let top = prev ? prev.top + prev.h + gy : 0;
        const aspect = (j) => ctx.aspect(j) || o.defaultAspect;
        while (i < ctx.count) {
          let n = 0, sumA = 0, closed = false;
          for (let j = i; j < ctx.count; j++) {
            const a = aspect(j);
            const sumA2 = sumA + a, n2 = n + 1;
            const h2 = (W - gx * (n2 - 1)) / sumA2;
            if (h2 >= target) {
              sumA = sumA2;
              n = n2;
              continue;
            }
            if (n === 0) {
              sumA = sumA2;
              n = n2;
            } else {
              const h1 = (W - gx * (n - 1)) / sumA;
              const include = h1 > maxH ? true : h2 < minH ? false : target - h2 <= h1 - target;
              if (include) {
                sumA = sumA2;
                n = n2;
              }
            }
            closed = true;
            break;
          }
          const end = i + n;
          const fill = (W - gx * (n - 1)) / sumA;
          let h, filled = true;
          if (closed) h = fill;
          else if (o.lastRow === 'justify' && fill <= maxH) h = fill;
          else {
            h = target;
            filled = false;
          }
          h = Math.max(1, Math.round(h));
          const rowW = sumA * h + gx * (n - 1);
          let x = 0;
          if (!filled && o.lastRow === 'center') x = Math.max(0, (W - rowW) / 2);
          else if (!filled && o.lastRow === 'right') x = Math.max(0, W - rowW);
          for (let k = 0; k < n; k++) {
            const wf = aspect(i + k) * h;
            const left = Math.round(x);
            const right = k === n - 1 && filled ? W : Math.round(x + wf);
            ctx.set(i + k, left, top, Math.max(1, right - left), h);
            x += wf + gx;
          }
          st.rows.push({ start: i, end, top, h });
          top += h + gy;
          i = end;
        }
        return { width: W, height: ctx.count ? top - gy : 0, info: { rows: st.rows.length } };
      }
    };
  }
};

const BUILTIN_LAYOUTS = { masonry: MasonryLayout, grid: GridLayout, justified: JustifiedLayout };
const GLOBAL_LAYOUTS = new Map(Object.entries(BUILTIN_LAYOUTS));
const LIVE_INSTANCES = new Set(); // WeakRef на живые GridInstance (для уведомления о новых layout)

function normalizeLayoutDefinition(name, def) {
  if (isObject(def) && isObject(def.layout)) def = def.layout; // допускаем передачу plugin-объекта
  if (!isObject(def)) throw new ABI7Error(`Layout "${name}": definition must be an object`, 'INVALID_LAYOUT');
  if (typeof def.create !== 'function' && typeof def.compute !== 'function') {
    throw new ABI7Error(`Layout "${name}": definition needs create() or compute()`, 'INVALID_LAYOUT');
  }
  const create = typeof def.create === 'function' ? def.create : () => ({ compute: def.compute });
  return {
    name,
    axis: def.axis === 'x' ? 'x' : 'y',
    responsive: ['width', 'height', 'both'].includes(def.responsive) ? def.responsive : 'width',
    defaults: isPlain(def.defaults) ? def.defaults : {},
    create
  };
}

class LayoutRegistry {
  constructor(onChange) {
    this.local = new Map();
    this.onChange = onChange;
  }
  register(name, def) {
    if (typeof name !== 'string' || !name) throw new ABI7Error('Layout name must be a non-empty string', 'INVALID_LAYOUT');
    if (this.local.has(name)) throw new ABI7Error(`Layout "${name}" is already registered for this grid`, 'LAYOUT_EXISTS');
    this.local.set(name, normalizeLayoutDefinition(name, def));
    this.onChange('register', name);
  }
  unregister(name) {
    if (this.local.delete(name)) this.onChange('unregister', name);
  }
  resolve(name) {
    return this.local.get(name) || GLOBAL_LAYOUTS.get(name) || null;
  }
  list() {
    return [...new Set([...this.local.keys(), ...GLOBAL_LAYOUTS.keys()])];
  }
}

class LayoutManager {
  constructor(inst) {
    this.inst = inst;
    this.def = null;
    this.engine = null;
    this.name = null;
    this.pending = null;
    this.options = {};
    this.info = {};
  }

  get axis() {
    return this.def ? this.def.axis : 'y';
  }
  get responsive() {
    return this.def ? this.def.responsive : 'width';
  }

  /** Создаёт движок по текущим опциям. false — layout с таким именем ещё не зарегистрирован. */
  setup() {
    const name = this.inst.options.layout;
    const def = this.inst.layouts.resolve(name);
    if (!def) {
      this.def = this.engine = null;
      this.pending = name;
      return false;
    }
    this.pending = null;
    this.name = name;
    this.def = def;
    this.options = mergeOptions(def.defaults, this.inst.options.layoutOptions);
    const engine = def.create(this.options, { name });
    if (!engine || typeof engine.compute !== 'function') throw new ABI7Error(`Layout "${name}": create() must return { compute }`, 'INVALID_LAYOUT');
    this.engine = engine;
    return true;
  }

  makeContext(from) {
    const inst = this.inst, geo = inst.geo, data = inst.data, pad = inst.options.padding;
    const f = inst.options.fields, v = inst.options.virtualization;
    const name = this.name, records = data.records, ids = data.ids;
    const W = Math.max(0, inst.vp.width - pad.left - pad.right);
    const H = Math.max(0, inst.vp.height - pad.top - pad.bottom);
    const aspect = (i) => {
      const r = records[i];
      const a = +readField(r, f.aspectRatio);
      if (a > 0 && isNum(a)) return clamp(a, 0.05, 20);
      const w = +readField(r, f.width), h = +readField(r, f.height);
      return w > 0 && h > 0 ? clamp(w / h, 0.05, 20) : 0;
    };
    return {
      count: data.size,
      width: W,
      height: H,
      from: clamp(from, 0, data.size),
      options: this.options,
      aspect,
      itemId: (i) => ids[i],
      itemData: (i) => records[i],
      /**
       * Единая политика высоты: измеренная (measure) → фиксированная из опций layout →
       * aspect ratio записи → высота записи в px → estimatedHeight.
       */
      resolveHeight(i, w, fixed) {
        if (v.measure) {
          const m = inst.sizeCache.get(ids[i]);
          if (m > 0) return m;
        }
        if (fixed) {
          if (fixed.height > 0) return Math.max(1, Math.round(fixed.height));
          if (fixed.aspectRatio > 0) return Math.max(1, Math.round(w / fixed.aspectRatio));
        }
        const a = aspect(i);
        if (a > 0) return Math.max(1, Math.round(w / a));
        const h = +readField(records[i], f.height);
        if (h > 0 && isNum(h)) return Math.round(h);
        return Math.round(v.estimatedHeight);
      },
      /** Геометрия уже рассчитанного элемента в координатах layout (без padding). */
      rect(i) {
        const x = geo.x[i] - pad.left, y = geo.y[i] - pad.top, width = geo.w[i], height = geo.h[i];
        return { x, y, width, height, right: x + width, bottom: y + height };
      },
      set(i, x, y, w, h) {
        if (!(isNum(x) && isNum(y) && isNum(w) && isNum(h)) || w < 0 || h < 0 || i < 0 || i >= data.size) {
          throw new ABI7Error(`Layout "${name}" produced invalid geometry for item ${i}`, 'LAYOUT_INVALID');
        }
        geo.set(i, x + pad.left, y + pad.top, w, h);
      }
    };
  }

  compute(from) {
    const inst = this.inst, pad = inst.options.padding;
    inst.geo.setCount(inst.data.size);
    const ctx = this.makeContext(from);
    const res = this.engine.compute(ctx) || {};
    const cw = isNum(res.width) ? res.width : ctx.width;
    const ch = isNum(res.height) ? res.height : 0;
    inst.geo.contentW = pad.left + cw + pad.right;
    inst.geo.contentH = pad.top + ch + pad.bottom;
    this.info = isObject(res.info) ? res.info : {};
    return this.info;
  }
}

/* ============================================================
   7. VIRTUALIZATION ENGINE
   Получает готовую геометрию и решает, какие индексы должны быть в DOM.
   Не знает ни про layout, ни про DOM.
   ============================================================ */

class VirtualizationEngine {
  constructor(inst) {
    this.inst = inst;
    this.velocity = 0; // px/мс, сглаженная скорость скролла
    this.direction = 1;
    this.pinned = new Map(); // id → счётчик (закреплённые элементы всегда в DOM)
    this.lastOverscan = { before: 0, after: 0 };
    this._lastPos = null;
    this._lastT = 0;
    this._buf = [];
  }

  get cfg() {
    return this.inst.options.virtualization;
  }

  track(pos) {
    const t = now();
    if (this._lastPos !== null && t > this._lastT) {
      const v = (pos - this._lastPos) / (t - this._lastT);
      this.velocity = this.velocity * 0.4 + v * 0.6;
      if (v !== 0) this.direction = v > 0 ? 1 : -1;
    }
    this._lastPos = pos;
    this._lastT = t;
  }

  idle() {
    this.velocity = 0;
    this._lastPos = null;
  }

  /** Overscan в px до и после окна. Adaptive: при быстром скролле запас растёт в сторону движения. */
  overscan() {
    const c = this.cfg;
    let before = c.overscan, after = c.overscan;
    if (c.adaptiveOverscan) {
      const extra = Math.min(c.maxOverscan - c.overscan, Math.abs(this.velocity) * 300);
      if (extra > 0) {
        if (this.direction > 0) after += extra;
        else before += extra;
      }
    }
    return (this.lastOverscan = { before, after });
  }

  pin(id) {
    this.pinned.set(id, (this.pinned.get(id) || 0) + 1);
  }
  unpin(id) {
    const n = (this.pinned.get(id) || 0) - 1;
    if (n > 0) this.pinned.set(id, n);
    else this.pinned.delete(id);
  }

  /** Индексы, которые должны быть смонтированы: окно + overscan + закреплённые. */
  select(geo, sMain, vMain, sCross, vCross) {
    const inst = this.inst;
    let out = this._buf;
    if (!this.cfg.enabled) {
      out.length = 0;
      for (let i = 0; i < geo.count; i++) out.push(i);
    } else {
      const os = this.overscan();
      const cross = this.cfg.overscan;
      geo.query(sMain - os.before, sMain + vMain + os.after, sCross - cross, sCross + vCross + cross, out);
    }
    if (this.pinned.size) {
      for (const id of this.pinned.keys()) {
        const i = inst.data.index.get(id);
        if (i !== undefined && !out.includes(i)) out.push(i);
      }
      out.sort(byNumber);
    }
    return out;
  }

  /** Индексы, реально пересекающие окно видимости (без overscan). */
  visible(geo, sMain, vMain, sCross, vCross) {
    return geo.query(sMain, sMain + vMain, sCross, sCross + vCross, []);
  }
}

/* ============================================================
   8. DOM RENDERER
   Единственный слой, создающий и меняющий DOM элементов.
   Реализует DOM Pool: выпавшие из окна элементы не уничтожаются,
   а откладываются и переиспользуются для новых записей.
   ============================================================ */

class DOMRenderer {
  constructor(inst) {
    this.inst = inst;
    this.mounted = new Map(); // id → entry { id, index, el, epoch }
    this.pool = [];
    this.created = 0;
    this.reused = 0;
    this.itemClasses = new Map(); // id → Set<string> — классы, назначенные плагинами; переживают переиспользование
    this.sizeObserver = null;
  }

  get opts() {
    return this.inst.options;
  }

  setMeasure(on) {
    if (on && !this.sizeObserver && typeof ResizeObserver !== 'undefined') {
      this.sizeObserver = new ResizeObserver((entries) => this._onMeasure(entries));
      for (const ent of this.mounted.values()) this.sizeObserver.observe(ent.el);
    } else if (!on && this.sizeObserver) {
      this.sizeObserver.disconnect();
      this.sizeObserver = null;
      this.inst.sizeCache.clear();
    }
  }

  _onMeasure(entries) {
    const inst = this.inst;
    let min = Infinity;
    for (const e of entries) {
      const ent = e.target._abi7;
      if (!ent) continue;
      const bs = e.borderBoxSize && e.borderBoxSize[0];
      const h = Math.round(bs ? bs.blockSize : e.contentRect.height);
      if (!(h > 0) || inst.sizeCache.get(ent.id) === h) continue;
      inst.sizeCache.set(ent.id, h);
      const i = inst.data.index.get(ent.id);
      if (i !== undefined && Math.abs(h - inst.geo.h[i]) >= 1) min = Math.min(min, i);
    }
    if (min !== Infinity) inst.invalidate(min, 'measure');
  }

  _baseClass(id) {
    const o = this.opts;
    let c = 'abi7-item';
    if (o.virtualization.measure) c += ' abi7-item-auto';
    if (o.itemClassName) c += ' ' + o.itemClassName;
    const extra = this.itemClasses.get(id);
    if (extra) for (const k of extra) c += ' ' + k;
    return c;
  }

  _mount(id, index) {
    let el = this.pool.pop();
    if (el) this.reused++;
    else {
      el = this.inst.root.ownerDocument.createElement(this.opts.itemTag);
      el.setAttribute('role', 'listitem');
      this.created++;
    }
    const ent = { id, index, el, epoch: -1 };
    el._abi7 = ent;
    this.mounted.set(id, ent);
    this._bind(ent);
    this._place(ent);
    if (this.sizeObserver) this.sizeObserver.observe(el);
    return ent;
  }

  _bind(ent) {
    const { el, id, index } = ent;
    const inst = this.inst;
    const rec = inst.data.records[index];
    el.className = this._baseClass(id);
    el.setAttribute('data-index', index);
    el.setAttribute('data-id', String(id));
    const o = this.opts;
    try {
      if (typeof o.renderItem === 'function') {
        const res = o.renderItem(rec, el, { id, index });
        if (res && res.nodeType) el.replaceChildren(res);
        else if (typeof res === 'string') {
          if (o.allowHTML) el.innerHTML = res;
          else el.textContent = res;
        }
      } else this._defaultContent(el, rec, id);
    } catch (error) {
      inst.reportError({ source: 'renderItem', id, index, error });
    }
    if (inst.events.has('item:mount')) inst.events.emit('item:mount', { id, index, item: rec, element: el });
  }

  /** Стандартная карточка: <img> + подпись. Всё через DOM API и textContent — без innerHTML (защита от XSS). */
  _defaultContent(el, rec, id) {
    const f = this.opts.fields;
    let box = el._abi7d;
    if (!box) {
      el.replaceChildren();
      const img = el.ownerDocument.createElement('img');
      img.className = 'abi7-media';
      img.decoding = 'async';
      img.loading = 'lazy';
      img.draggable = false;
      const cap = el.ownerDocument.createElement('div');
      cap.className = 'abi7-caption';
      el.append(img, cap);
      box = el._abi7d = { img, cap };
    }
    const src = safeUrl(readField(rec, f.src));
    const title = readField(rec, f.title);
    if (src) {
      if (box.img.getAttribute('src') !== src) box.img.setAttribute('src', src);
      const alt = readField(rec, f.alt);
      box.img.alt = alt != null ? String(alt) : title != null ? String(title) : '';
      box.img.hidden = false;
    } else {
      box.img.removeAttribute('src');
      box.img.hidden = true;
    }
    const text = title != null ? title : src ? '' : id;
    box.cap.textContent = text == null ? '' : String(text);
    box.cap.hidden = box.cap.textContent === '';
  }

  _place(ent) {
    const g = this.inst.geo, i = ent.index;
    if (ent.epoch === g.epoch || i >= g.count) return;
    const s = ent.el.style;
    s.transform = `translate3d(${g.x[i]}px,${g.y[i]}px,0)`;
    s.width = g.w[i] + 'px';
    s.height = this.opts.virtualization.measure ? '' : g.h[i] + 'px';
    ent.epoch = g.epoch;
  }

  _unmount(id) {
    const ent = this.mounted.get(id);
    if (!ent) return;
    const { el } = ent;
    const o = this.opts;
    const inst = this.inst;
    if (typeof o.releaseItem === 'function') {
      try {
        o.releaseItem(inst.data.records[inst.data.index.get(id)], el, { id, index: ent.index });
      } catch (error) {
        inst.reportError({ source: 'releaseItem', id, error });
      }
    }
    if (inst.events.has('item:unmount')) inst.events.emit('item:unmount', { id, index: ent.index, element: el });
    if (this.sizeObserver) this.sizeObserver.unobserve(el);
    el.remove();
    this.mounted.delete(id);
    el._abi7 = null;
    if (this.pool.length < o.virtualization.poolSize) this.pool.push(el);
  }

  /** Приводит DOM в соответствие с набором индексов. Возвращает true, если что-то смонтировано/размонтировано. */
  sync(indices) {
    const data = this.inst.data;
    const want = new Set();
    for (let k = 0; k < indices.length; k++) want.add(data.ids[indices[k]]);
    let changed = false;
    for (const id of [...this.mounted.keys()]) {
      if (!want.has(id)) {
        this._unmount(id);
        changed = true;
      }
    }
    const frag = this.inst.root.ownerDocument.createDocumentFragment();
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k], id = data.ids[i];
      let ent = this.mounted.get(id);
      if (!ent) {
        ent = this._mount(id, i);
        frag.appendChild(ent.el);
        changed = true;
      } else this._place(ent);
    }
    if (frag.firstChild) this.inst.container.appendChild(frag);
    return changed;
  }

  /** После вставки/удаления/перемещения индексы смонтированных элементов могли измениться. */
  reindex() {
    const data = this.inst.data;
    for (const [id, ent] of [...this.mounted]) {
      const idx = data.index.get(id);
      if (idx === undefined) {
        this._unmount(id);
        this.itemClasses.delete(id);
      } else if (idx !== ent.index) {
        ent.index = idx;
        ent.epoch = -1;
        ent.el.setAttribute('data-index', idx);
      }
    }
  }

  rebind(id) {
    const ent = this.mounted.get(id);
    if (ent) this._bind(ent);
  }

  rebindAll() {
    for (const ent of this.mounted.values()) {
      ent.epoch = -1;
      this._bind(ent);
    }
  }

  /** Полный сброс: размонтировать всё и очистить пул (смена renderItem/itemTag/measure). */
  reset() {
    for (const id of [...this.mounted.keys()]) this._unmount(id);
    this.pool.length = 0;
  }

  toggleClass(id, cls, force) {
    if (typeof cls !== 'string' || !cls || /\s/.test(cls)) throw new ABI7Error('CSS class must be a single token', 'INVALID_ARGUMENT');
    let set = this.itemClasses.get(id);
    const has = !!set && set.has(cls);
    const on = force === undefined ? !has : !!force;
    if (on) (set || this.itemClasses.set(id, (set = new Set())).get(id)).add(cls);
    else if (set) {
      set.delete(cls);
      if (!set.size) this.itemClasses.delete(id);
    }
    const ent = this.mounted.get(id);
    if (ent) ent.el.classList.toggle(cls, on);
    return on;
  }

  hasClass(id, cls) {
    const s = this.itemClasses.get(id);
    return !!s && s.has(cls);
  }

  destroy() {
    if (this.sizeObserver) this.sizeObserver.disconnect();
    this.sizeObserver = null;
    this.reset();
    this.itemClasses.clear();
  }
}

/* ============================================================
   9. ANIMATION MANAGER
   Анимация — это CSS-transition на transform/width/height, который
   включается классом .abi7-animating только на время перестроения.
   Скролл-обновления никогда не анимируются.
   ============================================================ */

class AnimationManager {
  constructor(inst) {
    this.inst = inst;
    this.timer = 0;
  }

  get enabled() {
    const a = this.inst.options.animation;
    if (!a.enabled || a.duration <= 0) return false;
    if (a.respectReducedMotion) {
      const win = this.inst.root.ownerDocument.defaultView;
      if (win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    }
    return true;
  }

  applyCss() {
    const a = this.inst.options.animation, s = this.inst.root.style;
    s.setProperty('--abi7-duration', a.duration + 'ms');
    s.setProperty('--abi7-easing', a.easing);
  }

  begin() {
    const { root, container, life } = this.inst;
    root.classList.add('abi7-animating');
    void container.offsetWidth; // принудительный reflow: transition стартует от текущих позиций
    life.clearTimeout(this.timer);
    this.timer = life.timeout(() => root.classList.remove('abi7-animating'), this.inst.options.animation.duration + 80);
  }

  stop() {
    this.inst.life.clearTimeout(this.timer);
    this.inst.root.classList.remove('abi7-animating');
  }
}

/* ============================================================
   10. PLUGIN MANAGER
   Плагин видит только Plugin API (api.events, api.layouts, api.features,
   api.data, api.geometry, api.viewport, api.renderer, api.options, api.lifecycle).
   Всё, что плагин зарегистрировал через API, отслеживается и
   автоматически снимается при unuse() / destroy().
   ============================================================ */

const PLUGIN_NAME = /^[a-z][a-z0-9._:-]*$/i;

class PluginManager {
  constructor(inst) {
    this.inst = inst;
    this.records = new Map();
    this.features = new Map(); // имя фичи → { impl, owner }
  }

  static validate(plugin) {
    if (!isObject(plugin)) throw new PluginError('Plugin must be an object', 'PLUGIN_INVALID');
    const { name, version, apiVersion, install } = plugin;
    if (typeof name !== 'string' || !PLUGIN_NAME.test(name)) throw new PluginError('Plugin "name" must be a string like "selection"', 'PLUGIN_INVALID', String(name));
    if (typeof install !== 'function') throw new PluginError(`Plugin "${name}": install() is required`, 'PLUGIN_INVALID', name);
    if (typeof version !== 'string' || !parseVersion(version)) throw new PluginError(`Plugin "${name}": "version" must be a semver string`, 'PLUGIN_INVALID', name);
    if (typeof apiVersion !== 'string' || !apiVersion) throw new PluginError(`Plugin "${name}": "apiVersion" range is required`, 'PLUGIN_INVALID', name);
    if (plugin.dependencies != null && !Array.isArray(plugin.dependencies)) throw new PluginError(`Plugin "${name}": "dependencies" must be an array of plugin names`, 'PLUGIN_INVALID', name);
  }

  use(plugin, options) {
    PluginManager.validate(plugin);
    const name = plugin.name;
    if (this.records.has(name)) throw new PluginError(`Plugin "${name}" is already installed on this grid`, 'PLUGIN_DUPLICATE', name);
    if (!satisfies(API_VERSION, plugin.apiVersion)) {
      throw new PluginError(`Plugin "${name}" requires ABI7 Grid API ${plugin.apiVersion}, but core provides ${API_VERSION}`, 'PLUGIN_INCOMPATIBLE', name);
    }
    for (const dep of plugin.dependencies || []) {
      if (!this.records.has(dep)) throw new PluginError(`Plugin "${name}" requires plugin "${dep}" to be installed first`, 'PLUGIN_DEPENDENCY', name);
    }
    const rec = {
      name,
      plugin,
      options: Object.freeze(mergeOptions(isPlain(plugin.defaults) ? plugin.defaults : {}, options)),
      cleanup: null,
      disposables: [],
      active: true,
      api: null
    };
    rec.api = this._buildApi(rec);
    this.records.set(name, rec);
    try {
      const ret = plugin.install.call(plugin, rec.api, rec.options);
      if (ret && typeof ret.then === 'function') {
        ret.then(null, () => {});
        throw new PluginError(`Plugin "${name}": install() must be synchronous and return a cleanup function`, 'PLUGIN_INVALID', name);
      }
      if (typeof ret === 'function') rec.cleanup = ret;
      else if (ret && typeof ret.destroy === 'function') rec.cleanup = () => ret.destroy();
    } catch (e) {
      this._dispose(rec);
      this.records.delete(name);
      throw e instanceof PluginError ? e : new PluginError(`Plugin "${name}" failed to install: ${e && e.message}`, 'PLUGIN_INSTALL_FAILED', name, e);
    }
    this.inst.events.emit('plugin:install', { name, version: plugin.version });
    return rec;
  }

  unuse(name) {
    const rec = this.records.get(name);
    if (!rec) return false;
    for (const other of this.records.values()) {
      if (other !== rec && (other.plugin.dependencies || []).includes(name)) {
        throw new PluginError(`Plugin "${name}" is required by "${other.name}"; unuse it first`, 'PLUGIN_REQUIRED', name);
      }
    }
    this._dispose(rec);
    this.records.delete(name);
    if (!this.inst.life.destroyed) this.inst.events.emit('plugin:uninstall', { name, version: rec.plugin.version, reason: 'unuse' });
    return true;
  }

  _dispose(rec) {
    const fail = (error) => this.inst.reportError({ source: 'plugin:' + rec.name, phase: 'cleanup', error });
    try {
      if (rec.cleanup) rec.cleanup();
    } catch (e) {
      fail(e);
    }
    rec.cleanup = null;
    for (const d of rec.disposables.splice(0).reverse()) {
      try {
        d();
      } catch (e) {
        fail(e);
      }
    }
    rec.active = false;
  }

  destroyAll() {
    for (const rec of [...this.records.values()].reverse()) {
      this._dispose(rec);
      this.records.delete(rec.name);
      this.inst.events.emit('plugin:uninstall', { name: rec.name, version: rec.plugin.version, reason: 'destroy' });
    }
    this.features.clear();
  }

  get(name) {
    const f = this.features.get(name);
    return f ? f.impl : null;
  }

  list() {
    return [...this.records.values()].map((r) => ({ name: r.name, version: r.plugin.version, apiVersion: r.plugin.apiVersion, options: r.options }));
  }

  _buildApi(rec) {
    const inst = this.inst, pm = this, name = rec.name;
    // Каждый метод API проверяет, что плагин ещё установлен: «забытая» ссылка после unuse() не сработает.
    const guard = (obj) => {
      const out = {};
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        out[k] = typeof v === 'function'
          ? (...args) => {
              if (!rec.active) throw new PluginError(`Plugin "${name}" used its API after being uninstalled`, 'PLUGIN_INACTIVE', name);
              return v(...args);
            }
          : v;
      }
      return Object.freeze(out);
    };
    const track = (fn) => {
      rec.disposables.push(fn);
      return () => {
        const i = rec.disposables.indexOf(fn);
        if (i >= 0) rec.disposables.splice(i, 1);
        fn();
      };
    };
    const emitName = (event) => {
      if (typeof event !== 'string' || !event.startsWith(name + ':')) {
        throw new PluginError(`Plugin "${name}" may only emit events prefixed "${name}:" (got "${event}")`, 'PLUGIN_EVENT_NAMESPACE', name);
      }
    };

    const events = guard({
      on: (ev, fn) => track(inst.events.on(ev, fn, name)),
      once: (ev, fn) => track(inst.events.once(ev, fn, name)),
      off: (ev, fn) => inst.events.off(ev, fn),
      emit: (ev, payload = {}) => {
        emitName(ev);
        inst.events.emit(ev, { type: ev, ...payload });
      },
      emitCancelable: (ev, payload = {}) => {
        emitName(ev);
        return inst.events.emitCancelable(ev, { type: ev, ...payload });
      }
    });

    const layouts = guard({
      register: (layoutName, def) => {
        inst.layouts.register(layoutName, def);
        track(() => inst.layouts.unregister(layoutName));
      },
      unregister: (layoutName) => inst.layouts.unregister(layoutName),
      has: (layoutName) => !!inst.layouts.resolve(layoutName),
      list: () => inst.layouts.list()
    });

    const features = guard({
      register: (featureName, impl) => {
        if (typeof featureName !== 'string' || !featureName) throw new PluginError('Feature name must be a non-empty string', 'PLUGIN_FEATURE', name);
        if (!isObject(impl) && typeof impl !== 'function') throw new PluginError('Feature must be an object or a function', 'PLUGIN_FEATURE', name);
        const ex = pm.features.get(featureName);
        if (ex) throw new PluginError(`Feature "${featureName}" is already registered by plugin "${ex.owner}"`, 'PLUGIN_FEATURE_CONFLICT', name);
        pm.features.set(featureName, { impl, owner: name });
        track(() => {
          const cur = pm.features.get(featureName);
          if (cur && cur.owner === name) pm.features.delete(featureName);
        });
      },
      unregister: (featureName) => {
        const cur = pm.features.get(featureName);
        if (cur && cur.owner === name) pm.features.delete(featureName);
      },
      get: (featureName) => (pm.features.get(featureName) || {}).impl || null,
      has: (featureName) => pm.features.has(featureName)
    });

    const data = guard({
      get: () => inst.data.records.slice(),
      getById: (id) => inst.data.records[inst.data.index.get(id)],
      getByIndex: (i) => inst.data.records[i],
      ids: () => inst.data.ids.slice(),
      count: () => inst.data.size,
      indexOf: (id) => (inst.data.index.has(id) ? inst.data.index.get(id) : -1),
      has: (id) => inst.data.index.has(id),
      set: (list) => inst.setData(list),
      insert: (items, opts) => inst.insert(items, opts),
      remove: (idOrIds) => inst.remove(idOrIds),
      update: (id, patch) => inst.update(id, patch),
      move: (id, toIndex) => inst.move(id, toIndex)
    });

    const geometry = guard({
      get: (id) => inst.rectById(id),
      getByIndex: (i) => inst.rectByIndex(i),
      size: () => (inst.ensureLayout(), { width: inst.geo.contentW, height: inst.geo.contentH }),
      hitTest: (x, y) => (inst.ensureLayout(), inst.geo.hitTest(x, y)),
      invalidate: (fromIndex = 0) => inst.invalidate(fromIndex, 'plugin')
    });

    const viewport = guard({
      state: () => inst.viewportState(),
      range: () => inst.visibleRange(),
      isVisible: (id) => inst.isVisibleId(id),
      scrollTo: (x, y, behavior) => inst.scrollToPoint(x, y, behavior),
      scrollToIndex: (i, o) => inst.scrollToIndex(i, o),
      scrollToItem: (id, o) => inst.scrollToItem(id, o),
      pin: (id) => {
        inst.virt.pin(id);
        track(() => inst.virt.unpin(id));
        inst.requestView();
      },
      unpin: (id) => {
        inst.virt.unpin(id);
        inst.requestView();
      },
      clientToContent: (cx, cy) => inst.clientToContent(cx, cy),
      indexAtClientPoint: (cx, cy, o) => inst.indexAtClientPoint(cx, cy, o)
    });

    const renderer = guard({
      root: () => inst.root,
      getElement: (id) => (inst.renderer.mounted.get(id) || {}).el || null,
      toggleClass: (id, cls, force) => (inst.data.index.has(id) ? inst.renderer.toggleClass(id, cls, force) : false),
      hasClass: (id, cls) => inst.renderer.hasClass(id, cls),
      refresh: (id) => (id === undefined ? inst.renderer.rebindAll() : inst.renderer.rebind(id))
    });

    const options = guard({
      get: (path) => inst.opts.get(path),
      set: (path, value) => inst.setOption(path, value),
      plugin: () => rec.options
    });

    const lifecycle = guard({
      isDestroyed: () => inst.life.destroyed,
      state: () => inst.phase,
      onDestroy: (fn) => track(fn),
      addDisposable: (fn) => {
        if (typeof fn !== 'function') throw new TypeError('Disposable must be a function');
        return track(fn);
      },
      refresh: () => inst.refresh(),
      whenReady: () => inst.whenReady()
    });

    return Object.freeze({ name, apiVersion: API_VERSION, coreVersion: VERSION, events, layouts, features, data, geometry, viewport, renderer, options, lifecycle });
  }
}

/* ============================================================
   11. INTERACTION MANAGER
   Делегирование click/dblclick/contextmenu (один слушатель на контейнер)
   и Drag & Drop на Pointer Events (мышь, касание, перо).
   Drag не зависит от layout: позиция под курсором определяется
   по GeometryStore (hitTest), а не по DOM.
   ============================================================ */

class InteractionManager {
  constructor(inst) {
    this.inst = inst;
    this.pending = null;
    this.drag = null;
    this.ctl = null;
    this.suppressClick = false;
  }

  attach() {
    const { root, container, life } = this.inst;
    const signal = life.signal;
    for (const [dom, ev] of [['click', 'item:click'], ['dblclick', 'item:dblclick'], ['contextmenu', 'item:contextmenu']]) {
      container.addEventListener(dom, (e) => this._onItemEvent(ev, e), { signal });
    }
    container.addEventListener('pointerdown', (e) => this._onDown(e), { signal });
    // Нативный drag картинок мешает собственному DnD.
    container.addEventListener('dragstart', (e) => { if (this.inst.options.interaction.drag.enabled) e.preventDefault(); }, { signal });
    // Во время перетаскивания касанием блокируем скролл страницы.
    root.addEventListener('touchmove', (e) => { if (this.drag && e.cancelable) e.preventDefault(); }, { signal, passive: false });
  }

  detach() {
    this._finish(true, true);
  }

  _entryFor(target) {
    const el = target && target.closest ? target.closest('.abi7-item') : null;
    if (!el || !this.inst.container.contains(el) || !el._abi7) return null;
    return el._abi7;
  }

  _onItemEvent(name, e) {
    const inst = this.inst;
    if (!inst.options.interaction.click) return;
    if (name === 'item:contextmenu' && (this.drag || this.pending)) return e.preventDefault();
    if (name === 'item:click' && this.suppressClick) return;
    const ent = this._entryFor(e.target);
    if (!ent) return;
    const ok = inst.events.emitCancelable(name, { id: ent.id, index: ent.index, item: inst.data.records[ent.index], element: ent.el, originalEvent: e });
    if (!ok && name === 'item:contextmenu') e.preventDefault();
  }

  _onDown(e) {
    const inst = this.inst, cfg = inst.options.interaction.drag;
    if (!cfg.enabled || this.drag || this.pending || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const ent = this._entryFor(e.target);
    if (!ent) return;
    if (cfg.handle) {
      if (!e.target.closest(cfg.handle)) return;
    } else if (e.target.closest('input,textarea,select,button,a[href],[contenteditable="true"]')) return;
    this.pending = { ent, id: ent.id, pointerId: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, timer: 0, down: e };
    const doc = inst.root.ownerDocument, win = doc.defaultView;
    this.ctl = new AbortController();
    const signal = this.ctl.signal;
    doc.addEventListener('pointermove', (ev) => this._onMove(ev), { signal });
    doc.addEventListener('pointerup', (ev) => this._onUp(ev), { signal });
    doc.addEventListener('pointercancel', (ev) => this._onUp(ev, true), { signal });
    doc.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') this._finish(true); }, { signal });
    if (win) win.addEventListener('blur', () => this._finish(true), { signal });
    // Касание: перетаскивание начинается после долгого нажатия, иначе это обычный скролл.
    if (e.pointerType !== 'mouse') this.pending.timer = inst.life.timeout(() => this.pending && this._begin(), cfg.delay);
  }

  _onMove(e) {
    const s = this.drag || this.pending;
    if (!s || e.pointerId !== s.pointerId) return;
    s.x = e.clientX;
    s.y = e.clientY;
    if (!this.drag) {
      const dist = Math.hypot(s.x - s.x0, s.y - s.y0);
      if (s.type === 'touch') {
        if (dist > 10) this._finish(true, true); // пользователь листает
      } else if (dist >= this.inst.options.interaction.drag.threshold) this._begin();
      return;
    }
    this._update();
  }

  _onUp(e, cancelled = false) {
    const s = this.drag || this.pending;
    if (!s || e.pointerId !== s.pointerId) return;
    this._finish(cancelled);
  }

  _begin() {
    const inst = this.inst, p = this.pending;
    if (!p) return;
    const ent = inst.renderer.mounted.get(p.id);
    if (!ent) return this._finish(true, true);
    const ok = inst.events.emitCancelable('drag:start', {
      id: ent.id, index: ent.index, item: inst.data.records[ent.index], element: ent.el,
      clientX: p.x, clientY: p.y, pointerType: p.type, originalEvent: p.down
    });
    if (!ok) return this._finish(true, true);
    inst.life.clearTimeout(p.timer);
    const rect = ent.el.getBoundingClientRect();
    const doc = inst.root.ownerDocument;
    const layer = doc.createElement('div');
    layer.className = 'abi7-ghost-layer ' + [...inst.root.classList].filter((c) => !c.startsWith('abi7-')).join(' ');
    for (let i = 0; i < inst.root.style.length; i++) {
      const k = inst.root.style[i];
      if (k.startsWith('--')) layer.style.setProperty(k, inst.root.style.getPropertyValue(k));
    }
    const ghost = ent.el.cloneNode(true);
    ghost.removeAttribute('data-id');
    ghost.className = ent.el.className.replace('abi7-dragging', '') + ' abi7-ghost';
    ghost.style.cssText = `width:${rect.width}px;height:${rect.height}px;`;
    layer.appendChild(ghost);
    doc.body.appendChild(layer);
    this.drag = {
      ...p, id: ent.id, fromIndex: ent.index, index: ent.index, layer, ghost, outside: false, lastMoveAt: 0,
      offX: p.x - rect.left, offY: p.y - rect.top, raf: 0
    };
    this.pending = null;
    inst.virt.pin(ent.id);
    inst.renderer.toggleClass(ent.id, 'abi7-dragging', true);
    inst.root.classList.add('abi7-drag-active');
    this._position();
    this._tick();
  }

  _position() {
    const d = this.drag;
    d.ghost.style.transform = `translate3d(${d.x - d.offX}px,${d.y - d.offY}px,0)`;
  }

  _update() {
    const inst = this.inst, d = this.drag, a = inst.options.animation;
    this._position();
    const r = inst.root.getBoundingClientRect();
    d.outside = !(d.x >= r.left && d.x <= r.right && d.y >= r.top && d.y <= r.bottom);
    let overIndex = -1;
    if (!d.outside) {
      overIndex = inst.indexAtClientPoint(d.x, d.y);
      const cooldown = inst.anim.enabled ? Math.min(a.duration * 0.6, 200) : 0;
      if (overIndex >= 0 && overIndex !== d.index && now() - d.lastMoveAt >= cooldown) {
        if (inst.move(d.id, overIndex, 'drag')) {
          d.index = overIndex;
          d.lastMoveAt = now();
        }
      }
    }
    inst.events.emit('drag:move', { id: d.id, index: d.index, fromIndex: d.fromIndex, overIndex, clientX: d.x, clientY: d.y, outside: d.outside, pointerType: d.type });
  }

  /** Автопрокрутка у края контейнера (по главной оси layout). */
  _tick() {
    const inst = this.inst, d = this.drag;
    if (!d) return;
    const cfg = inst.options.interaction.drag;
    if (cfg.autoScroll) {
      const r = inst.root.getBoundingClientRect();
      const horizontal = inst.layoutMgr.axis === 'x';
      const [p, lo, hi, q, qlo, qhi] = horizontal ? [d.x, r.left, r.right, d.y, r.top, r.bottom] : [d.y, r.top, r.bottom, d.x, r.left, r.right];
      if (q >= qlo && q <= qhi) {
        let v = 0;
        if (p < lo + cfg.edge) v = -Math.min(1, (lo + cfg.edge - p) / cfg.edge);
        else if (p > hi - cfg.edge) v = Math.min(1, (p - (hi - cfg.edge)) / cfg.edge);
        if (v !== 0) {
          if (horizontal) inst.root.scrollLeft += v * cfg.maxSpeed;
          else inst.root.scrollTop += v * cfg.maxSpeed;
          inst.requestView();
          this._update();
        }
      }
    }
    d.raf = inst.life.raf(() => this._tick());
  }

  /** Завершает drag. cancel=true — откат порядка (Escape, pointercancel, blur, destroy). silent — без события. */
  _finish(cancel, silent = false) {
    const inst = this.inst, d = this.drag, p = this.pending;
    if (this.ctl) this.ctl.abort();
    this.ctl = null;
    this.pending = null;
    this.drag = null;
    if (p) inst.life.clearTimeout(p.timer);
    if (!d) return;
    inst.life.cancelRaf(d.raf);
    d.layer.remove();
    inst.root.classList.remove('abi7-drag-active');
    inst.virt.unpin(d.id);
    inst.renderer.toggleClass(d.id, 'abi7-dragging', false);
    if (cancel && d.index !== d.fromIndex && inst.data.index.has(d.id) && !inst.life.destroyed) {
      inst.move(d.id, d.fromIndex, 'drag-cancel');
      d.index = d.fromIndex;
    }
    // Браузер пошлёт click сразу после pointerup — подавляем его.
    this.suppressClick = true;
    inst.life.timeout(() => (this.suppressClick = false), 0);
    inst.requestView();
    if (silent || inst.life.destroyed) return;
    inst.events.emit('drag:end', {
      id: d.id, fromIndex: d.fromIndex, toIndex: d.index, moved: d.index !== d.fromIndex,
      cancelled: !!cancel, outside: d.outside, clientX: d.x, clientY: d.y, pointerType: d.type
    });
  }
}

/* ============================================================
   12. LIFECYCLE MANAGER
   Всё, что нужно остановить в destroy(): AbortController слушателей,
   таймеры, requestAnimationFrame.
   ============================================================ */

class LifecycleManager {
  constructor() {
    this.ctl = new AbortController();
    this.timers = new Set();
    this.rafs = new Set();
    this.destroyed = false;
  }
  get signal() {
    return this.ctl.signal;
  }
  timeout(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.destroyed) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }
  clearTimeout(id) {
    if (!id) return;
    clearTimeout(id);
    this.timers.delete(id);
  }
  raf(fn) {
    const run = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(() => cb(now()), 16);
    const id = run((t) => {
      this.rafs.delete(id);
      if (!this.destroyed) fn(t);
    });
    this.rafs.add(id);
    return id;
  }
  cancelRaf(id) {
    if (!id) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id);
    this.rafs.delete(id);
  }
  dispose() {
    this.destroyed = true;
    this.ctl.abort();
    for (const t of this.timers) clearTimeout(t);
    for (const r of this.rafs) this.cancelRaf(r);
    this.timers.clear();
    this.rafs.clear();
  }
}

/* ============================================================
   13. GRID INSTANCE
   Внутренний «двигатель» одного грида. Связывает все компоненты.
   Публичный класс ABI7Grid — тонкий фасад над ним.
   ============================================================ */

const OWNERS = new WeakMap(); // element → GridInstance (защита от повторной инициализации)
const ANIMATED_REASONS = new Set(['insert', 'remove', 'move', 'resize', 'layout', 'refresh', 'update']);
const NO_ANCHOR_REASONS = new Set(['data', 'rebuild', 'reload']);

class GridInstance {
  constructor(facade, target, userOptions) {
    this.facade = facade;
    this.root = resolveElement(target);
    if (OWNERS.has(this.root)) throw new ABI7Error('This element already has an ABI7Grid. Call destroy() first.', 'ALREADY_INITIALIZED');
    this.opts = new OptionsManager(userOptions);
    this.life = new LifecycleManager();
    this.events = new EventEmitter((info) => this.reportError(info));
    this.data = new DataStore(this.options.fields);
    this.geo = new GeometryStore();
    this.sizeCache = new Map(); // id → измеренная высота (Dynamic Size Cache)
    this.vp = { width: 0, height: 0 };
    this.layouts = new LayoutRegistry((kind, name) => this._onLayoutRegistry(kind, name));
    this.layoutMgr = new LayoutManager(this);
    this.virt = new VirtualizationEngine(this);
    this.phase = 'new';
    this.started = false;
    this.ready = false;
    this.dataLoaded = false;
    this.hasGeometry = false;
    this.hidden = false;
    this.visible = false;
    this.loading = false;
    this.loadToken = 0;
    this.loadCtl = null;
    this.layoutFrom = Infinity;
    this.layoutReasons = [];
    this.viewDirty = false;
    this.rafId = 0;
    this.waiters = [];
    this.lastTop = 0;
    this.lastLeft = 0;
    this.endFired = false;
    this.visIds = new Set();
    this.pendingScrollReset = false;
    this.resizeBurst = [];
    this._inError = false;
    this._destroying = false;
    this._idleTimer = 0;
    this._userClasses = [];
    this.pendingAnchor = null;
    this.anchorTaken = false;

    this._initDom();
    this.renderer = new DOMRenderer(this);
    this.anim = new AnimationManager(this);
    this.interaction = new InteractionManager(this);
    this.plugins = new PluginManager(this);
    this.anim.applyCss();
    this.renderer.setMeasure(this.options.virtualization.measure);
    this._ref = new WeakRef(this);
    LIVE_INSTANCES.add(this._ref);

    if (this.options.autoRender) {
      queueMicrotask(() => {
        if (!this.life.destroyed && !this.started) this._start();
      });
    }
  }

  get options() {
    return this.opts.value;
  }

  /* ---------- DOM корня ---------- */

  _initDom() {
    const root = this.root, doc = root.ownerDocument;
    this._orig = {};
    for (const a of ['class', 'style', 'tabindex', 'role', 'aria-label']) this._orig[a] = root.getAttribute(a);
    OWNERS.set(root, this);
    root.classList.add('abi7-grid');
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '0');
    this.container = doc.createElement('div');
    this.container.className = 'abi7-container';
    this.container.setAttribute('role', 'list');
    root.appendChild(this.container);
    this._applyRootOptions();
  }

  _applyRootOptions() {
    const root = this.root, o = this.options;
    const h = o.height;
    if (h == null || h === false) root.style.removeProperty('--abi7-height');
    else root.style.setProperty('--abi7-height', isNum(h) ? h + 'px' : String(h));
    for (const c of this._userClasses) root.classList.remove(c);
    this._userClasses = String(o.className || '').split(/\s+/).filter(Boolean);
    for (const c of this._userClasses) root.classList.add(c);
    this.applyLayoutClasses();
    root.classList.toggle('abi7-draggable', !!o.interaction.drag.enabled);
    if (this.anim) this.anim.applyCss();
  }

  applyLayoutClasses() {
    const root = this.root;
    for (const c of [...root.classList]) if (c.startsWith('abi7-layout-')) root.classList.remove(c);
    root.classList.add('abi7-layout-' + (this.layoutMgr.name || this.options.layout));
    root.classList.toggle('abi7-axis-x', this.layoutMgr.axis === 'x');
    root.classList.toggle('abi7-axis-y', this.layoutMgr.axis !== 'x');
  }

  /* ---------- Ошибки ---------- */

  reportError(info) {
    const err = info.error;
    const payload = { type: 'error', ...info, message: err && err.message ? err.message : String(err) };
    if (this._inError || !this.events.has('error')) {
      console.error('[ABI7Grid]', payload.source, err);
      return;
    }
    this._inError = true;
    try {
      this.events.emit('error', payload);
    } finally {
      this._inError = false;
    }
  }

  assertAlive() {
    if (this.life.destroyed) throw new ABI7Error('ABI7Grid instance is destroyed', 'DESTROYED');
  }

  /* ---------- Запуск ---------- */

  render() {
    this.assertAlive();
    if (!this.started) this._start();
    else this.refresh();
  }

  _start() {
    if (this.started) return;
    this.started = true;
    this.phase = 'loading';
    const signal = this.life.signal;
    this.root.addEventListener('scroll', () => this.onScroll(), { passive: true, signal });
    this.measureViewport();
    if (this.options.autoResize && typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.onResize());
      this.resizeObs.observe(this.root);
    }
    if (typeof IntersectionObserver !== 'undefined') {
      this.visObs = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        if (!e || e.isIntersecting === this.visible) return;
        this.visible = e.isIntersecting;
        if (this.visible && (this.root.clientWidth !== this.vp.width || this.root.clientHeight !== this.vp.height)) this.onResize();
        this.events.emit('visibility:change', { visible: this.visible });
      });
      this.visObs.observe(this.root);
    }
    this.interaction.attach();
    for (const p of this.options.plugins) {
      try {
        if (Array.isArray(p)) this.plugins.use(p[0], p[1]);
        else this.plugins.use(p);
      } catch (error) {
        this.reportError({ source: 'plugins', error });
      }
    }
    if (!this.layoutMgr.setup()) this.phase = 'pending';
    this.applyLayoutClasses();
    this.loadData(this.options.data == null ? [] : this.options.data, 'initial').catch((error) => this.reportError({ source: 'data', error }));
  }

  _onLayoutRegistry(kind, name) {
    if (this._destroying || this.life.destroyed) return;
    if (kind === 'register' && this.layoutMgr.pending === name) {
      this.layoutMgr.setup();
      this.applyLayoutClasses();
      this.invalidate(0, 'layout');
      this.kick();
    } else if (kind === 'unregister' && this.layoutMgr.name === name && !this.layouts.resolve(name)) {
      this.reportError({ source: 'layout', error: new ABI7Error(`Layout "${name}" was unregistered while in use; falling back to "masonry"`, 'LAYOUT_REMOVED') });
      this.opts.value.layout = 'masonry';
      this.layoutMgr.setup();
      this.applyLayoutClasses();
      this.invalidate(0, 'layout');
    }
  }

  whenReady() {
    if (this.ready) return Promise.resolve(this.facade);
    if (this.life.destroyed) return Promise.reject(new ABI7Error('ABI7Grid instance is destroyed', 'DESTROYED'));
    return new Promise((res, rej) => this.waiters.push({ res, rej }));
  }

  /* ---------- Данные ---------- */

  /** Загрузка из массива, функции (может вернуть Promise) или Promise. Защищена от гонок. */
  loadData(source, kind) {
    const token = ++this.loadToken;
    if (this.loadCtl) this.loadCtl.abort();
    const ctl = (this.loadCtl = new AbortController());
    this.loading = true;
    this.events.emit('data:load-start', { source: kind });
    let value;
    try {
      value = typeof source === 'function' ? source({ signal: ctl.signal, source: kind }) : source;
    } catch (error) {
      this._loadFailed(kind, error);
      return Promise.resolve(this.facade);
    }
    if (value && typeof value.then === 'function') {
      return value.then(
        (res) => {
          if (token === this.loadToken && !this.life.destroyed) this._applyLoaded(res, kind);
          return this.facade;
        },
        (error) => {
          if (token === this.loadToken && !this.life.destroyed) this._loadFailed(kind, error);
          return this.facade;
        }
      );
    }
    this._applyLoaded(value, kind);
    return Promise.resolve(this.facade);
  }

  _applyLoaded(list, kind, rethrow = false) {
    try {
      this.data.setAll(list);
    } catch (error) {
      this._loadFailed(kind, error);
      if (rethrow) throw error;
      return;
    }
    this.loading = false;
    this.dataLoaded = true;
    this.sizeCache.clear();
    this.renderer.itemClasses.clear();
    this.pendingScrollReset = true;
    this.renderer.reindex();
    if (this.renderer.mounted.size) this.renderer.rebindAll();
    this.events.emit('data:load-end', { source: kind, count: this.data.size });
    this.invalidate(0, 'data');
    this.kick();
  }

  _loadFailed(kind, error) {
    this.loading = false;
    if (!this.dataLoaded) {
      this.dataLoaded = true;
      this.invalidate(0, 'data');
      this.kick();
    }
    this.events.emit('data:load-end', { source: kind, count: this.data.size, error });
    this.reportError({ source: 'data', error });
  }

  setData(list) {
    this.assertAlive();
    this.loadToken++;
    if (this.loadCtl) this.loadCtl.abort();
    this.loading = true;
    this.events.emit('data:load-start', { source: 'setData' });
    this._applyLoaded(list, 'setData', true);
  }

  insert(items, opts = {}) {
    this.assertAlive();
    const list = Array.isArray(items) ? items : [items];
    if (!list.length) return [];
    let at = opts.at;
    if (at === 'start') at = 0;
    else if (at === 'end' || at == null) at = this.data.size;
    else if (!Number.isInteger(at)) throw new ABI7Error('insert(): "at" must be an integer, "start" or "end"', 'INVALID_ARGUMENT');
    this.captureBefore();
    const res = this.data.insert(list, at);
    at = res[0].index;
    this.renderer.reindex();
    this.invalidate(at, 'insert');
    const arr = res.map((r) => ({ id: r.id, index: r.index, item: r.record }));
    this.events.emit('item:insert', { items: arr, id: arr[0].id, index: arr[0].index, item: arr[0].item, count: arr.length });
    return res.map((r) => r.id);
  }

  remove(idOrIds) {
    this.assertAlive();
    this.captureBefore();
    const removed = this.data.remove(Array.isArray(idOrIds) ? idOrIds : [idOrIds]);
    if (!removed.length) return 0;
    for (const r of removed) {
      this.sizeCache.delete(r.id);
      this.virt.pinned.delete(r.id);
    }
    this.renderer.reindex();
    this.invalidate(removed[0].index, 'remove');
    const arr = removed.map((r) => ({ id: r.id, index: r.index, item: r.record }));
    this.events.emit('item:remove', { items: arr, id: arr[0].id, index: arr[0].index, item: arr[0].item, count: arr.length });
    return removed.length;
  }

  update(id, patch) {
    this.assertAlive();
    this.captureBefore();
    const res = this.data.update(id, patch);
    if (!res) return false;
    const f = this.options.fields;
    const affects = [f.width, f.height, f.aspectRatio].some((k) => typeof k === 'function' || res.changed.includes(k));
    if (affects) {
      this.sizeCache.delete(id);
      this.invalidate(res.index, 'update');
    }
    this.renderer.rebind(id);
    this.events.emit('item:update', { id, index: res.index, item: res.record, previous: res.previous, changed: res.changed });
    return true;
  }

  move(id, toIndex, source = 'api') {
    this.assertAlive();
    this.captureBefore();
    const r = this.data.move(id, toIndex);
    if (!r) return false;
    this.renderer.reindex();
    this.invalidate(Math.min(r.from, r.to), 'move');
    this.events.emit('item:move', { id, from: r.from, to: r.to, index: r.to, item: this.data.records[r.to], source });
    return true;
  }

  /* ---------- Планирование ---------- */

  invalidate(from, reason = 'refresh') {
    if (this.life.destroyed) return;
    this.layoutFrom = Math.min(this.layoutFrom, Math.max(0, from));
    if (!this.layoutReasons.includes(reason)) this.layoutReasons.push(reason);
    this.schedule();
  }

  requestView() {
    this.viewDirty = true;
    this.schedule();
  }

  schedule() {
    if (this.rafId || this.life.destroyed) return;
    this.rafId = this.life.raf(() => {
      this.rafId = 0;
      this.frame();
    });
  }

  frame() {
    if (this.life.destroyed) return;
    if (this.layoutFrom !== Infinity) this.runLayout();
    if (this.viewDirty && this.hasGeometry) this.updateViewport();
  }

  flush() {
    if (this.life.destroyed) return;
    this.life.cancelRaf(this.rafId);
    this.rafId = 0;
    this.frame();
  }

  kick() {
    if (!this.started || this.life.destroyed) return;
    if (!this.layoutMgr.engine) {
      this.phase = 'pending';
      return;
    }
    if (this.phase === 'pending') this.phase = this.ready ? 'ready' : 'loading';
    this.hidden = this.vp.width <= 0;
    if (!this.hidden) this.schedule();
  }

  canLayout() {
    return this.started && this.dataLoaded && !!this.layoutMgr.engine && this.vp.width > 0;
  }

  ensureLayout() {
    if (this.layoutFrom !== Infinity) this.runLayout();
  }

  measureViewport() {
    this.vp.width = this.root.clientWidth;
    this.vp.height = this.root.clientHeight;
  }

  onScroll() {
    this.viewDirty = true;
    this.schedule();
    this.life.clearTimeout(this._idleTimer);
    this._idleTimer = this.life.timeout(() => {
      this.virt.idle();
      this.events.emit('scroll:stop', { scrollTop: this.root.scrollTop, scrollLeft: this.root.scrollLeft });
      this.requestView();
    }, 140);
  }

  onResize() {
    if (this.life.destroyed) return;
    const w = this.root.clientWidth, h = this.root.clientHeight;
    const dw = w !== this.vp.width, dh = h !== this.vp.height;
    if (!dw && !dh) return;
    this.vp.width = w;
    this.vp.height = h;
    const r = this.layoutMgr.responsive;
    if ((dw && (r === 'width' || r === 'both')) || (dh && (r === 'height' || r === 'both')) || this.layoutFrom !== Infinity || !this.hasGeometry) {
      // Защита от бесконечного цикла resize → layout → resize (например, мигающий скроллбар).
      const t = now();
      this.resizeBurst = this.resizeBurst.filter((x) => t - x < 500);
      this.resizeBurst.push(t);
      if (this.resizeBurst.length <= 10) this.invalidate(0, 'resize');
    }
    this.viewDirty = true;
    this.events.emit('resize', { width: w, height: h });
    this.kick();
    this.schedule();
  }

  /** Запоминает якорь скролла ДО изменения данных (пока индексы и геометрия согласованы). */
  captureBefore() {
    if (this.anchorTaken || !this.ready || this.layoutFrom !== Infinity) return;
    this.pendingAnchor = this.captureAnchor();
    this.anchorTaken = true;
  }

  /* ---------- Layout pass ---------- */

  runLayout() {
    if (this.layoutFrom === Infinity || !this.canLayout()) return false;
    const from = Math.min(this.layoutFrom, this.data.size);
    const reasons = this.layoutReasons;
    this.layoutFrom = Infinity;
    this.layoutReasons = [];
    const first = !this.ready;
    this.events.emit('layout:start', { reason: reasons[0] || 'refresh', reasons: reasons.slice(), from, count: this.data.size });
    const t0 = now();
    const animate = !first && this.hasGeometry && reasons.some((r) => ANIMATED_REASONS.has(r)) && this.anim.enabled;
    let anchor = null;
    if (!first && this.options.scrollAnchoring && !reasons.some((r) => NO_ANCHOR_REASONS.has(r))) {
      anchor = this.anchorTaken ? this.pendingAnchor : this.captureAnchor();
    }
    this.anchorTaken = false;
    this.pendingAnchor = null;
    if (animate) this.anim.begin();
    let info = {};
    try {
      info = this.layoutMgr.compute(from);
    } catch (error) {
      this.reportError({ source: 'layout', error });
    }
    this.geo.epoch++;
    this.geo.buildIndex(this.layoutMgr.axis);
    this.hasGeometry = true;
    this.applyContentSize();
    if (anchor) this.restoreAnchor(anchor);
    if (this.pendingScrollReset) {
      this.pendingScrollReset = false;
      this.root.scrollTop = 0;
      this.root.scrollLeft = 0;
    }
    this.updateViewport(true);
    this.events.emit('layout:end', {
      reason: reasons[0] || 'refresh', reasons: reasons.slice(), from, count: this.data.size,
      contentWidth: this.geo.contentW, contentHeight: this.geo.contentH, duration: now() - t0, animated: animate, info: { ...info }
    });
    if (first) {
      this.ready = true;
      this.phase = 'ready';
      this.events.emit('ready', { count: this.data.size });
      for (const w of this.waiters.splice(0)) w.res(this.facade);
    }
    return true;
  }

  applyContentSize() {
    const s = this.container.style, g = this.geo;
    if (this.layoutMgr.axis === 'x') {
      s.width = g.contentW + 'px';
      s.height = '';
      s.minWidth = '';
    } else {
      s.height = g.contentH + 'px';
      s.width = '';
      s.minWidth = g.contentW > this.vp.width ? g.contentW + 'px' : '';
    }
  }

  viewMetrics() {
    const x = this.layoutMgr.axis === 'x', r = this.root;
    return x
      ? { sMain: r.scrollLeft, vMain: this.vp.width, sCross: r.scrollTop, vCross: this.vp.height }
      : { sMain: r.scrollTop, vMain: this.vp.height, sCross: r.scrollLeft, vCross: this.vp.width };
  }

  /** Scroll Anchoring: запоминаем первый видимый элемент и его смещение от верхнего края окна. */
  captureAnchor() {
    if (!this.hasGeometry || !this.geo.count) return null;
    const x = this.layoutMgr.axis === 'x';
    const m = this.viewMetrics();
    if (m.sMain <= 0) return null;
    const idx = this.virt.visible(this.geo, m.sMain, m.vMain, m.sCross, m.vCross);
    if (!idx.length) return null;
    const mp = x ? this.geo.x : this.geo.y;
    let best = idx[0];
    for (const i of idx) if (mp[i] < mp[best]) best = i;
    return { id: this.data.ids[best], offset: mp[best] - m.sMain };
  }

  restoreAnchor(a) {
    const i = this.data.index.get(a.id);
    if (i === undefined) return;
    const x = this.layoutMgr.axis === 'x';
    const target = Math.max(0, (x ? this.geo.x[i] : this.geo.y[i]) - a.offset);
    const cur = x ? this.root.scrollLeft : this.root.scrollTop;
    if (Math.abs(target - cur) >= 1) {
      if (x) this.root.scrollLeft = target;
      else this.root.scrollTop = target;
    }
  }

  /* ---------- Viewport pass ---------- */

  updateViewport(force = false) {
    if (!this.hasGeometry || this.life.destroyed) return;
    this.viewDirty = false;
    const m = this.viewMetrics();
    this.virt.track(m.sMain);
    const want = this.virt.select(this.geo, m.sMain, m.vMain, m.sCross, m.vCross);
    const changed = this.renderer.sync(want);
    this._updateVisibility(m);
    const top = this.root.scrollTop, left = this.root.scrollLeft;
    if (top !== this.lastTop || left !== this.lastLeft) {
      this.lastTop = top;
      this.lastLeft = left;
      this.events.emit('scroll', { scrollTop: top, scrollLeft: left, direction: this.virt.direction > 0 ? 'forward' : 'backward', velocity: this.virt.velocity });
    }
    if (changed || force) {
      const r = this.renderer;
      this.events.emit('viewport:update', {
        mounted: r.mounted.size, pooled: r.pool.length, total: this.data.size, created: r.created, reused: r.reused,
        overscan: { ...this.virt.lastOverscan }, first: want.length ? want[0] : -1, last: want.length ? want[want.length - 1] : -1
      });
    }
    this._checkEnd(m);
  }

  _updateVisibility(m) {
    const ev = this.events;
    if (!ev.has('item:visible') && !ev.has('item:hidden')) {
      if (this.visIds.size) this.visIds.clear();
      return;
    }
    const cur = new Set();
    for (const i of this.virt.visible(this.geo, m.sMain, m.vMain, m.sCross, m.vCross)) cur.add(this.data.ids[i]);
    for (const id of cur) {
      if (!this.visIds.has(id)) {
        const i = this.data.index.get(id), ent = this.renderer.mounted.get(id);
        ev.emit('item:visible', { id, index: i, item: this.data.records[i], element: ent ? ent.el : null });
      }
    }
    for (const id of this.visIds) {
      if (!cur.has(id)) ev.emit('item:hidden', { id, index: this.data.index.has(id) ? this.data.index.get(id) : -1 });
    }
    this.visIds = cur;
  }

  _checkEnd(m) {
    if (!this.ready) return;
    const content = this.layoutMgr.axis === 'x' ? this.geo.contentW : this.geo.contentH;
    const remaining = content - (m.sMain + m.vMain);
    const th = this.options.virtualization.endThreshold;
    if (remaining <= th) {
      if (!this.endFired) {
        this.endFired = true;
        this.events.emit('reach:end', { remaining: Math.max(0, remaining), count: this.data.size });
      }
    } else this.endFired = false;
  }

  /* ---------- Геометрия и навигация ---------- */

  rectByIndex(i) {
    this.ensureLayout();
    if (!Number.isInteger(i) || i < 0 || i >= this.data.size) return null;
    return this.geo.rect(i, this.data.ids[i]);
  }

  rectById(id) {
    const i = this.data.index.get(id);
    return i === undefined ? null : this.rectByIndex(i);
  }

  _intersects(i, m) {
    const x = this.layoutMgr.axis === 'x', g = this.geo;
    const mp = x ? g.x : g.y, ms = x ? g.w : g.h, cp = x ? g.y : g.x, cs = x ? g.h : g.w;
    return mp[i] + ms[i] > m.sMain && mp[i] < m.sMain + m.vMain && cp[i] + cs[i] > m.sCross && cp[i] < m.sCross + m.vCross;
  }

  describe(i, m) {
    const id = this.data.ids[i], ent = this.renderer.mounted.get(id);
    return { id, index: i, data: this.data.records[i], rect: this.geo.rect(i, id), element: ent ? ent.el : null, visible: m ? this._intersects(i, m) : false };
  }

  getItem(id) {
    this.ensureLayout();
    const i = this.data.index.get(id);
    return i === undefined ? null : this.describe(i, this.viewMetrics());
  }

  getItems() {
    this.ensureLayout();
    const m = this.viewMetrics(), out = new Array(this.data.size);
    for (let i = 0; i < out.length; i++) out[i] = this.describe(i, m);
    return out;
  }

  getVisibleItems() {
    this.ensureLayout();
    const m = this.viewMetrics();
    return this.virt.visible(this.geo, m.sMain, m.vMain, m.sCross, m.vCross).map((i) => this.describe(i, m));
  }

  visibleRange() {
    this.ensureLayout();
    const m = this.viewMetrics();
    const v = this.virt.visible(this.geo, m.sMain, m.vMain, m.sCross, m.vCross);
    return v.length ? { first: v[0], last: v[v.length - 1], count: v.length } : { first: -1, last: -1, count: 0 };
  }

  isVisibleId(id) {
    this.ensureLayout();
    const i = this.data.index.get(id);
    return i !== undefined && this._intersects(i, this.viewMetrics());
  }

  viewportState() {
    return { scrollLeft: this.root.scrollLeft, scrollTop: this.root.scrollTop, width: this.vp.width, height: this.vp.height, axis: this.layoutMgr.axis, overscan: { ...this.virt.lastOverscan } };
  }

  clientToContent(cx, cy) {
    const r = this.root.getBoundingClientRect();
    return { x: cx - r.left - this.root.clientLeft + this.root.scrollLeft, y: cy - r.top - this.root.clientTop + this.root.scrollTop };
  }

  indexAtClientPoint(cx, cy, opts = {}) {
    this.ensureLayout();
    const p = this.clientToContent(cx, cy);
    const hit = this.geo.hitTest(p.x, p.y);
    if (hit >= 0 || !opts.nearest) return hit;
    const m = this.viewMetrics();
    let best = -1, bd = Infinity;
    for (const i of this.virt.visible(this.geo, m.sMain, m.vMain, m.sCross, m.vCross)) {
      const dx = this.geo.x[i] + this.geo.w[i] / 2 - p.x, dy = this.geo.y[i] + this.geo.h[i] / 2 - p.y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  scrollToPoint(x, y, behavior = 'auto') {
    const r = this.root;
    if (behavior === 'smooth' && typeof r.scrollTo === 'function') r.scrollTo({ left: x, top: y, behavior });
    else {
      if (isNum(x)) r.scrollLeft = x;
      if (isNum(y)) r.scrollTop = y;
    }
    this.updateViewport();
  }

  scrollToIndex(index, o = {}) {
    this.assertAlive();
    this.ensureLayout();
    if (!Number.isInteger(index) || index < 0 || index >= this.data.size) return false;
    const x = this.layoutMgr.axis === 'x', g = this.geo;
    const start = x ? g.x[index] : g.y[index], size = x ? g.w[index] : g.h[index];
    const view = x ? this.vp.width : this.vp.height, cur = x ? this.root.scrollLeft : this.root.scrollTop;
    const content = x ? g.contentW : g.contentH, off = isNum(o.offset) ? o.offset : 0;
    let target;
    switch (o.align || 'start') {
      case 'center': target = start - (view - size) / 2; break;
      case 'end': target = start + size - view + off; break;
      case 'nearest': target = start < cur ? start - off : start + size > cur + view ? start + size - view + off : cur; break;
      default: target = start - off;
    }
    target = clamp(target, 0, Math.max(0, content - view));
    if (x) this.scrollToPoint(target, undefined, o.behavior);
    else this.scrollToPoint(undefined, target, o.behavior);
    return true;
  }

  scrollToItem(id, o) {
    const i = this.data.index.get(id);
    return i === undefined ? false : this.scrollToIndex(i, o);
  }

  /* ---------- Опции, жизненный цикл ---------- */

  setOption(path, value) {
    this.assertAlive();
    this.opts.set(path, value);
    this._optionsChanged([path]);
  }

  rebuild(patch = {}) {
    this.assertAlive();
    this.opts.patch(patch);
    this._optionsChanged(Object.keys(patch));
    if (hasOwn(patch, 'data') && patch.data != null) this.loadData(patch.data, 'rebuild');
  }

  _optionsChanged(keys) {
    const top = new Set(keys.map((k) => String(k).split('.')[0]));
    this.data.fields = this.options.fields;
    this._applyRootOptions();
    if (top.has('layout') || top.has('layoutOptions')) {
      this.layoutMgr.setup();
      this.applyLayoutClasses();
    }
    this.renderer.setMeasure(this.options.virtualization.measure);
    if (['renderItem', 'releaseItem', 'itemTag', 'itemClassName', 'allowHTML', 'fields', 'virtualization'].some((k) => top.has(k))) this.renderer.reset();
    if (['layout', 'layoutOptions', 'padding', 'fields', 'virtualization'].some((k) => top.has(k))) {
      // Изменение раскладки анимируется и сохраняет якорь скролла; остальное — «тихая» перестройка.
      this.invalidate(0, ['layout', 'layoutOptions', 'padding'].some((k) => top.has(k)) ? 'layout' : 'rebuild');
    }
    this.requestView();
    this.kick();
  }

  refresh() {
    this.assertAlive();
    if (!this.started) return;
    this.measureViewport();
    this.invalidate(0, 'refresh');
    this.flush();
  }

  reload() {
    this.assertAlive();
    if (!this.started) {
      this._start();
      return this.whenReady();
    }
    const src = this.options.data;
    if (typeof src === 'function') return this.loadData(src, 'reload');
    this.pendingScrollReset = true;
    this.measureViewport();
    this.renderer.rebindAll();
    this.invalidate(0, 'reload');
    this.flush();
    return Promise.resolve(this.facade);
  }

  getState() {
    const r = this.renderer, g = this.geo;
    return {
      phase: this.phase, ready: this.ready, destroyed: this.life.destroyed, loading: this.loading, hidden: this.hidden, visible: this.visible,
      layout: this.layoutMgr.name || this.options.layout, pendingLayout: this.layoutMgr.pending, axis: this.layoutMgr.axis,
      count: this.data.size, contentWidth: g.contentW, contentHeight: g.contentH, layoutInfo: { ...this.layoutMgr.info },
      viewport: this.life.destroyed ? null : this.viewportState(),
      virtualization: {
        enabled: this.options.virtualization.enabled, mounted: r.mounted.size, pooled: r.pool.length, created: r.created, reused: r.reused,
        pinned: this.virt.pinned.size, velocity: this.virt.velocity, overscan: { ...this.virt.lastOverscan }
      },
      plugins: this.plugins.list().map((p) => p.name)
    };
  }

  destroy() {
    if (this.life.destroyed) return;
    this._destroying = true;
    try {
      this.events.emit('destroy', {});
    } catch (_) { /* уже защищено emitter-ом */ }
    this.plugins.destroyAll();
    this.interaction.detach();
    if (this.loadCtl) this.loadCtl.abort();
    this.loadToken++;
    for (const o of [this.resizeObs, this.visObs]) if (o) o.disconnect();
    this.renderer.destroy();
    this.anim.stop();
    this.life.dispose();
    this.container.remove();
    for (const [attr, val] of Object.entries(this._orig)) {
      if (val === null) this.root.removeAttribute(attr);
      else this.root.setAttribute(attr, val);
    }
    OWNERS.delete(this.root);
    LIVE_INSTANCES.delete(this._ref);
    this.events.clear();
    this.data = new DataStore(this.options.fields);
    this.sizeCache.clear();
    this.visIds.clear();
    this.phase = 'destroyed';
    for (const w of this.waiters.splice(0)) w.rej(new ABI7Error('ABI7Grid instance was destroyed before it became ready', 'DESTROYED'));
  }
}

/* ============================================================
   14. PUBLIC API
   ============================================================ */

const LEGACY_EVENTS = ['onBof', 'onEof', 'onCalcSize', 'onChangeVisible', 'onChangeDirection', 'onDataLoadStart', 'onDataLoadEnd', 'onScroll', 'onScrollEnd', 'onSortStart', 'onSortEnd', 'onItemCenterEnter', 'onItemCenterExit', 'onItemContextMenu', 'onItemClick', 'onItemDblClick', 'onItemDelete', 'onItemEnter', 'onItemExit', 'onItemInsert', 'onItemLoaded', 'onItemMouseEnter', 'onItemMouseLeave', 'onItemVisibility', 'onReady', 'onResize'];

export class ABI7Grid {
  #c;

  /**
   * @param {string|HTMLElement} target Контейнер (селектор или элемент).
   * @param {object} [options] См. раздел Options в документации.
   */
  constructor(target, options = {}) {
    this.#c = new GridInstance(this, target, options);
  }

  static get version() { return VERSION; }
  static get apiVersion() { return API_VERSION; }
  static get defaults() { return clonePlain({ ...DEFAULTS, data: null }); }

  /** Глобальная регистрация layout. Принимает определение layout или plugin-объект с полем `layout`. */
  static registerLayout(name, definition, { override = false } = {}) {
    const def = normalizeLayoutDefinition(name, definition);
    if (GLOBAL_LAYOUTS.has(name) && !override) throw new ABI7Error(`Layout "${name}" is already registered. Pass { override: true } to replace it.`, 'LAYOUT_EXISTS');
    GLOBAL_LAYOUTS.set(name, def);
    for (const ref of [...LIVE_INSTANCES]) {
      const inst = ref.deref();
      if (!inst) LIVE_INSTANCES.delete(ref);
      else inst._onLayoutRegistry('register', name);
    }
  }

  static unregisterLayout(name) {
    if (BUILTIN_LAYOUTS[name] && GLOBAL_LAYOUTS.get(name) === BUILTIN_LAYOUTS[name]) throw new ABI7Error(`Built-in layout "${name}" cannot be unregistered`, 'LAYOUT_BUILTIN');
    return GLOBAL_LAYOUTS.delete(name);
  }

  static getLayouts() { return [...GLOBAL_LAYOUTS.keys()]; }

  /** Конвертирует настройки старого ABI7 Grid в новые. Возвращает { options, unmapped }. */
  static fromLegacyOptions(old = {}) {
    const o = { layout: 'masonry', layoutOptions: {}, animation: {}, interaction: { drag: {} }, virtualization: {} };
    const unmapped = [];
    const it = old.items || {}, sp = old.space || {}, an = old.animation || {}, gr = old.grid || {};
    const lo = o.layoutOptions;
    if (it.minWidth != null) lo.minWidth = it.minWidth;
    if (it.maxWidth != null) lo.maxWidth = it.maxWidth;
    if (old.maxColumns != null) lo.maxColumns = old.maxColumns;
    if (sp.cols != null) lo.gapX = sp.cols;
    if (sp.rows != null) lo.gapY = sp.rows;
    if (it.aspectRatio) lo.aspectRatio = it.aspectRatio;
    if (it.height) lo.itemHeight = it.height;
    if (old.padding) o.padding = old.padding;
    if (an.enable != null) o.animation.enabled = !!an.enable;
    if (an.duration != null) o.animation.duration = an.duration;
    if (an.function) o.animation.easing = an.function;
    if (it.sortable) o.interaction.drag.enabled = true;
    if (it.sortStartDelay != null) o.interaction.drag.delay = it.sortStartDelay;
    if (gr.height) o.height = gr.height;
    if (Array.isArray(old.data)) o.data = old.data;
    if (it.multiSelect != null || it.classSelected) unmapped.push('items.multiSelect / items.classSelected → подключите плагин selection');
    for (const k of ['funcLoadData', 'funcItemLoad', 'funcItemCalc', 'itemsCount', 'dataBlockSize']) if (old[k]) unmapped.push(k + ' → data / renderItem / loader (см. Migration)');
    for (const k of LEGACY_EVENTS) if (old.events && old.events[k]) unmapped.push('events.' + k + ' → grid.on(...) (см. Migration)');
    if (gr.scrollbox) unmapped.push('grid.scrollbox (не поддерживается)');
    return { options: o, unmapped };
  }

  /* --- Lifecycle --- */
  render(done) { this.#c.render(); if (typeof done === 'function') this.#c.whenReady().then(done); return this; }
  refresh(done) { this.#c.refresh(); if (typeof done === 'function') done(this); return this; }
  rebuild(options, done) { this.#c.rebuild(options); this.#c.flush(); if (typeof done === 'function') done(this); return this; }
  reload(done) { const p = this.#c.reload(); if (typeof done === 'function') p.then(() => done(this)); return p; }
  destroy() { this.#c.destroy(); }
  flush() { this.#c.flush(); return this; }
  whenReady() { return this.#c.whenReady(); }

  /* --- Data --- */
  data(list) { if (list === undefined) return this.#c.data.records.slice(); this.#c.setData(list); return this; }
  setData(list) { this.#c.setData(list); return this; }
  load(source) { this.#c.assertAlive(); return this.#c.loadData(source, 'load'); }
  insert(items, opts) { return this.#c.insert(items, opts); }
  remove(idOrIds) { return this.#c.remove(idOrIds); }
  update(id, patch) { return this.#c.update(id, patch); }
  move(id, toIndex) { return this.#c.move(id, toIndex); }
  getCount() { return this.#c.data.size; }

  /* --- Items --- */
  getItem(id) { return this.#c.getItem(id); }
  getItems() { return this.#c.getItems(); }
  getVisibleItems() { return this.#c.getVisibleItems(); }

  /* --- Navigation --- */
  scrollToIndex(index, options) { return this.#c.scrollToIndex(index, options); }
  scrollToItem(id, options) { return this.#c.scrollToItem(id, options); }

  /* --- Plugins --- */
  use(plugin, options) { this.#c.assertAlive(); this.#c.plugins.use(plugin, options); return this; }
  unuse(name) { this.#c.assertAlive(); return this.#c.plugins.unuse(name); }
  getPlugin(name) { return this.#c.plugins.get(name); }
  hasPlugin(name) { return this.#c.plugins.records.has(name); }
  getPlugins() { return this.#c.plugins.list(); }

  /* --- Events --- */
  on(name, fn) { return this.#c.events.on(name, fn); }
  once(name, fn) { return this.#c.events.once(name, fn); }
  off(name, fn) { return this.#c.events.off(name, fn); }

  /* --- State --- */
  getState() { return this.#c.getState(); }
  isDestroyed() { return this.#c.life.destroyed; }

  /* --- Совместимость со старым API (см. раздел Migration) --- */
  /** @deprecated Используйте insert(data, { at: 'start' }). */
  itemInsert(data, done) {
    const ids = this.#c.insert(data, { at: 'start' });
    if (typeof done === 'function') this.once('layout:end', () => done(this));
    return ids[0];
  }
  /** @deprecated Используйте getItems(). */
  items() { return this.#c.getItems(); }
}

/* ============================================================
   15. EXPORTS
   ============================================================ */

export default ABI7Grid;

