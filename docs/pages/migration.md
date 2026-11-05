# Migration: со старого ABI7 Grid на новый

Оригинальные файлы сохранены без изменений в `original/abi7-grid.js` и `original/abi7-grid.css` (автор — Alexander Momot).

## Что было в оригинале

Старая версия — один класс `abi7_grid_custom` с публичной «оболочкой» `abi7_grid`, экспортирующей семь методов: `data`, `itemInsert`, `items`, `rebuild`, `refresh`, `render`, `reload`. Фиксированный пул DOM-элементов (`itemsCount`), Masonry-раскладка, ленивая подгрузка данных блоками (`funcLoadData`), встроенное выделение, Drag & Drop и ~25 колбэков в `options.events`.

## Результаты аудита: ошибки и недостатки

| № | Проблема в оригинале | Как решено |
|---|---|---|
| 1 | `toggleClass`: проверка `typeof add === 'undefined'` (переменной `add` нет) — параметр `force` игнорировался, класс всегда переключался | Классы управляются через `renderer.toggleClass(id, cls, force)` с явным состоянием |
| 2 | `sortStart`: в таймере используется необъявленная переменная `item` → `ReferenceError` при включённом `onSortStart` | Drag & Drop переписан; `drag:start` получает данные из состояния сессии |
| 3 | `data()` после загрузки вызывает `onDataLoadStart` вместо `onDataLoadEnd` | События `data:load-start` / `data:load-end` строго парные |
| 4 | Событие объявлено как `onCalcSize`, а вызывается `onSizeCalc` — обработчик не срабатывал | Размеры доступны в `layout:end` (`info`) и `getState()` |
| 5 | `getItems()` вызывает `getBoundingClientRect()` для каждого элемента при каждом обновлении прокрутки (принудительный layout, O(n) на кадр) | Пространственный индекс по геометрии, ноль чтений DOM-размеров при скролле |
| 6 | `findNextPos` для каждой карточки сканирует предыдущие, `recalcItems` — O(n·колонки) на каждое изменение; `Math.max.apply` на больших массивах | Контрольные точки высот колонок; частичный перерасчёт с изменённой позиции |
| 7 | Нет `destroy()`: `window.resize`, `IntersectionObserver`, `ResizeObserver`, слушатели элементов не снимаются | `destroy()` + `AbortController`, отключение observers, возврат контейнера |
| 8 | `load(html)` пишет `innerHTML` из пользовательских данных (XSS) | Стандартная карточка строится DOM API; URL фильтруются; `allowHTML` по умолчанию `false` |
| 9 | `mousewheel` (устаревшее) и непассивный `scroll`-слушатель с `preventDefault`; прокрутка блокируется на время перестроения | Пассивный `scroll`, обработка раз в кадр |
| 10 | Перерасчёт через `setTimeout(…, 250)` и `animation(..., duration + 50)`; состояния `BUILD/NORMAL` блокируют любые вызовы (`stateIsNormal()` молча выходит) — команды теряются | Все изменения копятся и объединяются в один кадр; вызовы не теряются |
| 11 | `click`-обработчик вызывает `preventDefault()` безусловно | `item:click` отменяем явно (`event.preventDefault()`) |
| 12 | `Math.min.apply(null, [])` = `Infinity` в `refresh()` при пустом экране → обращение к `undefined` | Пустой набор и один элемент покрыты тестами |
| 13 | Конфигурация объединяется на один уровень вглубь; нет проверки значений | Глубокое объединение, валидация, `ABI7Error` с кодами |
| 14 | Исключения — строки (`throw 'Invalid element parameter'`) | `ABI7Error` / `PluginError` с `code` |
| 15 | Нет защиты от гонок при асинхронной загрузке (`res.then(func)`) | Токен загрузки + `AbortController`, устаревшие ответы игнорируются |
| 16 | Drag & Drop завершается на `mouseout` (случайное завершение при выходе курсора за карточку), зависит от DOM-пересечений и от Masonry | Pointer Events, перетаскивание завершается только `pointerup`/`cancel`/Escape; позиция — по геометрии, независимо от layout |
| 17 | Выделение, drag и «центр экрана» встроены в Core | Выделение — плагин; ненужное из Core убрано |
| 18 | CSS: `overflow-*: !important`, глобальное правило `.abi7-grid *` (сброс `margin/padding` для всего содержимого), `transform: translateY(-1px)` на всех детях | CSS изолирован: только `.abi7-*`, без сбросов, без `!important` |

