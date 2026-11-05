# Как создать свой плагин ABI7 Grid

После этого руководства вы сможете написать плагин, **не читая исходный код Core**. Всё, что нужно, — публичный Plugin API.

## Шаг за шагом

### 1. Создайте директорию

```text
plugins/
└── my-plugin/
    ├── my-plugin.js     # код плагина (ES-модуль, export default)
    ├── my-plugin.css    # стили — только если нужны
    ├── README.md
    └── package.json
```

Один плагин — одна директория. Пользователь подключает только то, что использует.

### 2. Создайте JS-файл и объявите плагин

```js
// my-plugin.js
export default {
  name: 'my-plugin',          // уникальное имя; пространство имён событий
  version: '1.0.0',           // версия самого плагина (semver)
  apiVersion: '^1.0.0',       // с какими версиями API ядра совместим плагин
  defaults: { enabled: true },// значения опций по умолчанию

  install(api, options) {
    // ... вся логика
    return () => { /* очистка */ };
  }
};
```

Плагин **не импортирует Core**: он общается с гридом только через `api`.

### 3. Создайте package.json

```json
{
  "name": "@your-scope/abi7-my-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "my-plugin.js",
  "style": "my-plugin.css",
  "files": ["my-plugin.js", "my-plugin.css", "README.md"],
  "peerDependencies": { "abi7-grid": "^1.0.0" },
  "license": "MIT"
}
```

Ядро указывается как `peerDependency`, а не `dependency`: плагин не должен тянуть собственную копию.

### 4. Подключите к Core

```js
import { ABI7Grid } from './dist/abi7-grid.js';
import MyPlugin from './plugins/my-plugin/my-plugin.js';

const grid = new ABI7Grid('#gallery', { data });
grid.use(MyPlugin, { enabled: true });
```

### 5. Используйте Plugin API

