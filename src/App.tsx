// @ts-ignore — docs/app.js это чистый JavaScript без деклараций типов
import { bootDocs } from "../docs/app.js";

/**
 * Entry point приложения. Монтирует сайт документации ABI7 Grid в #docs-root.
 * Сам сайт (docs/*) и библиотека (src/abi7-grid.js) — Vanilla JS, без фреймворков.
 */
export default function App(): void {
  bootDocs(document.getElementById("docs-root"));
}
