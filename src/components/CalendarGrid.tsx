import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Sparkles, Plus } from 'lucide-react';
import { CalendarEvent, CATEGORY_CONFIG, isDateInRange } from '../types/calendar';

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface CalendarGridProps {
  currentMonth: Date;
  onMonthChange: (newMonth: Date) => void;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  events: CalendarEvent[];
  onAddEventOnDate?: (dateStr: string) => void;
  canManage?: boolean;
}

export default function CalendarGrid({
  currentMonth,
  onMonthChange,
  selectedDate,
  onSelectDate,
  events,
  onAddEventOnDate,
  canManage = true
}: CalendarGridProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-indexed

  // Today in YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Calculate calendar grid days for standard Indonesian week (Monday = index 0 to Sunday = index 6)
  const calendarCells = useMemo(() => {
    // First day of current month
    const firstDay = new Date(year, month, 1);
    // Sunday is 0 in JS. We want Monday = 0, Tuesday = 1, ... Sunday = 6
    let startingDayOfWeek = firstDay.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6; // Sunday becomes 6

    // Total days in current month
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    // Total days in previous month
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isSunday: boolean;
      dayEvents: CalendarEvent[];
    }[] = [];

    // 1. Previous month trailing days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, d);
      const py = prevDate.getFullYear();
      const pm = String(prevDate.getMonth() + 1).padStart(2, '0');
      const pd = String(d).padStart(2, '0');
      const dateStr = `${py}-${pm}-${pd}`;
      const isSunday = prevDate.getDay() === 0;

      const dayEvents = events.filter((e) => isDateInRange(dateStr, e.startDate, e.endDate));

      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        isSunday,
        dayEvents
      });
    }

    // 2. Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const currDate = new Date(year, month, d);
      const cm = String(month + 1).padStart(2, '0');
      const cd = String(d).padStart(2, '0');
      const dateStr = `${year}-${cm}-${cd}`;
      const isSunday = currDate.getDay() === 0;

      const dayEvents = events.filter((e) => isDateInRange(dateStr, e.startDate, e.endDate));

      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        isSunday,
        dayEvents
      });
    }

    // 3. Next month leading days (fill up to full rows: 35 or 42 cells)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const ny = nextDate.getFullYear();
      const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const nd = String(d).padStart(2, '0');
      const dateStr = `${ny}-${nm}-${nd}`;
      const isSunday = nextDate.getDay() === 0;

      const dayEvents = events.filter((e) => isDateInRange(dateStr, e.startDate, e.endDate));

      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        isSunday,
        dayEvents
      });
    }

    return cells;
  }, [year, month, events, todayStr, selectedDate]);

  const handlePrevMonth = () => {
    onMonthChange(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    const now = new Date();
    onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDate(todayStr);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onMonthChange(new Date(Number(e.target.value), month, 1));
  };

  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onMonthChange(new Date(year, Number(e.target.value), 1));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col transition-colors">
      {/* Calendar Header Control Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
        {/* Month & Year Title with Selectors */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <select
              value={month}
              onChange={handleMonthSelect}
              className="text-base sm:text-lg font-black text-slate-800 dark:text-white bg-transparent hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-xl px-2.5 py-1.5 border-none outline-hidden cursor-pointer transition-colors"
            >
              {MONTH_NAMES.map((mName, idx) => (
                <option key={mName} value={idx} className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 font-semibold">
                  {mName}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={handleYearChange}
              className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 bg-transparent hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-xl px-2 py-1.5 border-none outline-hidden cursor-pointer transition-colors"
            >
              {[2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y} className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 font-semibold">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Navigation Arrows & Today Button */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleJumpToToday}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            Hari Ini
          </button>

          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden shadow-2xs">
            <button
              onClick={handlePrevMonth}
              title="Bulan Sebelumnya"
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
            <button
              onClick={handleNextMonth}
              title="Bulan Berikutnya"
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-center">
        {DAY_NAMES.map((dayName, idx) => {
          const isSunday = idx === 6;
          const isFriday = idx === 4;
          return (
            <div
              key={dayName}
              className={`py-2.5 text-xs font-black uppercase tracking-wider ${
                isSunday
                  ? 'text-rose-600 dark:text-rose-400'
                  : isFriday
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <span className="hidden sm:inline">{dayName}</span>
              <span className="sm:hidden">{dayName.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar Month Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-100 dark:bg-slate-800/40">
        {calendarCells.map((cell, idx) => {
          const hasEvents = cell.dayEvents.length > 0;
          const hasHoliday = cell.dayEvents.some((e) => e.isHoliday || e.category === 'libur');
          const hasExam = cell.dayEvents.some((e) => e.category === 'ujian');

          return (
            <div
              key={`${cell.dateStr}-${idx}`}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`min-h-[96px] sm:min-h-[110px] p-1.5 sm:p-2 flex flex-col justify-between transition-all cursor-pointer relative group ${
                !cell.isCurrentMonth
                  ? 'bg-slate-50/40 dark:bg-slate-900/30 text-slate-300 dark:text-slate-600'
                  : cell.isSelected
                  ? 'bg-indigo-50/90 dark:bg-indigo-950/50 ring-2 ring-indigo-500 ring-inset z-10'
                  : hasHoliday
                  ? 'bg-rose-50/30 dark:bg-rose-950/15 hover:bg-rose-50/60'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
              }`}
            >
              {/* Day Cell Top: Date Number & Badges */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center justify-center text-xs font-black rounded-full transition-all ${
                    cell.isToday
                      ? 'w-6 h-6 bg-indigo-600 text-white shadow-xs scale-105'
                      : cell.isSelected
                      ? 'w-6 h-6 bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-white'
                      : cell.isSunday
                      ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                      : cell.isCurrentMonth
                      ? 'text-slate-800 dark:text-slate-100'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {cell.dayNum}
                </span>

                {/* Quick Add Button on Hover for Managers */}
                {canManage && onAddEventOnDate && cell.isCurrentMonth && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddEventOnDate(cell.dateStr);
                    }}
                    title={`Tambah agenda pada ${cell.dateStr}`}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-md transition-opacity"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Event Pills Container */}
              <div className="space-y-1 my-1 overflow-hidden">
                {cell.dayEvents.slice(0, 2).map((ev) => {
                  const conf = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG.kegiatan;
                  return (
                    <div
                      key={ev.id}
                      title={`${ev.title} (${conf.label})${ev.targetClass ? ' - ' + ev.targetClass : ''}`}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate border flex items-center gap-1 shadow-2xs ${conf.lightBg} ${conf.darkBg} ${conf.borderColor} ${conf.accentColor}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf.dotColor}`} />
                      <span className="truncate">{ev.title}</span>
                    </div>
                  );
                })}

                {/* More events indicator if > 2 */}
                {cell.dayEvents.length > 2 && (
                  <div className="text-[9px] font-black text-slate-500 dark:text-slate-400 px-1 py-0.2 bg-slate-100 dark:bg-slate-800 rounded-md text-center">
                    +{cell.dayEvents.length - 2} lainnya
                  </div>
                )}
              </div>

              {/* Day Cell Bottom Indicator Dots (Mobile friendly) */}
              <div className="flex items-center gap-1 h-1.5">
                {hasHoliday && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Ada Hari Libur" />}
                {hasExam && <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" title="Ada Jadwal Ujian" />}
                {hasEvents && !hasHoliday && !hasExam && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" title="Ada Agenda Sekolah" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend Footer */}
      <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-bold text-slate-500 dark:text-slate-400">Keterangan:</span>
          {Object.entries(CATEGORY_CONFIG).map(([key, conf]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${conf.dotColor}`} />
              <span className="font-semibold text-slate-700 dark:text-slate-300">{conf.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200" />
            <span className="font-semibold text-rose-600 dark:text-rose-400">Minggu (Libur Mingguan)</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          * Klik tanggal pada kalender untuk melihat rincian agenda
        </div>
      </div>
    </div>
  );
}
