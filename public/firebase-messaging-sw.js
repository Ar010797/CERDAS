// firebase-messaging-sw.js for Firebase Cloud Messaging in Background
// Diperlukan agar browser dan perangkat Android/iOS dapat menerima push FCM saat aplikasi ditutup/di-background

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "laughing-azimuth-807pf",
  appId: "1:800538701178:web:d7413a158361d043ebbac3",
  apiKey: "AIzaSyBZ-vtLbuEnT2-P7MAiWlcj2F7-j1XbVA8",
  authDomain: "laughing-azimuth-807pf.firebaseapp.com",
  storageBucket: "laughing-azimuth-807pf.firebasestorage.app",
  messagingSenderId: "800538701178"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message received: ', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || '📢 Notifikasi Sekolah CERDAS';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'Pemberitahuan baru dari sekolah.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: payload.data?.tag || 'cerdas-fcm-alert',
      vibrate: [250, 100, 250, 100, 400],
      data: {
        url: payload.data?.url || '/?tab=pengumuman',
        soundType: payload.data?.soundType || 'announcement'
      }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.warn('FCM SW initialization notice:', e);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/?tab=pengumuman';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          if (client.url && client.url.includes(self.location.origin)) {
            client.postMessage({ type: 'NAVIGATE_TAB', url: targetUrl });
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
