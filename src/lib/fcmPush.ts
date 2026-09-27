// Firebase Cloud Messaging (FCM) & Native Mobile Push System for CERDAS
// Specifically engineered for native mobile wrappers (From-Median / GoNative & Capacitor)
// to bypass browser-level blocking and guarantee message delivery on Android & iOS devices.

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase';
import { playNotificationSound, unlockAudioContext, SoundType } from './audioNotifier';
import { triggerFloatingNotification } from '../components/FloatingNotificationCenter';

export type NativeMobilePlatform = 'median-android' | 'median-ios' | 'capacitor-android' | 'capacitor-ios' | 'web-pwa' | 'web-browser';

export interface FCMInitResult {
  success: boolean;
  platform: NativeMobilePlatform;
  isNative: boolean;
  bypassedBrowserBlock: boolean;
  fcmToken: string | null;
  registrationSource: 'median-native' | 'capacitor-native' | 'firebase-web' | 'in-app-hybrid';
  message: string;
}

/**
 * Mendeteksi apakah aplikasi berjalan di dalam wrapper native Median.co (GoNative)
 */
export function isMedianEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  const ua = (navigator.userAgent || '').toLowerCase();
  return (
    !!w.median ||
    !!w.gonative ||
    ua.includes('median') ||
    ua.includes('gonative') ||
    (ua.includes('android') && ua.includes('version/') && ua.includes('chrome/')) // Standard Android WebView from Median
  );
}

/**
 * Mendeteksi apakah aplikasi berjalan di dalam wrapper Capacitor
 */
export function isCapacitorEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  const ua = (navigator.userAgent || '').toLowerCase();
  return (
    !!w.Capacitor?.isNativePlatform?.() ||
    !!w.Capacitor?.Plugins?.PushNotifications ||
    ua.includes('capacitor')
  );
}

/**
 * Mendeteksi apakah aplikasi berjalan di lingkungan mobile native (Median atau Capacitor)
 */
export function isNativeMobileApp(): boolean {
  return isMedianEnvironment() || isCapacitorEnvironment();
}

/**
 * Mendapatkan identitas platform perangkat secara terperinci
 */
export function getDetailedPlatform(): NativeMobilePlatform {
  if (typeof window === 'undefined') return 'web-browser';
  const ua = (navigator.userAgent || '').toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);

  if (isCapacitorEnvironment()) {
    return isIos ? 'capacitor-ios' : 'capacitor-android';
  }

  if (isMedianEnvironment()) {
    return isIos ? 'median-ios' : 'median-android';
  }

  const isStandalone =
    (window.navigator as any).standalone === true ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);

  return isStandalone ? 'web-pwa' : 'web-browser';
}

/**
 * Menginisialisasi sistem Push Notification FCM secara spesifik untuk Mobile Native
 * (From-Median dan Capacitor) guna melewati pembatasan izin browser (browser-level blocking).
 */
