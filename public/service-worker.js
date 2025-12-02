// Service Worker pour SpeakFree PWA
const CACHE_NAME = 'speakfree-v1.0.0';
const OFFLINE_URL = '/index.html';

// Fichiers à mettre en cache pour le mode hors ligne
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/about.html',
  '/guide.html',
  '/terms.html',
  '/report.html',
  '/discussion.html',
  '/login.html',
  '/styles-mobile.css',
  '/config.js',
  '/maintenance-config.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Mise en cache des fichiers statiques');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie de mise en cache: Network First avec fallback Cache
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ignorer les requêtes API externes
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('cloudflare') ||
      event.request.url.includes('google-analytics')) {
    return;
  }

  event.respondWith(
    // Stratégie: Network First (réseau d'abord, puis cache)
    fetch(event.request)
      .then((response) => {
        // Si la réponse est valide, la mettre en cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // En cas d'échec réseau, utiliser le cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Si la page n'est pas en cache, afficher la page d'accueil
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          
          // Pour les autres ressources, retourner une erreur
          return new Response('Ressource non disponible hors ligne', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Gestion des messages depuis l'app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// Synchronisation en arrière-plan (pour les signalements hors ligne)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncPendingReports());
  }
});

async function syncPendingReports() {
  console.log('[Service Worker] Synchronisation des signalements en attente...');
  // Cette fonction sera complétée plus tard avec la gestion des signalements hors ligne
}

// Notifications Push (pour les futures fonctionnalités)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nouvelle notification SpeakFree',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'speakfree-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('SpeakFree', options)
  );
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});
