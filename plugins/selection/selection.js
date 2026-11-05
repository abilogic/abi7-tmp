/*!
 * @abi7/selection v1.0.0 — плагин выделения элементов для ABI7 Grid.
 * (c) Alexander Momot. MIT License.
 *
 * Плагин НЕ импортирует Core: он общается с гридом только через Plugin API (`api`).
 * Подключение:  grid.use(SelectionPlugin, { multiple: true });
 * Доступ:       grid.getPlugin('selection').select('photo-1');
 */

export default {
  name: 'selection',
  version: '1.0.0',
  apiVersion: '^1.0.0',

  // Значения по умолчанию. Ядро объединит их с опциями, переданными в grid.use().
  defaults: {
    multiple: true, // разрешить несколько выделенных элементов
    className: 'abi7-selected', // CSS-класс выделенного элемента
    toggleOnClick: false, // обычный клик по единственному выделенному элементу снимает выделение
    keyboard: true // Ctrl/Cmd+A — выделить всё, Escape — снять выделение
  },

  install(api, options) {
    // Состояние живёт в замыкании install(): у каждого грида — свой экземпляр плагина.
    const selected = new Set(); // Set хранит порядок добавления
    let anchorId = null; // от этого элемента строится диапазон по Shift+клик

    // Класс назначается через api.renderer: ядро запомнит его по id и вернёт элементу,
    // даже если DOM-узел будет переиспользован для другой записи (DOM Pool).
    const paint = (id, on) => api.renderer.toggleClass(id, options.className, on);

    const emitChange = (added, removed, source) => {
      if (!added.length && !removed.length) return;
      // Собственные события плагина обязаны начинаться с "selection:" (имя плагина + двоеточие).
      api.events.emit('selection:change', { selected: [...selected], added, removed, source });
    };

    const applyDiff = (next, source) => {
      const added = [], removed = [];
      for (const id of [...selected]) if (!next.has(id)) { selected.delete(id); paint(id, false); removed.push(id); }
      for (const id of next) if (!selected.has(id)) { selected.add(id); paint(id, true); added.push(id); }
      emitChange(added, removed, source);
    };

    const feature = {
      select(id, source = 'api') {
        if (!api.data.has(id)) return false;
        const next = options.multiple ? new Set(selected) : new Set();
        next.add(id);
        anchorId = id;
        applyDiff(next, source);
        return true;
      },
      deselect(id, source = 'api') {
        if (!selected.has(id)) return false;
        const next = new Set(selected);
        next.delete(id);
        applyDiff(next, source);
        return true;
      },
      toggle(id, source = 'api') {
        // Возвращает итоговое состояние: true — элемент выделен.
        if (selected.has(id)) {
          feature.deselect(id, source);
          return false;
        }
        return feature.select(id, source);
      },
      clear(source = 'api') {
        applyDiff(new Set(), source);
      },
      selectAll(source = 'api') {
        if (!options.multiple) return [];
        applyDiff(new Set(api.data.ids()), source);
        return [...selected];
      },
      isSelected: (id) => selected.has(id),
      getSelected: () => [...selected],
      getSelectedItems: () => [...selected].map((id) => api.data.getById(id)),
      count: () => selected.size
    };

    // --- Реакция на клик ---
    const onClick = (e) => {
      if (e.defaultPrevented) return; // другой обработчик «забрал» клик
      const ev = e.originalEvent || {};
      const multiKey = ev.ctrlKey || ev.metaKey;
      const id = e.id;
      if (!options.multiple) {
        if (selected.has(id)) feature.deselect(id, 'click');
        else feature.select(id, 'click');
        return;
      }
      if (ev.shiftKey && anchorId !== null && api.data.has(anchorId)) {
        // Диапазон по порядку данных между якорем и кликнутым элементом.
        const a = api.data.indexOf(anchorId), b = api.data.indexOf(id);
        const ids = api.data.ids().slice(Math.min(a, b), Math.max(a, b) + 1);
        applyDiff(new Set(ids), 'click');
      } else if (multiKey) {
        if (selected.has(id)) feature.deselect(id, 'click');
        else feature.select(id, 'click');
      } else if (options.toggleOnClick && selected.size === 1 && selected.has(id)) {
        feature.clear('click');
      } else {
        const next = new Set([id]);
        anchorId = id;
        applyDiff(next, 'click');
      }
    };
    api.events.on('item:click', onClick);

    // --- Синхронизация с данными ---
    // Удалённые записи не должны оставаться в выделении.
    api.events.on('item:remove', (e) => {
      const next = new Set(selected);
      for (const it of e.items) next.delete(it.id);
      applyDiff(next, 'data');
    });
    // setData/reload заменяют весь набор — выделение сбрасывается, чтобы не хранить «мёртвые» id.
    api.events.on('data:load-end', () => {
      if (selected.size) applyDiff(new Set(), 'data');
      anchorId = null;
    });

    // --- Клавиатура (опционально) ---
    if (options.keyboard) {
      const root = api.renderer.root();
      const onKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && options.multiple) {
          e.preventDefault();
          feature.selectAll('keyboard');
        } else if (e.key === 'Escape') feature.clear('keyboard');
      };
      root.addEventListener('keydown', onKey);
      api.lifecycle.addDisposable(() => root.removeEventListener('keydown', onKey));
    }

    // Публичный интерфейс: grid.getPlugin('selection') вернёт именно этот объект.
    api.features.register('selection', feature);

    // Функция очистки: ядро вызовет её при grid.unuse('selection') и при grid.destroy().
    // Подписки api.events.on и api.features.register снимаются автоматически,
    // здесь нужно убрать только то, что плагин изменил сам — CSS-классы элементов.
    return () => {
      for (const id of selected) paint(id, false);
      selected.clear();
    };
  }
};
