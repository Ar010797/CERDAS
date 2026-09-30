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
function normalizeArabicNumerals(str: string): string {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

function mapOptionId(idStr: string): string {
  const clean = idStr.trim();
  if (['أ', 'إ', 'ا'].includes(clean)) return 'A';
  if (clean === 'ب') return 'B';
  if (clean === 'ج') return 'C';
  if (clean === 'د') return 'D';
  if (clean === 'ه' || clean === 'هـ') return 'E';
  return clean.toUpperCase();
}

/**
 * Mendeteksi apakah suatu baris teks merupakan judul dokumen, kop sekolah/dinas,
 * informasi ujian (kelas, semester, waktu), atau petunjuk umum/khusus.
 * Baris-baris ini BUKAN butir soal dan dilarang keras diikutkan sebagai soal atau nomor soal.
 */
export function isExamHeaderOrInstruction(line: string): boolean {
  const clean = (line || '').trim();
  if (!clean || clean.length < 2) return true;

  // Watermarks, batas halaman, garis pembatas
  if (/^--\s*\d+\s*(?:of|\/)\s*\d+\s*--$/i.test(clean)) return true;
  if (/^(?:halaman|page|hal\.?)\s*\d+(?:\s*(?:dari|of|\/)\s*\d+)?$/i.test(clean)) return true;
  if (/^[-=_*~—–#]{3,}$/.test(clean)) return true;

  // Kop institusi, sekolah, dinas, kementerian, yayasan
  if (/^(?:pemerintah|pemprov|pemkab|pemkot|dinas|kementerian|kemenag|yayasan|sekolah|madrasah|pesantren|institut|universitas)\b/i.test(clean)) return true;
  if (/^(?:sd|smp|sma|smk|ma|mts|mi)\s+(?:negeri|swasta|\d+|al-|darul|islam|plus)/i.test(clean)) return true;

  // Nama kegiatan ujian / asesmen / evaluasi
  if (/^(?:penilaian|ujian|asesmen|ulangan|evaluasi|try\s*out|mid\s*semester|tes|latihan|soal\s*latihan)\b/i.test(clean)) return true;
  if (/\b(?:pas|pat|pts|sts|sas|asas|asts|usbk|usbn|akm|anbk)\b/i.test(clean) && !/\b(?:adalah|merupakan|karena|mengapa|apa|sebutkan|jelaskan)\b/i.test(clean)) return true;
  if (/^(?:semester|tahun\s*(?:ajaran|pelajaran)|ta\b|tp\b)\s*[:\d]/i.test(clean)) return true;
  if (/^(?:tahun\s*(?:ajaran|pelajaran)\s*\d{4}\s*[\/-]\s*\d{4})/i.test(clean)) return true;

  // Metadata ujian: Mapel, Kelas, Waktu, Hari/Tanggal, Guru, Pengawas
  if (/^(?:mata\s*pelajaran|mapel|bidang\s*studi|kelas|semester|program|jurusan|peminatan|hari\s*[\/,]\s*tanggal|hari|tanggal|waktu|alokasi\s*waktu|durasi|ruang|kode\s*(?:soal|paket)|paket\s*(?:soal|\w+)|naskah\s*soal|lembar\s*soal|nama\s*peserta|no(?:\.|\s)*peserta|nomor\s*peserta|kurikulum)\s*[:=]/i.test(clean)) return true;

  // Judul Bagian Soal (Pilihan Ganda / Uraian)
  if (/^(?:bagian|bab|part|section)\s+[0-9a-zivx]+/i.test(clean)) return true;
  if (/^(?:[a-e]|[ivx]+)[\.\)]\s*(?:pilihan\s*ganda|soal\s*pilihan\s*ganda|multiple\s*choice|uraian|esai|essay|soal\s*uraian|menjodohkan|isian)/i.test(clean)) return true;
  if (/^(?:pilihan\s*ganda|soal\s*pilihan\s*ganda|soal\s*uraian|soal\s*esai|soal\s*menjodohkan)$/i.test(clean)) return true;

  // Petunjuk Umum, Petunjuk Khusus, Instruksi Pengerjaan
  if (/^(?:petunjuk\s*(?:umum|khusus|pengerjaan|soal)?|instruksi|aturan\s*ujian)\s*:?/i.test(clean)) return true;
  if (/^(?:pilihlah|berilah|lingkarilah|silanglah|centanglah|hitamkan)\s+(?:salah\s+satu\s+)?(?:jawaban|huruf|tanda|bulatan)/i.test(clean)) return true;
  if (/^(?:jawablah|kerjakan|bacalah|perhatikan)\s+(?:pertanyaan|soal-soal|dengan\s+teliti|dengan\s+tepat|petunjuk)/i.test(clean)) return true;
  if (/^(?:selamat\s+mengerjakan|semoga\s+sukses|semoga\s+berhasil|good\s+luck|barakallah)/i.test(clean)) return true;

  // Nomor butir instruksi umum (misal: "1. Berdoalah...", "2. Isikan identitas...", "3. Laporkan...")
  if (/^\(?\d+[\.\)]\s*(?:berdoa|isi\b|isikan|tulislah|tulis\b|periksa|bacalah\s+petunjuk|laporkan|dahulukan|hitamkan|silanglah|jangan|dilarang|gunakan|waktu\s+yang|periksalah)/i.test(clean)) return true;

  return false;
}

/**
 * Membersihkan judul/kop yang mungkin menempel di awal pertanyaan soal pertama hasil OCR/Word
 */
export function cleanQuestionTitlePrefix(text: string): string {
  let cleaned = (text || '').trim();
  // Buang awalan nomor soal seperti "1. ", "1) ", "No. 1. ", "Soal 1: ", "١. "
  cleaned = cleaned.replace(/^(?:(?:soal|nomor|no\.?)\s*)?\(?[0-9٠-٩]+[\.\)\]:\-]\s*/iu, '').trim();

  // Jika teks masih diawali kop / judul / petunjuk yang menyatu dengan pertanyaan pertama
  const headerPrefixRegex = /^(?:pemerintah|pemprov|pemkab|pemkot|dinas|kementerian|kemenag|yayasan|smp|sma|smk|sd|mi|mts|penilaian|ujian|asesmen|ulangan|mata\s*pelajaran|mapel|kelas|semester|petunjuk\s*(?:umum|khusus|pengerjaan)|pilihlah\s+salah\s+satu)[\s\S]+?(?=(?:(?:\b\d+[\.\)]\s+)|(?:(?:apakah|apa\s+yang|siapakah|mengapa|bagaimana|bagaimanakah|manakah|sebutkan|jelaskan|berikut\s+ini|di\s+bawah\s+ini|perhatikan|organ\s+|fungsi\s+|hasil\s+dari|hitunglah|pada\s+tahun|tokoh\s+|seorang\s+|sebuah\s+|dalam\s+proses|kandungan\s+|faktor\s+|gerakan\s+|sikap\s+|hukum\s+|bunyi\s+|makna\s+|arti\s+|surah\s+|ayat\s+|bacaan\s+|teks\s+|dialog\s+)\b)))/i;

  if (headerPrefixRegex.test(cleaned)) {
    const afterHeader = cleaned.replace(headerPrefixRegex, '').trim();
    if (afterHeader.length >= 10) {
      cleaned = afterHeader.replace(/^(?:(?:soal|nomor|no\.?)\s*)?\(?[0-9٠-٩]+[\.\)\]:\-]\s*/iu, '').trim();
    }
  }

  return cleaned;
}

