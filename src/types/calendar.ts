export type CalendarCategory = 'libur' | 'ujian' | 'kegiatan' | 'rapat' | 'penting';

export interface CalendarEvent {
  id: string;
  title: string;
  category: CalendarCategory;
  startDate: string; // Format: YYYY-MM-DD
  endDate: string;   // Format: YYYY-MM-DD
  description?: string;
  targetClass?: string; // 'Semua Kelas', 'Kelas 1', etc.
  isHoliday?: boolean;
  color?: string;
  time?: string;
  ruangan?: string;
  pengajar?: string;
  source?: 'manual' | 'preset' | 'jadwal_ujian';
  createdBy?: string;
  createdAt?: string;
}

export const CATEGORY_CONFIG: Record<CalendarCategory, {
  label: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  borderColor: string;
  lightBg: string;
  darkBg: string;
  accentColor: string;
  iconName: string;
}> = {
  libur: {
    label: 'Hari Libur',
    badgeBg: 'bg-rose-500',
    badgeText: 'text-white',
    dotColor: 'bg-rose-500',
    borderColor: 'border-rose-200 dark:border-rose-900/60',
    lightBg: 'bg-rose-50/80',
    darkBg: 'dark:bg-rose-950/40',
    accentColor: 'text-rose-600 dark:text-rose-400',
    iconName: 'Palmtree'
  },
  ujian: {
    label: 'Jadwal Ujian',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-white',
    dotColor: 'bg-purple-600',
    borderColor: 'border-purple-200 dark:border-purple-900/60',
    lightBg: 'bg-purple-50/80',
    darkBg: 'dark:bg-purple-950/40',
    accentColor: 'text-purple-600 dark:text-purple-400',
    iconName: 'FileCheck'
  },
  kegiatan: {
    label: 'Kegiatan Sekolah',
    badgeBg: 'bg-sky-500',
    badgeText: 'text-white',
    dotColor: 'bg-sky-500',
    borderColor: 'border-sky-200 dark:border-sky-900/60',
    lightBg: 'bg-sky-50/80',
    darkBg: 'dark:bg-sky-950/40',
    accentColor: 'text-sky-600 dark:text-sky-400',
    iconName: 'Sparkles'
  },
  rapat: {
    label: 'Rapat / Koordinasi',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    dotColor: 'bg-emerald-600',
    borderColor: 'border-emerald-200 dark:border-emerald-900/60',
    lightBg: 'bg-emerald-50/80',
    darkBg: 'dark:bg-emerald-950/40',
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    iconName: 'Users'
  },
  penting: {
    label: 'Penting / Batas Waktu',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-white',
    dotColor: 'bg-amber-500',
    borderColor: 'border-amber-200 dark:border-amber-900/60',
    lightBg: 'bg-amber-50/80',
    darkBg: 'dark:bg-amber-950/40',
    accentColor: 'text-amber-600 dark:text-amber-400',
    iconName: 'AlertCircle'
  }
};

