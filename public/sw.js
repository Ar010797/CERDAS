// Service Worker for CERDAS - Administrasi Sekolah
// Menangani Push Notification latar belakang (saat aplikasi ditutup)

const CACHE_NAME = 'cerdas-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
    vibrate: [250, 100, 250, 100, 250],
    tag: data.tag || 'school-announcement',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || '/?tab=pengumuman',
      id: data.id || Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Ketika notifikasi di bilah HP diklik oleh wali murid
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/?tab=pengumuman';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Jika tab/aplikasi sudah terbuka, fokuskan dan arahkan ke tab pengumuman
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          if (client.url && client.url.includes(self.location.origin)) {
            client.postMessage({ type: 'NAVIGATE_ANNOUNCEMENTS' });
            return client.focus();
          }
        }
      }
      // Jika aplikasi sedang tertutup penuh, buka jendela baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
