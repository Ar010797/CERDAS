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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/activity';
import { ALL_AVAILABLE_CLASSES, getClassVariants, sortStudentsAlphabetically } from '../../lib/schoolClasses';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Camera,
  Upload,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Sparkles,
  BookOpen,
  FileDown,
  Loader2,
  ArrowRight,
  KeyRound,
  ZoomIn,
  X,
  ClipboardCheck,
  ShieldCheck,
  Eye,
  Calendar,
  UserCheck,
  Lock,
  Image as ImageIcon,
  Check
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
  assessmentCategory: AssessmentCategory;
  items: AnswerKeyItem[];
  createdBy?: string;
  updatedAt?: any;
}

type AssessmentCategory = 'tugas' | 'ulanganHarian' | 'pts' | 'pas';
type DetectionStatus = 'clear' | 'corrected' | 'multiple_answers' | 'unclear' | 'empty';
type QualityStatus = 'good' | 'blurry' | 'cropped' | 'too_dark' | 'tilted';

interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

interface GradedItem {
  number: number;
  type: 'multiple_choice' | 'essay';
  correctAnswer: string;
  maxPoints: number;
  rawMarksObserved: string;
  detectedAnswer: string;
  detectionStatus: DetectionStatus;
  needsVerification: boolean;
  verifiedByTeacher: boolean;
  isCorrect: boolean;
  earnedPoints: number;
  confidence: 'high' | 'medium' | 'low';
  feedback: string;
  bbox?: BoundingBox;
  evidenceCropUrl?: string;
}

interface GradingResult {
  isPhotoAcceptable: boolean;
  qualityStatus: QualityStatus;
  qualityIssues: string[];
  qualityFeedback: string;
  overallNotes: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  verificationRequiredCount: number;
  totalEarnedPoints: number;
  totalMaxPoints: number;
  scoreScale100: number;
  items: GradedItem[];
}

interface PhotoRejection {
  qualityStatus: QualityStatus;
  qualityIssues: string[];
  qualityFeedback: string;
}

interface OfflineHistoryRecord {
  id: string;
  keyId?: string;
  title: string;
  classId: string;
  subject: string;
  assessmentCategory: AssessmentCategory;
  assessmentDate?: string;
  studentId: string;
  studentName: string;
  studentAbsen?: string;
  studentSource?: 'daftar_kelas' | 'input_manual';
  scoreScale100: number;
  totalEarnedPoints: number;
  totalMaxPoints: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
  qualityStatus?: QualityStatus;
  originalPhotoUrl?: string;
  items: GradedItem[];
  verifiedBy?: string;
  approvedAtIso?: string;
  gradedBy: string;
  gradedAtIso: string;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

const CATEGORY_OPTIONS: { value: AssessmentCategory; shortLabel: string; label: string; targetDesc: string }[] = [
  { value: 'tugas', shortLabel: 'Tugas', label: 'Tugas', targetDesc: 'Masuk ke kolom Nilai Tugas' },
  { value: 'ulanganHarian', shortLabel: 'UH', label: 'UH (Ulangan Harian)', targetDesc: 'Masuk ke kolom Ulangan Harian' },
  { value: 'pts', shortLabel: 'UTS', label: 'UTS (Tengah Semester)', targetDesc: 'Masuk ke kolom UTS / PTS' },
  { value: 'pas', shortLabel: 'UAS', label: 'UAS (Akhir Semester)', targetDesc: 'Masuk ke kolom UAS / PAS' }
];

const CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  tugas: 'Tugas',
  ulanganHarian: 'UH (Ulangan Harian)',
  pts: 'UTS (Tengah Semester)',
  pas: 'UAS (Akhir Semester)'
};

const QUALITY_LABELS: Record<QualityStatus, string> = {
  good: 'Foto Layak',
  blurry: 'Foto Buram / Tidak Fokus',
  cropped: 'Lembar Jawaban Terpotong',
  too_dark: 'Pencahayaan Terlalu Gelap',
  tilted: 'Sudut Foto Terlalu Miring'
};

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function createDefaultMcqItems(count: number): AnswerKeyItem[] {
  return Array.from({ length: count }, (_, idx) => ({
    number: idx + 1,
    type: 'multiple_choice',
    correctAnswer: 'A',
    points: Math.round((100 / count) * 10) / 10,
    notes: ''
  }));
}

async function generateOrientedImageData(
  file: File,
  deg: number,
  maxWidth = 1600,
  quality = 0.9
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  const normalizedDeg = ((deg % 360) + 360) % 360;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const swap = normalizedDeg === 90 || normalizedDeg === 270;
      const rawW = swap ? img.height : img.width;
      const rawH = swap ? img.width : img.height;
      const scale = rawW > maxWidth ? maxWidth / rawW : 1;
      const outW = Math.max(1, Math.round(rawW * scale));
      const outH = Math.max(1, Math.round(rawH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((normalizedDeg * Math.PI) / 180);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      URL.revokeObjectURL(url);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, dataUrl, width: outW, height: outH });
          } else {
            resolve({ blob: file, dataUrl, width: outW, height: outH });
          }
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal memuat gambar'));
    };
    img.src = url;
  });
}

async function cropEvidenceThumbnails(
  orientedImageUrl: string,
  items: GradedItem[]
): Promise<GradedItem[]> {
  if (!orientedImageUrl || items.length === 0) return items;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) {
        resolve(items);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(items);
        return;
      }

      const updated = items.map((item) => {
        if (!item.bbox) return item;
        const padX = 28;
        const padY = 20;
        const ymin = Math.max(0, item.bbox.ymin - padY);
        const xmin = Math.max(0, item.bbox.xmin - padX);
        const ymax = Math.min(1000, item.bbox.ymax + padY);
        const xmax = Math.min(1000, item.bbox.xmax + padX);

        const sx = Math.floor((xmin / 1000) * iw);
        const sy = Math.floor((ymin / 1000) * ih);
        const sw = Math.max(40, Math.floor(((xmax - xmin) / 1000) * iw));
        const sh = Math.max(24, Math.floor(((ymax - ymin) / 1000) * ih));

        const targetMaxW = 240;
        const scale = sw > targetMaxW ? targetMaxW / sw : 1;
        canvas.width = Math.max(40, Math.round(sw * scale));
        canvas.height = Math.max(20, Math.round(sh * scale));

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        try {
          const cropUrl = canvas.toDataURL('image/jpeg', 0.68);
          return { ...item, evidenceCropUrl: cropUrl };
        } catch {
          return item;
        }
      });

      resolve(updated);
    };
    img.onerror = () => resolve(items);
    img.src = orientedImageUrl;
  });
}