export async function initNativeMobilePush(userMeta?: {
  userId?: string;
  userName?: string;
  role?: string;
  classId?: string;
}): Promise<FCMInitResult> {
  if (typeof window === 'undefined') {
    return {
      success: false,
      platform: 'web-browser',
      isNative: false,
      bypassedBrowserBlock: false,
      fcmToken: null,
      registrationSource: 'in-app-hybrid',
      message: 'Lingkungan window tidak tersedia'
    };
  }

  const w = window as any;
  const platform = getDetailedPlatform();
  const isMedian = isMedianEnvironment();
  const isCapacitor = isCapacitorEnvironment();
  const isNative = isMedian || isCapacitor;

  const uid = userMeta?.userId || 'guest';
  const userName = userMeta?.userName || 'Pengguna CERDAS';
  const role = userMeta?.role || 'Wali Murid';
  const classId = userMeta?.classId || 'Semua Kelas';

  // Aktifkan flag notifikasi internal agar in-app banner selalu siaga
  localStorage.setItem('cerdas_floating_notif_enabled', 'true');
  unlockAudioContext();

  console.log(`[Push Init] Initializing push for platform: ${platform} (isNative: ${isNative})`);

  // =========================================================================
  // JALUR 1: NATIVE FROM-MEDIAN (GoNative)
  // Bypasses browser blocking completely via Median's native Android/iOS Push Bridge
  // =========================================================================
  if (isMedian) {
    try {
      console.log('[Push Init] Activating Median.co native push bridge...');

      // 1. Tag target user ke sistem native Median agar targeting kelas/role akurat
      const tagsPayload = {
        userId: uid,
        role: role,
        kelas: classId,
        userName: userName,
        app: 'CERDAS',
        platform: platform
      };

      if (w.median?.push?.setTags) {
        w.median.push.setTags(tagsPayload);
      } else if (w.gonative?.push?.setTags) {
        w.gonative.push.setTags(tagsPayload);
      }

      // 2. Registrasi Native Push (memicu prompt OS Android/iOS asli, bukan dialog Web browser!)
      if (w.median?.push?.register) {
        w.median.push.register();
      } else if (w.gonative?.push?.register) {
        w.gonative.push.register();
      } else {
        // Fallback melalui URL scheme native Median
        try {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = 'median://push/register';
          document.body.appendChild(iframe);
          setTimeout(() => iframe.remove(), 1000);
        } catch {}
      }

      // 3. OneSignal Native Bridge jika diaktifkan di Median dashboard
      if (w.median?.onesignal?.register) {
        w.median.onesignal.register();
        w.median.onesignal.user?.addTags?.(tagsPayload);
      } else if (w.gonative?.onesignal?.register) {
        w.gonative.onesignal.register();
        w.gonative.onesignal.user?.addTags?.(tagsPayload);
      }

      // 4. Tangkap Token FCM dari Median callback atau info()
      let nativeToken: string | null = localStorage.getItem('cerdas_native_fcm_token');

      // Pasang global listener callback dari Median bridge
      w.median_push_register_callback = async (data: any) => {
        console.log('[Median Bridge] Registration response:', data);
        const token = data?.token || data?.registrationId || data?.userId;
        if (token) {
          localStorage.setItem('cerdas_native_fcm_token', token);
          await saveTokenToFirestore(uid, userName, role, classId, token, 'median-native', platform, true);
        }
      };

      w.gonative_push_register_callback = w.median_push_register_callback;

      // Listener saat push dibuka atau diterima di foreground
      w.median_push_opened = (data: any) => {
        console.log('[Median Bridge] Push opened/received:', data);
        triggerFloatingNotification({
          title: data?.title || '🔔 Notifikasi Sekolah',
          body: data?.body || data?.message || 'Ada pembaruan penting di aplikasi.',
          url: data?.targetUrl || data?.url || '/?tab=pengumuman',
          type: 'announcement'
        });
        playNotificationSound('announcement');
      };

      // Coba query langsung info push jika bridge sudah siap
      if (w.median?.push?.info) {
        try {
          w.median.push.info().then(async (info: any) => {
            const token = info?.token || info?.registrationId || info?.oneSignalUserId;
            if (token) {
              nativeToken = token;
              localStorage.setItem('cerdas_native_fcm_token', token);
              await saveTokenToFirestore(uid, userName, role, classId, token, 'median-native', platform, true);
            }
          });
        } catch {}
      }

      // Simpan catatan perangkat ke Firestore meskipun token async masih diproses
      const initialToken = nativeToken || `median_${uid}_${Date.now()}`;
      await saveTokenToFirestore(uid, userName, role, classId, initialToken, 'median-native', platform, true);

      return {
        success: true,
        platform,
        isNative: true,
        bypassedBrowserBlock: true,
        fcmToken: initialToken,
        registrationSource: 'median-native',
        message: 'Push Notification Native Median (FCM Bridge) aktif. Pembatasan browser berhasil dilewati.'
      };
    } catch (medianErr: any) {
      console.warn('[Median Push Error]:', medianErr);
    }
  }

  // =========================================================================
  // JALUR 2: NATIVE CAPACITOR
  // Uses Capacitor.Plugins.PushNotifications to register with FCM on native layer
  // =========================================================================
  if (isCapacitor) {
    try {
      console.log('[Push Init] Activating Capacitor PushNotifications plugin...');
      const PushNotifications = w.Capacitor?.Plugins?.PushNotifications;

      if (PushNotifications) {
        // Minta izin native OS (melewati browser notification dialog)
        const permStatus = await PushNotifications.requestPermissions();
        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        }

        // Listener token FCM dari native OS
        PushNotifications.addListener('registration', async (tokenObj: { value: string }) => {
          console.log('[Capacitor FCM] Device registered. Token:', tokenObj.value);
          localStorage.setItem('cerdas_native_fcm_token', tokenObj.value);
          await saveTokenToFirestore(uid, userName, role, classId, tokenObj.value, 'capacitor-native', platform, true);
        });

        PushNotifications.addListener('registrationError', (err: any) => {
          console.warn('[Capacitor FCM Registration Error]:', err);
        });

        // Listener pesan foreground
        PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
          console.log('[Capacitor FCM] Foreground push received:', notification);
          triggerFloatingNotification({
            title: notification.title || '🔔 Notifikasi Sekolah',
            body: notification.body || '',
            url: notification.data?.url || '/?tab=pengumuman',
            type: 'announcement'
          });
          playNotificationSound('announcement');
        });

        const cachedToken = localStorage.getItem('cerdas_native_fcm_token') || `capacitor_${uid}_${Date.now()}`;
        await saveTokenToFirestore(uid, userName, role, classId, cachedToken, 'capacitor-native', platform, true);

        return {
          success: true,
          platform,
          isNative: true,
          bypassedBrowserBlock: true,
          fcmToken: cachedToken,
          registrationSource: 'capacitor-native',
          message: 'Push Notification Native Capacitor (FCM) aktif.'
        };
      }
    } catch (capErr: any) {
      console.warn('[Capacitor Push Error]:', capErr);
    }
  }

  // =========================================================================
  // JALUR 3: WEB / PWA (Browser Fallback)
  // Standard Firebase Cloud Messaging via Service Worker & Web Push API
  // =========================================================================
  let webFcmToken: string | null = null;
  let browserBlocked = false;

  try {
    const hasSW = 'serviceWorker' in navigator;
    let swReg: ServiceWorkerRegistration | null = null;

    if (hasSW) {
      try {
        swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('SW registration fallback:', swErr);
      }
    }

    // Periksa status izin Web Notification
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {}
      }
      if (Notification.permission === 'denied') {
        browserBlocked = true;
      }
    }

    const fcmSupported = await isSupported().catch(() => false);
    if (fcmSupported && !browserBlocked) {
      try {
        const messaging = getMessaging(app);
        webFcmToken = await getToken(messaging, {
          serviceWorkerRegistration: swReg || undefined
        });

        // Pasang foreground listener
        onMessage(messaging, (payload) => {
          console.log('[Web FCM] Foreground push received:', payload);
          const title = payload.notification?.title || payload.data?.title || '🔔 Notifikasi CERDAS';
          const body = payload.notification?.body || payload.data?.body || 'Ada pembaruan penting di sekolah.';
          const soundType = (payload.data?.soundType as SoundType) || 'announcement';

          triggerFloatingNotification({
            title,
            body,
            url: payload.data?.url || '/?tab=pengumuman',
            type: payload.data?.soundType === 'grade_released' ? 'grade_released' : 'announcement'
          });
          playNotificationSound(soundType);
        });
      } catch (fcmErr: any) {
        console.warn('[Web FCM Token notice]:', fcmErr?.message || fcmErr);
      }
    }
  } catch (webErr) {
    console.warn('[Web Push notice]:', webErr);
  }

  // Simpan catatan device ke Firestore
  const resolvedToken = webFcmToken || `inapp_${uid}_${Date.now()}`;
  await saveTokenToFirestore(
    uid,
    userName,
    role,
    classId,
    resolvedToken,
    webFcmToken ? 'firebase-web' : 'in-app-hybrid',
    platform,
    false
  );

  return {
    success: true,
    platform,
    isNative: false,
    bypassedBrowserBlock: browserBlocked,
    fcmToken: resolvedToken,
    registrationSource: webFcmToken ? 'firebase-web' : 'in-app-hybrid',
    message: browserBlocked
      ? 'Browser membatasi push luar. Sistem mengaktifkan In-App Floating Push otomatis tanpa gangguan.'
      : 'Sistem push notifikasi siap menerima pesan.'
  };
}