## Таблица соответствия API

| Старый API | Новый API | Статус |
|---|---|---|
| `new abi7_grid(el, options)` | `new ABI7Grid(el, options)` | Изменён (опции, см. ниже; `ABI7Grid.fromLegacyOptions()` конвертирует) |
| `data()` | `data()` / `getItems()` | Сохранён (возвращает копию массива записей) |
| `data(array)` | `data(array)` / `setData(array)` | Сохранён |
| `itemInsert(data, fdone)` | `insert(data, { at })` | Заменён (`itemInsert` оставлен как устаревший: вставка в начало) |
| *(нет)* | `remove(id)`, `update(id, patch)`, `move(id, to)` | Новый (в старой версии `item.remove()` был методом элемента) |
| `items()` | `getItems()`, `getItem(id)`, `getVisibleItems()` | Заменён (`items()` оставлен как устаревший алиас) |
| `rebuild(options, fdone)` | `rebuild(options)` | Сохранён (callback поддерживается, но устарел) |
| `refresh(fdone)` | `refresh()` | Сохранён |
| `reload(fdone)` | `reload()` → `Promise` | Сохранён |
| `render(fdone)` | `render()` / `whenReady()` | Сохранён |
| `item.data(name, value)` | `getItem(id).data`, `update(id, patch)` | Заменён |
| `item.addClass()/removeClass()/toggleClass()` | Плагин `selection`; `api.renderer.toggleClass()` в плагинах | Заменён |
| `item.load(html)` | `renderItem(record, element)` | Заменён |
| `item.height(v)`, `item.aspectRatio(v)` | поля записи `height`, `aspectRatio` + `update(id, patch)` | Заменён |
| `item.remove()` | `remove(id)` | Заменён |
| `options.events.onXxx` | `grid.on(eventName, fn)` | Заменён (таблица ниже) |
| `funcLoadData` / `dataBlockSize` | `data: ({ signal }) => Promise`, `load()`, `reach:end` + `insert()` | Заменён |
| `funcItemLoad` | `renderItem` или стандартная карточка | Заменён |
| `funcItemCalc` | поля `width`/`height`/`aspectRatio` или `virtualization.measure` | Заменён |
| `grid.scrollbox` | — | Удалён (скролл-контейнер — сам элемент) |
| Дочерние элементы контейнера как карточки | `data` + `renderItem` (может вернуть `Node`) | Удалён |

## Изменения настроек

| Старая настройка | Новая |
|---|---|
| `items.minWidth` / `items.maxWidth` / `maxColumns` | `layoutOptions.minWidth` / `maxWidth` / `maxColumns` |
| `space.cols` / `space.rows` | `layoutOptions.gapX` / `gapY` (или `gap`) |
| `items.aspectRatio` / `items.height` | `layoutOptions.aspectRatio` / `itemHeight` |
| `padding` | `padding` |
| `animation.enable` / `duration` / `function` | `animation.enabled` / `duration` / `easing` |
| `items.sortable` / `sortStartDelay` | `interaction.drag.enabled` / `delay` |
| `grid.height` | `height` |
| `grid.htmlTag` / `items.htmlTag` | `itemTag` (внутренний контейнер всегда `div`) |
| `grid.scrollbar: false` | CSS: `scrollbar-width: none` на контейнере |
| `items.multiSelect`, `classSelected` | плагин `selection` |
| `items.classCenter`, `classVisible` | события `item:visible` / `item:hidden` (классы — `api.renderer.toggleClass` в плагине) |
| `itemsCount`, `dataBlockSize` | не нужны — размер пула определяется виртуализацией (`poolSize`) |
| `autoRender` | `autoRender` |

