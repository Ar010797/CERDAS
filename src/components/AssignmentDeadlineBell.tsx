import React, { useState, useRef, useEffect } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  ArrowRight, 
  Bell, 
  X, 
  Sparkles,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAssignmentDeadlineReminder, AssignmentDeadlineAlert } from '../hooks/useAssignmentDeadlineReminder';

interface Props {
  customClassId?: string;
}

export default function AssignmentDeadlineBell({ customClassId }: Props) {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    activeAlerts,
    dismissAlert,
    soundEnabled,
    toggleSound,
    notificationPermission,
    requestPermission,
    triggerSimulation
  } = useAssignmentDeadlineReminder(customClassId);

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

  const alertCount = activeAlerts.length;
  const hasCritical = activeAlerts.some(a => a.urgency === 'critical');

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Peringatan Batas Waktu Tugas"
        title="Peringatan Batas Waktu Tugas & PR"
        className={`relative p-2 rounded-xl transition-all ${
          alertCount > 0
            ? hasCritical
              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400'
              : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Clock className={`w-5 h-5 ${alertCount > 0 ? (hasCritical ? 'animate-pulse' : 'animate-bounce') : ''}`} />

        {/* Badge counter */}
        {alertCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[11px] font-black text-white border-2 border-white dark:border-slate-900 shadow-xs ${
              hasCritical ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'
            }`}
          >
            {alertCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-200" />
                <div>
                  <h4 className="font-bold text-sm leading-tight">Tenggat Waktu Tugas</h4>
                  <p className="text-[11px] text-amber-100">
                    {alertCount > 0 ? `${alertCount} tugas mendekati batas waktu` : 'Semua tugas aman / sudah dikumpulkan'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Sound toggle button */}
                <button
                  onClick={toggleSound}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                  title={soundEnabled ? 'Matikan Suara Alert' : 'Aktifkan Suara Alert'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-200" /> : <VolumeX className="w-4 h-4 text-white/70" />}
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification permission prompt bar */}
            {notificationPermission !== 'granted' && (
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <Bell className="w-3.5 h-3.5" />
                  <span>Notifikasi browser belum aktif</span>
                </div>
                <button
                  onClick={requestPermission}
                  className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px]"
                >
                  Izinkan
                </button>
              </div>
            )}

            {/* List of deadline alerts */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2">
              {alertCount === 0 ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-xs font-semibold">Tidak ada tugas mendesak saat ini.</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Siswa telah mengumpulkan seluruh tugas atau batas waktu pengumpulan masih lama.
                  </p>
                  <button
                    onClick={() => triggerSimulation(120)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Uji Coba Peringatan Deadline (Simulasi)</span>
                  </button>
                </div>
              ) : (
                activeAlerts.map((alert) => {
                  const isCrit = alert.urgency === 'critical';
                  return (
                    <div
                      key={alert.id}
                      className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                                isCrit
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {alert.timeFormatted}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              {alert.subject} • {alert.classId}
                            </span>
                          </div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                            {alert.title}
                          </h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Batas: {alert.dueDate} {alert.dueTime} WIB
                          </p>
                        </div>

                        <button
                          onClick={() => dismissAlert(alert.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Hapus dari daftar pengingat"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            navigate('/assignments');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <span>Kumpulkan Tugas</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with shortcut and simulation tester */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={() => triggerSimulation(90)}
                className="text-[11px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
                title="Simulasikan peringatan tugas yang harus dikumpulkan 1.5 jam lagi"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Tes Notifikasi</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/assignments');
                }}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Lihat Semua Tugas</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
