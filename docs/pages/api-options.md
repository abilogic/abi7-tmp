# API Reference: Options

Настройки передаются вторым аргументом конструктора и меняются на лету через `grid.rebuild(patch)`. Вложенные объекты (`layoutOptions`, `virtualization`, `animation`, `interaction`, `fields`) **объединяются** с значениями по умолчанию, поэтому достаточно указать только изменяемые ключи. Неверное значение приводит к `ABI7Error` с `code: 'INVALID_OPTION'`.

Полный набор значений по умолчанию доступен в коде: `ABI7Grid.defaults`.

```js
const grid = new ABI7Grid('#gallery', {
  layout: 'masonry',
  data: photos,
  layoutOptions: { gap: 12, minWidth: 180, maxColumns: 5 },
  virtualization: { enabled: true, overscan: 500 },
  animation: { enabled: true, duration: 300 }
});
```

## Core Options

| Имя | Тип | По умолчанию | Описание |
|---|---|---|---|
| `layout` | `string` | `'masonry'` | Имя алгоритма раскладки: `'masonry'`, `'grid'`, `'justified'` или имя layout-плагина. Если layout ещё не зарегистрирован, грид ждёт регистрации (состояние `pending`). |
| `layoutOptions` | `object` | `{}` | Настройки выбранного layout, см. ниже. Объединяются с `defaults` layout. |
| `data` | `object[]`, `function`, `Promise` | `null` | Данные. Функция получает `{ signal, source }` и возвращает массив или Promise (загрузка с защитой от гонок). `null` — пустой грид, данные добавляются через `insert()` / `setData()`. |
| `fields` | `object` | см. «Data Options» | Откуда брать id, размеры и данные карточки. |
| `padding` | `number` или `{ top, right, bottom, left }` | `0` | Внутренние отступы контента, px. Влияют на ширину, доступную layout. |
| `height` | `number`, `string`, `null` | `null` | Высота контейнера (`number` → px, строка — любое CSS-значение). `null` — высота из CSS (по умолчанию `100%`). Записывается в CSS-переменную `--abi7-height`. |
| `className` | `string` | `''` | Дополнительные классы корневого элемента. |
| `itemClassName` | `string` | `''` | Дополнительные классы каждой карточки. |
| `itemTag` | `string` | `'div'` | Тег элементов карточек. |
| `autoRender` | `boolean` | `true` | `false` — не запускать грид автоматически; запуск вручную через `render()`. |
| `autoResize` | `boolean` | `true` | Следить за размером контейнера через ResizeObserver. При `false` вызывайте `refresh()` сами. |
| `scrollAnchoring` | `boolean` | `true` | Сохранять положение просматриваемого содержимого при вставке выше окна, ресайзе и смене раскладки. |
| `allowHTML` | `boolean` | `false` | Строка, возвращённая из `renderItem`, по умолчанию вставляется как **текст**. `true` — как HTML (ответственность за безопасность на вас). |
| `renderItem` | `function` | `null` | `(record, element, { id, index }) => void`, `Node` или `string`. Заменяет стандартную карточку. Вызывается при каждой привязке элемента к записи — обновляйте содержимое «на месте». |
| `releaseItem` | `function` | `null` | `(record, element, { id, index }) => void` — вызывается, когда элемент отвязывается (освободите таймеры, видео и т. д.). |
| `plugins` | `Array<plugin или [plugin, options]>` | `[]` | Плагины, устанавливаемые при запуске. |

## Layout Options

Опции передаются в `layoutOptions`. Для всех layout, кроме особо отмеченного, `gapX` / `gapY` (если не `null`) переопределяют `gap` по осям.

### Masonry (`layout: 'masonry'`)

| Имя | Тип | По умолчанию | Описание |
|---|---|---|---|
| `gap`, `gapX`, `gapY` | `number` | `12`, `null`, `null` | Отступы между карточками. |
| `columns` | `number` | `0` | Фиксированное число колонок; `0` — автоматически. |
| `minWidth` | `number` | `180` | Минимальная ширина колонки при автоподборе. Чем меньше — тем больше колонок. |
| `maxWidth` | `number` | `0` | Максимальная ширина карточки; `0` — без ограничения. Если карточки упёрлись в предел, блок колонок центрируется (`align`). |
| `maxColumns` | `number` | `0` | Верхний предел колонок; `0` — без предела. |
| `itemHeight` | `number` | `0` | Фиксированная высота всех карточек, px. |
| `aspectRatio` | `number` | `0` | Фиксированное отношение ширины к высоте для всех карточек. |
| `align` | `'center'`, `'start'` | `'center'` | Горизонтальное выравнивание блока колонок. |

