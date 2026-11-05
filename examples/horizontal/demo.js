import { ABI7Grid } from '../../dist/abi7-grid.js';
// Layout-плагин. Core ничего не знает о горизонтальной раскладке: плагин регистрирует
// алгоритм под именем 'horizontal' через api.layouts.register().
import HorizontalLayout from '../../plugins/layout-horizontal/horizontal.js';
import { makePhotos, photoSrc } from '../shared/photos.js';

const $ = (id) => document.getElementById(id);
const strip = $('strip');

// layout: 'horizontal' можно указать ДО подключения плагина:
// грид дождётся регистрации layout и только потом выполнит первую раскладку.
const grid = new ABI7Grid(strip, {
  layout: 'horizontal',
  data: makePhotos(3000), // 3000 карточек разной ширины
  fields: { src: photoSrc },
  layoutOptions: { height: 200, gap: 12 }
});

grid.use(HorizontalLayout);

// Виртуализация та же, что и у вертикальных layout, — она работает по готовой геометрии
// и не знает, горизонтальная она или вертикальная. Ось прокрутки layout сообщает сам (axis: 'x').
const showStats = () => {
  const s = grid.getState();
  $('stats').innerHTML =
    `ось: <b>${s.axis}</b> · записей: <b>${s.count}</b> · в DOM: <b>${strip.querySelectorAll('.abi7-item').length}</b> · ` +
    `общая ширина: <b>${Math.round(s.contentWidth).toLocaleString('ru')} px</b> · scrollLeft: <b>${Math.round(strip.scrollLeft)}</b>`;
};
grid.on('viewport:update', showStats);
grid.on('scroll:stop', showStats);

// Меняем layoutOptions через rebuild(): layout пересчитает ширину каждой карточки.
for (const key of ['height', 'gap']) {
  $(key).oninput = (e) => {
    $(key + 'Out').textContent = e.target.value;
    grid.rebuild({ layoutOptions: { [key]: Number(e.target.value) } });
  };
}

// scrollToIndex сам выбирает ось: для горизонтального layout прокручивает scrollLeft.
$('go').onclick = () => grid.scrollToIndex(Number($('index').value), { align: 'center' });
