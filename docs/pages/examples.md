# Examples

Каждый пример — **настоящий ABI7 Grid** (тот же `dist/abi7-grid.js`), запущенный в iframe. Код во вкладках — это те же файлы, что исполняются в демонстрации: расхождений быть не может. Файлы лежат в `examples/<имя>/` и работают и как самостоятельные страницы (через любой статический сервер: `examples/basic/index.html`).

Общий файл `examples/shared/photos.js` создаёт тестовые данные и SVG-«фотографии» (внешних картинок нет, всё работает офлайн) — он показан во вкладке `photos.js` каждого примера.

Список: [Basic](#/examples/basic), [Masonry](#/examples/masonry), [Grid](#/examples/grid), [Justified](#/examples/justified), [Virtualization](#/examples/virtualization), [Selection](#/examples/selection), [Lightbox](#/examples/lightbox), [Horizontal](#/examples/horizontal), [Connected Grids](#/examples/connected-grids), [Custom Plugin](#/examples/custom-plugin).

## Basic

**Задача:** создать грид несколькими строками и реагировать на клик.

:::demo basic

- **Методы:** конструктор, `on()`.
- **Настройки:** `layout`, `data`, `fields.src` (функция), `layoutOptions.gap/minWidth/maxColumns`.
- **События:** `item:click` (делегирование, один слушатель на контейнер), `ready` (после первой раскладки).
- **Что изменить:** замените `layout` на `'grid'` или `'justified'`; передайте реальные `src` вместо функции `photoSrc`; добавьте `layoutOptions.maxWidth`.

## Masonry

**Задача:** динамический список — добавление, удаление, перерасчёт и смена настроек раскладки.

:::demo masonry

- **Методы:** `insert(item, { at: 'start' })`, `remove(id)`, `refresh()`, `rebuild({ layoutOptions })`, `getItems()`, `getState()`.
- **Настройки:** `layoutOptions.gap`, `minWidth`, `maxColumns`; `animation.duration`.
- **События:** `layout:end` (число колонок, длительность, `from` — с какого индекса пересчитано), `item:insert`, `item:remove`, `item:click`.
- **Что наблюдать:** при добавлении в начало `from` = 0, при удалении последней карточки — большой `from` (частичный перерасчёт).
- **Что изменить:** вставка в конец (`at: 'end'`); `layoutOptions.columns: 3`; `animation.enabled: false`.

## Grid

**Задача:** классическая сетка с настройкой колонок, пропорций и отступов на странице.

:::demo grid

- **Методы:** `rebuild({ layoutOptions })` — единственный способ применить новые настройки.
- **Настройки:** `columns` (0 — автоматически по `minWidth`), `aspectRatio`, `gap`, `minWidth`.
- **События:** `layout:end` с `info.columns`, `info.rows`, `info.itemWidth`.
- **Что изменить:** `layoutOptions.width: 200` (фиксированная ширина ячейки), `align: 'center'`, `gapX` / `gapY` по отдельности.

## Justified

**Задача:** ряды одинаковой высоты и разной ширины, как в фотохостингах.

:::demo justified

- **Методы:** `rebuild()`, `getVisibleItems()`, `getState().layoutInfo`.
- **Настройки:** `targetRowHeight`, `minRowHeight`, `maxRowHeight`, `gap`, `lastRow` (`left` / `center` / `right` / `justify`).
- **События:** `layout:end`, `scroll:stop`.
- **Что наблюдать:** у карточек видимых рядов совпадают `rect.height`; суммарная ширина ряда равна ширине контейнера, кроме последней строки.
- **Что изменить:** слишком узкий диапазон min/max заставит layout пожертвовать точностью высоты, но не заполнением ширины.

## Virtualization

**Задача:** показать 1 000 – 50 000 карточек и увидеть, сколько DOM-узлов реально создано.

:::demo virtualization

- **Методы:** `setData()`, `rebuild({ virtualization })`, `scrollToIndex()`, `getState().virtualization`.
- **Настройки:** `virtualization.overscan`, `adaptiveOverscan`, `maxOverscan`, `poolSize`.
- **События:** `viewport:update`, `scroll:stop`.
- **Что наблюдать:** при любом размере массива «в документе» остаётся десятки узлов; `created` не растёт при долгой прокрутке, а `reused` — растёт; при быстрой прокрутке `overscan` после/до увеличивается (adaptive).
- **Что изменить:** `virtualization.enabled: false` на 1 000 карточках (все в DOM) для сравнения.

## Selection

**Задача:** выделение карточек кликом, с модификаторами и программно.

:::demo selection

- **Подключение:** `grid.use(SelectionPlugin, { multiple: true })`, доступ — `grid.getPlugin('selection')`.
- **Методы плагина:** `select`, `deselect`, `toggle`, `clear`, `selectAll`, `getSelected`, `getSelectedItems`, `isSelected`, `count`.
- **События:** `selection:change` (`selected`, `added`, `removed`, `source`).
- **Что наблюдать:** выделение остаётся на карточке при прокрутке и возврате — класс привязан к id, а не к DOM-узлу.
- **Что изменить:** `{ multiple: false }`; `{ toggleOnClick: true }`; своё имя класса через `className`.

## Lightbox

**Задача:** открыть фотографию поверх грида, листать, закрывать.

:::demo lightbox

- **Подключение:** `grid.use(LightboxPlugin, { loop, animation, getSrc, getCaption })`.
- **Методы плагина:** `open(id)`, `close()`, `next()`, `prev()`, `isOpen()`, `current()`.
- **События:** `lightbox:before-open` (отменяемое), `lightbox:open`, `lightbox:change`, `lightbox:close`.
- **Клавиатура:** Escape, ←, →, Home, End. Мобильные: свайп влево/вправо. Закрытие: крестик, фон, Escape.
- **Что изменить:** `animation: 0`; `closeOnBackdrop: false`; в `getSrc` — реальный URL оригинала.

## Horizontal

**Задача:** горизонтальная лента из 3 000 карточек разной ширины.

:::demo horizontal

- **Подключение:** `grid.use(HorizontalLayout)` (layout-плагин); `layout: 'horizontal'` указан до подключения — грид ждёт регистрации.
- **Методы:** `rebuild({ layoutOptions })`, `scrollToIndex(i, { align: 'center' })`, `getState().contentWidth`.
- **Настройки:** `layoutOptions.height`, `gap`, `itemWidth`.
- **Что наблюдать:** общая ширина — миллионы пикселей, а в DOM — десятки карточек; `scrollLeft` меняется, `scrollTop` — нет.
- **Что изменить:** `itemWidth: 160` (одинаковая ширина), `align: 'center'`.

## Connected Grids

**Задача:** перенос карточек между двумя независимыми гридами.

:::demo connected-grids

- **Подключение:** `use(ConnectedGrids, { group, name })` на **каждом** гриде группы; плагин проверяет совместимость (major-версия ядра, `fields.id`, уникальность `name`).
- **Методы плагина:** `transfer(id, targetName, { at })`, `members()`.
- **События:** `connected-grids:before-transfer` (отменяемое), `connected-grids:transfer`, `connected-grids:receive`; ядро: `drag:start`, `drag:move`, `drag:end`, `item:insert`, `item:remove`.
- **Что происходит при переносе:** `drag:end` с `outside: true` → плагин находит грид под указателем → `remove` в источнике и `insert` в приёмнике (оба пересчитываются) → события.
- **Что изменить:** `copy: true`; `accept: (record) => record.title !== 'Photo 3'`.

## Custom Plugin

**Задача:** написать плагин с нуля — `CounterPlugin`, считающий клики по карточкам. Подробный разбор по 17 пунктам — в разделе [Создание плагина](#/plugin-development/разбор-по-пунктам).

:::demo custom-plugin

- **Подключение:** `grid.use(CounterPlugin, { step: 1, badges: true })`, `grid.unuse('counter')`.
- **Методы плагина:** `getTotal()`, `getCount(id)`, `top(n)`, `reset()`.
- **События плагина:** `counter:change`, `counter:reset`.
- **Что изменить:** `{ step: 5 }`, `{ badges: false }`, `filter: (record) => record.title !== 'Photo 1'`.
