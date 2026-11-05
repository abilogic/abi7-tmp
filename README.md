# ABI7 Grid

Модульная JavaScript-библиотека для плиточных сеток и фотогалерей: **Masonry, Grid, Justified**, виртуализация (десятки тысяч карточек), Drag & Drop и **система плагинов**. Vanilla JS (ES2022), без runtime-зависимостей.

Это архитектурная переработка оригинального ABI7 Grid (автор — Alexander Momot). Оригинальные файлы сохранены без изменений в `original/`.

**Core — два файла:** `abi7-grid.js` и `abi7-grid.css` (+ минифицированные `*.min.*`). Плагины — отдельные файлы в `plugins/`.

📖 **Документация и живые примеры:** откройте сайт (см. «Запуск сайта») — разделы Getting Started, Layouts, Virtualization, Plugins, API Reference, Examples, Migration.

## Возможности

- Три встроенных layout (Masonry, Grid, Justified) и Layout API для собственных алгоритмов.
- Виртуализация, независимая от layout: DOM Pool, overscan и adaptive overscan, Scroll Anchoring, `scrollToIndex`, закреплённые элементы, Dynamic Size Cache.
- Частичный перерасчёт геометрии (вставка/удаление не пересчитывают всё с нуля).
- Drag & Drop (мышь и касание, автопрокрутка), работает с виртуализацией и любым layout.
- Plugin API: изоляция экземпляров, проверка совместимости и зависимостей, автоматическая очистка.
- Безопасность: стандартная карточка строится DOM API, URL фильтруются.
- Корректный `destroy()`: слушатели, observers, таймеры, плагины, DOM.

## Установка

Пакет в npm не опубликован: скопируйте файлы из `dist/` (и нужные плагины из `plugins/`) в проект.

```text
dist/abi7-grid.js | abi7-grid.min.js (+ .map) | abi7-grid.css | abi7-grid.min.css
plugins/<name>/<name>.js [ + <name>.css ]
```

Сборка минифицированных файлов из `src/` одной командой: `node tools/build.js` (esbuild — только инструмент сборки, в runtime не попадает).

## Быстрый старт

```html
<link rel="stylesheet" href="./dist/abi7-grid.css">
<div id="gallery" style="height: 600px"></div>

<script type="module">
  import { ABI7Grid } from './dist/abi7-grid.js';

  const grid = new ABI7Grid('#gallery', {
    layout: 'masonry',                       // 'masonry' | 'grid' | 'justified' | имя layout-плагина
    data: [{ id: 'p1', src: 'a.jpg', width: 1200, height: 800, title: 'A' } /* … */],
    layoutOptions: { gap: 12, minWidth: 180, maxColumns: 5 },
    virtualization: { enabled: true, overscan: 500 },
    animation: { enabled: true, duration: 300 }
  });

  grid.on('item:click', (e) => console.log(e.id));
</script>
```

Контейнер должен быть пустым и иметь высоту. Данные: `id` и размеры (`width`+`height` или `aspectRatio`).

> **Формат поставки — только ES-модули.** Классический `<script src>` без `type="module"` и UMD/IIFE-сборка не реализованы. ES-модули не работают со страниц `file://` — нужен статический сервер.

## Layout

| Layout | Идея | Ключевые `layoutOptions` |
|---|---|---|
| `masonry` | колонки, карточка — в самую короткую | `gap`, `columns`, `minWidth`, `maxWidth`, `maxColumns`, `itemHeight`, `aspectRatio` |
| `grid` | сетка, ячейки ряда одной высоты | `columns`, `minWidth`, `width`, `gap/gapX/gapY`, `aspectRatio`, `itemHeight` |
| `justified` | ряды одинаковой высоты, разная ширина | `targetRowHeight`, `minRowHeight`, `maxRowHeight`, `gap`, `lastRow` |
| `horizontal` | плагин: горизонтальная лента | `height`, `gap`, `itemWidth` |

## Виртуализация

В DOM — только видимые карточки + `overscan`; выпавшие узлы переиспользуются (DOM Pool). `grid.getState().virtualization` показывает реальные `mounted`, `pooled`, `created`, `reused`. `grid.scrollToIndex(25000)` не создаёт DOM для промежуточных карточек.

## Плагины

| Плагин | Файлы | Назначение |
|---|---|---|
| `@abi7/selection` | `plugins/selection/` | выделение: клик, Ctrl/Cmd, Shift, `selectAll` |
| `@abi7/lightbox` | `plugins/lightbox/` | просмотр поверх грида: клавиатура, свайп |
| `@abi7/layout-horizontal` | `plugins/layout-horizontal/` | горизонтальная лента |
| `@abi7/connected-grids` | `plugins/connected-grids/` | перенос карточек между гридами |

```js
import SelectionPlugin from './plugins/selection/selection.js';

grid.use(SelectionPlugin, { multiple: true });
grid.getPlugin('selection').select('p1');
grid.unuse('selection');
```

### Свой плагин

