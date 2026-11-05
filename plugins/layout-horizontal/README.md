# @abi7/layout-horizontal

Горизонтальная лента: карточки одной высоты и разной ширины (`ширина = высота × aspect ratio`), прокрутка по горизонтали, виртуализация из Core.

```js
import { ABI7Grid } from '../../dist/abi7-grid.js';
import HorizontalLayout from './horizontal.js';

const grid = new ABI7Grid('#strip', {
  layout: 'horizontal',           // имя можно указать до подключения плагина:
  data: photos,                   // грид дождётся регистрации layout
  layoutOptions: { height: 220, gap: 12 }
});
grid.use(HorizontalLayout);

// Или глобально, для всех гридов страницы:
// ABI7Grid.registerLayout('horizontal', HorizontalLayout);
```

Layout не требует CSS-файла.

## layoutOptions

| Опция | По умолчанию | Описание |
|---|---|---|
| `height` | `0` | высота ленты, px; `0` — высота контейнера |
| `gap` | `12` | расстояние между карточками |
| `itemWidth` | `0` | фиксированная ширина; `0` — по aspect ratio |
| `defaultAspect` | `1.5` | aspect ratio для записей без размеров |
| `align` | `'start'` | `'center'` центрирует ленту по вертикали, если она ниже контейнера |

`scrollToIndex()` работает по горизонтальной оси автоматически: Core знает ось из `axis: 'x'`.
