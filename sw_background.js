const CACHE_NAME = 'geomad-cache-v4'; // Versão do cache atualizada para forçar a atualização
const urlsToCache = [
  './',
  './rastreadorv2.html',
  './manifest.json',
  './icon-192.png', // Corrigido para .png
  './icon-512.png', // Corrigido para .png
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js'
];

// Instalar e cachear os arquivos principais da aplicação
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker v4...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cache aberto, adicionando arquivos ao cache...');
      return cache.addAll(urlsToCache).catch(err => {
        console.error('[SW] Erro ao adicionar arquivos ao cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativar o Service Worker e limpar caches antigos
self.addEventListener('activate', event => {
  console.log('[SW] Ativando Service Worker v4...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Interceptar requisições de rede
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Ignora completamente as requisições para a API do Supabase, sempre buscando na rede.
  if (requestUrl.hostname.includes('supabase.co')) {
    return;
  }

  // Para todas as outras requisições, usa a estratégia "cache-first".
  event.respondWith(
    caches.match(event.request).then(response => {
      // Se a resposta estiver no cache, retorna do cache.
      if (response) {
        return response;
      }
      // Se não, busca na rede.
      return fetch(event.request);
    })
  );
});

console.log('[SW] Service Worker v4 carregado.');
