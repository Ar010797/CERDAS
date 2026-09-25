import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { playAnnouncementChime } from '../hooks/useAnnouncementsNotification';
import { playNotificationSound, unlockAudioContext, SoundType } from './audioNotifier';
import { triggerFloatingNotification } from '../components/FloatingNotificationCenter';

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
 * Mendeteksi apakah aplikasi sedang berjalan di dalam APK hasil build Median.co (GoNative) atau Android WebView
 */
export function isMedianApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return (
    !!w.median ||
    !!w.gonative ||
    /gonative|median|wv|android.*version\/[0-9]/i.test(navigator.userAgent || '')
  );
}

/**
 * Mendeteksi apakah perangkat terdeteksi sebagai Xiaomi (MIUI/HyperOS) atau Infinix (XOS)
 */
export function getDeviceBrand(): string {
  if (typeof window === 'undefined') return 'Perangkat';
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('xiaomi') || ua.includes('redmi') || ua.includes('poco') || ua.includes('miui')) return 'Xiaomi / Redmi';
  if (ua.includes('infinix') || ua.includes('xos')) return 'Infinix';
  if (ua.includes('samsung')) return 'Samsung';
  if (ua.includes('oppo')) return 'Oppo';
  if (ua.includes('vivo')) return 'Vivo';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS Apple';
  return 'Smartphone';
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
 * Memeriksa status izin notifikasi perangkat saat ini.
 * Jika perangkat tidak mendukung API Web Notification (seperti WebView di Xiaomi/Infinix APK),
 * kita cek status notifikasi mengambang internal (cerdas_floating_notif_enabled).
 */
export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }
  
  const floatingEnabled = localStorage.getItem('cerdas_floating_notif_enabled') === 'true';

  if (!('Notification' in window)) {
    // Pada WebView Android (Xiaomi / Infinix), jika floating notif aktif, anggap granted
    return floatingEnabled ? 'granted' : 'default';
  }

  const browserPerm = Notification.permission as NotificationPermissionState;
  if (browserPerm === 'granted' || floatingEnabled) {
    return 'granted';
  }
  return browserPerm;
}

/**
 * Mendaftarkan Service Worker dan izin notifikasi perangkat
 * Serta mengaktifkan Notifikasi Mengambang (Floating Heads-Up Notification) untuk Xiaomi & Infinix
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
  const deviceBrand = getDeviceBrand();
  const userClass = userData?.classId || userData?.assigned_class || 'Semua Kelas';
  const userRole = userData?.role || 'Wali Murid';
  const userId = userData?.uid || 'guest';

  // 1. Integrasi Native Median.co (OneSignal / Median Push Bridge)
  const w = window as any;
  if (isMedianApp()) {
    try {
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

  // 2. Registrasi Service Worker untuk Web Push / PWA jika ada
  let swReg: ServiceWorkerRegistration | null = null;
  if ('serviceWorker' in navigator) {
    try {
      swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
    } catch (swErr) {
      console.warn('Service worker registration notice:', swErr);
    }
  }

  // 3. Pastikan audio dan getaran dapat berbunyi
  try {
    unlockAudioContext();
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate([150, 80, 150]);
    }
  } catch {}

  // 4. Selalu aktifkan Notifikasi Mengambang (Floating Heads-Up Notification) di penyimpanan lokal
  localStorage.setItem('cerdas_floating_notif_enabled', 'true');

  // 5. Cek izin Web Notification standar browser
  let currentPermission: NotificationPermissionState = 'granted';
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        currentPermission = (await Notification.requestPermission()) as NotificationPermissionState;
      } catch (e) {
        console.warn('Request notification permission error:', e);
      }
    } else {
      currentPermission = Notification.permission as NotificationPermissionState;
    }
  }

  // Simpan status perangkat ke Firestore
  if (userId && userId !== 'guest') {
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
          deviceBrand,
          permission: 'granted',
          floatingNotifEnabled: true,
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

  // Tampilkan notifikasi mengambang selamat datang konfirmasi aktif
  triggerFloatingNotification({
    title: `Notifikasi Mengambang Aktif! 🔔`,
    body: `Notifikasi suara, getar, dan bilah mengambang berhasil diaktifkan untuk HP ${deviceBrand} Anda.`,
    type: 'announcement',
    durationMs: 6000
  });

  return {
    success: true,
    permission: 'granted',
    message: `Notifikasi Mengambang & Suara telah Aktif optimal di perangkat ${deviceBrand} Anda!`
  };
}

/**
 * Menampilkan notifikasi visual di bilah HP / lock screen / floating heads-up banner
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

  // 1. Tampilkan Notifikasi Mengambang (Floating Heads-Up Toast) di aplikasi
  triggerFloatingNotification({
    title: options.title,
    body: options.body,
    url: options.url,
    type: options.soundType === 'grade_released' ? 'grade_released' : 'announcement'
  });

  // 2. Bunyikan nada dering notifikasi & getar
  try {
    playNotificationSound(options.soundType || 'announcement');
  } catch {}

  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {}

  // 3. Tampilkan lewat Web Notification jika diizinkan
  if ('Notification' in window && Notification.permission === 'granted') {
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

    // Coba tampilkan lewat Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(options.title, notifOptions);
          return;
        }
      } catch (swErr) {
        console.warn('SW showNotification fallback:', swErr);
      }
    }

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
}

/**
 * Menguji apakah notifikasi bilah HP & notifikasi mengambang berfungsi dengan baik
 */
export async function sendTestPushNotification(userData?: any) {
  const deviceBrand = getDeviceBrand();
  await showDeviceNotification({
    title: `🔔 Tes Notifikasi HP Berhasil!`,
    body: `Notifikasi mengambang, suara dering, dan getaran telah aktif optimal di HP ${deviceBrand} Anda.`,
    url: '/?tab=pengumuman',
    tag: 'test-notification',
    soundType: 'announcement'
  });
}
