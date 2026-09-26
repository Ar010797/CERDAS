/**
 * Master Daftar Kelas & Utilitas Normalisasi Kelas Sekolah
 * Mendukung jenjang SD/MI (Kelas 1 A - 6 B) dan MTs/SMP (Kelas 7 MTs - 9 MTs B).
 */

export interface ClassOptionGroup {
  groupName: string;
  classes: string[];
}

// Daftar kelas lengkap SD / MI
export const SD_CLASSES_DETAILED = [
  'Kelas 1 A',
  'Kelas 1 B',
  'Kelas 1',
  'Kelas 2 A',
  'Kelas 2 B',
  'Kelas 2',
  'Kelas 3 A',
  'Kelas 3 B',
  'Kelas 3',
  'Kelas 4 A',
  'Kelas 4 B',
  'Kelas 4',
  'Kelas 5 A',
  'Kelas 5 B',
  'Kelas 5',
  'Kelas 6 A',
  'Kelas 6 B',
  'Kelas 6'
];

// Daftar kelas lengkap MTs / SMP
export const MTS_CLASSES_DETAILED = [
  'Kelas 7 MTs A',
  'Kelas 7 MTs B',
  'Kelas 7 A',
  'Kelas 7 B',
  'Kelas 7 MTs',
  'Kelas 7',
  'Kelas 8 MTs A',
  'Kelas 8 MTs B',
  'Kelas 8 A',
  'Kelas 8 B',
  'Kelas 8 MTs',
  'Kelas 8',
  'Kelas 9 MTs A',
  'Kelas 9 MTs B',
  'Kelas 9 A',
  'Kelas 9 B',
  'Kelas 9 MTs',
  'Kelas 9'
];

// Pilihan representatif yang rapi untuk dropdown dan formulir
export const POPULAR_CLASSES = [
  'Kelas 1 A',
  'Kelas 1 B',
  'Kelas 2 A',
  'Kelas 2 B',
  'Kelas 3 A',
  'Kelas 3 B',
  'Kelas 4 A',
  'Kelas 4 B',
  'Kelas 5 A',
  'Kelas 5 B',
  'Kelas 6 A',
  'Kelas 6 B',
  'Kelas 7 MTs A',
  'Kelas 7 MTs B',
  'Kelas 8 MTs A',
  'Kelas 8 MTs B',
  'Kelas 9 MTs A',
  'Kelas 9 MTs B'
];

// Pengelompokan terstruktur untuk <optgroup>
export const CLASS_GROUPS: ClassOptionGroup[] = [
  {
    groupName: 'Tingkat SD / MI (Kelas 1 - 6)',
    classes: [
      'Kelas 1 A',
      'Kelas 1 B',
      'Kelas 1',
      'Kelas 2 A',
      'Kelas 2 B',
      'Kelas 2',
      'Kelas 3 A',
      'Kelas 3 B',
      'Kelas 3',
      'Kelas 4 A',
      'Kelas 4 B',
      'Kelas 4',
      'Kelas 5 A',
      'Kelas 5 B',
      'Kelas 5',
      'Kelas 6 A',
      'Kelas 6 B',
      'Kelas 6'
    ]
  },
  {
    groupName: 'Tingkat MTs / SMP (Kelas 7 - 9)',
    classes: [
      'Kelas 7 MTs A',
      'Kelas 7 MTs B',
      'Kelas 7 A',
      'Kelas 7 B',
      'Kelas 7 MTs',
      'Kelas 7',
      'Kelas 8 MTs A',
      'Kelas 8 MTs B',
      'Kelas 8 A',
      'Kelas 8 B',
      'Kelas 8 MTs',
      'Kelas 8',
      'Kelas 9 MTs A',
      'Kelas 9 MTs B',
      'Kelas 9 A',
      'Kelas 9 B',
      'Kelas 9 MTs',
      'Kelas 9'
    ]
  }
];

export const ALL_AVAILABLE_CLASSES = [
  ...SD_CLASSES_DETAILED,
  ...MTS_CLASSES_DETAILED
];

/**
 * Normalisasi string nama kelas dari input pengguna atau file Excel
 * Contoh: "1 a" -> "Kelas 1 A", "7 mts" -> "Kelas 7 MTs", "9B" -> "Kelas 9 B"
 */
export function normalizeClassName(raw?: string): string {
  if (!raw || typeof raw !== 'string') return 'Kelas 1 A';
  const clean = raw.trim();
  if (!clean) return 'Kelas 1 A';

  // Jika sudah dimulai dengan kata 'kelas'
  const matchWithKelas = clean.match(/^kelas\s*([0-9]{1,2})\s*(?:mts|smp)?\s*([a-z])?$/i);
  if (matchWithKelas) {
    const num = parseInt(matchWithKelas[1], 10);
    const sub = matchWithKelas[2] ? matchWithKelas[2].toUpperCase() : '';
    if (num >= 7 && num <= 9) {
      return sub ? `Kelas ${num} MTs ${sub}` : `Kelas ${num} MTs`;
    }
    return sub ? `Kelas ${num} ${sub}` : `Kelas ${num}`;
  }

  // Jika berupa angka & huruf (misal: "1 A", "1A", "7 MTs A", "9 B", "7mts")
  const matchShort = clean.match(/^([0-9]{1,2})\s*(?:mts|smp)?\s*([a-z])?$/i);
  if (matchShort) {
    const num = parseInt(matchShort[1], 10);
    const sub = matchShort[2] ? matchShort[2].toUpperCase() : '';
    if (num >= 7 && num <= 9) {
      return sub ? `Kelas ${num} MTs ${sub}` : `Kelas ${num} MTs`;
    }
    return sub ? `Kelas ${num} ${sub}` : `Kelas ${num}`;
  }

  // Cek apakah ada di master list
  const found = ALL_AVAILABLE_CLASSES.find(
    (c) => c.toLowerCase() === clean.toLowerCase()
  );
  if (found) return found;

  // Return clean dengan huruf awal kapital jika format custom
  return clean.startsWith('Kelas') ? clean : `Kelas ${clean}`;
}

/**
 * Cek apakah kelas siswa cocok dengan target kelas pengumuman/pemberitahuan
 * Mendukung multiple class, array, maupun string 'Semua Kelas'
 */
export function isClassTargetMatching(
  targetClasses: string | string[] | undefined,
  studentClass: string | undefined
): boolean {
  if (!targetClasses) return true;
  if (!studentClass) return true;

  const currentClassNorm = studentClass.trim().toLowerCase();

  // Jika targetClasses berupa array
  if (Array.isArray(targetClasses)) {
    if (targetClasses.length === 0 || targetClasses.includes('Semua Kelas')) return true;
    return targetClasses.some((tc) => {
      const tcNorm = tc.trim().toLowerCase();
      return (
        tcNorm === 'semua kelas' ||
        tcNorm === currentClassNorm ||
        currentClassNorm.startsWith(tcNorm) ||
        tcNorm.startsWith(currentClassNorm)
      );
    });
  }

  // Jika targetClasses berupa string tunggal atau koma
  const str = targetClasses.trim();
  if (str === 'Semua Kelas' || !str) return true;

  const parts = str.split(',').map((p) => p.trim().toLowerCase());
  if (parts.includes('semua kelas')) return true;

  return parts.some((p) => {
    return (
      p === currentClassNorm ||
      currentClassNorm.startsWith(p) ||
      p.startsWith(currentClassNorm)
    );
  });
}
