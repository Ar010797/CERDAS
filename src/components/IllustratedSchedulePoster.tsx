import React, { useRef, useState } from 'react';
import { Download, Sparkles, Image as ImageIcon, Calendar, Clock, Printer, Check, Eye, BookOpen, FileText } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  FlourishDivider,
  TopLeftRocketBooks,
  TopRightBellAndPens,
  BottomLeftDinoAndPaint,
  BottomCenterSketchbook,
  BottomRightGlobeAndArt,
} from './SchedulePosterIllustrations';

export interface ScheduleItem {
  id: string;
  classId: string;
  type: 'pelajaran' | 'ujian';
  hari: string;
  jam: string;
  mataPelajaran: string;
  pengajar: string;
  ruangan?: string;
  keterangan?: string;
}

interface IllustratedSchedulePosterProps {
  classId: string;
  schedules: ScheduleItem[];
  type: 'pelajaran' | 'ujian';
  schoolName?: string;
  customImageUrl?: string | null;
  onUploadCustomImage?: () => void;
  onEditItem?: (item: ScheduleItem) => void;
  readOnly?: boolean;
}

const DEFAULT_DAYS = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

// Day header color theme matching the uploaded reference poster
const DAY_HEADER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SENIN: { bg: 'bg-[#d1fae5]', text: 'text-slate-900', border: 'border-slate-700' }, // mint
  SELASA: { bg: 'bg-[#e0f2fe]', text: 'text-slate-900', border: 'border-slate-700' }, // cyan/sky
  RABU: { bg: 'bg-[#fef9c3]', text: 'text-slate-900', border: 'border-slate-700' }, // lemon/mint
  KAMIS: { bg: 'bg-[#ffedd5]', text: 'text-slate-900', border: 'border-slate-700' }, // peach/orange
  JUMAT: { bg: 'bg-[#fce7f3]', text: 'text-slate-900', border: 'border-slate-700' }, // pink
  SABTU: { bg: 'bg-[#fed7aa]', text: 'text-slate-900', border: 'border-slate-700' }, // warm peach
  MINGGU: { bg: 'bg-[#fee2e2]', text: 'text-slate-900', border: 'border-slate-700' },
};

