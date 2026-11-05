import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { setupDom, makeContainer, scrollTo, photos, loadLib, makeGrid, pointer, tick, ROOT } from './helpers.js';

setupDom();
const plug = (p) => import(pathToFileURL(join(ROOT, 'plugins', p)).href);

const mini = (over = {}) => ({ name: 'mini', version: '1.0.0', apiVersion: '^1.0.0', install() {}, ...over });

for (const kind of ['src', 'min']) {
  describe(`Plugin System [${kind}]`, () => {
    let lib, Selection, Horizontal, Lightbox, Connected;
    before(async () => {
      lib = await loadLib(kind);
      [Selection, Horizontal, Lightbox, Connected] = (await Promise.all([plug('selection/selection.js'), plug('layout-horizontal/horizontal.js'), plug('lightbox/lightbox.js'), plug('connected-grids/connected-grids.js')])).map((m) => m.default);
    });

    /* ---------------- Plugin Manager ---------------- */

    it('контракт: обязательные поля, совместимость, повторное подключение', async () => {
      const { grid } = await makeGrid(lib, { data: photos(3) });
      assert.throws(() => grid.use(null), /object/);
      assert.throws(() => grid.use(mini({ name: '' })), /name/);
      assert.throws(() => grid.use(mini({ install: null })), /install/);
      assert.throws(() => grid.use(mini({ version: 'x' })), /version/);
      assert.throws(() => grid.use(mini({ apiVersion: undefined })), /apiVersion/);
      assert.throws(() => grid.use(mini({ apiVersion: '^2.0.0' })), (e) => e.code === 'PLUGIN_INCOMPATIBLE');
      assert.throws(() => grid.use(mini({ apiVersion: '>=1.0.0 <1.0.0' })), (e) => e.code === 'PLUGIN_INCOMPATIBLE');
      grid.use(mini({ apiVersion: '~1.0.0 || ^3' }));
      assert.throws(() => grid.use(mini()), (e) => e.code === 'PLUGIN_DUPLICATE');
      assert.equal(grid.hasPlugin('mini'), true);
      assert.equal(grid.unuse('mini'), true);
      assert.equal(grid.unuse('mini'), false);
      grid.destroy();
    });

    it('зависимости: нельзя поставить без зависимости и удалить, пока нужен другому', async () => {
      const { grid } = await makeGrid(lib, { data: photos(3) });
      const child = mini({ name: 'child', dependencies: ['mini'] });
      assert.throws(() => grid.use(child), (e) => e.code === 'PLUGIN_DEPENDENCY');
      grid.use(mini());
      grid.use(child);
      assert.throws(() => grid.unuse('mini'), (e) => e.code === 'PLUGIN_REQUIRED');
      grid.unuse('child');
      grid.unuse('mini');
      grid.destroy();
    });

    it('install получает options (defaults + пользовательские), this === plugin', async () => {
      const { grid } = await makeGrid(lib, { data: photos(1) });
      let seen;
      const p = mini({ defaults: { a: 1, nested: { x: 1, y: 2 } }, install(api, options) { seen = { options, self: this, name: api.name }; } });
      grid.use(p, { b: 2, nested: { y: 5 } });
      assert.deepEqual(seen.options, { a: 1, b: 2, nested: { x: 1, y: 5 } });
      assert.equal(seen.self, p);
      assert.equal(seen.name, 'mini');
      assert.throws(() => { 'use strict'; seen.options.a = 5; }, TypeError);
      grid.destroy();
    });

    it('ошибка в install: откат всех регистраций, исключение пробрасывается', async () => {
      const { grid } = await makeGrid(lib, { data: photos(3) });
      let fired = 0;
      const bad = mini({
        name: 'bad',
        install(api) {
          api.features.register('bad-feature', {});
          api.layouts.register('bad-layout', { compute() {} });
          api.events.on('item:insert', () => fired++);
          throw new Error('nope');
        }
      });
      assert.throws(() => grid.use(bad), (e) => e.code === 'PLUGIN_INSTALL_FAILED' && /nope/.test(e.message));
      assert.equal(grid.hasPlugin('bad'), false);
      grid.insert({ id: 'x' });
      assert.equal(fired, 0);
      grid.use(mini({ name: 'again', install(api) { api.features.register('bad-feature', { ok: 1 }); api.layouts.register('bad-layout', { compute() {} }); } }));
      assert.deepEqual(grid.getPlugin('bad-feature'), { ok: 1 });
      grid.destroy();
    });

    it('async install запрещён', async () => {
      const { grid } = await makeGrid(lib, { data: photos(1) });
      assert.throws(() => grid.use(mini({ install: async () => {} })), /synchronous/);
      assert.equal(grid.hasPlugin('mini'), false);
      grid.destroy();
    });

    it('features: getPlugin, конфликт имён, автоудаление при unuse', async () => {
      const { grid } = await makeGrid(lib, { data: photos(2) });
      grid.use(mini({ name: 'a', install(api) { api.features.register('shared', { who: 'a' }); } }));
      assert.deepEqual(grid.getPlugin('shared'), { who: 'a' });
      assert.throws(() => grid.use(mini({ name: 'b', install(api) { api.features.register('shared', {}); } })), (e) => e.code === 'PLUGIN_FEATURE_CONFLICT');
      grid.unuse('a');
      assert.equal(grid.getPlugin('shared'), null);
      grid.destroy();
    });

    it('cleanup + автоматические подписки: unuse и destroy снимают всё', async () => {
      const { grid } = await makeGrid(lib, { data: photos(2) });
      const log = [];
      const p = mini({
        name: 'life',
        install(api) {
          api.events.on('item:insert', () => log.push('insert'));
          api.lifecycle.addDisposable(() => log.push('disposable'));
          api.lifecycle.onDestroy(() => log.push('onDestroy'));
          return () => log.push('cleanup');
        }
      });
      grid.use(p);
      grid.insert({ id: 'a' });
      grid.unuse('life');
      grid.insert({ id: 'b' });
      assert.deepEqual(log, ['insert', 'cleanup', 'onDestroy', 'disposable']);
      log.length = 0;
      grid.use(p);
      grid.destroy();
      assert.deepEqual(log, ['cleanup', 'onDestroy', 'disposable']);
    });

    it('API после unuse недоступен; события плагина — только с префиксом "name:"', async () => {
      const { grid } = await makeGrid(lib, { data: photos(2) });
      let api;
      grid.use(mini({ install(a) { api = a; } }));
      const got = [];
      grid.on('mini:ping', (e) => got.push(e));
      api.events.emit('mini:ping', { n: 1 });
      assert.equal(got[0].n, 1);
      assert.equal(got[0].type, 'mini:ping');
      assert.throws(() => api.events.emit('item:click', {}), (e) => e.code === 'PLUGIN_EVENT_NAMESPACE');
      assert.ok(Object.isFrozen(api) && Object.isFrozen(api.data));
      grid.unuse('mini');
      assert.throws(() => api.data.count(), (e) => e.code === 'PLUGIN_INACTIVE');
      grid.destroy();
    });

    it('ошибка в обработчике плагина → событие error с source "plugin:name"; остальные работают', async () => {
      const { grid } = await makeGrid(lib, { data: photos(2) });
      const errs = [];
      grid.on('error', (e) => errs.push(e));
      grid.use(mini({ name: 'thrower', install(api) { api.events.on('item:insert', () => { throw new Error('x'); }); } }));
      let ok = 0;
      grid.on('item:insert', () => ok++);
      grid.insert({ id: 'q' });
      assert.equal(ok, 1);
      assert.equal(errs[0].source, 'plugin:thrower');
      grid.destroy();
    });

    it('plugin:install / plugin:uninstall, getPlugins, plugins в options', async () => {
      const el = makeContainer();
      const grid = new lib.ABI7Grid(el, { data: photos(2), plugins: [Selection, [mini(), {}]], animation: { enabled: false } });
      const log = [];
      grid.on('plugin:install', (e) => log.push('+' + e.name));
      grid.on('plugin:uninstall', (e) => log.push('-' + e.name + ':' + e.reason));
      await grid.whenReady();
      assert.deepEqual(grid.getPlugins().map((p) => p.name), ['selection', 'mini']);
      grid.use(mini({ name: 'third' }));
      grid.unuse('third');
      grid.destroy();
      assert.deepEqual(log, ['+selection', '+mini', '+third', '-third:unuse', '-mini:destroy', '-selection:destroy']);
    });

    it('состояние плагина изолировано между экземплярами', async () => {
      const a = await makeGrid(lib, { data: photos(5) });
      const b = await makeGrid(lib, { data: photos(5) });
      a.grid.use(Selection);
      b.grid.use(Selection);
      a.grid.getPlugin('selection').select('p1');
      assert.deepEqual(b.grid.getPlugin('selection').getSelected(), []);
      a.grid.destroy();
      b.grid.destroy();
    });

    it('Plugin API: data/geometry/viewport/renderer/options', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(200), layout: 'grid', layoutOptions: { columns: 2 } });
      let api;
      grid.use(mini({ install(a) { api = a; } }));
      assert.equal(api.data.count(), 200);
      assert.equal(api.data.indexOf('p5'), 5);
      assert.equal(api.data.indexOf('zz'), -1);
      assert.equal(api.geometry.get('p0').x, 0);
      assert.ok(api.geometry.size().height > 1000);
      assert.equal(api.geometry.hitTest(5, 5), 0);
      assert.equal(api.geometry.hitTest(-5, 5), -1);
      assert.equal(api.viewport.range().first, 0);
      assert.equal(api.viewport.isVisible('p0'), true);
      assert.equal(api.viewport.isVisible('p199'), false);
      assert.equal(api.viewport.state().axis, 'y');
      assert.equal(api.viewport.indexAtClientPoint(5, 5), 0);
      assert.equal(api.renderer.root(), el);
      assert.ok(api.renderer.getElement('p0'));
      assert.equal(api.renderer.getElement('p199'), null);
      assert.equal(api.renderer.toggleClass('p0', 'hot', true), true);
      assert.ok(api.renderer.getElement('p0').classList.contains('hot'));
      assert.equal(api.options.get('layout'), 'grid');
      api.options.set('layoutOptions.columns', 4);
      grid.flush();
      assert.equal(grid.getState().layoutInfo.columns, 4);
      // Pin: закреплённый элемент остаётся в DOM далеко за пределами окна
      api.viewport.pin('p0');
      scrollTo(el, 20000);
      grid.flush();
      assert.ok(api.renderer.getElement('p0'), 'pinned');
      api.viewport.unpin('p0');
      grid.flush();
      assert.equal(api.renderer.getElement('p0'), null);
      grid.destroy();
    });

    it('класс из renderer.toggleClass переживает переиспользование DOM-узла (DOM Pool)', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(2000) });
      grid.use(Selection);
      const sel = grid.getPlugin('selection');
      sel.select('p3');
      assert.ok(el.querySelector('[data-id="p3"]').classList.contains('abi7-selected'));
      scrollTo(el, 60000);
      grid.flush();
      assert.equal(el.querySelectorAll('.abi7-selected').length, 0);
      scrollTo(el, 0);
      grid.flush();
      assert.ok(el.querySelector('[data-id="p3"]').classList.contains('abi7-selected'));
      grid.destroy();
    });

    /* ---------------- Selection ---------------- */

    it('Selection: клик, Ctrl/Cmd, Shift, selectAll, clear, события, клавиатура', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(10) });
      grid.use(Selection, { multiple: true });
      const sel = grid.getPlugin('selection');
      const changes = [];
      grid.on('selection:change', (e) => changes.push(e));
      const click = (i, init = {}) => el.querySelector(`[data-index="${i}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true, ...init }));
      click(1);
      assert.deepEqual(sel.getSelected(), ['p1']);
      click(3, { ctrlKey: true });
      click(5, { metaKey: true });
      assert.deepEqual(sel.getSelected(), ['p1', 'p3', 'p5']);
      click(3, { ctrlKey: true });
      assert.deepEqual(sel.getSelected(), ['p1', 'p5']);
      click(2);
      assert.deepEqual(sel.getSelected(), ['p2']);
      click(6, { shiftKey: true });
      assert.deepEqual(sel.getSelected(), ['p2', 'p3', 'p4', 'p5', 'p6']);
      assert.equal(sel.count(), 5);
      sel.clear();
      assert.deepEqual(sel.getSelected(), []);
      assert.equal(sel.selectAll().length, 10);
      el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert.equal(sel.count(), 0);
      el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
      assert.equal(sel.count(), 10);
      assert.equal(changes[0].source, 'click');
      assert.deepEqual(changes[0].added, ['p1']);
      assert.equal(sel.select('nope'), false);
      assert.equal(sel.toggle('p0'), false);
      assert.equal(sel.toggle('p0'), true);
      grid.remove('p0');
      assert.equal(sel.isSelected('p0'), false);
      grid.setData(photos(3));
      assert.equal(sel.count(), 0);
      grid.unuse('selection');
      assert.equal(el.querySelectorAll('.abi7-selected').length, 0);
      grid.destroy();
    });

    it('Selection: multiple=false и отмена клика через preventDefault', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(4) });
      grid.on('item:click', (e) => { if (e.id === 'p3') e.preventDefault(); });
      grid.use(Selection, { multiple: false });
      const sel = grid.getPlugin('selection');
      const click = (i) => el.querySelector(`[data-index="${i}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      click(0);
      click(1);
      assert.deepEqual(sel.getSelected(), ['p1']);
      assert.deepEqual(sel.selectAll(), []);
      click(3);
      assert.deepEqual(sel.getSelected(), ['p1'], 'клик отменён другим обработчиком');
      grid.destroy();
    });

    /* ---------------- Horizontal layout ---------------- */

    it('Horizontal: ось X, ширина = высота × aspect, scrollToIndex по горизонтали, виртуализация', async () => {
      const el = makeContainer(600, 300);
      const grid = new lib.ABI7Grid(el, { layout: 'horizontal', layoutOptions: { height: 200, gap: 10 }, data: Array.from({ length: 5000 }, (_, i) => ({ id: i, width: 300, height: 200 })), animation: { enabled: false } });
      await tick(3);
      assert.equal(grid.getState().phase, 'pending', 'layout ещё не зарегистрирован');
      grid.use(Horizontal);
      await grid.whenReady();
      const st = grid.getState();
      assert.equal(st.axis, 'x');
      assert.ok(el.classList.contains('abi7-axis-x'));
      assert.equal(grid.getItem(0).rect.width, 300);
      assert.equal(grid.getItem(1).rect.x, 310);
      assert.equal(grid.getItem(4999).rect.right, st.contentWidth);
      assert.equal(st.contentWidth, 5000 * 300 + 4999 * 10);
      assert.ok(st.virtualization.mounted < 20, 'mounted=' + st.virtualization.mounted);
      grid.scrollToIndex(1000);
      assert.equal(el.scrollLeft, 1000 * 310);
      assert.ok(grid.getVisibleItems().some((v) => v.index === 1000));
      scrollTo(el, 0, 800000);
      grid.flush();
      assert.ok(grid.getState().virtualization.mounted < 20);
      // layoutOptions.height меняется «на лету», геометрия пересчитывается
      grid.rebuild({ layoutOptions: { height: 100 } });
      grid.flush();
      assert.equal(grid.getItem(0).rect.width, 150);
      // удаление плагина с активным layout → fallback на masonry + событие error
      const errs = [];
      grid.on('error', (e) => errs.push(e));
      grid.unuse('layout-horizontal');
      assert.equal(grid.getState().layout, 'masonry');
      assert.equal(errs[0].error.code, 'LAYOUT_REMOVED');
      grid.destroy();
    });

    it('Horizontal: глобальная регистрация ABI7Grid.registerLayout(name, plugin)', async () => {
      lib.ABI7Grid.registerLayout('horizontal', Horizontal);
      const { grid } = await makeGrid(lib, { layout: 'horizontal', data: photos(10), layoutOptions: { height: 120 } });
      assert.equal(grid.getState().axis, 'x');
      grid.destroy();
      lib.ABI7Grid.unregisterLayout('horizontal');
    });

    /* ---------------- Lightbox ---------------- */

    it('Lightbox: открытие, навигация, клавиатура, закрытие, очистка', async () => {
      const data = [{ id: 'a', src: 'a.jpg', title: 'A', width: 1, height: 1 }, { id: 'b', width: 1, height: 1 }, { id: 'c', src: 'javascript:alert(1)' }, { id: 'd', src: 'd.jpg', title: 'D<b>x</b>', width: 1, height: 1 }];
      const { grid, el } = await makeGrid(lib, { data });
      grid.use(Lightbox, { animation: 0 });
      const lb = grid.getPlugin('lightbox');
      const log = [];
      for (const n of ['lightbox:open', 'lightbox:change', 'lightbox:close']) grid.on(n, (e) => log.push(n + ':' + e.id));
      assert.equal(lb.open('b'), false, 'нет изображения');
      assert.equal(lb.open('c'), false, 'небезопасный URL');
      el.querySelector('[data-id="a"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      assert.equal(lb.isOpen(), true);
      const overlay = document.querySelector('.abi7-lb');
      assert.ok(overlay);
      assert.match(overlay.querySelector('.abi7-lb-img').getAttribute('src'), /a\.jpg/);
      assert.ok(document.documentElement.classList.contains('abi7-lb-lock'));
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
      assert.equal(lb.current(), 'd', 'записи без изображения пропускаются');
      assert.equal(overlay.querySelector('.abi7-lb-caption').textContent, 'D<b>x</b>');
      assert.equal(overlay.querySelector('.abi7-lb-caption b'), null);
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
      assert.equal(lb.current(), 'd', 'без loop дальше нельзя');
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      assert.equal(lb.current(), 'a');
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
      assert.equal(lb.isOpen(), false);
      assert.equal(document.querySelector('.abi7-lb'), null);
      assert.equal(document.documentElement.classList.contains('abi7-lb-lock'), false);
      // после закрытия обработчик клавиатуры снят
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
      assert.equal(lb.current(), null);
      assert.deepEqual(log, ['lightbox:open:a', 'lightbox:change:d', 'lightbox:change:a', 'lightbox:close:a']);
      // закрытие по клику на фон и очистка при destroy
      lb.open('a');
      document.querySelector('.abi7-lb').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      assert.equal(lb.isOpen(), false);
      lb.open('a');
      grid.destroy();
      assert.equal(document.querySelector('.abi7-lb'), null, 'destroy закрывает lightbox');
    });

    it('Lightbox: loop и отмена lightbox:before-open', async () => {
      const data = [{ id: 1, src: '1.jpg' }, { id: 2, src: '2.jpg' }, { id: 3, src: '3.jpg' }];
      const { grid } = await makeGrid(lib, { data });
      grid.use(Lightbox, { loop: true, animation: 0 });
      const lb = grid.getPlugin('lightbox');
      lb.open(3);
      lb.next();
      assert.equal(lb.current(), 1);
      lb.close();
      grid.on('lightbox:before-open', (e) => e.preventDefault());
      assert.equal(lb.open(1), false);
      grid.destroy();
    });

    /* ---------------- Connected Grids ---------------- */

    it('Connected Grids: перенос перетаскиванием, события, данные обоих гридов', async () => {
      const A = await makeGrid(lib, { data: photos(4), layout: 'grid', layoutOptions: { columns: 2, gap: 0, aspectRatio: 1 } });
      const B = await makeGrid(lib, { data: photos(2, 100), layout: 'grid', layoutOptions: { columns: 2, gap: 0, aspectRatio: 1 } });
      B.el.getBoundingClientRect = () => ({ left: 700, top: 0, right: 1320, bottom: 500, width: 620, height: 500 });
      A.grid.use(Connected, { group: 'g1', name: 'A' });
      B.grid.use(Connected, { group: 'g1', name: 'B' });
      assert.equal(A.grid.getState().plugins.includes('connected-grids'), true);
      const log = [];
      A.grid.on('connected-grids:transfer', (e) => log.push('A:' + e.id + '→' + e.to));
      B.grid.on('connected-grids:receive', (e) => log.push('B:' + e.id));
      const item = A.el.querySelector('[data-id="p1"]');
      pointer('pointerdown', item, { clientX: 400, clientY: 100 });
      pointer('pointermove', document, { clientX: 420, clientY: 110 });
      pointer('pointermove', document, { clientX: 760, clientY: 20 });
      assert.ok(B.el.classList.contains('abi7-connected-over'), 'целевой грид подсвечен');
      pointer('pointerup', document, { clientX: 760, clientY: 20 });
      assert.equal(B.el.classList.contains('abi7-connected-over'), false);
      assert.equal(A.grid.getCount(), 3);
      assert.equal(B.grid.getCount(), 3);
      assert.equal(B.grid.getItems()[0].id, 'p1', 'вставлен в позицию под курсором');
      assert.deepEqual(log, ['A:p1→B', 'B:p1']);
      // программный перенос + конфликт id
      A.grid.insert({ id: 'p1' });
      assert.equal(A.grid.getPlugin('connected-grids').transfer('p1', 'B'), true);
      assert.ok(B.grid.getItem('p1-2'));
      assert.throws(() => A.grid.getPlugin('connected-grids').transfer('p0', 'nobody'), /no grid named/);
      // accept-фильтр запрещает перенос
      A.grid.unuse('connected-grids');
      A.grid.use(Connected, { group: 'g1', name: 'A', accept: () => false });
      assert.equal(A.grid.getPlugin('connected-grids').transfer('p0', 'B'), false);
      assert.equal(A.grid.hasPlugin('connected-grids'), true);
      A.grid.destroy();
      B.grid.destroy();
    });

    it('Connected Grids: проверка совместимости и очистка', async () => {
      const A = await makeGrid(lib, { data: photos(2), fields: { id: 'uid' } });
      const B = await makeGrid(lib, { data: photos(2) });
      A.grid.use(Connected, { group: 'g2', name: 'A' });
      assert.throws(() => B.grid.use(Connected, { group: 'g2', name: 'B' }), /same fields\.id/);
      assert.equal(B.grid.hasPlugin('connected-grids'), false);
      const C = await makeGrid(lib, { data: photos(2), fields: { id: 'uid' } });
      assert.throws(() => C.grid.use(Connected, { group: 'g2', name: 'A' }), /already used/);
      A.grid.destroy();
      // после destroy A имя снова свободно (участник удалён из реестра)
      C.grid.use(Connected, { group: 'g2', name: 'A' });
      assert.equal(C.grid.getState().plugins[0], 'connected-grids');
      assert.equal(C.grid.getPlugin('connected-grids').members().length, 1);
      B.grid.destroy();
      C.grid.destroy();
    });
  });
}
