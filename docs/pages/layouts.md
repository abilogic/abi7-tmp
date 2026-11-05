# Layouts

Layout — алгоритм, который по записям и ширине контейнера считает положение и размер каждой карточки. Выбирается опцией `layout`, настраивается `layoutOptions`, переключается на лету: `grid.rebuild({ layout: 'justified' })`.

Все layout возвращают геометрию в одном формате:

```js
{ id: 'photo-123', index: 0, x: 0, y: 0, width: 240, height: 180, right: 240, bottom: 180 }
```

Получить её можно так: `grid.getItem('photo-123').rect`.

## Masonry

Карточки одинаковой ширины укладываются в колонки; каждая новая карточка идёт в **самую короткую колонку**. Высота определяется данными (aspect ratio / высота записи), так что картинка не нужна, чтобы посчитать раскладку.

**Алгоритм.**

1. Число колонок: `columns`, иначе `floor((W + gap) / (minWidth + gap))`, ограниченное `maxColumns`.
2. Ширина: `floor((W − gap·(cols−1)) / cols)`, но не больше `maxWidth`; блок колонок центрируется (`align`).
3. Для каждой карточки из `from`: выбрать колонку с минимальной высотой, записать `x/y`, увеличить высоту колонки.
4. Каждые 128 карточек сохраняется снимок высот колонок. Частичный перерасчёт начинается с ближайшего снимка, а не с начала.

```js
new ABI7Grid('#g', { layout: 'masonry', data,
  layoutOptions: { gap: 12, minWidth: 180, maxColumns: 5 } });
```

:::demo masonry

## Grid

Классическая сетка: ячейки одной ширины, ряд выравнивается по высоте. Колонки — `columns` (фиксированно), `width` (фиксированная ширина ячейки) или автоматически по `minWidth`. Высота — `aspectRatio` (по умолчанию `1`), `itemHeight`, либо `aspectRatio: 0` — тогда берётся из записей (ряд выравнивается по самой высокой). Позиция ячейки вычисляется арифметически, поэтому перерасчёт очень быстрый; для частичного пересчёта хранятся верхние границы рядов.

```js
new ABI7Grid('#g', { layout: 'grid', data,
  layoutOptions: { columns: 4, gap: 12, aspectRatio: 1.5 } });
```

:::demo grid

## Justified

Фотогалерея с рядами одинаковой высоты и разной шириной карточек (как в Flickr / Google Photos).

**Алгоритм.** Карточки добавляются в ряд, пока ряд, масштабированный до ширины контейнера, не станет ниже `targetRowHeight`. Затем выбирается лучший вариант: **с** последней карточкой или **без** неё — тот, чья высота ближе к цели, с учётом границ `minRowHeight` / `maxRowHeight`. Высота ряда подбирается так, чтобы ряд **точно** заполнил ширину: `h = (W − gap·(n−1)) / Σ aspect`. Ширины округляются накопительно, а правая граница последней карточки ряда равна `W` — перекрытий и щелей нет.

Последняя (неполная) строка не растягивается: она получает `targetRowHeight` и выравнивается по `lastRow` (`left`, `center`, `right`) либо растягивается (`justify`, но не выше `maxRowHeight`). Догрузка данных (`insert` в конец) пересчитывает только последний ряд и новые.

```js
new ABI7Grid('#g', { layout: 'justified', data,
  layoutOptions: { targetRowHeight: 240, minRowHeight: 150, maxRowHeight: 320, gap: 10, lastRow: 'left' } });
```

:::demo justified

## Horizontal (плагин)

Горизонтальная лента: карточки одной высоты и разной ширины (`ширина = высота × aspect`), прокрутка по горизонтали. Подключается плагином `@abi7/layout-horizontal` — Core о нём ничего не знает; это и есть пример стороннего layout.

```js
import HorizontalLayout from './plugins/layout-horizontal/horizontal.js';

const grid = new ABI7Grid('#strip', { layout: 'horizontal', data,
  layoutOptions: { height: 200, gap: 12 } });
grid.use(HorizontalLayout);              // или ABI7Grid.registerLayout('horizontal', HorizontalLayout)
```

Имя layout можно указать до подключения плагина: грид перейдёт в состояние `pending` и продолжит запуск, как только layout появится. Если плагин отключить (`grid.unuse('layout-horizontal')`), грид вернётся на `masonry` и сообщит об этом событием `error` (`LAYOUT_REMOVED`).

:::demo horizontal

## Изменение размеров и aspect ratio

- Изменение размера контейнера (ResizeObserver) вызывает полный перерасчёт — `layout:end` с `reason: 'resize'`.
- Изменение aspect ratio / размеров записи: `grid.update(id, { width, height })` — перерасчёт начинается с этой записи.
- Layout, зависящие только от ширины (`responsive: 'width'`), не пересчитываются при изменении высоты контейнера.

## Свой layout

Layout — объект с методом `compute(ctx)`. Полный контракт и пример — в разделе [Layout API](#/api-plugin/layout-api).
