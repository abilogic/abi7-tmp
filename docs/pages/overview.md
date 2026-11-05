# ABI7 Grid

**ABI7 Grid** — модульная библиотека на чистом JavaScript для плиточных сеток и фотогалерей: Masonry, Grid, Justified, виртуализация (десятки тысяч карточек), Drag & Drop и система плагинов. Без зависимостей и фреймворков.

Это архитектурная переработка оригинального ABI7 Grid (Alexander Momot, 2023–2024). Полезная функциональность сохранена, а недостатки оригинала исправлены: см. [Migration](#/migration).

> Core состоит ровно из **двух** файлов: `abi7-grid.js` и `abi7-grid.css` (плюс минифицированные `*.min.*`). Всё остальное — плагины — подключается отдельно и только когда нужно.

## Основные возможности

- **Три встроенных layout** — Masonry, Grid, Justified; свои алгоритмы подключаются плагином без изменения Core.
- **Виртуализация, не зависящая от layout** — в DOM только видимые карточки, DOM Pool переиспользует узлы, adaptive overscan, Scroll Anchoring, `scrollToIndex`.
- **Частичный перерасчёт** — вставка или удаление пересчитывает геометрию не с начала, а с изменённой позиции.
- **Плагины** — изолированный Plugin API, автоматическая очистка ресурсов, проверка совместимости и зависимостей.
- **Drag & Drop** — мышь и касание, автопрокрутка, работа с виртуализацией и любым layout.
- **Безопасность по умолчанию** — стандартная карточка строится через DOM API, а URL фильтруются: HTML из данных не исполняется.
- **Корректный `destroy()`** — снимаются все слушатели, observers, таймеры; контейнер возвращается в исходное состояние.

## Архитектура

Главный принцип: каждый компонент отвечает за одну вещь и общается с остальными через узкий интерфейс.

| Компонент | Отвечает за | Не знает о |
|---|---|---|
| Layout Engine | геометрию: где и какого размера каждая карточка | DOM, виртуализации |
| Virtualization Engine | какие карточки должны быть в DOM | конкретном layout |
| DOM Renderer | создание, привязку и переиспользование DOM-узлов | алгоритмах раскладки |
| Plugin Manager | установку плагинов и их безопасный API | внутренних массивах ядра |
| Interaction Manager | клики и Drag & Drop | конкретном layout |

Подробности — на странице [Архитектура Core](#/architecture).

## Быстрый пример

```js
import { ABI7Grid } from './dist/abi7-grid.js';

const grid = new ABI7Grid('#gallery', {
  layout: 'masonry',
  data: photos,            // [{ id, src, width, height }, ...]
  layoutOptions: { gap: 12, minWidth: 180 }
});

grid.on('item:click', (e) => console.log('клик', e.id));
```

## Подключение плагина

```js
import SelectionPlugin from './plugins/selection/selection.js';

grid.use(SelectionPlugin, { multiple: true });
grid.getPlugin('selection').select('photo-1');
```

## Куда дальше

- Начните с [Getting Started](#/getting-started) — первый грид за 5 минут.
- [Layouts](#/layouts) и [Virtualization](#/virtualization) — как это работает и как настроить.
- [Plugins](#/plugins) и [Создание плагина](#/plugin-development) — как расширять библиотеку, не меняя Core.
- [API Reference](#/api-methods) — методы, [события](#/api-events), [опции](#/api-options), [Plugin API](#/api-plugin).
- [Examples](#/examples) — 10 работающих демонстраций с полным кодом.

:::demo basic
