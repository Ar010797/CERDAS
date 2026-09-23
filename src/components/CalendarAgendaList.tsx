import React from 'react';
import { Calendar, Clock, MapPin, User, ChevronRight, Edit2, Trash2, AlertCircle, Sparkles } from 'lucide-react';
import { CalendarEvent, CATEGORY_CONFIG, formatIndonesianDate } from '../types/calendar';

interface CalendarAgendaListProps {
  events: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (id: string) => void;
  canManage?: boolean;
}

export default function CalendarAgendaList({
  events,
  selectedDate,
  onSelectDate,
  onEditEvent,
  onDeleteEvent,
  canManage = false
}: CalendarAgendaListProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const getCountdownLabel = (startDate: string, endDate: string) => {
    if (todayStr >= startDate && todayStr <= endDate) {
      return { text: 'Sedang Berlangsung Hari Ini', color: 'bg-emerald-500 text-white animate-pulse' };
    }
    if (startDate > todayStr) {
      const diffTime = new Date(startDate).getTime() - new Date(todayStr).getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) return { text: 'Besok', color: 'bg-amber-500 text-white' };
      return { text: `${diffDays} hari lagi`, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300' };
    }
    return { text: 'Selesai', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
  };

  if (events.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-600 dark:text-indigo-400">
          <Calendar className="w-7 h-7" />
        </div>
        <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Tidak Ada Agenda Ditemukan</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
          Tidak ada kegiatan, jadwal ujian, atau hari libur pada filter ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const conf = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.kegiatan;
        const countdown = getCountdownLabel(event.startDate, event.endDate);
        const isMultiDay = event.startDate !== event.endDate;
        const isSelected = selectedDate === event.startDate;

        return (
          <div
            key={event.id}
            onClick={() => onSelectDate(event.startDate)}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-slate-900 hover:shadow-md relative overflow-hidden group ${
              isSelected
                ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20'
                : 'border-slate-200/80 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700'
            }`}
          >
            {/* Left Accent Stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${conf.badgeBg}`} />

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black ${conf.badgeBg} text-white shadow-2xs`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    {conf.label}
                  </span>

                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${countdown.color}`}>
                    {countdown.text}
                  </span>

                  {event.targetClass && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {event.targetClass}
                    </span>
                  )}

                  {event.isHoliday && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                      Libur Sekolah
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white tracking-tight pt-1">
                  {event.title}
                </h3>

                {/* Date and Time Details */}
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400 font-medium pt-1">
                  <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-bold">
                    <Calendar className="w-4 h-4" />
                    {isMultiDay ? (
                      <>
                        {formatIndonesianDate(event.startDate)} s/d {formatIndonesianDate(event.endDate)}
                      </>
                    ) : (
                      formatIndonesianDate(event.startDate)
                    )}
                  </span>

                  {event.time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {event.time}
                    </span>
                  )}

                  {event.ruangan && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {event.ruangan}
                    </span>
                  )}

                  {event.pengajar && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {event.pengajar}
                    </span>
                  )}
                </div>

                {/* Description */}
                {event.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 leading-relaxed">
                    {event.description}
                  </p>
                )}
              </div>

              {/* Action Buttons for Authorized Roles */}
              {canManage && event.source !== 'jadwal_ujian' && (
                <div className="flex items-center gap-1 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
                  {onEditEvent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditEvent(event);
                      }}
                      title="Edit Agenda"
                      className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {onDeleteEvent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEvent(event.id);
                      }}
                      title="Hapus Agenda"
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
