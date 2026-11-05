import { ABI7Grid } from '../../dist/abi7-grid.js';
import { makePhotos, photoSrc } from '../shared/photos.js';

const $ = (id) => document.getElementById(id);

const grid = new ABI7Grid('#gallery', {
  // 'justified' строит ряды одинаковой высоты: ширина каждой карточки = высота ряда × её aspect ratio,
  // а высота ряда подбирается так, чтобы ряд ровно заполнил ширину контейнера.
  layout: 'justified',

  // У записей есть width и height — ядро берёт из них aspect ratio. Картинки не нужно загружать.
  data: makePhotos(200),
  fields: { src: photoSrc },

  layoutOptions: {
    targetRowHeight: 200, // желаемая высота ряда
    minRowHeight: 120, // ряд не станет ниже, если можно этого избежать
    maxRowHeight: 300, // и выше
    gap: 8,
    lastRow: 'left' // что делать с неполной последней строкой: left | center | right | justify
  }
});

// Все слайдеры работают одинаково: читаем значение, обновляем подпись и передаём
// изменённый ключ в rebuild(). Layout пересчитает ряды начиная с первого.
for (const key of ['targetRowHeight', 'minRowHeight', 'maxRowHeight', 'gap', 'lastRow']) {
  $(key).addEventListener('input', (e) => {
    const value = key === 'lastRow' ? e.target.value : Number(e.target.value);
    if ($(key + 'Out')) $(key + 'Out').textContent = e.target.value;
    grid.rebuild({ layoutOptions: { [key]: value } });
  });
}

function showStats() {
  // Реальные высоты рядов видны по геометрии: у всех карточек одного ряда одинаковый rect.height.
  const heights = [...new Set(grid.getVisibleItems().map((i) => i.rect.height))].sort((a, b) => a - b);
  const s = grid.getState();
  $('stats').innerHTML =
    `рядов: <b>${s.layoutInfo.rows}</b> · высота контента: <b>${Math.round(s.contentHeight)}px</b> · ` +
    `высоты видимых рядов: <b>${heights.join(', ')}</b>`;
}

// Статистика обновляется после каждой раскладки и после остановки прокрутки
// (при прокрутке меняется набор видимых рядов, но геометрия не пересчитывается).
grid.on('layout:end', showStats);
grid.on('scroll:stop', showStats);
