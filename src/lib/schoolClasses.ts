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
  'Kelas 1 C',
  'Kelas 1',
  'Kelas 2 A',
  'Kelas 2 B',
  'Kelas 2 C',
  'Kelas 2',
  'Kelas 3 A',
  'Kelas 3 B',
  'Kelas 3 C',
  'Kelas 3',
  'Kelas 4 A',
  'Kelas 4 B',
  'Kelas 4 C',
  'Kelas 4',
  'Kelas 5 A',
  'Kelas 5 B',
  'Kelas 5 C',
  'Kelas 5',
  'Kelas 6 A',
  'Kelas 6 B',
  'Kelas 6 C',
  'Kelas 6'
];

// Daftar kelas lengkap MTs / SMP
export const MTS_CLASSES_DETAILED = [
  'Kelas 7 A',
  'Kelas 7 B',
  'Kelas 7 C',
  'Kelas 7 MTs A',
  'Kelas 7 MTs B',
  'Kelas 7 MTs',
  'Kelas 7',
  'Kelas 8 A',
  'Kelas 8 B',
  'Kelas 8 C',
  'Kelas 8 MTs A',
  'Kelas 8 MTs B',
  'Kelas 8 MTs',
  'Kelas 8',
  'Kelas 9 A',
  'Kelas 9 B',
  'Kelas 9 C',
  'Kelas 9 MTs A',
  'Kelas 9 MTs B',
  'Kelas 9 MTs',
  'Kelas 9'
];

