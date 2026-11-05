# API Reference: Plugin API & Layout API

Плагин получает объект `api` — единственную точку взаимодействия с ядром. Он **заморожен**, каждый метод проверяет, что плагин ещё установлен (после `unuse()` вызов бросает `PluginError` с кодом `PLUGIN_INACTIVE`), а всё, что плагин зарегистрировал, отслеживается и снимается автоматически.

Корень объекта: `api.name` (имя плагина), `api.apiVersion` (версия Plugin API, `'1.0.0'`), `api.coreVersion` (версия ядра).

## Контракт плагина

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `name` | `string` | да | Уникальное имя (`/^[a-z][a-z0-9._:-]*$/i`). Пространство имён событий плагина. |
| `version` | `string` | да | Версия плагина (semver). |
| `apiVersion` | `string` | да | Диапазон совместимых версий API: `^1.0.0`, `~1.0.0`, `>=1.0.0 <2`, `1.x`, `a \|\| b`. |
| `install(api, options)` | `function` | да | Синхронная. `this` — объект плагина. Может вернуть функцию очистки (или объект с `destroy()`). |
| `defaults` | `object` | нет | Значения опций по умолчанию. |
| `dependencies` | `string[]` | нет | Имена плагинов, которые должны быть установлены раньше. |
| `layout` | `object` | нет | Определение layout (для layout-плагинов; читается `ABI7Grid.registerLayout(name, plugin)`). |

## api.events

Шина событий данного грида. Подписки через `api.events` помечаются именем плагина (ошибки в них идут в событие `error` с `source: 'plugin:имя'`) и снимаются автоматически.

| Метод | Возвращает | Описание |
|---|---|---|
| `on(event, handler)` | `function` отписки | Подписка. Поддерживает `'*'`. |
| `once(event, handler)` | `function` отписки | Одно срабатывание. |
| `off(event, handler)` | `boolean` | Отписка. |
| `emit(event, payload?)` | `undefined` | Событие плагина. **Имя обязано начинаться с `имяПлагина:`**, иначе `PLUGIN_EVENT_NAMESPACE`. К `payload` добавляется `type`. |
| `emitCancelable(event, payload?)` | `boolean` | Как `emit`, но обработчики могут вызвать `event.preventDefault()`. Возвращает `false`, если событие отменено. |

Рекомендации: подписывайтесь только на нужные события; не сохраняйте `event.element` (узел переиспользуется); для отмены клика проверяйте `event.defaultPrevented`.

```js
api.events.on('item:click', (e) => {
  if (e.defaultPrevented) return;
  api.events.emit('my-plugin:clicked', { id: e.id });
});
```

## api.features

Реестр публичных интерфейсов плагинов. Результат `grid.getPlugin(name)`.

| Метод | Возвращает | Описание |
|---|---|---|
| `register(name, impl)` | `undefined` | Регистрирует объект или функцию. Занятое имя — `PLUGIN_FEATURE_CONFLICT`. Снимается автоматически. |
| `unregister(name)` | `undefined` | Снимает собственную feature досрочно. |
| `get(name)` | `object` или `null` | Feature (в том числе другого плагина). |
| `has(name)` | `boolean` | Существует ли feature. |

## api.layouts

Регистрация layout **только для этого грида**. Глобальная регистрация — `ABI7Grid.registerLayout()`.

| Метод | Возвращает | Описание |
|---|---|---|
| `register(name, definition)` | `undefined` | Регистрирует layout. Если грид ждал этот layout — запуск продолжится. Снимается автоматически. |
| `unregister(name)` | `undefined` | Снять досрочно. |
| `has(name)` | `boolean` | Есть ли layout (локальный, глобальный или встроенный). |
| `list()` | `string[]` | Доступные имена. |

## api.data

Работа с данными через те же методы, что и у публичного API (со всеми событиями). Внутренние массивы ядра не раскрываются: методы чтения возвращают копии.

