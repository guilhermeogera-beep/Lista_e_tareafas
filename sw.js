/* Service worker - app shell offline.
   Troque a versão sempre que publicar mudanças, para o app atualizar nos celulares. */
const VERSAO = 'tarefas-v25';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

const ARQUIVOS = [
  SUPABASE_JS,
  './',
  './index.html',
  './manifest.webmanifest',
  './config.js?v=25',
  './assets/css/style.css?v=25',
  './assets/js/sugestoes.js?v=25',
  './assets/js/app.js?v=25',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSAO)
      .then(c => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // biblioteca do Supabase (CDN): cache primeiro, ela não muda
  if (req.url === SUPABASE_JS) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }
  if (new URL(req.url).origin !== location.origin) return;

  /* Rede primeiro, cache como rede de segurança (mesma lógica do app da pizza):
     com internet o que está no ar sempre ganha; sem internet, cai para o cache. */
  // cache: no-store ignora o cache HTTP do navegador (o GitHub Pages manda max-age=600, e sem isso
  // dava para receber o index.html novo com o app.js velho, ou vice-versa)
  e.respondWith(
    fetch(req, { cache: 'no-store' })
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copia = res.clone();
          caches.open(VERSAO).then(c => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit =>
        hit ||
        (req.mode === 'navigate' ? caches.match('./index.html') : null) ||
        new Response('', { status: 504, statusText: 'Offline' })
      ))
  );
});
