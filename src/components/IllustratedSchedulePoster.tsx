import React, { useRef, useState } from 'react';
import { Download, Sparkles, Image as ImageIcon, Calendar, Clock, Printer, Check, Copy, Share2, ZoomIn, X, Eye } from 'lucide-react';
import { toPng } from 'html-to-image';

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

const DEFAULT_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Day color styling matching the uploaded illustration
const DAY_STYLES: Record<string, { headerBg: string; headerText: string; cellBg: string; border: string }> = {
  Senin: { headerBg: 'bg-[#93c5fd]', headerText: 'text-slate-900', cellBg: 'bg-[#e0f2fe]/60', border: 'border-sky-300' },
  Selasa: { headerBg: 'bg-[#86efac]', headerText: 'text-slate-900', cellBg: 'bg-[#dcfce7]/60', border: 'border-emerald-300' },
  Rabu: { headerBg: 'bg-[#fef08a]', headerText: 'text-slate-900', cellBg: 'bg-[#fef9c3]/60', border: 'border-amber-300' },
  Kamis: { headerBg: 'bg-[#fdba74]', headerText: 'text-slate-900', cellBg: 'bg-[#ffedd5]/60', border: 'border-orange-300' },
  Jumat: { headerBg: 'bg-[#f9a8d4]', headerText: 'text-slate-900', cellBg: 'bg-[#fce7f3]/60', border: 'border-pink-300' },
  Sabtu: { headerBg: 'bg-[#d8b4fe]', headerText: 'text-slate-900', cellBg: 'bg-[#f3e8ff]/60', border: 'border-purple-300' },
  Minggu: { headerBg: 'bg-[#fca5a5]', headerText: 'text-slate-900', cellBg: 'bg-[#fee2e2]/60', border: 'border-rose-300' },
};

// Clock colors for left column
const CLOCK_COLORS = [
  '#0284c7', // blue
  '#dc2626', // red
  '#d97706', // amber
  '#b91c1c', // dark red
  '#ea580c', // orange
  '#e11d48', // rose
  '#4338ca', // indigo
  '#059669', // emerald
];