/**
 * Universal Intelligent Question Parser.
 * Mendukung format ringkas & praktis tanpa perlu pembahasan (cukup soal, jawaban, poin).
 * Mendukung Bahasa Arab (huruf أ ب ج د & angka Arab), Matematika (+, -, ×, ÷, =, ^, √), dan semua mapel.
 * Otomatis memfilter KOP, judul dokumen, petunjuk umum, dan nomor aturan agar TIDAK masuk ke dalam nomor soal.
 */
export function parseImportedQuestions(inputText: string): QuizQuestion[] {
  if (!inputText || !inputText.trim()) return [];

  // Cek apakah format JSON murni
  try {
    const parsed = JSON.parse(inputText);
    if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].questionText || parsed[0].question || parsed[0].text)) {
      return parsed
        .filter(item => {
          const rawQ = item.questionText || item.question || item.text || '';
          return !isExamHeaderOrInstruction(rawQ);
        })
        .map((item, idx) => {
          const rawQ = item.questionText || item.question || item.text || `Soal ${idx + 1}`;
          const cleanQ = cleanQuestionTitlePrefix(rawQ);
          const isEssay = item.type === 'essay' || item.type === 'Uraian';
          const defaultOpts = [
            { id: 'A', text: item.optionA || 'Pilihan A' },
            { id: 'B', text: item.optionB || 'Pilihan B' },
            { id: 'C', text: item.optionC || 'Pilihan C' },
            { id: 'D', text: item.optionD || 'Pilihan D' }
          ];
          const rawOpts = item.options || (isEssay ? undefined : defaultOpts);
          let cleanOpts: QuizOption[] | undefined = undefined;

          if (Array.isArray(rawOpts) && rawOpts.length > 0) {
            const usedKeys = new Set<string>();
            const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
            cleanOpts = rawOpts.map((opt: any, oIdx: number) => {
              const optText = typeof opt === 'string' ? opt : (opt.text || '');
              let optId = typeof opt === 'object' && opt.id ? opt.id.toUpperCase() : letters[oIdx] || `opt_${oIdx + 1}`;
              if (usedKeys.has(optId)) {
                optId = letters.find(l => !usedKeys.has(l)) || `${optId}_${oIdx + 1}`;
              }
              usedKeys.add(optId);
              return { id: optId, text: optText };
            });
          }

          return {
            id: `q_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
            type: isEssay ? 'essay' : 'multiple_choice',
            questionText: cleanQ || `Soal ${idx + 1}`,
            points: Number(item.points) || (isEssay ? 20 : 10),
            options: isEssay ? undefined : cleanOpts,
            correctAnswer: (item.correctAnswer || item.answerKey || (isEssay ? '' : 'A')).toString().trim().toUpperCase(),
            explanation: item.explanation || item.pembahasan || ''
          };
        });
    }
  } catch {}

  // 1. Standalone Answer Key Table di akhir teks (jika berbentuk tabel/daftar 3+ butir dengan nomor dan kunci di akhir)
  const answerKeyMap = new Map<number, string>();
  const bottomKeyMatch = inputText.match(/(?:^|\n)\s*(?:TABEL\s+)?(?:KUNCI\s+JAWABAN|ANSWER\s+KEY|مفتاح\s+الإجابة)[:\s\n]+([\s\S]+?)$/i);
  let cleanText = inputText;
  if (bottomKeyMatch && bottomKeyMatch[1]) {
    const keyPairs = [...bottomKeyMatch[1].matchAll(/([0-9٠-٩]+)[\.\):\s]+([A-Ea-e]|[أإابجد])/gu)];
    if (keyPairs.length >= 3) {
      for (const kp of keyPairs) {
        const westernNum = parseInt(normalizeArabicNumerals(kp[1]), 10);
        answerKeyMap.set(westernNum, mapOptionId(kp[2]));
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
  let autoQuestionCounter = 1;
  let currentTarget: 'question' | 'option' | 'explanation' | 'after_answer' | 'after_points' = 'question';
  let currentOptionId: string | null = null;

  // Regex penomoran soal (mendukung Latin 1, 2, 3 dan Arab ١, ٢, ٣)
  const qNumRegex = /^(?:(?:soal|nomor|no\.?)\s*)?\(?([0-9٠-٩]+)[\.\)\]]\s*(.*)$/iu;
  // Regex opsi tunggal (A, B, C, D, E atau أ, ب, ج, د, ه)
  const singleOptRegex = /^(?:\()?([A-Ea-e]|[أإابجد])[\.\)\]:\-]?\s+(.*)$/u;
  // Regex kunci jawaban (Indonesia, Inggris, atau Arab)
  const ansRegex = /^(?:kunci(?:\s*jawaban)?|jawaban(?:\s*benar)?|answer(?:\s*key)?|مفتاح|الإجابة|الجواب|حل)\s*[:=]\s*([A-Ea-e]|[أإابجد]|\S.*)$/iu;
  // Regex poin (Poin: 10, Nilai: 10, dll)
  const pointRegex = /^(?:poin|bobot|skor|score|points|nilai)\s*[:=]?\s*(\d+)?$/i;
  // Regex pembahasan opsional (tidak wajib)
  const expRegex = /^(?:pembahasan|penjelasan|alasan|explanation)\s*[:=]\s*(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineWithNormNums = normalizeArabicNumerals(rawLine);

    // Filter baris yang merupakan KOP, judul dokumen, petunjuk umum/khusus
    const isHeaderLine = isExamHeaderOrInstruction(rawLine);

    // 1. Deteksi awal soal baru BERNOMOR (misal: "1.", "1)", "No. 1", "١.", dll)
    const numMatch = lineWithNormNums.match(qNumRegex);
    if (numMatch) {
      const qNum = parseInt(numMatch[1], 10);
      const rawQ = numMatch[2].trim();

      // Jika teks nomor ini merupakan instruksi petunjuk (misal: "1. Berdoalah...", "2. Isikan identitas..."), LEWATI!
      if (isExamHeaderOrInstruction(rawQ) || /^(?:berdoa|isi\b|isikan|tulislah|tulis\b|periksa|laporkan|dahulukan|hitamkan|silanglah|jangan|dilarang|gunakan)/i.test(rawQ)) {
        continue;
      }

      // Validasi apakah ini memang soal baru
      const isActuallyNewQ = !current || current.options.length > 0 || current.hasAnswer || current.isComplete || current.questionText.length > 25;
      if (isActuallyNewQ) {
        if (current) {
          // Hanya simpan jika current memiliki teks soal dan bukan header
          if (current.questionText.length >= 5 && !isExamHeaderOrInstruction(current.questionText)) {
            items.push(current);
          }
        }
        autoQuestionCounter = Math.max(autoQuestionCounter, qNum + 1);
        const cleanQ = cleanQuestionTitlePrefix(rawQ);
        const isEssay = /^(?:\[(?:esai|uraian)\]|\((?:esai|uraian)\)|esai|uraian)/i.test(cleanQ) ||
                        /^(?:jelaskan|sebutkan|uraikan|bagaimanakah|mengapa|apa\s+yang\s+dimaksud)/i.test(cleanQ);

        current = {
          number: qNum,
          questionText: cleanQ.replace(/^(?:\[(?:esai|uraian)\]|\((?:esai|uraian)\))\s*/i, '').trim(),
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

    const isSingleOpt = singleOptRegex.test(rawLine);
    const isAns = ansRegex.test(rawLine);
    const isPoint = pointRegex.test(rawLine);
    const isExp = expRegex.test(rawLine);

    // 2. Deteksi awal soal baru TANPA NOMOR (hanya jika soal sebelumnya sudah selesai atau baris berikutnya adalah opsi)
    if (current && (current.options.length >= 2 || current.hasAnswer) && !isSingleOpt && !isAns && !isPoint && !isExp && !isHeaderLine) {
      if (current.questionText.length >= 5 && !isExamHeaderOrInstruction(current.questionText)) {
        items.push(current);
      }
      current = {
        number: autoQuestionCounter++,
        questionText: cleanQuestionTitlePrefix(rawLine),
        options: [],
        type: 'multiple_choice',
        correctAnswer: '',
        points: 10,
        explanation: '',
        hasAnswer: false,
        isComplete: false
      };
      currentTarget = 'question';
      currentOptionId = null;
      continue;
    }

    // Jika belum ada soal sama sekali:
    // HANYA buat soal baru jika BUKAN header/kop/petunjuk dan tampak seperti pertanyaan atau diikuti opsi
    if (!current) {
      if (isHeaderLine) {
        // Lewati judul, kop, dan petunjuk di awal berkas
        continue;
      }

      // Cek apakah baris ini adalah pertanyaan valid (ada tanda tanya, titik dua, kata tanya, atau esai)
      const nextLineIsOpt = i + 1 < lines.length && (singleOptRegex.test(lines[i + 1]) || /(?:^|\s+)[A-D][\.\)]/i.test(lines[i + 1]));
      const looksLikeQuestion = /\?|:|\.{3}$/.test(rawLine) ||
        /^(?:apakah|apa|siapakah|siapa|mengapa|bagaimana|bagaimanakah|manakah|sebutkan|jelaskan|uraikan|berikut|di\s+bawah|perhatikan)/i.test(rawLine) ||
        nextLineIsOpt;

      if (looksLikeQuestion && !isSingleOpt && !isAns && !isPoint && !isExp) {
        current = {
          number: autoQuestionCounter++,
          questionText: cleanQuestionTitlePrefix(rawLine),
          options: [],
          type: 'multiple_choice',
          correctAnswer: '',
          points: 10,
          explanation: '',
          hasAnswer: false,
          isComplete: false
        };
        currentTarget = 'question';
        currentOptionId = null;
        continue;
      }

      // Jika bukan pertanyaan yang valid sebelum ada soal pertama, abaikan sebagai teks pengantar/kop
      continue;
    }

    // Jika baris adalah judul/petunjuk di tengah dokumen, lewati jangan sambung ke pertanyaan
    if (isHeaderLine && currentTarget === 'question' && current.options.length === 0) {
      continue;
    }

    // 3. Deteksi Kunci Jawaban (Kunci: B / Jawaban: A / مفتاح: أ)
    const ansMatch = rawLine.match(ansRegex);
    if (ansMatch) {
      const val = ansMatch[1].trim();
      current.correctAnswer = mapOptionId(val);
      current.hasAnswer = true;
      currentTarget = 'after_answer';
      continue;
    }

    // 4. Deteksi Poin (Poin: 10 / Nilai: 10)
    const ptMatch = rawLine.match(pointRegex);
    if (ptMatch) {
      if (ptMatch[1]) {
        current.points = parseInt(ptMatch[1], 10) || current.points;
      }
      currentTarget = 'after_points';
      continue;
    }

    // 5. Deteksi Pembahasan (Opsional, jika tidak ada tidak apa-apa)
    const expMatch = rawLine.match(expRegex);
    if (expMatch) {
      current.explanation = expMatch[1].trim();
      currentTarget = 'explanation';
      continue;
    }

    // 6. Deteksi Opsi Horisontal dalam 1 baris: 'A. 40   B. 41   C. 56   D. 47'
    const horizOpts = [...rawLine.matchAll(/(?:^|\s+)([A-Ea-e]|[أإابجد])[\.\)\]:\-]?\s*([^\s][^A-Ea-eأإابجد\n]*?)(?=(?:\s+[A-Ea-e]|[أإابجد][\.\)\]:\-]|$))/gu)];
    if (horizOpts.length >= 2) {
      for (const m of horizOpts) {
        current.options.push({
          id: mapOptionId(m[1]),
          text: m[2].trim()
        });
      }
      current.type = 'multiple_choice';
      currentTarget = 'after_points';
      continue;
    }

    // 7. Deteksi Opsi Vertikal (A. Opsi teks / أ. خيار)
    const singleOpt = rawLine.match(singleOptRegex);
    if (singleOpt && (current.options.length < 5 || /^[A-Ea-e]|[أإابجد]$/u.test(singleOpt[1]))) {
      const optId = mapOptionId(singleOpt[1]);
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

    // 8. Penanganan Teks Multi-Baris (Paragraf bacaan, dialog, matematika bertingkat)
    if (currentTarget === 'explanation') {
      current.explanation += ' ' + rawLine;
    } else if (currentTarget === 'option' && currentOptionId) {
      const opt = current.options.find(o => o.id === currentOptionId);
      if (opt) opt.text += ' ' + rawLine;
    } else if (currentTarget === 'question' && current.options.length === 0) {
      // Pastikan bukan baris petunjuk yang ikut tersambung
      if (!isHeaderLine) {
        current.questionText += ' ' + rawLine;
      }
    }
  }

  if (current && current.questionText.length >= 5 && !isExamHeaderOrInstruction(current.questionText)) {
    items.push(current);
  }

  return items
    .filter(item => {
      // Buang item palsu yang berupa judul kop atau petunjuk
      if (isExamHeaderOrInstruction(item.questionText)) return false;
      if (item.options.length === 0 && !item.hasAnswer && item.type !== 'essay' && item.questionText.length < 15) {
        return false;
      }
      return true;
    })
    .map((item, idx) => {
      // Pastikan ID opsi unik (A, B, C, D) dan tidak ada duplikasi kunci ID
      const cleanOptions: QuizOption[] = [];
      const usedIds = new Set<string>();
      const defaultOptionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

      (item.options || []).forEach((opt, optIndex) => {
        let candidateId = opt.id || defaultOptionLetters[optIndex] || `opt_${optIndex + 1}`;
        if (usedIds.has(candidateId)) {
          const nextAvailable = defaultOptionLetters.find(l => !usedIds.has(l));
          candidateId = nextAvailable || `${candidateId}_${optIndex + 1}`;
        }
        usedIds.add(candidateId);
        cleanOptions.push({
          id: candidateId,
          text: opt.text || ''
        });
      });

      const isEssay = item.type === 'essay' || cleanOptions.length < 2;
      const finalAnswer = item.correctAnswer || (isEssay ? '' : (cleanOptions[0]?.id || 'A'));
      const finalQuestionText = cleanQuestionTitlePrefix(item.questionText) || `Soal ${idx + 1}`;

      return {
        id: `q_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
        type: isEssay ? 'essay' : 'multiple_choice',
        questionText: finalQuestionText,
        points: item.points || (isEssay ? 20 : 10),
        options: isEssay ? undefined : cleanOptions,
        correctAnswer: finalAnswer,
        explanation: item.explanation || ''
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