```js
export default {
  name: 'counter', version: '1.0.0', apiVersion: '^1.0.0',
  install(api, options) {
    let clicks = 0;                                          // состояние — у каждого грида своё
    api.events.on('item:click', (e) => {
      clicks++;
      api.events.emit('counter:change', { id: e.id, clicks }); // события плагина — с префиксом «имя:»
    });
    api.features.register('counter', { get: () => clicks });   // grid.getPlugin('counter').get()
    return () => { clicks = 0; };                              // очистка при unuse()/destroy()
  }
};
```

Полное руководство с 15 шагами и разбором работающего плагина — на сайте документации («Создание плагина»).

## API

```js
// Lifecycle   render() refresh() rebuild(options) reload() destroy() flush() whenReady()
// Data        data() setData(list) load(source) insert(items, {at}) remove(id) update(id, patch) move(id, to) getCount()
// Items       getItem(id) getItems() getVisibleItems()
// Navigation  scrollToIndex(i, opts) scrollToItem(id, opts)
// Plugins     use(plugin, opts) unuse(name) getPlugin(name) hasPlugin(name) getPlugins()
// Events      on(name, fn) once(name, fn) off(name, fn)
// State       getState() isDestroyed()
// Static      ABI7Grid.registerLayout() unregisterLayout() getLayouts() fromLegacyOptions()
```

## События

`ready`, `destroy`, `error`, `data:load-start`, `data:load-end`, `layout:start`, `layout:end`, `viewport:update`, `scroll`, `scroll:stop`, `resize`, `visibility:change`, `reach:end`, `item:mount`, `item:unmount`, `item:visible`, `item:hidden`, `item:click`, `item:dblclick`, `item:contextmenu`, `item:insert`, `item:remove`, `item:update`, `item:move`, `drag:start`, `drag:move`, `drag:end`, `plugin:install`, `plugin:uninstall`. Для каждого — момент вызова, порядок, структура объекта события и отмена: см. API Reference → Events.

## Запуск сайта документации

```bash
npm install
node tools/build.js      # собирает dist/ (+ min, source map) и зеркалирует примеры в public/
npm run dev              # сайт в режиме разработки
# или
npm run build            # итоговая сборка: dist/index.html — самодостаточный сайт (все примеры внутри)
npm run preview
```

Примеры запускаются в iframe **из тех же файлов**, что показаны во вкладках кода (`examples/*`). Их же можно открыть как самостоятельные страницы через статический сервер: `examples/basic/index.html`.

> Из-за сборки Vite выходная папка `dist/` проекта пересоздаётся командой `npm run build`; библиотечные файлы `dist/abi7-grid*.{js,css}` восстанавливаются командой `node tools/build.js`, а в итоговую сборку сайта попадают через `public/`.

## Тесты

```bash
node tools/build.js --no-site
node --test tests/
```

Тесты (Node + jsdom) покрывают инициализацию и уничтожение, три layout, частичный и полный перерасчёт, виртуализацию на 50 000 элементов, DOM Pool, Scroll Anchoring, Drag & Drop, плагины и их очистку, асинхронную загрузку и гонки, безопасность, **минифицированную сборку** (весь набор прогоняется и на `src`, и на `dist/abi7-grid.min.js`), CSS, а также согласованность документации с кодом и запуск всех демонстрационных страниц. Реальный браузер в тестах не используется: проверка визуального поведения (анимации, касания, скроллбары) выполняется вручную на сайте документации.

## Структура репозитория

```text
original/   исходный ABI7 Grid (не изменять)
src/        abi7-grid.js, abi7-grid.css — исходники Core (+ App.tsx, main.tsx — запуск сайта)
dist/       abi7-grid.js, abi7-grid.min.js(.map), abi7-grid.css, abi7-grid.min.css — результат tools/build.js
plugins/    selection/ lightbox/ layout-horizontal/ connected-grids/ (js, css, README, package.json)
examples/   10 примеров + shared/ (photos.js, page.css, theme.js)
docs/       сайт документации: app.js, markdown.js, viewer.js, vfs.js, highlight.js, site.css, pages/*.md
tests/      core.test.js, plugins.test.js, docs.test.js, helpers.js
tools/      build.js (esbuild)
```

## Ограничения

- Только ES-модули; UMD/IIFE и классические `<script>` не поддерживаются.
- Скролл-контейнер — сам элемент грида (`window`/внешние контейнеры, как `grid.scrollbox` в оригинале, не поддерживаются).
- Динамическая высота (`virtualization.measure`) уточняется только для карточек, побывавших в окне.
- Любое изменение в начале списка пересчитывает геометрию ниже (O(n), единицы миллисекунд на 50 000 записей).
- Автоматические тесты не заменяют проверку в реальных браузерах; тестирование на устройствах с касанием не проводилось.

## Лицензия

MIT — см. `LICENSE`. Оригинальный код: Alexander Momot. Подробнее о правах на переработку — в разделе Migration → «Лицензирование».