// Helper to determine cute stickers and theme for each subject
export function getSubjectVisuals(mapelName: string, keterangan: string = '', isExam: boolean = false) {
  const text = (mapelName + ' ' + keterangan).toLowerCase();

  if (isExam) {
    return {
      stickers: ['📝', '⏱️', '⭐'],
      label: 'Ujian / Asesmen',
      accentColor: 'text-purple-700',
    };
  }

  // Dzikir / Doa Pagi
  if (text.includes('dzikir') || text.includes('doa') || text.includes('tadarus')) {
    return {
      stickers: ['🕌', '🤲'],
      isFullRow: true,
      accentColor: 'text-emerald-800',
    };
  }

  // Istirahat
  if (text.includes('istirahat') || text.includes('snack') || text.includes('makan')) {
    return {
      stickers: ['🍱', '🍎'],
      isBreak: true,
      accentColor: 'text-amber-900',
    };
  }

  // Walas / Refleksi / Piket / Pulang
  if (text.includes('walas') || text.includes('piket') || text.includes('refleksi') || text.includes('taudi') || text.includes('pulang')) {
    return {
      stickers: ['👩‍🏫', '🧹', '🧠'],
      isFullRow: true,
      accentColor: 'text-slate-800',
    };
  }

  // Halaqah / Tahfidz / Quran / PAI
  if (text.includes('halaqah') || text.includes('tahfidz') || text.includes('quran') || text.includes('pai') || text.includes('agama islam')) {
    return {
      stickers: ['📖', '👦🏻'],
      accentColor: 'text-amber-800',
    };
  }

  // Pancasila / PKn
  if (text.includes('pancasila') || text.includes('pkn') || text.includes('kewarganegaraan')) {
    return {
      stickers: ['🇮🇩', '🦅'],
      accentColor: 'text-red-700',
    };
  }

  // PJOK / Olahraga
  if (text.includes('pjok') || text.includes('olahraga') || text.includes('penjas') || text.includes('senam')) {
    return {
      stickers: ['⚽', '🏃‍♂️'],
      accentColor: 'text-emerald-700',
    };
  }

  // Matematika / Berhitung
  if (text.includes('matematika') || text.includes('math') || text.includes('berhitung')) {
    return {
      stickers: ['🔢', '🧮', '📐'],
      mathBadge: '12=',
      accentColor: 'text-sky-800',
    };
  }

  // Bahasa Indonesia
  if (text.includes('bahasa indonesia') || text.includes('b. indonesia') || text.includes('indo')) {
    return {
      stickers: ['📚', '✏️'],
      accentColor: 'text-rose-700',
    };
  }

  // Bahasa Arab
  if (text.includes('bahasa arab') || text.includes('b. arab') || text.includes('arab')) {
    return {
      stickers: ['🌴', '🐪', '🌴'],
      accentColor: 'text-emerald-800',
    };
  }

  // Fiqih
  if (text.includes('fiqih') || text.includes('fikih') || text.includes('wudhu') || text.includes('shalat')) {
    return {
      stickers: ['💧', '👦🏻'],
      accentColor: 'text-cyan-800',
    };
  }

  // SBdP / Kesenian / Prakarya
  if (text.includes('sbdp') || text.includes('seni') || text.includes('prakarya') || text.includes('gambar') || text.includes('musik')) {
    return {
      stickers: ['🎨', '🎵'],
      accentColor: 'text-orange-700',
    };
  }

  // Aqidah Akhlak
  if (text.includes('aqidah') || text.includes('akhlak') || text.includes('adab')) {
    return {
      stickers: ['💖', '🤲'],
      accentColor: 'text-pink-700',
    };
  }

  // Bahasa Jawa / Sunda / Daerah
  if (text.includes('jawa') || text.includes('sunda') || text.includes('daerah') || text.includes('budaya')) {
    return {
      stickers: ['🎭', '📜'],
      subtextBadge: 'ꦗꦮ',
      accentColor: 'text-amber-900',
    };
  }

  // IPA / Sains
  if (text.includes('ipa') || text.includes('sains') || text.includes('biologi') || text.includes('fisika')) {
    return {
      stickers: ['🔬', '🧪', '🌱'],
      accentColor: 'text-teal-700',
    };
  }

  // IPS / Sejarah
  if (text.includes('ips') || text.includes('sejarah') || text.includes('geografi')) {
    return {
      stickers: ['🌍', '🧭'],
      accentColor: 'text-amber-800',
    };
  }

  // Bahasa Inggris
  if (text.includes('inggris') || text.includes('english')) {
    return {
      stickers: ['🗣️', '🇬🇧', '✨'],
      accentColor: 'text-indigo-700',
    };
  }

  // Komputer / TIK / Informatika
  if (text.includes('tik') || text.includes('komputer') || text.includes('informatika') || text.includes('koding')) {
    return {
      stickers: ['💻', '🖱️'],
      accentColor: 'text-blue-700',
    };
  }

  // Default / Umum
  return {
    stickers: ['📖', '⭐'],
    accentColor: 'text-slate-800',
  };
}