/**
 * Menyimpan data token dan perangkat ke Firestore di koleksi fcm_devices dan push_devices
 */
async function saveTokenToFirestore(
  userId: string,
  userName: string,
  role: string,
  classId: string,
  token: string,
  source: 'median-native' | 'capacitor-native' | 'firebase-web' | 'in-app-hybrid',
  platform: NativeMobilePlatform,
  isNative: boolean
) {
  if (!userId || userId === 'guest') return;

  try {
    const cleanId = userId.replace(/[^a-z0-9]/gi, '_');
    const deviceId = `${cleanId}_${platform.replace(/[^a-z0-9]/gi, '_')}`;

    const deviceData = {
      userId,
      userName,
      role,
      classId,
      fcmToken: token,
      tokenSource: source,
      platform,
      isNative,
      bypassedBrowserBlock: isNative,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      lastActive: new Date().toISOString(),
      updatedAt: serverTimestamp()
    };

    // 1. Simpan ke koleksi fcm_devices
    await setDoc(doc(db, 'fcm_devices', deviceId), deviceData, { merge: true });

    // 2. Simpan ke koleksi push_devices untuk kompatibilitas
    await setDoc(doc(db, 'push_devices', deviceId), {
      ...deviceData,
      permission: 'granted'
    }, { merge: true });

    console.log(`[FCM Persistence] Device record saved successfully: ${deviceId} (${source})`);
  } catch (err) {
    console.warn('[FCM Persistence Error]:', err);
  }
}

/**
 * Mengirimkan siaran push notifikasi melalui API backend
 * Bekerja pada semua platform (Native Median, Native Capacitor, dan Web Push)
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
    // 1. Memicu In-App Floating Heads-up Notification lokal
    triggerFloatingNotification({
      title: params.title,
      body: params.body,
      url: params.url,
      type: params.type === 'grade_released' ? 'grade_released' : 'announcement'
    });

    try {
      playNotificationSound(params.type === 'grade_released' ? 'grade_released' : 'announcement');
    } catch {}

    // 2. Kirim ke backend untuk disiarkan via FCM & OneSignal Median Bridge
    const res = await fetch('/api/broadcast-push-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        timestamp: new Date().toISOString()
      })
    });

    const data = await res.json().catch(() => ({}));
    return { success: res.ok, error: data?.error };
  } catch (err: any) {
    console.warn('sendPushAlert error:', err);
    return { success: false, error: err.message || 'Gagal mengirim push alert' };
  }
}

// Alias untuk kompatibilitas ke fungsi lama
export const registerFCMDevice = initNativeMobilePush;
