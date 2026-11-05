# Архитектура Core

Core — один файл `abi7-grid.js`, организованный в логические секции. Внутри — классы и функции, снаружи — один класс `ABI7Grid`.

## Секции файла

| № | Секция | Назначение |
|---|---|---|
| 1 | Utilities | вспомогательные функции, `ABI7Error`, `PluginError`, `mergeOptions`, `safeUrl`, semver |
| 2 | EventEmitter | шина событий; ошибки обработчиков не прерывают остальных |
| 3 | OptionsManager | значения по умолчанию, объединение, валидация |
| 4 | DataStore | записи, массив id, `Map id → индекс` |
| 5 | GeometryStore | координаты в `Float64Array`, пространственный индекс |
| 6 | Layout Engine | `LayoutRegistry`, `LayoutManager`, Masonry, Grid, Justified |
| 7 | VirtualizationEngine | какие индексы показать |
| 8 | DOMRenderer | DOM элементов и DOM Pool |
| 9 | AnimationManager | CSS-transition на время перестроения |
| 10 | PluginManager | установка плагинов, Plugin API |
| 11 | InteractionManager | клики и Drag & Drop |
| 12 | LifecycleManager | `AbortController`, таймеры, `requestAnimationFrame` |
| 13 | GridInstance | внутренний «двигатель» — связывает все компоненты |
| 14 | Public API | класс `ABI7Grid` (тонкий фасад) |

## Поток данных

```text
данные (DataStore)
   │  insert / remove / update / move / setData
   ▼
invalidate(from, reason) ──► requestAnimationFrame ──► runLayout()
                                                         │
          LayoutManager.compute(from) ◄──────────────────┘
                   │  ctx.set(i, x, y, w, h)
                   ▼
          GeometryStore (+ пространственный индекс)
                   │
                   ▼
          VirtualizationEngine.select()  ──► индексы окна + overscan + pinned
                   │
                   ▼
          DOMRenderer.sync()  ──► mount / unmount / DOM Pool ──► DOM
```

1. Любое изменение данных вызывает `invalidate(from, reason)` — геометрия начиная с индекса `from` помечается устаревшей. Несколько вызовов за кадр объединяются.
2. В ближайшем кадре `runLayout()` вызывает layout с `ctx.from`. Layout записывает координаты через `ctx.set()`. Для Masonry используются контрольные точки высот колонок через каждые 128 элементов, для Grid — верхние границы рядов, для Justified — список уже сформированных рядов: перерасчёт начинается с места изменения.
3. Из геометрии перестраивается пространственный индекс (корзины по главной оси).
4. Virtualization Engine запрашивает у индекса элементы, пересекающие окно + overscan, и добавляет закреплённые.
5. DOM Renderer сравнивает этот набор с уже смонтированным: лишнее уходит в пул, недостающее берётся из пула (или создаётся) и привязывается к записи.

## Границы ответственности

- **Layout Engine ↔ всё остальное.** Layout получает `ctx` (размеры, `aspect()`, `resolveHeight()`, `rect()`, `set()`) и возвращает размер контента. DOM, виртуализация и массивы ядра ему недоступны.
- **Virtualization ↔ Layout.** Виртуализация видит только прямоугольники в `GeometryStore` и ось прокрутки. Поэтому она одинаково работает для Masonry, Grid, Justified, горизонтальной ленты и любых пользовательских layout.
- **Renderer ↔ плагины.** Плагин не получает DOM карточек напрямую: он работает через `api.renderer` (`toggleClass`, `getElement`, события `item:mount` / `item:unmount`).
- **Plugin Manager ↔ ядро.** Плагин видит замороженный `api` из девяти интерфейсов; массивов `DataStore` и `GeometryStore` у него нет — только копии и методы.

## Жизненный цикл

```text
new ABI7Grid()  ──►  microtask: _start()  ──►  data:load-start/end  ──►  layout  ──►  ready
      │                    │                                                     │
   use(plugin)        слушатели, observers                                  рабочее состояние
                                                                                  │
                                                          destroy(): events → плагины → drag → observers
                                                                     → DOM → AbortController → контейнер
```

Состояния `phase`: `new` → `loading` → (`pending`, если layout ещё не зарегистрирован) → `ready` → `destroyed`. Если контейнер скрыт (ширина 0), первая раскладка ждёт появления размера.

## Решения, о которых стоит знать

| Решение | Причина |
|---|---|
| Один `click`-слушатель на контейнер | Оригинал вешал 5–7 слушателей на каждую карточку. |
| Геометрия в `Float64Array` | Компактно и быстро для десятков тысяч элементов, нет аллокаций на элемент. |
| Пространственный индекс «корзины по оси» | Запрос окна — O(k), не зависит от layout, не требует `getBoundingClientRect()` на каждый скролл (как в оригинале). |
| DOM Pool | Создание узлов дорогое; при прокрутке узлы выпавших карточек сразу получают новые данные. |
| Анимация только на время перестроения | Иначе переиспользуемые узлы «летали» бы по экрану при прокрутке. |
| `scrollbar-gutter: stable` | Появление скроллбара не меняет ширину контента, поэтому нет цикла resize → layout → resize; дополнительно есть предохранитель (не более 10 resize-перерасчётов за 500 мс). |
| Переиспользуемые узлы + `renderer.toggleClass` | Классы плагинов привязаны к **id записи**, а не к узлу — выделение не «перескакивает» на другую карточку. |
| Плагины не импортируют Core | Плагин зависит только от контракта (`api`), поэтому не ломается при переработке Core. |

## Публичный API в одном взгляде

```js
// Lifecycle:  render() refresh() rebuild(options) reload() destroy() flush() whenReady()
// Data:       data() setData(list) load(source) insert(items, {at}) remove(id) update(id, patch) move(id, to) getCount()
// Items:      getItem(id) getItems() getVisibleItems()
// Navigation: scrollToIndex(i, opts) scrollToItem(id, opts)
// Plugins:    use(plugin, opts) unuse(name) getPlugin(name) hasPlugin(name) getPlugins()
// Events:     on(name, fn) once(name, fn) off(name, fn)
// State:      getState() isDestroyed()
// Static:     ABI7Grid.registerLayout() unregisterLayout() getLayouts() fromLegacyOptions()
```

Подробно — в [API Reference](#/api-methods).

## Ограничения текущей версии

- Скролл-контейнером всегда является сам элемент грида (прокрутка `window` и внешних контейнеров, как `grid.scrollbox` в оригинале, не поддерживается).
- Один layout-проход обрабатывает все записи ниже `from` целиком: для 50 000 записей это единицы миллисекунд, но это O(n) на изменение в начале списка.
- Динамическая высота (`virtualization.measure`) уточняется только для карточек, побывавших в окне; высоты ещё не показанных карточек — оценка (`estimatedHeight`).
- Drag & Drop меняет порядок записей в самом гриде; сохранение порядка — задача приложения.
- Классические `<script>`-теги и UMD-сборка не реализованы (только ES-модули).
