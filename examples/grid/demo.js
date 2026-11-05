import { ABI7Grid } from '../../dist/abi7-grid.js';
import { makePhotos, photoSrc } from '../shared/photos.js';

const $ = (id) => document.getElementById(id);

const grid = new ABI7Grid('#gallery', {
  // 'grid' — классическая сетка: все карточки ряда одной высоты.
  layout: 'grid',
  data: makePhotos(120),
  fields: { src: photoSrc },
  layoutOptions: {
    columns: 4, // фиксированное число колонок; 0 — подбирать автоматически по minWidth
    minWidth: 140, // используется, только когда columns = 0
    gap: 12, // отступ и по горизонтали, и по вертикали (можно задать раздельно: gapX / gapY)
    aspectRatio: 1.5 // ширина / высота ячейки. Если указать 0 — высота берётся из данных записи
  }
});

// Обновление настроек выполняется ОДНИМ методом — rebuild(). Передавать нужно только изменённые
// ключи: layoutOptions объединяются с текущими, а не заменяют их целиком.
const apply = () => grid.rebuild({
  layoutOptions: {
    columns: Number($('columns').value),
    aspectRatio: Number($('aspect').value),
    gap: Number($('gap').value),
    minWidth: Number($('minWidth').value)
  }
});

for (const id of ['columns', 'aspect', 'gap', 'minWidth']) {
  $(id).addEventListener('input', () => {
    if ($(id + 'Out')) $(id + 'Out').textContent = $(id).value;
    apply();
  });
}

// layout:end — подходящее место, чтобы показать результат расчёта. info.columns — реальное число
// колонок (при columns = 0 оно зависит от ширины контейнера и меняется при ресайзе).
grid.on('layout:end', (e) => {
  $('stats').innerHTML =
    `колонок: <b>${e.info.columns}</b> · рядов: <b>${e.info.rows}</b> · ширина ячейки: <b>${e.info.itemWidth}px</b> · ` +
    `высота контента: <b>${Math.round(e.contentHeight)}px</b>`;
});
