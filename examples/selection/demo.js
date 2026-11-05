// Импортируем Core. Само ядро не содержит код плагинов,
// поэтому подключаем только те расширения, которые действительно нужны.
import { ABI7Grid } from '../../dist/abi7-grid.js';

// Независимый плагин выделения. Он не требует изменения исходного кода Core
// и общается с гридом только через публичный Plugin API.
import SelectionPlugin from '../../plugins/selection/selection.js';

import { makePhotos, photoSrc } from '../shared/photos.js';

const $ = (id) => document.getElementById(id);

const grid = new ABI7Grid('#gallery', {
  layout: 'grid',
  data: makePhotos(80),
  fields: { src: photoSrc },
  layoutOptions: { columns: 0, minWidth: 120, gap: 10, aspectRatio: 1 }
});

// Подключаем функциональность выделения. Core не знает, как именно она работает —
// вся логика выделения находится внутри плагина.
// multiple: true разрешает несколько выбранных карточек (Ctrl/Cmd и Shift).
grid.use(SelectionPlugin, { multiple: true });

// getPlugin(name) возвращает публичный интерфейс, который плагин зарегистрировал через
// api.features.register('selection', ...). Это обычный объект с методами.
const selection = grid.getPlugin('selection');

$('all').onclick = () => selection.selectAll();
$('clear').onclick = () => selection.clear();
$('list').onclick = () => {
  const titles = selection.getSelectedItems().map((p) => p.title);
  $('out').textContent = titles.length ? `Выделено (${titles.length}): ${titles.join(', ')}` : 'Ничего не выделено.';
};

// Плагин генерирует собственное событие selection:change. Префикс «selection:» обязателен:
// плагин может генерировать только события со своим именем в качестве пространства имён.
grid.on('selection:change', (e) => {
  $('out').textContent =
    `selection:change (источник: ${e.source})\n` +
    `добавлено: [${e.added.join(', ')}]  снято: [${e.removed.join(', ')}]\n` +
    `всего выделено: ${e.selected.length}`;
});
