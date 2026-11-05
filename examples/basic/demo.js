// Импортируем Core. Ядро — один файл и не содержит код плагинов:
// всё необходимое для базового грида находится здесь.
import { ABI7Grid } from '../../dist/abi7-grid.js';

// Вспомогательный генератор тестовых данных (см. раздел «Examples → общий файл photos.js»).
import { makePhotos, photoSrc } from '../shared/photos.js';

// Данные — обычный массив объектов. Ядру нужны id и размеры (width/height):
// по ним layout считает геометрию, не дожидаясь загрузки картинок.
const photos = makePhotos(40);

// Создаём экземпляр. Первый аргумент — селектор или элемент контейнера.
const grid = new ABI7Grid('#gallery', {
  // layout выбирает алгоритм расчёта геометрии: 'masonry' | 'grid' | 'justified' (+ плагины).
  layout: 'masonry',

  data: photos,

  // fields.src — функция: ядру не нужно знать, где лежит URL картинки.
  // Она вызывается только для карточек, попавших в DOM, а не для всех записей.
  fields: { src: photoSrc },

  // Настройки алгоритма раскладки. minWidth + maxColumns определяют число колонок автоматически.
  layoutOptions: { gap: 12, minWidth: 160, maxColumns: 5 }
});

const out = document.querySelector('#out');

// Подписка на событие клика. Ядро вешает ОДИН слушатель на контейнер (делегирование),
// а не по слушателю на каждую карточку — поэтому клики дёшевы и при 50 000 записей.
grid.on('item:click', (event) => {
  out.textContent = `Клик: ${event.item.title}, индекс ${event.index}, id ${event.id}`;
});

// ready срабатывает один раз — после первой успешной раскладки (когда у контейнера появился размер).
grid.on('ready', (event) => {
  out.textContent = `Готово: ${event.count} карточек. Кликните по любой из них.`;
});
