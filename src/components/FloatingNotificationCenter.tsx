import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Award, FileCheck, CheckCircle2, X, ExternalLink, ArrowRight, Volume2 } from 'lucide-react';
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
  onClick?: () => void;
}

/**
 * Memicu notifikasi mengambang (Floating Heads-Up Banner) yang bekerja 100%
 * di semua perangkat termasuk Xiaomi (MIUI/HyperOS), Infinix (XOS), Median APK, maupun Browser biasa.
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
  const navigate = useNavigate();

  const handleDismiss = useCallback(() => {
    setActiveNotification(null);
  }, []);

  const handleOpen = useCallback(() => {
    if (!activeNotification) return;

    if (activeNotification.onClick) {
      activeNotification.onClick();
    } else if (activeNotification.url) {
      navigate(activeNotification.url);
    }

    setActiveNotification(null);
  }, [activeNotification, navigate]);

  useEffect(() => {
    const handleNotificationEvent = (event: Event) => {
      const customEvent = event as CustomEvent<FloatingNotificationData>;
      const data = customEvent.detail;
      if (!data) return;

      setActiveNotification(data);

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

  // Auto-dismiss setelah durasi (default 7 detik)
  useEffect(() => {
    if (!activeNotification) return;

    const timer = setTimeout(() => {
      setActiveNotification(null);
    }, activeNotification.durationMs || 7000);

    return () => clearTimeout(timer);
  }, [activeNotification]);

  if (!activeNotification) return null;

  const isGrade = activeNotification.type === 'grade_released';
  const isAssignment = activeNotification.type === 'new_assignment';
  const isAnnouncement = activeNotification.type === 'announcement';

  return (
    <div className="fixed top-3 left-0 right-0 z-[9999] pointer-events-none flex justify-center px-3 sm:px-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="pointer-events-auto w-full max-w-lg bg-slate-900/95 dark:bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-white/15 p-3.5 sm:p-4 relative overflow-hidden"
          role="alert"
        >
          {/* Top colored accent indicator */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 ${
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
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : isAssignment
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
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

              <h4 className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-1">
                {activeNotification.title}
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed break-words">
                {activeNotification.body}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-2.5">
                {(activeNotification.url || activeNotification.onClick) && (
                  <button
                    onClick={handleOpen}
                    className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>Buka & Lihat</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={handleDismiss}
                  className="px-2.5 py-1 text-slate-300 hover:text-white rounded-lg text-xs font-medium hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* Close Cross Button */}
            <button
              onClick={handleDismiss}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0"
              title="Tutup Notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
