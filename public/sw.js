// Service Worker for CERDAS - Administrasi Sekolah
// Version 2: Mendukung Caching Aset Offline, IndexedDB fallback, & Push Notification

const CACHE_NAME = 'cerdas-static-v2';
const RUNTIME_CACHE = 'cerdas-runtime-v2';

// Aset statis inti yang selalu di-cache saat Service Worker terpasang
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Precache partial fallback:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler: Strategi Caching Stale-While-Revalidate untuk script/style/gambar & Network-First untuk navigasi halaman
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Jangan cache request non-GET atau request ke Firebase Firestore / Auth / API push
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('firebase')
  ) {
    return;
  }

  // 1. Navigasi Halaman HTML (SPA) -> Network First dengan Fallback ke Cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
          return caches.match('/');
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, SVG, Images, Fonts) -> Stale While Revalidate
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff|woff2|ico)$/) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);

        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

// Menangkap event Push Notification saat aplikasi ditutup
self.addEventListener('push', (event) => {
  let data = {
    title: '📢 Pengumuman Sekolah Baru',
    body: 'Ada informasi penting dari Guru atau Admin sekolah.',
    url: '/?tab=pengumuman',
    tag: 'cerdas-announcement'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [300, 100, 300, 100, 400],
    tag: data.tag || 'school-announcement',
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: {
      url: data.url || '/?tab=pengumuman',
      id: data.id || Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Ketika notifikasi di bilah HP diklik oleh wali murid atau guru
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/?tab=pengumuman';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          if (client.url && client.url.includes(self.location.origin)) {
            client.postMessage({ type: 'NAVIGATE_ANNOUNCEMENTS', url: targetUrl });
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
