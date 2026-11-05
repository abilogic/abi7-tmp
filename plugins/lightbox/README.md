# @abi7/lightbox

Просмотр изображения поверх грида: клик по карточке, стрелки, Escape, Home/End, свайп на телефоне, закрытие по клику на фон.

```js
import LightboxPlugin from './lightbox.js';

grid.use(LightboxPlugin, { loop: true, animation: 250 });
grid.getPlugin('lightbox').open('photo-3');
```

CSS (`lightbox.css`) подключается отдельно.

## Опции

| Опция | По умолчанию | Описание |
|---|---|---|
| `loop` | `false` | переход через край списка |
| `closeOnBackdrop` | `true` | закрытие по клику на фон |
| `keyboard` | `true` | Escape, ←, →, Home, End |
| `counter` | `true` | счётчик «3 / 120» |
| `animation` | `220` | длительность анимации, мс (`0` — без анимации) |
| `swipe` | `true` | свайп для сенсорных экранов |
| `getSrc` | `null` | `(record) => url` полноразмерного изображения (по умолчанию `fields.src`) |
| `getCaption` | `null` | `(record) => string` (по умолчанию `fields.title`) |

## Методы

`open(id)`, `close()`, `next()`, `prev()`, `isOpen()`, `current()`.

## События

`lightbox:before-open` (отменяемое), `lightbox:open`, `lightbox:change`, `lightbox:close`.

Все обработчики открытого просмотрщика привязаны к одному `AbortController`; при закрытии, `unuse()` и `destroy()` они снимаются разом. URL проверяются на безопасные схемы, подписи выводятся через `textContent`.
