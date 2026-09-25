import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Menghitung nilai skala 0-100 dari skor yang didapat berdasarkan skor maksimal
 */
export function normalizeScore(score: number, maxScore: number = 100): number {
  if (!maxScore || maxScore <= 0) return Math.round(score);
  const normalized = (score / maxScore) * 100;
  return Math.min(100, Math.max(0, Math.round(normalized)));
}

/**
 * Menghitung rata-rata nilai tugas baik dari string[], string tunggal, atau number
 */
export function calculateAverageTugas(tugas: string[] | string | number | undefined | null): number | null {
  if (tugas === undefined || tugas === null) return null;
  
  if (Array.isArray(tugas)) {
    const validScores = tugas
      .map(t => parseFloat(String(t).trim()))
      .filter(n => !isNaN(n) && n >= 0);
    if (validScores.length === 0) return null;
    const sum = validScores.reduce((acc, curr) => acc + curr, 0);
    return Math.round((sum / validScores.length) * 10) / 10;
  }
  
  const num = parseFloat(String(tugas).trim());
  return isNaN(num) ? null : num;
}

/**
 * Format tampilan nilai tugas untuk tabel rapot dan cetak PDF
 */
export function formatTugasDisplay(tugas: string[] | string | number | undefined | null): string {
  if (tugas === undefined || tugas === null) return '-';
  if (Array.isArray(tugas)) {
    const valid = tugas.filter(t => String(t).trim() !== '');
    if (valid.length === 0) return '-';
    if (valid.length === 1) return valid[0];
    const avg = calculateAverageTugas(tugas);
    return `${avg !== null ? avg : valid[0]} (${valid.length} tugas)`;
  }
  return String(tugas).trim() || '-';
}

/**
 * Sinkronisasi otomatis nilai tugas siswa ke dokumen `grades/{studentId}` pada field `gradesBySubject[subject].tugas`
 * Dipanggil secara otomatis ketika:
 * 1. Guru memberikan nilai dan catatan feedback pada lembar tugas siswa (Assignments.tsx)
 * 2. Siswa / santri menyelesaikan kuis online dan mendapatkan skor otomatis (OnlineQuizTakerModal.tsx)
 */
export async function syncAssignmentGradeToRapot(params: {
  studentId: string;
  studentName?: string;
  classId?: string;
  subject: string;
  score: number;
  maxScore?: number;
  assignmentId?: string;
  assignmentTitle?: string;
}): Promise<{ success: boolean; newScore: number; error?: string }> {
  const { studentId, subject, score, maxScore = 100, classId, studentName } = params;

  if (!studentId || !subject) {
    return { success: false, newScore: score, error: 'studentId atau subject tidak valid' };
  }

  const normalizedScore = normalizeScore(score, maxScore);

  try {
    const gradeDocRef = doc(db, 'grades', studentId);
    const gradeSnap = await getDoc(gradeDocRef);

    let existingData: any = {};
    if (gradeSnap.exists()) {
      existingData = gradeSnap.data() || {};
    }

    const gradesBySubject = existingData.gradesBySubject || {};
    const currentSubjectGrade = gradesBySubject[subject] || {
      tugas: [],
      pts: '',
      pas: ''
    };

    // Pastikan array tugas dalam bentuk string[]
    let tugasList: string[] = [];
    if (Array.isArray(currentSubjectGrade.tugas)) {
      tugasList = [...currentSubjectGrade.tugas.map((t: any) => String(t).trim()).filter(Boolean)];
    } else if (currentSubjectGrade.tugas && String(currentSubjectGrade.tugas).trim() !== '') {
      tugasList = [String(currentSubjectGrade.tugas).trim()];
    }

    // Tambahkan atau perbarui nilai tugas yang baru masuk
    // Jika belum ada nilai sama sekali, masukkan nilai tugas baru
    tugasList.push(String(normalizedScore));

    const updatedSubjectGrade = {
      ...currentSubjectGrade,
      tugas: tugasList,
      pts: currentSubjectGrade.pts || '',
      pas: currentSubjectGrade.pas || ''
    };

    const updatedGradesBySubject = {
      ...gradesBySubject,
      [subject]: updatedSubjectGrade
    };

    await setDoc(
      gradeDocRef,
      {
        studentId,
        studentName: studentName || existingData.studentName || '',
        classId: classId || existingData.classId || '',
        gradesBySubject: updatedGradesBySubject,
        academicYearId: existingData.academicYearId || 'active',
        lastUpdatedFromAssignment: serverTimestamp(),
        lastUpdatedSubject: subject
      },
      { merge: true }
    );

    return { success: true, newScore: normalizedScore };
  } catch (err: any) {
    console.warn('[Sync Grade to Rapot Error]:', err);
    return { success: false, newScore: normalizedScore, error: err.message || 'Gagal menyinkronkan ke rapot' };
  }
}