## Таблица событий

| Старый колбэк | Новое событие |
|---|---|
| `onReady` | `ready` |
| `onResize` | `resize` / `layout:end` (`reason: 'resize'`) |
| `onScroll` / `onScrollEnd` | `scroll` / `scroll:stop` |
| `onBof` / `onEof` | `reach:end` (начало списка — по `scroll` и `scrollTop === 0`) |
| `onDataLoadStart` / `onDataLoadEnd` | `data:load-start` / `data:load-end` |
| `onItemClick` / `onItemDblClick` / `onItemContextMenu` | `item:click` / `item:dblclick` / `item:contextmenu` |
| `onItemInsert` / `onItemDelete` | `item:insert` / `item:remove` |
| `onItemEnter` / `onItemExit` / `onItemVisibility` | `item:visible` / `item:hidden` |
| `onItemLoaded` | `item:mount` |
| `onSortStart` / `onSortEnd` | `drag:start` / `drag:end` (+ `item:move`) |
| `onChangeVisible` | `visibility:change` |
| `onCalcSize` / `onSizeCalc` | `layout:end` (`info`) |
| `onChangeDirection` | `scroll` (поле `direction`) |
| `onItemCenterEnter/Exit`, `onItemMouseEnter/Leave` | удалены (используйте CSS `:hover` и события DOM) |

## Новые возможности

Layout Justified; система плагинов и Layout API; DOM Pool с настоящим переиспользованием; частичный перерасчёт; adaptive overscan; Scroll Anchoring; `scrollToIndex` без создания DOM; закреплённые элементы; Dynamic Size Cache; `destroy()`; асинхронная загрузка с отменой; `update/remove/move`; Pointer Events (мышь и касание) для Drag & Drop с автопрокруткой; минифицированная сборка с source map.

## Миграция кода

Было:

```js
const grid = new abi7_grid('#g', {
  maxColumns: 4,
  items: { minWidth: 160, maxWidth: 260, sortable: true },
  space: { cols: 8, rows: 8 },
  data: photos,
  funcItemLoad: (g, item, data) => item.body.innerHTML = '<img src="' + data.src + '">',
  events: { onReady: (g) => console.log('ready'), onItemClick: (g, item) => console.log(item.index) }
});
grid.itemInsert({ abi7height: 300, src: 'a.jpg' });
```

Стало:

```js
const grid = new ABI7Grid('#g', {
  data: photos,                                     // у записей теперь должны быть id и width/height
  layoutOptions: { maxColumns: 4, minWidth: 160, maxWidth: 260, gapX: 8, gapY: 8 },
  interaction: { drag: { enabled: true } }
});
grid.on('ready', () => console.log('ready'));
grid.on('item:click', (e) => console.log(e.index));
grid.insert({ id: 'new', width: 200, height: 300, src: 'a.jpg' }, { at: 'start' });
```

Для автоматического переноса настроек:

```js
const { options, unmapped } = ABI7Grid.fromLegacyOptions(oldOptions);
console.log(unmapped);                  // что придётся перенести вручную (события, funcItemLoad…)
const grid = new ABI7Grid('#g', { ...options, data: photos });
```

Поле `abi7height` → `height`, `abi7aspectRatio` → `aspectRatio` (или задайте `fields: { height: 'abi7height', aspectRatio: 'abi7aspectRatio' }` и данные менять не придётся).

## Лицензирование

В оригинальных файлах указан только автор (`@ Author: Alexander Momot`), лицензия не указана. Новая версия сохраняет авторство в заголовках и распространяется по лицензии **MIT** от имени того же автора (см. `LICENSE`). Право на переработку и выбор лицензии принадлежит автору оригинала: если проект передаётся третьим лицам, подтвердите выбор лицензии письменно. Файлы `original/` оставлены без изменений.
