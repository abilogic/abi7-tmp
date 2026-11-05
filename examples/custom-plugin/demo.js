import { ABI7Grid } from '../../dist/abi7-grid.js';
// Подключаем наш плагин из соседнего файла (см. вкладку counter-plugin.js).
import CounterPlugin from './counter-plugin.js';
import { makePhotos, photoSrc } from '../shared/photos.js';

const $ = (id) => document.getElementById(id);

const grid = new ABI7Grid('#gallery', {
  layout: 'masonry',
  data: makePhotos(50),
  fields: { src: photoSrc },
  layoutOptions: { gap: 10, minWidth: 140 }
});

// use() вызывает CounterPlugin.install(api, options). Опции объединяются с defaults плагина.
grid.use(CounterPlugin, { step: 1, badges: true });

// Публичный интерфейс — то, что плагин зарегистрировал через api.features.register('counter', ...).
const counter = grid.getPlugin('counter');

const log = (text) => {
  const line = document.createElement('div');
  line.textContent = text;
  $('log').prepend(line);
};

// Подписываемся на СОБСТВЕННЫЕ события плагина так же, как на события ядра.
grid.on('counter:change', (e) => {
  $('total').textContent = `Всего кликов: ${e.total}`;
  log(`counter:change ${e.id} → ${e.count} (всего ${e.total})`);
});
grid.on('counter:reset', (e) => {
  $('total').textContent = 'Всего кликов: 0';
  log(`counter:reset (было ${e.previousTotal})`);
});

// Обращение к методам плагина.
$('reset').onclick = () => counter.reset();
$('top').onclick = () => log('top(3): ' + JSON.stringify(counter.top(3)));

// Отключение и повторное подключение. unuse() вызывает функцию очистки, убирает значки,
// снимает подписки и удаляет feature: после этого getPlugin('counter') вернёт null.
let installed = true;
$('toggle').onclick = () => {
  if (installed) {
    grid.unuse('counter');
    $('toggle').textContent = "use(CounterPlugin)";
    log('плагин отключён, getPlugin("counter") = ' + grid.getPlugin('counter'));
  } else {
    grid.use(CounterPlugin);
    $('toggle').textContent = "unuse('counter')";
    log('плагин подключён заново, счётчики начаты с нуля');
  }
  installed = !installed;
};
