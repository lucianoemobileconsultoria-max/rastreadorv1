const CACHE_NAME = 'rastreador-background-v4';
const urlsToCache = [
  './',
  './rastreadorv1.html',
  './index.html',
  './manifest.json'
];

// Instalar e cachear
self.addEventListener('install', event => {
  console.log('[SW] Instalando v4 Background...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.log('[SW] Erro ao cachear:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativar e limpar caches antigos
self.addEventListener('activate', event => {
  console.log('[SW] Ativando v4 Background...');
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
  self.clients.claim();
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  // Não cachear requisições ao Supabase
  if (event.request.url.includes('supabase.co')) {
    return event.respondWith(fetch(event.request));
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// ==================== BACKGROUND SYNC ====================

// Enviar localização periodicamente (mesmo em background)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'enviar-localizacao') {
    console.log('[SW] Periodic Sync disparado:', event.tag);
    event.waitUntil(enviarLocalizacaoBackground());
  }
});

// Background Sync (quando volta a conexão)
self.addEventListener('sync', event => {
  if (event.tag === 'enviar-localizacao-pendente') {
    console.log('[SW] Sync disparado:', event.tag);
    event.waitUntil(enviarLocalizacaoBackground());
  }
});

// Função para enviar localização em background
async function enviarLocalizacaoBackground() {
  try {
    console.log('[SW] Tentando enviar localização em background...');
    
    // Notificar todos os clientes
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_LOCATION_REQUEST',
        timestamp: Date.now()
      });
    });
    
    console.log('[SW] Solicitação enviada para', clients.length, 'cliente(s)');
    return true;
  } catch (error) {
    console.error('[SW] Erro ao enviar localização:', error);
    return false;
  }
}

// ==================== MENSAGENS DOS CLIENTES ====================

self.addEventListener('message', event => {
  console.log('[SW] Mensagem recebida:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'START_BACKGROUND_TRACKING') {
    console.log('[SW] Iniciando rastreamento em background');
    // Aqui poderia registrar Periodic Background Sync se o navegador suportar
    registrarPeriodicSync();
  }
  
  if (event.data.type === 'STOP_BACKGROUND_TRACKING') {
    console.log('[SW] Parando rastreamento em background');
    // Cancelar Periodic Background Sync
    cancelarPeriodicSync();
  }
});

// Registrar Periodic Background Sync (Chrome 80+)
async function registrarPeriodicSync() {
  try {
    if ('periodicSync' in self.registration) {
      await self.registration.periodicSync.register('enviar-localizacao', {
        minInterval: 5 * 60 * 1000 // 5 minutos
      });
      console.log('[SW] ✅ Periodic Sync registrado (5 min)');
    } else {
      console.log('[SW] ⚠️ Periodic Sync não suportado');
    }
  } catch (error) {
    console.error('[SW] ❌ Erro ao registrar Periodic Sync:', error);
  }
}

// Cancelar Periodic Background Sync
async function cancelarPeriodicSync() {
  try {
    if ('periodicSync' in self.registration) {
      await self.registration.periodicSync.unregister('enviar-localizacao');
      console.log('[SW] ✅ Periodic Sync cancelado');
    }
  } catch (error) {
    console.error('[SW] ❌ Erro ao cancelar Periodic Sync:', error);
  }
}

// ==================== PUSH NOTIFICATIONS ====================

self.addEventListener('push', event => {
  console.log('[SW] Push recebido:', event);
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Rastreamento GPS';
  const options = {
    body: data.body || 'Localização enviada com sucesso',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'rastreamento-gps',
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notificação clicada');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('[SW] Service Worker v4 Background carregado! ✅');
