import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { setupDom, makeContainer, resize, scrollTo, photos, assertNoOverlap, loadLib, makeGrid, FakeRO, fireMeasure, pointer, tick, ROOT } from './helpers.js';

setupDom();

for (const kind of ['src', 'min']) {
  describe(`ABI7Grid core [${kind === 'src' ? 'src/abi7-grid.js' : 'dist/abi7-grid.min.js'}]`, () => {
    let lib, ABI7Grid;
    before(async () => {
      lib = await loadLib(kind);
      ABI7Grid = lib.ABI7Grid;
    });

    it('инициализация: события идут в документированном порядке, ready — один раз', async () => {
      const el = makeContainer();
      const log = [];
      const grid = new ABI7Grid(el, { data: photos(10), animation: { enabled: false } });
      for (const n of ['data:load-start', 'data:load-end', 'layout:start', 'viewport:update', 'layout:end', 'ready']) grid.on(n, () => log.push(n));
      await grid.whenReady();
      grid.refresh();
      assert.deepEqual(log.slice(0, 6), ['data:load-start', 'data:load-end', 'layout:start', 'viewport:update', 'layout:end', 'ready']);
      assert.equal(log.filter((x) => x === 'ready').length, 1);
      assert.equal(grid.getState().ready, true);
      grid.destroy();
    });

    it('destroy(): восстанавливает контейнер, закрывает observers, метод повторяем', async () => {
      const el = makeContainer();
      el.setAttribute('class', 'mine');
      el.setAttribute('style', 'color: red');
      const grid = new ABI7Grid(el, { data: photos(30) });
      await grid.whenReady();
      assert.ok(el.classList.contains('abi7-grid'));
      let events = 0;
      grid.on('*', () => events++);
      grid.destroy();
      grid.destroy();
      assert.equal(grid.isDestroyed(), true);
      assert.equal(el.getAttribute('class'), 'mine');
      assert.equal(el.getAttribute('style'), 'color: red');
      assert.equal(el.querySelector('.abi7-container'), null);
      assert.equal(el.hasAttribute('tabindex'), false);
      for (const ro of FakeRO.all) assert.equal(ro.targets.has(el), false, 'ResizeObserver отключён');
      events = 0;
      scrollTo(el, 100);
      el.dispatchEvent(new window.Event('click'));
      assert.equal(events, 0);
      assert.throws(() => grid.insert({ id: 'x' }), /destroyed/);
      assert.equal(grid.getState().phase, 'destroyed');
      const again = new ABI7Grid(el, { data: photos(3) });
      await again.whenReady();
      again.destroy();
    });

    it('второй грид на том же элементе запрещён', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(3) });
      assert.throws(() => new ABI7Grid(el), /already has/);
      grid.destroy();
    });

    it('валидация опций и данных', async () => {
      assert.throws(() => new ABI7Grid(makeContainer(), { layout: 5 }), /layout/);
      assert.throws(() => new ABI7Grid('#nope'), /not found/);
      const { grid } = await makeGrid(lib, { data: photos(3) });
      assert.throws(() => grid.setData('x'), /array/);
      assert.throws(() => grid.setData([{ id: 1 }, { id: 1 }]), /Duplicate/);
      assert.throws(() => grid.insert({ id: 'p0' }), /Duplicate/);
      grid.destroy();
    });

    it('пустой массив и один элемент', async () => {
      const { grid } = await makeGrid(lib, { data: [] });
      assert.equal(grid.getCount(), 0);
      assert.equal(grid.getState().contentHeight, 0);
      grid.insert({ id: 'only', width: 100, height: 100 });
      grid.flush();
      assert.equal(grid.getItems().length, 1);
      assert.equal(grid.getState().virtualization.mounted, 1);
      grid.remove('only');
      grid.flush();
      assert.equal(grid.getState().virtualization.mounted, 0);
      grid.destroy();
    });

    it('Masonry: колонки, отсутствие наложений, shortest-column', async () => {
      const { grid } = await makeGrid(lib, { layout: 'masonry', data: photos(60), layoutOptions: { gap: 10, minWidth: 180 }, virtualization: { enabled: false } });
      const st = grid.getState();
      assert.equal(st.layoutInfo.columns, 3);
      assert.equal(st.layoutInfo.itemWidth, 200);
      const rects = grid.getItems().map((i) => i.rect);
      assertNoOverlap(rects, assert);
      assert.deepEqual(rects.slice(0, 3).map((r) => r.y), [0, 0, 0]);
      assert.deepEqual(Object.keys(rects[0]).sort(), ['bottom', 'height', 'id', 'index', 'right', 'width', 'x', 'y']);
      assert.ok(rects.every((r) => r.right === r.x + r.width && r.bottom === r.y + r.height));
      grid.destroy();
    });

    it('Masonry: maxColumns/maxWidth/columns', async () => {
      const { grid } = await makeGrid(lib, { data: photos(10), layoutOptions: { minWidth: 100, maxColumns: 2 } });
      assert.equal(grid.getState().layoutInfo.columns, 2);
      grid.rebuild({ layoutOptions: { maxColumns: 0, columns: 4 } });
      grid.flush();
      assert.equal(grid.getState().layoutInfo.columns, 4);
      grid.destroy();
    });

    it('частичный перерасчёт даёт ту же геометрию, что и полный (все layout)', async () => {
      for (const layout of ['masonry', 'grid', 'justified']) {
        const data = photos(400);
        const a = (await makeGrid(lib, { layout, data, virtualization: { enabled: false } })).grid;
        a.insert(photos(7, 1000), { at: 150 });
        a.remove(['p3', 'p200', 'p399']);
        a.move('p10', 300);
        a.flush();
        const fresh = (await makeGrid(lib, { layout, data: a.data(), virtualization: { enabled: false } })).grid;
        const ra = a.getItems().map((i) => i.rect), rb = fresh.getItems().map((i) => i.rect);
        assert.equal(ra.length, rb.length);
        for (let i = 0; i < ra.length; i++) assert.deepEqual(ra[i], { ...rb[i], id: ra[i].id }, `${layout} #${i}`);
        assert.equal(a.getState().contentHeight, fresh.getState().contentHeight);
        a.destroy();
        fresh.destroy();
      }
    });

    it('Grid: фиксированные колонки, aspectRatio, gap', async () => {
      const { grid } = await makeGrid(lib, { layout: 'grid', data: photos(9), layoutOptions: { columns: 3, gapX: 10, gapY: 20, aspectRatio: 2 } });
      const r = grid.getItems().map((i) => i.rect);
      assert.equal(r[0].width, 200);
      assert.equal(r[0].height, 100);
      assert.equal(r[1].x, 210);
      assert.equal(r[3].y, 120);
      assert.equal(grid.getState().contentHeight, 3 * 100 + 2 * 20);
      grid.rebuild({ layoutOptions: { columns: 0, minWidth: 100 } });
      grid.flush();
      assert.equal(grid.getState().layoutInfo.columns, 5);
      grid.destroy();
    });

    it('Justified: ряды точно заполняют ширину, нет наложений, последняя строка не растягивается', async () => {
      const data = Array.from({ length: 41 }, (_, i) => ({ id: i, width: 300 + ((i * 97) % 500), height: 300 }));
      const { grid } = await makeGrid(lib, { layout: 'justified', data, virtualization: { enabled: false }, layoutOptions: { targetRowHeight: 150, minRowHeight: 100, maxRowHeight: 260, gap: 8 } });
      const rects = grid.getItems().map((i) => i.rect);
      assertNoOverlap(rects, assert);
      const rows = new Map();
      for (const r of rects) rows.set(r.y, [...(rows.get(r.y) || []), r]);
      const list = [...rows.values()];
      list.slice(0, -1).forEach((row) => assert.equal(Math.max(...row.map((r) => r.right)), 620, 'ряд заполняет ширину'));
      const last = list[list.length - 1];
      assert.equal(last[0].height, 150);
      assert.ok(Math.max(...last.map((r) => r.right)) <= 620);
      grid.rebuild({ layoutOptions: { lastRow: 'justify' } });
      grid.flush();
      assert.ok(grid.getState().layoutInfo.rows >= 2);
      grid.destroy();
    });

    it('изменение размеров контейнера → layout:end(reason=resize)', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(40), layoutOptions: { minWidth: 180, gap: 10 } });
      assert.equal(grid.getState().layoutInfo.columns, 3);
      const reasons = [];
      grid.on('layout:end', (e) => reasons.push(e.reason));
      resize(el, 1000);
      grid.flush();
      assert.equal(grid.getState().layoutInfo.columns, 5);
      assert.ok(reasons.includes('resize'));
      grid.destroy();
    });

    it('скрытый контейнер (ширина 0): layout откладывается до появления размера', async () => {
      const el = makeContainer(0, 0);
      const grid = new ABI7Grid(el, { data: photos(10), animation: { enabled: false } });
      await tick(5);
      assert.equal(grid.getState().ready, false);
      assert.equal(grid.getState().hidden, true);
      resize(el, 600, 400);
      await grid.whenReady();
      assert.equal(grid.getState().ready, true);
      grid.destroy();
    });

    it('виртуализация: 50 000 элементов — DOM создаётся только для окна; DOM Pool переиспользуется', async () => {
      const data = Array.from({ length: 50000 }, (_, i) => ({ id: i, width: 300, height: 200 + (i % 7) * 30 }));
      const { grid, el } = await makeGrid(lib, { data, virtualization: { overscan: 300 } });
      const st0 = grid.getState();
      assert.equal(st0.count, 50000);
      assert.ok(st0.virtualization.mounted > 0 && st0.virtualization.mounted < 60, 'mounted=' + st0.virtualization.mounted);
      assert.equal(el.querySelectorAll('.abi7-item').length, st0.virtualization.mounted);
      for (let k = 1; k <= 30; k++) {
        scrollTo(el, k * 40000);
        grid.flush();
      }
      const st = grid.getState();
      assert.ok(st.virtualization.mounted < 60);
      assert.equal(el.querySelectorAll('.abi7-item').length, st.virtualization.mounted);
      assert.ok(st.virtualization.reused > st.virtualization.created, 'пул переиспользует элементы');
      assert.ok(st.virtualization.created < 120, 'created=' + st.virtualization.created);
      const vis = grid.getVisibleItems();
      assert.ok(vis.length > 0 && vis.every((v) => v.element && v.visible));
      grid.destroy();
    });

    it('виртуализация независима от layout: Grid и Justified', async () => {
      for (const layout of ['grid', 'justified']) {
        const data = Array.from({ length: 20000 }, (_, i) => ({ id: i, width: 200 + (i % 4) * 80, height: 200 }));
        const { grid, el } = await makeGrid(lib, { layout, data });
        scrollTo(el, 123456);
        grid.flush();
        const st = grid.getState();
        assert.ok(st.virtualization.mounted < 80, layout + ' mounted=' + st.virtualization.mounted);
        const range = grid.getVisibleItems().map((v) => v.index);
        assert.ok(range[0] > 0);
        grid.destroy();
      }
    });

    it('virtualization.enabled=false монтирует все элементы', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(120), virtualization: { enabled: false } });
      assert.equal(el.querySelectorAll('.abi7-item').length, 120);
      grid.destroy();
    });

    it('adaptive overscan растёт при быстром скролле', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(5000), virtualization: { overscan: 200, maxOverscan: 2000 } });
      assert.equal(grid.getState().virtualization.overscan.after, 200);
      scrollTo(el, 100);
      grid.flush();
      await tick(2);
      scrollTo(el, 20000);
      grid.flush();
      const os = grid.getState().virtualization.overscan;
      assert.ok(os.after > 200 && os.after <= 2000, JSON.stringify(os));
      grid.destroy();
    });

    it('scrollToIndex / scrollToItem', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(1000) });
      assert.equal(grid.scrollToIndex(500), true);
      const r = grid.getItem('p500').rect;
      assert.equal(el.scrollTop, Math.min(r.y, grid.getState().contentHeight - 500));
      grid.scrollToIndex(400, { align: 'center' });
      const r4 = grid.getItem('p400').rect;
      assert.equal(Math.round(el.scrollTop), Math.round(r4.y - (500 - r4.height) / 2));
      assert.equal(grid.scrollToIndex(99999), false);
      assert.equal(grid.scrollToItem('nope'), false);
      assert.equal(grid.scrollToItem('p10', { offset: 0 }), true);
      assert.ok(grid.getVisibleItems().some((v) => v.id === 'p10'));
      grid.destroy();
    });

    it('Scroll Anchoring: вставка выше окна не сдвигает видимое содержимое', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(300) });
      scrollTo(el, 3000);
      grid.flush();
      // якорь ядра — видимый элемент с минимальной координатой
      const first = grid.getVisibleItems().reduce((a, b) => (b.rect.y < a.rect.y ? b : a));
      const offset = first.rect.y - el.scrollTop;
      grid.insert(photos(6, 5000), { at: 0 });
      grid.flush();
      const after = grid.getItem(first.id).rect;
      assert.ok(Math.abs(after.y - el.scrollTop - offset) < 1.5, 'offset сохранён');
      grid.destroy();
    });

    it('insert/remove/update/move: данные, события и порядок', async () => {
      const { grid } = await makeGrid(lib, { data: photos(5) });
      const log = [];
      for (const n of ['item:insert', 'item:remove', 'item:update', 'item:move']) grid.on(n, (e) => log.push([n, e.id, e.index ?? e.to]));
      const ids = grid.insert({ id: 'new', width: 1, height: 1 }, { at: 'start' });
      assert.deepEqual(ids, ['new']);
      assert.equal(grid.getItem('new').index, 0);
      assert.equal(grid.getItem('p0').index, 1);
      assert.equal(grid.update('p1', { title: 'T' }), true);
      assert.equal(grid.getItem('p1').data.title, 'T');
      assert.equal(grid.update('zzz', {}), false);
      assert.throws(() => grid.update('p1', { id: 'other' }), /id/);
      assert.equal(grid.move('p4', 0), true);
      assert.equal(grid.getItems()[0].id, 'p4');
      assert.equal(grid.remove('p2'), 1);
      assert.equal(grid.remove('p2'), 0);
      assert.deepEqual(log.map((l) => l[0]), ['item:insert', 'item:update', 'item:move', 'item:remove']);
      grid.destroy();
    });

    it('update aspectRatio/height перестраивает геометрию с этого элемента', async () => {
      const { grid } = await makeGrid(lib, { layout: 'grid', data: [{ id: 'a', width: 1, height: 1 }, { id: 'b', width: 1, height: 1 }], layoutOptions: { aspectRatio: 0, columns: 1 } });
      const h0 = grid.getItem('a').rect.height;
      grid.update('a', { width: 2, height: 1 });
      assert.ok(grid.getItem('a').rect.height < h0);
      assert.equal(grid.getItem('b').rect.y, grid.getItem('a').rect.bottom + 12);
      grid.destroy();
    });

    it('измерение размеров (virtualization.measure) обновляет геометрию', async () => {
      const data = Array.from({ length: 6 }, (_, i) => ({ id: i, title: 'x' }));
      const { grid, el } = await makeGrid(lib, { data, layout: 'grid', layoutOptions: { columns: 1, aspectRatio: 0, gap: 0 }, virtualization: { measure: true, estimatedHeight: 100 } });
      assert.equal(grid.getItem(1).rect.y, 100);
      fireMeasure(el.querySelector('[data-index="0"]'), 160);
      grid.flush();
      assert.equal(grid.getItem(0).rect.height, 160);
      assert.equal(grid.getItem(1).rect.y, 160);
      grid.destroy();
    });

    it('события: once / off / отмена подписки / порядок, ошибки обработчиков идут в error', async () => {
      const { grid } = await makeGrid(lib, { data: photos(3) });
      let n = 0, errors = [];
      grid.once('item:insert', () => n++);
      const off = grid.on('item:insert', () => n += 10);
      grid.on('error', (e) => errors.push(e));
      grid.on('item:insert', () => { throw new Error('boom'); });
      let tail = 0;
      grid.on('item:insert', () => tail++);
      grid.insert({ id: 'a' });
      off();
      grid.insert({ id: 'b' });
      assert.equal(n, 11);
      assert.equal(tail, 2, 'исключение одного обработчика не мешает остальным');
      assert.equal(errors.length, 2);
      assert.equal(errors[0].source, 'listener');
      assert.equal(grid.off('item:insert', () => {}), false);
      grid.destroy();
    });

    it('item:click делегируется, cancelable', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(5) });
      const got = [];
      grid.on('item:click', (e) => { got.push(e.id); e.preventDefault(); });
      let after = null;
      grid.on('item:click', (e) => (after = e.defaultPrevented));
      el.querySelector('[data-index="2"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      assert.deepEqual(got, ['p2']);
      assert.equal(after, true);
      grid.destroy();
    });

    it('item:visible / item:hidden', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(500) });
      const vis = new Set();
      grid.on('item:visible', (e) => vis.add(e.id));
      grid.on('item:hidden', (e) => vis.delete(e.id));
      scrollTo(el, 1);
      grid.flush();
      assert.ok(vis.size > 0);
      scrollTo(el, 8000);
      grid.flush();
      assert.ok(!vis.has('p0'));
      assert.deepEqual([...vis].sort(), grid.getVisibleItems().map((v) => v.id).sort());
      grid.destroy();
    });

    it('async data: гонки, destroy во время загрузки, ошибки загрузчика', async () => {
      const el = makeContainer();
      let release1, release2;
      const p1 = new Promise((r) => (release1 = r));
      const grid = new ABI7Grid(el, { data: () => p1, animation: { enabled: false } });
      const ends = [];
      grid.on('data:load-end', (e) => ends.push(e));
      await tick(2);
      assert.equal(grid.getState().loading, true);
      const p2 = new Promise((r) => (release2 = r));
      const second = grid.load(() => p2);
      release2(photos(4));
      await second;
      release1(photos(9));
      await tick(5);
      assert.equal(grid.getCount(), 4, 'устаревший ответ проигнорирован');
      assert.equal(ends.length, 1);
      grid.destroy();

      const el2 = makeContainer();
      let rel;
      const g2 = new ABI7Grid(el2, { data: () => new Promise((r) => (rel = r)) });
      await tick(2);
      const ready = g2.whenReady();
      g2.destroy();
      await assert.rejects(ready, /destroyed/);
      rel(photos(3));
      await tick(5);
      assert.equal(g2.isDestroyed(), true);

      const g3 = new ABI7Grid(makeContainer(), { data: () => Promise.reject(new Error('net')), animation: { enabled: false } });
      const errs = [];
      g3.on('error', (e) => errs.push(e));
      await g3.whenReady();
      assert.equal(errs[0].source, 'data');
      assert.equal(g3.getCount(), 0);
      g3.destroy();
    });

    it('безопасность: javascript: URL и HTML в данных не исполняются', async () => {
      const data = [
        { id: 1, src: 'javascript:alert(1)', title: '<img src=x onerror=alert(1)>', width: 1, height: 1 },
        { id: 2, src: ' JaVa\nScript:alert(1)', width: 1, height: 1 },
        { id: 3, src: 'data:text/html;base64,AAAA', width: 1, height: 1 },
        { id: 4, src: 'https://example.com/a.jpg', width: 1, height: 1 }
      ];
      const { grid, el } = await makeGrid(lib, { data });
      const imgs = [...el.querySelectorAll('img')];
      assert.equal(imgs[0].hasAttribute('src'), false);
      assert.equal(imgs[1].hasAttribute('src'), false);
      assert.equal(imgs[2].hasAttribute('src'), false);
      assert.equal(imgs[3].getAttribute('src'), 'https://example.com/a.jpg');
      assert.equal(el.querySelectorAll('img[onerror]').length, 0);
      assert.equal(el.querySelector('.abi7-caption').textContent, '<img src=x onerror=alert(1)>');
      grid.rebuild({ renderItem: (rec) => '<b>' + rec.id + '</b>' });
      grid.flush();
      assert.equal(el.querySelectorAll('b').length, 0, 'строка из renderItem — это текст');
      grid.rebuild({ allowHTML: true });
      grid.flush();
      assert.equal(el.querySelectorAll('b').length, 4);
      grid.destroy();
    });

    it('renderItem: ошибки не ломают грид, releaseItem вызывается', async () => {
      const released = [];
      const { grid, el } = await makeGrid(lib, { data: photos(300), renderItem: (rec, node) => { if (rec.id === 'p1') throw new Error('bad'); node.textContent = rec.id; }, releaseItem: (rec) => released.push(rec.id) });
      const errs = [];
      grid.on('error', (e) => errs.push(e.source));
      grid.rebuild({ className: 'x' });
      scrollTo(el, 6000);
      grid.flush();
      assert.ok(released.length > 0);
      assert.ok(el.classList.contains('x'));
      grid.destroy();
    });

    it('несколько экземпляров независимы', async () => {
      const a = await makeGrid(lib, { data: photos(10), layout: 'masonry' });
      const b = await makeGrid(lib, { data: photos(20), layout: 'grid' });
      b.grid.insert({ id: 'zz' });
      assert.equal(a.grid.getCount(), 10);
      assert.equal(b.grid.getCount(), 21);
      a.grid.destroy();
      assert.equal(b.grid.isDestroyed(), false);
      b.grid.refresh();
      b.grid.destroy();
    });

    it('Drag & Drop: порядок меняется, события, Escape отменяет, click подавляется', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(6), layout: 'grid', layoutOptions: { columns: 3, gap: 0, aspectRatio: 1 }, interaction: { drag: { enabled: true } } });
      const log = [];
      for (const n of ['drag:start', 'drag:end']) grid.on(n, (e) => log.push(n));
      let moves = 0, clicks = 0;
      grid.on('drag:move', () => moves++);
      grid.on('item:click', () => clicks++);
      const item0 = el.querySelector('[data-index="0"]');
      pointer('pointerdown', item0, { clientX: 50, clientY: 50 });
      pointer('pointermove', document, { clientX: 60, clientY: 60 });
      assert.ok(document.querySelector('.abi7-ghost-layer'), 'призрак создан');
      // Центр третьей карточки (колонка 3, ряд 1) — 620/3 ≈ 206 → x≈ 515, y≈100
      pointer('pointermove', document, { clientX: 515, clientY: 100 });
      grid.flush();
      assert.equal(grid.getItems()[2].id, 'p0');
      pointer('pointerup', document, { clientX: 515, clientY: 100 });
      assert.equal(document.querySelector('.abi7-ghost-layer'), null);
      assert.deepEqual(log, ['drag:start', 'drag:end']);
      assert.ok(moves >= 1);
      item0.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      assert.equal(clicks, 0, 'click сразу после drag подавлен');

      // Escape возвращает порядок
      const before = grid.getItems().map((i) => i.id).join();
      const itemX = el.querySelector('[data-index="1"]');
      pointer('pointerdown', itemX, { clientX: 100, clientY: 100 });
      pointer('pointermove', document, { clientX: 130, clientY: 130 });
      pointer('pointermove', document, { clientX: 515, clientY: 100 });
      await tick(250);
      pointer('pointermove', document, { clientX: 516, clientY: 101 });
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
      grid.flush();
      assert.equal(grid.getItems().map((i) => i.id).join(), before);
      grid.destroy();
    });

    it('drag:start можно отменить', async () => {
      const { grid, el } = await makeGrid(lib, { data: photos(3), interaction: { drag: { enabled: true } } });
      grid.on('drag:start', (e) => e.preventDefault());
      const item = el.querySelector('[data-index="0"]');
      pointer('pointerdown', item, { clientX: 5, clientY: 5 });
      pointer('pointermove', document, { clientX: 50, clientY: 50 });
      assert.equal(document.querySelector('.abi7-ghost-layer'), null);
      grid.destroy();
    });

    it('rebuild: смена layout «на лету», reload, getState', async () => {
      const { grid } = await makeGrid(lib, { data: photos(30), layout: 'masonry' });
      grid.rebuild({ layout: 'justified' });
      grid.flush();
      assert.equal(grid.getState().layout, 'justified');
      assert.ok(grid.getState().layoutInfo.rows > 0);
      await grid.reload();
      assert.equal(grid.getState().layout, 'justified');
      grid.destroy();
    });

    it('Layout API: registerLayout (глобально), pending → ready, validate', async () => {
      assert.throws(() => ABI7Grid.registerLayout('masonry', { compute() {} }), /already registered/);
      assert.throws(() => ABI7Grid.registerLayout('bad', {}), /create\(\)/);
      assert.throws(() => ABI7Grid.unregisterLayout('grid'), /Built-in/);
      const el = makeContainer();
      const grid = new ABI7Grid(el, { layout: 'stack-test', data: photos(5), animation: { enabled: false } });
      await tick(2);
      assert.equal(grid.getState().phase, 'pending');
      assert.equal(grid.getState().pendingLayout, 'stack-test');
      ABI7Grid.registerLayout('stack-test', {
        defaults: { gap: 4 },
        compute(ctx) { let y = 0; for (let i = 0; i < ctx.count; i++) { ctx.set(i, 0, y, ctx.width, 50); y += 50 + ctx.options.gap; } return { width: ctx.width, height: y }; }
      });
      await grid.whenReady();
      assert.equal(grid.getItem('p2').rect.y, 108);
      grid.destroy();
      ABI7Grid.unregisterLayout('stack-test');
    });

    it('Layout с невалидной геометрией не роняет грид (событие error)', async () => {
      ABI7Grid.registerLayout('broken-test', { compute(ctx) { ctx.set(0, NaN, 0, 1, 1); } });
      const { grid } = await makeGrid(lib, { layout: 'broken-test', data: photos(3) }).catch(() => ({}));
      ABI7Grid.unregisterLayout('broken-test');
      if (grid) grid.destroy();
    });

    it('fromLegacyOptions переносит старые настройки', () => {
      const { options, unmapped } = ABI7Grid.fromLegacyOptions({ maxColumns: 4, items: { minWidth: 120, maxWidth: 300, sortable: true, multiSelect: true }, space: { cols: 8, rows: 6 }, animation: { enable: false, duration: 100 }, events: { onReady() {} }, funcItemLoad() {} });
      assert.equal(options.layoutOptions.maxColumns, 4);
      assert.equal(options.layoutOptions.gapX, 8);
      assert.equal(options.layoutOptions.gapY, 6);
      assert.equal(options.animation.enabled, false);
      assert.equal(options.interaction.drag.enabled, true);
      assert.ok(unmapped.length >= 3);
    });

    it('статика: version, defaults, getLayouts', () => {
      assert.equal(ABI7Grid.version, '1.0.0');
      assert.deepEqual(ABI7Grid.getLayouts().slice(0, 3), ['masonry', 'grid', 'justified']);
      assert.equal(ABI7Grid.defaults.virtualization.overscan, 400);
    });
  });
}

