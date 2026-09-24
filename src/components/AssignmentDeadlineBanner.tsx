import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  Clock, 
  BookOpen, 
  Volume2, 
  VolumeX, 
  X, 
  ArrowRight, 
  Bell, 
  CheckCircle2, 
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AssignmentDeadlineAlert } from '../hooks/useAssignmentDeadlineReminder';

interface AssignmentDeadlineBannerProps {
  alerts: AssignmentDeadlineAlert[];
  onDismiss: (id: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  notificationPermission: NotificationPermission;
  onRequestPermission: () => void;
  onTestReminder?: () => void;
}

export default function AssignmentDeadlineBanner({
  alerts,
  onDismiss,
  soundEnabled,
  onToggleSound,
  notificationPermission,
  onRequestPermission,
  onTestReminder
}: AssignmentDeadlineBannerProps) {
  const navigate = useNavigate();

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <AnimatePresence>
        {alerts.map((alert) => {
          const isCritical = alert.urgency === 'critical';
          const isWarning = alert.urgency === 'warning';

          // Color themes based on urgency level
          const bgGradient = isCritical
            ? 'from-rose-600 via-red-600 to-amber-700 dark:from-rose-700 dark:via-red-800 dark:to-amber-900 border-rose-400/50 shadow-rose-600/25'
            : isWarning
            ? 'from-amber-500 via-orange-500 to-amber-600 dark:from-amber-600 dark:via-orange-700 dark:to-amber-800 border-amber-300/40 shadow-orange-500/20'
            : 'from-indigo-600 via-purple-600 to-indigo-700 dark:from-indigo-700 dark:via-purple-800 dark:to-indigo-900 border-indigo-300/40 shadow-indigo-600/20';

          const badgeBg = isCritical
            ? 'bg-rose-950/70 text-rose-200 border-rose-300/30'
            : 'bg-amber-950/60 text-amber-200 border-amber-300/30';

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${bgGradient} text-white p-4 sm:p-5 shadow-lg border backdrop-blur-md`}
            >
              {/* Subtle background blur circles */}
              <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute right-12 bottom-0 w-24 h-24 bg-yellow-300/20 rounded-full blur-xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left Column: Icon & Info */}
                <div className="flex items-start gap-3.5">
                  <div className="relative p-3 bg-white/20 dark:bg-black/25 backdrop-blur-md rounded-2xl shrink-0 border border-white/30 shadow-inner">
                    {isCritical ? (
                      <ShieldAlert className="w-6 h-6 text-rose-100 animate-pulse" />
                    ) : (
                      <Clock className="w-6 h-6 text-amber-200 animate-bounce" />
                    )}
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white" />
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-white text-slate-900 shadow-xs uppercase tracking-wide">
                        <Clock className="w-3.5 h-3.5 text-rose-600 animate-spin" style={{ animationDuration: '6s' }} />
                        Tenggat Waktu: {alert.timeFormatted}!
                      </span>

                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeBg}`}>
                        {alert.classId} • {alert.subject}
                      </span>

                      {alert.isSimulated && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-yellow-300 text-slate-900 tracking-wider">
                          SIMULASI TES
                        </span>
                      )}
                    </div>

                    <h4 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                      <span>{alert.title}</span>
                    </h4>

                    <p className="text-xs sm:text-sm text-white/90 font-medium">
                      Batas pengumpulan: <span className="font-bold underline decoration-yellow-300 underline-offset-2">{alert.dueDate} pukul {alert.dueTime} WIB</span>. Mohon segera kirim jawaban sebelum sistem ditutup otomatis.
                    </p>
                  </div>
                </div>

                {/* Right Column: Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                  {/* Web Notification Permission Prompt if default */}
                  {notificationPermission === 'default' && (
                    <button
                      onClick={onRequestPermission}
                      className="px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5"
                      title="Aktifkan notifikasi browser agar muncul di layar HP / Laptop"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-200" />
                      <span className="hidden sm:inline">Izinkan Notifikasi Browser</span>
                    </button>
                  )}

                  {/* Sound Toggle */}
                  <button
                    onClick={onToggleSound}
                    className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors border border-white/20"
                    title={soundEnabled ? 'Matikan Suara Peringatan' : 'Aktifkan Suara Peringatan'}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-emerald-200" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-white/60" />
                    )}
                  </button>

                  {/* Open Assignments screen */}
                  <button
                    onClick={() => navigate('/assignments')}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-yellow-200 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <span>Kumpulkan Sekarang</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Dismiss */}
                  <button
                    onClick={() => onDismiss(alert.id)}
                    className="p-2.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                    title="Tutup Peringatan Ini"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
