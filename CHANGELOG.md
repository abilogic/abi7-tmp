# Changelog

## 1.0.0

Архитектурная переработка оригинального ABI7 Grid.

### Добавлено
- Core из двух файлов (`abi7-grid.js`, `abi7-grid.css`) + минифицированные версии и source map (`node tools/build.js`).
- Layout Engine с единым контрактом; встроенные Masonry, Grid, Justified; Layout API для плагинов.
- Виртуализация, независимая от layout: пространственный индекс, DOM Pool, overscan / adaptive overscan, Scroll Anchoring, `scrollToIndex`, закреплённые элементы, Dynamic Size Cache.
- Система плагинов: Plugin API (`events`, `layouts`, `features`, `data`, `geometry`, `viewport`, `renderer`, `options`, `lifecycle`), проверка контракта, совместимости и зависимостей, откат при ошибке установки, автоматическая очистка.
- Плагины: `selection`, `lightbox`, `layout-horizontal`, `connected-grids`.
- Drag & Drop на Pointer Events (мышь/касание), автопрокрутка.
- Методы `remove`, `update`, `move`, `load`, `whenReady`, `flush`, `getItem`, `getVisibleItems`, `scrollToIndex`, `scrollToItem`, `getState`, `destroy`.
- Асинхронная загрузка данных с защитой от гонок (`AbortController`).
- `ABI7Grid.fromLegacyOptions()` для миграции настроек.
- Сайт документации с живыми примерами, просмотрщиком кода и полным API Reference.

### Исправлено относительно оригинала
См. таблицу «Результаты аудита» на странице Migration (18 пунктов): `toggleClass` без `force`, `ReferenceError` в `sortStart`, неверные события `onDataLoadEnd` / `onCalcSize`, чтение `getBoundingClientRect` для каждого элемента на каждый скролл, отсутствие `destroy()` и утечки слушателей/observers, XSS через `innerHTML`, завершение drag по `mouseout`, глобальные CSS-сбросы и `!important` и др.

### Изменено
- Публичный API и настройки: см. таблицы соответствия в Migration. Старые `itemInsert()` и `items()` оставлены как устаревшие алиасы.

### Удалено
- `grid.scrollbox`, дочерние элементы контейнера как карточки, события наведения/центра экрана, встроенное выделение (теперь плагин).