Высота карточки определяется по приоритету: измеренная (`virtualization.measure`) → `itemHeight` → `aspectRatio` → aspect ratio записи → высота записи → `virtualization.estimatedHeight`. Каждый следующий источник используется, если предыдущий не задан.

### Grid (`layout: 'grid'`)

| Имя | Тип | По умолчанию | Описание |
|---|---|---|---|
| `gap`, `gapX`, `gapY` | `number` | `12`, `null`, `null` | Отступы. |
| `columns` | `number` | `0` | Фиксированное число колонок; `0` — автоматически. |
| `minWidth` | `number` | `160` | Минимальная ширина ячейки при автоподборе. |
| `width` | `number` | `0` | Фиксированная ширина ячейки (число колонок вычисляется из неё). |
| `maxColumns` | `number` | `0` | Верхний предел колонок при автоподборе. |
| `itemHeight` | `number` | `0` | Фиксированная высота ячейки. |
| `aspectRatio` | `number` | `1` | Отношение ширины к высоте ячейки. `0` — высота берётся из записей (ряд выравнивается по самой высокой). |
| `align` | `'start'`, `'center'` | `'start'` | Выравнивание сетки по горизонтали, если ячейки не занимают всю ширину. |

### Justified (`layout: 'justified'`)

| Имя | Тип | По умолчанию | Описание |
|---|---|---|---|
| `targetRowHeight` | `number` | `240` | Желаемая высота ряда. |
| `minRowHeight` | `number` | `150` | Ряд не будет ниже, если можно избежать. |
| `maxRowHeight` | `number` | `320` | Ряд не будет выше, если можно избежать. |
| `gap`, `gapX`, `gapY` | `number` | `10`, `null`, `null` | Отступы. |
| `lastRow` | `'left'`, `'center'`, `'right'`, `'justify'` | `'left'` | Неполная последняя строка: ряд высотой `targetRowHeight` с выравниванием, либо `'justify'` — растянуть на всю ширину (не выше `maxRowHeight`). |
| `defaultAspect` | `number` | `1.5` | Aspect ratio для записей без размеров. |

### Horizontal (плагин `@abi7/layout-horizontal`)

| Имя | Тип | По умолчанию | Описание |
|---|---|---|---|
| `height` | `number` | `0` | Высота ленты, px; `0` — по высоте контейнера. |
| `gap` | `number` | `12` | Расстояние между карточками. |
| `itemWidth` | `number` | `0` | Фиксированная ширина карточки; `0` — `height × aspect`. |
| `defaultAspect` | `number` | `1.5` | Aspect ratio для записей без размеров. |
| `align` | `'start'`, `'center'` | `'start'` | Вертикальное выравнивание ленты. |

## Virtualization Options

Опции `virtualization`.

| Имя | Тип | По умолчанию | Описание | Влияние на производительность |
|---|---|---|---|---|
| `enabled` | `boolean` | `true` | Монтировать в DOM только видимые карточки + overscan. | `false` создаёт DOM для **каждой** записи — только для небольших наборов. |
| `overscan` | `number` | `400` | Запас в px вокруг окна. | Больше — реже «пустые места» при быстром скролле, но больше DOM-элементов. |
| `adaptiveOverscan` | `boolean` | `true` | Увеличивать запас в сторону движения пропорционально скорости. | Небольшая экономия DOM в покое и защита при быстром скролле. |
| `maxOverscan` | `number` | `1600` | Предел адаптивного запаса. Не меньше `overscan`. | — |
| `poolSize` | `number` | `256` | Сколько неиспользуемых элементов хранить в DOM Pool. | Больше — реже создание узлов, но больше памяти. |
| `measure` | `boolean` | `false` | Высоту карточек определяет содержимое: ядро измеряет их через ResizeObserver и кэширует (Dynamic Size Cache). Поддерживается Masonry и Grid с `aspectRatio: 0`. | Каждый видимый элемент наблюдается ResizeObserver; уточнение высот вызывает частичные перерасчёты. |
| `estimatedHeight` | `number` | `200` | Оценка высоты, пока реальная неизвестна. | Чем точнее оценка, тем меньше сдвигов при измерении. |
| `endThreshold` | `number` | `300` | За сколько px до конца срабатывает `reach:end`. | — |

