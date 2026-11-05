// CounterPlugin — плагин «с нуля»: считает клики по карточкам.
// Файл не импортирует Core и ничего не знает о его внутреннем устройстве:
// всё взаимодействие идёт через объект `api`, который ядро передаёт в install().

const CounterPlugin = {
  // Уникальное имя плагина в пределах грида. По нему работают grid.unuse('counter'),
  // grid.getPlugin('counter') и защита от повторного подключения.
  name: 'counter',

  // Версия самого плагина (semver). Показывается в grid.getPlugins() и в событиях plugin:install.
  version: '1.0.0',

  // Диапазон версий API ядра, с которыми плагин совместим. Если ядро не подходит,
  // grid.use() бросит PluginError (PLUGIN_INCOMPATIBLE) и ничего не установит.
  apiVersion: '^1.0.0',

  // Значения по умолчанию. Ядро объединит их с опциями из grid.use(plugin, options)
  // и передаст в install() вторым аргументом (объект заморожен — менять его нельзя).
  defaults: {
    step: 1, // на сколько увеличивать счётчик за один клик
    badges: true, // показывать значок с числом кликов на карточке
    filter: null // (record) => boolean — какие карточки считать; null — все
  },

  // install вызывается один раз при grid.use(). Возвращаемая функция — «очистка».
  install(api, options) {
    // ---- Состояние ----
    // Переменные объявлены ВНУТРИ install(), поэтому у каждого грида своя копия:
    // два грида с одним CounterPlugin считают клики независимо друг от друга.
    let total = 0;
    const perItem = new Map(); // id записи → число кликов

    // ---- Работа с DOM ----
    // DOM-элементы в ABI7 Grid переиспользуются (DOM Pool): один и тот же <div> в разные
    // моменты показывает разные записи. Поэтому значок нельзя «приклеить» к элементу один раз —
    // его нужно ставить заново каждый раз, когда элемент привязывается к записи (item:mount).
    const paintBadge = (el, id) => {
      const old = el.querySelector('.counter-badge');
      const count = perItem.get(id) || 0;
      if (!options.badges || count === 0) {
        if (old) old.remove();
        return;
      }
      const badge = old || el.appendChild(Object.assign(document.createElement('span'), { className: 'counter-badge' }));
      badge.textContent = String(count); // textContent: число не может содержать HTML
    };

    // ---- Подписки на события Core ----
    // api.events.on возвращает функцию отписки, но вручную вызывать её не обязательно:
    // ядро само снимет все подписки плагина при unuse() и destroy().
    api.events.on('item:click', (event) => {
      if (event.defaultPrevented) return; // другой обработчик отменил клик
      if (typeof options.filter === 'function' && !options.filter(event.item)) return;

      total += options.step;
      const count = (perItem.get(event.id) || 0) + options.step;
      perItem.set(event.id, count);

      const el = api.renderer.getElement(event.id); // null, если элемент сейчас не в DOM
      if (el) paintBadge(el, event.id);

      // Собственное событие плагина. Имя обязано начинаться с «counter:» —
      // ядро запрещает плагинам генерировать чужие события (item:click и т.п.).
      api.events.emit('counter:change', { id: event.id, count, total });
    });

    api.events.on('item:mount', (e) => paintBadge(e.element, e.id));
    api.events.on('item:unmount', (e) => e.element.querySelector('.counter-badge')?.remove());

    // Если данные заменили целиком — старые id больше не существуют, счётчики сбрасываем.
    api.events.on('data:load-end', () => feature.reset());

    // ---- Публичный интерфейс ----
    // Всё, что вернёт register(), станет результатом grid.getPlugin('counter').
    const feature = {
      getTotal: () => total,
      getCount: (id) => perItem.get(id) || 0,
      /** Самые кликаемые записи: [{ id, count }, ...] */
      top: (n = 3) => [...perItem].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, n),
      reset() {
        if (total === 0 && perItem.size === 0) return; // нечего сбрасывать — событие не нужно
        const previousTotal = total;
        const ids = [...perItem.keys()];
        total = 0;
        perItem.clear();
        for (const id of ids) {
          const el = api.renderer.getElement(id);
          if (el) paintBadge(el, id);
        }
        api.events.emit('counter:reset', { previousTotal });
      }
    };
    api.features.register('counter', feature);

    // ---- Очистка ----
    // Подписки и feature ядро снимет само. Здесь убираем только то, что плагин
    // сделал вне API: значки в DOM.
    return () => {
      for (const id of perItem.keys()) {
        const el = api.renderer.getElement(id);
        if (el) el.querySelector('.counter-badge')?.remove();
      }
      perItem.clear();
    };
  }
};

export default CounterPlugin;
