// Service Worker para Push Notifications
// Configuración para notificaciones push
const VAPID_PUBLIC_KEY = 'BDSbebZd-j-TMgkUCtUWgvZ9OwURp7jho4DWGhUOZmFSg30UsmrccyxmDw3JytUcT9E_5NCrbWE39l7mWegGV0Y';

// Cache de notificaciones para evitar duplicados
const notificationCache = new Set();

console.log('🔔 Service Worker loaded - Development mode with enhanced logging');

// Escuchar mensajes push
self.addEventListener('push', (event) => {
  console.log('🔔 Push notification received:', event);
  
  if (!event.data) {
    console.log('❌ No data in push event');
    return;
  }

  try {
    const data = event.data.json();
    console.log('🔔 Push data:', data);

    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/icon-192x192.png',
      data: {
        url: data.url || '/',
        id: data.id
      },
      vibrate: [200, 100, 200],
      requireInteraction: false
    };

    // Evitar duplicados si la notificación ya se mostró recientemente
    if (data.id && notificationCache.has(data.id)) {
      console.log('Notification already in cache, skipping:', data.id);
      return;
    }

    event.waitUntil(
      self.registration.showNotification(data.title, options)
        .then(() => {
          if (data.id) {
            notificationCache.add(data.id);
            setTimeout(() => notificationCache.delete(data.id), 5000); // Limpiar cache después de 5 segundos
          }
          console.log('✅ Notification shown successfully');
        })
        .catch(error => {
          console.error('❌ Error showing notification:', error);
        })
    );
  } catch (error) {
    console.error('❌ Error parsing push data:', error);
  }
});

// Escuchar clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.openWindow(urlToOpen)
      .then(() => {
        console.log('✅ Window opened:', urlToOpen);
      })
      .catch(error => {
        console.error('❌ Error opening window:', error);
      })
  );
});

// Escuchar mensajes del cliente (frontend)
self.addEventListener('message', (event) => {
  console.log('🔔 Message received from client:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Evento de instalación
self.addEventListener('install', (event) => {
  console.log('🔔 Service Worker installing...');
  self.skipWaiting();
});

// Evento de activación
self.addEventListener('activate', (event) => {
  console.log('🔔 Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

console.log('🔔 Service Worker setup complete');