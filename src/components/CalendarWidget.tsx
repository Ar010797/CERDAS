import React from 'react';
import { Calendar, Palmtree, FileCheck, Sparkles, ChevronRight, Clock, MapPin, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAcademicCalendar } from '../hooks/useAcademicCalendar';
import { CATEGORY_CONFIG, formatIndonesianDate } from '../types/calendar';

interface CalendarWidgetProps {
  targetRole?: 'admin' | 'guru' | 'walimurid';
  classFilter?: string;
  maxItems?: number;
}

export default function CalendarWidget({
  targetRole = 'admin',
  classFilter = 'Semua Kelas',
  maxItems = 4
}: CalendarWidgetProps) {
  const navigate = useNavigate();
  const { events, getUpcomingEvents, loading } = useAcademicCalendar(classFilter);

  const upcoming = getUpcomingEvents(60).slice(0, maxItems);
  const calendarRoute = `/${targetRole}/calendar`;

  const todayStr = new Date().toISOString().split('T')[0];

  const getRelativeDays = (dateStr: string) => {
    if (dateStr === todayStr) return 'Hari Ini';
    const diffTime = new Date(dateStr).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Besok';
    if (diffDays < 0) return 'Sedang Berlangsung';
    return `${diffDays} hari lagi`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">
                Agenda & Tanggal Penting Sekolah
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Jadwal ujian, hari libur nasional, dan agenda kegiatan mendatang.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate(calendarRoute)}
            className="hidden sm:flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline"
          >
            <span>Buka Kalender</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content List */}
        <div className="py-4 space-y-2.5">
          {loading ? (
            <div className="py-6 text-center text-xs text-slate-400">Memuat agenda sekolah...</div>
          ) : upcoming.length === 0 ? (
            <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
              Belum ada jadwal ujian atau libur yang dijadwalkan dalam waktu dekat.
            </div>
          ) : (
            upcoming.map((item) => {
              const conf = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.kegiatan;
              const relativeText = getRelativeDays(item.startDate);
              const isToday = item.startDate === todayStr;

              return (
                <div
                  key={item.id}
                  onClick={() => navigate(calendarRoute)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-xs flex items-center justify-between gap-3 ${
                    isToday
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400'
                      : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${conf.dotColor}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${conf.badgeBg} text-white`}>
                          {conf.label}
                        </span>
                        {item.targetClass && item.targetClass !== 'Semua Kelas' && (
                          <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {item.targetClass}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate mt-1">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{formatIndonesianDate(item.startDate)}</span>
                        {item.time && <span>• {item.time}</span>}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-black px-2.5 py-1 rounded-xl shrink-0 ${
                      isToday
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {relativeText}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Mobile Button */}
      <div className="pt-2 sm:hidden border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => navigate(calendarRoute)}
          className="w-full py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <span>Lihat Seluruh Kalender Pendidikan</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
