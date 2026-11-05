# Plugins

Core намеренно маленький. Всё, что не нужно каждому, — выделение, просмотрщик, перенос между гридами, дополнительные layout — живёт в **плагинах**: отдельных файлах, которые подключаются только при необходимости и не требуют изменения Core.

## Архитектура плагинов

- **Plugin object** — обычный объект: `name`, `version`, `apiVersion`, `install(api, options)`.
- **Plugin API** (`api`) — единственная точка общения с ядром: девять интерфейсов `events`, `layouts`, `features`, `data`, `geometry`, `viewport`, `renderer`, `options`, `lifecycle`. Он заморожен, не раскрывает внутренние массивы ядра и «закрывается» после отключения плагина.
- **Изоляция экземпляров** — состояние плагина живёт в замыкании `install()`. Один и тот же плагин на двух гридах — два независимых экземпляра.
- **Автоматическая очистка** — подписки, features, layout и закрепления, сделанные через `api`, снимаются при `unuse()` и `destroy()` без участия автора плагина.

```text
grid.use(plugin, options)
   ├─ проверка контракта (name, version, apiVersion, install)
   ├─ проверка совместимости apiVersion ↔ версия API ядра
   ├─ проверка зависимостей и повторного подключения
   ├─ создание изолированного api
   ├─ plugin.install(api, mergedOptions)   ← плагин регистрирует подписки, методы, layout
   └─ событие plugin:install
```

## Установка и отключение

```js
import SelectionPlugin from './plugins/selection/selection.js';

grid.use(SelectionPlugin, { multiple: true });     // установка (можно цепочкой)
grid.hasPlugin('selection');                        // true
grid.getPlugin('selection').select('photo-1');      // публичный интерфейс плагина
grid.getPlugins();                                  // [{ name, version, apiVersion, options }]
grid.unuse('selection');                            // отключение: очистка → снятие подписок → событие
```

Плагины можно передать и в конструктор: `plugins: [SelectionPlugin, [LightboxPlugin, { loop: true }]]`. Несколько плагинов работают одновременно; при `destroy()` все они освобождаются в обратном порядке установки.

## Готовые плагины

| Пакет | Файлы | Что делает |
|---|---|---|
| `@abi7/selection` | `plugins/selection/selection.js`, `selection.css` | Клик, Ctrl/Cmd, Shift-диапазон, `selectAll`, `clear`, события |
| `@abi7/lightbox` | `plugins/lightbox/lightbox.js`, `lightbox.css` | Просмотр поверх грида: клавиатура, свайп, анимация |
| `@abi7/layout-horizontal` | `plugins/layout-horizontal/horizontal.js` | Layout «горизонтальная лента» |
| `@abi7/connected-grids` | `plugins/connected-grids/connected-grids.js`, `connected-grids.css` | Перенос карточек между гридами |

### Selection

:::demo selection

### Lightbox

:::demo lightbox

### Connected Grids

:::demo connected-grids

## Layout-плагины

Сторонний layout подключается так же, как обычный плагин:

```js
import HorizontalLayout from './plugins/layout-horizontal/horizontal.js';

const grid = new ABI7Grid('#strip', { layout: 'horizontal', data });
grid.use(HorizontalLayout);
// или глобально:
ABI7Grid.registerLayout('horizontal', HorizontalLayout);
```

Внутри плагин делает `api.layouts.register('horizontal', definition)`. Грид, чей `layout` ещё не зарегистрирован, ждёт его (состояние `pending`) и запускается автоматически. Контракт layout — в [Layout API](#/api-plugin/layout-api).

## Взаимодействие плагинов с Core

| Что нужно плагину | Как это делается |
|---|---|
| Реагировать на события | `api.events.on('item:click', fn)` |
| Сообщить о своих событиях | `api.events.emit('имяплагина:событие', payload)` |
| Дать пользователю методы | `api.features.register(name, object)` → `grid.getPlugin(name)` |
| Читать/менять данные | `api.data.*` |
| Знать положение карточек | `api.geometry.get(id)`, `api.geometry.hitTest(x, y)` |
| Прокручивать, закреплять | `api.viewport.*` |
| Влиять на вид карточки | `api.renderer.toggleClass(id, cls)`, события `item:mount` / `item:unmount` |
| Менять настройки грида | `api.options.set(path, value)` |
| Освободить ресурсы | `return () => {...}`, `api.lifecycle.addDisposable(fn)` |

Плагины могут зависеть друг от друга: поле `dependencies: ['selection']` проверяется при установке, а отключить плагин, нужный другому, нельзя (`PLUGIN_REQUIRED`). Плагин A может использовать публичный интерфейс плагина B: `api.features.get('selection')`.

## Жизненный цикл плагина

1. `grid.use()` → проверки → `install(api, options)`.
2. Рабочая фаза: события, вызовы feature.
3. `grid.unuse(name)` или `grid.destroy()`:
   1. вызывается функция, возвращённая `install()`;
   2. вызываются `api.lifecycle.onDestroy` / `addDisposable` — в обратном порядке регистрации;
   3. снимаются подписки `api.events`, feature и layout;
   4. API «закрывается»: любой вызов бросит `PLUGIN_INACTIVE`;
   5. приходит событие `plugin:uninstall`.

## Обработка ошибок

| Ситуация | Что происходит |
|---|---|
| Отсутствуют `name`, `version`, `apiVersion` или `install` | `grid.use()` бросает `PluginError` (`PLUGIN_INVALID`) |
| `apiVersion` не подходит ядру | `PLUGIN_INCOMPATIBLE`, ничего не устанавливается |
| Плагин уже установлен | `PLUGIN_DUPLICATE` |
| Не установлена зависимость | `PLUGIN_DEPENDENCY` |
| Исключение в `install()` | Откат всех регистраций, `PLUGIN_INSTALL_FAILED`, исключение пробрасывается из `use()` |
| `install()` вернул Promise | `PLUGIN_INVALID` — установка синхронная |
| Исключение в обработчике события плагина | Не ломает грид и других подписчиков; приходит событие `error` с `source: 'plugin:имя'` |
| Исключение в функции очистки | Остальные шаги очистки выполняются; событие `error` (`phase: 'cleanup'`) |
| Конфликт имени feature | `PLUGIN_FEATURE_CONFLICT` |
| `emit()` события не со своим префиксом | `PLUGIN_EVENT_NAMESPACE` |

```js
try {
  grid.use(SomePlugin);
} catch (e) {
  if (e.code === 'PLUGIN_INCOMPATIBLE') showWarning('Обновите плагин');
}
grid.on('error', (e) => { if (e.source.startsWith('plugin:')) console.warn(e.source, e.message); });
```

Как написать свой плагин с нуля — в [Создании плагина](#/plugin-development).