// Pilihan representatif yang rapi untuk dropdown dan formulir
export const POPULAR_CLASSES = [
  'Kelas 1 A',
  'Kelas 1 B',
  'Kelas 1 C',
  'Kelas 2 A',
  'Kelas 2 B',
  'Kelas 2 C',
  'Kelas 3 A',
  'Kelas 3 B',
  'Kelas 3 C',
  'Kelas 4 A',
  'Kelas 4 B',
  'Kelas 4 C',
  'Kelas 5 A',
  'Kelas 5 B',
  'Kelas 5 C',
  'Kelas 6 A',
  'Kelas 6 B',
  'Kelas 6 C',
  'Kelas 7 A',
  'Kelas 7 B',
  'Kelas 7 MTs A',
  'Kelas 7 MTs B',
  'Kelas 8 A',
  'Kelas 8 B',
  'Kelas 8 MTs A',
  'Kelas 8 MTs B',
  'Kelas 9 A',
  'Kelas 9 B',
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
 * Contoh: "1 a" -> "Kelas 1 A", "7 mts" -> "Kelas 7 MTs", "9B" -> "Kelas 9 B", "VII A" -> "Kelas 7 MTs A"
 */
export function normalizeClassName(raw?: string): string {
  if (!raw || typeof raw !== 'string') return 'Kelas 1 A';
  let clean = raw.trim();
  if (!clean) return 'Kelas 1 A';

  // Hapus prefiks umum seperti "data ", "sheet ", "daftar siswa ", kurung buka/tutup
  clean = clean.replace(/^(?:data|sheet|daftar\s*(?:siswa)?|kelas\s*siswa)\s*[:\-_]?\s*/i, '').trim();
  clean = clean.replace(/^[\(\[]|[\)\]]$/g, '').trim();

  // Konversi Angka Romawi (I, II, III, IV, V, VI, VII, VIII, IX)
  const romanMap: Record<string, string> = {
    'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5', 'vi': '6',
    'vii': '7', 'viii': '8', 'ix': '9'
  };
  const romanMatch = clean.match(/^(?:kelas\s*)?(vii|viii|ix|vi|iv|v|iii|ii|i)\s*(?:mts|smp)?\s*([a-z])?$/i);
  if (romanMatch) {
    const numStr = romanMap[romanMatch[1].toLowerCase()];
    const sub = romanMatch[2] ? romanMatch[2].toUpperCase() : '';
    const numInt = parseInt(numStr, 10);
    if (numInt >= 7 && numInt <= 9) {
      return sub ? `Kelas ${numInt} MTs ${sub}` : `Kelas ${numInt} MTs`;
    }
    return sub ? `Kelas ${numInt} ${sub}` : `Kelas ${numInt}`;
  }

  // Jika sudah dimulai dengan kata 'kelas' (contoh: "Kelas 1 A", "Kelas 1A", "Kelas 1-A", "Kelas 7 MTs A")
  const matchWithKelas = clean.match(/^kelas\s*([0-9]{1,2})\s*[\-_]?\s*(?:mts|smp)?\s*([a-z])?$/i);
  if (matchWithKelas) {
    const num = parseInt(matchWithKelas[1], 10);
    const sub = matchWithKelas[2] ? matchWithKelas[2].toUpperCase() : '';
    if (num >= 7 && num <= 9) {
      return sub ? `Kelas ${num} MTs ${sub}` : `Kelas ${num} MTs`;
    }
    return sub ? `Kelas ${num} ${sub}` : `Kelas ${num}`;
  }

  // Jika berupa angka & huruf (misal: "1 A", "1A", "1-A", "7 MTs A", "9 B", "7mts")
  const matchShort = clean.match(/^([0-9]{1,2})\s*[\-_]?\s*(?:mts|smp)?\s*([a-z])?$/i);
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
 * Dapatkan semua variasi penamaan kelas yang setara/ekuivalen
 * Berguna agar filter Firestore query dapat mencocokkan 'Kelas 7' dan 'Kelas 7 MTs',
 * 'Kelas 7 A' dan 'Kelas 7 MTs A', dsb.
 */
export function getClassVariants(className?: string): string[] {
  if (!className || typeof className !== 'string') return [];
  const clean = className.trim();
  if (!clean || clean === 'Semua Kelas') return [];

  const variants = new Set<string>();
  variants.add(clean);

  // Jika format MTs (7, 8, 9)
  const mtsMatch = clean.match(/^(?:kelas\s*)?([789]|vii|viii|ix)\s*[\-_]?\s*(?:mts|smp)?\s*([a-z])?$/i);
  if (mtsMatch) {
    const romanMap: Record<string, string> = { 'vii': '7', 'viii': '8', 'ix': '9' };
    const num = romanMap[mtsMatch[1].toLowerCase()] || mtsMatch[1];
    const sub = (mtsMatch[2] || '').toUpperCase();

    if (sub) {
      variants.add(`Kelas ${num} MTs ${sub}`);
      variants.add(`Kelas ${num} ${sub}`);
      variants.add(`${num} MTs ${sub}`);
      variants.add(`${num} ${sub}`);
    } else {
      variants.add(`Kelas ${num} MTs`);
      variants.add(`Kelas ${num}`);
      variants.add(`${num} MTs`);
      variants.add(`${num}`);
    }
  }

  // Jika format SD (1-6)
  const sdMatch = clean.match(/^(?:kelas\s*)?([1-6]|vi|iv|v|iii|ii|i)\s*[\-_]?\s*([a-z])?$/i);
  if (sdMatch) {
    const romanMap: Record<string, string> = { 'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5', 'vi': '6' };
    const num = romanMap[sdMatch[1].toLowerCase()] || sdMatch[1];
    const sub = (sdMatch[2] || '').toUpperCase();
    if (sub) {
      variants.add(`Kelas ${num} ${sub}`);
      variants.add(`${num} ${sub}`);
    } else {
      variants.add(`Kelas ${num}`);
      variants.add(`${num}`);
    }
  }

  return Array.from(variants);
}

/**
 * Periksa apakah dua string kelas merujuk pada kelas yang sama (mencakup varian MTs)
 */
export function isClassMatch(classA?: string, classB?: string): boolean {
  if (!classA || !classB) return false;
  if (classA.trim().toLowerCase() === classB.trim().toLowerCase()) return true;
  const variantsA = getClassVariants(classA);
  const variantsB = getClassVariants(classB);
  return variantsA.some(v => variantsB.includes(v));
}

/**
 * Cek apakah kelas siswa cocok dengan target kelas pengumuman/pemberitahuan
 * Mendukung multiple class, array, maupun string 'Semua Kelas'
 * - Jika target adalah 'Semua Kelas', 'Semua', 'Umum' -> Semua kelas cocok
 * - Jika target adalah kelas tertentu (misal 'Kelas 3 A') -> HANYA kelas sasaran tersebut yang cocok
 * - Jika studentClass kosong dan target spesifik -> TIDAK cocok (mencegah salah sasaran)
 */
export function isClassTargetMatching(
  targetClasses: string | string[] | undefined,
  studentClass: string | undefined
): boolean {
  if (!targetClasses) return true;

  // Helper untuk membersihkan & menstandarkan nama kelas (contoh: "kelas 1a" -> "1-a", "kelas 1" -> "1")
  const normalize = (c: string): { grade: string; section: string; raw: string } => {
    const raw = c.trim().toLowerCase();
    const clean = raw.replace(/^kelas\s*/i, '').trim();
    const match = clean.match(/^(\d+)(?:\s*([a-zA-Z]))?$/);
    if (match) {
      return {
        grade: match[1],
        section: (match[2] || '').toLowerCase(),
        raw
      };
    }
    return { grade: clean, section: '', raw };
  };

  const isAllTarget = (str: string) => {
    const s = str.trim().toLowerCase();
    return s === '' || s === 'semua' || s === 'semua kelas' || s === 'umum' || s === 'all';
  };

  // 1. Jika targetClasses berupa array
  if (Array.isArray(targetClasses)) {
    if (targetClasses.length === 0 || targetClasses.some(isAllTarget)) return true;
    if (!studentClass || !studentClass.trim()) return false;

    const currentNorm = normalize(studentClass);
    return targetClasses.some((tc) => {
      if (isAllTarget(tc)) return true;
      const targetNorm = normalize(tc);

      // Jika target menentukan seksi tertentu (misal Kelas 1 A)
      if (targetNorm.section) {
        return (
          targetNorm.grade === currentNorm.grade &&
          targetNorm.section === currentNorm.section
        );
      }

      // Jika target menentukan tingkat kelas secara umum (misal Kelas 1 tanpa A/B)
      return targetNorm.grade === currentNorm.grade;
    });
  }

  // 2. Jika targetClasses berupa string tunggal atau daftar dipisah koma
  const str = targetClasses.trim();
  if (isAllTarget(str)) return true;
  if (!studentClass || !studentClass.trim()) return false;

  const parts = str.split(',').map((p) => p.trim());
  if (parts.some(isAllTarget)) return true;

  const currentNorm = normalize(studentClass);
  return parts.some((p) => {
    if (isAllTarget(p)) return true;
    const targetNorm = normalize(p);

    if (targetNorm.section) {
      return (
        targetNorm.grade === currentNorm.grade &&
        targetNorm.section === currentNorm.section
      );
    }

    return targetNorm.grade === currentNorm.grade;
  });
}

