# API Reference: Events

Все события вызываются **синхронно** в порядке подписки. Каждый объект события содержит поле `type` (имя события). Исключение в обработчике не прерывает остальные: оно превращается в событие [`error`](#/api-events/event-error) с `source: 'listener'` (или `'plugin:имя'`, если подписчик — плагин).

Подписка `grid.on('*', (event, name) => ...)` получает **все** события — удобно для отладки.

## Порядок событий в типичных сценариях

| Сценарий | Последовательность |
|---|---|
| Первый запуск | `data:load-start` → `data:load-end` → `layout:start` → `viewport:update` → `layout:end` → `ready` |
| `setData(list)` | `data:load-start` → `data:load-end` → `layout:start` → `viewport:update` → `layout:end` |
| `insert()` / `remove()` | `item:insert` (или `item:remove`) → (следующий кадр) `layout:start` → `viewport:update` → `layout:end` |
| Изменение размера контейнера | `resize` → `layout:start` → `viewport:update` → `layout:end` |
| Прокрутка | `scroll` (раз в кадр, при изменении позиции), `viewport:update` — если набор смонтированных элементов изменился; через 140 мс тишины `scroll:stop` |
| Drag & Drop | `drag:start` → `drag:move`… (+ `item:move` при каждой перестановке) → `drag:end` |
| `use()` / `unuse()` | `plugin:install` / `plugin:uninstall` |
| `destroy()` | `destroy` → `plugin:uninstall` (для каждого плагина, `reason: 'destroy'`) |

Layout-проход всегда парный: на каждый `layout:start` приходит ровно один `layout:end`. Несколько изменений в одном кадре объединяются в один проход (поле `reasons` содержит все причины).

## Жизненный цикл

:::event ready
purpose: Грид выполнил первую раскладку и готов к работе.
when: Один раз за время жизни экземпляра — после первого `layout:end`. Если контейнер скрыт (ширина 0), событие откладывается до появления размера.
order: После `layout:end` первого прохода.
payload:
type | `string` | `'ready'`
count | `number` | Число записей.
cancel: Не отменяемое.
example:
grid.once('ready', (e) => console.log('карточек:', e.count));
related: `layout:end`, `whenReady()`.
:::

:::event destroy
purpose: Грид начал уничтожение.
when: В начале `destroy()`, пока плагины и DOM ещё не освобождены.
order: Первое событие `destroy()`; затем — `plugin:uninstall` для каждого плагина.
payload: —
cancel: Не отменяемое.
example:
grid.on('destroy', () => console.log('очистите свои ресурсы'));
related: `plugin:uninstall`.
:::

:::event error
purpose: Единый канал ошибок, возникших внутри ядра или плагинов асинхронно / без вызывающего кода.
when: Исключение в обработчике события; ошибка загрузчика данных; исключение в `renderItem` / `releaseItem`; ошибка layout; ошибка очистки плагина; удаление активного layout.
order: Не привязан к другим событиям. Если подписчиков на `error` нет, ошибка пишется в `console.error`.
payload:
type | `string` | `'error'`
source | `string` | `'listener'`, `'plugin:имя'`, `'data'`, `'layout'`, `'renderItem'`, `'releaseItem'`, `'plugins'`
message | `string` | Текст ошибки.
error | `Error` | Исходное исключение.
event | `string` | Для `listener` / `plugin:*` — имя события, в обработчике которого произошла ошибка.
phase | `string` | Для плагинов: `'cleanup'` при ошибке в функции очистки.
id, index | `string` или `number` | Для `renderItem` / `releaseItem` — запись, на которой произошла ошибка.
cancel: Не отменяемое. Исключение внутри обработчика `error` не вызывает рекурсии — оно пишется в `console.error`.
example:
grid.on('error', ({ source, message }) => reportToServer(source, message));
related: `data:load-end` (поле `error`), `plugin:install`.
:::

## Данные

:::event data:load-start
purpose: Начало замены набора данных.
when: Первая загрузка, `setData()`, `load()`, `reload()` для функции-загрузчика, `rebuild({ data })`.
order: Перед `data:load-end`.
payload:
type | `string` | `'data:load-start'`
source | `string` | `'initial'`, `'setData'`, `'load'`, `'reload'`, `'rebuild'`
cancel: Не отменяемое.
example:
grid.on('data:load-start', () => spinner.hidden = false);
related: `data:load-end`.
:::

:::event data:load-end
purpose: Данные получены (или загрузка завершилась ошибкой).
when: После применения данных; устаревший (вытесненный новой загрузкой) ответ событие не вызывает.
order: После `data:load-start`, перед `layout:start`. При ошибке — после него приходит `error`.
payload:
type | `string` | `'data:load-end'`
source | `string` | Источник, как в `data:load-start`.
count | `number` | Число записей после загрузки.
error | `Error` | Только при ошибке; данные при этом не изменены.
cancel: Не отменяемое.
example:
grid.on('data:load-end', (e) => { spinner.hidden = true; if (e.error) showToast(e.error.message); });
related: `data:load-start`, `layout:end`, `error`.
:::

:::event item:insert
purpose: В грид вставлены записи.
when: После `insert()` (одно событие на вызов, независимо от числа записей).
order: До перерасчёта геометрии (`layout:start` придёт в ближайшем кадре).
payload:
type | `string` | `'item:insert'`
items | `Array<{ id, index, item }>` | Все вставленные записи.
id, index, item | — | Поля первой вставленной записи (удобно, когда вставляется одна).
count | `number` | Сколько записей вставлено.
cancel: Не отменяемое.
example:
grid.on('item:insert', (e) => console.log('вставлено', e.count, 'с позиции', e.index));
related: `item:remove`, `layout:start`.
:::

:::event item:remove
purpose: Записи удалены.
when: После `remove()` (если что-то реально удалено).
order: До `layout:start`.
payload:
type | `string` | `'item:remove'`
items | `Array<{ id, index, item }>` | Удалённые записи; `index` — позиция до удаления.
id, index, item | — | Первая удалённая запись.
count | `number` | Сколько записей удалено.
cancel: Не отменяемое.
example:
grid.on('item:remove', (e) => api.delete(e.items.map(i => i.id)));
related: `item:insert`.
:::

:::event item:update
purpose: Запись изменена через `update()`.
when: После `update()` существующей записи.
order: До возможного перерасчёта геометрии.
payload:
type | `string` | `'item:update'`
id, index | `string` или `number`, `number` | Запись и её позиция.
item | `object` | Новая запись.
previous | `object` | Предыдущая запись.
changed | `string[]` | Имена изменённых полей.
cancel: Не отменяемое.
example:
grid.on('item:update', (e) => console.log(e.changed));
related: `update()`.
:::

:::event item:move
purpose: Запись переставлена на другую позицию.
when: `move()` или перетаскивание (при каждой реальной перестановке).
order: В Drag & Drop — между `drag:start` и `drag:end`.
payload:
type | `string` | `'item:move'`
id | `string` или `number` | Запись.
from, to, index | `number` | Прежняя и новая позиции (`index === to`).
item | `object` | Запись.
source | `string` | `'api'`, `'drag'`, `'drag-cancel'` (откат при Escape).
cancel: Не отменяемое.
example:
grid.on('item:move', (e) => e.source === 'drag' && saveOrder(grid.data()));
related: `drag:end`, `move()`.
:::

## Раскладка и окно

:::event layout:start
purpose: Начало перерасчёта геометрии.
when: Перед каждым layout-проходом.
order: Парное с `layout:end`.
payload:
type | `string` | `'layout:start'`
reason | `string` | Первая причина: `'data'`, `'insert'`, `'remove'`, `'move'`, `'update'`, `'resize'`, `'refresh'`, `'layout'`, `'rebuild'`, `'reload'`, `'measure'`, `'plugin'`.
reasons | `string[]` | Все причины, объединённые в этот проход.
from | `number` | Индекс, с которого геометрия пересчитывается (частичный перерасчёт).
count | `number` | Число записей.
cancel: Не отменяемое.
example:
grid.on('layout:start', (e) => console.time('layout:' + e.reason));
related: `layout:end`.
:::

:::event layout:end
purpose: Геометрия рассчитана, DOM обновлён.
when: После каждого layout-прохода (после обновления смонтированных элементов).
order: После `viewport:update`; в первом проходе — перед `ready`.
payload:
type | `string` | `'layout:end'`
reason, reasons, from, count | — | Как в `layout:start`.
contentWidth, contentHeight | `number` | Размер контента, px.
duration | `number` | Длительность расчёта, мс.
animated | `boolean` | Включена ли анимация перестроения.
info | `object` | Данные layout: Masonry — `columns`, `itemWidth`, `gapX`, `gapY`; Grid — те же + `rows`; Justified — `rows`; Horizontal — `itemHeight`.
cancel: Не отменяемое.
example:
grid.on('layout:end', (e) => console.log(e.info.columns, e.contentHeight));
related: `layout:start`, `viewport:update`.
:::

:::event viewport:update
purpose: Изменился набор смонтированных DOM-элементов.
when: Прокрутка, изменение размера, вставка/удаление, смена настроек; после каждого layout-прохода.
order: Внутри layout-прохода — после расчёта, до `layout:end`.
payload:
type | `string` | `'viewport:update'`
mounted | `number` | Сколько элементов сейчас в DOM.
pooled | `number` | Сколько элементов в DOM Pool.
total | `number` | Всего записей.
created, reused | `number` | Сколько DOM-элементов создано и сколько раз переиспользовано за всё время.
overscan | `{ before, after }` | Текущий overscan, px (с учётом adaptive).
first, last | `number` | Индексы первого и последнего смонтированного элемента (`-1`, если пусто).
cancel: Не отменяемое.
example:
grid.on('viewport:update', (e) => stats.textContent = `${e.mounted} / ${e.total}`);
related: `scroll`, `item:mount`.
:::

:::event scroll
purpose: Позиция прокрутки изменилась.
when: Не чаще одного раза за кадр, после обновления окна.
order: После `viewport:update` того же кадра.
payload:
type | `string` | `'scroll'`
scrollTop, scrollLeft | `number` | Позиция, px.
direction | `string` | `'forward'` или `'backward'`.
velocity | `number` | Сглаженная скорость по главной оси, px/мс.
cancel: Не отменяемое.
example:
grid.on('scroll', (e) => progress.value = e.scrollTop);
related: `scroll:stop`.
:::

:::event scroll:stop
purpose: Прокрутка остановилась.
when: Через 140 мс после последнего события прокрутки.
order: После последнего `scroll`.
payload:
type | `string` | `'scroll:stop'`
scrollTop, scrollLeft | `number` | Позиция, px.
cancel: Не отменяемое.
example:
grid.on('scroll:stop', (e) => sessionStorage.setItem('y', e.scrollTop));
related: `scroll`.
:::

:::event resize
purpose: Изменился размер контейнера.
when: Через ResizeObserver (если `autoResize: true`) или при `refresh()`.
order: Перед `layout:start` (если размер влияет на раскладку).
payload:
type | `string` | `'resize'`
width, height | `number` | Новые размеры контейнера, px.
cancel: Не отменяемое.
example:
grid.on('resize', (e) => console.log(e.width));
related: `layout:start`.
:::

:::event visibility:change
purpose: Контейнер вошёл в область видимости страницы или покинул её.
when: Через IntersectionObserver (если доступен в браузере).
order: Независимо от других событий.
payload:
type | `string` | `'visibility:change'`
visible | `boolean` | Виден ли контейнер.
cancel: Не отменяемое.
example:
grid.on('visibility:change', (e) => e.visible ? video.play() : video.pause());
related: `getState().visible`.
:::

:::event reach:end
purpose: Окно приблизилось к концу контента.
when: Когда до конца остаётся не больше `virtualization.endThreshold` px. Срабатывает один раз; повторно — только после того, как контент вырос (например, после `insert`) или пользователь отдалился.
order: В конце обновления окна.
payload:
type | `string` | `'reach:end'`
remaining | `number` | Сколько px осталось до конца.
count | `number` | Число записей.
cancel: Не отменяемое.
example:
grid.on('reach:end', async () => grid.insert(await loadNextPage()));
related: `insert()`, опция `virtualization.endThreshold`.
:::

## DOM-элементы

:::event item:mount
purpose: DOM-элемент привязан к записи (создан или взят из пула).
when: При появлении записи в окне, после отрисовки содержимого.
order: Перед `viewport:update`.
payload:
type | `string` | `'item:mount'`
id, index | `string` или `number`, `number` | Запись.
item | `object` | Запись данных.
element | `HTMLElement` | Узел. Он будет переиспользован — не сохраняйте ссылку.
cancel: Не отменяемое. Событие создаётся только если есть подписчики.
example:
grid.on('item:mount', ({ element, item }) => element.title = item.title);
related: `item:unmount`.
:::

:::event item:unmount
purpose: DOM-элемент отвязан от записи и отправлен в пул.
when: Когда запись выходит из окна (с учётом overscan), удаляется или грид перестраивается.
order: Перед `item:mount` для переиспользуемого узла.
payload:
type | `string` | `'item:unmount'`
id, index | `string` или `number`, `number` | Запись.
element | `HTMLElement` | Узел, который сейчас будет убран из DOM.
cancel: Не отменяемое.
example:
grid.on('item:unmount', ({ element }) => element.querySelector('video')?.pause());
related: `item:mount`.
:::

:::event item:visible
purpose: Запись вошла в видимую область (без overscan).
when: После обновления окна; событие создаётся только если есть подписчики на `item:visible` или `item:hidden`.
order: После `viewport:update`-обработки, до `scroll`.
payload:
type | `string` | `'item:visible'`
id, index | `string` или `number`, `number` | Запись.
item | `object` | Запись данных.
element | `HTMLElement` | Узел.
cancel: Не отменяемое.
example:
grid.on('item:visible', (e) => analytics.impression(e.id));
related: `item:hidden`, `getVisibleItems()`.
:::

:::event item:hidden
purpose: Запись покинула видимую область.
when: Парное событие к `item:visible`.
order: Вместе с `item:visible` в одном обновлении (сначала `visible`, затем `hidden`).
payload:
type | `string` | `'item:hidden'`
id | `string` или `number` | Запись.
index | `number` | Индекс или `-1`, если запись удалена.
cancel: Не отменяемое.
example:
grid.on('item:hidden', (e) => analytics.leave(e.id));
related: `item:visible`.
:::

## Взаимодействие

:::event item:click
purpose: Клик по карточке.
when: Нативный `click` внутри карточки. Не вызывается, если непосредственно перед этим закончилось перетаскивание, и при `interaction.click: false`.
order: Обработчики вызываются в порядке подписки; плагины (например, Selection и Lightbox) — также обычные подписчики.
payload:
type | `string` | `'item:click'`
id, index | `string` или `number`, `number` | Карточка.
item | `object` | Запись данных.
element | `HTMLElement` | DOM-узел карточки.
originalEvent | `MouseEvent` | Исходное событие (`ctrlKey`, `shiftKey`, …).
defaultPrevented | `boolean` | `true`, если кто-то вызвал `preventDefault()`.
preventDefault | `function` | Помечает клик обработанным.
cancel: Отменяемое: `event.preventDefault()` сообщает плагинам (Selection, Lightbox, Counter), что клик обработан. Нативное поведение браузера не отменяется.
example:
grid.on('item:click', (e) => { if (e.item.locked) e.preventDefault(); });
related: `item:dblclick`, `item:contextmenu`.
:::

:::event item:dblclick
purpose: Двойной клик по карточке.
when: Нативный `dblclick`.
order: После двух `item:click`.
payload:
type | `string` | `'item:dblclick'`
id, index, item, element, originalEvent, defaultPrevented, preventDefault | — | Как у `item:click`.
cancel: Отменяемое (флаг для других подписчиков).
example:
grid.on('item:dblclick', (e) => openEditor(e.item));
related: `item:click`.
:::

:::event item:contextmenu
purpose: Контекстное меню на карточке.
when: Нативный `contextmenu`.
order: Независимо.
payload:
type | `string` | `'item:contextmenu'`
id, index, item, element, originalEvent, defaultPrevented, preventDefault | — | Как у `item:click`.
cancel: Отменяемое: `event.preventDefault()` подавляет нативное контекстное меню браузера.
example:
grid.on('item:contextmenu', (e) => { e.preventDefault(); showMenu(e.originalEvent.clientX, e.originalEvent.clientY, e.id); });
related: `item:click`.
:::

:::event drag:start
purpose: Начало перетаскивания карточки.
when: Мышь — после смещения на `interaction.drag.threshold` px; касание — после долгого нажатия `delay` мс. Только при `interaction.drag.enabled: true`.
order: Первое событие drag-сессии.
payload:
type | `string` | `'drag:start'`
id, index, item, element | — | Перетаскиваемая карточка.
clientX, clientY | `number` | Позиция указателя.
pointerType | `string` | `'mouse'`, `'touch'`, `'pen'`.
originalEvent | `PointerEvent` | Событие `pointerdown`.
cancel: Отменяемое: `preventDefault()` отменяет перетаскивание.
example:
grid.on('drag:start', (e) => { if (e.item.pinned) e.preventDefault(); });
related: `drag:move`, `drag:end`.
:::

:::event drag:move
purpose: Указатель сдвинулся во время перетаскивания.
when: При каждом `pointermove` и при автопрокрутке.
order: Между `drag:start` и `drag:end`.
payload:
type | `string` | `'drag:move'`
id | `string` или `number` | Карточка.
index, fromIndex | `number` | Текущая и начальная позиции.
overIndex | `number` | Индекс карточки под указателем или `-1`.
clientX, clientY | `number` | Позиция указателя.
outside | `boolean` | Указатель вне контейнера (используется Connected Grids).
pointerType | `string` | Тип указателя.
cancel: Не отменяемое.
example:
grid.on('drag:move', (e) => hint.hidden = !e.outside);
related: `item:move`.
:::

:::event drag:end
purpose: Перетаскивание завершено или отменено.
when: `pointerup`, `pointercancel`, Escape, потеря фокуса окном.
order: Последнее событие drag-сессии. При отмене (Escape и т. п.) откат порядка — `item:move` с `source: 'drag-cancel'` — происходит до `drag:end`.
payload:
type | `string` | `'drag:end'`
id | `string` или `number` | Карточка.
fromIndex, toIndex | `number` | Позиции до и после (при отмене равны).
moved | `boolean` | Изменился ли порядок.
cancelled | `boolean` | Отмена (Escape, `pointercancel`, blur).
outside | `boolean` | Завершено вне контейнера.
clientX, clientY, pointerType | — | Данные указателя.
cancel: Не отменяемое.
example:
grid.on('drag:end', (e) => { if (e.moved) saveOrder(grid.data().map(p => p.id)); });
related: `drag:start`, `item:move`.
:::

## Плагины

:::event plugin:install
purpose: Плагин установлен.
when: Сразу после успешного `install()`.
order: После всех регистраций плагина.
payload:
type | `string` | `'plugin:install'`
name | `string` | Имя плагина.
version | `string` | Версия плагина.
cancel: Не отменяемое.
example:
grid.on('plugin:install', (e) => console.log(e.name, e.version));
related: `plugin:uninstall`.
:::

:::event plugin:uninstall
purpose: Плагин отключён.
when: После функции очистки плагина и снятия всех его подписок.
order: При `destroy()` приходит для каждого плагина (в обратном порядке установки).
payload:
type | `string` | `'plugin:uninstall'`
name, version | `string` | Плагин.
reason | `string` | `'unuse'` или `'destroy'`.
cancel: Не отменяемое.
example:
grid.on('plugin:uninstall', (e) => console.log(e.name, e.reason));
related: `plugin:install`.
:::

## События встроенных плагинов

| Событие | Плагин | Аргументы | Отмена |
|---|---|---|---|
| `selection:change` | selection | `selected`, `added`, `removed`, `source` | нет |
| `lightbox:before-open` | lightbox | `id` | да |
| `lightbox:open` | lightbox | `id`, `index` | нет |
| `lightbox:change` | lightbox | `id`, `index`, `previousId` | нет |
| `lightbox:close` | lightbox | `id` | нет |
| `connected-grids:before-transfer` | connected-grids | `id`, `record`, `from`, `to` | да |
| `connected-grids:transfer` | connected-grids | `id`, `newId`, `record`, `copy`, `index`, `from`, `to` | нет |
| `connected-grids:receive` | connected-grids | `id`, `from`, `record`, `index` | нет |
