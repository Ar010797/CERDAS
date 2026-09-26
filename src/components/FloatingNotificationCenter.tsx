import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Award,
  FileCheck,
  CheckCircle2,
  X,
  ExternalLink,
  ArrowRight,
  Maximize2,
  Minimize2,
  Volume2,
  Calendar,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { playNotificationSound, unlockAudioContext } from '../lib/audioNotifier';

export interface FloatingNotificationData {
  id?: string;
  title: string;
  body: string;
  type?: 'announcement' | 'grade_released' | 'new_assignment' | 'general';
  category?: string;
  url?: string;
  durationMs?: number;
  openFullScreenImmediately?: boolean;
  onClick?: () => void;
}

/**
 * Memicu notifikasi mengambang (Floating Heads-Up Banner) & Layar Penuh
 * yang bekerja 100% di semua perangkat termasuk Xiaomi (MIUI/HyperOS), Infinix (XOS), Median APK, maupun Browser Android.
 */
export function triggerFloatingNotification(notif: FloatingNotificationData) {
  if (typeof window === 'undefined') return;

  const event = new CustomEvent('cerdas:floating-notification', {
    detail: {
      ...notif,
      id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    }
  });
  window.dispatchEvent(event);
}

export default function FloatingNotificationCenter() {
  const [activeNotification, setActiveNotification] = useState<FloatingNotificationData | null>(null);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const navigate = useNavigate();

  const handleDismiss = useCallback(() => {
    setActiveNotification(null);
    setIsFullScreenOpen(false);
  }, []);

  const handleOpen = useCallback(() => {
    if (!activeNotification) return;

    if (activeNotification.onClick) {
      activeNotification.onClick();
    } else if (activeNotification.url) {
      navigate(activeNotification.url);
    }

    setActiveNotification(null);
    setIsFullScreenOpen(false);
  }, [activeNotification, navigate]);

  const handleOpenFullScreen = useCallback(() => {
    setIsFullScreenOpen(true);
  }, []);

  useEffect(() => {
    const handleNotificationEvent = (event: Event) => {
      const customEvent = event as CustomEvent<FloatingNotificationData>;
      const data = customEvent.detail;
      if (!data) return;

      setActiveNotification(data);
      if (data.openFullScreenImmediately) {
        setIsFullScreenOpen(true);
      }

      // 1. Getar perangkat jika didukung (Xiaomi, Infinix, Android WebView)
      try {
        if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate([150, 80, 150]);
        }
      } catch (vibErr) {
        console.warn('Vibration not permitted:', vibErr);
      }

      // 2. Mainkan suara audio notifikasi
      try {
        unlockAudioContext();
        if (data.type === 'grade_released') {
          playNotificationSound('grade_released');
        } else if (data.type === 'new_assignment') {
          playNotificationSound('submission_success');
        } else {
          playNotificationSound('announcement');
        }
      } catch (soundErr) {
        console.warn('Floating audio error:', soundErr);
      }
    };

    window.addEventListener('cerdas:floating-notification', handleNotificationEvent);

    return () => {
      window.removeEventListener('cerdas:floating-notification', handleNotificationEvent);
    };
  }, []);

  // Auto-dismiss floating banner setelah durasi (hanya jika mode layar penuh tidak sedang terbuka)
  useEffect(() => {
    if (!activeNotification || isFullScreenOpen) return;

    const timer = setTimeout(() => {
      setActiveNotification(null);
    }, activeNotification.durationMs || 8000);

    return () => clearTimeout(timer);
  }, [activeNotification, isFullScreenOpen]);

  if (!activeNotification) return null;

  const isGrade = activeNotification.type === 'grade_released';
  const isAssignment = activeNotification.type === 'new_assignment';

  return (
    <>
      {/* 1. TOP FLOATING HEADS-UP BANNER: FULL WIDTH ON MOBILE */}
      {!isFullScreenOpen && (
        <div className="fixed top-1.5 sm:top-4 left-0 right-0 z-[9999] pointer-events-none flex justify-center px-2 sm:px-4">
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="pointer-events-auto w-full max-w-full sm:max-w-xl bg-slate-900/98 dark:bg-slate-900/98 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-3.5 sm:p-4 relative overflow-hidden"
              role="alert"
            >
              {/* Top colored accent indicator */}
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 ${
                  isGrade
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500'
                    : isAssignment
                    ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500'
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500'
                }`}
              />

              <div className="flex items-start gap-3">
                {/* Notification Icon */}
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    isGrade
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                      : isAssignment
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                      : 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40'
                  }`}
                >
                  {isGrade ? (
                    <Award className="w-5 h-5 text-emerald-400" />
                  ) : isAssignment ? (
                    <FileCheck className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Bell className="w-5 h-5 text-indigo-400 animate-bounce" />
                  )}
                </div>

                {/* Notification Content */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white">
                      {isGrade ? 'Nilai Diumumkan' : isAssignment ? 'Tugas Baru' : 'Pemberitahuan'}
                    </span>
                    {activeNotification.category && (
                      <span className="text-[11px] text-slate-300 font-medium">
                        • {activeNotification.category}
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                    {activeNotification.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed break-words">
                    {activeNotification.body}
                  </p>

                  {/* Action Buttons: Responsive & Clear */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button
                      onClick={handleOpenFullScreen}
                      className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                      title="Tampilkan notifikasi penuh di layar"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Lihat Full Layar</span>
                    </button>

                    {(activeNotification.url || activeNotification.onClick) && (
                      <button
                        onClick={handleOpen}
                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span>Buka & Tinjau</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      onClick={handleDismiss}
                      className="px-2.5 py-1.5 text-slate-300 hover:text-white rounded-lg text-xs font-medium hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>

                {/* Close Cross Button */}
                <button
                  onClick={handleDismiss}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                  title="Tutup Notifikasi"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* 2. FULL SCREEN NOTIFICATION MODAL: GUARANTEED FULL DISPLAY ON ALL DEVICES */}
      <AnimatePresence>
        {isFullScreenOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Top Banner Header */}
              <div
                className={`p-5 sm:p-6 text-white relative ${
                  isGrade
                    ? 'bg-gradient-to-br from-emerald-600 via-teal-600 to-indigo-700'
                    : isAssignment
                    ? 'bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600'
                    : 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
                      {isGrade ? (
                        <Award className="w-6 h-6" />
                      ) : isAssignment ? (
                        <FileCheck className="w-6 h-6" />
                      ) : (
                        <Bell className="w-6 h-6 animate-bounce" />
                      )}
                    </div>
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/25 text-white inline-block mb-1">
                        {isGrade ? 'Pemberitahuan Nilai Santri' : isAssignment ? 'Pengumuman Tugas Santri' : 'Pemberitahuan Penting Sekolah'}
                      </span>
                      <h3 className="text-base sm:text-lg font-black leading-snug">
                        Notifikasi Terlihat Full di Layar
                      </h3>
                    </div>
                  </div>

                  <button
                    onClick={handleDismiss}
                    className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
                    title="Tutup Notifikasi"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Notification Body Content: Completely Visible & Full */}
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                    {activeNotification.title}
                  </h4>
                  {activeNotification.category && (
                    <span className="inline-block mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                      Kategori: {activeNotification.category}
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed break-words whitespace-pre-wrap">
                  {activeNotification.body}
                </div>

                {/* Device badge indicator */}
                <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs text-indigo-800 dark:text-indigo-300">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Mode Layar Penuh HP Aktif (Xiaomi / Infinix / Android)</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Getar & Suara OK</span>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between gap-2.5">
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Tutup Tinjauan
                </button>

                {(activeNotification.url || activeNotification.onClick) && (
                  <button
                    onClick={handleOpen}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Buka Halaman Terkait</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
