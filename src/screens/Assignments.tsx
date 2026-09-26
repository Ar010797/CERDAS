import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs,
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  saveOfflineAssignments,
  getOfflineAssignments,
  saveOfflineSubmissions,
  getOfflineSubmissions,
  removeOfflineAssignment,
  syncOfflineAssignments
} from '../lib/offlineStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { 
  BookOpen, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Upload, 
  Eye, 
  Trash2, 
  Edit3, 
  Search, 
  Filter, 
  Send, 
  Star, 
  MessageSquare, 
  Paperclip, 
  X, 
  Check, 
  ArrowRight,
  ExternalLink,
  Award,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  WifiOff,
  Database,
  Bell,
  Volume2,
  VolumeX,
  Sparkles,
  HelpCircle,
  CheckSquare
} from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  requestBrowserNotificationPermission, 
  playDeadlineChime, 
  sendBrowserDeadlineNotification,
  useAssignmentDeadlineReminder 
} from '../hooks/useAssignmentDeadlineReminder';
import { QuizQuestion, StudentAnswer } from '../types/quiz';
import OnlineQuizTakerModal from '../components/OnlineQuizTakerModal';
import QuizQuestionEditor from '../components/QuizQuestionEditor';
import { playNotificationSound } from '../lib/audioNotifier';
import { sendPushAlert } from '../lib/fcmPush';
import { syncAssignmentGradeToRapot } from '../lib/gradeSync';
import { triggerFloatingNotification } from '../components/FloatingNotificationCenter';

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  classId: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:mm
  maxScore: number;
  attachmentUrl?: string;
  attachmentName?: string;
  teacherId: string;
  teacherName: string;
  status: 'active' | 'closed';
  createdAt: string;
  notifyParents?: boolean;
  mode?: 'manual' | 'online_quiz';
  questions?: QuizQuestion[];
  totalQuestions?: number;
}

export interface Submission {
  id: string; // `${assignmentId}_${studentId}`
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentAbsen: string;
  classId: string;
  submissionText: string;
  attachmentUrl?: string;
  attachmentName?: string;
  submittedAt: string;
  submittedBy: string;
  isLate: boolean;
  status: 'submitted' | 'graded' | 'revision_needed';
  score?: number | null;
  feedback?: string;
  feedbackAt?: string | null;
  feedbackBy?: string | null;
  studentAnswers?: StudentAnswer[];
  autoGraded?: boolean;
  mcqCorrectCount?: number;
  mcqTotalCount?: number;
  essayCount?: number;
}

interface Student {
  id: string;
  name: string;
  absen_number: string;
  nisn: string;
  classId: string;
}

const ALL_CLASSES = [
  'Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6',
  'Kelas 7', 'Kelas 8', 'Kelas 9'
];