describe('сборка: файлы и CSS', () => {
  const read = (f) => readFileSync(join(ROOT, f), 'utf8');
  it('все четыре файла Core существуют, min меньше исходника, source map на месте', () => {
    for (const f of ['dist/abi7-grid.js', 'dist/abi7-grid.min.js', 'dist/abi7-grid.css', 'dist/abi7-grid.min.css', 'dist/abi7-grid.min.js.map']) assert.ok(existsSync(join(ROOT, f)), f);
    assert.ok(read('dist/abi7-grid.min.js').length < read('dist/abi7-grid.js').length * 0.7);
    assert.ok(read('dist/abi7-grid.min.css').length < read('dist/abi7-grid.css').length);
    assert.equal(read('dist/abi7-grid.js'), read('src/abi7-grid.js'));
  });
  it('авторство и лицензия сохранены в min-файлах', () => {
    assert.match(read('dist/abi7-grid.min.js'), /Alexander Momot/);
    assert.match(read('dist/abi7-grid.min.css'), /Alexander Momot/);
  });
  it('JS не подключает ни min-версию, ни сторонние модули', () => {
    const src = read('src/abi7-grid.js');
    assert.equal(/^\s*import\s/m.test(src), false);
    assert.equal(/\.min\./.test(src), false);
  });
  it('CSS изолирован: все классы начинаются с abi7-, нет глобальных сбросов', () => {
    const css = read('src/abi7-grid.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const classes = [...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]);
    assert.ok(classes.length > 20);
    for (const c of classes) assert.ok(c.startsWith('abi7-'), c);
    assert.equal(/(^|[},\s])(\*|html|body)\s*[{,]/.test(css), false);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /--abi7-duration/);
  });
  it('минифицированный CSS эквивалентен по набору селекторов и свойств', () => {
    const sel = (t) => new Set([...t.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.abi7-[\w-]+/g)].map((m) => m[0]));
    const a = sel(read('dist/abi7-grid.css')), b = sel(read('dist/abi7-grid.min.css'));
    assert.deepEqual([...a].sort(), [...b].sort());
  });
});
