import React, { useState, useRef, useEffect } from 'react';
import { Bell, Clock, BookOpen, Volume2, VolumeX, Sparkles, Check, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useScheduleReminder } from '../hooks/useScheduleReminder';

export default function ScheduleReminderBell() {
  const {
    upcomingAlerts,
    dismissAlert,
    soundEnabled,
    toggleSound,
    triggerSimulation,
    playChime
  } = useScheduleReminder();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasAlerts = upcomingAlerts.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifikasi Pengingat Jadwal"
        title="Pengingat Jadwal Pelajaran (15 Menit Sebelum Mulai)"
        className={`relative p-2.5 rounded-xl transition-all duration-200 ${
          hasAlerts
            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 ring-2 ring-amber-400 animate-pulse'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}
      >
        <Bell className="w-4 h-4" />

        {hasAlerts && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-red-600 text-[9px] font-black text-white">
              {upcomingAlerts.length}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Notification Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[100] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-sm">Pengingat Jadwal Pelajaran</h4>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleSound}
                  title={soundEnabled ? 'Suara Bel Aktif (Klik untuk Matikan)' : 'Suara Bel Mati (Klik untuk Nyalakan)'}
                  className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-amber-300" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-white/60" />
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List of Alerts */}
            <div className="p-3 max-h-80 overflow-y-auto space-y-2.5">
              {upcomingAlerts.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <Clock className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tidak Ada Jadwal Dimulai Dalam 15 Menit
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    Sistem otomatis memantau jadwal aktif dan memberi notifikasi serta suara bel saat ada kelas yang akan mulai dalam 15 menit ke depan.
                  </p>
                </div>
              ) : (
                upcomingAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 relative group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 animate-pulse">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Mulai {alert.minutesUntilStart} Menit Lagi
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        {alert.classId}
                      </span>
                    </div>

                    <h5 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      {alert.mataPelajaran}
                    </h5>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      Pukul: <strong>{alert.startsAt} WIB</strong> ({alert.jam})
                    </p>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Guru: {alert.pengajar} {alert.ruangan && `• Ruang: ${alert.ruangan}`}
                    </p>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/50">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate('/admin/schedules');
                        }}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        Buka Jadwal <ArrowRight className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-semibold px-2 py-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                      >
                        Tutup Notif
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with Simulation Trigger and Test Chime */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Mode Uji Notifikasi:
                </span>
                <button
                  onClick={() => {
                    playChime();
                    triggerSimulation(12);
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-yellow-200" />
                  Simulasi 12 Menit Lagi
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400">
                <span>Auto-refresh setiap 10 detik</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Aktif
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
