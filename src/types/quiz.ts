// Question & Quiz Data Structure for Online Assignments
export type QuestionType = 'multiple_choice' | 'essay';

export interface QuizOption {
  id: string; // 'A', 'B', 'C', 'D'
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  points: number; // Bobot nilai soal (misal 10 poin per soal)
  options?: QuizOption[]; // Pilihan ganda: A, B, C, D
  correctAnswer?: string; // Kunci jawaban: 'A', 'B', 'C', atau 'D' (untuk pilihan ganda) / kata kunci jawaban esai
  explanation?: string; // Pembahasan atau keterangan kunci
}

export interface StudentAnswer {
  questionId: string;
  answerText: string; // 'A', 'B', dsb untuk PG, atau kalimat teks untuk esai
  isCorrect?: boolean;
  scoreEarned?: number;
  maxPoints?: number;
}

export interface QuizEvaluationResult {
  totalScore: number;
  maxScore: number;
  totalQuestions: number;
  mcqCorrectCount: number;
  mcqTotalCount: number;
  essayCount: number;
  studentAnswers: StudentAnswer[];
  feedbackSummary: string;
}

/**
 * Mengoreksi dan menghitung nilai otomatis pengerjaan kuis siswa
 */
export function calculateQuizScore(
  questions: QuizQuestion[],
  answers: Record<string, string>,
  targetMaxScore: number = 100
): QuizEvaluationResult {
  let earnedRawPoints = 0;
  let totalRawPoints = 0;
  let mcqCorrect = 0;
  let mcqTotal = 0;
  let essayTotal = 0;

  const evaluatedAnswers: StudentAnswer[] = [];

  questions.forEach((q) => {
    const rawPoints = Number(q.points) > 0 ? Number(q.points) : 10;
    totalRawPoints += rawPoints;

    const studentAns = (answers[q.id] || '').trim();

    if (q.type === 'multiple_choice') {
      mcqTotal++;
      const isRight =
        !!studentAns &&
        !!q.correctAnswer &&
        studentAns.toUpperCase() === q.correctAnswer.trim().toUpperCase();

      if (isRight) {
        mcqCorrect++;
        earnedRawPoints += rawPoints;
      }

      evaluatedAnswers.push({
        questionId: q.id,
        answerText: studentAns,
        isCorrect: isRight,
        scoreEarned: isRight ? rawPoints : 0,
        maxPoints: rawPoints
      });
    } else {
      // Essay question
      essayTotal++;
      let earned = 0;
      let isCorrect = false;

      if (studentAns.length > 0) {
        // Jika ada kunci jawaban esai atau kata kunci
        if (q.correctAnswer && q.correctAnswer.trim().length > 0) {
          const keywords = q.correctAnswer
            .toLowerCase()
            .split(/[,;\n]+/)
            .map((k) => k.trim())
            .filter((k) => k.length > 1);

          if (keywords.length > 0) {
            const studentLower = studentAns.toLowerCase();
            const matchedCount = keywords.filter((k) => studentLower.includes(k)).length;
            const matchRatio = matchedCount / keywords.length;

            if (matchRatio >= 0.7) {
              earned = rawPoints;
              isCorrect = true;
            } else if (matchRatio >= 0.35) {
              earned = Math.round(rawPoints * 0.7);
              isCorrect = true;
            } else {
              earned = Math.max(1, Math.round(rawPoints * 0.4)); // Poin usaha penulisan jawaban
              isCorrect = false;
            }
          } else {
            // Berikan nilai proporsional atas kelengkapan jawaban
            earned = studentAns.length > 20 ? rawPoints : Math.round(rawPoints * 0.6);
            isCorrect = true;
          }
        } else {
          // Jawaban esai tanpa kunci spesifik: beri nilai penuh untuk dikonfirmasi guru
          earned = rawPoints;
          isCorrect = true;
        }
      }

      earnedRawPoints += earned;

      evaluatedAnswers.push({
        questionId: q.id,
        answerText: studentAns,
        isCorrect,
        scoreEarned: earned,
        maxPoints: rawPoints
      });
    }
  });

  // Skala ke targetMaxScore (misal 100)
  const calculatedScore =
    totalRawPoints > 0
      ? Math.min(targetMaxScore, Math.round((earnedRawPoints / totalRawPoints) * targetMaxScore))
      : 0;

  const feedbackSummary =
    mcqTotal > 0 && essayTotal > 0
      ? `Hasil Otomatis: ${mcqCorrect}/${mcqTotal} Soal Pilihan Ganda Benar. ${essayTotal} Soal Esai terjawab dan terakumulasi.`
      : mcqTotal > 0
      ? `Hasil Otomatis: ${mcqCorrect} dari ${mcqTotal} Soal Pilihan Ganda dijawab dengan benar.`
      : `Hasil Otomatis: ${essayTotal} Soal Esai telah dikerjakan dan tersimpan.`;

  return {
    totalScore: calculatedScore,
    maxScore: targetMaxScore,
    totalQuestions: questions.length,
    mcqCorrectCount: mcqCorrect,
    mcqTotalCount: mcqTotal,
    essayCount: essayTotal,
    studentAnswers: evaluatedAnswers,
    feedbackSummary
  };
}