| Метод | Возвращает | Описание |
|---|---|---|
| `get()` | `object[]` | Копия массива записей. |
| `getById(id)` / `getByIndex(i)` | `object` или `undefined` | Запись. |
| `ids()` | `Array<string\|number>` | Копия массива id в текущем порядке. |
| `count()` | `number` | Число записей. |
| `indexOf(id)` | `number` | Индекс или `-1`. |
| `has(id)` | `boolean` | Есть ли запись. |
| `set(list)` | `void` | Как `grid.setData`. |
| `insert(items, { at })` | `id[]` | Как `grid.insert`. |
| `remove(idOrIds)` | `number` | Как `grid.remove`. |
| `update(id, patch)` | `boolean` | Как `grid.update`. |
| `move(id, toIndex)` | `boolean` | Как `grid.move`. |

## api.geometry

Геометрия (координаты в пикселях контента). Каждый метод при необходимости сначала выполняет отложенную раскладку, поэтому данные не устаревают.

| Метод | Возвращает | Описание |
|---|---|---|
| `get(id)` | `Rect` или `null` | `{ id, index, x, y, width, height, right, bottom }`. |
| `getByIndex(i)` | `Rect` или `null` | То же по индексу. |
| `size()` | `{ width, height }` | Размер контента. |
| `hitTest(x, y)` | `number` | Индекс карточки в точке координат контента или `-1`. |
| `invalidate(fromIndex = 0)` | `void` | Пометить геометрию устаревшей с индекса (перерасчёт в ближайшем кадре, причина `plugin`). |

## api.viewport

Окно просмотра и навигация.

| Метод | Возвращает | Описание |
|---|---|---|
| `state()` | `object` | `{ scrollLeft, scrollTop, width, height, axis, overscan }`. |
| `range()` | `{ first, last, count }` | Видимые индексы (без overscan). |
| `isVisible(id)` | `boolean` | Пересекает ли карточка окно. |
| `scrollTo(x, y, behavior?)` | `void` | Прокрутка к точке. |
| `scrollToIndex(i, options?)`, `scrollToItem(id, options?)` | `boolean` | Как в публичном API. |
| `pin(id)` / `unpin(id)` | `void` | Закрепить карточку в DOM, даже если она вне окна. Закрепления плагина снимаются автоматически. Считаются со счётчиком. |
| `clientToContent(clientX, clientY)` | `{ x, y }` | Координаты экрана → координаты контента. |
| `indexAtClientPoint(clientX, clientY, { nearest }?)` | `number` | Индекс карточки под точкой; с `nearest: true` — ближайшей видимой; `-1`, если нет. |

## api.renderer

Единственный безопасный способ влиять на DOM карточек.

| Метод | Возвращает | Описание |
|---|---|---|
| `root()` | `HTMLElement` | Корневой элемент грида (для слушателей клавиатуры, подсветки и т. д.). |
| `getElement(id)` | `HTMLElement` или `null` | Элемент карточки, если она сейчас в DOM. |
| `toggleClass(id, className, force?)` | `boolean` | Назначает или снимает класс по **id записи**. Ядро запоминает класс и возвращает его, когда DOM-узел переиспользуется для другой записи и снова привязывается к этой. Возвращает итоговое состояние. |
| `hasClass(id, className)` | `boolean` | Назначен ли класс через `toggleClass`. |
| `refresh(id?)` | `void` | Перерисовать содержимое одной карточки или всех смонтированных. |

> Любая «ручная» разметка внутри карточки (значки, подписи) должна ставиться при событии `item:mount` и убираться при `item:unmount`: один и тот же DOM-элемент показывает разные записи.

## api.options

| Метод | Возвращает | Описание |
|---|---|---|
| `get(path?)` | `any` | Копия опций (без `data`) или значения по пути: `get('layoutOptions.gap')`. |
| `set(path, value)` | `void` | Меняет опцию и применяет её (как `rebuild`): `set('interaction.drag.enabled', true)`. |
| `plugin()` | `object` | Замороженные опции самого плагина (тот же объект, что 2-й аргумент `install`). |

## api.lifecycle

