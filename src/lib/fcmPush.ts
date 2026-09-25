// Firebase Cloud Messaging (FCM) & Web Push Notification Client Helper
// Mengelola integrasi token FCM, Service Worker sync, dan push payload listener

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { app, db } from './firebase';
import { playNotificationSound, unlockAudioContext } from './audioNotifier';

export interface FCMRegistrationResult {
  supported: boolean;
  token: string | null;
  permission: NotificationPermission;
  error?: string;
}

/**
 * Meminta izin dan mendaftarkan token FCM untuk perangkat saat ini.
 * Menyimpan token ke Firestore di koleksi `fcm_tokens` dan `push_devices`.
 */
export async function registerFCMDevice(userMeta?: {
  userId?: string;
  userName?: string;
  role?: string;
  classId?: string;
}): Promise<FCMRegistrationResult> {
  if (typeof window === 'undefined') {
    return { supported: false, token: null, permission: 'default', error: 'Window tidak tersedia' };
  }

  // 1. Cek apakah browser mendukung Web Push & Service Worker
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasNotification = 'Notification' in window;

  if (!hasServiceWorker || !hasNotification) {
    return {
      supported: false,
      token: null,
      permission: 'default',
      error: 'Browser tidak mendukung Web Push Service Worker.'
    };
  }

  // 2. Minta izin pengguna secara interaktif
  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch (e: any) {
      console.warn('Request notification permission error:', e);
    }
  }

  if (permission !== 'granted') {
    return {
      supported: true,
      token: null,
      permission,
      error: permission === 'denied' ? 'Izin notifikasi diblokir oleh pengguna.' : 'Izin notifikasi belum disetujui.'
    };
  }

  // 3. Pastikan Service Worker terdaftar
  let swReg: ServiceWorkerRegistration | null = null;
  try {
    swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
  } catch (swErr) {
    console.warn('Service worker ready fallback notice:', swErr);
  }

  // 4. Periksa dukungan modul messaging Firebase
  let fcmSupported = false;
  try {
    fcmSupported = await isSupported();
  } catch {
    fcmSupported = false;
  }

  let fcmToken: string | null = null;

  if (fcmSupported) {
    try {
      const messaging = getMessaging(app);

      // Gunakan default VAPID key atau messagingSenderId jika ada
      fcmToken = await getToken(messaging, {
        serviceWorkerRegistration: swReg || undefined
      });

      // Pasang pendengar foreground message
      onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground message received:', payload);
        const title = payload.notification?.title || payload.data?.title || 'Notifikasi CERDAS';
        const body = payload.notification?.body || payload.data?.body || 'Ada pembaruan penting di aplikasi.';
        const soundType = (payload.data?.soundType as any) || 'announcement';

        // Bunyikan nada dering
        playNotificationSound(soundType);

        // Tampilkan notifikasi visual via Service Worker atau Desktop Notification
        if (swReg && swReg.showNotification) {
          swReg.showNotification(title, {
            body,
            icon: '/icon.svg',
            badge: '/icon.svg',
            tag: payload.data?.tag || 'fcm-alert',
            data: {
              url: payload.data?.url || '/?tab=pengumuman'
            }
          });
        } else if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/icon.svg',
            badge: '/icon.svg'
          });
        }
      });
    } catch (tokenErr: any) {
      console.warn('[FCM Token Notice]:', tokenErr?.message || tokenErr);
    }
  }

  // 5. Simpan device & token ke Firestore agar dapat menerima notifikasi push otomatis
  const uid = userMeta?.userId || 'guest';
  const role = userMeta?.role || 'Wali Murid';
  const classId = userMeta?.classId || 'Semua Kelas';

  if (uid && uid !== 'guest') {
    try {
      const deviceId = `${uid}_web_${window.navigator.userAgent.replace(/[^a-z0-9]/gi, '').slice(0, 16)}`;
      await setDoc(doc(db, 'fcm_devices', deviceId), {
        userId: uid,
        userName: userMeta?.userName || 'Pengguna',
        role,
        classId,
        fcmToken: fcmToken || null,
        hasFcm: !!fcmToken,
        permission: permission,
        userAgent: navigator.userAgent,
        updatedAt: serverTimestamp(),
        lastActive: new Date().toISOString()
      }, { merge: true });
    } catch (saveErr) {
      console.warn('Saving FCM device record error:', saveErr);
    }
  }

  return {
    supported: true,
    token: fcmToken,
    permission
  };
}

/**
 * Mengirimkan push notifikasi via API backend
 * Mendukung event Pengumuman Baru dan Nilai Tugas Baru yang Diterbitkan
 */
export async function sendPushAlert(params: {
  title: string;
  body: string;
  type: 'announcement' | 'grade_released' | 'new_assignment';
  targetRole?: 'Semua' | 'Wali Murid' | 'Guru';
  targetClass?: string;
  url?: string;
  studentId?: string;
  assignmentId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/broadcast-push-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        timestamp: new Date().toISOString()
      })
    });
    const data = await res.json();
    return { success: res.ok, error: data?.error };
  } catch (err: any) {
    console.warn('Send push alert error:', err);
    return { success: false, error: err.message || 'Gagal mengirim push alert' };
  }
}
