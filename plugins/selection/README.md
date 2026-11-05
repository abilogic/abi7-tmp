# @abi7/selection

Выделение элементов ABI7 Grid: клик, Ctrl/Cmd+клик, Shift+клик (диапазон), выделить всё, снять выделение.

```js
import { ABI7Grid } from '../../dist/abi7-grid.js';
import SelectionPlugin from './selection.js';

const grid = new ABI7Grid('#gallery', { data: photos });
grid.use(SelectionPlugin, { multiple: true });

const selection = grid.getPlugin('selection');
selection.select('photo-1');
selection.getSelected(); // ['photo-1']
```

CSS (`selection.css`) подключается отдельно.

## Опции

| Опция | По умолчанию | Описание |
|---|---|---|
| `multiple` | `true` | несколько выделенных элементов |
| `className` | `'abi7-selected'` | класс выделенного элемента |
| `toggleOnClick` | `false` | обычный клик по единственному выделенному снимает выделение |
| `keyboard` | `true` | Ctrl/Cmd+A и Escape на корневом элементе |

## Методы (`grid.getPlugin('selection')`)

`select(id)`, `deselect(id)`, `toggle(id)`, `clear()`, `selectAll()`, `isSelected(id)`, `getSelected()`, `getSelectedItems()`, `count()`.

## События

`selection:change` — `{ selected: id[], added: id[], removed: id[], source: 'click'|'api'|'keyboard'|'data' }`.

Выделение сбрасывается при `data:load-end` (замена набора данных) и сокращается при `item:remove`.
