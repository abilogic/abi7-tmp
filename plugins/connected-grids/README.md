# @abi7/connected-grids

Перенос карточек между экземплярами ABI7 Grid перетаскиванием (мышь и касание). Плагин использует Drag & Drop ядра и публичные методы данных `remove` / `insert`.

```js
import ConnectedGrids from './connected-grids.js';

todo.use(ConnectedGrids, { group: 'board', name: 'todo' });
done.use(ConnectedGrids, { group: 'board', name: 'done' });

// программно:
todo.getPlugin('connected-grids').transfer('card-1', 'done');
```

CSS (`connected-grids.css`) подключается отдельно.

## Опции

| Опция | По умолчанию | Описание |
|---|---|---|
| `group` | `'default'` | гриды с одинаковым значением связаны |
| `name` | `''` | имя участника в группе (для `transfer()`) |
| `copy` | `false` | копировать вместо переноса |
| `accept` | `null` | `(record, { from, to }) => boolean` |
| `overClass` | `'abi7-connected-over'` | класс подсветки грида-приёмника |

## Проверка совместимости

При `use()` плагин проверяет, что в группе совпадают major-версия ядра и поле `fields.id`, а `name` уникален. Иначе установка отклоняется с ошибкой и ничего не регистрируется.

## События

На гриде-источнике: `connected-grids:before-transfer` (отменяемое), `connected-grids:transfer`. На гриде-приёмнике: `connected-grids:receive`. Данные обоих гридов обновляются через `remove`/`insert`, поэтому срабатывают обычные `item:remove`/`item:insert` и перерасчёт геометрии. Если `id` занят в приёмнике, запись получает новый (`id-2`).
