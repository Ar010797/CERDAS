import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Filter,
  Search,
  Download,
  Printer,
  Sparkles,
  Palmtree,
  FileCheck,
  Users,
  AlertCircle,
  Clock,
  MapPin,
  CheckCircle2,
  CalendarDays,
  LayoutGrid,
  List,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useAcademicCalendar } from '../hooks/useAcademicCalendar';
import { CalendarEvent, CalendarCategory, CATEGORY_CONFIG, formatIndonesianDate, isDateInRange } from '../types/calendar';
import CalendarGrid from '../components/CalendarGrid';
import CalendarAgendaList from '../components/CalendarAgendaList';
import CalendarEventModal from '../components/CalendarEventModal';

const CLASSES_LIST = [
  'Semua Kelas',
  'Kelas 1',
  'Kelas 2',
  'Kelas 3',
  'Kelas 4',
  'Kelas 5',
  'Kelas 6',
  'Kelas 7',
  'Kelas 8',
  'Kelas 9'
];

export default function AcademicCalendar() {
  const { userData } = useAuth();
  const canManage = userData?.role === 'Admin' || userData?.role === 'Guru';

  // State
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'agenda'>('grid');

  // Month navigation state
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  // Selected date on the calendar (default today)
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalDefaultDate, setModalDefaultDate] = useState<string>('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Calendar Hook
  const {
    events,
    rawAcademicEvents,
    loading,
    addEvent,
    updateEvent,
    deleteEvent,
    seedDefaultEvents,
    getEventsForDay
  } = useAcademicCalendar(selectedClass);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Category filter
      if (activeCategory !== 'all' && ev.category !== activeCategory) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesDesc = (ev.description || '').toLowerCase().includes(q);
        const matchesClass = (ev.targetClass || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesClass) return false;
      }
      return true;
    });
  }, [events, activeCategory, searchQuery]);

  // Selected Day Events
  const selectedDayEvents = useMemo(() => {
    return getEventsForDay(selectedDate);
  }, [selectedDate, getEventsForDay]);

  // Summary counts for current month
  const monthStats = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const firstDayStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const lastDayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const monthEvents = events.filter(
      (e) => (e.startDate >= firstDayStr && e.startDate <= lastDayStr) || (e.endDate >= firstDayStr && e.endDate <= lastDayStr)
    );

    const holidays = monthEvents.filter((e) => e.isHoliday || e.category === 'libur').length;
    const exams = monthEvents.filter((e) => e.category === 'ujian').length;
    const activities = monthEvents.filter((e) => e.category === 'kegiatan' || e.category === 'rapat').length;
    const total = monthEvents.length;

    return { holidays, exams, activities, total };
  }, [events, currentMonth]);

  // Seed default data handler
  const handleLoadDefaultCalendar = async () => {
    if (window.confirm('Muat Kalender Standar Pendidikan 2026/2027 (Hari Libur Nasional, Jadwal Ujian PTS/PAS, ANBK, dan Kegiatan Sekolah)?')) {
      try {
        const count = await seedDefaultEvents(userData?.name || 'Admin');
        showToast(`Berhasil menambahkan ${count} agenda kalender standar!`, 'success');
      } catch (err: any) {
        showToast('Gagal memuat template kalender: ' + err.message, 'error');
      }
    }
  };

  // Open modal to add event
  const handleOpenAddModal = (dateStr?: string) => {
    setEditingEvent(null);
    setModalDefaultDate(dateStr || selectedDate);
    setIsModalOpen(true);
  };

  // Open modal to edit event
  const handleOpenEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setModalDefaultDate(event.startDate);
    setIsModalOpen(true);
  };

  // Save Event
  const handleSaveEvent = async (formData: Omit<CalendarEvent, 'id'>) => {
    if (editingEvent) {
      await updateEvent(editingEvent.id, formData);
      showToast('Agenda berhasil diperbarui!', 'success');
    } else {
      await addEvent(formData);
      showToast('Agenda baru berhasil ditambahkan ke kalender!', 'success');
    }
  };

  // Delete Event
  const handleDeleteEvent = async (id: string) => {
    await deleteEvent(id);
    showToast('Agenda telah dihapus.', 'success');
  };

  // Print Calendar
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 print:p-0 print:m-0">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider mb-1">
            <CalendarDays className="w-4 h-4" />
            <span>Kalender Akademik & Hari Penting</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
            Kalender Pendidikan Sekolah
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pantau jadwal ujian, hari libur nasional/sekolah, agenda rapat, dan kegiatan penting tahun ajaran 2026/2027.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {rawAcademicEvents.length === 0 && canManage && (
            <button
              onClick={handleLoadDefaultCalendar}
              className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 animate-bounce"
            >
              <Sparkles className="w-4 h-4 text-yellow-200" />
              <span>Muat Template Kalender 2026/2027</span>
            </button>
          )}

          {canManage && (
            <button
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Agenda / Libur</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            title="Cetak Tampilan Kalender"
            className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Cetak</span>
          </button>
        </div>
      </div>

      {/* Monthly Stat Banner Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-100 dark:border-rose-950/60 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <Palmtree className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Hari Libur Bulan Ini
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {monthStats.holidays} <span className="text-xs font-semibold text-slate-400">Agenda</span>
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-purple-100 dark:border-purple-950/60 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Jadwal Ujian Bulan Ini
            </span>
            <span className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
              {monthStats.exams} <span className="text-xs font-semibold text-slate-400">Agenda</span>
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-sky-100 dark:border-sky-950/60 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Kegiatan & Agenda
            </span>
            <span className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400">
              {monthStats.activities} <span className="text-xs font-semibold text-slate-400">Agenda</span>
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-950/60 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Agenda Bulan Ini
            </span>
            <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {monthStats.total} <span className="text-xs font-semibold text-slate-400">Agenda</span>
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ujian, libur sekolah, atau kegiatan..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Class Target Selector */}
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-hidden"
            >
              {CLASSES_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* View Mode Switcher: Grid vs Agenda List */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Kalender</span>
              </button>
              <button
                onClick={() => setViewMode('agenda')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'agenda'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Daftar Agenda</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Kategori:</span>

          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
              activeCategory === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Semua ({events.length})
          </button>

          {(Object.keys(CATEGORY_CONFIG) as CalendarCategory[]).map((cat) => {
            const conf = CATEGORY_CONFIG[cat];
            const isSelected = activeCategory === cat;
            const count = events.filter((e) => e.category === cat).length;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? `${conf.badgeBg} text-white border-transparent shadow-2xs`
                    : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : conf.dotColor}`} />
                <span>
                  {conf.label} ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Grid or Agenda List) */}
        <div className="lg:col-span-8">
          {viewMode === 'grid' ? (
            <CalendarGrid
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              events={filteredEvents}
              onAddEventOnDate={handleOpenAddModal}
              canManage={canManage}
            />
          ) : (
            <CalendarAgendaList
              events={filteredEvents}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onEditEvent={handleOpenEditModal}
              onDeleteEvent={handleDeleteEvent}
              canManage={canManage}
            />
          )}
        </div>

        {/* Right Column: Selected Date Details & Upcoming Highlights */}
        <div className="lg:col-span-4 space-y-5">
          {/* Selected Date Detail Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">
                  Detail Tanggal Terpilih
                </span>
                <h3 className="text-base font-black text-slate-800 dark:text-white mt-0.5">
                  {formatIndonesianDate(selectedDate)}
                </h3>
              </div>

              {canManage && (
                <button
                  onClick={() => handleOpenAddModal(selectedDate)}
                  title="Tambah agenda pada tanggal ini"
                  className="p-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* List of events on this date */}
            {selectedDayEvents.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <CalendarIcon className="w-8 h-8 mx-auto opacity-30" />
                <p className="text-xs font-semibold">Tidak ada agenda khusus pada tanggal ini.</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Kegiatan Belajar Mengajar (KBM) berjalan normal sesuai jadwal pelajaran reguler.
                </p>
                {canManage && (
                  <button
                    onClick={() => handleOpenAddModal(selectedDate)}
                    className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    + Tambah Kegiatan / Libur
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((ev) => {
                  const conf = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG.kegiatan;
                  return (
                    <div
                      key={ev.id}
                      className={`p-3.5 rounded-2xl border ${conf.lightBg} ${conf.darkBg} ${conf.borderColor} relative group space-y-2`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${conf.badgeBg} text-white`}>
                          {conf.label}
                        </span>

                        {ev.targetClass && (
                          <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            {ev.targetClass}
                          </span>
                        )}
                      </div>

                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">
                        {ev.title}
                      </h4>

                      <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        {ev.time && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Pukul: {ev.time}</span>
                          </div>
                        )}
                        {ev.ruangan && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>Lokasi: {ev.ruangan}</span>
                          </div>
                        )}
                        {ev.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 italic border-t border-slate-200/50 dark:border-slate-700/50">
                            {ev.description}
                          </p>
                        )}
                      </div>

                      {canManage && ev.source !== 'jadwal_ujian' && (
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                          <button
                            onClick={() => handleOpenEditModal(ev)}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Edit
                          </button>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <button
                            onClick={() => handleDeleteEvent(ev.id)}
                            className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Informational Guide */}
          <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-start gap-3 relative z-10">
              <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-yellow-300 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm">Integrasi Jadwal Ujian</h4>
                <p className="text-xs text-indigo-200 leading-relaxed">
                  Semua jadwal ujian kelas yang diinput pada menu <strong>Jadwal Kelas</strong> secara otomatis terhubung dan disorot dengan warna ungu pada kalender ini.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for adding/editing event */}
      <CalendarEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        editingEvent={editingEvent}
        defaultDate={modalDefaultDate}
        userName={userData?.name || 'Admin'}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div
            className={`flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl text-white ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