Девять интерфейсов (`events`, `layouts`, `features`, `data`, `geometry`, `viewport`, `renderer`, `options`, `lifecycle`) описаны в [Plugin API](#/api-plugin). Правило выбора: **событие** — чтобы реагировать, **feature** — чтобы дать методы, **renderer** — чтобы менять вид, **geometry/viewport** — чтобы знать «где».

### 6. Зарегистрируйте методы

```js
api.features.register('my-plugin', { doSomething() {}, getValue: () => value });
// пользователь: grid.getPlugin('my-plugin').doSomething();
```

### 7. Работайте с событиями

```js
api.events.on('item:click', (e) => { if (!e.defaultPrevented) { /* ... */ } });
```

Подписки через `api.events` снимаются автоматически.

### 8. Создавайте собственные события

```js
api.events.emit('my-plugin:changed', { value });                 // уведомление
const ok = api.events.emitCancelable('my-plugin:before-save', {}); // можно отменить
```

Имя события обязано начинаться с `my-plugin:` — ядро не даёт плагину генерировать чужие события.

### 9. Работайте с настройками

`options` — замороженный объект: `plugin.defaults`, объединённые с тем, что передал пользователь. Не изменяйте его; для изменяемых значений заведите локальные переменные.

### 10. Подключите CSS

CSS-файл плагина подключается пользователем отдельно (`<link>`). Все классы начинайте с префикса плагина (`.abi7-lb-*`, `.abi7-selected`), без глобальных селекторов.

### 11. Обрабатывайте ошибки

Бросайте обычные `Error` в `install()` при неверной конфигурации — ядро откатит установку и обернёт ошибку в `PluginError`. В обработчиках событий исключения безопасны для грида (они уйдут в событие `error`), но лучше обрабатывать ожидаемые ситуации самим.

### 12. Очищайте ресурсы

Всё, что плагин создал **вне** API — `addEventListener`, `setTimeout`, `observer`, элементы в `document.body` — он обязан убрать сам. Два способа:

```js
// способ 1: функция очистки
return () => { clearInterval(timer); overlay.remove(); };

// способ 2: регистрировать рядом с созданием
root.addEventListener('keydown', onKey);
api.lifecycle.addDisposable(() => root.removeEventListener('keydown', onKey));
```

Для группы слушателей удобен один `AbortController`: `addEventListener(..., { signal })`, а в очистке `controller.abort()` (так сделан Lightbox).

### 13. Тестирование

Плагин проверяется на настоящем гриде: установить, вызвать методы, отключить и убедиться, что ничего не осталось. Шаблон (Node + jsdom, как в `tests/`):

```js
grid.use(MyPlugin);
// ... действия
grid.unuse('my-plugin');
assert.equal(document.querySelectorAll('.my-plugin-node').length, 0);   // DOM убран
assert.equal(grid.getPlugin('my-plugin'), null);                         // feature снят
grid.destroy();
```

Проверяйте: подключение и отключение, повторное `use()`, два экземпляра с независимым состоянием, `destroy()` без ошибок.

### 14. Публикация

1. Заполните `README.md`: опции, методы feature, события, подключение CSS.
2. Укажите корректный `apiVersion`: диапазон API, на котором плагин проверен.
3. `npm publish` из директории плагина. Имя — по схеме `@scope/abi7-имя`.

## Рецепты: три плагина разной сложности

Ниже — реальные файлы проекта (`examples/custom-plugin/recipes.js`); они проверяются тестами.

:::file examples/custom-plugin/recipes.js

- **LoggerPlugin** — минимум: подписка на `'*'`, feature, опции.
- **TooltipPlugin** — работа с переиспользуемыми DOM-узлами: атрибут ставится на **каждый** `item:mount`.
- **KeyboardNavPlugin** — навигация стрелками для любого layout через `api.geometry.hitTest`, прокрутка через `api.viewport`, свои события, очистка слушателя DOM.

## Полный пример: CounterPlugin с нуля

Плагин считает клики по карточкам, хранит счётчики отдельно для каждого грида, регистрирует методы, генерирует свои события, умеет сбрасываться и корректно отключаться. Он запущен ниже; код — тот же файл, что исполняется в iframe.

:::demo custom-plugin

### Разбор по пунктам

1. **Plugin object** — обычный объект `CounterPlugin = { name, version, apiVersion, defaults, install }`. Ядро не требует класса или наследования.
2. **`name`** — идентификатор плагина в пределах грида: по нему работают `unuse('counter')`, защита от повторной установки и пространство имён событий (`counter:*`).
3. **`version`** — версия плагина (semver); видна в `getPlugins()` и в событии `plugin:install`.
4. **`apiVersion`** — диапазон версий API ядра (`^1.0.0`). Если ядро не подходит, `use()` бросает `PLUGIN_INCOMPATIBLE` и ничего не устанавливает — плагин не сломается молча на несовместимом ядре.
5. **`install(api, options)`** — вызывается один раз при `use()`, синхронно. `this` — сам объект плагина. Возвращаемая функция — очистка.
6. **`api`** — замороженный объект с девятью интерфейсами; единственный способ взаимодействия с ядром.
7. **Подписка на события** — `api.events.on('item:click', handler)`. Отписывать вручную не нужно.
8. **Публичный метод** — `api.features.register('counter', { getTotal, reset, top })`.
9. **Вызов метода** — `grid.getPlugin('counter').getTotal()`.
10. **Собственное событие** — `api.events.emit('counter:change', { id, count, total })`; префикс `counter:` обязателен. Подписка: `grid.on('counter:change', ...)`.
11. **Настройки** — второй аргумент `install` (`step`, `badges`, `filter`): значения по умолчанию из `defaults` + то, что передали в `grid.use(CounterPlugin, { step: 2 })`.
12. **Отключение** — `grid.unuse('counter')`: функция очистки убирает значки, затем снимаются подписки и feature; `getPlugin('counter')` вернёт `null`.
13. **`destroy()`** — для каждого плагина вызывается та же очистка, затем приходит `plugin:uninstall` с `reason: 'destroy'`.
14. **Утечки памяти** — все подписки идут через `api.events` (снимаются автоматически); `Map` счётчиков очищается в функции очистки; нет ссылок на DOM-узлы после `unuse()`; собственные `addEventListener` обязательно снимаются в очистке (см. рецепты).
15. **Состояние отдельно для каждого экземпляра** — `total` и `perItem` объявлены **внутри** `install()`: каждый вызов создаёт новое замыкание. Переменные на уровне модуля были бы общими для всех гридов.
16. **Работа с DOM** — узлы переиспользуются (DOM Pool), поэтому значок ставится на каждый `item:mount` и убирается на `item:unmount`; элемент берётся через `api.renderer.getElement(id)` (может быть `null`, если карточки нет в DOM); текст — только `textContent`.
17. **Обработка ошибок** — исключение в обработчике не ломает грид (оно приходит в событие `error` с `source: 'plugin:counter'`); исключение в `install()` откатывает установку; проверка `event.defaultPrevented` позволяет уважать «отмену» клика другими обработчиками.

### Как подключить и убедиться, что всё работает

```js
import CounterPlugin from './counter-plugin.js';

grid.use(CounterPlugin, { step: 1 });
grid.on('counter:change', (e) => console.log(e.total));
grid.getPlugin('counter').top(3);     // самые кликаемые карточки
grid.unuse('counter');                // значки исчезли, getPlugin('counter') === null
```