export default function OfflineGrader() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';

  // Step 1: Identitas & Jenis Penilaian
  const [selectedClass, setSelectedClass] = useState<string>(
    isAdmin ? 'Kelas 1 A' : (userData?.assigned_class || 'Kelas 1 A')
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [studentInputMode, setStudentInputMode] = useState<'roster' | 'manual'>('roster');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [manualStudentName, setManualStudentName] = useState<string>('');
  const [manualStudentAbsen, setManualStudentAbsen] = useState<string>('');

  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [assessmentCategory, setAssessmentCategory] = useState<AssessmentCategory>('ulanganHarian');
  const [assessmentDate, setAssessmentDate] = useState<string>(getTodayDateString);
  const [examTitle, setExamTitle] = useState<string>('Penilaian Offline');

  // Step 2: Kunci Jawaban Guru
  const [savedKeys, setSavedKeys] = useState<SavedAnswerKey[]>([]);
  const [activeKeyId, setActiveKeyId] = useState<string>('');
  const [answerKey, setAnswerKey] = useState<AnswerKeyItem[]>(() => createDefaultMcqItems(10));
  const [bulkKeyInput, setBulkKeyInput] = useState<string>('');
  const [quickMcqCount, setQuickMcqCount] = useState<number>(10);
  const [savingKey, setSavingKey] = useState<boolean>(false);

  // Step 3: Unggah & Pemeriksaan Foto
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [orientedPhotoDataUrl, setOrientedPhotoDataUrl] = useState<string>('');
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [photoRejection, setPhotoRejection] = useState<PhotoRejection | null>(null);

  // Step 4: Hasil Koreksi, Bukti Potongan Foto & Verifikasi
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [teacherApprovedFinal, setTeacherApprovedFinal] = useState<boolean>(false);
  const [savingGrade, setSavingGrade] = useState<boolean>(false);

  // History & Modals
  const [historyRecords, setHistoryRecords] = useState<OfflineHistoryRecord[]>([]);
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string; rotatedDeg?: number } | null>(null);
  const [detailModalRecord, setDetailModalRecord] = useState<OfflineHistoryRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const effectiveSubject =
    selectedSubject === '__custom__'
      ? customSubject.trim()
      : selectedSubject || subjects[0] || customSubject.trim() || '';

  const selectedStudentFromRoster = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const resolvedStudentName =
    studentInputMode === 'manual'
      ? manualStudentName.trim()
      : selectedStudentFromRoster?.name || '';

  const isAnswerKeyComplete =
    answerKey.length > 0 && answerKey.every((k) => String(k.correctAnswer).trim().length > 0);

  // Pre-upload identity + assessment completeness gate
  const missingIdentityRequirements = useMemo(() => {
    const missing: string[] = [];
    if (!selectedClass) missing.push('Kelas / Rombel');
    if (!resolvedStudentName) missing.push('Nama Siswa');
    if (!effectiveSubject) missing.push('Mata Pelajaran');
    if (!assessmentCategory) missing.push('Jenis Penilaian');
    if (!assessmentDate) missing.push('Tanggal Penilaian');
    if (!isAnswerKeyComplete) missing.push('Kunci Jawaban Guru');
    return missing;
  }, [selectedClass, resolvedStudentName, effectiveSubject, assessmentCategory, assessmentDate, isAnswerKeyComplete]);

  const isReadyToUpload = missingIdentityRequirements.length === 0;

  // Load Students, Subjects, Saved Answer Keys, and History for selectedClass
  useEffect(() => {
    const variants = getClassVariants(selectedClass);
    const qStudents =
      variants.length === 1
        ? query(collection(db, 'students'), where('classId', '==', variants[0]))
        : query(
            collection(db, 'students'),
            where('classId', 'in', variants.length > 0 ? variants : [selectedClass])
          );

    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const list = sortStudentsAlphabetically(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student))
      );
      setStudents(list);
      if (list.length > 0 && !list.some((s) => s.id === selectedStudentId)) {
        setSelectedStudentId(list[0].id);
      } else if (list.length === 0) {
        setSelectedStudentId('');
      }
    });

    const unsubSubjects = onSnapshot(doc(db, 'mata_pelajaran', selectedClass), (docSnap) => {
      if (docSnap.exists()) {
        const list = (docSnap.data().subjects || []) as string[];
        setSubjects(list);
        if (list.length > 0 && (!selectedSubject || (selectedSubject !== '__custom__' && !list.includes(selectedSubject)))) {
          setSelectedSubject(list[0]);
        }
      } else {
        setSubjects([]);
        if (selectedSubject !== '__custom__') setSelectedSubject('__custom__');
      }
    });

    const qKeys = query(collection(db, 'kunci_jawaban_offline'), where('classId', '==', selectedClass));
    const unsubKeys = onSnapshot(qKeys, (snap) => {
      setSavedKeys(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedAnswerKey)));
    });

    const qHistory = query(
      collection(db, 'koreksi_foto_offline'),
      where('classId', '==', selectedClass),
      orderBy('gradedAtIso', 'desc')
    );
    let fallbackUnsub: (() => void) | null = null;
    const unsubHistory = onSnapshot(
      qHistory,
      (snap) => {
        setHistoryRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OfflineHistoryRecord)));
      },
      () => {
        const qFallback = query(collection(db, 'koreksi_foto_offline'), where('classId', '==', selectedClass));
        fallbackUnsub = onSnapshot(qFallback, (snap2) => {
          const rows = snap2.docs.map((d) => ({ id: d.id, ...d.data() } as OfflineHistoryRecord));
          rows.sort((a, b) => (b.gradedAtIso || '').localeCompare(a.gradedAtIso || ''));
          setHistoryRecords(rows);
        });
      }
    );

    return () => {
      unsubStudents();
      unsubSubjects();
      unsubKeys();
      unsubHistory();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [selectedClass]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const gradedStudentIdsForCurrentTitle = useMemo(() => {
    const cleanTitle = examTitle.trim().toLowerCase();
    const cleanSubj = effectiveSubject.trim().toLowerCase();
    const set = new Set<string>();
    historyRecords.forEach((r) => {
      if (
        r.title.trim().toLowerCase() === cleanTitle &&
        r.subject.trim().toLowerCase() === cleanSubj &&
        r.assessmentCategory === assessmentCategory
      ) {
        set.add(r.studentId);
      }
    });
    return set;
  }, [historyRecords, examTitle, effectiveSubject, assessmentCategory]);

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

    const numberedMatches = Array.from(raw.matchAll(/(\d{1,3})\s*[\.\:\)\-]?\s*([A-Ea-e])\b/g));
    let parsedLetters: { num: number; letter: string }[] = [];

    if (numberedMatches.length > 0) {
      parsedLetters = numberedMatches.map((m) => ({
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

    const maxNum = Math.max(...parsedLetters.map((p) => p.num), parsedLetters.length);
    const pointPerItem = Math.round((100 / maxNum) * 10) / 10;
    const mapByNum = new Map<number, string>();
    parsedLetters.forEach((p) => mapByNum.set(p.num, p.letter));

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
    setAnswerKey((prev) =>
      prev.map((item, idx) => ({
        ...item,
        points: idx === prev.length - 1 ? Math.round((perItem + remainder) * 10) / 10 : perItem
      }))
    );
    showToast('Bobot seluruh soal diratakan agar total bernilai 100 poin.', 'success');
  };

  const handleAddKeyItem = (type: 'multiple_choice' | 'essay') => {
    setAnswerKey((prev) => {
      const nextNum = prev.length > 0 ? Math.max(...prev.map((i) => i.number)) + 1 : 1;
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
    setAnswerKey((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const handleRemoveKeyItem = (index: number) => {
    setAnswerKey((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, number: idx + 1 }))
    );
  };

  const handleSaveKeyTemplate = async () => {
    if (!examTitle.trim()) {
      showToast('Isi Judul Penilaian terlebih dahulu.', 'error');
      return;
    }
    if (!effectiveSubject) {
      showToast('Pilih atau isi Mata Pelajaran terlebih dahulu.', 'error');
      return;
    }
    if (!isAnswerKeyComplete) {
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
        showToast('Perubahan template kunci jawaban berhasil disimpan!', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'kunci_jawaban_offline'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        setActiveKeyId(docRef.id);
        showToast('Template kunci jawaban tersimpan dan dapat dipakai ulang untuk seluruh siswa!', 'success');
      }
    } catch (err: any) {
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
    setQuickMcqCount(saved.items?.length || 10);
    setGradingResult(null);
    setPhotoRejection(null);
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

  // Image handling
  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isReadyToUpload) {
      showToast('Lengkapi identitas penilaian dan kunci jawaban terlebih dahulu sebelum mengunggah foto.', 'error');
      e.target.value = '';
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setOrientedPhotoDataUrl('');
    setRotationDeg(0);
    setGradingResult(null);
    setPhotoRejection(null);
    setTeacherApprovedFinal(false);
    e.target.value = '';
  };

  const handleRunAutoGrade = async () => {
    if (!isReadyToUpload) {
      showToast(`Lengkapi terlebih dahulu: ${missingIdentityRequirements.join(', ')}.`, 'error');
      return;
    }
    if (!selectedFile) {
      showToast('Unggah atau ambil foto lembar jawaban siswa terlebih dahulu.', 'error');
      return;
    }

    setIsGrading(true);
    setGradingResult(null);
    setPhotoRejection(null);
    setTeacherApprovedFinal(false);

    try {
      let uploadBlob: Blob = selectedFile;
      let orientedDataUrl = '';

      if (selectedFile.type !== 'application/pdf') {
        const oriented = await generateOrientedImageData(selectedFile, rotationDeg, 1600, 0.9);
        uploadBlob = oriented.blob;
        orientedDataUrl = oriented.dataUrl;
        setOrientedPhotoDataUrl(orientedDataUrl);
      }

      const formData = new FormData();
      formData.append('file', uploadBlob, selectedFile.name || 'lembar_jawaban.jpg');
      formData.append('answerKey', JSON.stringify(answerKey));
      formData.append('subject', effectiveSubject);
      formData.append('assessmentCategory', assessmentCategory);
      formData.append('assessmentDate', assessmentDate);
      formData.append('title', examTitle.trim());

      const res = await fetch('/api/grade-offline-photo', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses koreksi foto.');
      }

      // Photo quality rejection check
      if (data.photoRejected) {
        setPhotoRejection({
          qualityStatus: data.qualityStatus || 'blurry',
          qualityIssues: Array.isArray(data.qualityIssues) ? data.qualityIssues : [],
          qualityFeedback: data.qualityFeedback || 'Foto kurang jelas. Silakan foto ulang.'
        });
        showToast('Foto ditolak sistem karena tidak layak dibaca. Silakan ambil foto ulang.', 'error');
        return;
      }

      const rawResult = data.result as GradingResult;
      // Generate cropped photo evidence snippets per question from oriented image
      const itemsWithEvidence = orientedDataUrl
        ? await cropEvidenceThumbnails(orientedDataUrl, rawResult.items)
        : rawResult.items;

      setGradingResult({
        ...rawResult,
        items: itemsWithEvidence
      });

      const pendingVerif = itemsWithEvidence.filter((it) => it.needsVerification && !it.verifiedByTeacher).length;
      if (pendingVerif > 0) {
        showToast(
          `Koreksi terbaca (${rawResult.scoreScale100}). Terdapat ${pendingVerif} soal meragukan/ganda yang wajib diverifikasi guru sebelum disimpan.`,
          'error'
        );
      } else {
        showToast(
          `Koreksi otomatis selesai! Skor sementara: ${rawResult.scoreScale100} (${rawResult.correctCount} benar dari ${rawResult.totalQuestions} soal).`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Auto-grade error:', err);
      showToast(err?.message || 'Gagal melakukan koreksi otomatis.', 'error');
    } finally {
      setIsGrading(false);
    }
  };

  // Recalculate totals whenever teacher edits or verifies answers
  const recalculateResultTotals = (items: GradedItem[], prev: GradingResult): GradingResult => {
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let totalEarnedPoints = 0;
    let totalMaxPoints = 0;
    let verificationRequiredCount = 0;

    items.forEach((it) => {
      totalMaxPoints += Number(it.maxPoints) || 0;
      totalEarnedPoints += Number(it.earnedPoints) || 0;
      const ans = String(it.detectedAnswer || '').trim().toUpperCase();
      if (it.needsVerification && !it.verifiedByTeacher) {
        verificationRequiredCount++;
      }
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
      verificationRequiredCount,
      totalEarnedPoints: Math.round(totalEarnedPoints * 10) / 10,
      totalMaxPoints: Math.round(totalMaxPoints * 10) / 10,
      scoreScale100
    };
  };

  const handleTeacherSelectOption = (index: number, option: string) => {
    if (!gradingResult) return;
    const nextItems = gradingResult.items.map((item, idx) => {
      if (idx !== index) return item;
      const clean = option.trim().toUpperCase();
      if (clean === 'KOSONG') {
        return {
          ...item,
          detectedAnswer: 'KOSONG',
          detectionStatus: 'empty' as DetectionStatus,
          verifiedByTeacher: true,
          isCorrect: false,
          earnedPoints: 0,
          feedback: 'Ditetapkan Kosong oleh Guru'
        };
      }
      const targetKey = item.correctAnswer.trim().toUpperCase().slice(0, 1);
      const match = clean === targetKey;
      return {
        ...item,
        detectedAnswer: clean,
        verifiedByTeacher: true,
        isCorrect: match,
        earnedPoints: match ? item.maxPoints : 0,
        feedback: `Diverifikasi Guru: Jawaban ${clean} (${match ? 'Benar' : 'Salah, Kunci ' + targetKey})`
      };
    });
    setGradingResult(recalculateResultTotals(nextItems, gradingResult));
  };

  const handleEditEssayAnswer = (index: number, newVal: string) => {
    if (!gradingResult) return;
    const nextItems = gradingResult.items.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        detectedAnswer: newVal,
        verifiedByTeacher: true
      };
    });
    setGradingResult(recalculateResultTotals(nextItems, gradingResult));
  };

  const handleToggleItemCorrect = (index: number) => {
    if (!gradingResult) return;
    const nextItems = gradingResult.items.map((item, idx) => {
      if (idx !== index) return item;
      const nextCorrect = !item.isCorrect;
      return {
        ...item,
        verifiedByTeacher: true,
        isCorrect: nextCorrect,
        earnedPoints: nextCorrect ? item.maxPoints : 0,
        feedback: nextCorrect ? 'Disetujui Benar oleh Guru' : 'Ditetapkan Salah oleh Guru'
      };
    });
    setGradingResult(recalculateResultTotals(nextItems, gradingResult));
  };

  const handleVerifyItem = (index: number) => {
    if (!gradingResult) return;
    const item = gradingResult.items[index];
    if (
      item.type === 'multiple_choice' &&
      (item.detectedAnswer === 'GANDA' || item.detectedAnswer === 'TIDAK_JELAS')
    ) {
      showToast(`Pilih jawaban akhir (A–E atau Kosong) pada No. ${item.number} terlebih dahulu untuk memverifikasi.`, 'error');
      return;
    }
    const nextItems = gradingResult.items.map((it, idx) =>
      idx === index ? { ...it, verifiedByTeacher: true } : it
    );
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
        verifiedByTeacher: true,
        earnedPoints: clamped,
        isCorrect: clamped >= item.maxPoints * 0.6
      };
    });
    setGradingResult(recalculateResultTotals(nextItems, gradingResult));
  };

  const unverifiedItems = useMemo(() => {
    if (!gradingResult) return [];
    return gradingResult.items.filter(
      (it) =>
        (it.needsVerification && !it.verifiedByTeacher) ||
        it.detectedAnswer === 'GANDA' ||
        it.detectedAnswer === 'TIDAK_JELAS'
    );
  }, [gradingResult]);

  const canFinalizeAndSave =
    Boolean(gradingResult) &&
    Boolean(resolvedStudentName) &&
    Boolean(effectiveSubject) &&
    Boolean(assessmentDate) &&
    unverifiedItems.length === 0 &&
    teacherApprovedFinal;

  // Upload original photo to Firebase Storage safely, or compact fallback <= 120KB if Storage blocked
  const persistOriginalPhoto = async (historyDocId: string): Promise<string> => {
    if (!selectedFile || selectedFile.type === 'application/pdf') return '';
    try {
      const oriented = await generateOrientedImageData(selectedFile, rotationDeg, 1280, 0.82);
      try {
        const safeClass = selectedClass.replace(/[^a-zA-Z0-9_-]/g, '_');
        const photoRef = ref(storage, `offline_grading_photos/${safeClass}/${historyDocId}.jpg`);
        await uploadBytes(photoRef, oriented.blob, { contentType: 'image/jpeg' });
        const downloadUrl = await getDownloadURL(photoRef);
        return downloadUrl;
      } catch (storageErr) {
        console.warn('Storage upload fallback to compact JPEG:', storageErr);
        const compact = await generateOrientedImageData(selectedFile, rotationDeg, 680, 0.56);
        return compact.dataUrl.length < 180000 ? compact.dataUrl : '';
      }
    } catch {
      return '';
    }
  };

  // Save verified grading result directly into existing grades collection & correction history
  const handleSaveGradeToDatabase = async () => {
    if (!gradingResult) return;
    if (unverifiedItems.length > 0) {
      showToast(
        `Masih ada ${unverifiedItems.length} nomor (${unverifiedItems.map((u) => `No. ${u.number}`).join(', ')}) yang meragukan/ganda dan belum diverifikasi guru.`,
        'error'
      );
      return;
    }
    if (!teacherApprovedFinal) {
      showToast('Centang konfirmasi persetujuan akhir guru sebelum menyimpan nilai.', 'error');
      return;
    }

    setSavingGrade(true);
    try {
      const nowIso = new Date().toISOString();

      // 1. Resolve student record (roster match or auto-register manual student in existing `students` collection)
      let targetStudentId = '';
      let targetStudentName = resolvedStudentName;
      let targetStudentAbsen = '';

      if (studentInputMode === 'roster' && selectedStudentFromRoster) {
        targetStudentId = selectedStudentFromRoster.id;
        targetStudentName = selectedStudentFromRoster.name;
        targetStudentAbsen = selectedStudentFromRoster.absen_number || '';
      } else {
        const cleanManual = manualStudentName.trim();
        const existingMatch = students.find(
          (s) => s.name.trim().toLowerCase() === cleanManual.toLowerCase()
        );
        if (existingMatch) {
          targetStudentId = existingMatch.id;
          targetStudentName = existingMatch.name;
          targetStudentAbsen = existingMatch.absen_number || '';
        } else {
          const nextAbsen = manualStudentAbsen.trim() || String(students.length + 1);
          const newStudentDoc = await addDoc(collection(db, 'students'), {
            name: cleanManual,
            classId: selectedClass,
            nisn: '',
            absen_number: nextAbsen,
            createdFrom: 'offline_grader',
            createdAt: serverTimestamp()
          });
          targetStudentId = newStudentDoc.id;
          targetStudentName = cleanManual;
          targetStudentAbsen = nextAbsen;
        }
      }

      const historyDocId = `${targetStudentId}_${(examTitle.trim() || 'penilaian').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 28)}_${Date.now()}`;

      // 2. Store original photo safely
      const originalPhotoUrl = await persistOriginalPhoto(historyDocId);

      // Keep Firestore document size safely well below 1MB even for large sheets
      const shouldKeepInlineThumbnails = gradingResult.items.length <= 25;
      const serializedItems = gradingResult.items.map((it) => {
        const clean: any = {
          number: it.number,
          type: it.type,
          correctAnswer: it.correctAnswer,
          maxPoints: it.maxPoints,
          rawMarksObserved: it.rawMarksObserved,
          detectedAnswer: it.detectedAnswer,
          detectionStatus: it.detectionStatus,
          needsVerification: it.needsVerification,
          verifiedByTeacher: it.verifiedByTeacher,
          isCorrect: it.isCorrect,
          earnedPoints: it.earnedPoints,
          confidence: it.confidence,
          feedback: it.feedback
        };
        if (it.bbox) clean.bbox = it.bbox;
        if (shouldKeepInlineThumbnails && it.evidenceCropUrl && it.evidenceCropUrl.length < 18000) {
          clean.evidenceCropUrl = it.evidenceCropUrl;
        }
        return clean;
      });

      // 3. Save full correction history & audit trail
      await setDoc(doc(db, 'koreksi_foto_offline', historyDocId), {
        keyId: activeKeyId || '',
        title: examTitle.trim() || 'Penilaian Offline',
        classId: selectedClass,
        subject: effectiveSubject,
        assessmentCategory,
        assessmentDate,
        studentId: targetStudentId,
        studentName: targetStudentName,
        studentAbsen: targetStudentAbsen,
        studentSource: studentInputMode === 'manual' ? 'input_manual' : 'daftar_kelas',
        scoreScale100: gradingResult.scoreScale100,
        totalEarnedPoints: gradingResult.totalEarnedPoints,
        totalMaxPoints: gradingResult.totalMaxPoints,
        correctCount: gradingResult.correctCount,
        wrongCount: gradingResult.wrongCount,
        unansweredCount: gradingResult.unansweredCount,
        totalQuestions: gradingResult.totalQuestions,
        qualityStatus: gradingResult.qualityStatus,
        originalPhotoUrl,
        items: serializedItems,
        verifiedBy: userData?.name || 'Guru',
        approvedAtIso: nowIso,
        gradedBy: userData?.name || 'Guru',
        gradedAtIso: nowIso,
        createdAt: serverTimestamp()
      });

      // 4. Sync strictly to existing `grades/{studentId}.gradesBySubject[effectiveSubject]`
      const gradeRef = doc(db, 'grades', targetStudentId);
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
          : currentSubj.tugas
            ? [String(currentSubj.tugas)]
            : [];
        updatedSubj.tugas = [...list, scoreStr];
      } else if (assessmentCategory === 'ulanganHarian') {
        const list = Array.isArray(currentSubj.ulanganHarian)
          ? currentSubj.ulanganHarian.map((x: any) => String(x).trim()).filter(Boolean)
          : currentSubj.ulanganHarian
            ? [String(currentSubj.ulanganHarian)]
            : [];
        updatedSubj.ulanganHarian = [...list, scoreStr];
      } else if (assessmentCategory === 'pts') {
        updatedSubj.pts = scoreStr;
      } else if (assessmentCategory === 'pas') {
        updatedSubj.pas = scoreStr;
      }

      const existingMeta = Array.isArray(existingData.offlineAssessmentsMeta)
        ? existingData.offlineAssessmentsMeta
        : [];
      const newMetaEntry = {
        historyId: historyDocId,
        subject: effectiveSubject,
        category: assessmentCategory,
        title: examTitle.trim() || 'Penilaian Offline',
        assessmentDate,
        score: gradingResult.scoreScale100,
        savedAtIso: nowIso
      };

      await setDoc(
        gradeRef,
        {
          studentId: targetStudentId,
          studentName: targetStudentName,
          classId: selectedClass,
          gradesBySubject: {
            ...gradesBySubject,
            [effectiveSubject]: updatedSubj
          },
          offlineAssessmentsMeta: [...existingMeta, newMetaEntry].slice(-80),
          academicYearId: existingData.academicYearId || 'active',
          lastUpdatedFromOfflineGrader: serverTimestamp()
        },
        { merge: true }
      );

      if (userData) {
        await logActivity(
          userData.name,
          userData.assigned_class || 'Admin',
          `Menyimpan hasil koreksi foto (${CATEGORY_LABELS[assessmentCategory]}) "${examTitle}" tgl ${assessmentDate} untuk ${targetStudentName} (${effectiveSubject}: ${gradingResult.scoreScale100})`
        );
      }

      showToast(
        `Nilai ${targetStudentName} (${gradingResult.scoreScale100}) berhasil disimpan ke ${CATEGORY_LABELS[assessmentCategory]} ${effectiveSubject} pada tanggal ${assessmentDate}.`,
        'success'
      );
    } catch (err: any) {
      console.error('Save grade error:', err);
      showToast('Gagal menyimpan nilai ke database: ' + (err?.message || 'Error'), 'error');
    } finally {
      setSavingGrade(false);
    }
  };

  const handleNextStudent = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl('');
    setOrientedPhotoDataUrl('');
    setRotationDeg(0);
    setGradingResult(null);
    setPhotoRejection(null);
    setTeacherApprovedFinal(false);

    if (studentInputMode === 'manual') {
      setManualStudentName('');
      setManualStudentAbsen('');
    } else if (students.length > 0) {
      const currentIdx = students.findIndex((s) => s.id === selectedStudentId);
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
    pdf.text(`Kelas: ${selectedClass}  •  Total Data: ${historyRecords.length} Penilaian`, 105, 21, {
      align: 'center'
    });

    autoTable(pdf, {
      startY: 27,
      head: [['No', 'Tanggal', 'Nama Siswa', 'Mapel & Kategori', 'Benar / Soal', 'Nilai']],
      body: historyRecords.map((r, i) => [
        String(i + 1),
        r.assessmentDate || (r.gradedAtIso ? r.gradedAtIso.slice(0, 10) : '-'),
        r.studentName,
        `${r.title}\n${r.subject} (${CATEGORY_LABELS[r.assessmentCategory] || r.assessmentCategory})`,
        `${r.correctCount} / ${r.totalQuestions}`,
        String(r.scoreScale100)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [67, 56, 202] },
      styles: { fontSize: 8.5, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 24, halign: 'center' },
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
    } catch {
      showToast('Gagal menghapus riwayat.', 'error');
    }
  };

  const renderDetectionBadge = (item: GradedItem) => {
    if (item.detectionStatus === 'multiple_answers') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Jawaban Ganda
        </span>
      );
    }
    if (item.detectionStatus === 'unclear') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
          <AlertCircle className="w-3 h-3 shrink-0" />
          Tidak Jelas
        </span>
      );
    }
    if (item.detectionStatus === 'corrected') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
          <RotateCw className="w-3 h-3 shrink-0" />
          Ralat Terdeteksi
        </span>
      );
    }
    if (item.detectionStatus === 'empty') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
          Kosong
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
        <Check className="w-3 h-3 shrink-0" />
        Tanda Jelas
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 max-w-md">
          <div
            className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-rose-600 text-white border-rose-500'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header & Alur Ringkas */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Koreksi Soal Otomatis Berbasis Foto AI
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Terintegrasi langsung ke sistem penilaian (Tugas, UH, UTS, UAS). Identitas siswa ditentukan guru agar nilai tidak pernah tertukar.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 flex items-center gap-2 shrink-0">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Anti-Menebak & Wajib Verifikasi Guru untuk Jawaban Ganda/Ragu</span>
          </div>
        </div>

        {/* 7-Step Flow Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold">
          {[
            { num: 1, label: 'Pilih Kelas', done: Boolean(selectedClass) },
            { num: 2, label: 'Nama Siswa', done: Boolean(resolvedStudentName) },
            { num: 3, label: 'Mapel & Jenis', done: Boolean(effectiveSubject && assessmentDate) },
            { num: 4, label: 'Kunci Jawaban', done: isAnswerKeyComplete },
            { num: 5, label: 'Unggah Foto', done: Boolean(selectedFile && !photoRejection) },
            { num: 6, label: 'Verifikasi Guru', done: Boolean(gradingResult && unverifiedItems.length === 0) },
            { num: 7, label: 'Simpan Nilai', done: false }
          ].map((step) => (
            <div
              key={step.num}
              className={`px-2.5 py-2 rounded-xl border flex items-center gap-2 ${
                step.done
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center shrink-0 tabular-nums ${
                  step.done ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {step.done ? <Check className="w-3 h-3" /> : step.num}
              </span>
              <span className="truncate">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main 2-Column Workbench */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (5 cols): TAHAP 1 (IDENTITAS & JENIS PENILAIAN) + TAHAP 2 (KUNCI JAWABAN) */}
        <div className="xl:col-span-5 space-y-6">
          {/* TAHAP 1: IDENTITAS & JENIS PENILAIAN */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                  1
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Identitas & Jenis Penilaian</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Wajib diisi lengkap sebelum mengunggah foto
                  </p>
                </div>
              </div>
              <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Kelas & Tanggal Penilaian */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kelas / Rombel <span className="text-rose-500">*</span>
                  </label>
                  {isAdmin ? (
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {ALL_AVAILABLE_CLASSES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {selectedClass}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal Penilaian <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={assessmentDate}
                      onChange={(e) => setAssessmentDate(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Nama Siswa (Pilih dari Daftar Kelas atau Ketik Manual) */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-white">
                    Nama Siswa <span className="text-rose-500">*</span>
                  </label>
                  <div className="inline-flex rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setStudentInputMode('roster');
                        setGradingResult(null);
                      }}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        studentInputMode === 'roster'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Daftar Kelas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStudentInputMode('manual');
                        setGradingResult(null);
                      }}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        studentInputMode === 'manual'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Input Manual
                    </button>
                  </div>
                </div>

                {studentInputMode === 'roster' ? (
                  <select
                    value={selectedStudentId}
                    onChange={(e) => {
                      setSelectedStudentId(e.target.value);
                      setGradingResult(null);
                      setTeacherApprovedFinal(false);
                    }}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {students.length === 0 ? (
                      <option value="">Belum ada siswa di {selectedClass} — gunakan Input Manual</option>
                    ) : (
                      students.map((s, idx) => {
                        const isDone = gradedStudentIdsForCurrentTitle.has(s.id);
                        return (
                          <option key={s.id} value={s.id}>
                            No. {idx + 1} — {s.name}{' '}
                            {isDone ? '(Sudah Dinilai)' : ''}
                          </option>
                        );
                      })
                    )}
                  </select>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-9">
                      <input
                        type="text"
                        value={manualStudentName}
                        onChange={(e) => setManualStudentName(e.target.value)}
                        placeholder="Ketik nama lengkap siswa..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={manualStudentAbsen}
                        onChange={(e) => setManualStudentAbsen(e.target.value)}
                        placeholder="No. Absen"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="sm:col-span-12 text-[11px] text-slate-500 dark:text-slate-400">
                      Jika nama manual belum ada di daftar {selectedClass}, sistem akan otomatis mendaftarkannya saat nilai disimpan.
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                  Identitas siswa dikunci dari pilihan guru di atas (tidak dibaca dari foto) agar nilai tidak pernah tertukar.
                </p>
              </div>

              {/* Mata Pelajaran & Judul */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="__custom__">Mapel Lainnya (Ketik Manual)</option>
                  </select>
                  {selectedSubject === '__custom__' && (
                    <input
                      type="text"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="Tulis nama mata pelajaran..."
                      className="mt-2 w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Judul / Keterangan Soal
                  </label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Contoh: UH 1 Bab Pecahan"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Jenis Penilaian */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Jenis Penilaian (Target Kolom Nilai) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORY_OPTIONS.map((opt) => {
                    const active = assessmentCategory === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAssessmentCategory(opt.value)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        <div className="text-xs font-extrabold">{opt.shortLabel}</div>
                        <div
                          className={`text-[10px] mt-0.5 leading-tight ${
                            active ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {opt.value === 'ulanganHarian'
                            ? 'Ulangan Harian'
                            : opt.value === 'pts'
                              ? 'Tengah Sem.'
                              : opt.value === 'pas'
                                ? 'Akhir Sem.'
                                : 'Tugas Harian'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* TAHAP 2: KUNCI JAWABAN GURU */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                  2
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Kunci Jawaban Guru</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Acuan koreksi otomatis Pilihan Ganda (A–E) & Isian
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveKeyTemplate}
                disabled={savingKey}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{activeKeyId ? 'Perbarui' : 'Simpan Template'}</span>
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {savedKeys.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Template Tersimpan ({selectedClass})
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {savedKeys.map((k) => (
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
                          <span>
                            {k.title} ({k.items?.length || 0} soal)
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedKey(k.id)}
                          className="pr-2 pl-1 py-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
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
                          setExamTitle('Penilaian Offline Baru');
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 hover:text-indigo-600 cursor-pointer"
                      >
                        + Kunci Baru
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Generator & Bulk Paste */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Isi Cepat Kunci Pilihan Ganda (A–E)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Jumlah:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={quickMcqCount}
                      onChange={(e) =>
                        setQuickMcqCount(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))
                      }
                      className="w-14 px-2 py-1 text-center text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => handleGenerateMcqTemplate(quickMcqCount)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer"
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
                    placeholder="Tempel cepat: 1.A 2.C 3.B 4.E atau ACBED..."
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
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

              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="text-slate-600 dark:text-slate-300 font-medium tabular-nums">
                  Total: <strong className="text-slate-900 dark:text-white">{answerKey.length} soal</strong> • Bobot:{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400">{totalKeyPoints} poin</strong>
                </div>
                <button
                  type="button"
                  onClick={handleNormalizePointsTo100}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Samakan Total = 100
                </button>
              </div>

              {/* Answer Key Grid */}
              <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                {answerKey.map((item, idx) => (
                  <div
                    key={`${item.number}-${idx}`}
                    className="p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-2"
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
                          <option value="essay">Isian</option>
                        </select>

                        {item.type === 'multiple_choice' && (
                          <div className="flex items-center gap-1">
                            {OPTION_LETTERS.map((letter) => (
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
                          className="w-13 px-1.5 py-1 text-center text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 tabular-nums"
                        />
                        <span className="text-[10px] text-slate-400">pt</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Hapus nomor ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {item.type === 'essay' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                        <input
                          type="text"
                          value={item.correctAnswer}
                          onChange={(e) => handleUpdateKeyItem(idx, { correctAnswer: e.target.value })}
                          placeholder="Kunci jawaban isian/uraian..."
                          className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => handleUpdateKeyItem(idx, { notes: e.target.value })}
                          placeholder="Rubrik penilaian (opsional)..."
                          className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
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
                  className="flex-1 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah PG</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddKeyItem('essay')}
                  className="flex-1 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Isian</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (7 cols): TAHAP 3 (UNGGAH & PEMERIKSAAN FOTO) + TAHAP 4 (HASIL, BUKTI & VERIFIKASI) */}
        <section className="xl:col-span-7 space-y-6">
          {/* TAHAP 3: UNGGAH FOTO & PEMERIKSAAN KUALITAS */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                  3
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Unggah & Pemeriksaan Foto Lembar Jawaban
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Target: <strong>{resolvedStudentName || 'Belum dipilih'}</strong> • {effectiveSubject || 'Mapel'} •{' '}
                    {CATEGORY_LABELS[assessmentCategory]}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                Terkoreksi: <strong className="text-emerald-600 dark:text-emerald-400">{gradedStudentIdsForCurrentTitle.size}</strong> /{' '}
                {students.length} siswa
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Pre-Upload Gate Banner if incomplete */}
              {!isReadyToUpload ? (
                <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Unggah Foto Terkunci — Lengkapi Identitas & Kunci Jawaban Terlebih Dahulu</span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300/90">
                    Untuk mencegah nilai tertukar atau salah kategori, lengkapi data berikut sebelum mengunggah foto:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingIdentityRequirements.map((req) => (
                      <span
                        key={req}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-[11px] font-bold text-amber-800 dark:text-amber-300"
                      >
                        • {req}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Photo Guidelines + Upload Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      <strong>Syarat Foto Layak:</strong> Jelas (tidak buram), tidak terpotong, pencahayaan cukup, dan diambil tegak lurus dari atas.
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
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
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Kamera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Pilih Foto</span>
                      </button>
                    </div>
                  </div>

                  {/* Photo Rejection Banner */}
                  {photoRejection && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                              Foto Tidak Layak — Silakan Ambil / Unggah Foto Ulang
                            </h3>
                            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mt-0.5">
                              Status: {QUALITY_LABELS[photoRejection.qualityStatus] || 'Foto Ditolak'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-rose-800 dark:text-rose-200">{photoRejection.qualityFeedback}</p>
                      {photoRejection.qualityIssues.length > 0 && (
                        <ul className="list-disc pl-5 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                          {photoRejection.qualityIssues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Foto Ulang via Kamera</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Unggah Foto Pengganti</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dropzone or Photo Preview */}
                  {!selectedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer bg-slate-50/50 dark:bg-slate-800/30"
                    >
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        Klik di sini untuk mengunggah foto lembar jawaban {resolvedStudentName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Mendukung pilihan ganda A–E tanda silang (X) atau lingkaran, pembatalan coret / tanda (=), serta jawaban isian.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center min-h-[260px] max-h-[380px]">
                        {selectedFile.type === 'application/pdf' ? (
                          <div className="p-6 text-center">
                            <BookOpen className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                            <p className="text-sm font-bold text-slate-800 dark:text-white">{selectedFile.name}</p>
                            <p className="text-xs text-slate-500 mt-1">Dokumen PDF siap diperiksa</p>
                          </div>
                        ) : (
                          <img
                            src={previewUrl}
                            alt="Pratinjau Lembar Jawaban"
                            className="max-h-[360px] w-auto object-contain transition-transform duration-200 cursor-zoom-in"
                            style={{ transform: `rotate(${rotationDeg}deg)` }}
                            onClick={() =>
                              setZoomImage({
                                url: previewUrl,
                                title: `Foto Lembar Jawaban — ${resolvedStudentName}`,
                                rotatedDeg: rotationDeg
                              })
                            }
                          />
                        )}

                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          {selectedFile.type !== 'application/pdf' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setRotationDeg((prev) => (prev + 90) % 360)}
                                className="p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-white cursor-pointer"
                                title="Putar foto 90 derajat"
                              >
                                <RotateCw className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setZoomImage({
                                    url: previewUrl,
                                    title: `Foto Lembar Jawaban — ${resolvedStudentName}`,
                                    rotatedDeg: rotationDeg
                                  })
                                }
                                className="p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-white cursor-pointer"
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
                              setOrientedPhotoDataUrl('');
                              setGradingResult(null);
                              setPhotoRejection(null);
                              setTeacherApprovedFinal(false);
                            }}
                            className="p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 text-rose-600 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-rose-50 cursor-pointer"
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
                            <span>Memeriksa Kualitas Foto & Mendeteksi Jawaban...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Periksa Foto & Koreksi Otomatis Sekarang</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* TAHAP 4: HASIL KOREKSI, POTONGAN FOTO BUKTI & VERIFIKASI KETAT GURU */}
          {gradingResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                    4
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Hasil Koreksi & Verifikasi: {resolvedStudentName}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {effectiveSubject} • {CATEGORY_LABELS[assessmentCategory]} • {assessmentDate}
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
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {/* Summary Score Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 tabular-nums">
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-center">
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block">Nilai Akhir</span>
                    <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                      {gradingResult.scoreScale100}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">Benar</span>
                    <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                      {gradingResult.correctCount}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 block">Salah</span>
                    <span className="text-xl font-bold text-rose-700 dark:text-rose-300">
                      {gradingResult.wrongCount}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Kosong</span>
                    <span className="text-xl font-bold text-slate-800 dark:text-white">
                      {gradingResult.unansweredCount}
                    </span>
                  </div>
                  <div
                    className={`p-3 rounded-xl border text-center ${
                      unverifiedItems.length > 0
                        ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-bold block ${
                        unverifiedItems.length > 0
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      Perlu Cek
                    </span>
                    <span
                      className={`text-xl font-bold ${
                        unverifiedItems.length > 0
                          ? 'text-amber-800 dark:text-amber-200'
                          : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {unverifiedItems.length}
                    </span>
                  </div>
                </div>

                {/* Quality & Verification Status Banner */}
                {unverifiedItems.length > 0 ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        Finalisasi Ditahan: {unverifiedItems.length} soal wajib diverifikasi guru terlebih dahulu (
                        {unverifiedItems.map((u) => `No. ${u.number}`).join(', ')})
                      </p>
                      <p className="text-[11px] mt-0.5 opacity-90">
                        Sistem tidak menebak jawaban ganda atau tanda meragukan. Periksa potongan foto bukti pada baris yang ditandai, pilih jawaban akhir yang sah, lalu simpan.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Seluruh butir jawaban telah terverifikasi ({gradingResult.qualityFeedback}). Centang persetujuan di bawah untuk menyimpan nilai ke database.
                    </span>
                  </div>
                )}

                {/* Per-Number Table with Cropped Photo Proof & Verification Controls */}
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        <th className="px-3 py-2.5 font-bold text-center w-11">No</th>
                        <th className="px-3 py-2.5 font-bold w-36">Potongan Bukti</th>
                        <th className="px-3 py-2.5 font-bold text-center w-16">Kunci</th>
                        <th className="px-3 py-2.5 font-bold">Deteksi & Koreksi Jawaban</th>
                        <th className="px-3 py-2.5 font-bold text-center w-28">Status & Poin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {gradingResult.items.map((item, idx) => {
                        const rowNeedsAttention =
                          (item.needsVerification && !item.verifiedByTeacher) ||
                          item.detectedAnswer === 'GANDA' ||
                          item.detectedAnswer === 'TIDAK_JELAS';

                        return (
                          <tr
                            key={item.number}
                            className={
                              rowNeedsAttention
                                ? 'bg-amber-50/70 dark:bg-amber-950/25'
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                            }
                          >
                            <td className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-200 tabular-nums align-top">
                              {item.number}
                            </td>

                            {/* Cropped Evidence Thumbnail */}
                            <td className="px-3 py-3 align-top">
                              {item.evidenceCropUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setZoomImage({
                                      url: item.evidenceCropUrl!,
                                      title: `Bukti Potongan Foto — Soal No. ${item.number} (${resolvedStudentName})`
                                    })
                                  }
                                  className="group relative block rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 w-32 h-14 cursor-zoom-in"
                                  title="Klik untuk memperbesar potongan foto"
                                >
                                  <img
                                    src={item.evidenceCropUrl}
                                    alt={`Bukti No. ${item.number}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[9px] font-bold opacity-85 group-hover:opacity-100">
                                    Zoom
                                  </span>
                                </button>
                              ) : (
                                <div className="w-32 h-12 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-[10px] text-slate-400">
                                  Tidak ada crop
                                </div>
                              )}
                            </td>

                            <td className="px-3 py-3 text-center align-top">
                              <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                                {item.correctAnswer}
                              </span>
                            </td>

                            <td className="px-3 py-3 space-y-2 align-top">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {renderDetectionBadge(item)}
                                {item.needsVerification && item.verifiedByTeacher && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                    <ShieldCheck className="w-3 h-3" />
                                    Diverifikasi Guru
                                  </span>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                                Teramati: <span className="italic">{item.rawMarksObserved}</span>
                              </p>

                              {item.type === 'multiple_choice' ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  {OPTION_LETTERS.map((opt) => {
                                    const selected = item.detectedAnswer === opt;
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => handleTeacherSelectOption(idx, opt)}
                                        className={`w-7 h-7 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                          selected
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    onClick={() => handleTeacherSelectOption(idx, 'KOSONG')}
                                    className={`px-2 h-7 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                                      item.detectedAnswer === 'KOSONG'
                                        ? 'bg-slate-700 text-white border-slate-700'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    Kosong
                                  </button>
                                  {rowNeedsAttention && (
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyItem(idx)}
                                      className="ml-1 px-2.5 h-7 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                                    >
                                      Setujui
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={item.detectedAnswer}
                                  onChange={(e) => handleEditEssayAnswer(idx, e.target.value)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-white w-full outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              )}

                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.feedback}</p>
                            </td>

                            <td className="px-3 py-3 text-center space-y-2 align-top tabular-nums">
                              <button
                                type="button"
                                onClick={() => handleToggleItemCorrect(idx)}
                                className={`w-full inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg font-bold border cursor-pointer transition-colors ${
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

                              <div className="inline-flex items-center gap-1 justify-center">
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Final Teacher Verification & Save Gate */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={teacherApprovedFinal}
                      disabled={unverifiedItems.length > 0}
                      onChange={(e) => setTeacherApprovedFinal(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">
                      Saya telah memeriksa hasil koreksi serta potongan foto bukti untuk{' '}
                      <strong>{resolvedStudentName}</strong> dan menyetujui nilai akhir{' '}
                      <strong className="text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {gradingResult.scoreScale100}
                      </strong>{' '}
                      untuk dimasukkan ke kolom <strong>{CATEGORY_LABELS[assessmentCategory]}</strong> mata pelajaran{' '}
                      <strong>{effectiveSubject}</strong> ({assessmentDate}).
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSaveGradeToDatabase}
                      disabled={savingGrade || !canFinalizeAndSave}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
                    >
                      {savingGrade ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ClipboardCheck className="w-4 h-4" />
                      )}
                      <span>
                        {savingGrade
                          ? 'Menyimpan Nilai & Foto Asli...'
                          : `Simpan Nilai ke ${CATEGORY_OPTIONS.find((c) => c.value === assessmentCategory)?.shortLabel}`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* RIWAYAT KOREKSI & BUKTI FOTO */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Riwayat Koreksi & Bukti Foto Tersimpan ({selectedClass})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menyimpan foto asli lembar jawaban, riwayat verifikasi guru, serta sinkron otomatis ke kategori Tugas, UH, UTS, atau UAS.
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
                <th className="px-5 py-3 font-semibold">Tanggal</th>
                <th className="px-5 py-3 font-semibold">Siswa</th>
                <th className="px-5 py-3 font-semibold">Mapel & Jenis Penilaian</th>
                <th className="px-5 py-3 font-semibold text-center">Benar / Soal</th>
                <th className="px-5 py-3 font-semibold text-center">Nilai</th>
                <th className="px-5 py-3 font-semibold text-right">Bukti & Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {historyRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                    Belum ada hasil koreksi foto yang disimpan untuk {selectedClass}.
                  </td>
                </tr>
              ) : (
                historyRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="px-5 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {rec.assessmentDate || (rec.gradedAtIso ? rec.gradedAtIso.slice(0, 10) : '-')}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-800 dark:text-white">{rec.studentName}</p>
                      <p className="text-[11px] text-slate-400">
                        {rec.studentAbsen ? `No. Absen ${rec.studentAbsen}` : 'Siswa'} • Verifikasi:{' '}
                        {rec.verifiedBy || rec.gradedBy}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">{rec.subject}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {CATEGORY_LABELS[rec.assessmentCategory] || rec.assessmentCategory} • {rec.title}
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
                    <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailModalRecord(rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded-lg cursor-pointer"
                        title="Lihat foto asli & rincian koreksi"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Bukti</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHistory(rec.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer align-middle"
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

      {/* Modal Detail Riwayat & Foto Asli */}
      {detailModalRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDetailModalRecord(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Arsip Koreksi: {detailModalRecord.studentName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {detailModalRecord.classId} • {detailModalRecord.subject} •{' '}
                  {CATEGORY_LABELS[detailModalRecord.assessmentCategory]} •{' '}
                  {detailModalRecord.assessmentDate || '-'} • Nilai:{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400">
                    {detailModalRecord.scoreScale100}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalRecord(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {detailModalRecord.originalPhotoUrl ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Foto Asli Lembar Jawaban Tersimpan
                  </h4>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-3 flex justify-center">
                    <img
                      src={detailModalRecord.originalPhotoUrl}
                      alt={`Lembar jawaban ${detailModalRecord.studentName}`}
                      className="max-h-72 object-contain rounded-lg cursor-zoom-in"
                      onClick={() =>
                        setZoomImage({
                          url: detailModalRecord.originalPhotoUrl!,
                          title: `Foto Asli — ${detailModalRecord.studentName}`
                        })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  Lampiran foto asli tidak tersimpan pada entri ini (mis. file PDF atau kompresi).
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-center w-10">No</th>
                      <th className="px-3 py-2">Potongan</th>
                      <th className="px-3 py-2 text-center">Kunci</th>
                      <th className="px-3 py-2 text-center">Jawaban</th>
                      <th className="px-3 py-2">Pengamatan & Keterangan</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(detailModalRecord.items || []).map((it) => (
                      <tr key={it.number}>
                        <td className="px-3 py-2 text-center font-bold tabular-nums">{it.number}</td>
                        <td className="px-3 py-2">
                          {it.evidenceCropUrl ? (
                            <img
                              src={it.evidenceCropUrl}
                              alt={`No ${it.number}`}
                              className="w-24 h-10 object-cover rounded border border-slate-200 dark:border-slate-700 cursor-zoom-in"
                              onClick={() =>
                                setZoomImage({
                                  url: it.evidenceCropUrl!,
                                  title: `Bukti Soal No. ${it.number} — ${detailModalRecord.studentName}`
                                })
                              }
                            />
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-bold">{it.correctAnswer}</td>
                        <td className="px-3 py-2 text-center font-bold text-indigo-600 dark:text-indigo-400">
                          {it.detectedAnswer}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">
                          <div>{it.rawMarksObserved}</div>
                          <div className="text-slate-400">{it.feedback}</div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${
                              it.isCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {it.isCorrect ? 'Benar' : 'Salah'} ({it.earnedPoints}/{it.maxPoints})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom Gambar (Foto Penuh / Potongan Bukti) */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 gap-3"
          onClick={() => setZoomImage(null)}
        >
          <div className="flex items-center justify-between w-full max-w-4xl text-white">
            <span className="text-sm font-bold">{zoomImage.title}</span>
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="p-2 rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={zoomImage.url}
            alt={zoomImage.title}
            className="max-w-full max-h-[84vh] object-contain rounded-xl shadow-2xl bg-white"
            style={zoomImage.rotatedDeg ? { transform: `rotate(${zoomImage.rotatedDeg}deg)` } : undefined}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
