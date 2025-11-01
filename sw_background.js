// --- Service Worker para Rastreamento On-Demand via Push ---

const CACHE_NAME = 'geomad-cache-v6-push';
const urlsToCache = [
  './',
  './rastreadorv2.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js'
];

// Importar o script do Supabase para poder usá-lo no Service Worker
self.importScripts('https://cdn.jsdelivr.net/npm/@supabase/supabase-js');

// Inicializar o cliente Supabase DENTRO do Service Worker
// As variáveis de URL e KEY precisam ser definidas aqui também.
const SUPABASE_URL = 'https://rptxfjlxymfmxucctuhc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdHhmamx4eW1mbXh1Y2N0dWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NTcxNjMsImV4cCI6MjA3NzEzMzE2M30.kQSF0jp_-0Qi2AmHQNKz6eTo7zeEi3b7Lk9UjT216dU';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker v6...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Ativando Service Worker v6...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  // Ignora o cache para requisições da Supabase para garantir dados sempre atualizados
  if (requestUrl.hostname.includes('supabase.co')) {
    return; 
  }
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// --- OUVINTE DE PUSH: O CORAÇÃO DA NOVA LÓGICA ---
self.addEventListener('push', (event) => {
  console.log('[SW] Push Recebido!');
  
  if (!event.data) {
    console.error('[SW] Push event mas sem dados!');
    return;
  }
  
  const data = event.data.json();
  console.log('[SW] Dados do Push:', data);
  
  const { usuarioId, title, body } = data;

  const promiseChain = self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png'
  })
  .then(() => {
      return new Promise((resolve, reject) => {
          // Solicita a localização com alta precisão
          navigator.geolocation.getCurrentPosition(
              (position) => {
                  console.log('[SW] Localização obtida:', position.coords);
                  resolve(position);
              },
              (error) => {
                  console.error('[SW] Erro ao obter geolocalização:', error);
                  reject(error);
              },
              { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
          );
      });
  })
  .then((position) => {
      console.log(`[SW] Enviando localização para o usuário ID: ${usuarioId}`);
      const { latitude, longitude } = position.coords;
      const now = new Date().toISOString();

      // Envia a localização para as duas tabelas
      return Promise.all([
          supabase.from('usuarios_localizacao').update({
              latitude: latitude,
              longitude: longitude,
              created_at: now
          }).eq('id', usuarioId),
          
          supabase.from('historico_localizacao').insert({
              usuario_id: usuarioId,
              latitude: latitude,
              longitude: longitude,
              created_at: now
          })
      ]);
  })
  .then(([updateResult, insertResult]) => {
      if (updateResult.error) throw new Error(`[SW] Erro no update: ${updateResult.error.message}`);
      if (insertResult.error) throw new Error(`[SW] Erro no insert: ${insertResult.error.message}`);
      
      console.log('[SW] Localização enviada com sucesso para o Supabase!');
      
      // Mostra uma segunda notificação informando o sucesso
      return self.registration.showNotification('✅ Localização Enviada!', {
          body: 'Sua localização foi atualizada com sucesso no painel.',
          icon: '/icon-192.png'
      });
  })
  .catch(err => {
      console.error('[SW] Falha na cadeia de promessas do Push:', err);
      // Notifica o usuário sobre a falha
      return self.registration.showNotification('❌ Falha ao Enviar Localização', {
          body: `Não foi possível obter ou enviar sua localização. Erro: ${err.message}`,
          icon: '/icon-192.png'
      });
  });

  event.waitUntil(promiseChain);
});

console.log('[SW] Service Worker v6 (Push) carregado.');