| Метод | Возвращает | Описание |
|---|---|---|
| `isDestroyed()` | `boolean` | Уничтожен ли грид. |
| `state()` | `string` | `'new'`, `'loading'`, `'pending'`, `'ready'`, `'destroyed'`. |
| `onDestroy(fn)` | `function` | Вызвать `fn` при `destroy()` / `unuse()`. Возвращает функцию, снимающую регистрацию. |
| `addDisposable(fn)` | `function` | Зарегистрировать функцию очистки (вызовется в обратном порядке регистрации). Идеально для `removeEventListener`, `clearTimeout`, `observer.disconnect()`. |
| `refresh()` | `void` | Как `grid.refresh()`. |
| `whenReady()` | `Promise` | Как `grid.whenReady()`. |

**Порядок очистки** при `unuse()` и `destroy()`: функция, возвращённая `install()` → `onDestroy` / `addDisposable` (в обратном порядке) → отписка событий, снятие features и layout. Ошибки очистки не прерывают остальные шаги и приходят в событие `error`.

## Layout API

Layout — это объект, который регистрируется как `ABI7Grid.registerLayout(name, def)` либо `api.layouts.register(name, def)`.

```js
const MyLayout = {
  name: 'my-layout',
  axis: 'y',                 // главная ось прокрутки: 'y' (вертикальная) или 'x'
  responsive: 'width',       // что вызывает перерасчёт при ресайзе: 'width', 'height' или 'both'
  defaults: { gap: 8 },      // значения по умолчанию для options.layoutOptions
  create(options) {          // создаётся при выборе layout и при rebuild()
    return {
      compute(ctx) {         // вызывается при каждом перерасчёте
        // ... ctx.set(i, x, y, width, height) для i от ctx.from до ctx.count - 1
        return { width: ctx.width, height: totalHeight, info: { /* любые данные */ } };
      }
    };
  }
};
```

Допустим короткий вариант: `{ compute(ctx) {...} }` без `create` (без собственного состояния).

### Контекст `ctx`

| Поле / метод | Описание |
|---|---|
| `count` | Число записей. |
| `width`, `height` | Доступные размеры контента (контейнер минус `padding`), px. |
| `from` | Индекс, начиная с которого геометрия устарела. Всё левее/выше уже рассчитано верно — layout обязан пересчитать элементы `from … count - 1` (частичный перерасчёт). Layout может начать и раньше `from`. |
| `options` | `defaults` layout, объединённые с `layoutOptions` пользователя. |
| `aspect(i)` | Aspect ratio записи (`ширина / высота`) или `0`, если неизвестен. |
| `resolveHeight(i, width, { height, aspectRatio })` | Единая политика высоты: измеренная → фиксированная → aspect ratio → высота записи → estimatedHeight. Возвращает целое ≥ 1. |
| `itemId(i)`, `itemData(i)` | Идентификатор и запись (только чтение). |
| `rect(i)` | `{ x, y, width, height, right, bottom }` уже рассчитанного элемента (в координатах layout, без `padding`). |
| `set(i, x, y, width, height)` | Записывает геометрию. Значения должны быть конечными числами, `width`/`height` ≥ 0, иначе `LAYOUT_INVALID`. |

### Что возвращает `compute`

`{ width, height, info? }` — размеры контента (без `padding`, ядро добавит его само). `info` попадает в `layout:end` и `getState().layoutInfo`.

### Правила

- Layout отвечает **только за геометрию**. Он не получает доступа к DOM, виртуализации и внутренним массивам ядра.
- Виртуализация работает с любым layout без дополнительных настроек: ядро строит пространственный индекс по `axis`.
- Результат должен быть детерминированным: тот же вход → та же геометрия. Тогда частичный и полный перерасчёт дают одинаковый результат (проверяется тестами для встроенных layout).
- Ошибка в `compute` не ломает грид: она приходит в событие `error` (`source: 'layout'`).
- Если активный layout отключается (`unuse()` плагина), грид переключается на `masonry`.

### Пример: layout «лесенка» за 12 строк

```js
ABI7Grid.registerLayout('stairs', {
  defaults: { step: 40, itemHeight: 120 },
  compute(ctx) {
    const { step, itemHeight } = ctx.options;
    for (let i = ctx.from; i < ctx.count; i++) {
      ctx.set(i, (i * step) % Math.max(1, ctx.width - 200), i * (itemHeight + 8), 200, itemHeight);
    }
    return { width: ctx.width, height: ctx.count * (itemHeight + 8) };
  }
});
```
