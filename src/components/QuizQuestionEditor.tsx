import React, { useState, useRef } from 'react';
import { QuizQuestion, QuizOption, parseImportedQuestions } from '../types/quiz';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  X, 
  Copy,
  Loader2,
  FileUp,
  Check,
  Filter
} from 'lucide-react';
import { playNotificationSound, unlockAudioContext } from '../lib/audioNotifier';
import { extractQuestionsDirectlyFromPdf } from '../lib/pdfQuestionExtractor';
import { extractQuestionsFromWord } from '../lib/wordExtractor';

interface QuizQuestionEditorProps {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
  maxScore: number;
}

export default function QuizQuestionEditor({
  questions,
  onChange,
  maxScore
}: QuizQuestionEditorProps) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeImportTab, setActiveImportTab] = useState<'pdf' | 'text'>('pdf');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // State untuk Impor PDF
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [selectedPdfBase64, setSelectedPdfBase64] = useState<string | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [extractionProgressStep, setExtractionProgressStep] = useState(1);
  const [extractedPdfQuestions, setExtractedPdfQuestions] = useState<QuizQuestion[]>([]);
  const [selectedExtractedIndices, setSelectedExtractedIndices] = useState<number[]>([]);
  const [pdfFilterType, setPdfFilterType] = useState<'all' | 'multiple_choice' | 'essay'>('all');
  const [pdfStats, setPdfStats] = useState<{
    fileName: string;
    totalDetected: number;
    mcqCount: number;
    essayCount: number;
    totalPoints: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add new multiple-choice question
  const handleAddMCQ = () => {
    const newQ: QuizQuestion = {
      id: `q_${Date.now()}_${questions.length + 1}`,
      type: 'multiple_choice',
      questionText: '',
      points: 10,
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' }
      ],
      correctAnswer: 'A',
      explanation: ''
    };
    onChange([...questions, newQ]);
  };

  // Add new essay question
  const handleAddEssay = () => {
    const newQ: QuizQuestion = {
      id: `q_${Date.now()}_${questions.length + 1}`,
      type: 'essay',
      questionText: '',
      points: 20,
      correctAnswer: '',
      explanation: ''
    };
    onChange([...questions, newQ]);
  };

  const handleUpdateQuestion = (index: number, updated: Partial<QuizQuestion>) => {
    const next = [...questions];
    next[index] = { ...next[index], ...updated };
    onChange(next);
  };

  const handleUpdateOption = (qIndex: number, optId: string, text: string) => {
    const q = questions[qIndex];
    if (!q.options) return;
    const nextOpts = q.options.map((opt) => (opt.id === optId ? { ...opt, text } : opt));
    handleUpdateQuestion(qIndex, { options: nextOpts });
  };

  const handleDeleteQuestion = (index: number) => {
    const next = questions.filter((_, idx) => idx !== index);
    onChange(next);
  };

  // Quick Import Handler dari Teks Manual
  const handleProcessTextImport = () => {
    try {
      const parsed = parseImportedQuestions(importText);
      if (parsed.length === 0) {
        setImportError('Format soal tidak terdeteksi. Silakan gunakan format nomor dan pilihan A, B, C, D atau salin dari contoh.');
        return;
      }
      onChange([...questions, ...parsed]);
      setShowImportModal(false);
      setImportText('');
      setImportError(null);
      try {
        unlockAudioContext();
        playNotificationSound('announcement');
      } catch {}
    } catch (err: any) {
      setImportError('Gagal memproses teks soal: ' + (err.message || ''));
    }
  };

  const handleLoadSampleText = () => {
    setImportText(`Berapakah hasil dari 81 - 40?
A. 40
B. 41
C. 56
D. 47
Kunci: B
Poin: 10

كَمْ رَكْعَةً فِي صَلَاةِ الصُّبْحِ؟
أ. رَكْعَتَانِ
ب. ثَلَاثُ رَكَعَاتٍ
ج. أَرْبَعُ رَكَعَاتٍ
د. رَكْعَةٌ وَاحِدَةٌ
Kunci: أ
Poin: 10

Jelaskan fungsi utama organ jantung pada sistem peredaran darah manusia!
Kunci: memompa darah, oksigen, seluruh tubuh
Poin: 20`);
    setImportError(null);
  };

  // Handler Pilih Berkas Dokumen (Word .docx / .doc, Text .txt, atau PDF .pdf)
  const handleFileSelect = async (file: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isSupported = 
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.doc') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.pdf') ||
      file.type.includes('word') ||
      file.type.includes('officedocument') ||
      file.type.includes('text') ||
      file.type.includes('pdf');

    if (!isSupported) {
      setImportError('Format berkas harus berupa Dokumen Word (.docx, .doc), Teks (.txt), atau PDF (.pdf).');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setImportError('Ukuran berkas terlalu besar (maksimal 30 MB).');
      return;
    }
    setSelectedPdfFile(file);
    setImportError(null);
    setExtractedPdfQuestions([]);
    setSelectedExtractedIndices([]);
    setPdfStats(null);

    // Konversi ke Base64 menggunakan FileReader yang andal di Android WebView & Median APK
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const res = (reader.result as string) || '';
        setSelectedPdfBase64(res.includes('base64,') ? res.split('base64,')[1] : res);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.warn("FileReader notice:", e);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Helper untuk membaca respons server secara aman tanpa memicu 'Unexpected end of JSON input'
  const parseSafeResponse = async (response: Response): Promise<any> => {
    try {
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        return { success: false, error: 'Server tidak memberikan data respons.' };
      }
      try {
        return JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch {}
        }
        return { success: false, error: 'Respons server tidak berformat JSON valid.' };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Gagal membaca respons dari server.' };
    }
  };

  // Ekstrak Soal dari Berkas PDF (Dukungan Penuh Multi-Perangkat: Server AI + Client-Side Fast Extractor)
  const handleExtractFromPdf = async () => {
    if (!selectedPdfFile) return;

    setIsExtractingPdf(true);
    setImportError(null);
    setExtractionProgressStep(1);

    const stepTimer1 = setTimeout(() => setExtractionProgressStep(2), 1000);
    const stepTimer2 = setTimeout(() => setExtractionProgressStep(3), 2500);

    const processQuestionsData = (data: any) => {
      const receivedQuestions: QuizQuestion[] = Array.isArray(data.questions) ? data.questions : [];
      if (receivedQuestions.length === 0) {
        throw new Error('Tidak ditemukan butir soal yang terbaca dari PDF ini. Pastikan PDF memuat teks soal yang jelas.');
      }

      setExtractedPdfQuestions(receivedQuestions);
      setSelectedExtractedIndices(receivedQuestions.map((_, i) => i));
      setPdfStats({
        fileName: data.fileName || selectedPdfFile.name,
        totalDetected: data.totalDetected || receivedQuestions.length,
        mcqCount: data.mcqCount || receivedQuestions.filter(q => q.type === 'multiple_choice').length,
        essayCount: data.essayCount || receivedQuestions.filter(q => q.type === 'essay').length,
        totalPoints: data.totalPoints || receivedQuestions.reduce((sum, q) => sum + (q.points || 0), 0)
      });

      try {
        unlockAudioContext();
        playNotificationSound('announcement');
      } catch {}
    };

    try {
      const lowerName = selectedPdfFile.name.toLowerCase();
      const isWordOrText = lowerName.endsWith('.docx') || lowerName.endsWith('.doc') || lowerName.endsWith('.txt');

      // 1. Ekstraksi Instan di Klien untuk Dokumen Word (.docx / .doc) & Teks (.txt)
      if (isWordOrText) {
        try {
          const wordRes = await extractQuestionsFromWord(selectedPdfFile);
          if (wordRes.success && wordRes.questions.length > 0) {
            processQuestionsData({
              success: true,
              fileName: selectedPdfFile.name,
              totalDetected: wordRes.questions.length,
              questions: wordRes.questions
            });
            return;
          }
        } catch (wordErr) {
          console.warn('[Word Client Extract notice, falling back to server]:', wordErr);
        }
      }

      // Dapatkan base64 string yang aman lewat FileReader
      let base64String = selectedPdfBase64;
      if (!base64String) {
        base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = (reader.result as string) || '';
            resolve(res.includes('base64,') ? res.split('base64,')[1] : res);
          };
          reader.onerror = () => reject(new Error('Gagal membaca berkas di perangkat Anda.'));
          reader.readAsDataURL(selectedPdfFile);
        });
      }

      let extracted = false;

      // 2. Percobaan Server API /api/quiz/import-document (Mendukung Word .docx & PDF)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const response = await fetch('/api/quiz/import-document', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            fileBase64: base64String,
            pdfBase64: base64String,
            filename: selectedPdfFile.name,
            mimeType: selectedPdfFile.type || 'application/octet-stream'
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await parseSafeResponse(response);
        if (data && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
          processQuestionsData(data);
          extracted = true;
        } else if (data?.error) {
          console.warn('JSON Base64 server notice:', data.error);
        }
      } catch (jsonErr: any) {
        console.warn('JSON Base64 attempt notice, trying FormData fallback:', jsonErr);
      }

      // 3. Percobaan Cadangan: FormData multipart ke server
      if (!extracted) {
        try {
          const formData = new FormData();
          formData.append('file', selectedPdfFile);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 35000);

          const response = await fetch('/api/quiz/import-document', {
            method: 'POST',
            body: formData,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          const data = await parseSafeResponse(response);
          if (data && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
            processQuestionsData(data);
            extracted = true;
          }
        } catch (formErr: any) {
          console.warn('FormData fallback notice:', formErr);
        }
      }

      // 4. PERCOBAAN TAHAN BANTING PDF: Ekstraksi Cerdas Langsung di Perangkat Klien (Offline & Universal untuk Semua HP / Median APK)
      if (!extracted && !isWordOrText) {
        try {
          console.log('[Client Extractor] Menjalankan pemindai soal PDF langsung di perangkat klien...');
          const localResult = await extractQuestionsDirectlyFromPdf(base64String || selectedPdfFile);
          if (localResult && localResult.success && localResult.questions.length > 0) {
            processQuestionsData({
              success: true,
              fileName: selectedPdfFile.name,
              totalDetected: localResult.questions.length,
              questions: localResult.questions
            });
            extracted = true;
          } else if (localResult?.text && localResult.text.length > 20) {
            // Teks terbaca di klien tapi butuh AI! Kirim teks murni (sangat ringan, < 2KB) ke /api/extract-questions
            try {
              const textResp = await fetch('/api/extract-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: localResult.text.slice(0, 10000) })
              });
              const textData = await parseSafeResponse(textResp);
              if (Array.isArray(textData) && textData.length > 0) {
                processQuestionsData({
                  success: true,
                  fileName: selectedPdfFile.name,
                  totalDetected: textData.length,
                  questions: textData
                });
                extracted = true;
              }
            } catch (txtErr) {
              console.warn('Client text AI error:', txtErr);
            }
          }
        } catch (clientErr) {
          console.warn('[Client Extractor error]:', clientErr);
        }
      }

      if (!extracted) {
        throw new Error('Tidak dapat mengekstrak butir soal secara otomatis dari berkas ini. Pastikan dokumen Word (.docx) atau berkas memuat teks naskah soal yang dapat dibaca.');
      }

    } catch (err: any) {
      console.error('Extraction error:', err);
      let errMsg = err?.message || 'Terjadi kesalahan saat memproses berkas PDF di perangkat Anda.';
      if (
        errMsg.toLowerCase().includes('json') || 
        errMsg.toLowerCase().includes('unexpected') || 
        errMsg.toLowerCase().includes('end of input')
      ) {
        errMsg = 'Koneksi ke server terputus saat membaca berkas PDF.';
      }
      setImportError(
        errMsg + ' Anda juga dapat menyalin naskah soal dan menempelnya langsung di tab "Tempel Teks Soal".'
      );
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsExtractingPdf(false);
    }
  };


  // Toggle selection pada butir soal hasil ekstrak
  const handleToggleExtractedIndex = (index: number) => {
    if (selectedExtractedIndices.includes(index)) {
      setSelectedExtractedIndices(selectedExtractedIndices.filter(i => i !== index));
    } else {
      setSelectedExtractedIndices([...selectedExtractedIndices, index]);
    }
  };

  const handleSelectAllExtracted = () => {
    if (selectedExtractedIndices.length === extractedPdfQuestions.length) {
      setSelectedExtractedIndices([]);
    } else {
      setSelectedExtractedIndices(extractedPdfQuestions.map((_, i) => i));
    }
  };

  // Masukkan butir soal terpilih ke daftar kuis
  const handleApplyExtractedQuestions = () => {
    if (selectedExtractedIndices.length === 0) {
      setImportError('Silakan pilih minimal 1 butir soal untuk ditambahkan.');
      return;
    }

    const questionsToAdd = extractedPdfQuestions
      .filter((_, idx) => selectedExtractedIndices.includes(idx))
      .map((q, idx) => ({
        ...q,
        id: `q_${Date.now()}_${questions.length + idx + 1}`
      }));

    onChange([...questions, ...questionsToAdd]);
    setShowImportModal(false);
    resetPdfState();

    try {
      unlockAudioContext();
      playNotificationSound('grade_released');
    } catch {}
  };

  const resetPdfState = () => {
    setSelectedPdfFile(null);
    setExtractedPdfQuestions([]);
    setSelectedExtractedIndices([]);
    setPdfStats(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filter list tampilan soal hasil ekstrak
  const displayedExtractedQuestions = extractedPdfQuestions.filter(q => {
    if (pdfFilterType === 'multiple_choice') return q.type === 'multiple_choice';
    if (pdfFilterType === 'essay') return q.type === 'essay';
    return true;
  });

  // Sample Template
  const sampleTemplate = `1. Berapakah hasil perkalian dari 15 x 6?
A. 70
B. 80
C. 90
D. 100
Kunci: C
Poin: 10
Pembahasan: 15 dikalikan 6 menghasilkan 90.

2. [Esai] Sebutkan 3 ciri makhluk hidup yang paling mendasar!
Kunci: bernapas, bergerak, berkembang biak
Poin: 20
Pembahasan: Makhluk hidup bernapas, membutuhkan nutrisi, bergerak, dan berkembang biak.`;

  const totalPoints = questions.reduce((acc, q) => acc + (Number(q.points) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Daftar Soal Online Interaktif ({questions.length} Soal)</span>
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Total Bobot: <strong>{totalPoints} poin</strong> • Nilai Maksimal Rapor: <strong>{maxScore}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tombol Impor Cepat via PDF */}
          <button
            type="button"
            onClick={() => {
              setActiveImportTab('pdf');
              setShowImportModal(true);
            }}
            className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Ekstrak dan impor soal langsung dari berkas dokumen PDF"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Impor Soal PDF</span>
          </button>

          {/* Tombol Impor Cepat Teks */}
          <button
            type="button"
            onClick={() => {
              setActiveImportTab('text');
              setShowImportModal(true);
            }}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Tempel Teks</span>
          </button>

          {/* Tambah Soal Manual */}
          <button
            type="button"
            onClick={handleAddMCQ}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Pilihan Ganda</span>
          </button>

          <button
            type="button"
            onClick={handleAddEssay}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Esai</span>
          </button>
        </div>
      </div>

      {/* Question Items List */}
      {questions.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-850 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Belum Ada Soal Ditambahkan</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5 leading-relaxed">
            Percepat pembuatan tugas online dengan mengunggah lembar soal dalam format PDF, atau gunakan tombol di bawah untuk menambah butir soal secara manual.
          </p>

          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setActiveImportTab('pdf');
                setShowImportModal(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Impor Cepat Berkas PDF (AI)</span>
            </button>

            <button
              type="button"
              onClick={handleAddMCQ}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              + Pilihan Ganda Manual
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveImportTab('text');
                setImportText(sampleTemplate);
                setShowImportModal(true);
              }}
              className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Tempel Format Teks
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, qIdx) => (
            <div
              key={q.id}
              className="p-4 sm:p-5 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3"
            >
              {/* Question Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center">
                    {qIdx + 1}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    q.type === 'essay'
                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                      : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  }`}>
                    {q.type === 'essay' ? 'Esai / Uraian' : 'Pilihan Ganda (PG)'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500">Bobot:</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={q.points}
                      onChange={(e) => handleUpdateQuestion(qIdx, { points: Number(e.target.value) || 10 })}
                      className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center text-slate-800 dark:text-white"
                    />
                    <span className="text-[11px] text-slate-400">poin</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(qIdx)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                    title="Hapus soal ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div>
                <textarea
                  rows={2}
                  required
                  placeholder={`Tuliskan pertanyaan / butir soal nomor ${qIdx + 1}...`}
                  value={q.questionText}
                  onChange={(e) => handleUpdateQuestion(qIdx, { questionText: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Options for MCQ */}
              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-bold text-slate-500">
                    Pilihan Jawaban & Kunci Jawaban Benar (Pilih bulatan huruf untuk menetapkan kunci):
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correctAnswer === opt.id;

                      return (
                        <div
                          key={`${q.id || qIdx}-opt-${opt.id || optIdx}-${optIdx}`}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                            isCorrect
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(qIdx, { correctAnswer: opt.id })}
                            className={`w-6 h-6 rounded-lg text-xs font-black shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                            }`}
                            title="Tandai sebagai kunci jawaban"
                          >
                            {opt.id}
                          </button>

                          <input
                            type="text"
                            required
                            placeholder={`Teks pilihan ${opt.id}...`}
                            value={opt.text}
                            onChange={(e) => handleUpdateOption(qIdx, opt.id, e.target.value)}
                            className="flex-1 bg-transparent border-none text-xs text-slate-800 dark:text-white outline-none font-medium"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Key Answer for Essay */}
              {q.type === 'essay' && (
                <div className="pt-1">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Kunci Jawaban / Kata Kunci Penilaian Otomatis (Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: bernapas, bergerak, berkembang biak (pisahkan dengan koma)"
                    value={q.correctAnswer || ''}
                    onChange={(e) => handleUpdateQuestion(qIdx, { correctAnswer: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Aplikasi akan mengecek kecocokan kata kunci pada jawaban esai siswa untuk penilaian otomatis.
                  </span>
                </div>
              )}

              {/* Explanation (Optional) */}
              <div>
                <input
                  type="text"
                  placeholder="Catatan pembahasan / penjelasan untuk siswa (Opsional)..."
                  value={q.explanation || ''}
                  onChange={(e) => handleUpdateQuestion(qIdx, { explanation: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL IMPOR SOAL LENGKAP: PDF & TEKS */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Impor Cepat Soal Ujian Online</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Mendukung berkas Word (.docx, .doc), Teks (.txt), PDF, atau tempel teks langsung. Format praktis tanpa perlu pembahasan!
                </p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  resetPdfState();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigasi: Dokumen vs Teks */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setActiveImportTab('pdf');
                  setImportError(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeImportTab === 'pdf'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FileUp className="w-3.5 h-3.5 text-indigo-500" />
                <span>Unggah Dokumen (Word .docx / Teks / PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveImportTab('text');
                  setImportError(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeImportTab === 'text'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>Tempel Teks Bebas</span>
              </button>
            </div>

            {/* Pesan Kesalahan jika ada */}
            {importError && (
              <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border border-rose-200 dark:border-rose-900/60 animate-in fade-in">
                <div className="flex items-start sm:items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5 sm:mt-0" />
                  <span>{importError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveImportTab('text');
                    setImportError(null);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shrink-0 self-start sm:self-auto shadow-2xs cursor-pointer"
                >
                  Buka Tab Tempel Teks
                </button>
              </div>
            )}

            {/* KONTEN TAB 1: IMPOR BERKAS WORD / PDF */}
            {activeImportTab === 'pdf' && (
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* 1. Belum ada soal yang diekstrak */}
                {extractedPdfQuestions.length === 0 ? (
                  <div className="space-y-4">
                    {/* Area Drag & Drop Berkas Dokumen */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative overflow-hidden p-6 sm:p-8 rounded-3xl border-2 border-dashed text-center transition-all cursor-pointer ${
                        selectedPdfFile
                          ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 hover:border-indigo-400'
                      }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".docx,.doc,.txt,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,application/pdf"
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFileSelect(e.target.files[0]);
                          }
                        }}
                      />

                      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                        <FileUp className="w-7 h-7" />
                      </div>

                      <h5 className="text-sm font-bold text-slate-800 dark:text-white">
                        {selectedPdfFile ? selectedPdfFile.name : 'Pilih Berkas Word (.docx), Teks (.txt), atau PDF'}
                      </h5>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        {selectedPdfFile
                          ? `Ukuran berkas: ${(selectedPdfFile.size / (1024 * 1024)).toFixed(2)} MB • Berkas siap diekstrak`
                          : 'Pilih naskah soal dari HP (Median APK / Browser) atau Komputer. Format cukup Soal, Kunci/Jawaban, dan Poin.'}
                      </p>

                      {/* Tombol Aksi Nyata yang Dapat Disentuh di HP */}
                      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 relative z-20">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileUp className="w-3.5 h-3.5 text-white" />
                          <span>{selectedPdfFile ? 'Ganti Berkas Dokumen' : 'Pilih Dokumen Word / PDF'}</span>
                        </button>

                        {selectedPdfFile && (
                          <button
                            type="button"
                            disabled={isExtractingPdf}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExtractFromPdf();
                            }}
                            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Ekstrak Soal Sekarang</span>
                          </button>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <span className="px-2.5 py-1 bg-white dark:bg-slate-750 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                          Format: Word (.docx / .doc)
                        </span>
                        <span className="px-2.5 py-1 bg-white dark:bg-slate-750 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                          Teks (.txt) & PDF
                        </span>
                        <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-bold">
                          Tanpa Perlu Pembahasan
                        </span>
                        <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-lg text-[10px] font-bold">
                          Arab & Matematika
                        </span>
                        <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-lg text-[10px] font-bold">
                          Nomor Otomatis
                        </span>
                      </div>
                    </div>

                    {/* Loading State saat sedang ekstraksi */}
                    {isExtractingPdf ? (
                      <div className="p-6 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 text-center space-y-3">
                        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                            {extractionProgressStep === 1 && 'Mengunggah & membaca berkas PDF naskah soal...'}
                            {extractionProgressStep === 2 && 'Menganalisis butir soal, pilihan A-D & mendeteksi kunci jawaban...'}
                            {extractionProgressStep === 3 && 'Menghitung bobot skor dan menyusun format kuis interaktif...'}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Memanfaatkan Gemini AI Multimodal untuk membaca teks dan struktur dokumen secara teliti.
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Petunjuk Keunggulan Fitur PDF */
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                        <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Cara Kerja Impor PDF Cepat:</span>
                        </p>
                        <p>• <strong>Pilihan Ganda:</strong> Sistem membaca nomor soal, opsi A, B, C, D, dan otomatis mengidentifikasi kunci jawaban yang tepat.</p>
                        <p>• <strong>Esai / Uraian:</strong> Sistem mengenali butir soal esai dan menyiapkan kunci kata kunci penilaian.</p>
                        <p>• <strong>Pratinjau Lengkap:</strong> Anda dapat memeriksa, memilih butir soal yang ingin dimasukkan, dan mengedit sebelum menyimpan.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 2. Berhasil Diekstrak - Tampilan Pratinjau & Seleksi */
                  <div className="space-y-4">
                    {/* Ringkasan Hasil Ekstraksi */}
                    <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h5 className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Ekstraksi Berhasil ({extractedPdfQuestions.length} Butir Soal Terdeteksi)</span>
                        </h5>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                          Berkas: <strong>{pdfStats?.fileName}</strong> • {pdfStats?.mcqCount} Pilihan Ganda • {pdfStats?.essayCount} Esai
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={resetPdfState}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Ganti Berkas PDF
                        </button>
                      </div>
                    </div>

                    {/* Filter dan Kontrol Seleksi */}
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllExtracted}
                          className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            {selectedExtractedIndices.length === extractedPdfQuestions.length
                              ? 'Batal Pilih Semua'
                              : 'Pilih Semua'}
                          </span>
                        </button>
                        <span className="text-[11px] text-slate-500">
                          ({selectedExtractedIndices.length} dari {extractedPdfQuestions.length} soal dipilih)
                        </span>
                      </div>

                      {/* Filter Kategori */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPdfFilterType('all')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            pdfFilterType === 'all'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Semua ({extractedPdfQuestions.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPdfFilterType('multiple_choice')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            pdfFilterType === 'multiple_choice'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          PG ({pdfStats?.mcqCount || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPdfFilterType('essay')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            pdfFilterType === 'essay'
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Esai ({pdfStats?.essayCount || 0})
                        </button>
                      </div>
                    </div>

                    {/* Daftar Butir Soal Terdeteksi */}
                    <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
                      {displayedExtractedQuestions.map((q, idx) => {
                        const originalIndex = extractedPdfQuestions.indexOf(q);
                        const isSelected = selectedExtractedIndices.includes(originalIndex);

                        return (
                          <div
                            key={idx}
                            onClick={() => handleToggleExtractedIndex(originalIndex)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 shadow-2xs'
                                : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Checkbox */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleExtractedIndex(originalIndex)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />

                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                                    Soal {originalIndex + 1}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    q.type === 'essay'
                                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                      : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                  }`}>
                                    {q.type === 'essay' ? 'Esai' : 'Pilihan Ganda'}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {q.points} Poin
                                  </span>
                                </div>

                                <p className="text-xs text-slate-800 dark:text-white font-medium leading-relaxed">
                                  {q.questionText}
                                </p>

                                {/* Opsi PG */}
                                {q.type === 'multiple_choice' && q.options && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                    {q.options.map((opt, optIdx) => {
                                      const isCorrect = q.correctAnswer === opt.id;
                                      return (
                                        <div
                                          key={`${q.id || idx}-preview-opt-${opt.id || optIdx}-${optIdx}`}
                                          className={`text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                                            isCorrect
                                              ? 'bg-emerald-100/80 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700'
                                              : 'bg-white dark:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                          }`}
                                        >
                                          <span className="w-4 h-4 rounded text-[10px] flex items-center justify-center font-black shrink-0">
                                            {opt.id}.
                                          </span>
                                          <span className="truncate">{opt.text}</span>
                                          {isCorrect && <Check className="w-3 h-3 ml-auto text-emerald-600" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Kunci Esai */}
                                {q.type === 'essay' && q.correctAnswer && (
                                  <div className="text-[11px] text-slate-500 pt-1">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">Kunci/Kata Kunci: </span>
                                    <span>{q.correctAnswer}</span>
                                  </div>
                                )}

                                {/* Pembahasan jika ada */}
                                {q.explanation && (
                                  <p className="text-[10px] text-slate-400 italic pt-0.5">
                                    Pembahasan: {q.explanation}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* KONTEN TAB 2: TEMPEL TEKS MANUAL */}
            {activeImportTab === 'text' && (
              <div className="flex-1 overflow-y-auto space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Kotak Input Teks Soal:
                  </span>
                  <button
                    type="button"
                    onClick={() => setImportText(sampleTemplate)}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Isi Contoh Format</span>
                  </button>
                </div>

                <textarea
                  rows={9}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={sampleTemplate}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-white font-mono leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <p className="font-bold">Format teks yang didukung:</p>
                  <p>• Pilihan Ganda: Nomor soal, opsi baris A. ..., B. ..., C. ..., D. ..., dan baris "Kunci: C"</p>
                  <p>• Esai: Beri tanda "[Esai]" pada teks soal dan "Kunci: kata kunci jawaban"</p>
                  <p>• Opsional: Tuliskan "Poin: 10" dan "Pembahasan: ..." pada baris tersendiri.</p>
                </div>
              </div>
            )}

            {/* Footer Modal Action */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 mt-3">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  resetPdfState();
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Batal
              </button>

              {activeImportTab === 'pdf' ? (
                extractedPdfQuestions.length === 0 ? (
                  <button
                    type="button"
                    disabled={!selectedPdfFile || isExtractingPdf}
                    onClick={handleExtractFromPdf}
                    className="px-5 py-2 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isExtractingPdf ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menganalisis PDF...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Pindai & Ekstrak Soal dari PDF</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={selectedExtractedIndices.length === 0}
                    onClick={handleApplyExtractedQuestions}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Tambahkan {selectedExtractedIndices.length} Soal Terpilih ke Ujian</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleProcessTextImport}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Proses & Tambahkan ke Soal
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
