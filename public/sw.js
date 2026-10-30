const CACHE_PREFIX = 'education-app-'
const CACHE_NAME = `${CACHE_PREFIX}v4`
const STATIC_ASSETS = ['/offline.html', '/icon-192x192.png', '/icon-512x512.png']

self.addEventListener('install', (event) => {
  // A failed precache must not replace a working service worker.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting())
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
      await self.clients.claim()
    })
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    // Never cache school pages, including the personalized root redirect.
    event.respondWith(
      fetch(request).catch(async () => (await caches.match('/offline.html')) || Response.error())
    )
    return
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((response) => response || fetch(request)))
  }
})

self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Education App',
    body: 'New notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
  }

  if (event.data) {
    try {
      notificationData = event.data.json()
    } catch {
      notificationData.body = event.data.text()
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/icon-192x192.png',
    badge: notificationData.badge || '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
    },
  }

  event.waitUntil(self.registration.showNotification(notificationData.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

self.addEventListener('notificationclose', (_event) => {
  // Optional: Track notification dismissals
})
