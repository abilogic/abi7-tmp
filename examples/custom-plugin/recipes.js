// Три плагина разной сложности — «рецепты» из руководства по созданию плагинов.
// Каждый использует только Plugin API и не импортирует Core.
// Код проверяется автоматическими тестами (tests/docs.test.js).

/* ------------------------------------------------------------------ *
 * 1. LoggerPlugin — минимальный плагин: подписка на все события.
 *    Показывает: name/version/apiVersion, defaults, подписку '*', очистку.
 * ------------------------------------------------------------------ */
export const LoggerPlugin = {
  name: 'logger',
  version: '1.0.0',
  apiVersion: '^1.0.0',
  defaults: { prefix: '[grid]', ignore: ['scroll', 'viewport:update', 'drag:move'] },

  install(api, options) {
    const lines = [];

    // '*' — подписка на все события. Отписка произойдёт автоматически при unuse()/destroy().
    api.events.on('*', (event, name) => {
      if (options.ignore.includes(name)) return;
      lines.push(`${options.prefix} ${name}`);
      console.log(options.prefix, name, event);
    });

    api.features.register('logger', { getLines: () => lines.slice(), clear: () => (lines.length = 0) });
  }
};

/* ------------------------------------------------------------------ *
 * 2. TooltipPlugin — работа с DOM переиспользуемых элементов.
 *    Показывает: item:mount / item:unmount, почему нельзя «приклеить» атрибут один раз.
 * ------------------------------------------------------------------ */
export const TooltipPlugin = {
  name: 'tooltip',
  version: '1.0.0',
  apiVersion: '^1.0.0',
  defaults: { text: (record) => record.title || '' },

  install(api, options) {
    // DOM-узел показывает разные записи в разное время, поэтому атрибут ставится при КАЖДОЙ привязке.
    api.events.on('item:mount', ({ element, item }) => {
      const text = options.text(item);
      if (text) element.setAttribute('title', text);
      else element.removeAttribute('title');
    });
    api.events.on('item:unmount', ({ element }) => element.removeAttribute('title'));

    // Узлы, которые уже в DOM к моменту установки, обновляем через публичный метод.
    api.renderer.refresh();

    return () => api.renderer.refresh(); // после отключения привязываем карточки заново — без подсказок
  }
};

/* ------------------------------------------------------------------ *
 * 3. KeyboardNavPlugin — клавиатурная навигация стрелками по любому layout.
 *    Показывает: api.geometry.hitTest, api.viewport.scrollToItem, api.renderer.toggleClass,
 *    собственные события и feature, addDisposable для слушателя DOM.
 * ------------------------------------------------------------------ */
export const KeyboardNavPlugin = {
  name: 'keyboard-nav',
  version: '1.0.0',
  apiVersion: '^1.0.0',
  defaults: { className: 'abi7-kb-focus' },

  install(api, options) {
    const root = api.renderer.root(); // корневой элемент грида: у него tabindex="0", он получает клавиши
    let current = null;

    const focus = (id) => {
      if (current !== null) api.renderer.toggleClass(current, options.className, false);
      current = id;
      if (id === null) return;
      api.renderer.toggleClass(id, options.className, true);
      api.viewport.scrollToItem(id, { align: 'nearest' });
      api.events.emit('keyboard-nav:focus', { id });
    };

    // Ищем соседа в направлении стрелки: «ощупываем» геометрию точками на расстоянии 4, 8, 12… px
    // от границы текущей карточки. Это работает для Masonry, Grid, Justified и любых других layout.
    const neighbour = (id, dx, dy) => {
      const r = api.geometry.get(id);
      if (!r) return null;
      for (let d = 4; d <= 64; d += 4) {
        const x = dx > 0 ? r.right + d : dx < 0 ? r.x - d : r.x + r.width / 2;
        const y = dy > 0 ? r.bottom + d : dy < 0 ? r.y - d : r.y + r.height / 2;
        const i = api.geometry.hitTest(x, y);
        if (i >= 0) return api.data.ids()[i];
      }
      return null;
    };

    const directions = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };

    const onKey = (e) => {
      if (e.key === 'Enter' && current !== null) {
        api.events.emit('keyboard-nav:activate', { id: current });
        return;
      }
      const dir = directions[e.key];
      if (!dir) return;
      e.preventDefault();
      if (current === null || !api.data.has(current)) {
        const ids = api.data.ids();
        const first = api.viewport.range().first;
        if (ids.length) focus(ids[Math.max(0, first)]);
        return;
      }
      const next = neighbour(current, dir[0], dir[1]);
      if (next !== null && next !== undefined) focus(next);
    };

    root.addEventListener('keydown', onKey);
    // Слушатель вешает САМ плагин (вне API), поэтому он же и обязан снять его.
    api.lifecycle.addDisposable(() => root.removeEventListener('keydown', onKey));

    api.features.register('keyboard-nav', { focus, current: () => current });

    return () => {
      if (current !== null) api.renderer.toggleClass(current, options.className, false);
      current = null;
    };
  }
};
