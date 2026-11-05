// Генератор демонстрационных данных. Внешних картинок нет: каждое «фото» — SVG-градиент
// в виде data:-URL, поэтому все примеры работают офлайн.
//
// Запись данных — обычный объект. Ядру нужны только id и размеры (width/height или aspectRatio):
// по ним Layout считает геометрию, не загружая картинку.

// Детерминированный генератор псевдослучайных чисел: одинаковый seed → одинаковые данные.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ASPECTS = [3 / 2, 4 / 3, 1, 2 / 3, 3 / 4, 16 / 9, 5 / 4, 3 / 2, 4 / 3];

/** Создаёт массив записей: { id, title, width, height, hue }. */
export function makePhotos(count, { seed = 7, start = 1, prefix = 'photo' } = {}) {
  const rnd = mulberry32(seed + start);
  return Array.from({ length: count }, (_, i) => {
    const n = start + i;
    const aspect = ASPECTS[Math.floor(rnd() * ASPECTS.length)];
    return { id: `${prefix}-${n}`, title: `Photo ${n}`, width: 600, height: Math.round(600 / aspect), hue: Math.floor(rnd() * 360) };
  });
}

/**
 * Превращает запись в URL картинки. Передаётся в Core как fields.src — функция-геттер:
 * так URL вычисляется только для тех записей, которые реально попали в DOM (виртуализация),
 * а в памяти не хранятся 50 000 строк с SVG.
 */
export function photoSrc(p) {
  const h2 = (p.hue + 48) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${p.height}" viewBox="0 0 ${p.width} ${p.height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${p.hue} 70% 58%)"/>` +
    `<stop offset="1" stop-color="hsl(${h2} 72% 42%)"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" ` +
    `font-size="${Math.round(p.height * 0.28)}" font-weight="700" fill="rgba(255,255,255,.85)">${String(p.id).replace(/\D+/g, '')}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
