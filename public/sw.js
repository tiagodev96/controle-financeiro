// Service worker mínimo. Existe pra atender o critério de instalabilidade do
// Chrome Android (precisa de SW com handler de fetch). Não fazemos cache
// agressivo — todo request vai pra rede; se offline, cai pro fallback simples.
//
// Versionamento: bump SW_VERSION pra forçar update em todos clients.

const SW_VERSION = 'v1';
const OFFLINE_FALLBACK = '/';

self.addEventListener('install', (event) => {
  // Ativa imediatamente; sem precache.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Toma controle de todas as abas abertas sem precisar reload.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só interceptamos navegação (HTML). Assets passam direto.
  if (req.mode !== 'navigate') return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(req);
      } catch {
        // Offline ou erro de rede: serve a home como shell mínimo.
        const cache = await caches.open(`fallback-${SW_VERSION}`);
        const cached = await cache.match(OFFLINE_FALLBACK);
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title><p>Sem conexão.</p>',
          { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 },
        );
      }
    })(),
  );
});
