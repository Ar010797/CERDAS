import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Sparkles,
  Info,
  Volume2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  isMedianApp,
  getAppPlatform,
  getNotificationPermissionStatus,
  registerPushNotification,
  sendTestPushNotification,
  NotificationPermissionState
} from '../lib/pushNotification';

interface PushNotificationManagerProps {
  compact?: boolean;
}

export default function PushNotificationManager({ compact = false }: PushNotificationManagerProps) {
  const { userData } = useAuth();
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isMedian, setIsMedian] = useState(false);
  const [platform, setPlatform] = useState<string>('web-browser');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setPermission(getNotificationPermissionStatus());
    setIsMedian(isMedianApp());
    setPlatform(getAppPlatform());
  }, []);

  const handleActivate = async () => {
    setLoading(true);
    try {
      const res = await registerPushNotification(userData || undefined);
      setPermission(res.permission);
      setToastMessage(res.message);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage('Gagal mengaktifkan notifikasi: ' + (err.message || ''));
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await sendTestPushNotification(userData);
      setToastMessage('Sinyal tes notifikasi dikirim ke HP Anda!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage('Gagal mengirim tes notifikasi: ' + (err.message || ''));
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setTesting(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {permission === 'granted' ? (
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-1.5 shadow-2xs hover:bg-emerald-100 transition-colors"
            title="Tes notifikasi HP"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Notif HP Aktif</span>
          </button>
        ) : (
          <button
            onClick={handleActivate}
            disabled={loading}
            className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all"
          >
            <Bell className="w-3.5 h-3.5 animate-bounce" />
            <span>{loading ? 'Mengaktifkan...' : 'Aktifkan Notifikasi'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-850 dark:to-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-slate-800 p-4 sm:p-5 shadow-2xs transition-all relative overflow-hidden">
      {toastMessage && (
        <div className="mb-3 px-3.5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl shadow-md animate-fade-in flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-indigo-200 hover:text-white">✕</button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
            permission === 'granted'
              ? 'bg-emerald-500 text-white'
              : permission === 'denied'
                ? 'bg-rose-500 text-white'
                : 'bg-indigo-600 text-white'
          }`}>
            <Bell className={`w-5 h-5 ${permission === 'default' ? 'animate-bounce' : ''}`} />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Notifikasi Pengumuman HP Wali Murid
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                isMedian
                  ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}>
                <Smartphone className="w-3 h-3" />
                <span>{isMedian ? 'Aplikasi Median Native' : 'Browser Web / PWA'}</span>
              </span>

              {permission === 'granted' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Aktif di Perangkat Ini</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl">
              {permission === 'granted'
                ? 'Perangkat HP Anda telah terdaftar. Ketika Admin atau Guru mempublikasikan pengumuman sekolah, notifikasi dengan getar & dering akan otomatis muncul di bilah atas HP Anda meskipun aplikasi ditutup.'
                : permission === 'denied'
                  ? 'Izin notifikasi diblokir pada setelan perangkat ini. Mohon aktifkan izin notifikasi di Pengaturan HP / Browser agar tidak ketinggalan informasi sekolah.'
                  : 'Aktifkan izin notifikasi agar pengumuman penting (kegiatan, ujian, surat edaran, libur) langsung berdering di HP Anda meskipun aplikasi tidak sedang dibuka.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap self-start md:self-auto">
          {permission !== 'granted' ? (
            <button
              onClick={handleActivate}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              <span>{loading ? 'Menghubungkan...' : 'Aktifkan di HP Ini'}</span>
            </button>
          ) : (
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700/80 border border-indigo-200 dark:border-indigo-800 active:scale-95 rounded-xl shadow-2xs flex items-center gap-1.5 transition-all"
              title="Kirim tes notifikasi untuk melihat pop-up di bilah HP"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-600" />}
              <span>Tes Notifikasi HP</span>
            </button>
          )}
        </div>
      </div>

      {/* Helpful info for Median and Android */}
      <div className="mt-3 pt-3 border-t border-indigo-100/80 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>
            {isMedian
              ? 'Terkoneksi via Median Native SDK (Google Play Services FCM): Notifikasi dijamin tembus meskipun aplikasi ditutup total.'
              : 'Untuk jaminan notifikasi 100% selalu tembus di HP Xiaomi, Oppo, Vivo, & Samsung saat ditutup, gunakan aplikasi APK hasil Median.'}
          </span>
        </div>
      </div>
    </div>
  );
}
