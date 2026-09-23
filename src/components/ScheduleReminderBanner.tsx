import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, BookOpen, User, MapPin, Bell, Volume2, VolumeX, X, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UpcomingScheduleAlert } from '../hooks/useScheduleReminder';

interface ScheduleReminderBannerProps {
  alerts: UpcomingScheduleAlert[];
  onDismiss: (id: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTestReminder?: () => void;
}

export default function ScheduleReminderBanner({
  alerts,
  onDismiss,
  soundEnabled,
  onToggleSound,
  onTestReminder
}: ScheduleReminderBannerProps) {
  const navigate = useNavigate();

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 dark:from-amber-600 dark:via-orange-700 dark:to-amber-800 text-white p-4 sm:p-5 shadow-lg shadow-orange-500/20 border border-amber-300/40"
          >
            {/* Background glowing ambient graphics */}
            <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute right-12 bottom-0 w-24 h-24 bg-yellow-300/20 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left Column: Icon & Details */}
              <div className="flex items-start gap-3.5">
                <div className="relative p-3 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-2xl shrink-0 border border-white/30 shadow-inner">
                  <Bell className="w-6 h-6 text-yellow-200 animate-bounce" />
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white" />
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-white text-orange-700 shadow-xs uppercase tracking-wide">
                      <Clock className="w-3.5 h-3.5 text-orange-600 animate-spin" style={{ animationDuration: '6s' }} />
                      Mulai Dalam {alert.minutesUntilStart} Menit Lagi!
                    </span>

                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30">
                      {alert.classId}
                    </span>

                    {alert.isSimulated && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-yellow-300/30 text-yellow-100 border border-yellow-200/40">
                        Mode Simulasi Pengujian
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 tracking-tight">
                    <BookOpen className="w-5 h-5 text-yellow-200" />
                    <span>{alert.mataPelajaran}</span>
                  </h3>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-orange-50 font-medium pt-0.5">
                    <span className="flex items-center gap-1 bg-black/10 px-2 py-0.5 rounded-md">
                      <Clock className="w-3.5 h-3.5 text-yellow-200" />
                      Pukul: <strong>{alert.startsAt} WIB</strong> ({alert.jam})
                    </span>

                    <span className="flex items-center gap-1 bg-black/10 px-2 py-0.5 rounded-md">
                      <User className="w-3.5 h-3.5 text-yellow-200" />
                      Guru: <strong>{alert.pengajar}</strong>
                    </span>

                    {alert.ruangan && (
                      <span className="flex items-center gap-1 bg-black/10 px-2 py-0.5 rounded-md">
                        <MapPin className="w-3.5 h-3.5 text-yellow-200" />
                        Ruangan: <strong>{alert.ruangan}</strong>
                      </span>
                    )}
                  </div>

                  {alert.keterangan && (
                    <p className="text-xs text-yellow-100/90 italic pt-1 max-w-2xl line-clamp-1">
                      Catatan: {alert.keterangan}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
                <button
                  onClick={onToggleSound}
                  title={soundEnabled ? 'Matikan suara bel pengingat' : 'Aktifkan suara bel pengingat'}
                  className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-colors border border-white/30"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-yellow-200" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-white/70" />
                  )}
                </button>

                <button
                  onClick={() => navigate('/admin/schedules')}
                  className="px-4 py-2 bg-white text-orange-700 hover:bg-orange-50 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>Lihat Jadwal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onDismiss(alert.id)}
                  title="Tutup pemberitahuan ini"
                  className="p-2 bg-black/20 hover:bg-black/30 rounded-xl text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
