import { ABI7Grid } from '../../dist/abi7-grid.js';
import { makePhotos, photoSrc } from '../shared/photos.js';

const $ = (id) => document.getElementById(id);
const gallery = $('gallery');

const grid = new ABI7Grid(gallery, {
  layout: 'masonry',
  data: makePhotos(10000),
  fields: { src: photoSrc },
  layoutOptions: { gap: 8, minWidth: 140 },

  virtualization: {
    enabled: true, // false — смонтировать ВСЕ элементы (для сравнения)
    overscan: 400, // запас в px за пределами видимой области: чем больше, тем реже «мигание» при быстрой прокрутке
    adaptiveOverscan: true, // при быстром скролле запас растёт в сторону движения (до maxOverscan)
    maxOverscan: 1600,
    poolSize: 256 // сколько выпавших из окна DOM-элементов хранить для переиспользования
  },
  animation: { enabled: false } // для наглядности отключаем анимацию перестроений
});

// Единственное место, где считаются цифры для панели. Считаем из реальных источников:
//  - getState().virtualization — внутренние счётчики DOM Pool (created / reused / pooled);
//  - gallery.querySelectorAll — сколько узлов реально находится в документе прямо сейчас.
function render() {
  const s = grid.getState();
  const v = s.virtualization;
  const inDom = gallery.querySelectorAll('.abi7-item').length;
  $('stats').innerHTML =
    `всего записей: <b>${s.count.toLocaleString('ru')}</b>\n` +
    `DOM-элементов в документе: <b>${inDom}</b> (смонтировано ядром: ${v.mounted})\n` +
    `в DOM Pool (ожидают повторного использования): <b>${v.pooled}</b>\n` +
    `создано за всё время: <b>${v.created}</b> · переиспользовано: <b>${v.reused}</b>\n` +
    `overscan до/после: <b>${Math.round(v.overscan.before)} / ${Math.round(v.overscan.after)} px</b> · ` +
    `высота контента: <b>${Math.round(s.contentHeight).toLocaleString('ru')} px</b>`;
}

// viewport:update приходит, когда набор смонтированных элементов изменился
// (прокрутка, ресайз, вставка). Это самое подходящее событие для такой панели.
grid.on('viewport:update', render);
grid.on('scroll:stop', render);

// Смена размера массива: setData() заменяет данные целиком. Новые записи создаются
// быстро, а DOM остаётся тем же — элементы из пула просто привязываются к новым данным.
for (const btn of document.querySelectorAll('[data-size]')) {
  btn.onclick = () => grid.setData(makePhotos(Number(btn.dataset.size)));
}

// Настройки виртуализации меняются «на лету» через rebuild().
$('overscan').oninput = (e) => {
  $('overscanOut').textContent = e.target.value;
  grid.rebuild({ virtualization: { overscan: Number(e.target.value) } });
};
$('adaptive').onchange = (e) => grid.rebuild({ virtualization: { adaptiveOverscan: e.target.checked } });

// scrollToIndex использует готовую геометрию — DOM для промежуточных элементов не создаётся.
$('go').onclick = () => grid.scrollToIndex(Number($('index').value), { align: 'start' });
$('top').onclick = () => grid.scrollToIndex(0);
