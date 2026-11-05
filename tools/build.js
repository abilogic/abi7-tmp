#!/usr/bin/env node
/**
 * Сборка ABI7 Grid:  node tools/build.js
 *
 *   src/abi7-grid.js  → dist/abi7-grid.js  (читаемая копия, без изменений)
 *                     → dist/abi7-grid.min.js + abi7-grid.min.js.map  (esbuild, minify)
 *   src/abi7-grid.css → dist/abi7-grid.css (читаемая копия)
 *                     → dist/abi7-grid.min.css (esbuild, minify)
 *
 * Затем dist/, plugins/ и examples/ зеркалируются в public/ — Vite копирует public/
 * в итоговую сборку сайта документации, поэтому примеры работают и как автономные страницы
 * (достаточно любого статического сервера). Флаг --no-site отключает зеркалирование.
 *
 * esbuild — только инструмент сборки. В runtime-код библиотеки он не попадает.
 */
import { build } from 'esbuild';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => join(root, ...p);
const dist = at('dist');
mkdirSync(dist, { recursive: true });

// 1. Читаемые версии — побайтовые копии исходников (код пишется сразу в итоговом виде, транспиляции нет).
copyFileSync(at('src/abi7-grid.js'), join(dist, 'abi7-grid.js'));
copyFileSync(at('src/abi7-grid.css'), join(dist, 'abi7-grid.css'));

// 2. Минификация. legalComments:'inline' сохраняет блоки /*! ... */ (авторство и лицензия).
await build({
  entryPoints: [at('src/abi7-grid.js')],
  outfile: join(dist, 'abi7-grid.min.js'),
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: 'external',
  legalComments: 'inline',
  bundle: false,
  logLevel: 'warning'
});
await build({
  entryPoints: [at('src/abi7-grid.css')],
  outfile: join(dist, 'abi7-grid.min.css'),
  minify: true,
  legalComments: 'inline',
  bundle: false,
  logLevel: 'warning'
});

// 3. Отчёт о размерах.
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('ABI7 Grid build:');
for (const f of ['abi7-grid.js', 'abi7-grid.min.js', 'abi7-grid.min.js.map', 'abi7-grid.css', 'abi7-grid.min.css']) {
  const p = join(dist, f);
  const size = statSync(p).size;
  const gz = f.endsWith('.map') ? '' : `  (gzip ${kb(gzipSync(readFileSync(p)).length)})`;
  console.log(`  dist/${f.padEnd(22)} ${kb(size).padStart(9)}${gz}`);
}

// 4. Зеркалирование для сайта.
if (!process.argv.includes('--no-site')) {
  for (const dir of ['dist', 'plugins', 'examples']) {
    const target = at('public', dir);
    rmSync(target, { recursive: true, force: true });
    if (existsSync(at(dir))) cpSync(at(dir), target, { recursive: true });
  }
  // Vite очищает dist/ при сборке сайта, а содержимое public/ копирует обратно в корень dist/.
  // Поэтому файлы библиотеки дополнительно кладутся в корень public/: после `npm run build`
  // в итоговой папке dist/ рядом с index.html лежат abi7-grid.js, .min.js(.map), .css, .min.css.
  for (const f of ['abi7-grid.js', 'abi7-grid.min.js', 'abi7-grid.min.js.map', 'abi7-grid.css', 'abi7-grid.min.css']) {
    copyFileSync(join(dist, f), at('public', f));
  }
  console.log('  mirrored dist/, plugins/, examples/ → public/ (для сайта документации)');
}