export default function AssignmentsScreen() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';
  const isGuru = userData?.role === 'Guru';
  const isWaliMurid = userData?.role === 'Wali Murid';

  // Current active class selection
  const defaultClass = isWaliMurid
    ? (userData?.studentClass || 'Kelas 1')
    : isGuru
    ? (userData?.assigned_class || 'Kelas 1')
    : 'Kelas 1';

  const [selectedClass, setSelectedClass] = useState<string>(defaultClass);
  const [selectedSubject, setSelectedSubject] = useState<string>('Semua Mapel');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed' | 'submitted' | 'graded'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & form states for Guru/Admin
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<'manual' | 'online_quiz'>('manual');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [activeQuizAssignment, setActiveQuizAssignment] = useState<Assignment | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    classId: selectedClass,
    description: '',
    dueDate: format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    dueTime: '23:59',
    maxScore: 100,
    attachmentUrl: '',
    attachmentName: '',
    notifyParents: true
  });
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Monitoring modal state for Guru/Admin
  const [selectedAssignmentForGrading, setSelectedAssignmentForGrading] = useState<Assignment | null>(null);
  const [activeSubmissionStudent, setActiveSubmissionStudent] = useState<{
    student: Student;
    submission?: Submission;
  } | null>(null);
  const [gradeInput, setGradeInput] = useState<number | ''>('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'graded' | 'revision_needed'>('graded');
  const [savingGrade, setSavingGrade] = useState(false);

  // Submission modal state for Wali Murid / Siswa
  const [submittingAssignment, setSubmittingAssignment] = useState<Assignment | null>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitAttachmentUrl, setSubmitAttachmentUrl] = useState('');
  const [submitAttachmentName, setSubmitAttachmentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingFeedback, setViewingFeedback] = useState<{
    assignment: Assignment;
    submission: Submission;
  } | null>(null);

  // Toast message
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Online / Offline Status
  const isOnline = useOnlineStatus();
  const [isUsingOfflineData, setIsUsingOfflineData] = useState(false);

  // Synchronize target class for Wali Murid
  useEffect(() => {
    if (isWaliMurid && userData?.studentClass) {
      setSelectedClass(userData.studentClass);
    } else if (isGuru && userData?.assigned_class) {
      setSelectedClass(userData.assigned_class);
    }
  }, [userData, isWaliMurid, isGuru]);

  // Listen to Available Subjects for the class
  useEffect(() => {
    const unsubSubjects = onSnapshot(doc(db, 'mata_pelajaran', selectedClass), (snap) => {
      if (snap.exists()) {
        const list = snap.data().subjects || [];
        setAvailableSubjects(list);
        if (list.length > 0 && !formData.subject) {
          setFormData(prev => ({ ...prev, subject: list[0] }));
        }
      } else {
        const fallback = ['Matematika', 'Bahasa Indonesia', 'IPA', 'IPS', 'Pendidikan Agama Islam', 'Bahasa Inggris'];
        setAvailableSubjects(fallback);
      }
    });

    return () => unsubSubjects();
  }, [selectedClass]);

  // Listen to Students of selected class
  useEffect(() => {
    const qStudents = query(collection(db, 'students'), where('classId', '==', selectedClass));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const list: Student[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      list.sort((a, b) => (Number(a.absen_number) || 0) - (Number(b.absen_number) || 0));
      setStudents(list);
    });

    return () => unsubStudents();
  }, [selectedClass]);

  // Listen to Assignments (Real-time Firestore with IndexedDB Offline Fallback)
  useEffect(() => {
    setLoading(true);

    // Initial check: if offline or to show fast cached data first, load from IndexedDB
    getOfflineAssignments(selectedClass).then((cached) => {
      if (cached && cached.length > 0) {
        setAssignments(cached as Assignment[]);
        setIsUsingOfflineData(true);
        setLoading(false);
      }
    });

    let qAssignments = query(
      collection(db, 'tugas'),
      where('classId', '==', selectedClass)
    );

    const unsubAssignments = onSnapshot(
      qAssignments,
      (snap) => {
        const list: Assignment[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
        // Sort in-memory by dueDate ascending
        list.sort((a, b) => new Date(`${a.dueDate}T${a.dueTime}`).getTime() - new Date(`${b.dueDate}T${b.dueTime}`).getTime());
        setAssignments(list);
        setIsUsingOfflineData(false);
        setLoading(false);

        // Cache freshly retrieved assignments into IndexedDB for offline viewing
        // and purge any assignments deleted by teacher/admin from the local store
        syncOfflineAssignments(selectedClass, list).catch((err) => console.warn('Cache assignments error:', err));
      },
      (err) => {
        console.warn('Network error fetching assignments from Firestore, falling back to IndexedDB:', err);
        // Fallback to IndexedDB
        getOfflineAssignments(selectedClass).then((cached) => {
          setAssignments(cached as Assignment[]);
          setIsUsingOfflineData(true);
          setLoading(false);
        });
      }
    );

    return () => unsubAssignments();
  }, [selectedClass]);

  // Listen to all Submissions for this class (with IndexedDB Offline Fallback)
  useEffect(() => {
    // Check cached submissions first
    getOfflineSubmissions(selectedClass).then((cached) => {
      if (cached && cached.length > 0) {
        setSubmissions(cached as Submission[]);
      }
    });

    const qSubmissions = query(
      collection(db, 'pengumpulan_tugas'),
      where('classId', '==', selectedClass)
    );

    const unsubSubmissions = onSnapshot(
      qSubmissions,
      (snap) => {
        const list: Submission[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission));
        setSubmissions(list);
        // Cache to IndexedDB
        saveOfflineSubmissions(list).catch((err) => console.warn('Cache submissions error:', err));
      },
      (err) => {
        console.warn('Network error fetching submissions from Firestore, falling back to IndexedDB:', err);
        getOfflineSubmissions(selectedClass).then((cached) => {
          setSubmissions(cached as Submission[]);
        });
      }
    );

    return () => unsubSubmissions();
  }, [selectedClass]);

  // Wali murid's student profile
  const currentStudent = useMemo(() => {
    if (!isWaliMurid) return null;
    if (userData?.uid) {
      const found = students.find(s => s.id === userData.uid);
      if (found) return found;
    }
    if (userData?.studentId) {
      const found = students.find(s => s.id === userData.studentId);
      if (found) return found;
    }
    if (userData?.studentName) {
      const found = students.find(s => s.name.toLowerCase() === userData.studentName?.toLowerCase());
      if (found) return found;
    }
    if (students.length > 0) return students[0];
    return {
      id: userData?.uid || 'siswa',
      name: userData?.name || 'Siswa',
      absen_number: '-',
      nisn: '-',
      classId: selectedClass
    };
  }, [students, isWaliMurid, userData, selectedClass]);

  // Submissions map by assignmentId -> submission
  const studentSubmissionsMap = useMemo(() => {
    if (!isWaliMurid || !currentStudent) return {};
    const map: Record<string, Submission> = {};
    submissions.forEach(sub => {
      if (sub.studentId === currentStudent.id) {
        map[sub.assignmentId] = sub;
      }
    });
    return map;
  }, [submissions, isWaliMurid, currentStudent]);

  // Submissions count map per assignment for teachers
  const submissionsStatsMap = useMemo(() => {
    const stats: Record<string, { total: number; graded: number; pending: number }> = {};
    assignments.forEach(a => {
      stats[a.id] = { total: 0, graded: 0, pending: 0 };
    });

    submissions.forEach(sub => {
      if (stats[sub.assignmentId]) {
        stats[sub.assignmentId].total += 1;
        if (sub.status === 'graded') {
          stats[sub.assignmentId].graded += 1;
        } else {
          stats[sub.assignmentId].pending += 1;
        }
      }
    });
    return stats;
  }, [assignments, submissions]);

  // Handle file upload for Guru (assignment material/worksheet)
  const handleTeacherFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran file maksimal 2 MB agar dapat disimpan dengan optimal.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setFormData(prev => ({
        ...prev,
        attachmentUrl: base64,
        attachmentName: file.name
      }));
      showToast('Berkas materi berhasil dilampirkan.', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Handle file upload for Student/Wali Murid (submission photo/document)
  const handleStudentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      showToast('Ukuran foto atau file jawaban maksimal 2.5 MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSubmitAttachmentUrl(base64);
      setSubmitAttachmentName(file.name);
      showToast('Foto / lembar tugas berhasil diunggah.', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Guru: Save or Update Assignment
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.subject || !formData.dueDate) {
      showToast('Harap lengkapi judul, mata pelajaran, dan batas waktu.', 'error');
      return;
    }

    if (assignmentMode === 'online_quiz' && quizQuestions.length === 0) {
      showToast('Anda memilih mode Soal Online Interaktif. Harap tambahkan minimal 1 butir soal pilihan ganda atau esai.', 'error');
      return;
    }

    setSavingAssignment(true);
    try {
      const assignmentId = editingAssignment ? editingAssignment.id : `tugas_${Date.now()}`;
      const payload: Assignment = {
        id: assignmentId,
        title: formData.title.trim(),
        subject: formData.subject,
        classId: selectedClass,
        description: formData.description.trim(),
        dueDate: formData.dueDate,
        dueTime: formData.dueTime || '23:59',
        maxScore: Number(formData.maxScore) || 100,
        attachmentUrl: formData.attachmentUrl || '',
        attachmentName: formData.attachmentName || '',
        teacherId: userData?.username || userData?.uid || 'guru',
        teacherName: userData?.name || 'Guru Mata Pelajaran',
        status: editingAssignment ? editingAssignment.status : 'active',
        createdAt: editingAssignment ? editingAssignment.createdAt : new Date().toISOString(),
        notifyParents: formData.notifyParents,
        mode: assignmentMode,
        questions: assignmentMode === 'online_quiz' ? quizQuestions : [],
        totalQuestions: assignmentMode === 'online_quiz' ? quizQuestions.length : 0
      };

      await setDoc(doc(db, 'tugas', assignmentId), payload, { merge: true });

      // If notifyParents is true and it's a new assignment, create automatic announcement & push notification
      if (formData.notifyParents && !editingAssignment) {
        try {
          const annId = `ann_${Date.now()}`;
          const dueFormatted = format(new Date(`${formData.dueDate}T${formData.dueTime}`), 'dd MMMM yyyy HH:mm', { locale: id });
          const isQuiz = assignmentMode === 'online_quiz';
          const quizInfo = isQuiz ? `\nFormat: Tugas Online Interaktif (${quizQuestions.length} Butir Soal PG/Esai, dikerjakan & dinilai otomatis di aplikasi).` : '';
          
          await setDoc(doc(db, 'announcements', annId), {
            id: annId,
            title: `📝 Tugas Baru: ${formData.title.trim()}`,
            content: `Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nDiberitahukan kepada seluruh Siswa dan Wali Murid ${selectedClass}, telah diberikan tugas baru mata pelajaran ${formData.subject}.${quizInfo}\n\nBatas Pengumpulan: ${dueFormatted}\nPetunjuk: ${formData.description.trim() || 'Silakan buka menu Tugas di aplikasi untuk instruksi atau pengerjaan langsung.'}\n\nMohon bantu membimbing ananda untuk menyelesaikan tepat waktu. Terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.`,
            authorName: userData?.name || 'Guru Mata Pelajaran',
            authorRole: userData?.role || 'Guru',
            date: new Date().toISOString(),
            targetRole: 'Wali Murid',
            targetClass: selectedClass,
            category: 'Akademik',
            priority: 'Penting'
          });

          // Trigger backend push notification to mobile devices
          sendPushAlert({
            title: `Tugas Baru: ${formData.title.trim()}`,
            body: `Tugas ${formData.subject} untuk ${selectedClass}. Batas: ${dueFormatted}`,
            type: 'new_assignment',
            targetClass: selectedClass,
            targetRole: 'Wali Murid',
            url: '/assignments'
          }).catch(e => console.warn('Push trigger notification error:', e));
        } catch (annErr) {
          console.warn('Gagal membuat pengumuman otomatis tugas:', annErr);
        }
      }

      showToast(editingAssignment ? 'Tugas berhasil diperbarui!' : 'Tugas baru berhasil diterbitkan!', 'success');
      setIsCreateModalOpen(false);
      setEditingAssignment(null);
      setAssignmentMode('manual');
      setQuizQuestions([]);
      setFormData({
        title: '',
        subject: availableSubjects[0] || 'Matematika',
        classId: selectedClass,
        description: '',
        dueDate: format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        dueTime: '23:59',
        maxScore: 100,
        attachmentUrl: '',
        attachmentName: '',
        notifyParents: true
      });
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan tugas.', 'error');
    } finally {
      setSavingAssignment(false);
    }
  };

  // Guru: Delete Assignment (Immediately removed from teacher and walimurid dashboard)
  const handleDeleteAssignment = async (assignment: Assignment) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus tugas "${assignment.title}"? Seluruh pengumpulan tugas siswa terkait juga akan dihapus dan tidak lagi tampil di dasbor wali murid.`)) {
      return;
    }

    try {
      // 1. Delete assignment doc from Firestore
      await deleteDoc(doc(db, 'tugas', assignment.id));

      // 2. Delete all related student submissions from Firestore
      const qSubmissions = query(collection(db, 'pengumpulan_tugas'), where('assignmentId', '==', assignment.id));
      const snapSubmissions = await getDocs(qSubmissions);
      for (const d of snapSubmissions.docs) {
        await deleteDoc(doc(db, 'pengumpulan_tugas', d.id));
      }

      // 3. Purge from local offline IndexedDB storage
      await removeOfflineAssignment(assignment.id);

      // 4. Update in-memory state immediately so UI updates in real-time
      const updatedList = assignments.filter(a => a.id !== assignment.id);
      setAssignments(updatedList);
      await syncOfflineAssignments(selectedClass, updatedList);

      showToast(`Tugas "${assignment.title}" berhasil dihapus dari sistem & dasbor wali murid.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal menghapus tugas.', 'error');
    }
  };

  // Guru: Toggle Active / Closed
  const handleToggleStatus = async (assignment: Assignment) => {
    const nextStatus = assignment.status === 'active' ? 'closed' : 'active';
    try {
      await setDoc(doc(db, 'tugas', assignment.id), { status: nextStatus }, { merge: true });
      showToast(nextStatus === 'closed' ? 'Pengumpulan tugas telah ditutup.' : 'Pengumpulan tugas dibuka kembali.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengubah status tugas.', 'error');
    }
  };

  // Guru: Save Grade & Feedback for a Student's Submission
  const handleSaveGradeAndFeedback = async () => {
    if (!selectedAssignmentForGrading || !activeSubmissionStudent) return;

    if (gradeInput === '' || Number(gradeInput) < 0 || Number(gradeInput) > selectedAssignmentForGrading.maxScore) {
      showToast(`Nilai harus berada di antara 0 dan ${selectedAssignmentForGrading.maxScore}.`, 'error');
      return;
    }

    setSavingGrade(true);
    try {
      const subId = `${selectedAssignmentForGrading.id}_${activeSubmissionStudent.student.id}`;
      const payload: Partial<Submission> = {
        assignmentId: selectedAssignmentForGrading.id,
        studentId: activeSubmissionStudent.student.id,
        studentName: activeSubmissionStudent.student.name,
        studentAbsen: activeSubmissionStudent.student.absen_number,
        classId: selectedClass,
        score: Number(gradeInput),
        feedback: feedbackInput.trim(),
        feedbackAt: new Date().toISOString(),
        feedbackBy: userData?.name || 'Guru Mata Pelajaran',
        status: feedbackStatus
      };

      await setDoc(doc(db, 'pengumpulan_tugas', subId), payload, { merge: true });

      // Sinkronisasi otomatis ke dokumen nilai rapot siswa (grades/{studentId}.gradesBySubject)
      try {
        await syncAssignmentGradeToRapot({
          studentId: activeSubmissionStudent.student.id,
          studentName: activeSubmissionStudent.student.name,
          classId: selectedClass,
          subject: selectedAssignmentForGrading.subject || 'Umum',
          score: Number(gradeInput),
          maxScore: selectedAssignmentForGrading.maxScore || 100,
          assignmentId: selectedAssignmentForGrading.id,
          assignmentTitle: selectedAssignmentForGrading.title
        });
      } catch (syncErr) {
        console.warn('Gagal sync nilai tugas ke rapot:', syncErr);
      }

      // Play fanfare sound for grade release
      try {
        playNotificationSound('grade_released');
      } catch (soundErr) {
        console.warn('Audio feedback notice:', soundErr);
      }

      // Memicu notifikasi mengambang (Floating Heads-Up Banner)
      triggerFloatingNotification({
        title: `Nilai Tugas Diumumkan: ${selectedAssignmentForGrading.title}`,
        body: `Nilai ananda ${activeSubmissionStudent.student.name}: ${gradeInput} / ${selectedAssignmentForGrading.maxScore}. Catatan guru: "${feedbackInput.trim() || 'Alhamdulillah, tetap semangat!'}"`,
        type: 'grade_released',
        category: selectedAssignmentForGrading.subject || 'Tugas',
        url: '/assignments'
      });

      // Send automated push notification alert to student & parent
      sendPushAlert({
        title: `Nilai Tugas Diumumkan: ${selectedAssignmentForGrading.title}`,
        body: `Nilai ananda ${activeSubmissionStudent.student.name}: ${gradeInput} / ${selectedAssignmentForGrading.maxScore}. Catatan guru: "${feedbackInput.trim() || 'Alhamdulillah, tetap semangat!'}"`,
        type: 'grade_released',
        targetClass: selectedClass,
        targetRole: 'Wali Murid',
        studentId: activeSubmissionStudent.student.id,
        assignmentId: selectedAssignmentForGrading.id,
        url: '/assignments'
      }).catch(e => console.warn('Push alert error:', e));

      // Update student's local submission object in current modal
      setActiveSubmissionStudent(prev => prev ? {
        ...prev,
        submission: {
          ...(prev.submission || {
            id: subId,
            assignmentId: selectedAssignmentForGrading.id,
            studentId: activeSubmissionStudent.student.id,
            studentName: activeSubmissionStudent.student.name,
            studentAbsen: activeSubmissionStudent.student.absen_number,
            classId: selectedClass,
            submissionText: '',
            submittedAt: new Date().toISOString(),
            submittedBy: 'Siswa / Wali Murid',
            isLate: false,
          } as Submission),
          score: Number(gradeInput),
          feedback: feedbackInput.trim(),
          feedbackAt: new Date().toISOString(),
          feedbackBy: userData?.name || 'Guru Mata Pelajaran',
          status: feedbackStatus
        }
      } : null);

      showToast(`Nilai dan feedback untuk ${activeSubmissionStudent.student.name} berhasil disimpan!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan nilai dan feedback.', 'error');
    } finally {
      setSavingGrade(false);
    }
  };

  // Student / Wali Murid: Submit Assignment
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingAssignment || !currentStudent) return;

    if (!submitText.trim() && !submitAttachmentUrl) {
      showToast('Harap tuliskan jawaban atau lampirkan foto lembar tugas Anda.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const subId = `${submittingAssignment.id}_${currentStudent.id}`;
      const dueDateTime = new Date(`${submittingAssignment.dueDate}T${submittingAssignment.dueTime}`);
      const isLate = isPast(dueDateTime);

      const payload: Submission = {
        id: subId,
        assignmentId: submittingAssignment.id,
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        studentAbsen: currentStudent.absen_number || '-',
        classId: selectedClass,
        submissionText: submitText.trim(),
        attachmentUrl: submitAttachmentUrl,
        attachmentName: submitAttachmentName,
        submittedAt: new Date().toISOString(),
        submittedBy: userData?.name || 'Wali Murid',
        isLate: isLate,
        status: 'submitted',
        score: null,
        feedback: ''
      };

      await setDoc(doc(db, 'pengumpulan_tugas', subId), payload, { merge: true });

      showToast(isLate ? 'Tugas berhasil dikumpulkan (Status: Terlambat).' : 'Tugas berhasil dikumpulkan tepat waktu!', 'success');
      setSubmittingAssignment(null);
      setSubmitText('');
      setSubmitAttachmentUrl('');
      setSubmitAttachmentName('');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengumpulkan tugas.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(item => {
      // Subject filter
      if (selectedSubject !== 'Semua Mapel' && item.subject !== selectedSubject) return false;

      // Status filter
      if (filterStatus === 'active' && item.status !== 'active') return false;
      if (filterStatus === 'closed' && item.status !== 'closed') return false;

      if (isWaliMurid && currentStudent) {
        const sub = studentSubmissionsMap[item.id];
        if (filterStatus === 'submitted' && !sub) return false;
        if (filterStatus === 'graded' && sub?.status !== 'graded') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.subject.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [assignments, selectedSubject, filterStatus, searchQuery, isWaliMurid, currentStudent, studentSubmissionsMap]);

  // Calculation overview stats
  const stats = useMemo(() => {
    const totalAssignments = assignments.length;
    const activeAssignments = assignments.filter(a => a.status === 'active').length;
    let submittedCount = 0;
    let gradedCount = 0;
    let pendingCount = 0;

    if (isWaliMurid && currentStudent) {
      assignments.forEach(a => {
        const s = studentSubmissionsMap[a.id];
        if (s) {
          submittedCount++;
          if (s.status === 'graded') gradedCount++;
          else pendingCount++;
        }
      });
    } else {
      submittedCount = submissions.length;
      submissions.forEach(s => {
        if (s.status === 'graded') gradedCount++;
        else pendingCount++;
      });
    }

    return { totalAssignments, activeAssignments, submittedCount, gradedCount, pendingCount };
  }, [assignments, submissions, isWaliMurid, currentStudent, studentSubmissionsMap]);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-semibold transition-all animate-in fade-in slide-in-from-top-4 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold mb-2">
              <BookOpen className="w-3.5 h-3.5 text-indigo-200" />
              <span>Modul Pengumpulan Tugas & Evaluasi Belajar</span>
              {(!isOnline || isUsingOfflineData) && (
                <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-bold">
                  <Database className="w-3 h-3" />
                  Mode Offline (Tersimpan di IndexedDB)
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tugas & Pekerjaan Rumah (PR)</h1>
            <p className="text-indigo-100 text-sm mt-1 max-w-2xl">
              {isWaliMurid ? (
                `Pantau tugas ananda ${currentStudent?.name ? `(${currentStudent.name})` : ''}, kirim lembar jawaban online, dan dapatkan umpan balik langsung dari guru pengampu.`
              ) : (
                `Berikan tugas terstruktur kepada siswa ${selectedClass}, pantau progres pengumpulan lembar jawaban secara real-time, dan bubuhkan nilai beserta catatan feedback edukatif.`
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Notification Permission & Test Button for Students / Parents */}
            <button
              type="button"
              onClick={async () => {
                const perm = await requestBrowserNotificationPermission();
                if (perm === 'granted') {
                  playDeadlineChime('warning');
                  sendBrowserDeadlineNotification({
                    id: 'test_deadline',
                    assignmentId: 'test_1',
                    title: 'Uji Coba Pengingat Batas Waktu Tugas',
                    subject: 'Matematika',
                    classId: selectedClass,
                    dueDate: format(new Date(), 'yyyy-MM-dd'),
                    dueTime: '23:59',
                    teacherName: 'Guru Mata Pelajaran',
                    dueDateTime: new Date(),
                    diffMinutes: 120,
                    diffHours: 2,
                    timeFormatted: '2 Jam Lagi',
                    urgency: 'warning'
                  });
                  showToast('Notifikasi pengingat batas waktu berhasil diuji di browser Anda!', 'success');
                } else if (perm === 'denied') {
                  showToast('Izin notifikasi diblokir di browser. Mohon izinkan di setelan situs browser Anda.', 'error');
                } else {
                  showToast('Izin notifikasi belum disetujui.', 'error');
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 transition-all active:scale-95 cursor-pointer backdrop-blur-md"
              title="Aktifkan & uji notifikasi browser untuk peringatan batas waktu tugas"
            >
              <Bell className="w-4 h-4 text-amber-300" />
              <span>Tes Notifikasi Batas Waktu</span>
            </button>

            {(isAdmin || isGuru) && (
              <button
                onClick={() => {
                  setEditingAssignment(null);
                  setFormData({
                    title: '',
                    subject: availableSubjects[0] || 'Matematika',
                    classId: selectedClass,
                    description: '',
                    dueDate: format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                    dueTime: '23:59',
                    maxScore: 100,
                    attachmentUrl: '',
                    attachmentName: '',
                    notifyParents: true
                  });
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-sm shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Tugas Baru</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Tugas</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{stats.totalAssignments}</p>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">{stats.activeAssignments} aktif</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Terkumpul</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{stats.submittedCount}</p>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Lembar jawaban</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Menunggu Feedback</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{stats.pendingCount}</p>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Perlu evaluasi</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Telah Dinilai</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{stats.gradedCount}</p>
            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Feedback terkirim</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Class selector for Admin or Guru */}
          {(isAdmin || isGuru) && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Tingkat Kelas:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {ALL_CLASSES.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
          )}

          {/* Subject Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Mapel:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Semua Mapel">Semua Mapel</option>
              {availableSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul tugas, mata pelajaran, atau deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Tab Filter buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Semua Tugas
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'active'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Masih Aktif
          </button>
          <button
            onClick={() => setFilterStatus('closed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'closed'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Selesai / Ditutup
          </button>

          {isWaliMurid && (
            <>
              <button
                onClick={() => setFilterStatus('submitted')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  filterStatus === 'submitted'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Sudah Dikumpulkan
              </button>
              <button
                onClick={() => setFilterStatus('graded')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  filterStatus === 'graded'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Sudah Ada Nilai & Feedback
              </button>
            </>
          )}
        </div>
      </div>

      {/* Assignment List */}
      {loading ? (
        <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Memuat data tugas dan pengumpulan...</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mb-3">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">Tidak ada tugas ditemukan</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
            {isWaliMurid
              ? 'Belum ada tugas aktif untuk kelas ananda saat ini.'
              : 'Belum ada tugas untuk kriteria filter yang dipilih. Silakan klik tombol "Buat Tugas Baru" untuk menambahkan.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAssignments.map((assignment) => {
            const dueDateTime = new Date(`${assignment.dueDate}T${assignment.dueTime}`);
            const isDeadlinePassed = isPast(dueDateTime);
            const stats = submissionsStatsMap[assignment.id] || { total: 0, graded: 0, pending: 0 };
            const studentSub = isWaliMurid ? studentSubmissionsMap[assignment.id] : null;

            return (
              <div
                key={assignment.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 relative overflow-hidden"
              >
                {/* Status Indicator Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                  assignment.status === 'closed'
                    ? 'bg-slate-300 dark:bg-slate-700'
                    : isDeadlinePassed
                    ? 'bg-red-500'
                    : 'bg-indigo-600'
                }`} />

                <div className="space-y-3">
                  {/* Category & Status badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-lg border border-indigo-100 dark:border-indigo-900/60">
                        {assignment.subject}
                      </span>
                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg">
                        {assignment.classId}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {assignment.status === 'closed' ? (
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-bold rounded-lg">
                          Ditutup
                        </span>
                      ) : isDeadlinePassed ? (
                        <span className="px-2.5 py-1 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-[11px] font-bold rounded-lg flex items-center gap-1 border border-red-100 dark:border-red-900/60">
                          <AlertCircle className="w-3 h-3" />
                          <span>Lewat Batas Waktu</span>
                        </span>
                      ) : (() => {
                        const diffMins = Math.floor((dueDateTime.getTime() - Date.now()) / (1000 * 60));
                        if (diffMins > 0 && diffMins <= 3 * 60) {
                          return (
                            <span className="px-2.5 py-1 bg-rose-500 text-white text-[11px] font-black rounded-lg flex items-center gap-1 animate-pulse shadow-xs">
                              <AlertCircle className="w-3 h-3" />
                              <span>Mendesak ({Math.ceil(diffMins / 60)} Jam Lagi)</span>
                            </span>
                          );
                        } else if (diffMins > 0 && diffMins <= 24 * 60) {
                          return (
                            <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-bold rounded-lg flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                              <Clock className="w-3 h-3 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
                              <span>Segera ({Math.ceil(diffMins / 60)} Jam Lagi)</span>
                            </span>
                          );
                        }
                        return (
                          <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold rounded-lg flex items-center gap-1 border border-emerald-100 dark:border-emerald-900/60">
                            <Clock className="w-3 h-3" />
                            <span>Aktif</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white hover:text-indigo-600 transition-colors">
                        {assignment.title}
                      </h3>
                      {(assignment.mode === 'online_quiz' || (assignment.questions && assignment.questions.length > 0)) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-bold">
                          <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span>Online ({assignment.questions?.length || 0} Soal • Auto-Nilai)</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-3 leading-relaxed">
                      {assignment.description || 'Tidak ada deskripsi tambahan.'}
                    </p>
                  </div>

                  {/* Due Date & Teacher info */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Batas Pengumpulan:</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {format(dueDateTime, 'dd MMM yyyy, HH:mm', { locale: id })} WIB
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Skor Maksimal:</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {assignment.maxScore} Poin
                      </span>
                    </div>

                    {assignment.attachmentUrl && (
                      <div className="pt-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>Lampiran Guru:</span>
                        </span>
                        <a
                          href={assignment.attachmentUrl}
                          download={assignment.attachmentName || 'lampiran_tugas'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <span className="truncate max-w-[150px]">{assignment.attachmentName || 'Unduh Berkas'}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Area */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  {isWaliMurid ? (
                    // WALI MURID VIEW
                    <div className="space-y-3">
                      {studentSub ? (
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5">
                              {studentSub.status === 'graded' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Sudah Dinilai</span>
                                </span>
                              ) : studentSub.status === 'revision_needed' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>Perlu Revisi</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Sudah Dikumpulkan (Menunggu Dinilai)</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Dikirim pada {format(new Date(studentSub.submittedAt), 'dd MMM yyyy HH:mm', { locale: id })}
                            </p>
                          </div>

                          {studentSub.status === 'graded' && studentSub.score !== null && (
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Nilai</span>
                              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                {studentSub.score} / {assignment.maxScore}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                            <AlertCircle className="w-4 h-4" />
                            <span>Belum Mengumpulkan</span>
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {(() => {
                          const isOnlineQuiz = assignment.mode === 'online_quiz' || (assignment.questions && assignment.questions.length > 0);

                          if (studentSub) {
                            return (
                              <>
                                {isOnlineQuiz && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveQuizAssignment(assignment)}
                                    className="flex-1 py-2.5 px-3 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-purple-200 dark:border-purple-800 shadow-2xs"
                                  >
                                    <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                                    <span>Lihat Lembar Jawaban & Pembahasan</span>
                                  </button>
                                )}

                                {studentSub.feedback && !isOnlineQuiz && (
                                  <button
                                    type="button"
                                    onClick={() => setViewingFeedback({ assignment, submission: studentSub })}
                                    className="flex-1 py-2.5 px-4 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>Lihat Feedback Guru</span>
                                  </button>
                                )}

                                {assignment.status === 'active' && !isOnlineQuiz && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubmittingAssignment(assignment);
                                      setSubmitText(studentSub.submissionText || '');
                                      setSubmitAttachmentUrl(studentSub.attachmentUrl || '');
                                      setSubmitAttachmentName(studentSub.attachmentName || '');
                                    }}
                                    className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Ubah / Revisi</span>
                                  </button>
                                )}
                              </>
                            );
                          }

                          if (isOnlineQuiz) {
                            return (
                              <button
                                type="button"
                                disabled={assignment.status === 'closed'}
                                onClick={() => setActiveQuizAssignment(assignment)}
                                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                              >
                                <Sparkles className="w-4 h-4 text-amber-300" />
                                <span>Kerjakan Online Sekarang ({assignment.questions?.length || 0} Soal PG/Esai)</span>
                              </button>
                            );
                          }

                          return (
                            <button
                              type="button"
                              disabled={assignment.status === 'closed'}
                              onClick={() => {
                                setSubmittingAssignment(assignment);
                                setSubmitText('');
                                setSubmitAttachmentUrl('');
                                setSubmitAttachmentName('');
                              }}
                              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Upload className="w-4 h-4" />
                              <span>Kumpulkan Tugas Sekarang</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    // GURU & ADMIN VIEW
                    <div className="space-y-3">
                      {/* Submission Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <span className="text-slate-500">Progres Pengumpulan Siswa</span>
                          <span className="text-slate-800 dark:text-white">
                            {stats.total} / {students.length} Siswa ({Math.round(students.length > 0 ? (stats.total / students.length) * 100 : 0)}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${students.length > 0 ? (stats.graded / students.length) * 100 : 0}%` }}
                            className="bg-emerald-500 h-full"
                            title={`${stats.graded} sudah dinilai`}
                          />
                          <div
                            style={{ width: `${students.length > 0 ? (stats.pending / students.length) * 100 : 0}%` }}
                            className="bg-amber-400 h-full"
                            title={`${stats.pending} menunggu penilaian`}
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAssignmentForGrading(assignment);
                            setActiveSubmissionStudent(null);
                          }}
                          className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Periksa & Nilai ({stats.total})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(assignment)}
                          className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer"
                          title={assignment.status === 'active' ? 'Tutup Pengumpulan' : 'Buka Pengumpulan'}
                        >
                          <Clock className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingAssignment(assignment);
                            setFormData({
                              title: assignment.title,
                              subject: assignment.subject,
                              classId: assignment.classId,
                              description: assignment.description,
                              dueDate: assignment.dueDate,
                              dueTime: assignment.dueTime,
                              maxScore: assignment.maxScore,
                              attachmentUrl: assignment.attachmentUrl || '',
                              attachmentName: assignment.attachmentName || '',
                              notifyParents: false
                            });
                            setIsCreateModalOpen(true);
                          }}
                          className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer"
                          title="Edit Tugas"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAssignment(assignment)}
                          className="p-2.5 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-xl transition-colors cursor-pointer"
                          title="Hapus Tugas"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Buat / Edit Tugas (Guru/Admin) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  {editingAssignment ? 'Edit Tugas Online' : 'Buat Tugas Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tugas akan langsung muncul di panel siswa dan wali murid {selectedClass}.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Pilihan Model Tugas: Konvensional vs Online Interaktif (Auto-Grading) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Model Pengerjaan Tugas:
                </label>
                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/80 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setAssignmentMode('manual')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      assignmentMode === 'manual'
                        ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Konvensional (Foto / Berkas Jawaban)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignmentMode('online_quiz')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      assignmentMode === 'online_quiz'
                        ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Online Interaktif (PG & Esai Koreksi Otomatis)</span>
                  </button>
                </div>
              </div>

              {/* Judul Tugas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Judul Tugas / Materi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Latihan Soal Matematika: Pecahan & Desimal"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Grid: Mapel & Skor Max */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Mata Pelajaran <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {availableSubjects.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Skor / Bobot Maksimal
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={formData.maxScore}
                    onChange={e => setFormData({ ...formData, maxScore: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Grid: Tanggal & Jam Batas Pengumpulan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Batas Tanggal (Deadline) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Batas Jam (WIB)
                  </label>
                  <input
                    type="time"
                    value={formData.dueTime}
                    onChange={e => setFormData({ ...formData, dueTime: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Petunjuk / Deskripsi Tugas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Petunjuk & Instruksi Pengerjaan
                </label>
                <textarea
                  rows={3}
                  placeholder="Tuliskan petunjuk tugas dengan jelas. Contoh: Bacalah setiap butir soal dengan teliti dan pilih jawaban yang paling tepat."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              {/* Editor Butir Soal Online (PG & Esai) jika mode online_quiz */}
              {assignmentMode === 'online_quiz' && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <QuizQuestionEditor
                    questions={quizQuestions}
                    onChange={setQuizQuestions}
                    maxScore={formData.maxScore}
                  />
                </div>
              )}

              {/* Lampiran Materi Guru (Opsional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lampiran Berkas / Lembar Soal (Opsional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors">
                    <Paperclip className="w-4 h-4 text-indigo-500" />
                    <span>Pilih Berkas (PDF / Gambar)</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleTeacherFileUpload}
                      className="hidden"
                    />
                  </label>
                  {formData.attachmentName && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[200px]">
                      <span>{formData.attachmentName}</span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, attachmentUrl: '', attachmentName: '' })}
                        className="text-red-500 hover:text-red-700"
                        title="Hapus lampiran"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Notifikasi Push Checkbox */}
              {!editingAssignment && (
                <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="notifyParents"
                    checked={formData.notifyParents}
                    onChange={e => setFormData({ ...formData, notifyParents: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded-sm focus:ring-indigo-500"
                  />
                  <label htmlFor="notifyParents" className="text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                    <span className="font-bold block">Kirim Notifikasi Pengumuman & Floating Push</span>
                    Secara otomatis mengirimkan notifikasi mengambang ke HP Wali Murid {selectedClass} melalui bridge Median.
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAssignment}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingAssignment ? 'Menyimpan...' : (editingAssignment ? 'Simpan Perubahan' : 'Terbitkan Tugas')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Monitoring Pengumpulan & Pemberian Feedback Guru */}
      {selectedAssignmentForGrading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                    {selectedAssignmentForGrading.subject}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                    {selectedAssignmentForGrading.classId}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  Evaluasi & Penilaian: {selectedAssignmentForGrading.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAssignmentForGrading(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Layout: 2 Columns */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left Column: List of Students & Submission status */}
              <div className="w-full md:w-80 border-r border-slate-100 dark:border-slate-800 overflow-y-auto p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/30">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
                  Daftar Siswa ({students.length})
                </p>

                {students.map(std => {
                  const subId = `${selectedAssignmentForGrading.id}_${std.id}`;
                  const sub = submissions.find(s => s.id === subId || (s.assignmentId === selectedAssignmentForGrading.id && s.studentId === std.id));
                  const isSelected = activeSubmissionStudent?.student.id === std.id;

                  return (
                    <button
                      key={std.id}
                      type="button"
                      onClick={() => {
                        setActiveSubmissionStudent({ student: std, submission: sub });
                        setGradeInput(sub?.score !== undefined && sub.score !== null ? sub.score : '');
                        setFeedbackInput(sub?.feedback || '');
                        setFeedbackStatus(sub?.status === 'revision_needed' ? 'revision_needed' : 'graded');
                      }}
                      className={`w-full text-left p-3 rounded-2xl transition-all border flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800/80 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                          }`}>
                            #{std.absen_number || '-'}
                          </span>
                          <p className="text-xs font-bold truncate">{std.name}</p>
                        </div>

                        <div className="mt-1 flex items-center gap-1">
                          {sub ? (
                            sub.status === 'graded' ? (
                              <span className={`text-[10px] font-bold flex items-center gap-1 ${
                                isSelected ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Nilai: {sub.score}</span>
                              </span>
                            ) : sub.status === 'revision_needed' ? (
                              <span className={`text-[10px] font-bold flex items-center gap-1 ${
                                isSelected ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'
                              }`}>
                                <AlertCircle className="w-3 h-3" />
                                <span>Revisi</span>
                              </span>
                            ) : (
                              <span className={`text-[10px] font-bold flex items-center gap-1 ${
                                isSelected ? 'text-blue-200' : 'text-blue-600 dark:text-blue-400'
                              }`}>
                                <Clock className="w-3 h-3" />
                                <span>Terkumpul</span>
                              </span>
                            )
                          ) : (
                            <span className={`text-[10px] font-medium ${
                              isSelected ? 'text-white/60' : 'text-slate-400'
                            }`}>
                              Belum Mengumpulkan
                            </span>
                          )}
                        </div>
                      </div>

                      <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-300'}`} />
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Submission Details & Grading / Feedback Form */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {activeSubmissionStudent ? (
                  <div className="space-y-6">
                    {/* Student Identity Card */}
                    <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-bold text-slate-800 dark:text-white">
                          {activeSubmissionStudent.student.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          No. Absen: #{activeSubmissionStudent.student.absen_number || '-'} • NISN: {activeSubmissionStudent.student.nisn || '-'}
                        </p>
                      </div>

                      <div>
                        {activeSubmissionStudent.submission ? (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                            Tugas Dikumpulkan
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold">
                            Belum Ada Pengumpulan
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Submission Content */}
                    {activeSubmissionStudent.submission ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-3">
                          <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700/60 pb-2">
                            <span>
                              Waktu Kirim: <strong>{format(new Date(activeSubmissionStudent.submission.submittedAt), 'dd MMMM yyyy HH:mm', { locale: id })} WIB</strong>
                            </span>
                            {activeSubmissionStudent.submission.isLate && (
                              <span className="text-red-500 font-bold">⚠️ Terlambat</span>
                            )}
                          </div>

                          <div>
                            <p className="text-xs font-bold text-slate-400 mb-1">Jawaban / Uraian Siswa:</p>
                            <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                              {activeSubmissionStudent.submission.submissionText || '(Tidak ada uraian teks, hanya melampirkan berkas)'}
                            </div>
                          </div>

                          {activeSubmissionStudent.submission.attachmentUrl && (
                            <div>
                              <p className="text-xs font-bold text-slate-400 mb-1.5">Lembar Jawaban / Foto Tugas:</p>
                              {activeSubmissionStudent.submission.attachmentUrl.startsWith('data:image') || activeSubmissionStudent.submission.attachmentName?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                                <div className="space-y-2">
                                  <div className="max-h-80 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-black/5 flex items-center justify-center p-2">
                                    <img
                                      src={activeSubmissionStudent.submission.attachmentUrl}
                                      alt="Lembar Jawaban Siswa"
                                      className="max-h-72 object-contain rounded-xl shadow-xs"
                                    />
                                  </div>
                                  <div className="flex justify-end">
                                    <a
                                      href={activeSubmissionStudent.submission.attachmentUrl}
                                      download={activeSubmissionStudent.submission.attachmentName || `tugas_${activeSubmissionStudent.student.name}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Buka Foto Ukuran Penuh / Unduh</span>
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <a
                                  href={activeSubmissionStudent.submission.attachmentUrl}
                                  download={activeSubmissionStudent.submission.attachmentName || 'berkas_jawaban'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:shadow-xs transition-all"
                                >
                                  <FileText className="w-4 h-4" />
                                  <span>Unduh Dokumen: {activeSubmissionStudent.submission.attachmentName || 'Lembar Jawaban'}</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Grading & Feedback Form */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-sm space-y-4">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span>Formulir Penilaian & Umpan Balik (Feedback)</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Beri Nilai (Maks: {selectedAssignmentForGrading.maxScore}) <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min={0}
                                  max={selectedAssignmentForGrading.maxScore}
                                  value={gradeInput}
                                  onChange={e => setGradeInput(e.target.value === '' ? '' : Number(e.target.value))}
                                  placeholder={`0 - ${selectedAssignmentForGrading.maxScore}`}
                                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                  / {selectedAssignmentForGrading.maxScore}
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Status Evaluasi
                              </label>
                              <select
                                value={feedbackStatus}
                                onChange={e => setFeedbackStatus(e.target.value as any)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="graded">Sudah Dinilai (Selesai)</option>
                                <option value="revision_needed">Perlu Revisi (Siswa diminta perbaiki)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Umpan Balik Guru (Feedback Edukatif)
                            </label>
                            <textarea
                              rows={3}
                              placeholder="Tuliskan apresiasi, motivasi, atau koreksi catatan untuk siswa/wali murid..."
                              value={feedbackInput}
                              onChange={e => setFeedbackInput(e.target.value)}
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                            />
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              onClick={handleSaveGradeAndFeedback}
                              disabled={savingGrade}
                              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                              <span>{savingGrade ? 'Menyimpan...' : 'Kirim Nilai & Feedback'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                        <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Siswa Belum Mengumpulkan Tugas
                        </h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                          {activeSubmissionStudent.student.name} belum mengunggah lembar jawaban atau keterangan tugas ini.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                    <UserCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Pilih Siswa</p>
                    <p className="text-xs max-w-xs mt-1">
                      Klik salah satu nama siswa pada daftar di sebelah kiri untuk melihat lembar jawaban dan memberikan feedback.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pengumpulan Tugas oleh Siswa / Wali Murid */}
      {submittingAssignment && currentStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">
                  {submittingAssignment.subject}
                </span>
                <h3 className="text-base font-bold text-slate-800 dark:text-white mt-1">
                  Kumpulkan: {submittingAssignment.title}
                </h3>
              </div>
              <button
                onClick={() => setSubmittingAssignment(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStudentSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold block text-slate-800 dark:text-white mb-0.5">Petunjuk Guru:</span>
                {submittingAssignment.description || 'Selesaikan tugas dan unggah foto lembar jawaban.'}
              </div>

              {/* Uraian Jawaban / Catatan Siswa */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Teks Jawaban / Keterangan Pengerjaan
                </label>
                <textarea
                  rows={4}
                  placeholder="Tuliskan jawaban langsung di sini atau ketikkan catatan untuk guru..."
                  value={submitText}
                  onChange={e => setSubmitText(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              {/* Unggah Foto / Berkas Lembar Jawaban */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Unggah Foto Lembar Jawaban / Berkas Tugas
                </label>
                <div className="space-y-3">
                  <label className="cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 rounded-2xl bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/60 transition-colors">
                    <Upload className="w-8 h-8 text-indigo-500 mb-1.5" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Klik untuk Ambil Foto / Pilih Berkas
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">Maksimal 2.5 MB (Foto, PNG, JPG, atau PDF)</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleStudentFileUpload}
                      className="hidden"
                    />
                  </label>

                  {submitAttachmentUrl && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {submitAttachmentName || 'Berkas Jawaban'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitAttachmentUrl('');
                          setSubmitAttachmentName('');
                        }}
                        className="text-red-500 hover:text-red-700 p-1 rounded-lg"
                        title="Hapus berkas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSubmittingAssignment(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Mengirim...' : 'Kirim Tugas Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Lihat Feedback Guru (Wali Murid) */}
      {viewingFeedback && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase">Umpan Balik Guru</span>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  {viewingFeedback.assignment.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingFeedback(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Score Badge */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-indigo-500/10 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Nilai yang Diperoleh</span>
                  <p className="text-xs text-slate-400">Skor maksimal: {viewingFeedback.assignment.maxScore}</p>
                </div>
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {viewingFeedback.submission.score !== null ? viewingFeedback.submission.score : '-'}
                </div>
              </div>

              {/* Feedback Note */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Catatan & Evaluasi Guru:</span>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white leading-relaxed whitespace-pre-wrap border border-slate-100 dark:border-slate-700">
                  {viewingFeedback.submission.feedback || 'Tidak ada catatan tertulis.'}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                <span>Guru: {viewingFeedback.submission.feedbackBy || 'Guru Pengampu'}</span>
                {viewingFeedback.submission.feedbackAt && (
                  <span>{format(new Date(viewingFeedback.submission.feedbackAt), 'dd MMM yyyy HH:mm', { locale: id })}</span>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingFeedback(null)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pengerjaan Kuis / Soal Online Siswa (PG & Esai Koreksi Otomatis) */}
      {activeQuizAssignment && currentStudent && (
        <OnlineQuizTakerModal
          assignment={activeQuizAssignment}
          student={currentStudent}
          currentUserRole={userData?.role}
          currentUserName={userData?.name}
          existingSubmission={studentSubmissionsMap[activeQuizAssignment.id]}
          onClose={() => setActiveQuizAssignment(null)}
          onSuccess={() => {
            showToast('Tugas online berhasil dikumpulkan & dinilai otomatis!', 'success');
            setActiveQuizAssignment(null);
          }}
        />
      )}
    </div>
  );
}
