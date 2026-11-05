import { ABI7Grid } from '../../dist/abi7-grid.js';
import ConnectedGrids from '../../plugins/connected-grids/connected-grids.js';
import { makePhotos, photoSrc } from '../shared/photos.js';

const $ = (id) => document.getElementById(id);

// Два НЕЗАВИСИМЫХ экземпляра: у каждого свои данные, свой DOM Pool, своя геометрия.
// Одинаковые options вынесены в функцию, чтобы не дублировать код.
const make = (selector, data) =>
  new ABI7Grid(selector, {
    layout: 'grid',
    data,
    fields: { src: photoSrc },
    layoutOptions: { columns: 2, gap: 8, aspectRatio: 1.2 },
    // Drag & Drop внутри грида (изменение порядка) — функция ядра; плагин включит её сам,
    // но здесь мы указываем это явно для наглядности.
    interaction: { drag: { enabled: true } }
  });

const left = make('#left', makePhotos(10, { prefix: 'a', seed: 3 }));
const right = make('#right', makePhotos(4, { prefix: 'b', seed: 5 }));

// Подключаем плагин к КАЖДОМУ гриду с одинаковым group. name нужен для программного переноса.
// При подключении плагин проверяет совместимость: одна major-версия ядра и одно поле id.
left.use(ConnectedGrids, { group: 'board', name: 'left' });
right.use(ConnectedGrids, { group: 'board', name: 'right' });

// Счётчики берём из данных гридов — они обновляются при любых изменениях (перенос, вставка, удаление).
const counts = () => {
  $('leftCount').textContent = left.getCount() + ' шт.';
  $('rightCount').textContent = right.getCount() + ' шт.';
};
for (const g of [left, right]) {
  g.on('item:insert', counts);
  g.on('item:remove', counts);
}
counts();

// События переноса — собственные события плагина (префикс «connected-grids:»).
const log = (text) => {
  const line = document.createElement('div');
  line.textContent = text;
  $('log').prepend(line);
};
left.on('connected-grids:transfer', (e) => log(`left → ${e.to}: ${e.id}${e.newId !== e.id ? ` (id занят, новый id: ${e.newId})` : ''}, позиция ${e.index}`));
right.on('connected-grids:transfer', (e) => log(`right → ${e.to}: ${e.id}, позиция ${e.index}`));
left.on('connected-grids:receive', (e) => log(`left получил ${e.id} от ${e.from}`));
right.on('connected-grids:receive', (e) => log(`right получил ${e.id} от ${e.from}`));

// Программный перенос через публичный интерфейс плагина (feature).
$('move').onclick = () => {
  const first = left.getItems()[0];
  if (first) left.getPlugin('connected-grids').transfer(first.id, 'right', { at: 0 });
};
