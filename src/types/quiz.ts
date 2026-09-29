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
  if (!inputText || !inputText.trim()) return [];

  // Cek apakah format JSON murni
  try {
    const parsed = JSON.parse(inputText);
    if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].questionText || parsed[0].question)) {
      return parsed.map((item, idx) => ({
        id: item.id || `q_${Date.now()}_${idx + 1}`,
        type: item.type === 'essay' ? 'essay' : 'multiple_choice',
        questionText: item.questionText || item.question || `Soal ${idx + 1}`,
        points: Number(item.points) || (item.type === 'essay' ? 20 : 10),
        options: item.options || (item.type === 'essay' ? undefined : [
          { id: 'A', text: item.optionA || 'Pilihan A' },
          { id: 'B', text: item.optionB || 'Pilihan B' },
          { id: 'C', text: item.optionC || 'Pilihan C' },
          { id: 'D', text: item.optionD || 'Pilihan D' }
        ]),
        correctAnswer: (item.correctAnswer || item.answerKey || (item.type === 'essay' ? '' : 'A')).toString().trim().toUpperCase(),
        explanation: item.explanation || item.pembahasan || ''
      }));
    }
  } catch {}

  // 1. Standalone Answer Key Table di akhir teks (jika berbentuk tabel/daftar 3+ butir dengan nomor dan kunci di akhir)
  const answerKeyMap = new Map<number, string>();
  const bottomKeyMatch = inputText.match(/(?:^|\n)\s*(?:TABEL\s+)?(?:KUNCI\s+JAWABAN|ANSWER\s+KEY)[:\s\n]+([\s\S]+?)$/i);
  let cleanText = inputText;
  if (bottomKeyMatch && bottomKeyMatch[1]) {
    const keyPairs = [...bottomKeyMatch[1].matchAll(/(\d+)[\.\):\s]+([A-Ea-e])/g)];
    if (keyPairs.length >= 3) {
      for (const kp of keyPairs) {
        answerKeyMap.set(parseInt(kp[1], 10), kp[2].toUpperCase());
      }
      cleanText = inputText.slice(0, bottomKeyMatch.index);
    }
  }

  // Pisahkan teks per baris dan bersihkan watermark/nomor halaman/kop
  const rawLines = cleanText.split(/\r?\n/).map(l => l.trim());
  const lines: string[] = [];

  for (const line of rawLines) {
    if (!line) continue;
    if (/^--\s*\d+\s+(?:of|\/)\s+\d+\s*--$/i.test(line)) continue;
    if (/^(?:halaman|page|hal\.?)\s*\d+(?:\s*(?:dari|of|\/)\s*\d+)?$/i.test(line)) continue;
    if (/^[-=_*~]{3,}$/.test(line)) continue;
    lines.push(line);
  }

  const items: Array<{
    number: number;
    questionText: string;
    options: QuizOption[];
    type: 'multiple_choice' | 'essay';
    correctAnswer: string;
    points: number;
    explanation: string;
    hasAnswer: boolean;
    isComplete: boolean;
  }> = [];

  let current: typeof items[0] | null = null;
  let currentTarget: 'question' | 'option' | 'explanation' | 'after_answer' | 'after_points' = 'question';
  let currentOptionId: string | null = null;

  const qNumRegex = /^(?:(?:soal|nomor|no\.?)\s*)?\(?(\d+)[\.\)\]]\s*(.*)$/i;
  const singleOptRegex = /^(?:\()?([A-Ea-e])[\.\)]\s*(.*)$/;
  const ansRegex = /^(?:kunci(?:\s*jawaban)?|jawaban|answer(?:\s*key)?)\s*[:=]\s*([A-Ea-e]|\S.*)$/i;
  const pointRegex = /^(?:poin|bobot|skor|score|points)\s*[:=]?\s*(\d+)?$/i;
  const expRegex = /^(?:pembahasan|penjelasan|alasan|explanation)\s*[:=]\s*(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Deteksi awal soal baru (misal: "1.", "1)", "No. 1", dll)
    const numMatch = line.match(qNumRegex);
    if (numMatch) {
      const isActuallyNewQ = !current || current.options.length > 0 || current.hasAnswer || current.isComplete;
      if (isActuallyNewQ) {
        if (current) items.push(current);
        const qNum = parseInt(numMatch[1], 10);
        const rawQ = numMatch[2].trim();
        const isEssay = /^(?:\[(?:esai|uraian)\]|\((?:esai|uraian)\)|esai|uraian)/i.test(rawQ) ||
                        /^(?:jelaskan|sebutkan|uraikan|bagaimanakah|mengapa|apa\s+yang\s+dimaksud)/i.test(rawQ);

        current = {
          number: qNum,
          questionText: rawQ.replace(/^(?:\[(?:esai|uraian)\]|\((?:esai|uraian)\))\s*/i, '').trim(),
          options: [],
          type: isEssay ? 'essay' : 'multiple_choice',
          correctAnswer: answerKeyMap.get(qNum) || '',
          points: isEssay ? 20 : 10,
          explanation: '',
          hasAnswer: false,
          isComplete: false
        };
        currentTarget = 'question';
        currentOptionId = null;
        continue;
      }
    }

    if (!current) {
      // Judul/Kop sebelum nomor soal 1 (e.g. 'Penilaian Akhir Semester', 'Mata Pelajaran: ...') - lewati
      continue;
    }

    // Deteksi Kunci Jawaban: 'Kunci: B' atau 'Jawaban: D'
    const ansMatch = line.match(ansRegex);
    if (ansMatch) {
      const val = ansMatch[1].trim();
      if (/^[A-Ea-e]$/.test(val)) {
        current.correctAnswer = val.toUpperCase();
      } else {
        current.correctAnswer = val;
      }
      current.hasAnswer = true;
      currentTarget = 'after_answer';
      continue;
    }

    // Deteksi Poin: 'Poin:' atau 'Poin: 10'
    const ptMatch = line.match(pointRegex);
    if (ptMatch) {
      if (ptMatch[1]) {
        current.points = parseInt(ptMatch[1], 10) || current.points;
      }
      currentTarget = 'after_points';
      continue;
    }

    // Deteksi Pembahasan: 'Pembahasan: ...'
    const expMatch = line.match(expRegex);
    if (expMatch) {
      current.explanation = expMatch[1].trim();
      currentTarget = 'explanation';
      continue;
    }

    // Deteksi Opsi Horisontal dalam 1 baris: 'A. 40   B. 41   C. 56   D. 47'
    const horizOpts = [...line.matchAll(/(?:^|\s+)([A-Ea-e])[\.\)]\s*([^\s][^A-E\n]*?)(?=(?:\s+[A-Ea-e][\.\)]|$))/g)];
    if (horizOpts.length >= 2) {
      for (const m of horizOpts) {
        current.options.push({
          id: m[1].toUpperCase(),
          text: m[2].trim()
        });
      }
      current.type = 'multiple_choice';
      currentTarget = 'after_points';
      continue;
    }

    // Deteksi Opsi Vertikal: 'A. Opsi teks', 'B. Opsi teks'
    const singleOpt = line.match(singleOptRegex);
    if (singleOpt && (current.options.length < 5 || /^[A-Ea-e]$/.test(singleOpt[1]))) {
      const optId = singleOpt[1].toUpperCase();
      const optText = singleOpt[2].trim();
      current.options.push({
        id: optId,
        text: optText
      });
      current.type = 'multiple_choice';
      currentTarget = 'option';
      currentOptionId = optId;
      continue;
    }

    // Penanganan Teks Multi-Baris (Paragraf bacaan, cerita, puisi, dialog, opsi panjang)
    if (currentTarget === 'explanation') {
      current.explanation += ' ' + line;
    } else if (currentTarget === 'option' && currentOptionId) {
      const opt = current.options.find(o => o.id === currentOptionId);
      if (opt) opt.text += ' ' + line;
    } else if (currentTarget === 'question' && current.options.length === 0) {
      current.questionText += ' ' + line;
    }
  }

  if (current) items.push(current);

  return items.map((item, idx) => {
    const isEssay = item.type === 'essay' || item.options.length < 2;
    const finalAnswer = item.correctAnswer || (isEssay ? '' : (item.options[0]?.id || 'A'));
    return {
      id: `q_${Date.now()}_${idx + 1}`,
      type: isEssay ? 'essay' : 'multiple_choice',
      questionText: item.questionText || `Soal ${idx + 1}`,
      points: item.points || (isEssay ? 20 : 10),
      options: isEssay ? undefined : item.options,
      correctAnswer: finalAnswer,
      explanation: item.explanation || (isEssay ? 'Jawaban esai' : `Kunci jawaban: ${finalAnswer}`)
    };
  });
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