/**
 * Mengimpor soal cepat dari format teks / bank soal
 * Mendukung format:
 * 1. Soal ...
 * A. Pilihan A
 * B. Pilihan B
 * C. Pilihan C
 * D. Pilihan D
 * Kunci: C
 * Poin: 10
 * Pembahasan: ...
 *
 * Atau format Esai:
 * 1. [Esai] Jelaskan proses ...
 * Kunci: kata kunci 1, kata kunci 2
 * Poin: 20
 */
export function parseImportedQuestions(inputText: string): QuizQuestion[] {
  if (!inputText.trim()) return [];

  // Cek apakah format JSON
  try {
    const parsed = JSON.parse(inputText);
    if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].questionText || parsed[0].question)) {
      return parsed.map((item, idx) => ({
        id: item.id || `q_${Date.now()}_${idx + 1}`,
        type: item.type === 'essay' ? 'essay' : 'multiple_choice',
        questionText: item.questionText || item.question || `Soal ${idx + 1}`,
        points: Number(item.points) || 10,
        options: item.options || [
          { id: 'A', text: item.optionA || 'Pilihan A' },
          { id: 'B', text: item.optionB || 'Pilihan B' },
          { id: 'C', text: item.optionC || 'Pilihan C' },
          { id: 'D', text: item.optionD || 'Pilihan D' }
        ],
        correctAnswer: (item.correctAnswer || item.answerKey || 'A').toString().trim().toUpperCase(),
        explanation: item.explanation || item.pembahasan || ''
      }));
    }
  } catch {}

  // Parse format teks terstruktur
  const questions: QuizQuestion[] = [];
  const blocks = inputText.split(/\n\s*(?=\d+[\.\)]\s+)/g);

  blocks.forEach((block, idx) => {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    // Baris pertama: Nomor & teks soal
    const firstLine = lines[0].replace(/^\d+[\.\)]\s*/, '').trim();
    const isEssay =
      firstLine.toLowerCase().includes('[esai]') ||
      firstLine.toLowerCase().includes('(esai)') ||
      block.toLowerCase().includes('tipe: esai') ||
      block.toLowerCase().includes('type: essay');

    const cleanQuestionText = firstLine
      .replace(/\[esai\]/gi, '')
      .replace(/\(esai\)/gi, '')
      .trim();

    let points = 10;
    let correctAnswer = '';
    let explanation = '';
    const options: QuizOption[] = [];

    // Baca baris-baris berikutnya
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Opsi Pilihan Ganda (A., B., C., D.)
      const optMatch = line.match(/^([A-D])[\.\)]\s*(.+)$/i);
      if (optMatch && !isEssay) {
        options.push({
          id: optMatch[1].toUpperCase(),
          text: optMatch[2].trim()
        });
        continue;
      }

      // Kunci Jawaban
      const keyMatch = line.match(/^(?:Kunci|Jawaban|Kunci Jawaban|Answer)\s*[:=]\s*(.+)$/i);
      if (keyMatch) {
        correctAnswer = keyMatch[1].trim();
        continue;
      }

      // Poin / Bobot
      const pointMatch = line.match(/^(?:Poin|Bobot|Skor|Score|Points)\s*[:=]\s*(\d+)$/i);
      if (pointMatch) {
        points = parseInt(pointMatch[1], 10) || 10;
        continue;
      }

      // Pembahasan
      const expMatch = line.match(/^(?:Pembahasan|Penjelasan|Explanation)\s*[:=]\s*(.+)$/i);
      if (expMatch) {
        explanation = expMatch[1].trim();
        continue;
      }
    }

    if (isEssay || options.length < 2) {
      questions.push({
        id: `q_${Date.now()}_${idx + 1}`,
        type: 'essay',
        questionText: cleanQuestionText || firstLine,
        points: points || 20,
        correctAnswer: correctAnswer || '',
        explanation
      });
    } else {
      questions.push({
        id: `q_${Date.now()}_${idx + 1}`,
        type: 'multiple_choice',
        questionText: cleanQuestionText || firstLine,
        points: points || 10,
        options,
        correctAnswer: (correctAnswer || 'A').toUpperCase().slice(0, 1),
        explanation
      });
    }
  });

  return questions;
}

// ----------------------------------------------------
// Draft Storage Helpers (Local Auto-Save)
// ----------------------------------------------------

export function getQuizDraftStorageKey(assignmentId: string, studentId: string): string {
  return `cerdas_quiz_draft_${assignmentId}_${studentId}`;
}

export function saveQuizDraft(
  assignmentId: string,
  studentId: string,
  answers: Record<string, string>
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getQuizDraftStorageKey(assignmentId, studentId);
    localStorage.setItem(
      key,
      JSON.stringify({
        answers,
        updatedAt: Date.now()
      })
    );
  } catch (err) {
    console.warn('saveQuizDraft error:', err);
  }
}

export function getQuizDraft(
  assignmentId: string,
  studentId: string
): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getQuizDraftStorageKey(assignmentId, studentId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.answers || null;
  } catch {
    return null;
  }
}

export function clearQuizDraft(assignmentId: string, studentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getQuizDraftStorageKey(assignmentId, studentId);
    localStorage.removeItem(key);
  } catch {}
}
