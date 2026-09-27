import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Smartphone,
  Sparkles,
  Volume2,
  RefreshCw,
  ShieldCheck,
  Radio,
  Send
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNativeFCMPush } from '../hooks/useNativeFCMPush';

interface PushNotificationManagerProps {
  compact?: boolean;
}

export default function PushNotificationManager({ compact = false }: PushNotificationManagerProps) {
  const { userData } = useAuth();
  const {
    isNative,
    isMedian,
    isCapacitor,
    platform,
    bypassedBrowserBlock,
    fcmToken,
    registrationSource,
    isRegistered,
    loading,
    statusMessage,
    reRegister,
    sendTestAlert
  } = useNativeFCMPush();

  const [testing, setTesting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    try {
      await sendTestAlert();
      setToastMessage('🔔 Sinyal tes push FCM mobile & nada dering berhasil dipicu!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage('Gagal mengirim tes: ' + (err.message || ''));
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    try {
      await reRegister();
      setToastMessage('✅ Token perangkat berhasil disinkronkan ke Firebase Cloud Messaging!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      setToastMessage('Gagal menyinkronkan token perangkat.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-1.5 shadow-2xs hover:bg-emerald-100 transition-colors cursor-pointer"
          title="Tes FCM Mobile & Suara"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>FCM Mobile Aktif</span>
        </button>
      </div>
    );
  }

  const platformBadgeLabel = isMedian
    ? 'From-Median Native APK (Android/iOS)'
    : isCapacitor
      ? 'Capacitor Native Mobile'
      : platform === 'web-pwa'
        ? 'PWA Standalone Mobile'
        : 'Web Browser & Android';

  return (
    <div className="bg-gradient-to-r from-emerald-50/70 via-indigo-50/50 to-purple-50/70 dark:from-slate-900 dark:via-slate-850 dark:to-indigo-950/40 rounded-2xl border border-emerald-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-2xs transition-all relative overflow-hidden">
      {toastMessage && (
        <div className="mb-3 px-3.5 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-md animate-fade-in flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-emerald-200 hover:text-white">✕</button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm bg-emerald-600 text-white">
            <Bell className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Firebase Cloud Messaging (FCM) & Push Mobile
              </h3>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span>{platformBadgeLabel}</span>
              </span>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{bypassedBrowserBlock || isNative ? 'Bypass Browser Block Aktif' : 'FCM Cloud Aktif'}</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed max-w-2xl">
              {isNative
                ? 'Sistem Push Notification menggunakan jembatan native mobile (From-Median / Capacitor) terhubung langsung ke Firebase Cloud Messaging di tingkat OS. Pesan absensi masuk sekolah, tugas baru, rilis nilai rapot, dan pengumuman tiba seketika tanpa terhalang pemblokiran browser.'
                : 'Sistem Hybrid FCM CERDAS aktif di perangkat Anda. Mengombinasikan Web Push Service Worker dan In-App Floating Heads-up Notification agar pemberitahuan tetap tiba dengan nada dering dan getar.'}
            </p>

            {/* Token preview */}
            {fcmToken && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <Radio className="w-3 h-3 text-emerald-600 shrink-0 animate-pulse" />
                <span className="truncate max-w-xs sm:max-w-md">Token ID: {fcmToken}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap self-start md:self-auto">
          <button
            onClick={handleSync}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:scale-95 rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Sinkronkan token ke Firebase Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sinkron Token</span>
          </button>

          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            title="Kirim tes notifikasi ke perangkat HP"
          >
            {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
            <span>Tes Sinyal FCM & Suara</span>
          </button>
        </div>
      </div>

      {/* Helpful info */}
      <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>
            <b>Keandalan Android & iOS:</b> Terdaftar di koleksi Firebase Firestore <code>fcm_devices</code> ({registrationSource}) siap menerima siaran otomatis dari guru dan sekolah.
          </span>
        </div>
      </div>
    </div>
  );
}