/**
 * Sinkronisasi massal seluruh nilai tugas terkirim untuk satu kelas ke rapot
 * Berguna ketika guru ingin memastikan semua nilai tugas di sistem masuk ke rapot
 */
export async function syncAllClassAssignmentGrades(classId: string): Promise<{
  success: boolean;
  syncedStudentsCount: number;
  totalSubmissionsSynced: number;
  error?: string;
}> {
  try {
    // 1. Ambil seluruh tugas di kelas tersebut
    const qAssignments = query(collection(db, 'tugas'), where('classId', '==', classId));
    const snapAssignments = await getDocs(qAssignments);
    const assignmentMap: Record<string, { subject: string; maxScore: number; title: string }> = {};
    
    snapAssignments.forEach(d => {
      const data = d.data();
      assignmentMap[d.id] = {
        subject: data.subject || 'Umum',
        maxScore: data.maxScore || 100,
        title: data.title || ''
      };
    });

    // 2. Ambil seluruh pengumpulan tugas di kelas yang berstatus 'graded' atau memiliki score
    const qSubmissions = query(
      collection(db, 'pengumpulan_tugas'),
      where('classId', '==', classId)
    );
    const snapSubmissions = await getDocs(qSubmissions);

    // Kumpulkan per siswa dan per mapel: scores array
    // studentId -> { [subject]: number[] }
    const studentGradesMap: Record<string, { name: string; subjects: Record<string, number[]> }> = {};
    let totalGradedSubmissions = 0;

    snapSubmissions.forEach(docSnap => {
      const sub = docSnap.data();
      if (sub.score !== undefined && sub.score !== null && sub.studentId) {
        const asgInfo = assignmentMap[sub.assignmentId];
        const subject = asgInfo?.subject || 'Umum';
        const maxScore = asgInfo?.maxScore || 100;
        const normScore = normalizeScore(Number(sub.score), maxScore);

        if (!studentGradesMap[sub.studentId]) {
          studentGradesMap[sub.studentId] = {
            name: sub.studentName || '',
            subjects: {}
          };
        }

        if (!studentGradesMap[sub.studentId].subjects[subject]) {
          studentGradesMap[sub.studentId].subjects[subject] = [];
        }

        studentGradesMap[sub.studentId].subjects[subject].push(normScore);
        totalGradedSubmissions++;
      }
    });

    // 3. Simpan ke masing-masing dokumen `grades/{studentId}`
    let syncedStudentsCount = 0;
    for (const [studentId, info] of Object.entries(studentGradesMap)) {
      const gradeDocRef = doc(db, 'grades', studentId);
      const gradeSnap = await getDoc(gradeDocRef);

      const existingData = gradeSnap.exists() ? gradeSnap.data() : {};
      const existingGradesBySubject = existingData.gradesBySubject || {};

      const updatedGradesBySubject = { ...existingGradesBySubject };

      for (const [subject, scores] of Object.entries(info.subjects)) {
        const curSubject = updatedGradesBySubject[subject] || { tugas: [], pts: '', pas: '' };
        // Simpan array string nilai tugas
        updatedGradesBySubject[subject] = {
          ...curSubject,
          tugas: scores.map(s => String(s)),
          pts: curSubject.pts || '',
          pas: curSubject.pas || ''
        };
      }

      await setDoc(
        gradeDocRef,
        {
          studentId,
          classId,
          gradesBySubject: updatedGradesBySubject,
          academicYearId: existingData.academicYearId || 'active',
          lastSyncedAllAssignmentsAt: serverTimestamp()
        },
        { merge: true }
      );

      syncedStudentsCount++;
    }

    return {
      success: true,
      syncedStudentsCount,
      totalSubmissionsSynced: totalGradedSubmissions
    };
  } catch (err: any) {
    console.error('syncAllClassAssignmentGrades error:', err);
    return {
      success: false,
      syncedStudentsCount: 0,
      totalSubmissionsSynced: 0,
      error: err.message || 'Gagal sinkronisasi nilai tugas'
    };
  }
}