export default function IllustratedSchedulePoster({
  classId,
  schedules,
  type,
  schoolName = 'SEKOLAH DASAR ISLAM TERPADU',
  customImageUrl,
  onUploadCustomImage,
  onEditItem,
  readOnly = false,
}: IllustratedSchedulePosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFullCustomImage, setShowFullCustomImage] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Group schedules by time intervals and days
  const filtered = schedules.filter((s) => s.type === type);

  // Distinct time intervals sorted
  const rawTimes = Array.from(new Set(filtered.map((s) => s.jam.trim()))).filter(Boolean);
  
  // Custom sorting for time (extract hour & minute)
  const sortedTimes = rawTimes.sort((a, b) => {
    const parseTime = (str: string) => {
      const match = str.match(/(\d{1,2})[:.](\d{2})/);
      return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
    };
    return parseTime(a) - parseTime(b);
  });

  // Extract distinct days
  const daysInSchedules = Array.from(new Set(filtered.map((s) => s.hari.trim()))).filter(Boolean);
  
  // Sort days following DEFAULT_DAYS or dates if ujian
  const activeDays = type === 'pelajaran'
    ? DEFAULT_DAYS.filter((d) => daysInSchedules.length === 0 || daysInSchedules.includes(d) || daysInSchedules.length < 4)
    : (daysInSchedules.length > 0 ? daysInSchedules.sort() : DEFAULT_DAYS.slice(0, 5));

  // Build grid map: [time][day] = ScheduleItem
  const gridMap: Record<string, Record<string, ScheduleItem>> = {};
  for (const time of sortedTimes) {
    gridMap[time] = {};
    for (const item of filtered) {
      if (item.jam.trim() === time) {
        gridMap[time][item.hari.trim()] = item;
      }
    }
  }

  // Handle Export to PNG
  const handleDownloadImage = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);
    try {
      // Small pause to ensure layout paint
      await new Promise((r) => setTimeout(r, 150));
      const dataUrl = await toPng(posterRef.current, {
        quality: 0.98,
        pixelRatio: 2, // Crisp 2x retina export for WhatsApp and printing
        backgroundColor: '#ffffff',
      });
      
      const link = document.createElement('a');
      const safeClass = classId.replace(/\s+/g, '_');
      const safeType = type === 'pelajaran' ? 'Jadwal_Pelajaran' : 'Jadwal_Ujian';
      link.download = `${safeType}_${safeClass}.png`;
      link.href = dataUrl;
      link.click();
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export schedule image:', err);
      alert('Gagal mengekspor gambar jadwal. Silakan gunakan tombol cetak browser atau coba kembali.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  const isExam = type === 'ujian';

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 flex items-center gap-1.5 border border-amber-200 dark:border-amber-800">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Format Poster Bergambar (Infografis Menarik)</span>
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            Tampilan visual ceria ramah anak & orang tua
          </span>
        </div>

        <div className="flex items-center gap-2">
          {customImageUrl && (
            <button
              onClick={() => setShowFullCustomImage(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Lihat Foto Poster Asli</span>
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
            <span>{isExporting ? 'Membuat Gambar...' : exportSuccess ? 'Tersimpan!' : 'Download Gambar (PNG)'}</span>
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
      <div className="overflow-x-auto pb-4">
        <div
          ref={posterRef}
          className="min-w-[760px] max-w-[1040px] mx-auto bg-[#cbe8fa] rounded-[36px] p-6 sm:p-8 shadow-xl border-4 border-white/80 relative overflow-hidden text-slate-900 select-none print:shadow-none print:border-none"
          style={{
            backgroundImage: `radial-gradient(#93c5fd 1.2px, transparent 1.2px), radial-gradient(#bae6fd 1.2px, #cbe8fa 1.2px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
          }}
        >
          {/* Nature Background Elements (Trees, Clouds, Floating Books, Butterflies) */}
          {/* Top Left Cloud */}
          <div className="absolute top-2 left-6 pointer-events-none opacity-90">
            <svg width="120" height="60" viewBox="0 0 120 60" fill="none">
              <path d="M25 45 C15 45 5 38 5 28 C5 18 16 12 26 14 C30 6 42 2 54 6 C64 -1 79 2 85 11 C95 8 108 15 108 26 C116 29 118 40 111 46 C105 47 30 46 25 45 Z" fill="#ffffff" />
            </svg>
          </div>

          {/* Top Right Cloud */}
          <div className="absolute top-3 right-8 pointer-events-none opacity-90">
            <svg width="130" height="65" viewBox="0 0 130 65" fill="none">
              <path d="M30 50 C18 50 8 42 8 30 C8 19 20 13 32 15 C37 6 50 2 64 6 C75 -1 92 2 100 12 C112 9 125 17 125 29 C133 32 135 44 127 51 C120 52 35 51 30 50 Z" fill="#ffffff" />
            </svg>
          </div>

          {/* Floating Cartoon Books & Butterfly */}
          <div className="absolute top-4 left-20 pointer-events-none -rotate-12 select-none animate-bounce" style={{ animationDuration: '4s' }}>
            <span className="text-4xl filter drop-shadow-md">📖</span>
          </div>

          <div className="absolute top-3 right-28 pointer-events-none rotate-12 select-none animate-bounce" style={{ animationDuration: '4.5s' }}>
            <span className="text-4xl filter drop-shadow-md">📚</span>
          </div>

          <div className="absolute top-14 right-14 pointer-events-none select-none">
            <span className="text-2xl filter drop-shadow-sm">🦋</span>
          </div>

          <div className="absolute top-14 left-14 pointer-events-none select-none">
            <span className="text-2xl filter drop-shadow-sm">⭐</span>
          </div>

          {/* Trees Framing at Bottom / Corners */}
          <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-emerald-600/25 rounded-full pointer-events-none blur-sm" />
          <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-emerald-600/25 rounded-full pointer-events-none blur-sm" />

          {/* Header Banner - 3D Ribbon Style matching the attached image */}
          <div className="relative z-10 text-center mb-6 pt-2">
            <div className="inline-block relative">
              {/* Ribbon Background Box with folded ends */}
              <div className="relative bg-gradient-to-b from-[#fffef8] to-[#fef8e7] border-3 border-[#334155] rounded-2xl px-8 sm:px-14 py-3 shadow-[0_8px_0_#1e293b] transform -rotate-0.5">
                {/* School Name Tag */}
                <p className="text-[11px] sm:text-xs font-black tracking-widest text-[#0284c7] uppercase mb-0.5">
                  {schoolName}
                </p>

                {/* Big Display Title with outline & 3D text feel */}
                <h1
                  className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[#0f172a]"
                  style={{
                    fontFamily: `'Fredoka', 'Nunito', 'Comic Sans MS', 'Arial Rounded MT Bold', sans-serif`,
                    textShadow: '2px 2px 0px #cbd5e1',
                  }}
                >
                  {isExam ? 'JADWAL UJIAN / ASESMEN' : 'JADWAL PELAJARAN'}
                </h1>

                {/* Class Badge */}
                <div className="mt-0.5 inline-block bg-[#0f172a] text-[#fef08a] px-4 py-0.5 rounded-full font-black text-sm sm:text-base tracking-wider uppercase shadow-inner">
                  {classId}
                </div>
              </div>

              {/* Ribbon Tails Left & Right */}
              <div className="hidden sm:block absolute -left-6 top-3 -z-10 w-8 h-12 bg-[#cbd5e1] border-2 border-[#334155] rounded-l-lg transform -rotate-12" />
              <div className="hidden sm:block absolute -right-6 top-3 -z-10 w-8 h-12 bg-[#cbd5e1] border-2 border-[#334155] rounded-r-lg transform rotate-12" />
            </div>
          </div>

          {/* Schedule Table Container */}
          {filtered.length === 0 ? (
            <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-3xl p-10 text-center border-2 border-dashed border-sky-300 max-w-lg mx-auto my-8 shadow-sm">
              <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-8 h-8 text-sky-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">
                Belum Ada {isExam ? 'Jadwal Ujian' : 'Jadwal Pelajaran'} untuk {classId}
              </h3>
              <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                Silakan tambah jadwal melalui tombol form di atas atau impor file Excel agar jadwal langsung tertata di poster ini.
              </p>
            </div>
          ) : (
            <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-3xl p-3 sm:p-5 shadow-lg border-2 border-sky-200">
              {/* Grid Layout: Time Column (Fixed Width) + Days Columns (Equal Width) */}
              <div className="w-full">
                {/* Header Row: Jam + Days */}
                <div className="flex items-stretch gap-2 mb-2.5">
                  {/* Top-Left Corner Clock Header */}
                  <div className="w-24 sm:w-32 shrink-0 bg-white/80 border-2 border-slate-300 rounded-2xl p-2 flex flex-col items-center justify-center shadow-xs">
                    <Clock className="w-5 h-5 text-sky-600 mb-0.5" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">WAKTU</span>
                  </div>

                  {/* Day Header Badges */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {activeDays.map((day) => {
                      const style = DAY_STYLES[day] || {
                        headerBg: 'bg-indigo-200',
                        headerText: 'text-indigo-950',
                        cellBg: 'bg-indigo-50/60',
                        border: 'border-indigo-300',
                      };
                      return (
                        <div
                          key={day}
                          className={`${style.headerBg} ${style.headerText} border-2 ${style.border} rounded-2xl py-2 px-1 text-center font-black uppercase text-xs sm:text-sm tracking-wide shadow-xs flex items-center justify-center`}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rows per Time Interval */}
                <div className="space-y-2">
                  {sortedTimes.map((time, timeIdx) => {
                    const clockColor = CLOCK_COLORS[timeIdx % CLOCK_COLORS.length];

                    // Check if all days in this time slot share the same special event (e.g. "Dzikir Pagi" or "Istirahat")
                    const itemsAtTime = activeDays.map((d) => gridMap[time]?.[d]).filter(Boolean);
                    const firstItem = itemsAtTime[0];
                    const isAllSame =
                      itemsAtTime.length > 1 &&
                      itemsAtTime.every(
                        (it) => it.mataPelajaran.trim().toLowerCase() === firstItem?.mataPelajaran?.trim().toLowerCase()
                      );
                    const firstVisuals = firstItem ? getSubjectVisuals(firstItem.mataPelajaran, firstItem.keterangan, isExam) : null;
                    const isFullSpan = isAllSame && (firstVisuals?.isFullRow || firstVisuals?.isBreak);

                    return (
                      <div key={time} className="flex items-stretch gap-2">
                        {/* Left Time Badge (Clock Icon + Time Interval) */}
                        <div className="w-24 sm:w-32 shrink-0 bg-white border-2 border-slate-200 rounded-2xl p-2 flex flex-col items-center justify-center shadow-xs">
                          {/* Colorful Analog Clock Icon Badge */}
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center mb-1 text-white shadow-2xs font-bold text-xs"
                            style={{ backgroundColor: clockColor }}
                          >
                            <Clock className="w-4 h-4 stroke-[2.5]" />
                          </div>
                          <span className="text-[11px] sm:text-xs font-black text-slate-800 tracking-tight text-center leading-tight">
                            {time}
                          </span>
                        </div>

                        {/* Content: Either Full Span (Break/Dzikir/Walas) OR Grid of Days */}
                        {isFullSpan && firstItem ? (
                          <div
                            className={`flex-1 rounded-2xl p-3 border-2 flex flex-col sm:flex-row items-center justify-center gap-2 text-center shadow-xs transition-transform hover:scale-[1.005] ${
                              firstVisuals?.isBreak
                                ? 'bg-[#fef08a] border-amber-300 text-amber-950 font-black'
                                : 'bg-[#e0e7ff] border-indigo-200 text-indigo-950 font-bold'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {firstVisuals?.stickers?.map((stk, sIdx) => (
                                <span key={sIdx} className="text-xl sm:text-2xl filter drop-shadow-2xs">
                                  {stk}
                                </span>
                              ))}
                            </div>
                            <span className="text-xs sm:text-sm font-black uppercase tracking-wider">
                              {firstItem.mataPelajaran}
                            </span>
                            {firstItem.keterangan && (
                              <span className="text-[11px] font-semibold text-slate-600 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200">
                                ({firstItem.keterangan})
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              {firstVisuals?.stickers?.map((stk, sIdx) => (
                                <span key={`tail-${sIdx}`} className="text-xl sm:text-2xl filter drop-shadow-2xs">
                                  {stk}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          /* Standard Grid per Day */
                          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                            {activeDays.map((day) => {
                              const item = gridMap[time]?.[day];
                              const dayStyle = DAY_STYLES[day] || {
                                headerBg: 'bg-slate-200',
                                cellBg: 'bg-slate-50',
                                border: 'border-slate-200',
                              };

                              if (!item) {
                                return (
                                  <div
                                    key={day}
                                    className={`${dayStyle.cellBg} rounded-2xl border ${dayStyle.border} p-2 flex items-center justify-center opacity-40 min-h-[76px]`}
                                  >
                                    <span className="text-xs text-slate-400 font-bold">-</span>
                                  </div>
                                );
                              }

                              const visuals = getSubjectVisuals(item.mataPelajaran, item.keterangan, isExam);

                              return (
                                <div
                                  key={day}
                                  onClick={() => !readOnly && onEditItem && onEditItem(item)}
                                  className={`${dayStyle.cellBg} rounded-2xl border-2 ${dayStyle.border} p-2.5 flex flex-col justify-between items-center text-center shadow-xs transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer min-h-[88px] relative group overflow-hidden`}
                                >
                                  {/* Subject Title */}
                                  <div className="w-full">
                                    <h4
                                      className={`text-xs sm:text-[13px] font-black leading-tight line-clamp-2 ${visuals.accentColor}`}
                                      style={{
                                        fontFamily: `'Nunito', 'Segoe UI', sans-serif`,
                                      }}
                                    >
                                      {item.mataPelajaran}
                                    </h4>

                                    {/* If exam: show room or supervisor badge */}
                                    {isExam && (
                                      <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                                        {item.ruangan && (
                                          <span className="text-[9px] font-bold bg-white/90 text-purple-800 px-1.5 py-0.2 rounded-md border border-purple-200">
                                            {item.ruangan}
                                          </span>
                                        )}
                                        {item.pengajar && (
                                          <span className="text-[9px] font-medium text-slate-600 truncate max-w-full">
                                            {item.pengajar}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Cute Thematic Stickers */}
                                  <div className="flex items-center justify-center gap-1 mt-1.5 flex-wrap">
                                    {visuals.mathBadge && (
                                      <span className="text-[11px] font-black text-rose-600 bg-white px-1 rounded shadow-2xs">
                                        {visuals.mathBadge}
                                      </span>
                                    )}
                                    {visuals.subtextBadge && (
                                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1 rounded">
                                        {visuals.subtextBadge}
                                      </span>
                                    )}
                                    {visuals.stickers.map((stk, sIdx) => (
                                      <span
                                        key={sIdx}
                                        className="text-lg sm:text-xl filter drop-shadow-2xs transform transition-transform group-hover:scale-110"
                                      >
                                        {stk}
                                      </span>
                                    ))}
                                  </div>

                                  {/* Teacher Name (Small footer) */}
                                  {!isExam && item.pengajar && (
                                    <span className="text-[9px] text-slate-500 font-medium truncate w-full mt-1 opacity-80">
                                      {item.pengajar}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Poster Footer Note / Motivational Quote */}
              <div className="mt-4 pt-3 border-t border-sky-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-medium px-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <span>✨ Semangat Belajar & Meraih Prestasi Terbaik!</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span>Diterbitkan resmi oleh {schoolName}</span>
                </div>
              </div>
            </div>
          )}
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
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              <img
                src={customImageUrl}
                alt={`Poster Jadwal ${classId}`}
                className="max-w-full h-auto rounded-2xl shadow-md object-contain max-h-[75vh]"
              />
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <a
                href={customImageUrl}
                target="_blank"
                rel="noreferrer"
                download={`Poster_Jadwal_${classId}.png`}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Buka / Unduh Gambar Penuh</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
