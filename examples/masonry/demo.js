import { ABI7Grid } from '../../dist/abi7-grid.js';
import { makePhotos, photoSrc } from '../shared/photos.js';

const $ = (id) => document.getElementById(id);

// Текущие настройки раскладки хранятся отдельно, чтобы слайдеры и кнопка Rebuild
// всегда передавали в грид полный и согласованный набор значений.
const layoutOptions = { gap: 12, minWidth: 180, maxColumns: 5 };

// Счётчик для id новых карточек: id должен быть уникальным в пределах грида.
let nextNumber = 61;

const grid = new ABI7Grid('#gallery', {
  layout: 'masonry',
  data: makePhotos(60),
  fields: { src: photoSrc },
  layoutOptions,
  // Анимация включается только на время перестроений (вставка, удаление, изменение настроек).
  // Прокрутка никогда не анимируется — иначе карточки «летали» бы при скролле.
  animation: { enabled: true, duration: 350 }
});

// --- Журнал событий ---------------------------------------------------------
const log = (text) => {
  const line = document.createElement('div');
  line.textContent = text; // textContent, а не innerHTML — безопасно при любых данных
  $('log').prepend(line);
  while ($('log').childElementCount > 30) $('log').lastChild.remove();
};

// layout:end приходит после КАЖДОГО перерасчёта геометрии. В event.info layout отдаёт
// свои данные — для Masonry это число колонок и ширина карточки.
grid.on('layout:end', (e) => {
  const s = grid.getState();
  $('stats').innerHTML =
    `layout: <b>${s.layout}</b> · колонок: <b>${e.info.columns}</b> · ширина карточки: <b>${e.info.itemWidth}px</b> · ` +
    `записей: <b>${s.count}</b> · высота контента: <b>${Math.round(e.contentHeight)}px</b> · ` +
    `пересчёт с индекса <b>${e.from}</b> (причина: ${e.reason}, ${e.duration.toFixed(1)} мс)`;
});
grid.on('item:insert', (e) => log(`item:insert ${e.id} на позицию ${e.index}`));
grid.on('item:remove', (e) => log(`item:remove ${e.id} (была позиция ${e.index})`));
grid.on('item:click', (e) => log(`item:click ${e.id}`));

// --- Add / Remove -----------------------------------------------------------
// insert() вставляет запись и перестраивает геометрию ЧАСТИЧНО — только начиная с этой позиции.
$('add').onclick = () => {
  const [photo] = makePhotos(1, { start: nextNumber++, seed: 99 });
  grid.insert(photo, { at: 'start' });
};

// remove() принимает id (или массив id). Ниже удаляется первая карточка из списка.
$('remove').onclick = () => {
  const first = grid.getItems()[0];
  if (first) grid.remove(first.id);
};

// refresh() заново измеряет контейнер и пересчитывает ВСЮ геометрию. Нужен, если вы
// изменили размеры контейнера, а автоматическое отслеживание (autoResize) отключено.
$('refresh').onclick = () => grid.refresh();

// rebuild(options) применяет новые настройки: пересоздаёт layout-движок, сбрасывает DOM-пул
// и перестраивает всё. Данные и позиция прокрутки сохраняются.
$('rebuild').onclick = () => grid.rebuild({ layoutOptions });

// --- Слайдеры настроек --------------------------------------------------------
for (const key of ['gap', 'minWidth', 'maxColumns']) {
  $(key).oninput = (e) => {
    layoutOptions[key] = Number(e.target.value);
    $(key + 'Out').textContent = e.target.value;
    grid.rebuild({ layoutOptions: { [key]: layoutOptions[key] } });
  };
}
