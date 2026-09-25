import React, { useState, useEffect, useMemo } from 'react';
import { 
  QuizQuestion, 
  StudentAnswer, 
  calculateQuizScore, 
  saveQuizDraft, 
  getQuizDraft, 
  clearQuizDraft 
} from '../types/quiz';
import { playNotificationSound, unlockAudioContext } from '../lib/audioNotifier';
import { 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  Save, 
  Clock, 
  Award, 
  Sparkles, 
  X, 
  RefreshCw, 
  FileCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendPushAlert } from '../lib/fcmPush';
import { syncAssignmentGradeToRapot } from '../lib/gradeSync';
import { triggerFloatingNotification } from './FloatingNotificationCenter';

interface OnlineQuizTakerModalProps {
  assignment: {
    id: string;
    title: string;
    subject: string;
    classId: string;
    maxScore: number;
    description?: string;
    questions?: QuizQuestion[];
  };
  student: {
    id: string;
    name: string;
    absen_number?: string;
    nisn?: string;
  };
  currentUserRole?: string;
  currentUserName?: string;
  existingSubmission?: any;
  onClose: () => void;
  onSuccess: (submissionResult: any) => void;
}

export default function OnlineQuizTakerModal({
  assignment,
  student,
  currentUserRole,
  currentUserName,
  existingSubmission,
  onClose,
  onSuccess
}: OnlineQuizTakerModalProps) {
  const questions = assignment.questions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);

  // Load existing answers (if already submitted) or draft answers from local storage
  useEffect(() => {
    unlockAudioContext();

    if (existingSubmission && existingSubmission.studentAnswers) {
      const map: Record<string, string> = {};
      existingSubmission.studentAnswers.forEach((ans: StudentAnswer) => {
        map[ans.questionId] = ans.answerText || '';
      });
      setAnswers(map);

      // If already graded, show results directly
      if (existingSubmission.status === 'graded') {
        setEvaluationResult({
          totalScore: existingSubmission.score,
          maxScore: assignment.maxScore,
          totalQuestions: questions.length,
          mcqCorrectCount: existingSubmission.mcqCorrectCount || 0,
          mcqTotalCount: existingSubmission.mcqTotalCount || 0,
          studentAnswers: existingSubmission.studentAnswers,
          feedbackSummary: existingSubmission.feedback || 'Tugas telah selesai dikerjakan.'
        });
      }
      return;
    }

    // Try loading saved draft
    const draft = getQuizDraft(assignment.id, student.id);
    if (draft && Object.keys(draft).length > 0) {
      setAnswers(draft);
      setLastSavedTime('Draf tersimpan dimuat otomatis');
    }
  }, [assignment.id, student.id, existingSubmission]);

  // Current active question
  const currentQuestion = questions[currentIndex] || questions[0];

  // Auto-save draft whenever answers change
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: value };
      saveQuizDraft(assignment.id, student.id, updated);
      return updated;
    });
    const now = new Date();
    setLastSavedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
  };

  // Answer status counters
  const answeredCount = useMemo(() => {
    return questions.filter((q) => (answers[q.id] || '').trim().length > 0).length;
  }, [questions, answers]);

  const unansweredCount = questions.length - answeredCount;

  // Final submit handler with automatic scoring
  const handleSubmitQuiz = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 1. Calculate automatic score
      const result = calculateQuizScore(questions, answers, assignment.maxScore);

      const subId = `${assignment.id}_${student.id}`;
      const payload: any = {
        id: subId,
        assignmentId: assignment.id,
        studentId: student.id,
        studentName: student.name,
        studentAbsen: student.absen_number || '-',
        classId: assignment.classId,
        submissionText: `Mengerjakan Kuis Online (${result.mcqCorrectCount}/${result.mcqTotalCount} PG Benar, Skor: ${result.totalScore}/${result.maxScore})`,
        submittedAt: new Date().toISOString(),
        submittedBy: currentUserName || 'Siswa / Wali Murid',
        isLate: false,
        status: 'graded', // Otomatis terkoreksi & dinilai langsung
        score: result.totalScore,
        feedback: result.feedbackSummary,
        feedbackAt: new Date().toISOString(),
        feedbackBy: 'Sistem Koreksi Otomatis CERDAS',
        studentAnswers: result.studentAnswers,
        autoGraded: true,
        mcqCorrectCount: result.mcqCorrectCount,
        mcqTotalCount: result.mcqTotalCount,
        essayCount: result.essayCount
      };

      // 2. Save submission to Firestore
      await setDoc(doc(db, 'pengumpulan_tugas', subId), payload, { merge: true });

      // 2b. Sinkronisasi otomatis nilai kuis tugas ke buku rapot bagian tugas (grades/{studentId}.gradesBySubject)
      try {
        await syncAssignmentGradeToRapot({
          studentId: student.id,
          studentName: student.name,
          classId: assignment.classId,
          subject: assignment.subject || 'Umum',
          score: result.totalScore,
          maxScore: assignment.maxScore || 100,
          assignmentId: assignment.id,
          assignmentTitle: assignment.title
        });
      } catch (syncErr) {
        console.warn('Sync quiz grade to rapot error:', syncErr);
      }

      // 3. Clear draft from localStorage
      clearQuizDraft(assignment.id, student.id);

      // 4. Play audio fanfare & vibration
      try {
        playNotificationSound('grade_released');
      } catch (err) {
        console.warn('Audio feedback err:', err);
      }

      // Memicu notifikasi mengambang (Floating Heads-Up Banner)
      triggerFloatingNotification({
        title: `Hasil Kuis: ${assignment.title}`,
        body: `Ananda ${student.name} meraih nilai ${result.totalScore} dari ${result.maxScore}! Nilai otomatis tersimpan ke rapor.`,
        type: 'grade_released',
        category: assignment.subject,
        url: '/assignments'
      });

      // 5. Send push notification alert
      sendPushAlert({
        title: `Nilai Kuis Siswa: ${assignment.title}`,
        body: `Ananda ${student.name} telah menyelesaikan tugas kuis online dengan nilai ${result.totalScore}/${result.maxScore}!`,
        type: 'grade_released',
        targetClass: assignment.classId,
        studentId: student.id,
        assignmentId: assignment.id,
        url: '/assignments'
      }).catch((e) => console.warn('Push alert error:', e));

      setEvaluationResult(result);
      setShowConfirmSubmit(false);
      onSuccess(payload);
    } catch (err) {
      console.error('Error submitting quiz answers:', err);
      alert('Gagal mengirim jawaban tugas online. Mohon periksa koneksi internet Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Soal Belum Tersedia</h3>
          <p className="text-xs text-slate-500 mt-2">
            Guru belum menambahkan daftar butir soal online untuk tugas ini.
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RESULT VIEW (Setelah Koreksi Otomatis Selesai)
  // ----------------------------------------------------
  if (evaluationResult) {
    const isPerfect = evaluationResult.totalScore >= 90;
    const isPassing = evaluationResult.totalScore >= 70;

    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header Score Card */}
          <div className={`p-6 sm:p-8 text-white text-center relative overflow-hidden ${
            isPerfect
              ? 'bg-gradient-to-br from-emerald-600 via-teal-600 to-indigo-700'
              : isPassing
              ? 'bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700'
              : 'bg-gradient-to-br from-amber-600 via-orange-600 to-rose-700'
          }`}>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold mb-3">
              <Award className="w-4 h-4 text-amber-300" />
              <span>Hasil Koreksi Otomatis Aplikasi</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black">{assignment.title}</h2>
            <p className="text-xs sm:text-sm text-white/80 mt-0.5">
              Peserta: <strong>{student.name}</strong> • Kelas: {assignment.classId}
            </p>

            <div className="my-5 inline-flex flex-col items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white/15 backdrop-blur-md border border-white/30 shadow-lg">
              <span className="text-3xl sm:text-4xl font-black tracking-tight">{evaluationResult.totalScore}</span>
              <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">dari {evaluationResult.maxScore}</span>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-white/95 max-w-md mx-auto">
              {evaluationResult.feedbackSummary}
            </p>
          </div>

          {/* Detailed Question Review */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center justify-between">
              <span>Rincian Pembahasan & Evaluasi Jawaban ({questions.length} Soal)</span>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                {evaluationResult.mcqCorrectCount} Benar • {questions.length - evaluationResult.mcqCorrectCount} Perlu Dipelajari
              </span>
            </h4>

            <div className="space-y-3">
              {questions.map((q, idx) => {
                const ans = evaluationResult.studentAnswers?.find((a: any) => a.questionId === q.id);
                const isCorrect = ans?.isCorrect;
                const isEssay = q.type === 'essay';

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-2xl border transition-all text-xs ${
                      isCorrect
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-500 uppercase text-[10px]">
                          {isEssay ? 'Soal Esai' : 'Pilihan Ganda'} • {q.points} Poin
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-bold">
                        {isCorrect ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>+{ans?.scoreEarned || q.points} Poin</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                            <X className="w-3.5 h-3.5" />
                            <span>+{ans?.scoreEarned || 0} Poin</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm mb-2 leading-relaxed">
                      {q.questionText}
                    </p>

                    <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-1.5">
                      <p className="text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 font-semibold">Jawaban Anda: </span>
                        <strong className={isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {ans?.answerText || '(Tidak dijawab)'}
                        </strong>
                      </p>

                      {q.correctAnswer && !isCorrect && (
                        <p className="text-slate-600 dark:text-slate-300">
                          <span className="text-slate-400 font-semibold">Kunci Jawaban: </span>
                          <strong className="text-indigo-600 dark:text-indigo-400">{q.correctAnswer}</strong>
                        </p>
                      )}

                      {q.explanation && (
                        <p className="text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                          <span className="font-bold text-slate-600 dark:text-slate-300">Pembahasan: </span>
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Nilai telah tersimpan secara resmi pada lembar tugas ananda.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              Selesai & Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // INTERACTIVE QUESTION TAKER VIEW (Dikerjakan Siswa/Wali)
  // ----------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full h-[95vh] sm:h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Navbar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                {assignment.subject}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                {assignment.classId}
              </span>
              {lastSavedTime && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Save className="w-3 h-3" />
                  <span>Draf Tersimpan ({lastSavedTime})</span>
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white truncate">
              {assignment.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                if (confirm('Apakah Anda ingin keluar? Jawaban Anda tersimpan otomatis sebagai draf dan dapat dilanjutkan kapan saja.')) {
                  onClose();
                }
              }}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              title="Tutup & simpan draf"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Question Selector Strip */}
        <div className="px-5 py-2.5 bg-slate-100/60 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto py-1">
            {questions.map((q, idx) => {
              const isAnswered = (answers[q.id] || '').trim().length > 0;
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400 dark:ring-indigo-600'
                      : isAnswered
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                  }`}
                  title={`Soal ${idx + 1}: ${isAnswered ? 'Sudah dijawab' : 'Belum dijawab'}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400 pl-2 border-l border-slate-200 dark:border-slate-700">
            <span className="text-emerald-600 dark:text-emerald-400">{answeredCount}</span>
            <span>/{questions.length} Terjawab</span>
          </div>
        </div>

        {/* Main Question Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
          {/* Question Header & Points */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                Soal Nomor {currentIndex + 1} dari {questions.length}
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold">
                {currentQuestion.type === 'multiple_choice' ? 'Pilihan Ganda' : 'Esai / Uraian'}
              </span>
            </div>

            <span className="text-xs font-bold text-slate-400">
              Bobot: {currentQuestion.points} Poin
            </span>
          </div>

          {/* Question Prompt */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed whitespace-pre-wrap">
              {currentQuestion.questionText}
            </p>
          </div>

          {/* Question Options: Multiple Choice or Essay Input */}
          {currentQuestion.type === 'multiple_choice' && currentQuestion.options ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Pilih Salah Satu Jawaban:
              </p>

              {currentQuestion.options.map((opt) => {
                const isSelected = answers[currentQuestion.id] === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleAnswerChange(currentQuestion.id, opt.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {opt.id}
                    </div>

                    <span className="text-sm font-semibold flex-1 leading-relaxed">
                      {opt.text}
                    </span>

                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tuliskan Jawaban / Uraian Anda di bawah ini:
              </label>
              <textarea
                rows={6}
                placeholder="Ketik uraian jawaban lengkap Anda di sini... Jawaban otomatis tersimpan sebagai draf."
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-normal"
              />
              <p className="text-[11px] text-slate-400">
                Jumlah karakter: {(answers[currentQuestion.id] || '').length} • Jawaban otomatis tersimpan ke draf.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Navigation & Submit Bar */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          <div className="flex items-center gap-2">
            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>Selanjutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(true)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Kirim & Nilai Otomatis</span>
              </button>
            )}
          </div>
        </div>

        {/* Confirm Submit Modal */}
        {showConfirmSubmit && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <FileCheck2 className="w-6 h-6" />
              </div>

              <h4 className="text-base font-bold text-center text-slate-900 dark:text-white">
                Kirim Lembar Jawaban Kuis?
              </h4>

              <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-1 mb-4 leading-relaxed">
                Anda telah menjawab <strong>{answeredCount}</strong> dari {questions.length} butir soal.
                {unansweredCount > 0 && (
                  <span className="block text-amber-600 dark:text-amber-400 font-semibold mt-1">
                    Peringatan: Ada {unansweredCount} butir soal yang belum Anda jawab!
                  </span>
                )}
                Aplikasi akan langsung mengoreksi dan memberikan penilaian instan.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmSubmit(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Periksa Lagi
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitQuiz}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Mengoreksi...' : 'Ya, Kirim Sekarang'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
