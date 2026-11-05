# Getting Started

## Что понадобится

- Файлы `dist/abi7-grid.js` и `dist/abi7-grid.css` (или `*.min.*`).
- Современный браузер (ES2022, `ResizeObserver`; `IntersectionObserver` — опционально).
- **Статический HTTP-сервер.** ES-модули не загружаются со страниц `file://`. Подойдёт любой: `npx serve .`, `python3 -m http.server`, `npm run dev`.

## Структура файлов

```text
dist/
├── abi7-grid.js          # Core, читаемый
├── abi7-grid.min.js      # Core, минифицированный (+ .map)
├── abi7-grid.css         # стили Core
└── abi7-grid.min.css
plugins/
└── selection/selection.js  selection.css  # каждый плагин — отдельно
```

Пересобрать минифицированные файлы из `src/` одной командой: `node tools/build.js`.

## 1. HTML-контейнер

Контейнер — это и скролл-контейнер, поэтому ему **нужна высота** (CSS или опция `height`). Он должен быть пустым.

```html
<link rel="stylesheet" href="./dist/abi7-grid.css">

<div id="gallery" style="height: 600px"></div>
```

## 2. Инициализация и данные

Данные — массив объектов. Ядру нужны `id` и размеры (`width` + `height` или `aspectRatio`): по ним считается геометрия, не дожидаясь загрузки картинок. Для стандартной карточки используются поля `src` и `title`.

```html
<script type="module">
  // Подключаем Core. Код плагинов в него не входит.
  import { ABI7Grid } from './dist/abi7-grid.js';

  const photos = [
    { id: 'p1', src: 'img/1.jpg', width: 1200, height: 800, title: 'Горы' },
    { id: 'p2', src: 'img/2.jpg', width: 800,  height: 1200, title: 'Лес' }
  ];

  const grid = new ABI7Grid('#gallery', {
    layout: 'masonry',
    data: photos,
    layoutOptions: { gap: 12, minWidth: 180, maxColumns: 5 }
  });

  grid.on('ready', () => console.log('первая раскладка выполнена'));
</script>
```

Если у картинок нет размеров, используйте `layoutOptions.aspectRatio` (все карточки одной пропорции) или `virtualization.measure` (высота определяется содержимым), см. [Options](#/api-options).

## 3. Свой вид карточки

```js
const grid = new ABI7Grid('#cards', {
  data: users,                               // [{ id, name, bio }]
  layoutOptions: { aspectRatio: 0 },         // высоту определит содержимое…
  virtualization: { measure: true, estimatedHeight: 140 },
  renderItem(user, el) {
    // Элемент переиспользуется: обновляйте содержимое «на месте».
    el.replaceChildren();
    const h = document.createElement('h4');
    h.textContent = user.name;               // textContent — безопасно
    el.append(h);
  }
});
```

## 4. Подключение плагинов

```html
<link rel="stylesheet" href="./plugins/selection/selection.css">
<script type="module">
  import SelectionPlugin from './plugins/selection/selection.js';
  grid.use(SelectionPlugin, { multiple: true });
  grid.getPlugin('selection').selectAll();
</script>
```

Стили плагина подключаются отдельно и только если плагин используется.

## 5. Уничтожение

```js
grid.destroy();   // слушатели, observers, таймеры, плагины, DOM — всё очищается
```

После `destroy()` на том же контейнере можно создать новый грид.

## Подключение: ES-модули и script-теги

| Способ | Поддержка |
|---|---|
| ES-модули: `import { ABI7Grid } from './dist/abi7-grid.js'` внутри `<script type="module">` | ✅ поддерживается |
| Минифицированная версия: `./dist/abi7-grid.min.js` (тот же формат ES-модуля) | ✅ поддерживается, тесты проходят на обеих версиях |
| Классический `<script src="abi7-grid.js">` без `type="module"` и глобальная переменная | ❌ **не поддерживается**: UMD/IIFE-сборка не реализована |

Если нужен классический `<script>`, оберните вызов в `<script type="module">` и при необходимости присвойте `window.ABI7Grid = ABI7Grid`. Плагины экспортируются через `export default`, то есть тоже являются ES-модулями.

## Первый грид

:::demo basic

## Что дальше

Layout-алгоритмы — на странице [Layouts](#/layouts); производительность на больших массивах — [Virtualization](#/virtualization); расширения — [Plugins](#/plugins).
