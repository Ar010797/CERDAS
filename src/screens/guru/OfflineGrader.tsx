import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/activity';
import { ALL_AVAILABLE_CLASSES, getClassVariants } from '../../lib/schoolClasses';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Camera,
  Upload,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  Sparkles,
  BookOpen,
  Users,
  FileDown,
  Loader2,
  ArrowRight,
  KeyRound,
  ZoomIn,
  X,
  RefreshCw,
  Check,
  Edit3,
  ClipboardCheck
} from 'lucide-react';

interface Student {
  id: string;
  nisn: string;
  name: string;
  absen_number?: string;
  classId: string;
}

interface AnswerKeyItem {
  number: number;
  type: 'multiple_choice' | 'essay';
  correctAnswer: string;
  points: number;
  notes?: string;
}

interface SavedAnswerKey {
  id: string;
  title: string;
  classId: string;
  subject: string;
  assessmentCategory: 'tugas' | 'ulanganHarian' | 'pts' | 'pas';
  items: AnswerKeyItem[];
  createdBy?: string;
  updatedAt?: any;
}

interface GradedItem {
  number: number;
  type: 'multiple_choice' | 'essay';
  correctAnswer: string;
  maxPoints: number;
  detectedAnswer: string;
  isCorrect: boolean;
  earnedPoints: number;
  confidence: 'high' | 'medium' | 'low';
  feedback: string;
}

interface GradingResult {
  detectedStudentName: string;
  paperLegibility: 'clear' | 'moderate' | 'blurry';
  overallNotes: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalEarnedPoints: number;
  totalMaxPoints: number;
  scoreScale100: number;
  items: GradedItem[];
}

interface OfflineHistoryRecord {
  id: string;
  keyId?: string;
  title: string;
  classId: string;
  subject: string;
  assessmentCategory: 'tugas' | 'ulanganHarian' | 'pts' | 'pas';
  studentId: string;
  studentName: string;
  studentAbsen?: string;
  scoreScale100: number;
  totalEarnedPoints: number;
  totalMaxPoints: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
  items: GradedItem[];
  gradedBy: string;
  gradedAtIso: string;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

const CATEGORY_LABELS: Record<'tugas' | 'ulanganHarian' | 'pts' | 'pas', string> = {
  tugas: 'Nilai Tugas',
  ulanganHarian: 'Ulangan Harian (UH)',
  pts: 'PTS (Tengah Semester)',
  pas: 'PAS (Akhir Semester)'
};

function createDefaultMcqItems(count: number): AnswerKeyItem[] {
  return Array.from({ length: count }, (_, idx) => ({
    number: idx + 1,
    type: 'multiple_choice',
    correctAnswer: 'A',
    points: Math.round((100 / count) * 10) / 10,
    notes: ''
  }));
}

export default function OfflineGrader() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';