// High-fidelity sample schedule matching the reference image if database has no items yet
const SAMPLE_LESSON_ITEMS: ScheduleItem[] = [
  // Morning Routine
  { id: 's-1', classId: '1A', type: 'pelajaran', hari: 'Senin', jam: '07:00 - 07:30', mataPelajaran: 'Dzikir Pagi', pengajar: 'Wali Kelas' },
  { id: 's-2', classId: '1A', type: 'pelajaran', hari: 'Selasa', jam: '07:00 - 07:30', mataPelajaran: 'Dzikir Pagi', pengajar: 'Wali Kelas' },
  { id: 's-3', classId: '1A', type: 'pelajaran', hari: 'Rabu', jam: '07:00 - 07:30', mataPelajaran: 'Dzikir Pagi', pengajar: 'Wali Kelas' },
  { id: 's-4', classId: '1A', type: 'pelajaran', hari: 'Kamis', jam: '07:00 - 07:30', mataPelajaran: 'Dzikir Pagi', pengajar: 'Wali Kelas' },
  { id: 's-5', classId: '1A', type: 'pelajaran', hari: 'Jumat', jam: '07:00 - 07:30', mataPelajaran: 'Dzikir Pagi', pengajar: 'Wali Kelas' },
  { id: 's-6', classId: '1A', type: 'pelajaran', hari: 'Sabtu', jam: '07:00 - 07:30', mataPelajaran: 'Dzikir Pagi', pengajar: 'Wali Kelas' },

  // Period 1 (07:30 - 08:00)
  { id: 's-7', classId: '1A', type: 'pelajaran', hari: 'Senin', jam: '07:30 - 08:00', mataPelajaran: 'Halaqah', pengajar: 'Ust. Rahman' },
  { id: 's-8', classId: '1A', type: 'pelajaran', hari: 'Selasa', jam: '07:30 - 08:00', mataPelajaran: 'Pendidikan Pancasila', pengajar: 'Ibu Fatimah' },
  { id: 's-9', classId: '1A', type: 'pelajaran', hari: 'Rabu', jam: '07:30 - 08:00', mataPelajaran: 'PJOK', pengajar: 'Pak Budi' },
  { id: 's-10', classId: '1A', type: 'pelajaran', hari: 'Kamis', jam: '07:30 - 08:00', mataPelajaran: 'Halaqah', pengajar: 'Ust. Rahman' },
  { id: 's-11', classId: '1A', type: 'pelajaran', hari: 'Jumat', jam: '07:30 - 08:00', mataPelajaran: 'Bahasa Indonesia', pengajar: 'Ibu Aisyah' },
  { id: 's-12', classId: '1A', type: 'pelajaran', hari: 'Sabtu', jam: '07:30 - 08:00', mataPelajaran: 'Bahasa Jawa', pengajar: 'Pak Joko' },

  // Period 2 (08:00 - 08:30)
  { id: 's-13', classId: '1A', type: 'pelajaran', hari: 'Senin', jam: '08:00 - 08:30', mataPelajaran: 'Halaqah', pengajar: 'Ust. Rahman' },
  { id: 's-14', classId: '1A', type: 'pelajaran', hari: 'Selasa', jam: '08:00 - 08:30', mataPelajaran: 'Pendidikan Pancasila', pengajar: 'Ibu Fatimah' },
  { id: 's-15', classId: '1A', type: 'pelajaran', hari: 'Rabu', jam: '08:00 - 08:30', mataPelajaran: 'PJOK', pengajar: 'Pak Budi' },
  { id: 's-16', classId: '1A', type: 'pelajaran', hari: 'Kamis', jam: '08:00 - 08:30', mataPelajaran: 'Halaqah', pengajar: 'Ust. Rahman' },
  { id: 's-17', classId: '1A', type: 'pelajaran', hari: 'Jumat', jam: '08:00 - 08:30', mataPelajaran: 'Bahasa Indonesia', pengajar: 'Ibu Aisyah' },
  { id: 's-18', classId: '1A', type: 'pelajaran', hari: 'Sabtu', jam: '08:00 - 08:30', mataPelajaran: 'Bahasa Jawa', pengajar: 'Pak Joko' },

  // Snack / Istirahat 1 (08:30 - 08:50)
  { id: 's-19', classId: '1A', type: 'pelajaran', hari: 'Senin', jam: '08:30 - 08:50', mataPelajaran: 'Istirahat / Snack', pengajar: '-' },
  { id: 's-20', classId: '1A', type: 'pelajaran', hari: 'Selasa', jam: '08:30 - 08:50', mataPelajaran: 'Istirahat / Snack', pengajar: '-' },
  { id: 's-21', classId: '1A', type: 'pelajaran', hari: 'Rabu', jam: '08:30 - 08:50', mataPelajaran: 'Istirahat / Snack', pengajar: '-' },
  { id: 's-22', classId: '1A', type: 'pelajaran', hari: 'Kamis', jam: '08:30 - 08:50', mataPelajaran: 'Istirahat / Snack', pengajar: '-' },
  { id: 's-23', classId: '1A', type: 'pelajaran', hari: 'Jumat', jam: '08:30 - 08:50', mataPelajaran: 'Istirahat / Snack', pengajar: '-' },
  { id: 's-24', classId: '1A', type: 'pelajaran', hari: 'Sabtu', jam: '08:30 - 08:50', mataPelajaran: 'Istirahat / Snack', pengajar: '-' },

  // Period 3 (08:50 - 09:20)
  { id: 's-25', classId: '1A', type: 'pelajaran', hari: 'Senin', jam: '08:50 - 09:20', mataPelajaran: 'Bahasa Indonesia', pengajar: 'Ibu Aisyah' },
  { id: 's-26', classId: '1A', type: 'pelajaran', hari: 'Selasa', jam: '08:50 - 09:20', mataPelajaran: 'Halaqah', pengajar: 'Ust. Rahman' },
  { id: 's-27', classId: '1A', type: 'pelajaran', hari: 'Rabu', jam: '08:50 - 09:20', mataPelajaran: 'Matematika', pengajar: 'Pak Hendra' },
  { id: 's-28', classId: '1A', type: 'pelajaran', hari: 'Kamis', jam: '08:50 - 09:20', mataPelajaran: 'Matematika', pengajar: 'Pak Hendra' },
  { id: 's-29', classId: '1A', type: 'pelajaran', hari: 'Jumat', jam: '08:50 - 09:20', mataPelajaran: 'Aqidah Akhlak', pengajar: 'Ust. Wildan' },
  { id: 's-30', classId: '1A', type: 'pelajaran', hari: 'Sabtu', jam: '08:50 - 09:20', mataPelajaran: 'Halaqah', pengajar: 'Ust. Rahman' },

  // Period 4 (09:20 - 09:50)
  { id: 's-31', classId: '1A', type: 'pelajaran', hari: 'Senin', jam: '09:20 - 09:50', mataPelajaran: 'Bahasa Indonesia', pengajar: 'Ibu Aisyah' },
  { id: 's-32', classId: '1A', type: 'pelajaran', hari: 'Selasa', jam: '09:20 - 09:50', mataPelajaran: 'Halaqah', pengajar: 'Ust. Rahman' },
  { id: 's-33', classId: '1A', type: 'pelajaran', hari: 'Rabu', jam: '09:20 - 09:50', mataPelajaran: 'Matematika', pengajar: 'Pak Hendra' },
  { id: 's-34', classId: '1A', type: 'pelajaran', hari: 'Kamis', jam: '09:20 - 09:50', mataPelajaran: 'Matematika', pengajar: 'Pak Hendra' },
  { id: 's-35', classId: '1A', type: 'pelajaran', hari: 'Jumat', jam: '09:20 - 09:50', mataPelajaran: 'Aqidah Akhlak', pengajar: 'Ust. Wildan' },
  { id: 's-36', classId: '1A', type: 'pelajaran', hari: 'Sabtu', jam: '09:20 - 09:50', mataPelajaran: 'Halaqah', pengajar: 'Ust. Rahman' },

  // Istirahat 2 / Sholat Dhuha (09:50 - 10:20)
  { id: 's-37', classId: '1A', type: 'pelajaran', hari: 'Senin', jam: '09:50 - 10:20', mataPelajaran: 'Istirahat & Sholat Dhuha', pengajar: '-' },
  { id: 's-38', classId: '1A', type: 'pelajaran', hari: 'Selasa', jam: '09:50 - 10:20', mataPelajaran: 'Istirahat & Sholat Dhuha', pengajar: '-' },
  { id: 's-39', classId: '1A', type: 'pelajaran', hari: 'Rabu', jam: '09:50 - 10:20', mataPelajaran: 'Istirahat & Sholat Dhuha', pengajar: '-' },
  { id: 's-40', classId: '1A', type: 'pelajaran', hari: 'Kamis', jam: '09:50 - 10:20', mataPelajaran: 'Istirahat & Sholat Dhuha', pengajar: '-' },
  { id: 's-41', classId: '1A', type: 'pelajaran', hari: 'Jumat', jam: '09:50 - 10:20', mataPelajaran: 'Istirahat & Sholat Dhuha', pengajar: '-' },
  { id: 's-42', classId: '1A', type: 'pelajaran', hari: 'Sabtu', jam: '09:50 - 10:20', mataPelajaran: 'Istirahat & Sholat Dhuha', pengajar: '-' },

  // Period 5 (10:20 - 10:50)
  { id: 's-43', classId: '1A', type: 'pelajaran', hari: 'Senin', jam: '10:20 - 10:50', mataPelajaran: 'Bahasa Arab', pengajar: 'Ust. Fadhil' },
  { id: 's-44', classId: '1A', type: 'pelajaran', hari: 'Selasa', jam: '10:20 - 10:50', mataPelajaran: 'Fiqih', pengajar: 'Ust. Mansur' },
  { id: 's-45', classId: '1A', type: 'pelajaran', hari: 'Rabu', jam: '10:20 - 10:50', mataPelajaran: 'Halaqah', pengajar: 'Ust. Rahman' },
  { id: 's-46', classId: '1A', type: 'pelajaran', hari: 'Kamis', jam: '10:20 - 10:50', mataPelajaran: 'SBdP', pengajar: 'Ibu Ratna' },
  { id: 's-47', classId: '1A', type: 'pelajaran', hari: 'Jumat', jam: '10:20 - 10:50', mataPelajaran: 'Keputrian / Sholat Jumat', pengajar: 'Guru PAI' },
  { id: 's-48', classId: '1A', type: 'pelajaran', hari: 'Sabtu', jam: '10:20 - 10:50', mataPelajaran: 'Bahasa Indonesia', pengajar: 'Ibu Aisyah' },

  // Period 6 (10:50 - 11:20)
  { id: 's-49', classId: '1A', type: 'pelajaran', hari: 'Senin', jam: '10:50 - 11:20', mataPelajaran: 'Bahasa Arab', pengajar: 'Ust. Fadhil' },
  { id: 's-50', classId: '1A', type: 'pelajaran', hari: 'Selasa', jam: '10:50 - 11:20', mataPelajaran: 'Fiqih', pengajar: 'Ust. Mansur' },
  { id: 's-51', classId: '1A', type: 'pelajaran', hari: 'Rabu', jam: '10:50 - 11:20', mataPelajaran: 'Halaqah', pengajar: 'Ust. Rahman' },
  { id: 's-52', classId: '1A', type: 'pelajaran', hari: 'Kamis', jam: '10:50 - 11:20', mataPelajaran: 'SBdP', pengajar: 'Ibu Ratna' },
  { id: 's-53', classId: '1A', type: 'pelajaran', hari: 'Jumat', jam: '10:50 - 11:20', mataPelajaran: 'Persiapan Pulang', pengajar: 'Wali Kelas' },
  { id: 's-54', classId: '1A', type: 'pelajaran', hari: 'Sabtu', jam: '10:50 - 11:20', mataPelajaran: 'Bahasa Indonesia', pengajar: 'Ibu Aisyah' },

  // Closing Period (11:20 - 11:35)
  { id: 's-55', classId: '1A', type: 'pelajaran', hari: 'Senin', jam: '11:20 - 11:35', mataPelajaran: 'WALAS (TAUDI, PIKET, REFLEKSI)', pengajar: 'Wali Kelas' },
  { id: 's-56', classId: '1A', type: 'pelajaran', hari: 'Selasa', jam: '11:20 - 11:35', mataPelajaran: 'WALAS (TAUDI, PIKET, REFLEKSI)', pengajar: 'Wali Kelas' },
  { id: 's-57', classId: '1A', type: 'pelajaran', hari: 'Rabu', jam: '11:20 - 11:35', mataPelajaran: 'WALAS (TAUDI, PIKET, REFLEKSI)', pengajar: 'Wali Kelas' },
  { id: 's-58', classId: '1A', type: 'pelajaran', hari: 'Kamis', jam: '11:20 - 11:35', mataPelajaran: 'WALAS (TAUDI, PIKET, REFLEKSI)', pengajar: 'Wali Kelas' },
  { id: 's-59', classId: '1A', type: 'pelajaran', hari: 'Jumat', jam: '11:20 - 11:35', mataPelajaran: 'WALAS (TAUDI, PIKET, REFLEKSI)', pengajar: 'Wali Kelas' },
  { id: 's-60', classId: '1A', type: 'pelajaran', hari: 'Sabtu', jam: '11:20 - 11:35', mataPelajaran: 'WALAS (TAUDI, PIKET, REFLEKSI)', pengajar: 'Wali Kelas' },
];

