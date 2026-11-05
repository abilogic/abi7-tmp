# API Reference: Methods

Все публичные методы класса `ABI7Grid`. Если не сказано иное, методы бросают `ABI7Error` с `code: 'DESTROYED'`, когда вызваны на уничтоженном экземпляре. Перечень разделов: [Конструктор](#/api-methods/constructor), [Lifecycle](#/api-methods/lifecycle), [Data](#/api-methods/data), [Items](#/api-methods/items), [Navigation](#/api-methods/navigation), [Plugins](#/api-methods/plugins), [Events](#/api-methods/events), [State](#/api-methods/state), [Static](#/api-methods/static), [Deprecated](#/api-methods/deprecated).

> Типы в таблицах: `id` — `string` или `number` (сравнение строгое: `'1'` и `1` — разные id); `Item` — объект-описание элемента `{ id, index, data, rect, element, visible }`; `Rect` — `{ id, index, x, y, width, height, right, bottom }`.

## Constructor

:::method new ABI7Grid(target, options)
purpose: Создаёт экземпляр грида на контейнере. Это единственная точка входа библиотеки.
syntax:
const grid = new ABI7Grid('#gallery', { layout: 'masonry', data: photos });
params:
target | `string` или `HTMLElement` | обязательный | CSS-селектор или элемент. Элемент должен быть пустым и иметь высоту (он же скролл-контейнер).
options | `object` | `{}` | Настройки, см. [Options](#/api-options). Объединяются с значениями по умолчанию.
returns: Экземпляр `ABI7Grid`.
inside: Конструктор проверяет опции, добавляет к контейнеру класс `abi7-grid`, создаёт внутренний слой `.abi7-container`, запоминает исходные атрибуты контейнера (`class`, `style`, `tabindex`, `role`, `aria-label`) и создаёт все внутренние компоненты. Первая раскладка выполняется асинхронно (в microtask), чтобы после конструктора можно было синхронно вызвать `use()` и подписаться на события. Если `layout` ещё не зарегистрирован (layout-плагин), грид ждёт его регистрации.
use: Один раз на контейнер. Для получения момента готовности используйте событие `ready` или `whenReady()`.
limits: На одном элементе не может быть двух живых экземпляров. Контейнер должен иметь ограниченную высоту. Дочерние элементы контейнера не импортируются как карточки (в отличие от старой версии).
errors: `INVALID_ELEMENT` — элемент не найден. `INVALID_OPTION` — неверное значение опции. `ALREADY_INITIALIZED` — на элементе уже есть грид.
example:
const grid = new ABI7Grid('#gallery', {
  layout: 'masonry',
  data: photos,
  layoutOptions: { gap: 12, minWidth: 180 }
});
grid.on('ready', () => console.log('готово'));
related: `whenReady()`, `destroy()`, событие `ready`.
:::

## Lifecycle

:::method grid.render([done])
purpose: Запускает грид, если `autoRender: false`; на запущенном гриде равносильно `refresh()`.
syntax:
grid.render();
grid.render((grid) => console.log('ready'));
params:
done | `function` | — | Устаревший callback в стиле старой версии; вызывается после события `ready`. Предпочтительнее `whenReady()`.
returns: `this` (для цепочек).
inside: Подключает слушатели прокрутки, ResizeObserver и IntersectionObserver, устанавливает плагины из `options.plugins`, создаёт layout-движок и начинает загрузку данных из `options.data`.
use: Только при `autoRender: false`, когда нужно отложить запуск (например, до загрузки CSS).
limits: Повторный вызов не пересоздаёт грид — он только перестраивает геометрию.
errors: `DESTROYED`.
example:
const grid = new ABI7Grid('#gallery', { data: photos, autoRender: false });
grid.use(SelectionPlugin);
grid.render();
related: `refresh()`, `whenReady()`, событие `ready`.
:::

:::method grid.refresh([done])
purpose: Заново измеряет контейнер и пересчитывает геометрию всех элементов.
syntax:
grid.refresh();
params:
done | `function` | — | Устаревший callback; вызывается сразу после перерасчёта.
returns: `this`.
inside: Читает `clientWidth/clientHeight` контейнера, помечает всю геометрию устаревшей (причина `refresh`), синхронно выполняет перерасчёт, обновляет набор смонтированных элементов и вызывает `layout:start` → `viewport:update` → `layout:end`.
use: Если контейнер изменил размер, а `autoResize: false`; после изменения CSS, влияющего на размеры; после показа скрытого контейнера.
limits: Полный перерасчёт — O(n) по числу записей. При `autoResize: true` вызывать вручную обычно не нужно. До `render()` ничего не делает.
errors: `DESTROYED`.
example:
// Контейнер был скрыт (display: none) и показан вручную:
panel.hidden = false;
grid.refresh();
related: `rebuild()`, `flush()`, `autoResize`, события `layout:start`, `layout:end`.
:::

:::method grid.rebuild([options], [done])
purpose: Применяет новые настройки к работающему гриду.
syntax:
grid.rebuild({ layout: 'justified', layoutOptions: { targetRowHeight: 200 } });
params:
options | `object` | `{}` | Частичный набор опций. Вложенные объекты (`layoutOptions`, `virtualization`, `animation`, `interaction`) объединяются с текущими. Если указан `data`, данные загружаются заново.
done | `function` | — | Устаревший callback; вызывается после перерасчёта.
returns: `this`.
inside: Объединяет опции и перепроверяет их. Если изменились `layout` / `layoutOptions` — создаёт новый layout-движок; изменения `renderItem`, `itemTag`, `fields`, `virtualization` и т. п. сбрасывают DOM-пул и пересоздают элементы. Геометрия пересчитывается целиком. Для изменений раскладки включается анимация и сохраняется якорь скролла.
use: Смена layout, изменение gap/minWidth/колонок, настройки виртуализации, включение Drag & Drop.
limits: Ключ нельзя «удалить» объединением — задайте новое значение. Данные при этом остаются прежними (если не передан `data`).
errors: `INVALID_OPTION`; `DESTROYED`.
example:
slider.oninput = () => grid.rebuild({ layoutOptions: { gap: Number(slider.value) } });
related: `refresh()`, [Options](#/api-options), события `layout:end`.
:::

:::method grid.reload()
purpose: Перезагружает данные (если `data` — функция) или сбрасывает прокрутку и перерисовывает карточки.
syntax:
await grid.reload();
params: —
returns: `Promise<ABI7Grid>`. Не отклоняется: ошибки загрузчика приходят в событие `error`.
inside: Если `options.data` — функция, она вызывается снова (с `AbortSignal`), предыдущая незавершённая загрузка отменяется. Иначе: прокрутка сбрасывается в начало, карточки привязываются заново, геометрия пересчитывается.
use: Кнопка «Обновить» для списков с серверной загрузкой.
limits: Ответ устаревшей загрузки (запущенной раньше) игнорируется — гонок нет.
errors: `DESTROYED`.
example:
const grid = new ABI7Grid('#gallery', { data: ({ signal }) => fetch('/api/photos', { signal }).then(r => r.json()) });
refreshBtn.onclick = () => grid.reload();
related: `load()`, `setData()`, события `data:load-start`, `data:load-end`.
:::

:::method grid.destroy()
purpose: Полностью уничтожает экземпляр и возвращает контейнер в исходное состояние.
syntax:
grid.destroy();
params: —
returns: `undefined`. Повторный вызов безопасен.
inside: Порядок: событие `destroy` → очистка всех плагинов (в обратном порядке установки) → отмена drag → отмена текущей загрузки → отключение ResizeObserver/IntersectionObserver → удаление DOM элементов и пула → `AbortController.abort()` для всех слушателей → отмена таймеров и `requestAnimationFrame` → удаление слоя `.abi7-container` → восстановление исходных атрибутов контейнера → очистка подписчиков. Ожидающие `whenReady()` отклоняются.
use: При удалении страницы/компонента (SPA), перед повторным созданием грида на том же элементе.
limits: После `destroy()` изменяющие методы бросают `DESTROYED`; `getState()`, `isDestroyed()`, `off()` продолжают работать.
errors: Не бросает.
example:
window.addEventListener('pagehide', () => grid.destroy());
related: `isDestroyed()`, `unuse()`, событие `destroy`.
:::

:::method grid.flush()
purpose: Синхронно выполняет отложенную раскладку и обновление окна.
syntax:
grid.insert(item);
grid.flush();
params: —
returns: `this`.
inside: Изменения данных помечают геометрию устаревшей и планируют перерасчёт на ближайший кадр (`requestAnimationFrame`), объединяя несколько изменений в один проход. `flush()` выполняет этот проход немедленно.
use: Когда сразу после изменения данных нужен актуальный DOM (тесты, измерения). Методы чтения геометрии (`getItem`, `scrollToIndex`, Plugin API `geometry.*`) вызывают раскладку сами.
limits: Не нужен в обычном прикладном коде.
errors: —
example:
grid.insert(photo);
grid.flush();
console.log(grid.getState().virtualization.mounted);
related: `refresh()`, событие `layout:end`.
:::

:::method grid.whenReady()
purpose: Возвращает Promise, который выполняется после первой раскладки.
syntax:
await grid.whenReady();
params: —
returns: `Promise<ABI7Grid>`. Если грид уничтожен до готовности — отклоняется `ABI7Error('DESTROYED')`.
inside: Пока грид не готов, вызовы ставятся в очередь; при событии `ready` очередь выполняется.
use: Когда нужно выполнить код после появления первой геометрии.
limits: Если контейнер скрыт (ширина 0) или layout не зарегистрирован, Promise ждёт, пока это не изменится.
errors: `DESTROYED` (rejection).
example:
const grid = new ABI7Grid('#gallery', { data: photos });
await grid.whenReady();
grid.scrollToIndex(100);
related: событие `ready`, `getState().ready`.
:::

## Data

:::method grid.data([list])
purpose: Без аргументов возвращает копию массива записей, с массивом — заменяет данные (то же, что `setData`).
syntax:
const records = grid.data();
grid.data(newList);
params:
list | `object[]` | — | Новый набор записей. Без аргумента метод работает как геттер.
returns: Геттер: `object[]` (копия массива; сами объекты — те же). Сеттер: `this`.
inside: Записи хранятся в `DataStore` параллельно с массивом id; геттер отдаёт `slice()`.
use: Чтобы прочитать текущий порядок записей, например после Drag & Drop.
limits: Записи без поля `id` получают внутренний id вида `abi7-1`; в самих объектах он не сохраняется (читайте `getItems()[i].id`).
errors: `INVALID_DATA`, `DUPLICATE_ID`.
example:
grid.on('drag:end', () => localStorage.setItem('order', JSON.stringify(grid.data().map(p => p.id))));
related: `setData()`, `getItems()`.
:::

:::method grid.setData(list)
purpose: Полностью заменяет набор данных.
syntax:
grid.setData(photos);
params:
list | `object[]` | обязательный | Новые записи. Массив копируется (`slice`), но объекты не клонируются и не изменяются.
returns: `this`.
inside: Проверяет записи и уникальность id, отменяет текущую асинхронную загрузку, сбрасывает размерный кэш и классы элементов, выставляет сброс прокрутки, переименовывает смонтированные элементы на новые записи (DOM переиспользуется) и планирует полный перерасчёт. События: `data:load-start` → `data:load-end` → `layout:start` → `layout:end`.
use: Смена набора данных, фильтрация, поиск.
limits: Выделение плагина Selection сбрасывается (id могли исчезнуть). Для асинхронного источника используйте `load()`.
errors: `INVALID_DATA` (не массив / не объект в массиве), `DUPLICATE_ID`, `INVALID_ID`. При ошибке данные не меняются, а `data:load-end` содержит поле `error`.
example:
searchInput.oninput = () => grid.setData(all.filter(p => p.title.includes(searchInput.value)));
related: `load()`, `insert()`, события `data:load-start`, `data:load-end`.
:::

:::method grid.load(source)
purpose: Асинхронная загрузка данных: функция, Promise или массив.
syntax:
await grid.load(({ signal }) => fetch('/api/photos', { signal }).then(r => r.json()));
params:
source | `function` или `Promise` или `object[]` | обязательный | Функция получает `{ signal: AbortSignal, source: string }` и возвращает массив или Promise массива.
returns: `Promise<ABI7Grid>`; никогда не отклоняется.
inside: Каждый вызов увеличивает внутренний токен загрузки и прерывает `AbortController` предыдущей. Результат применяется только если токен актуален и грид не уничтожен — это защита от гонок. Ошибка (исключение, reject, неверный формат) превращается в `data:load-end` с полем `error` и событие `error`.
use: Данные с сервера, пагинация «с заменой».
limits: Для догрузки «в конец» используйте `insert()`.
errors: `DESTROYED`. Ошибки загрузчика — только через событие `error`.
example:
grid.on('error', (e) => console.warn(e.source, e.message));
await grid.load(async ({ signal }) => (await fetch('/api/photos', { signal })).json());
related: `reload()`, `setData()`, события `data:load-start`, `data:load-end`, `error`.
:::

:::method grid.insert(items, [options])
purpose: Вставляет одну или несколько записей.
syntax:
grid.insert(photo);
grid.insert([a, b], { at: 'start' });
params:
items | `object` или `object[]` | обязательный | Запись или массив записей.
options.at | `number` или `'start'` или `'end'` | `'end'` | Позиция вставки.
returns: `Array<string|number>` — id вставленных записей (пустой массив для пустого списка).
inside: Фиксирует якорь скролла, вставляет записи, переиндексирует смонтированные элементы, помечает геометрию устаревшей начиная с позиции вставки (частичный перерасчёт) и один раз вызывает `item:insert`.
use: Догрузка страниц данных (`at: 'end'`), добавление новой карточки.
limits: Если окно прокручено вниз, вставка выше окна не сдвигает видимое содержимое (Scroll Anchoring). При `scrollTop = 0` новая карточка видна сразу.
errors: `DUPLICATE_ID`, `INVALID_DATA`, `INVALID_ARGUMENT` (неверный `at`).
example:
grid.on('reach:end', async () => grid.insert(await fetchNextPage()));
related: `remove()`, `move()`, событие `item:insert`, событие `reach:end`.
:::

:::method grid.remove(idOrIds)
purpose: Удаляет запись или несколько записей по id.
syntax:
grid.remove('photo-1');
grid.remove(['a', 'b']);
params:
idOrIds | `id` или `id[]` | обязательный | Идентификаторы удаляемых записей. Несуществующие игнорируются.
returns: `number` — сколько записей удалено.
inside: Удаляет записи из хранилища, сбрасывает связанные кэши и закрепления, размонтирует DOM, планирует частичный перерасчёт с позиции первой удалённой записи и один раз вызывает `item:remove`.
use: Удаление карточки, корзина, перенос в другой грид.
limits: Событие не вызывается, если ничего не удалено.
errors: `DESTROYED`.
example:
const removed = grid.remove(selection.getSelected());
related: `insert()`, событие `item:remove`.
:::

:::method grid.update(id, patch)
purpose: Обновляет поля записи.
syntax:
grid.update('photo-1', { title: 'New', height: 500 });
params:
id | `id` | обязательный | Идентификатор записи.
patch | `object` | обязательный | Изменяемые поля. Сам объект записи не мутируется — создаётся его копия с тем же прототипом.
returns: `boolean` — `false`, если записи нет.
inside: Если изменились поля, влияющие на размер (`width`, `height`, `aspectRatio` согласно `fields`), геометрия пересчитывается с этой записи; в любом случае карточка перерисовывается и вызывается `item:update`.
use: Смена подписи, размеров, любых пользовательских данных.
limits: Менять `id` нельзя.
errors: `INVALID_ID` (попытка сменить id), `INVALID_DATA`.
example:
grid.update('photo-3', { title: 'Закат', width: 1200, height: 800 });
related: событие `item:update`, опция `fields`.
:::

:::method grid.move(id, toIndex)
purpose: Перемещает запись на новую позицию.
syntax:
grid.move('photo-5', 0);
params:
id | `id` | обязательный | Идентификатор.
toIndex | `number` | обязательный | Новый индекс (ограничивается диапазоном).
returns: `boolean` — `false`, если запись не найдена или позиция не изменилась.
inside: Перестановка в хранилище, переиндексация DOM, частичный перерасчёт с `min(from, to)`, анимация, событие `item:move` (`source: 'api'`). Тем же путём работает Drag & Drop.
use: Сортировка, «поднять наверх».
limits: Новый порядок хранится только в гриде; сохраняйте его сами (`data()`).
errors: `DESTROYED`.
example:
grid.move('photo-9', 0);
related: событие `item:move`, Drag & Drop.
:::

:::method grid.getCount()
purpose: Число записей.
syntax:
const n = grid.getCount();
params: —
returns: `number`.
inside: Длина внутреннего массива записей.
use: Статистика, проверки.
limits: Не зависит от виртуализации (это число всех записей, а не DOM-элементов).
errors: —
example:
counter.textContent = grid.getCount();
related: `getState()`.
:::

## Items

:::method grid.getItem(id)
purpose: Возвращает описание элемента.
syntax:
const item = grid.getItem('photo-1');
params:
id | `id` | обязательный | Идентификатор.
returns: `Item` или `null`. Поля: `id`, `index`, `data` (запись), `rect` (`Rect`), `element` (`HTMLElement` или `null`, если карточка сейчас не в DOM), `visible` (`boolean`, пересекает ли карточка окно без overscan).
inside: Если геометрия устарела, сначала выполняется отложенная раскладка.
use: Узнать координаты, размер и текущее состояние карточки.
limits: Возвращаются копии координат (`rect` — снимок). `element` меняется при переиспользовании DOM — не храните его.
errors: —
example:
const { rect, visible } = grid.getItem('photo-7');
related: `getItems()`, `getVisibleItems()`.
:::

:::method grid.getItems()
purpose: Описания всех элементов в порядке данных.
syntax:
const all = grid.getItems();
params: —
returns: `Item[]` (см. `getItem`).
inside: Для каждой записи создаётся объект-описание — операция O(n).
use: Отладка, небольшие наборы, экспорт порядка.
limits: Для десятков тысяч записей вызывайте редко; используйте `getVisibleItems()` или `data()`.
errors: —
example:
const order = grid.getItems().map(i => i.id);
related: `getItem()`, `data()`.
:::

:::method grid.getVisibleItems()
purpose: Элементы, находящиеся в видимой области (без overscan).
syntax:
const visible = grid.getVisibleItems();
params: —
returns: `Item[]`, у каждого `visible: true` и `element` (DOM-узел).
inside: Запрос к пространственному индексу геометрии — O(k), k — число видимых.
use: Подсветка, аналитика показов, ленивые действия.
limits: Учитывает текущую позицию прокрутки; после программной прокрутки результат актуален сразу.
errors: —
example:
const ids = grid.getVisibleItems().map(i => i.id);
related: события `item:visible`, `item:hidden`.
:::

## Navigation

:::method grid.scrollToIndex(index, [options])
purpose: Прокручивает так, чтобы элемент с данным индексом оказался в окне.
syntax:
grid.scrollToIndex(500);
grid.scrollToIndex(500, { align: 'center', behavior: 'smooth' });
params:
index | `number` | обязательный | Индекс записи.
options.align | `'start'`, `'center'`, `'end'`, `'nearest'` | `'start'` | Выравнивание элемента в окне.
options.offset | `number` | `0` | Дополнительное смещение, px.
options.behavior | `'auto'`, `'smooth'` | `'auto'` | Режим прокрутки.
returns: `boolean` — `false`, если индекс вне диапазона.
inside: Координаты берутся из готовой геометрии, DOM для промежуточных элементов не создаётся. Ось прокрутки определяется layout (вертикальная или горизонтальная). Значение ограничивается размером контента.
use: «Перейти к карточке», восстановление позиции, поиск.
limits: Для layout с измеряемой высотой (`virtualization.measure`) координаты уточняются после измерения.
errors: `DESTROYED`.
example:
grid.scrollToIndex(1200, { align: 'center' });
related: `scrollToItem()`, `getVisibleItems()`.
:::

:::method grid.scrollToItem(id, [options])
purpose: То же, что `scrollToIndex`, но по id.
syntax:
grid.scrollToItem('photo-500', { align: 'nearest' });
params:
id | `id` | обязательный | Идентификатор.
options | `object` | `{}` | См. `scrollToIndex`.
returns: `boolean` — `false`, если id не найден.
inside: Переводит id в индекс и вызывает `scrollToIndex`.
use: Когда известен id, а не позиция.
limits: —
errors: `DESTROYED`.
example:
grid.scrollToItem(selection.getSelected()[0]);
related: `scrollToIndex()`.
:::

## Plugins

:::method grid.use(plugin, [options])
purpose: Устанавливает плагин.
syntax:
grid.use(SelectionPlugin, { multiple: true });
params:
plugin | `object` | обязательный | Объект плагина: `name`, `version`, `apiVersion`, `install(api, options)`.
options | `object` | `{}` | Опции плагина; объединяются с `plugin.defaults`.
returns: `this`.
inside: Проверяет контракт и совместимость `apiVersion` с версией API ядра, наличие зависимостей и дубликата, создаёт изолированный Plugin API, вызывает `install()`. Всё, что плагин зарегистрировал через API, отслеживается. При ошибке в `install()` выполняется откат (подписки, features, layout), исключение пробрасывается. После успеха — событие `plugin:install`.
use: Подключение функциональности и layout-плагинов.
limits: `install()` должна быть синхронной. Нельзя установить два плагина с одним именем.
errors: `PluginError` с кодами `PLUGIN_INVALID`, `PLUGIN_INCOMPATIBLE`, `PLUGIN_DUPLICATE`, `PLUGIN_DEPENDENCY`, `PLUGIN_INSTALL_FAILED`, `PLUGIN_FEATURE_CONFLICT`.
example:
try { grid.use(LightboxPlugin, { loop: true }); }
catch (e) { console.error(e.code, e.message); }
related: `unuse()`, `getPlugin()`, [Plugin API](#/api-plugin), событие `plugin:install`.
:::

:::method grid.unuse(name)
purpose: Отключает плагин.
syntax:
grid.unuse('selection');
params:
name | `string` | обязательный | Имя плагина.
returns: `boolean` — `false`, если плагин не установлен.
inside: Вызывается функция очистки, возвращённая `install()`; затем в обратном порядке снимаются все подписки, features, layout и disposables. Выполняется `plugin:uninstall` с `reason: 'unuse'`. Если активный layout принадлежал плагину, грид переключается на `masonry` и отправляет `error` с кодом `LAYOUT_REMOVED`.
use: Динамическое отключение возможностей.
limits: Нельзя отключить плагин, от которого зависит другой (`PLUGIN_REQUIRED`).
errors: `PluginError` `PLUGIN_REQUIRED`.
example:
grid.unuse('lightbox');
related: `use()`, событие `plugin:uninstall`.
:::

:::method grid.getPlugin(name)
purpose: Возвращает публичный интерфейс плагина.
syntax:
const selection = grid.getPlugin('selection');
params:
name | `string` | обязательный | Имя feature (обычно совпадает с именем плагина).
returns: Объект, зарегистрированный через `api.features.register(name, impl)`, или `null`.
inside: Поиск в реестре features данного экземпляра.
use: Вызывать методы плагина.
limits: Плагин, не зарегистрировавший feature, возвращает `null` — проверяйте `hasPlugin()`.
errors: —
example:
grid.getPlugin('selection')?.selectAll();
related: `hasPlugin()`, `getPlugins()`.
:::

:::method grid.hasPlugin(name)
purpose: Проверяет, установлен ли плагин.
syntax:
if (grid.hasPlugin('lightbox')) { /* ... */ }
params:
name | `string` | обязательный | Имя плагина.
returns: `boolean`.
inside: Поиск в реестре установленных плагинов.
use: Условная логика.
limits: —
errors: —
example:
if (!grid.hasPlugin('selection')) grid.use(SelectionPlugin);
related: `getPlugins()`.
:::

:::method grid.getPlugins()
purpose: Список установленных плагинов.
syntax:
console.table(grid.getPlugins());
params: —
returns: `Array<{ name, version, apiVersion, options }>` в порядке установки.
inside: Снимок реестра.
use: Отладка.
limits: `options` — замороженный объект.
errors: —
example:
grid.getPlugins().map(p => p.name);
related: `use()`, `unuse()`.
:::

## Events

:::method grid.on(eventName, callback)
purpose: Подписка на событие.
syntax:
const off = grid.on('item:click', (event) => console.log(event.id));
params:
eventName | `string` | обязательный | Имя события или `'*'` (все события; callback получает `(event, name)`).
callback | `function` | обязательный | Обработчик `(event, name) => void`.
returns: `function` — вызовите её для отписки.
inside: Обработчики вызываются в порядке подписки. Исключение в обработчике перехватывается и превращается в событие `error` (`source: 'listener'`), остальные обработчики выполняются.
use: Реакция на любые события грида и плагинов.
limits: Обработчик не должен быть асинхронным «долгим» — события вызываются синхронно. Подписчики очищаются при `destroy()`.
errors: `TypeError` — неверное имя или не функция.
example:
const off = grid.on('layout:end', e => console.log(e.info));
off();
related: `off()`, `once()`, [Events](#/api-events).
:::

:::method grid.once(eventName, callback)
purpose: Подписка на одно срабатывание.
syntax:
grid.once('ready', () => console.log('первая раскладка'));
params:
eventName | `string` | обязательный | Имя события.
callback | `function` | обязательный | Обработчик.
returns: `function` — отписка до срабатывания.
inside: Обработчик удаляется перед вызовом.
use: Однократные действия.
limits: —
errors: `TypeError`.
example:
grid.once('layout:end', () => grid.scrollToIndex(10));
related: `on()`, `off()`.
:::

:::method grid.off(eventName, callback)
purpose: Отписка обработчика.
syntax:
grid.off('item:click', handler);
params:
eventName | `string` | обязательный | Имя события.
callback | `function` | обязательный | Та же функция, что передавалась в `on()`.
returns: `boolean` — найден ли обработчик.
inside: Удаляется один (последний подписанный) экземпляр функции.
use: Отписка по ссылке на функцию.
limits: Анонимные функции отписать этим способом нельзя — сохраняйте возвращаемое значение `on()`.
errors: —
example:
const handler = (e) => {};
grid.on('scroll', handler);
grid.off('scroll', handler);
related: `on()`, `once()`.
:::

## State

:::method grid.getState()
purpose: Снимок состояния грида.
syntax:
const state = grid.getState();
params: —
returns: Объект: `phase` (`'new'`, `'loading'`, `'pending'`, `'ready'`, `'destroyed'`), `ready`, `destroyed`, `loading`, `hidden`, `visible`, `layout`, `pendingLayout`, `axis`, `count`, `contentWidth`, `contentHeight`, `layoutInfo` (то, что вернул layout), `viewport` (`scrollLeft`, `scrollTop`, `width`, `height`, `axis`, `overscan`), `virtualization` (`enabled`, `mounted`, `pooled`, `created`, `reused`, `pinned`, `velocity`, `overscan`), `plugins` (имена).
inside: Собирается из внутренних счётчиков без обхода DOM.
use: Отладка, панели статистики, тесты.
limits: Это копия: изменение результата не влияет на грид.
errors: —
example:
const { mounted, pooled, created, reused } = grid.getState().virtualization;
related: `isDestroyed()`.
:::

:::method grid.isDestroyed()
purpose: Проверка, что экземпляр уничтожен.
syntax:
if (!grid.isDestroyed()) grid.refresh();
params: —
returns: `boolean`.
inside: Читает флаг жизненного цикла.
use: Асинхронный код, который мог пережить грид.
limits: —
errors: —
example:
fetchPhotos().then(list => { if (!grid.isDestroyed()) grid.setData(list); });
related: `destroy()`.
:::

## Static

:::method ABI7Grid.registerLayout(name, definition, [options])
purpose: Глобально регистрирует layout, доступный всем гридам страницы.
syntax:
ABI7Grid.registerLayout('horizontal', HorizontalLayout);
params:
name | `string` | обязательный | Имя для `options.layout`.
definition | `object` | обязательный | Определение layout (`create()` или `compute()`) либо plugin-объект с полем `layout`.
options.override | `boolean` | `false` | Разрешить замену существующего layout.
returns: `undefined`.
inside: Определение нормализуется (`axis`, `responsive`, `defaults`), помещается в глобальный реестр; грид, ожидающий этот layout, автоматически продолжает запуск.
use: Layout-плагин нужен нескольким гридам.
limits: Встроенные layout можно заменить только с `override: true`.
errors: `INVALID_LAYOUT`, `LAYOUT_EXISTS`.
example:
ABI7Grid.registerLayout('stack', { compute(ctx) { /* ... */ } });
related: `unregisterLayout()`, `getLayouts()`, [Layout API](#/api-plugin/layout-api).
:::

:::method ABI7Grid.unregisterLayout(name)
purpose: Удаляет глобально зарегистрированный layout.
syntax:
ABI7Grid.unregisterLayout('horizontal');
params:
name | `string` | обязательный | Имя layout.
returns: `boolean`.
inside: Удаление из глобального реестра. Уже работающие гриды сохраняют созданный движок.
use: Тесты, динамические расширения.
limits: Встроенные layout не удаляются.
errors: `LAYOUT_BUILTIN`.
example:
ABI7Grid.unregisterLayout('stack');
related: `registerLayout()`.
:::

:::method ABI7Grid.getLayouts()
purpose: Имена глобально зарегистрированных layout.
syntax:
ABI7Grid.getLayouts(); // ['masonry', 'grid', 'justified']
params: —
returns: `string[]`.
inside: Ключи глобального реестра.
use: Выпадающий список выбора layout.
limits: Layout, зарегистрированные плагином на одном гриде (`api.layouts.register`), сюда не попадают.
errors: —
example:
select.innerHTML = ABI7Grid.getLayouts().map(n => `<option>${n}</option>`).join('');
related: `registerLayout()`.
:::

:::method ABI7Grid.fromLegacyOptions(legacy)
purpose: Преобразует настройки старой версии в новые.
syntax:
const { options, unmapped } = ABI7Grid.fromLegacyOptions(oldConfig);
params:
legacy | `object` | `{}` | Объект настроек старого `abi7_grid`.
returns: `{ options, unmapped }` — новые опции и список настроек, которые нужно перенести вручную (события, `funcItemLoad` и др.).
inside: Переносит `items.minWidth/maxWidth`, `maxColumns`, `space`, `items.aspectRatio/height`, `padding`, `animation`, `items.sortable`, `grid.height`, `data`.
use: Пошаговая миграция.
limits: Функции загрузки и события не конвертируются автоматически.
errors: —
example:
const { options, unmapped } = ABI7Grid.fromLegacyOptions(oldConfig);
const grid = new ABI7Grid('#gallery', options);
related: [Migration](#/migration).
:::

Статические свойства: `ABI7Grid.version` (`'1.0.0'`), `ABI7Grid.apiVersion` (версия Plugin API, `'1.0.0'`), `ABI7Grid.defaults` (копия настроек по умолчанию).

## Deprecated

:::method grid.itemInsert(data, [done])
purpose: Совместимость со старым API: вставка в начало.
syntax:
grid.itemInsert(photo);
params:
data | `object` | обязательный | Запись.
done | `function` | — | Вызывается после `layout:end`.
returns: id вставленной записи.
inside: `insert(data, { at: 'start' })`.
use: Только в старом коде.
limits: Устарел.
errors: Как у `insert()`.
example:
grid.itemInsert({ id: 'x', width: 1, height: 1 });
related: `insert()`.
:::

:::method grid.items()
purpose: Совместимость со старым API.
syntax:
const list = grid.items();
params: —
returns: То же, что `getItems()` (формат изменился: вместо внутренних объектов — описания `Item`).
inside: Вызов `getItems()`.
use: Только в старом коде.
limits: Устарел.
errors: —
example:
grid.items().length;
related: `getItems()`.
:::
