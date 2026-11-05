/*!
 * @abi7/connected-grids v1.0.0 — перенос карточек между несколькими гридами.
 * (c) Alexander Momot. MIT License.
 *
 * Плагин подключается к КАЖДОМУ связываемому гриду с одинаковой опцией `group`.
 * Он использует встроенный Drag & Drop Core (события drag:move / drag:end) и публичные
 * методы данных (api.data.remove / api.data.insert) — внутренних структур Core не касается.
 *
 *   gridA.use(ConnectedGrids, { group: 'board', name: 'todo' });
 *   gridB.use(ConnectedGrids, { group: 'board', name: 'done' });
 */

// Реестр групп общий для всех гридов страницы. Это единственное разделяемое состояние плагина:
// именно через него экземпляры «находят» друг друга. Запись удаляется в функции очистки.
const GROUPS = new Map(); // group → Set<member>

export default {
  name: 'connected-grids',
  version: '1.0.0',
  apiVersion: '^1.0.0',

  defaults: {
    group: 'default', // гриды с одинаковым group связаны
    name: '', // имя участника (уникально в группе) — нужно для feature.transfer()
    copy: false, // true — копировать, а не переносить
    accept: null, // (record, { from, to }) => boolean — фильтр принимаемых записей
    overClass: 'abi7-connected-over' // класс подсветки целевого грида
  },

  install(api, options) {
    const idField = api.options.get('fields').id;

    // --- Проверка совместимости экземпляров ---
    const members = GROUPS.get(options.group) || new Set();
    for (const m of members) {
      if (m.coreMajor !== String(api.coreVersion).split('.')[0]) {
        throw new Error(`connected-grids: grid in group "${options.group}" uses an incompatible core version (${m.coreVersion} vs ${api.coreVersion})`);
      }
      if (typeof m.idField === 'string' && typeof idField === 'string' && m.idField !== idField) {
        throw new Error(`connected-grids: all grids in group "${options.group}" must use the same fields.id ("${m.idField}" vs "${idField}")`);
      }
      if (options.name && m.name === options.name) {
        throw new Error(`connected-grids: name "${options.name}" is already used in group "${options.group}"`);
      }
    }

    const root = api.renderer.root();
    const member = { api, root, idField, name: options.name, coreVersion: api.coreVersion, coreMajor: String(api.coreVersion).split('.')[0], over: false };
    members.add(member);
    GROUPS.set(options.group, members);

    // Перенос работает поверх Drag & Drop ядра — включаем его, запомнив прежнее значение.
    const dragWasEnabled = api.options.get('interaction.drag.enabled');
    if (!dragWasEnabled) api.options.set('interaction.drag.enabled', true);

    const others = () => [...members].filter((m) => m !== member);
    const targetAt = (x, y) =>
      others().find((m) => {
        const r = m.root.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      });
    const highlight = (m, on) => {
      if (m && m.over !== on) {
        m.over = on;
        m.root.classList.toggle(options.overClass, on);
      }
    };
    const clearHighlights = () => others().forEach((m) => highlight(m, false));

    // Если id уже занят в целевом гриде — подбираем свободный, чтобы не потерять запись.
    const freeId = (target, id) => {
      if (!target.api.data.has(id)) return id;
      let n = 2;
      while (target.api.data.has(`${id}-${n}`)) n++;
      return `${id}-${n}`;
    };

    /** Переносит запись `id` из этого грида в `target` (участник группы). */
    function transferTo(target, id, at) {
      if (!api.data.has(id)) return false;
      const record = api.data.getById(id);
      const ctx = { from: member.name || options.group, to: target.name || options.group };
      if (typeof options.accept === 'function' && !options.accept(record, ctx)) return false;
      const ok = api.events.emitCancelable('connected-grids:before-transfer', { id, record, ...ctx });
      if (!ok) return false;
      const newId = freeId(target, id);
      const copy = typeof idField === 'string' && newId !== id ? { ...record, [idField]: newId } : record;
      const where = Number.isInteger(at) ? at : target.api.data.count();
      if (!options.copy) api.data.remove(id);
      target.api.data.insert(copy, { at: where });
      api.events.emit('connected-grids:transfer', { id, newId, record, copy: !!options.copy, index: where, ...ctx });
      target.api.events.emit('connected-grids:receive', { id: newId, from: ctx.from, record: copy, index: where });
      return true;
    }

    api.events.on('drag:move', (e) => {
      const t = e.outside ? targetAt(e.clientX, e.clientY) : null;
      others().forEach((m) => highlight(m, m === t));
    });

    api.events.on('drag:end', (e) => {
      clearHighlights();
      if (e.cancelled || !e.outside) return;
      const target = targetAt(e.clientX, e.clientY);
      if (!target) return;
      // Позиция вставки: элемент под курсором в целевом гриде или конец списка.
      const idx = target.api.viewport.indexAtClientPoint(e.clientX, e.clientY, { nearest: true });
      transferTo(target, e.id, idx >= 0 ? idx : undefined);
    });

    api.features.register('connected-grids', {
      group: options.group,
      name: options.name,
      members: () => [...members].map((m) => m.name || '(unnamed)'),
      /** Программный перенос: grid.getPlugin('connected-grids').transfer('card-1', 'done') */
      transfer(id, targetName, opts = {}) {
        const target = others().find((m) => m.name === targetName);
        if (!target) throw new Error(`connected-grids: no grid named "${targetName}" in group "${options.group}"`);
        return transferTo(target, id, opts.at);
      }
    });

    return () => {
      clearHighlights();
      members.delete(member);
      if (!members.size) GROUPS.delete(options.group);
      root.classList.remove(options.overClass);
      if (!dragWasEnabled) {
        try { api.options.set('interaction.drag.enabled', false); } catch (_) { /* грид уже уничтожается */ }
      }
    };
  }
};
