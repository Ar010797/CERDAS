import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, AlertCircle, Sparkles, Check, Trash2 } from 'lucide-react';
import { CalendarEvent, CalendarCategory, CATEGORY_CONFIG } from '../types/calendar';

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

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Omit<CalendarEvent, 'id'>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  editingEvent?: CalendarEvent | null;
  defaultDate?: string;
  userName?: string;
}

export default function CalendarEventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingEvent,
  defaultDate,
  userName = 'Admin'
}: CalendarEventModalProps) {
  const [formData, setFormData] = useState<Omit<CalendarEvent, 'id'>>({
    title: '',
    category: 'libur',
    startDate: defaultDate || new Date().toISOString().split('T')[0],
    endDate: defaultDate || new Date().toISOString().split('T')[0],
    description: '',
    targetClass: 'Semua Kelas',
    isHoliday: true,
    time: '',
    ruangan: '',
    pengajar: '',
    source: 'manual',
    createdBy: userName
  });

  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingEvent) {
      setFormData({
        title: editingEvent.title || '',
        category: editingEvent.category || 'kegiatan',
        startDate: editingEvent.startDate || new Date().toISOString().split('T')[0],
        endDate: editingEvent.endDate || editingEvent.startDate || new Date().toISOString().split('T')[0],
        description: editingEvent.description || '',
        targetClass: editingEvent.targetClass || 'Semua Kelas',
        isHoliday: Boolean(editingEvent.isHoliday),
        time: editingEvent.time || '',
        ruangan: editingEvent.ruangan || '',
        pengajar: editingEvent.pengajar || '',
        source: editingEvent.source || 'manual',
        createdBy: editingEvent.createdBy || userName
      });
    } else {
      const initialDate = defaultDate || new Date().toISOString().split('T')[0];
      setFormData({
        title: '',
        category: 'libur',
        startDate: initialDate,
        endDate: initialDate,
        description: '',
        targetClass: 'Semua Kelas',
        isHoliday: true,
        time: '',
        ruangan: '',
        pengajar: '',
        source: 'manual',
        createdBy: userName
      });
    }
    setError(null);
  }, [editingEvent, defaultDate, isOpen, userName]);

  if (!isOpen) return null;

  const handleCategoryChange = (cat: CalendarCategory) => {
    setFormData((prev) => ({
      ...prev,
      category: cat,
      // Default isHoliday to true for 'libur', false otherwise
      isHoliday: cat === 'libur'
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Judul agenda/hari penting wajib diisi.');
      return;
    }
    if (!formData.startDate) {
      setError('Tanggal mulai wajib ditentukan.');
      return;
    }
    if (formData.endDate < formData.startDate) {
      setError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal menyimpan agenda.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEvent || !onDelete) return;
    if (!window.confirm(`Yakin ingin menghapus agenda "${editingEvent.title}"?`)) return;

    setIsDeleting(true);
    try {
      await onDelete(editingEvent.id);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal menghapus agenda.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${CATEGORY_CONFIG[formData.category].badgeBg} text-white shadow-xs`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                {editingEvent ? 'Edit Agenda & Tanggal Penting' : 'Tambah Agenda / Tanggal Penting'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sorot libur sekolah, jadwal ujian, atau kegiatan di kalender.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Category Selector Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
              Kategori Agenda
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_CONFIG) as CalendarCategory[]).map((cat) => {
                const conf = CATEGORY_CONFIG[cat];
                const isSelected = formData.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                      isSelected
                        ? `${conf.badgeBg} text-white border-transparent shadow-xs scale-[1.02]`
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-white' : conf.dotColor}`} />
                    <span className="truncate">{conf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Nama Kegiatan / Hari Libur / Ujian <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Contoh: Penilaian Akhir Semester (PAS) Ganjil / Libur Maulid Nabi"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-hidden transition-all"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Tanggal Mulai <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    startDate: val,
                    // Auto-adjust end date if previous end was earlier
                    endDate: prev.endDate < val ? val : prev.endDate
                  }));
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Tanggal Selesai <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-400">Pilihan Cepat:</span>
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setFormData((prev) => ({ ...prev, startDate: today, endDate: today }));
              }}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium transition-colors"
            >
              Hari Ini Saja
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({ ...prev, endDate: prev.startDate }));
              }}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium transition-colors"
            >
              1 Hari (Samakan Tgl Selesai)
            </button>
          </div>

          {/* Target Class & Holiday Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Kelas
              </label>
              <select
                value={formData.targetClass}
                onChange={(e) => setFormData({ ...formData, targetClass: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              >
                {CLASSES_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center pt-6">
              <label className="relative flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isHoliday}
                  onChange={(e) => setFormData({ ...formData, isHoliday: e.target.checked })}
                  className="w-4 h-4 rounded-md text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Libur Sekolah (KBM Ditiadakan)
                </span>
              </label>
            </div>
          </div>

          {/* Time & Room (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Jam / Waktu Pelaksanaan (Opsional)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  placeholder="Misal: 07:30 - 11:30 WIB"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Ruangan / Lokasi (Opsional)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={formData.ruangan}
                  onChange={(e) => setFormData({ ...formData, ruangan: e.target.value })}
                  placeholder="Misal: Aula Utama / Lab Komputer"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Catatan / Deskripsi Agenda
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tambahkan informasi penting, persyaratan, atau instruksi siswa/guru..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-hidden resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            {editingEvent && onDelete && editingEvent.source !== 'jadwal_ujian' ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Menghapus...' : 'Hapus'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{editingEvent ? 'Simpan Perubahan' : 'Tambahkan Agenda'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
