// Синхронизация светлой/тёмной темы страницы-примера с сайтом документации
// (через ?theme=dark в адресе и postMessage). К библиотеке не относится.
const params = new URLSearchParams(location.search);
const apply = (t) => (document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light');
apply(params.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
addEventListener('message', (e) => {
  if (e.data && e.data.abi7Theme) apply(e.data.abi7Theme);
});
