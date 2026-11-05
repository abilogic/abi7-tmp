import { ABI7Grid } from '../../dist/abi7-grid.js';
import LightboxPlugin from '../../plugins/lightbox/lightbox.js';
import { makePhotos, photoSrc } from '../shared/photos.js';

const $ = (id) => document.getElementById(id);

const grid = new ABI7Grid('#gallery', {
  layout: 'justified',
  data: makePhotos(60),
  fields: { src: photoSrc },
  layoutOptions: { targetRowHeight: 150, minRowHeight: 100, maxRowHeight: 220, gap: 8 }
});

// Настройки плагина передаются вторым аргументом use().
// getSrc позволяет показывать в просмотрщике другое (полноразмерное) изображение,
// отличное от миниатюры в гриде. Здесь для наглядности увеличиваем размер SVG.
grid.use(LightboxPlugin, {
  loop: true, // после последнего фото — снова первое
  animation: 250, // мс; 0 отключает анимацию
  closeOnBackdrop: true, // закрытие кликом по тёмному фону
  keyboard: true, // Esc, стрелки, Home/End
  getSrc: (photo) => photoSrc({ ...photo, width: 1600, height: Math.round(1600 * (photo.height / photo.width)) }),
  getCaption: (photo) => `${photo.title} · ${photo.width}×${photo.height}`
});

// Публичный интерфейс каждый раз берём заново через getPlugin(): после unuse()/use() это уже
// другой экземпляр плагина, а ссылка на старый «закрыта» (вызов бросит PLUGIN_INACTIVE).
$('open5').onclick = () => grid.getPlugin('lightbox').open('photo-5');

// loop — опция плагина; чтобы изменить её «на лету», переустанавливаем плагин:
// unuse() вызывает функцию очистки (закрывает окно, снимает все подписки).
$('loop').onchange = (e) => {
  grid.unuse('lightbox');
  grid.use(LightboxPlugin, { loop: e.target.checked, animation: 250 });
};

// События плагина — обычные события грида с префиксом «lightbox:».
const log = (text) => {
  const line = document.createElement('div');
  line.textContent = text;
  $('log').prepend(line);
};
grid.on('lightbox:open', (e) => log(`lightbox:open id=${e.id} index=${e.index}`));
grid.on('lightbox:change', (e) => log(`lightbox:change ${e.previousId} → ${e.id}`));
grid.on('lightbox:close', (e) => log(`lightbox:close id=${e.id}`));