const SAMPLE_EXAM_ITEMS: ScheduleItem[] = [
  { id: 'u-1', classId: '1A', type: 'ujian', hari: 'Senin', jam: '07:30 - 09:00', mataPelajaran: 'Pendidikan Pancasila', pengajar: 'Ibu Fatimah', ruangan: 'Ruang 1A', keterangan: 'Materi Bab 1 - 2' },
  { id: 'u-2', classId: '1A', type: 'ujian', hari: 'Senin', jam: '09:30 - 11:00', mataPelajaran: 'Pendidikan Agama Islam (PAI)', pengajar: 'Ust. Wildan', ruangan: 'Ruang 1A', keterangan: 'Surah pendek & adab' },
  { id: 'u-3', classId: '1A', type: 'ujian', hari: 'Selasa', jam: '07:30 - 09:00', mataPelajaran: 'Bahasa Indonesia', pengajar: 'Ibu Aisyah', ruangan: 'Ruang 1A', keterangan: 'Membaca lancar & menyalin' },
  { id: 'u-4', classId: '1A', type: 'ujian', hari: 'Selasa', jam: '09:30 - 11:00', mataPelajaran: 'Seni Budaya dan Prakarya (SBdP)', pengajar: 'Ibu Ratna', ruangan: 'Ruang 1A', keterangan: 'Membawa pensil warna' },
  { id: 'u-5', classId: '1A', type: 'ujian', hari: 'Rabu', jam: '07:30 - 09:00', mataPelajaran: 'Matematika', pengajar: 'Pak Hendra', ruangan: 'Ruang 1A', keterangan: 'Penjumlahan & pengurangan 1-20' },
  { id: 'u-6', classId: '1A', type: 'ujian', hari: 'Rabu', jam: '09:30 - 11:00', mataPelajaran: 'PJOK (Teori)', pengajar: 'Pak Budi', ruangan: 'Ruang 1A', keterangan: 'Gerak dasar lokomotor' },
  { id: 'u-7', classId: '1A', type: 'ujian', hari: 'Kamis', jam: '07:30 - 09:00', mataPelajaran: 'Bahasa Arab', pengajar: 'Ust. Fadhil', ruangan: 'Ruang 1A', keterangan: 'Mufrodat benda kelas' },
  { id: 'u-8', classId: '1A', type: 'ujian', hari: 'Kamis', jam: '09:30 - 11:00', mataPelajaran: 'Fiqih', pengajar: 'Ust. Mansur', ruangan: 'Ruang 1A', keterangan: 'Tata cara wudhu dan sholat' },
  { id: 'u-9', classId: '1A', type: 'ujian', hari: 'Jumat', jam: '07:30 - 09:00', mataPelajaran: 'Aqidah Akhlak', pengajar: 'Ust. Wildan', ruangan: 'Ruang 1A', keterangan: 'Kalimat thoyyibah & Asmaul Husna' },
  { id: 'u-10', classId: '1A', type: 'ujian', hari: 'Sabtu', jam: '07:30 - 09:00', mataPelajaran: 'Bahasa Jawa', pengajar: 'Pak Joko', ruangan: 'Ruang 1A', keterangan: 'Unggah-ungguh basa & tembang' },
];