## Animation Options

Опции `animation`. Анимируются только перестроения (вставка, удаление, перестановка, ресайз, смена настроек), но не прокрутка.

| Имя | Тип | По умолчанию | Описание |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Включить анимацию перестроений. |
| `duration` | `number` | `300` | Длительность, мс. `0` отключает анимацию. |
| `easing` | `string` | `'ease'` | CSS timing-function. |
| `respectReducedMotion` | `boolean` | `true` | Отключать анимацию при `prefers-reduced-motion: reduce`. |

Значения публикуются как CSS-переменные `--abi7-duration` и `--abi7-easing` на корневом элементе.

## Interaction Options

Опции `interaction`.

| Имя | Тип | По умолчанию | Описание |
|---|---|---|---|
| `click` | `boolean` | `true` | Генерировать `item:click`, `item:dblclick`, `item:contextmenu`. |
| `drag.enabled` | `boolean` | `false` | Включить перетаскивание для смены порядка. |
| `drag.handle` | `string`, `null` | `null` | CSS-селектор «ручки»; перетаскивание начинается только с неё. |
| `drag.threshold` | `number` | `5` | Смещение мыши/пера (px) до начала перетаскивания. |
| `drag.delay` | `number` | `220` | Долгое нажатие для касаний, мс. До этого касание = обычная прокрутка. |
| `drag.autoScroll` | `boolean` | `true` | Автопрокрутка у края контейнера. |
| `drag.edge` | `number` | `64` | Ширина зоны автопрокрутки, px. |
| `drag.maxSpeed` | `number` | `22` | Максимальная скорость автопрокрутки, px/кадр. |

`drag.enabled` можно включать на лету: `grid.rebuild({ interaction: { drag: { enabled: true } } })`.

## Data Options

| Имя | Тип | По умолчанию | Описание |
|---|---|---|---|
| `data` | см. Core | `null` | Источник записей. |
| `fields.id` | `string` или `function` | `'id'` | Поле идентификатора (`string` / `number`). Нет значения — ядро присваивает внутренний `abi7-N`. |
| `fields.width`, `fields.height` | `string` или `function` | `'width'`, `'height'` | Размеры записи; если заданы оба — из них вычисляется aspect ratio. Только `height` — используется как высота в px. |
| `fields.aspectRatio` | `string` или `function` | `'aspectRatio'` | Готовое отношение ширины к высоте (приоритетнее `width`/`height`). |
| `fields.src`, `fields.title`, `fields.alt` | `string` или `function` | `'src'`, `'title'`, `'alt'` | Данные стандартной карточки. URL фильтруется: допускаются `http(s):`, `blob:`, `data:image/*` и относительные адреса. |

Поле может быть **функцией** `(record) => value` — так значения вычисляются лениво и не хранятся в памяти для всех записей.

## Plugin Options

Опции плагина передаются в `grid.use(plugin, options)` или в массиве `plugins: [[plugin, options]]`. Ядро объединяет их с `plugin.defaults` и передаёт в `install(api, options)` замороженным объектом.

| Плагин | Опции |
|---|---|
| `selection` | `multiple` (`true`), `className` (`'abi7-selected'`), `toggleOnClick` (`false`), `keyboard` (`true`) |
| `lightbox` | `loop` (`false`), `closeOnBackdrop` (`true`), `keyboard` (`true`), `counter` (`true`), `animation` (`220`), `swipe` (`true`), `getSrc`, `getCaption` |
| `layout-horizontal` | нет (настройки — в `layoutOptions`) |
| `connected-grids` | `group` (`'default'`), `name` (`''`), `copy` (`false`), `accept`, `overClass` (`'abi7-connected-over'`) |

## CSS-переменные корневого элемента

| Переменная | По умолчанию | Описание |
|---|---|---|
| `--abi7-height` | `100%` | Высота контейнера (задаётся опцией `height`). |
| `--abi7-item-bg` | `#e5e7eb` | Фон карточки до загрузки изображения. |
| `--abi7-item-radius` | `6px` | Скругление карточки. |
| `--abi7-caption-color` | `#fff` | Цвет подписи. |
| `--abi7-focus` | `#4c8bf5` | Цвет обводки фокуса. |
| `--abi7-drag-shadow` | `0 12px 28px rgba(0,0,0,.28)` | Тень перетаскиваемой карточки. |
| `--abi7-duration`, `--abi7-easing` | `300ms`, `ease` | Анимация (выставляются ядром). |