export const DEFAULT_ACADEMIC_EVENTS: Omit<CalendarEvent, 'id'>[] = [
  {
    title: 'HUT Kemerdekaan Republik Indonesia ke-81',
    category: 'libur',
    startDate: '2026-08-17',
    endDate: '2026-08-17',
    description: 'Hari Libur Nasional Peringatan Hari Kemerdekaan RI.',
    targetClass: 'Semua Kelas',
    isHoliday: true,
    source: 'preset'
  },
  {
    title: 'Pelaksanaan Asesmen Nasional (ANBK)',
    category: 'ujian',
    startDate: '2026-08-24',
    endDate: '2026-08-27',
    description: 'Asesmen Nasional Berbasis Komputer untuk siswa terpilih (literasi & numerasi).',
    targetClass: 'Kelas 5',
    isHoliday: false,
    time: '07:30 - 11:30 WIB',
    ruangan: 'Lab Komputer',
    source: 'preset'
  },
  {
    title: 'Maulid Nabi Muhammad SAW 1448 H',
    category: 'libur',
    startDate: '2026-09-16',
    endDate: '2026-09-16',
    description: 'Hari Libur Nasional Maulid Nabi Muhammad SAW.',
    targetClass: 'Semua Kelas',
    isHoliday: true,
    source: 'preset'
  },
  {
    title: 'Penilaian Tengah Semester (PTS) Ganjil',
    category: 'ujian',
    startDate: '2026-09-28',
    endDate: '2026-10-03',
    description: 'Ujian Tengah Semester Ganjil seluruh mata pelajaran pokok.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    time: '07:30 - 11:00 WIB',
    ruangan: 'Ruang Kelas Masing-masing',
    source: 'preset'
  },
  {
    title: 'Rapat Koordinasi & Paguyuban Orang Tua Murid',
    category: 'rapat',
    startDate: '2026-10-17',
    endDate: '2026-10-17',
    description: 'Pertemuan evaluasi hasil belajar siswa tengah semester dan program sekolah.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    time: '08:30 - 11:30 WIB',
    ruangan: 'Aula Utama Sekolah',
    source: 'preset'
  },
  {
    title: 'Peringatan Hari Guru Nasional & Upacara Bendera',
    category: 'kegiatan',
    startDate: '2026-11-25',
    endDate: '2026-11-25',
    description: 'Upacara bendera dan apresiasi siswa serta guru berprestasi.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    time: '07:00 - 09:00 WIB',
    ruangan: 'Lapangan Utama',
    source: 'preset'
  },
  {
    title: 'Penilaian Akhir Semester (PAS) / SAS Ganjil',
    category: 'ujian',
    startDate: '2026-11-30',
    endDate: '2026-12-08',
    description: 'Ujian Akhir Semester Ganjil Tahun Ajaran 2026/2027.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    time: '07:30 - 11:30 WIB',
    source: 'preset'
  },
  {
    title: 'Pekan Class Meeting & Lomba Kreativitas Siswa',
    category: 'kegiatan',
    startDate: '2026-12-09',
    endDate: '2026-12-12',
    description: 'Lomba seni, tahfidz, cerdas cermat, dan olahraga antar kelas.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    source: 'preset'
  },
  {
    title: 'Batas Penginputan Nilai E-Rapor Semester Ganjil',
    category: 'penting',
    startDate: '2026-12-14',
    endDate: '2026-12-15',
    description: 'Seluruh guru kelas & mata pelajaran wajib memfinalkan input nilai rapor.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    source: 'preset'
  },
  {
    title: 'Penyerahan Rapor Hasil Belajar Semester Ganjil',
    category: 'penting',
    startDate: '2026-12-18',
    endDate: '2026-12-18',
    description: 'Pengambilan buku rapor siswa oleh orang tua/wali murid.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    time: '08:00 - 11:30 WIB',
    source: 'preset'
  },
  {
    title: 'Libur Semester Ganjil & Akhir Tahun',
    category: 'libur',
    startDate: '2026-12-21',
    endDate: '2027-01-02',
    description: 'Libur akhir semester ganjil seluruh jenjang kelas.',
    targetClass: 'Semua Kelas',
    isHoliday: true,
    source: 'preset'
  },
  {
    title: 'Hari Raya Natal',
    category: 'libur',
    startDate: '2026-12-25',
    endDate: '2026-12-25',
    description: 'Hari Libur Nasional Hari Raya Natal.',
    targetClass: 'Semua Kelas',
    isHoliday: true,
    source: 'preset'
  },
  {
    title: 'Tahun Baru Masehi 2027',
    category: 'libur',
    startDate: '2027-01-01',
    endDate: '2027-01-01',
    description: 'Hari Libur Nasional Tahun Baru 2027.',
    targetClass: 'Semua Kelas',
    isHoliday: true,
    source: 'preset'
  },
  {
    title: 'Hari Pertama Masuk Sekolah Semester Genap',
    category: 'penting',
    startDate: '2027-01-04',
    endDate: '2027-01-04',
    description: 'Awal kegiatan belajar mengajar (KBM) Semester Genap TP 2026/2027.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    source: 'preset'
  },
  {
    title: 'Penilaian Tengah Semester (PTS) Genap',
    category: 'ujian',
    startDate: '2027-03-08',
    endDate: '2027-03-13',
    description: 'Ujian Tengah Semester Genap.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    source: 'preset'
  },
  {
    title: 'Libur Hari Raya Idul Fitri 1448 H & Cuti Bersama',
    category: 'libur',
    startDate: '2027-03-18',
    endDate: '2027-03-27',
    description: 'Hari Libur Nasional dan cuti bersama Hari Raya Idul Fitri 1448 H.',
    targetClass: 'Semua Kelas',
    isHoliday: true,
    source: 'preset'
  },
  {
    title: 'Penilaian Sumatif Akhir Tahun (PAT / SAS Genap)',
    category: 'ujian',
    startDate: '2027-06-07',
    endDate: '2027-06-15',
    description: 'Penilaian Akhir Tahun penentu kenaikan kelas.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    source: 'preset'
  },
  {
    title: 'Pembagian Rapor Kenaikan Kelas',
    category: 'penting',
    startDate: '2027-06-25',
    endDate: '2027-06-25',
    description: 'Penyerahan buku rapor kenaikan kelas kepada orang tua siswa.',
    targetClass: 'Semua Kelas',
    isHoliday: false,
    source: 'preset'
  },
  {
    title: 'Libur Kenaikan Kelas & Akhir Tahun Ajaran',
    category: 'libur',
    startDate: '2027-06-28',
    endDate: '2027-07-10',
    description: 'Libur panjang akhir tahun ajaran 2026/2027.',
    targetClass: 'Semua Kelas',
    isHoliday: true,
    source: 'preset'
  }
];

// Helper to check if a target date string 'YYYY-MM-DD' falls within startDate and endDate (inclusive)
export function isDateInRange(targetDateStr: string, startDateStr: string, endDateStr: string): boolean {
  return targetDateStr >= startDateStr && targetDateStr <= endDateStr;
}

// Format date to Indonesian human friendly string (e.g., "Senin, 28 September 2026")
export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    const date = new Date(year, month - 1, day);
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${dayNames[date.getDay()]}, ${day} ${monthNames[month - 1]} ${year}`;
  } catch {
    return dateStr;
  }
}