export default function IllustratedSchedulePoster({
  classId,
  schedules,
  type,
  schoolName = 'SEKOLAH DASAR',
  customImageUrl,
  onUploadCustomImage,
  onEditItem,
  readOnly = false,
}: IllustratedSchedulePosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFullCustomImage, setShowFullCustomImage] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Filter schedules by type
  const actualItems = schedules.filter((s) => s.type === type);
  const isUsingSample = actualItems.length === 0;
  const activeItems = isUsingSample
    ? (type === 'pelajaran' ? SAMPLE_LESSON_ITEMS : SAMPLE_EXAM_ITEMS)
    : actualItems;

  const isExam = type === 'ujian';

  // Distinct time intervals sorted
  const rawTimes = Array.from(new Set(activeItems.map((s) => s.jam.trim()))).filter(Boolean);
  const sortedTimes = rawTimes.sort((a, b) => {
    const parseTime = (str: string) => {
      const match = str.match(/(\d{1,2})[:.](\d{2})/);
      return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
    };
    return parseTime(a) - parseTime(b);
  });

  // Extract distinct days
  const daysInSchedules = Array.from(
    new Set(activeItems.map((s) => s.hari.trim().toUpperCase()))
  ).filter(Boolean);

  const activeDays = DEFAULT_DAYS.filter(
    (d) => daysInSchedules.length === 0 || daysInSchedules.includes(d) || daysInSchedules.length <= 4
  );

  // Build grid map: [time][day] = ScheduleItem
  const gridMap: Record<string, Record<string, ScheduleItem>> = {};
  for (const time of sortedTimes) {
    gridMap[time] = {};
    for (const item of activeItems) {
      if (item.jam.trim() === time) {
        gridMap[time][item.hari.trim().toUpperCase()] = item;
      }
    }
  }

  // Handle Export to PNG at crisp 2x resolution
  const handleDownloadImage = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const dataUrl = await toPng(posterRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      const safeClass = (classId || '1A').replace(/\s+/g, '_');
      const safeType = isExam ? 'Poster_Jadwal_Ujian' : 'Poster_Jadwal_Pelajaran';
      link.download = `${safeType}_${safeClass}.png`;
      link.href = dataUrl;
      link.click();

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export schedule poster:', err);
      alert('Gagal mengekspor poster. Silakan gunakan tombol cetak browser atau coba kembali.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Determine row number for periods
  let periodCounter = 0;

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-100 to-rose-100 text-amber-900 dark:from-amber-950/70 dark:to-rose-950/70 dark:text-amber-300 flex items-center gap-1.5 border border-amber-300 dark:border-amber-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Poster {isExam ? 'Jadwal Ujian' : 'Jadwal Pelajaran'} (Tema Ilustrasi Ceria)</span>
          </span>
          {isUsingSample && (
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 hidden sm:inline">
              ✨ Format Naskah Standar {classId}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {customImageUrl && (
            <button
              onClick={() => setShowFullCustomImage(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Foto Desain Asli</span>
            </button>
          )}

          {onUploadCustomImage && (
            <button
              onClick={onUploadCustomImage}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Unggah berkas foto/desain Canva sendiri jika ada"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Ganti/Scan Gambar</span>
            </button>
          )}

          <button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            title="Unduh jadwal sebagai berkas gambar PNG untuk dishare di grup WhatsApp"
          >
            {isExporting ? (
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : exportSuccess ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isExporting ? 'Membuat Poster...' : exportSuccess ? 'Tersimpan!' : 'Download Poster (PNG)'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            title="Cetak Poster"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Illustrated Poster Container */}
      <div className="overflow-x-auto pb-6">
        <div
          ref={posterRef}
          className="min-w-[780px] max-w-[1000px] mx-auto rounded-[36px] sm:rounded-[44px] p-6 sm:p-10 shadow-2xl border-[5px] border-white/95 relative overflow-hidden text-slate-900 select-none print:shadow-none print:border-none print:m-0 print:p-4"
          style={{
            background: 'linear-gradient(135deg, #dbeafe 0%, #fce7f3 30%, #fdf4ff 60%, #fef3c7 100%)',
          }}
        >
          {/* Subtle Floating Pastel Confetti Doodles */}
          <div className="absolute top-12 left-1/4 w-3 h-3 bg-pink-300/60 rounded-full blur-[0.5px] pointer-events-none" />
          <div className="absolute top-20 right-1/4 w-4 h-4 bg-yellow-300/70 rotate-45 pointer-events-none" />
          <div className="absolute top-36 left-12 text-sky-400/80 text-xl pointer-events-none">✨</div>
          <div className="absolute top-44 right-16 text-pink-400/80 text-lg pointer-events-none">⭐</div>
          <div className="absolute bottom-40 left-20 w-3 h-3 bg-teal-300/60 rounded-full pointer-events-none" />
          <div className="absolute bottom-32 right-24 text-amber-400/80 text-xl pointer-events-none">✨</div>

          {/* 5 Corner / Border Illustrations Matching User's Image */}
          {/* Top Left: Stack of colorful textbooks + Rocket Book + Atom */}
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20">
            <TopLeftRocketBooks />
          </div>

          {/* Top Right: School Bell on Stand + Cup with Pens */}
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20">
            <TopRightBellAndPens />
          </div>

          {/* Bottom Left: Dinosaur Book + Paint Album + Books Stack */}
          <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-20">
            <BottomLeftDinoAndPaint />
          </div>

          {/* Bottom Center: Open Doodle Sketchbook ("IDEAS" Robot & "ART" Sun) */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 hidden md:block">
            <BottomCenterSketchbook />
          </div>

          {/* Bottom Right: Globe on Stand + Pocket Watch + Tablet + Brushes */}
          <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-20">
            <BottomRightGlobeAndArt />
          </div>

          {/* Poster Center Header */}
          <div className="relative z-30 text-center mb-6 pt-2 max-w-xl mx-auto px-4">
            {/* Top Vintage Scroll Flourish Divider */}
            <FlourishDivider className="mb-2" />

            {/* Main Bold Display Title */}
            <h1
              className="text-2xl sm:text-4xl lg:text-5xl font-black uppercase tracking-wider text-[#1e293b] leading-tight"
              style={{
                fontFamily: `'Outfit', 'Nunito', 'Arial Rounded MT Bold', sans-serif`,
                letterSpacing: '0.04em',
              }}
            >
              {isExam ? 'JADWAL UJIAN' : 'JADWAL PELAJARAN'}
            </h1>

            {/* Class Identifier Title */}
            <h2
              className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-wide text-[#0f172a] mt-0.5 leading-none"
              style={{
                fontFamily: `'Outfit', 'Nunito', 'Arial Rounded MT Bold', sans-serif`,
              }}
            >
              {classId.toUpperCase().startsWith('KELAS') ? classId.toUpperCase() : `KELAS ${classId.toUpperCase()}`}
            </h2>

            {/* Bottom Vintage Scroll Flourish Divider */}
            <FlourishDivider className="mt-2 mb-3" />

            {/* Subtitle Banner text */}
            <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700 bg-white/75 backdrop-blur-xs px-5 py-1 rounded-full inline-block border border-slate-300 shadow-2xs">
              {isExam
                ? `PENILAIAN TENGAH / AKHIR SEMESTER (${classId.toUpperCase()})`
                : `JADWAL PELAJARAN ${classId.toUpperCase().startsWith('KELAS') ? classId.toUpperCase() : `KELAS ${classId.toUpperCase()}`}`}
            </div>
          </div>

          {/* Main Matrix Schedule Table */}
          <div className="relative z-30 mb-28 sm:mb-32 md:mb-36">
            <div className="bg-white/95 rounded-2xl shadow-xl overflow-hidden border-2 border-slate-700">
              <table className="w-full border-collapse text-left">
                {/* Header Row */}
                <thead>
                  <tr className="border-b-2 border-slate-700">
                    {/* Empty / No. Column Header */}
                    <th className="w-8 sm:w-10 p-2 text-center text-xs font-black text-slate-800 bg-[#ccfbf1]/60 border-r-2 border-slate-700">
                      #
                    </th>
                    {/* Waktu Column Header */}
                    <th className="w-24 sm:w-32 p-2 text-center text-xs sm:text-sm font-black text-slate-800 bg-[#ccfbf1]/60 border-r-2 border-slate-700 uppercase tracking-wide">
                      WAKTU
                    </th>
                    {/* Day Column Headers with pastel colors */}
                    {activeDays.map((day) => {
                      const colStyle = DAY_HEADER_COLORS[day] || {
                        bg: 'bg-[#e2e8f0]',
                        text: 'text-slate-900',
                        border: 'border-slate-700',
                      };
                      return (
                        <th
                          key={day}
                          className={`${colStyle.bg} ${colStyle.text} p-2 sm:p-2.5 text-center text-xs sm:text-sm font-black uppercase tracking-wider border-r-2 border-slate-700 last:border-r-0`}
                        >
                          {day}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Body Rows */}
                <tbody className="divide-y-2 divide-slate-700 text-xs sm:text-[13px] font-bold">
                  {sortedTimes.map((time) => {
                    const itemsAtTime = activeDays.map((d) => gridMap[time]?.[d]).filter(Boolean);
                    const firstItem = itemsAtTime[0];

                    // Detect special spanning rows (Dzikir Pagi, Istirahat, Walas/Refleksi)
                    const isAllSame =
                      itemsAtTime.length > 1 &&
                      itemsAtTime.every(
                        (it) => it.mataPelajaran.trim().toLowerCase() === firstItem?.mataPelajaran?.trim().toLowerCase()
                      );

                    const mapelLower = (firstItem?.mataPelajaran || '').toLowerCase();
                    const isDzikirPagi = mapelLower.includes('dzikir') || mapelLower.includes('doa');
                    const isIstirahat = mapelLower.includes('istirahat') || mapelLower.includes('snack') || mapelLower.includes('makan');
                    const isWalas =
                      mapelLower.includes('walas') ||
                      mapelLower.includes('piket') ||
                      mapelLower.includes('refleksi') ||
                      mapelLower.includes('taudi') ||
                      mapelLower.includes('penutup');

                    const isSpanningRow = isAllSame && (isDzikirPagi || isIstirahat || isWalas);

                    // If not special, increment period counter
                    let currentPeriodNumber: number | null = null;
                    if (!isSpanningRow) {
                      periodCounter += 1;
                      currentPeriodNumber = periodCounter;
                    }

                    return (
                      <tr key={time} className="hover:bg-slate-50/50 transition-colors">
                        {/* Period Number Column */}
                        <td className="p-1.5 sm:p-2 text-center font-black text-slate-800 border-r-2 border-slate-700 bg-white">
                          {currentPeriodNumber !== null ? currentPeriodNumber : ''}
                        </td>

                        {/* Time Column (e.g. 07:00 - 07:30) */}
                        <td
                          className={`p-1.5 sm:p-2 text-center font-black tracking-tight whitespace-nowrap border-r-2 border-slate-700 ${
                            isDzikirPagi
                              ? 'bg-[#d9f99d] text-emerald-950'
                              : isIstirahat
                              ? 'bg-[#fef08a] text-amber-950'
                              : isWalas
                              ? 'bg-[#fed7aa] text-orange-950'
                              : 'bg-[#f8fafc] text-slate-800'
                          }`}
                        >
                          {time}
                        </td>

                        {/* Cell Content: Spanning Row vs Individual Day Cells */}
                        {isSpanningRow && firstItem ? (
                          <td
                            colSpan={activeDays.length}
                            className={`p-2 text-center uppercase tracking-wider font-black text-xs sm:text-sm ${
                              isDzikirPagi
                                ? 'bg-[#d9f99d] text-emerald-950'
                                : isIstirahat
                                ? 'bg-[#fef08a] text-amber-950'
                                : 'bg-[#fed7aa] text-orange-950'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              {isDzikirPagi && <span>🤲</span>}
                              {isIstirahat && <span>🍱</span>}
                              {isWalas && <span>👩‍🏫</span>}
                              <span>{firstItem.mataPelajaran}</span>
                              {isDzikirPagi && <span>🕌</span>}
                              {isIstirahat && <span>🍎</span>}
                              {isWalas && <span>🧹</span>}
                            </div>
                          </td>
                        ) : (
                          activeDays.map((day) => {
                            const item = gridMap[time]?.[day];

                            if (!item) {
                              return (
                                <td
                                  key={day}
                                  className="p-2 text-center text-slate-300 font-normal border-r-2 border-slate-700 last:border-r-0 bg-white"
                                >
                                  -
                                </td>
                              );
                            }

                            return (
                              <td
                                key={day}
                                onClick={() => !readOnly && onEditItem && onEditItem(item)}
                                className={`p-2 sm:p-2.5 text-center align-middle border-r-2 border-slate-700 last:border-r-0 bg-white transition-colors ${
                                  !readOnly && onEditItem ? 'cursor-pointer hover:bg-amber-50/80' : ''
                                }`}
                              >
                                <div className="flex flex-col items-center justify-center">
                                  {/* Subject Title */}
                                  <span className="font-black text-slate-900 leading-tight text-xs sm:text-[13px]">
                                    {item.mataPelajaran}
                                  </span>

                                  {/* Exam room/supervisor badge */}
                                  {isExam && (item.ruangan || item.pengajar) && (
                                    <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                                      {item.ruangan && (
                                        <span className="text-[9px] font-bold bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded border border-purple-200">
                                          {item.ruangan}
                                        </span>
                                      )}
                                      {item.pengajar && (
                                        <span className="text-[9px] font-medium text-slate-500">
                                          {item.pengajar}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Teacher / Subtext on regular lessons if available */}
                                  {!isExam && item.pengajar && item.pengajar !== '-' && (
                                    <span className="text-[10px] font-medium text-slate-500 mt-0.5 leading-none">
                                      {item.pengajar}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Poster Footer Note */}
            <div className="mt-3 px-2 flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span>📌 Sekolah Dasar Terpadu • Pendidikan Karakter & Bernalar Kritis</span>
              <span>Diterbitkan Resmi untuk Orang Tua Siswa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal View for Custom Full Uploaded Poster */}
      {showFullCustomImage && customImageUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-800 dark:text-white text-base">
                  Foto / Gambar Poster Jadwal {classId}
                </h3>
              </div>
              <button
                onClick={() => setShowFullCustomImage(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              <img
                src={customImageUrl}
                alt={`Poster Jadwal ${classId}`}
                className="max-w-full h-auto rounded-2xl shadow-md object-contain max-h-[75vh]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
