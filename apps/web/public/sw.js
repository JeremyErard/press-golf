// Service Worker for Press PWA
const CACHE_VERSION = 'v2';
const CACHE_NAME = `press-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `press-static-${CACHE_VERSION}`;

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('press-') && name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - network first for pages, cache first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API requests (let them go to network)
  if (url.pathname.startsWith('/api')) return;

  // Skip Clerk auth requests
  if (url.hostname.includes('clerk')) return;

  // Skip browser extension requests
  if (url.protocol === 'chrome-extension:') return;

  // For navigation requests (page loads)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Network failed - try cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // No cache, show offline page
          const offlineResponse = await caches.match('/offline');
          if (offlineResponse) {
            return offlineResponse;
          }
          // Last resort - cached home page
          return caches.match('/');
        })
    );
    return;
  }

  // For static assets (images, fonts, etc.) - cache first, then network
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|css|js)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Update cache in background
          fetch(request).then((response) => {
            if (response.status === 200) {
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(request, response);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // Not in cache, fetch and cache
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // Return empty response for failed static assets
          return new Response('', { status: 404 });
        });
      })
    );
    return;
  }

  // For other requests - network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for offline score updates (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scores') {
    // TODO: Implement score syncing when back online
    console.log('Background sync triggered for scores');
  }
});

// ============================================================================
// Push Notification Handlers
// ============================================================================

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW] Push received but no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    return;
  }

  const {
    type,
    title,
    body,
    icon = '/icons/icon-192x192.png',
    badge = '/icons/icon-72x72.png',
    tag,
    data: notificationData = {},
  } = data;

  // Build notification options based on type
  const options = {
    body,
    icon,
    badge,
    tag: tag || type, // Group notifications by type
    renotify: true,
    requireInteraction: type === 'round_invite' || type === 'game_invite',
    data: {
      type,
      url: notificationData.url || '/',
      ...notificationData,
    },
    vibrate: [100, 50, 100],
  };

  // Add actions based on notification type
  switch (type) {
    case 'round_invite':
      options.actions = [
        { action: 'view', title: 'View Round' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
      break;
    case 'game_invite':
      options.actions = [
        { action: 'view', title: 'View Game' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
      break;
    case 'score_update':
      options.actions = [
        { action: 'view', title: 'View Scores' },
      ];
      break;
    case 'tee_time_reminder':
      options.actions = [
        { action: 'view', title: 'View Round' },
      ];
      break;
    case 'settlement':
      options.actions = [
        { action: 'view', title: 'View Settlement' },
      ];
      break;
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Close the notification
  notification.close();

  // If user clicked dismiss, don't do anything else
  if (action === 'dismiss') {
    return;
  }

  // Determine the URL to open
  const urlToOpen = data.url || '/';

  event.waitUntil(
    // Check if there's already a window open
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Try to find an existing window with the app
        for (const client of windowClients) {
          const clientUrl = new URL(client.url);
          // If we find a window with our app, focus it and navigate
          if (clientUrl.origin === self.location.origin) {
            return client.focus().then((focusedClient) => {
              // Navigate to the notification URL
              if (focusedClient.navigate) {
                return focusedClient.navigate(urlToOpen);
              }
              // Fallback: post message to navigate
              focusedClient.postMessage({
                type: 'NOTIFICATION_CLICK',
                url: urlToOpen,
              });
              return focusedClient;
            });
          }
        }
        // No existing window, open a new one
        return clients.openWindow(urlToOpen);
      })
  );
});

// Handle notification close events (for analytics)
self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  console.log('[SW] Notification closed:', data.type);
});
