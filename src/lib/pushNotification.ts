import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { playAnnouncementChime } from '../hooks/useAnnouncementsNotification';
import { playNotificationSound, unlockAudioContext, SoundType } from './audioNotifier';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface PushDeviceMeta {
  userId: string;
  userName?: string;
  role?: string;
  classId?: string;
  platform: 'median-android' | 'median-ios' | 'web-pwa' | 'web-browser';
  permission: NotificationPermissionState;
  updatedAt: any;
}

/**
 * Mendeteksi apakah aplikasi sedang berjalan di dalam APK hasil build Median.co (GoNative)
 */
export function isMedianApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return (
    !!w.median ||
    !!w.gonative ||
    /gonative|median/i.test(navigator.userAgent || '')
  );
}

/**
 * Mendeteksi tipe platform perangkat saat ini
 */
export function getAppPlatform(): 'median-android' | 'median-ios' | 'web-pwa' | 'web-browser' {
  if (typeof window === 'undefined') return 'web-browser';
  const ua = navigator.userAgent || '';
  const isMedian = isMedianApp();

  if (isMedian) {
    if (/iphone|ipad|ipod/i.test(ua)) return 'median-ios';
    return 'median-android';
  }

  // Cek mode PWA standalone (aplikasi diinstal di layar utama)
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (isStandalone) return 'web-pwa';
  return 'web-browser';
}

/**
 * Memeriksa status izin notifikasi perangkat saat ini
 */
export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

/**
 * Mendaftarkan Service Worker dan izin notifikasi perangkat
 * Serta menyinkronkan data kelas & peran wali murid ke Median / Firestore
 */
export async function registerPushNotification(userData?: {
  uid?: string;
  name?: string;
  role?: string;
  classId?: string;
  assigned_class?: string;
}): Promise<{ success: boolean; permission: NotificationPermissionState; message: string }> {
  if (typeof window === 'undefined') {
    return { success: false, permission: 'unsupported', message: 'Window tidak tersedia' };
  }

  const platform = getAppPlatform();
  const userClass = userData?.classId || userData?.assigned_class || 'Semua Kelas';
  const userRole = userData?.role || 'Wali Murid';
  const userId = userData?.uid || 'guest';

  // 1. Integrasi Native Median.co (OneSignal / Median Push Bridge)
  const w = window as any;
  if (isMedianApp()) {
    try {
      // Registrasi OneSignal di Median
      if (w.median?.onesignal) {
        w.median.onesignal.register();
        w.median.onesignal.user?.addTags?.({
          role: userRole,
          kelas: userClass,
          userId: userId
        });
      } else if (w.gonative?.onesignal) {
        w.gonative.onesignal.register();
        w.gonative.onesignal.user?.addTags?.({
          role: userRole,
          kelas: userClass,
          userId: userId
        });
      }

      // Registrasi Generic Push di Median
      if (w.median?.push) {
        w.median.push.register();
        w.median.push.setTags?.({
          role: userRole,
          kelas: userClass,
          userId: userId
        });
      }
    } catch (medianErr) {
      console.warn('Median push bridge notice:', medianErr);
    }
  }

  // 2. Registrasi Service Worker untuk Web Push / PWA
  let swReg: ServiceWorkerRegistration | null = null;
  if ('serviceWorker' in navigator) {
    try {
      swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
    } catch (swErr) {
      console.warn('Service worker registration notice:', swErr);
    }
  }

  // 3. Minta Izin Notifikasi Sistem
  if (!('Notification' in window)) {
    return {
      success: false,
      permission: 'unsupported',
      message: 'Perangkat ini tidak mendukung Web Notification.'
    };
  }

  let currentPermission: NotificationPermissionState = Notification.permission;
  if (currentPermission === 'default') {
    try {
      currentPermission = (await Notification.requestPermission()) as NotificationPermissionState;
    } catch (e) {
      console.warn('Request notification permission error:', e);
    }
  }

  // 4. Simpan status perangkat ke Firestore jika diizinkan
  if (currentPermission === 'granted' && userId && userId !== 'guest') {
    try {
      const deviceDocId = `${userId}_${platform.replace(/[^a-z0-9]/gi, '_')}`;
      const deviceRef = doc(db, 'push_devices', deviceDocId);
      await setDoc(
        deviceRef,
        {
          userId,
          userName: userData?.name || 'Wali Murid',
          role: userRole,
          classId: userClass,
          platform,
          permission: currentPermission,
          userAgent: navigator.userAgent,
          updatedAt: serverTimestamp(),
          active: true
        },
        { merge: true }
      );
    } catch (dbErr) {
      console.warn('Saving push device record notice:', dbErr);
    }
  }

  if (currentPermission === 'granted') {
    return {
      success: true,
      permission: 'granted',
      message: isMedianApp()
        ? 'Notifikasi HP berhasil diaktifkan dengan prioritas tinggi via Median Native!'
        : 'Notifikasi HP berhasil diaktifkan! Pengumuman penting akan langsung masuk ke bilah HP.'
    };
  } else if (currentPermission === 'denied') {
    return {
      success: false,
      permission: 'denied',
      message: 'Izin notifikasi diblokir di setelan browser/HP. Silakan buka Pengaturan HP untuk mengizinkannya.'
    };
  }

  return {
    success: false,
    permission: currentPermission,
    message: 'Izin notifikasi belum disetujui.'
  };
}

/**
 * Menampilkan notifikasi visual di bilah HP / lock screen
 */
export async function showDeviceNotification(options: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  badge?: string;
  soundType?: SoundType;
}) {
  if (typeof window === 'undefined') return;

  unlockAudioContext();

  // Bunyikan nada dering notifikasi & getar
  try {
    playNotificationSound(options.soundType || 'announcement');
  } catch {}

  // Jika izin tidak granted, cukup bunyikan suara
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const notifOptions: any = {
    body: options.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: options.tag || 'school-announcement',
    renotify: true,
    vibrate: [250, 100, 250, 100, 250],
    data: {
      url: options.url || '/?tab=pengumuman'
    }
  };

  // Coba tampilkan lewat Service Worker (agar muncul di bilah atas HP Android meskipun browser diminimalkan)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(options.title, notifOptions);
        return;
      }
    } catch (swErr) {
      console.warn('SW showNotification fallback to new Notification:', swErr);
    }
  }

  // Fallback standar browser
  try {
    const notif = new Notification(options.title, notifOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
      if (options.url) {
        window.location.href = options.url;
      }
    };
  } catch (nErr) {
    console.warn('new Notification error:', nErr);
  }
}

/**
 * Menguji apakah notifikasi bilah HP berfungsi dengan baik
 */
export async function sendTestPushNotification(userData?: any) {
  const isMedian = isMedianApp();
  await showDeviceNotification({
    title: '🔔 Tes Notifikasi CERDAS Berhasil!',
    body: isMedian
      ? 'HP Anda terhubung via Aplikasi Median. Pengumuman baru dari Admin atau Guru akan langsung berdering di HP Anda!'
      : 'HP Anda terhubung! Pengumuman baru dari Admin atau Guru akan langsung masuk ke bilah notifikasi HP Anda.',
    url: '/?tab=pengumuman',
    tag: 'test-notification'
  });
}
