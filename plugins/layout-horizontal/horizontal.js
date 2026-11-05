/*!
 * @abi7/layout-horizontal v1.0.0 — горизонтальная лента для ABI7 Grid.
 * (c) Alexander Momot. MIT License.
 *
 * Layout-плагин: добавляет алгоритм раскладки 'horizontal'. Он отвечает ТОЛЬКО за геометрию:
 * виртуализацию, DOM и прокрутку по горизонтали делает Core.
 *
 *   ABI7Grid.registerLayout('horizontal', HorizontalLayout);   // глобально
 *   grid.use(HorizontalLayout);                                // или для одного грида
 */

// Определение layout — контракт Layout API.
const horizontal = {
  name: 'horizontal',
  axis: 'x', // главная ось прокрутки — горизонтальная
  responsive: 'height', // перестраивать при изменении ВЫСОТЫ контейнера, ширина layout не интересна

  // Значения по умолчанию для grid options.layoutOptions.
  defaults: {
    height: 0, // высота ленты в px; 0 — по высоте контейнера
    gap: 12, // расстояние между карточками
    itemWidth: 0, // фиксированная ширина карточки; 0 — ширина = высота × aspect ratio записи
    defaultAspect: 1.5, // если у записи нет размеров
    align: 'start' // 'start' | 'center' — вертикальное выравнивание, когда height меньше контейнера
  },

  create() {
    return {
      compute(ctx) {
        const o = ctx.options;
        const H = Math.max(1, Math.round(o.height > 0 ? o.height : ctx.height));
        const gap = o.gap > 0 ? o.gap : 0;
        const y = o.align === 'center' ? Math.max(0, Math.round((ctx.height - H) / 2)) : 0;

        // Частичный перерасчёт: Core сообщает индекс, с которого геометрия устарела (ctx.from).
        // Всё, что левее, остаётся прежним — продолжаем с правой границы предыдущей карточки.
        let x = ctx.from > 0 ? ctx.rect(ctx.from - 1).right + gap : 0;
        for (let i = ctx.from; i < ctx.count; i++) {
          const aspect = ctx.aspect(i) || o.defaultAspect;
          const w = o.itemWidth > 0 ? Math.round(o.itemWidth) : Math.max(1, Math.round(H * aspect));
          ctx.set(i, x, y, w, H);
          x += w + gap;
        }
        return { width: ctx.count ? x - gap : 0, height: H, info: { itemHeight: H } };
      }
    };
  }
};

export default {
  name: 'layout-horizontal',
  version: '1.0.0',
  apiVersion: '^1.0.0',
  layout: horizontal, // это же поле читает ABI7Grid.registerLayout(name, plugin)

  install(api) {
    // Регистрация на уровне одного грида. Снимается автоматически при unuse()/destroy().
    api.layouts.register('horizontal', horizontal);
  }
};