  const [selectedClass, setSelectedClass] = useState<string>(
    isAdmin ? 'Kelas 1 A' : (userData?.assigned_class || 'Kelas 1 A')
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [savedKeys, setSavedKeys] = useState<SavedAnswerKey[]>([]);
  const [historyRecords, setHistoryRecords] = useState<OfflineHistoryRecord[]>([]);

  // Active Answer Key State (Tahap 1)
  const [activeKeyId, setActiveKeyId] = useState<string>('');
  const [examTitle, setExamTitle] = useState<string>('Latihan / Ulangan Offline');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [assessmentCategory, setAssessmentCategory] = useState<'tugas' | 'ulanganHarian' | 'pts' | 'pas'>('ulanganHarian');
  const [answerKey, setAnswerKey] = useState<AnswerKeyItem[]>(() => createDefaultMcqItems(10));
  const [bulkKeyInput, setBulkKeyInput] = useState<string>('');
  const [quickMcqCount, setQuickMcqCount] = useState<number>(10);
  const [savingKey, setSavingKey] = useState<boolean>(false);

  // Photo Upload & Student State (Tahap 2)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [isZoomOpen, setIsZoomOpen] = useState<boolean>(false);

  // Grading State (Tahap 3)
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [savingGrade, setSavingGrade] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const effectiveSubject = selectedSubject === '__custom__'
    ? customSubject.trim()
    : (selectedSubject || subjects[0] || customSubject.trim() || 'Umum');

  // Load Students, Subjects, Saved Answer Keys, and History for selectedClass
  useEffect(() => {
    const variants = getClassVariants(selectedClass);
    const qStudents = variants.length === 1
      ? query(collection(db, 'students'), where('classId', '==', variants[0]))
      : query(collection(db, 'students'), where('classId', 'in', variants.length > 0 ? variants : [selectedClass]));

    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      list.sort((a, b) => {
        const numA = parseInt(a.absen_number || '999', 10);
        const numB = parseInt(b.absen_number || '999', 10);
        if (numA !== numB) return numA - numB;
        return a.name.localeCompare(b.name);
      });
      setStudents(list);
      if (list.length > 0 && !list.some(s => s.id === selectedStudentId)) {
        setSelectedStudentId(list[0].id);
      } else if (list.length === 0) {
        setSelectedStudentId('');
      }
    });

    const unsubSubjects = onSnapshot(doc(db, 'mata_pelajaran', selectedClass), (docSnap) => {
      if (docSnap.exists()) {
        const list = (docSnap.data().subjects || []) as string[];
        setSubjects(list);
        if (list.length > 0 && !selectedSubject) {
          setSelectedSubject(list[0]);
        }
      } else {
        setSubjects([]);
      }
    });

    const qKeys = query(collection(db, 'kunci_jawaban_offline'), where('classId', '==', selectedClass));
    const unsubKeys = onSnapshot(qKeys, (snap) => {
      const keys = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedAnswerKey));
      setSavedKeys(keys);
    });

    const qHistory = query(
      collection(db, 'koreksi_foto_offline'),
      where('classId', '==', selectedClass),
      orderBy('gradedAtIso', 'desc')
    );
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      setHistoryRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as OfflineHistoryRecord)));
    }, () => {
      // Fallback without orderBy if composite index isn't created yet
      const qFallback = query(collection(db, 'koreksi_foto_offline'), where('classId', '==', selectedClass));
      onSnapshot(qFallback, (snap2) => {
        const rows = snap2.docs.map(d => ({ id: d.id, ...d.data() } as OfflineHistoryRecord));
        rows.sort((a, b) => (b.gradedAtIso || '').localeCompare(a.gradedAtIso || ''));
        setHistoryRecords(rows);
      });
    });

    return () => {
      unsubStudents();
      unsubSubjects();
      unsubKeys();
      unsubHistory();
    };
  }, [selectedClass]);

  // Clean up object URLs on change/unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectedStudent = useMemo(
    () => students.find(s => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  // Set of studentIds already graded for current examTitle + effectiveSubject
  const gradedStudentIdsForCurrentTitle = useMemo(() => {
    const cleanTitle = examTitle.trim().toLowerCase();
    const cleanSubj = effectiveSubject.trim().toLowerCase();
    const set = new Set<string>();
    historyRecords.forEach(r => {
      if (r.title.trim().toLowerCase() === cleanTitle && r.subject.trim().toLowerCase() === cleanSubj) {
        set.add(r.studentId);
      }
    });
    return set;
  }, [historyRecords, examTitle, effectiveSubject]);

  const totalKeyPoints = useMemo(
    () => Math.round(answerKey.reduce((sum, item) => sum + (Number(item.points) || 0), 0) * 10) / 10,
    [answerKey]
  );

  // Answer Key Actions
  const handleApplyBulkKey = () => {
    const raw = bulkKeyInput.trim();
    if (!raw) {
      showToast('Masukkan daftar kunci jawaban terlebih dahulu, misal: 1.A 2.B 3.C atau ABCDA.', 'error');
      return;
    }

    // Parse patterns like "1.A 2.B" or "1: A, 2: C" or raw letters "A B C D E"
    const numberedMatches = Array.from(raw.matchAll(/(\d{1,3})\s*[\.\:\)\-]?\s*([A-Ea-e])\b/g));
    let parsedLetters: { num: number; letter: string }[] = [];

    if (numberedMatches.length > 0) {
      parsedLetters = numberedMatches.map(m => ({
        num: parseInt(m[1], 10),
        letter: m[2].toUpperCase()
      }));
    } else {
      const compact = raw.replace(/[^A-Ea-e]/g, '').toUpperCase();
      parsedLetters = compact.split('').map((ch, idx) => ({ num: idx + 1, letter: ch }));
    }

    if (parsedLetters.length === 0) {
      showToast('Format kunci PG tidak dikenali. Gunakan huruf A-E seperti "1.A 2.C 3.B" atau "ACBDA".', 'error');
      return;
    }

    const maxNum = Math.max(...parsedLetters.map(p => p.num), parsedLetters.length);
    const pointPerItem = Math.round((100 / maxNum) * 10) / 10;
    const mapByNum = new Map<number, string>();
    parsedLetters.forEach(p => mapByNum.set(p.num, p.letter));

    const newItems: AnswerKeyItem[] = Array.from({ length: maxNum }, (_, idx) => {
      const num = idx + 1;
      return {
        number: num,
        type: 'multiple_choice',
        correctAnswer: mapByNum.get(num) || answerKey[idx]?.correctAnswer || 'A',
        points: pointPerItem,
        notes: ''
      };
    });

    setAnswerKey(newItems);
    setQuickMcqCount(newItems.length);
    showToast(`Berhasil menerapkan ${newItems.length} kunci jawaban Pilihan Ganda.`, 'success');
  };

  const handleGenerateMcqTemplate = (count: number) => {
    const safeCount = Math.min(Math.max(count, 1), 100);
    setQuickMcqCount(safeCount);
    setAnswerKey(createDefaultMcqItems(safeCount));
    showToast(`Templat ${safeCount} soal Pilihan Ganda siap diisi.`, 'success');
  };

  const handleNormalizePointsTo100 = () => {
    if (answerKey.length === 0) return;
    const perItem = Math.floor((100 / answerKey.length) * 10) / 10;
    const remainder = Math.round((100 - perItem * answerKey.length) * 10) / 10;
    setAnswerKey(prev =>
      prev.map((item, idx) => ({
        ...item,
        points: idx === prev.length - 1 ? Math.round((perItem + remainder) * 10) / 10 : perItem
      }))
    );
    showToast('Bobot seluruh soal diratakan agar total bernilai 100 poin.', 'success');
  };

  const handleAddKeyItem = (type: 'multiple_choice' | 'essay') => {
    setAnswerKey(prev => {
      const nextNum = prev.length > 0 ? Math.max(...prev.map(i => i.number)) + 1 : 1;
      return [
        ...prev,
        {
          number: nextNum,
          type,
          correctAnswer: type === 'multiple_choice' ? 'A' : '',
          points: type === 'multiple_choice' ? 10 : 20,
          notes: ''
        }
      ];
    });
  };

  const handleUpdateKeyItem = (index: number, patch: Partial<AnswerKeyItem>) => {
    setAnswerKey(prev => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const handleRemoveKeyItem = (index: number) => {
    setAnswerKey(prev =>
      prev
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, number: idx + 1 }))
    );
  };

  const handleSaveKeyTemplate = async () => {
    if (!examTitle.trim()) {
      showToast('Isi Judul Ujian / Tugas terlebih dahulu.', 'error');
      return;
    }
    if (answerKey.length === 0 || answerKey.some(i => !String(i.correctAnswer).trim())) {
      showToast('Pastikan seluruh nomor soal sudah memiliki kunci jawaban.', 'error');
      return;
    }

    setSavingKey(true);
    try {
      const payload = {
        title: examTitle.trim(),
        classId: selectedClass,
        subject: effectiveSubject,
        assessmentCategory,
        items: answerKey,
        createdBy: userData?.name || 'Guru',
        updatedAt: serverTimestamp()
      };

      if (activeKeyId) {
        await setDoc(doc(db, 'kunci_jawaban_offline', activeKeyId), payload, { merge: true });
        showToast('Perubahan kunci jawaban berhasil disimpan!', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'kunci_jawaban_offline'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        setActiveKeyId(docRef.id);
        showToast('Kunci jawaban baru berhasil disimpan dan siap dipakai untuk seluruh siswa!', 'success');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Gagal menyimpan kunci jawaban: ' + (err?.message || 'Error'), 'error');
    } finally {
      setSavingKey(false);
    }
  };

  const handleLoadSavedKey = (saved: SavedAnswerKey) => {
    setActiveKeyId(saved.id);
    setExamTitle(saved.title);
    setAssessmentCategory(saved.assessmentCategory || 'ulanganHarian');
    if (subjects.includes(saved.subject)) {
      setSelectedSubject(saved.subject);
    } else {
      setSelectedSubject('__custom__');
      setCustomSubject(saved.subject);
    }
    setAnswerKey(saved.items || []);
    setGradingResult(null);
    showToast(`Kunci jawaban "${saved.title}" dimuat.`, 'success');
  };

  const handleDeleteSavedKey = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'kunci_jawaban_offline', id));
      if (activeKeyId === id) setActiveKeyId('');
      showToast('Template kunci jawaban dihapus.', 'success');
    } catch (err: any) {
      showToast('Gagal menghapus template: ' + (err?.message || ''), 'error');
    }
  };

  // Image handling & optional rotation via canvas before upload
  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRotationDeg(0);
    setGradingResult(null);
    e.target.value = '';
  };

  const buildOrientedImageBlob = async (file: File, deg: number): Promise<Blob> => {
    const normalizedDeg = ((deg % 360) + 360) % 360;
    if (normalizedDeg === 0 || file.type === 'application/pdf') return file;

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const swap = normalizedDeg === 90 || normalizedDeg === 270;
        canvas.width = swap ? img.height : img.width;
        canvas.height = swap ? img.width : img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(file);
          return;
        }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((normalizedDeg * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => resolve(blob || file),
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          0.92
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  };

  const handleRunAutoGrade = async () => {
    if (answerKey.length === 0 || answerKey.some(k => !String(k.correctAnswer).trim())) {
      showToast('Lengkapi seluruh kunci jawaban guru terlebih dahulu sebelum mengoreksi foto.', 'error');
      return;
    }
    if (!selectedFile) {
      showToast('Unggah atau ambil foto lembar jawaban siswa terlebih dahulu.', 'error');
      return;
    }

    setIsGrading(true);
    setGradingResult(null);
    try {
      const uploadBlob = await buildOrientedImageBlob(selectedFile, rotationDeg);
      const formData = new FormData();
      formData.append('file', uploadBlob, selectedFile.name || 'lembar_jawaban.jpg');
      formData.append('answerKey', JSON.stringify(answerKey));
      formData.append('subject', effectiveSubject);
      formData.append('title', examTitle.trim());
      formData.append('studentName', selectedStudent?.name || '');

      const res = await fetch('/api/grade-offline-photo', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.result) {
        throw new Error(data.error || 'Gagal memproses koreksi foto.');
      }

      setGradingResult(data.result as GradingResult);
      showToast(
        `Koreksi selesai! Skor: ${data.result.scoreScale100} (${data.result.correctCount} benar dari ${data.result.totalQuestions} soal).`,
        'success'
      );
    } catch (err: any) {
      console.error('Auto-grade error:', err);
      showToast(err?.message || 'Gagal melakukan koreksi otomatis.', 'error');
    } finally {
      setIsGrading(false);
    }
  };

  // Manual teacher override per question item
  const recalculateResultTotals = (items: GradedItem[], prev: GradingResult): GradingResult => {
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let totalEarnedPoints = 0;
    let totalMaxPoints = 0;

    items.forEach(it => {
      totalMaxPoints += Number(it.maxPoints) || 0;
      totalEarnedPoints += Number(it.earnedPoints) || 0;
      const ans = String(it.detectedAnswer || '').trim().toUpperCase();
      if (!ans || ans === 'KOSONG') {
        unansweredCount++;
      } else if (it.isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    const scoreScale100 = totalMaxPoints > 0 ? Math.round((totalEarnedPoints / totalMaxPoints) * 100) : 0;

    return {
      ...prev,
      items,
      correctCount,
      wrongCount,
      unansweredCount,
      totalEarnedPoints: Math.round(totalEarnedPoints * 10) / 10,
      totalMaxPoints: Math.round(totalMaxPoints * 10) / 10,
      scoreScale100
    };
  };

  const handleToggleItemCorrect = (index: number) => {
    if (!gradingResult) return;
    const nextItems = gradingResult.items.map((item, idx) => {
      if (idx !== index) return item;
      const nextCorrect = !item.isCorrect;
      return {
        ...item,
        isCorrect: nextCorrect,
        earnedPoints: nextCorrect ? item.maxPoints : 0,
        feedback: nextCorrect ? 'Ditetapkan Benar oleh Guru' : 'Ditetapkan Salah oleh Guru'
      };
    });
    setGradingResult(recalculateResultTotals(nextItems, gradingResult));
  };

  const handleEditItemPoints = (index: number, rawPoints: string) => {
    if (!gradingResult) return;
    const val = Math.max(0, parseFloat(rawPoints) || 0);
    const nextItems = gradingResult.items.map((item, idx) => {
      if (idx !== index) return item;
      const clamped = Math.min(item.maxPoints, val);
      return {
        ...item,
        earnedPoints: clamped,
        isCorrect: clamped >= item.maxPoints * 0.6
      };
    });
    setGradingResult(recalculateResultTotals(nextItems, gradingResult));
  };

  const handleEditDetectedAnswer = (index: number, newVal: string) => {
    if (!gradingResult) return;
    const nextItems = gradingResult.items.map((item, idx) => {
      if (idx !== index) return item;
      if (item.type === 'multiple_choice') {
        const clean = newVal.trim().toUpperCase().slice(0, 1);
        const match = clean === item.correctAnswer.trim().toUpperCase().slice(0, 1);
        return {
          ...item,
          detectedAnswer: clean || 'KOSONG',
          isCorrect: match,
          earnedPoints: match ? item.maxPoints : 0
        };
      }
      return {
        ...item,
        detectedAnswer: newVal
      };
    });
    setGradingResult(recalculateResultTotals(nextItems, gradingResult));
  };

  // Save grading result to Firestore & sync to Rapor (grades collection)
  const handleSaveGradeToRapor = async () => {
    if (!gradingResult) return;
    if (!selectedStudent) {
      showToast('Pilih nama siswa terlebih dahulu sebelum menyimpan nilai.', 'error');
      return;
    }

    setSavingGrade(true);
    try {
      const nowIso = new Date().toISOString();
      const historyDocId = `${selectedStudent.id}_${(examTitle.trim() || 'ujian').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32)}_${Date.now()}`;

      // 1. Simpan riwayat detail koreksi foto
      await setDoc(doc(db, 'koreksi_foto_offline', historyDocId), {
        keyId: activeKeyId || '',
        title: examTitle.trim() || 'Penilaian Offline',
        classId: selectedClass,
        subject: effectiveSubject,
        assessmentCategory,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        studentAbsen: selectedStudent.absen_number || '',
        scoreScale100: gradingResult.scoreScale100,
        totalEarnedPoints: gradingResult.totalEarnedPoints,
        totalMaxPoints: gradingResult.totalMaxPoints,
        correctCount: gradingResult.correctCount,
        wrongCount: gradingResult.wrongCount,
        unansweredCount: gradingResult.unansweredCount,
        totalQuestions: gradingResult.totalQuestions,
        items: gradingResult.items,
        gradedBy: userData?.name || 'Guru',
        gradedAtIso: nowIso,
        createdAt: serverTimestamp()
      });

      // 2. Sinkronkan nilai ke koleksi grades/{student.id} pada mata pelajaran & kategori yang sesuai
      const gradeRef = doc(db, 'grades', selectedStudent.id);
      const gradeSnap = await getDoc(gradeRef);
      const existingData = gradeSnap.exists() ? gradeSnap.data() : {};
      const gradesBySubject = existingData.gradesBySubject || {};
      const currentSubj = gradesBySubject[effectiveSubject] || {
        tugas: [],
        ulanganHarian: [],
        pts: '',
        pas: ''
      };

      const scoreStr = String(gradingResult.scoreScale100);
      const updatedSubj = { ...currentSubj };

      if (assessmentCategory === 'tugas') {
        const list = Array.isArray(currentSubj.tugas)
          ? currentSubj.tugas.map((x: any) => String(x).trim()).filter(Boolean)
          : currentSubj.tugas ? [String(currentSubj.tugas)] : [];
        updatedSubj.tugas = [...list, scoreStr];
      } else if (assessmentCategory === 'ulanganHarian') {
        const list = Array.isArray(currentSubj.ulanganHarian)
          ? currentSubj.ulanganHarian.map((x: any) => String(x).trim()).filter(Boolean)
          : currentSubj.ulanganHarian ? [String(currentSubj.ulanganHarian)] : [];
        updatedSubj.ulanganHarian = [...list, scoreStr];
      } else if (assessmentCategory === 'pts') {
        updatedSubj.pts = scoreStr;
      } else if (assessmentCategory === 'pas') {
        updatedSubj.pas = scoreStr;
      }

      await setDoc(
        gradeRef,
        {
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          classId: selectedClass,
          gradesBySubject: {
            ...gradesBySubject,
            [effectiveSubject]: updatedSubj
          },
          academicYearId: existingData.academicYearId || 'active',
          lastUpdatedFromOfflineGrader: serverTimestamp()
        },
        { merge: true }
      );

      if (userData) {
        await logActivity(
          userData.name,
          userData.assigned_class || 'Admin',
          `Menyimpan hasil koreksi foto offline "${examTitle}" untuk ${selectedStudent.name} (${effectiveSubject}: ${gradingResult.scoreScale100})`
        );
      }

      showToast(
        `Nilai ${selectedStudent.name} (${gradingResult.scoreScale100}) tersimpan ke Riwayat & Rapor (${CATEGORY_LABELS[assessmentCategory]} ${effectiveSubject}).`,
        'success'
      );
    } catch (err: any) {
      console.error('Save grade error:', err);
      showToast('Gagal menyimpan nilai ke rapor: ' + (err?.message || 'Error'), 'error');
    } finally {
      setSavingGrade(false);
    }
  };

  const handleNextStudent = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl('');
    setRotationDeg(0);
    setGradingResult(null);

    if (students.length > 0) {
      const currentIdx = students.findIndex(s => s.id === selectedStudentId);
      const nextUngraded = students.find(
        (s, idx) => idx > currentIdx && !gradedStudentIdsForCurrentTitle.has(s.id)
      );
      if (nextUngraded) {
        setSelectedStudentId(nextUngraded.id);
      } else if (currentIdx >= 0 && currentIdx + 1 < students.length) {
        setSelectedStudentId(students[currentIdx + 1].id);
      }
    }
  };

  const handleExportHistoryPDF = () => {
    if (historyRecords.length === 0) {
      showToast('Belum ada data hasil koreksi offline untuk dicetak.', 'error');
      return;
    }
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('REKAP HASIL KOREKSI FOTO LEMBAR JAWABAN OFFLINE', 105, 15, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.text(`Kelas: ${selectedClass}  •  Total Data: ${historyRecords.length} Siswa`, 105, 21, { align: 'center' });

    autoTable(pdf, {
      startY: 27,
      head: [['No', 'Absen', 'Nama Siswa', 'Judul & Mapel', 'Benar / Soal', 'Nilai']],
      body: historyRecords.map((r, i) => [
        String(i + 1),
        r.studentAbsen || '-',
        r.studentName,
        `${r.title}\n(${r.subject})`,
        `${r.correctCount} / ${r.totalQuestions}`,
        String(r.scoreScale100)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [67, 56, 202] },
      styles: { fontSize: 8.5, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 26, halign: 'center' },
        5: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
      }
    });

    pdf.save(`Rekap_Koreksi_Foto_${selectedClass.replace(/\s+/g, '_')}.pdf`);
    showToast('Rekap PDF hasil koreksi berhasil diunduh.', 'success');
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'koreksi_foto_offline', id));
      showToast('Riwayat koreksi dihapus.', 'success');
    } catch (err: any) {
      showToast('Gagal menghapus riwayat.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Koreksi Otomatis Foto Soal Offline
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Masukkan kunci jawaban guru terlebih dahulu, lalu unggah foto lembar jawaban kertas siswa untuk dinilai otomatis ke rapor.
              </p>
            </div>
          </div>
        </div>

        {/* Context Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin ? (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ALL_AVAILABLE_CLASSES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <div className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              {selectedClass}
            </div>
          )}

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="__custom__">Mapel Lainnya (Ketik Manual)</option>
          </select>

          {selectedSubject === '__custom__' && (
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Nama Mapel..."
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 w-36"
            />
          )}

          <select
            value={assessmentCategory}
            onChange={(e) => setAssessmentCategory(e.target.value as any)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ulanganHarian">Masuk ke: Ulangan Harian</option>
            <option value="tugas">Masuk ke: Nilai Tugas</option>
            <option value="pts">Masuk ke: Nilai PTS</option>
            <option value="pas">Masuk ke: Nilai PAS</option>
          </select>
        </div>
      </div>

      {/* Main 2-Column Workbench */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* TAHAP 1: KUNCI JAWABAN GURU (5 cols) */}
        <section className="xl:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-850/40">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">1</span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Kunci Jawaban Guru</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Wajib diisi lebih dulu sebelum koreksi foto</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveKeyTemplate}
              disabled={savingKey}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{activeKeyId ? 'Perbarui Kunci' : 'Simpan Kunci'}</span>
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* Saved Key Templates */}
            {savedKeys.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Gunakan Kunci Jawaban Tersimpan ({selectedClass})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {savedKeys.map(k => (
                    <div
                      key={k.id}
                      className={`inline-flex items-center rounded-xl border text-xs transition-colors ${
                        activeKeyId === k.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleLoadSavedKey(k)}
                        className="px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>{k.title} ({k.items?.length || 0} soal)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedKey(k.id)}
                        className="pr-2 pl-1 py-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                        title="Hapus template"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {activeKeyId && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveKeyId('');
                        setExamTitle('Latihan / Ulangan Offline Baru');
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 hover:text-indigo-600 cursor-pointer"
                    >
                      + Buat Kunci Baru
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Judul Soal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Soal / Ujian
              </label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="Contoh: UH 1 Matematika Bab Pecahan"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Quick Generator & Bulk Paste */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Isi Cepat Kunci Pilihan Ganda
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Jumlah Soal:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={quickMcqCount}
                    onChange={(e) => setQuickMcqCount(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="w-14 px-2 py-1 text-center text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerateMcqTemplate(quickMcqCount)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer"
                  >
                    Buat Grid
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={bulkKeyInput}
                  onChange={(e) => setBulkKeyInput(e.target.value)}
                  placeholder="Tempel cepat: 1.A 2.C 3.B 4.D atau ABCD..."
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleApplyBulkKey}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  Terapkan
                </button>
              </div>
            </div>

            {/* Summary Bar & Point Normalizer */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="text-slate-600 dark:text-slate-300 font-medium tabular-nums">
                Total: <strong className="text-slate-900 dark:text-white">{answerKey.length} soal</strong> • Bobot Maks: <strong className="text-indigo-600 dark:text-indigo-400">{totalKeyPoints} poin</strong>
              </div>
              <button
                type="button"
                onClick={handleNormalizePointsTo100}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Samakan Total = 100 Poin
              </button>
            </div>

            {/* Answer Key List */}
            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
              {answerKey.map((item, idx) => (
                <div
                  key={`${item.number}-${idx}`}
                  className="p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-850/40 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                        {item.number}
                      </span>
                      <select
                        value={item.type}
                        onChange={(e) =>
                          handleUpdateKeyItem(idx, {
                            type: e.target.value as 'multiple_choice' | 'essay',
                            correctAnswer: e.target.value === 'multiple_choice' ? 'A' : ''
                          })
                        }
                        className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none"
                      >
                        <option value="multiple_choice">PG</option>
                        <option value="essay">Isian/Uraian</option>
                      </select>

                      {item.type === 'multiple_choice' && (
                        <div className="flex items-center gap-1">
                          {OPTION_LETTERS.map(letter => (
                            <button
                              key={letter}
                              type="button"
                              onClick={() => handleUpdateKeyItem(idx, { correctAnswer: letter })}
                              className={`w-7 h-7 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                item.correctAnswer.toUpperCase() === letter
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              {letter}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={item.points}
                        onChange={(e) => handleUpdateKeyItem(idx, { points: parseFloat(e.target.value) || 1 })}
                        title="Bobot poin soal ini"
                        className="w-14 px-1.5 py-1 text-center text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 tabular-nums"
                      />
                      <span className="text-[10px] text-slate-400">pt</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyItem(idx)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Hapus nomor ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.type === 'essay' && (
                    <div className="grid grid-cols-1 gap-1.5 pl-9">
                      <input
                        type="text"
                        value={item.correctAnswer}
                        onChange={(e) => handleUpdateKeyItem(idx, { correctAnswer: e.target.value })}
                        placeholder="Kunci jawaban singkat / poin inti jawaban..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleAddKeyItem('multiple_choice')}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah PG</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddKeyItem('essay')}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Isian / Uraian</span>
              </button>
            </div>
          </div>
        </section>

        {/* TAHAP 2 & 3: UPLOAD FOTO SISWA & HASIL KOREKSI OTOMATIS (7 cols) */}
        <section className="xl:col-span-7 space-y-6">
          {/* Card Upload & Pilih Siswa */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-850/40">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">2</span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Pilih Siswa & Foto Lembar Jawaban</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ambil foto langsung dari kamera HP atau unggah gambar kertas soal / LJK siswa
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                Sudah dikoreksi: <strong className="text-emerald-600 dark:text-emerald-400">{gradedStudentIdsForCurrentTitle.size}</strong> / {students.length} siswa
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Student Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Pilih Siswa ({selectedClass})
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => {
                      setSelectedStudentId(e.target.value);
                      setGradingResult(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {students.length === 0 ? (
                      <option value="">Belum ada siswa terdaftar di kelas ini</option>
                    ) : (
                      students.map((s, idx) => {
                        const isDone = gradedStudentIdsForCurrentTitle.has(s.id);
                        return (
                          <option key={s.id} value={s.id}>
                            {s.absen_number ? `No. ${s.absen_number}` : `#${idx + 1}`} — {s.name} {isDone ? '(Sudah Dikoreksi)' : ''}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                <div className="sm:col-span-4 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChosen}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChosen}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Kamera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Galeri</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone / Preview */}
              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer bg-slate-50/50 dark:bg-slate-850/30"
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Klik untuk mengunggah foto lembar jawaban siswa
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Mendukung foto LJK, lembar jawaban tulisan tangan, atau soal pilihan ganda yang disilang/dilingkari (JPG, PNG, WEBP)
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center min-h-[260px] max-h-[380px]">
                    {selectedFile.type === 'application/pdf' ? (
                      <div className="p-6 text-center">
                        <BookOpen className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500 mt-1">Dokumen PDF siap dikoreksi</p>
                      </div>
                    ) : (
                      <img
                        src={previewUrl}
                        alt="Pratinjau Lembar Jawaban"
                        className="max-h-[360px] w-auto object-contain transition-transform duration-200 cursor-zoom-in"
                        style={{ transform: `rotate(${rotationDeg}deg)` }}
                        onClick={() => setIsZoomOpen(true)}
                      />
                    )}

                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      {selectedFile.type !== 'application/pdf' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setRotationDeg(prev => (prev + 90) % 360)}
                            className="p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-white cursor-pointer"
                            title="Putar foto 90 derajat"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsZoomOpen(true)}
                            className="p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-white cursor-pointer"
                            title="Perbesar foto"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (previewUrl) URL.revokeObjectURL(previewUrl);
                          setSelectedFile(null);
                          setPreviewUrl('');
                          setGradingResult(null);
                        }}
                        className="p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 text-red-600 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-red-50 cursor-pointer"
                        title="Hapus foto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunAutoGrade}
                    disabled={isGrading}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.99]"
                  >
                    {isGrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Membaca Jawaban & Mencocokkan Kunci Guru...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Proses Koreksi Otomatis Sekarang</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* TAHAP 3: HASIL KOREKSI & VERIFIKASI GURU */}
          {gradingResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-850/40">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">3</span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Hasil Koreksi: {selectedStudent?.name || gradingResult.detectedStudentName || 'Siswa'}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Guru dapat meninjau & menyesuaikan hasil secara manual sebelum disimpan ke Rapor
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNextStudent}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Siswa Berikutnya</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGradeToRapor}
                    disabled={savingGrade || !selectedStudent}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {savingGrade ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                    <span>{savingGrade ? 'Menyimpan...' : 'Simpan Nilai ke Rapor'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {/* Summary Score Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 tabular-nums">
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-center">
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block">Nilai Akhir</span>
                    <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{gradingResult.scoreScale100}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Total Poin</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-white">
                      {gradingResult.totalEarnedPoints} / {gradingResult.totalMaxPoints}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">Benar</span>
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{gradingResult.correctCount}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 block">Salah</span>
                    <span className="text-lg font-bold text-rose-700 dark:text-rose-300">{gradingResult.wrongCount}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">Kosong</span>
                    <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{gradingResult.unansweredCount}</span>
                  </div>
                </div>

                {gradingResult.overallNotes && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                    <strong>Catatan Pembacaan Lembar Jawaban:</strong> {gradingResult.overallNotes}
                    {gradingResult.detectedStudentName && (
                      <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                        (Nama di kertas: {gradingResult.detectedStudentName})
                      </span>
                    )}
                  </div>
                )}

                {/* Per-Number Verification Table */}
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        <th className="px-3 py-2.5 font-bold text-center w-12">No</th>
                        <th className="px-3 py-2.5 font-bold text-center w-20">Kunci</th>
                        <th className="px-3 py-2.5 font-bold">Jawaban Siswa (Terbaca)</th>
                        <th className="px-3 py-2.5 font-bold text-center w-28">Status</th>
                        <th className="px-3 py-2.5 font-bold text-center w-24">Poin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {gradingResult.items.map((item, idx) => (
                        <tr key={item.number} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2.5 text-center font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                            {item.number}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                              {item.correctAnswer}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 space-y-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.detectedAnswer}
                                onChange={(e) => handleEditDetectedAnswer(idx, e.target.value)}
                                className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white w-full max-w-[180px] outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              {item.confidence === 'low' && (
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                                  Perlu Cek
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.feedback}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleItemCorrect(idx)}
                              title="Klik untuk ubah status Benar / Salah"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border cursor-pointer transition-colors ${
                                item.isCorrect
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              }`}
                            >
                              {item.isCorrect ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Benar</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Salah</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={item.maxPoints}
                                step={0.5}
                                value={item.earnedPoints}
                                onChange={(e) => handleEditItemPoints(idx, e.target.value)}
                                className="w-12 px-1 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-white"
                              />
                              <span className="text-[10px] text-slate-400">/{item.maxPoints}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Riwayat Koreksi Offline Kelas */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Riwayat Hasil Koreksi Foto Offline ({selectedClass})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nilai yang disimpan otomatis tersinkron ke tabel Penilaian & Rapor kelas.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportHistoryPDF}
            disabled={historyRecords.length === 0}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Unduh Rekap PDF</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3 font-semibold">Siswa</th>
                <th className="px-5 py-3 font-semibold">Penilaian & Mapel</th>
                <th className="px-5 py-3 font-semibold text-center">Benar / Soal</th>
                <th className="px-5 py-3 font-semibold text-center">Nilai Akhir</th>
                <th className="px-5 py-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {historyRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                    Belum ada hasil koreksi foto offline yang disimpan untuk {selectedClass}.
                  </td>
                </tr>
              ) : (
                historyRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-800 dark:text-white">{rec.studentName}</p>
                      <p className="text-[11px] text-slate-400">
                        {rec.studentAbsen ? `No. Absen ${rec.studentAbsen}` : 'Siswa'} • Oleh {rec.gradedBy}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">{rec.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {rec.subject} • {CATEGORY_LABELS[rec.assessmentCategory] || rec.assessmentCategory}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                      {rec.correctCount} / {rec.totalQuestions}
                    </td>
                    <td className="px-5 py-3.5 text-center tabular-nums">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs ${
                          rec.scoreScale100 >= 75
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {rec.scoreScale100}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteHistory(rec.id)}
                        className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="Hapus riwayat koreksi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Zoom Foto Lembar Jawaban */}
      {isZoomOpen && previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsZoomOpen(false)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewUrl}
            alt="Lembar Jawaban Diperbesar"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            style={{ transform: `rotate(${rotationDeg}deg)` }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
