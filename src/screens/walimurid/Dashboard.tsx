import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, query, where, doc, onSnapshot, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileDown,
  CalendarDays,
  BookOpen,
  UserCircle,
  CheckCircle2,
  Edit2,
  X,
  Save,
  MessageSquare,
  Clock,
  Image as ImageIcon,
  Wallet,
  Coins,
  Bell,
  Megaphone,
  AlertCircle,
  ArrowRight,
  CheckCheck,
  Search,
  Filter,
  Calendar,
  Sparkles,
  Download,
  FileCheck,
  GraduationCap,
  Award,
  ChevronRight,
  LayoutDashboard,
  Check,
  Eye,
  Database
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ScheduleWidget from '../../components/ScheduleWidget';
import CalendarWidget from '../../components/CalendarWidget';
import PushNotificationManager from '../../components/PushNotificationManager';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useAnnouncementsNotification, AnnouncementItem } from '../../hooks/useAnnouncementsNotification';
import { useAssignmentDeadlineReminder } from '../../hooks/useAssignmentDeadlineReminder';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getCategoryBadgeStyle, formatClassBadge } from '../admin/Announcements';
import { generateAnnouncementPDF } from '../../lib/announcementPdf';
import AssignmentsScreen from '../Assignments';
import { formatTugasDisplay } from '../../lib/gradeSync';
import { triggerFloatingNotification } from '../../components/FloatingNotificationCenter';

export default function WaliMuridDashboard() {
  const { userData } = useAuth();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  
  // Tab Navigation State
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'akademik' | 'tugas' | 'pengumuman' | 'jadwal' | 'keuangan' | 'galeri' | 'profil'>('ringkasan');
  
  // Real-time data
  const [studentData, setStudentData] = useState<any>(null);
  const [grades, setGrades] = useState<Record<string, { tugas: any, pts: string, pas: string }>>({});
  const [attendance, setAttendance] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [kkmMap, setKkmMap] = useState<Record<string, number>>({});
  const [schoolSettings, setSchoolSettings] = useState<{ 
    namaSekolah: string; 
    namaKepalaSekolah: string; 
    nipKepalaSekolah: string; 
    tahunAjaran?: string;
    tandaTanganKepalaSekolah?: string;
    stempelSekolah?: string;
    kkmGlobal?: number | string;
    kkmMap?: Record<string, number>;
  }>({ namaSekolah: 'CERDAS', namaKepalaSekolah: '', nipKepalaSekolah: '', tahunAjaran: '2026/2027' });
  const [loading, setLoading] = useState(true);

  // Extra Data
  const [photos, setPhotos] = useState<any[]>([]);
  const [savingTransactions, setSavingTransactions] = useState<any[]>([]);
  const [kasTransactions, setKasTransactions] = useState<any[]>([]);

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', gender: 'L', address: '', birthDate: '', birthPlace: '' });
  const [saving, setSaving] = useState(false);

  // Announcements Notifications Hook for Wali Murid
  const {
    announcements,
    unreadAnnouncements,
    unreadCount,
    latestUnread,
    markAsRead,
    markAllAsRead,
    isUnread
  } = useAnnouncementsNotification(studentData?.classId);

  // Assignment Deadline Reminder Hook for Wali Murid
  const {
    activeAlerts: walimuridDeadlineAlerts
  } = useAssignmentDeadlineReminder(studentData?.classId);

  // Announcement tab filters
  const [announcementFilter, setAnnouncementFilter] = useState<'semua' | 'unread' | 'penting' | 'umum' | 'guru' | 'admin'>('semua');
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [selectedAnnouncementModal, setSelectedAnnouncementModal] = useState<AnnouncementItem | null>(null);

  // Sync tab from navigation location state
  useEffect(() => {
    if (location.state?.tab === 'pengumuman') {
      setActiveTab('pengumuman');
    } else if (location.state?.tab === 'tugas') {
      setActiveTab('tugas');
    } else if (location.state?.tab === 'akademik') {
      setActiveTab('akademik');
    }
  }, [location.state]);

  useEffect(() => {
    if (!userData?.uid) return;

    // Student Profile
    const unsubStudent = onSnapshot(doc(db, 'students', userData.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStudentData(data);
        setFormData({
          name: data.name || '',
          gender: data.gender || 'L',
          address: data.address || '',
          birthDate: data.birthDate || '',
          birthPlace: data.birthPlace || ''
        });
      }
    }, (err) => console.warn("unsubStudent error:", err));

    // Grades
    const unsubGrades = onSnapshot(doc(db, 'grades', userData.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGrades(data.gradesBySubject || {});
      }
    }, (err) => console.warn("unsubGrades error:", err));

    // Attendance
    const qAtt = query(collection(db, 'attendance'), where('studentId', '==', userData.uid));
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      const attCount = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
      snap.forEach(d => {
        const status = d.data().status;
        if (status === 'Hadir') attCount.hadir++;
        else if (status === 'Izin') attCount.izin++;
        else if (status === 'Sakit') attCount.sakit++;
        else if (status === 'Alpa') attCount.alpa++;
      });
      setAttendance(attCount);
    }, (err) => console.warn("unsubAtt error:", err));

    // School Settings
    const unsubSchool = onSnapshot(doc(db, 'pengaturan_sekolah', 'utama'), (docSnap) => {
      if (docSnap.exists()) setSchoolSettings(docSnap.data() as any);
    }, (err) => console.warn("unsubSchool error:", err));

    setLoading(false);

    return () => {
      unsubStudent();
      unsubGrades();
      unsubAtt();
      unsubSchool();
    };
  }, [userData]);

  // Subjects, gallery, and finance
  useEffect(() => {
    if (!studentData?.classId || !studentData?.id) return;
    
    // Subjects
    const unsubSubjects = onSnapshot(doc(db, 'mata_pelajaran', studentData.classId), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setSubjects(d.subjects || []);
        setKkmMap(d.kkmMap || {});
      } else {
        setSubjects([]);
        setKkmMap({});
      }
    }, (err) => console.warn("unsubSubjects error:", err));

    // Gallery
    const qGallery = query(collection(db, 'gallery'), where('classId', '==', studentData.classId));
    const unsubGallery = onSnapshot(qGallery, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      setPhotos(docs);
    }, (err) => console.warn("unsubGallery error:", err));

    // Savings
    const qSavings = query(collection(db, 'savings'), where('studentId', '==', studentData.id));
    const unsubSavings = onSnapshot(qSavings, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setSavingTransactions(docs);
    }, (err) => console.warn("unsubSavings error:", err));

    // Kas
    const qKas = query(collection(db, 'kas'), where('classId', '==', studentData.classId));
    const unsubKas = onSnapshot(qKas, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setKasTransactions(docs);
    }, (err) => console.warn("unsubKas error:", err));

    return () => {
      unsubSubjects();
      unsubGallery();
      unsubSavings();
      unsubKas();
    };
  }, [studentData?.classId, studentData?.id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'students', userData!.uid), formData);
      alert('Data santri berhasil diperbarui!');
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('Gagal memperbarui profil.');
    } finally {
      setSaving(false);
    }
  };

  const getSubjectKKM = (subj: string): number => {
    if (kkmMap && kkmMap[subj] !== undefined && Number(kkmMap[subj]) > 0) {
      return Number(kkmMap[subj]);
    }
    if (schoolSettings?.kkmMap?.[subj] !== undefined && Number(schoolSettings.kkmMap[subj]) > 0) {
      return Number(schoolSettings.kkmMap[subj]);
    }
    return Number(schoolSettings?.kkmGlobal) || 75;
  };

  const exportPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text((schoolSettings.namaSekolah || 'SEKOLAH').toUpperCase(), 105, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text('LAPORAN HASIL BELAJAR (RAPOR BAYANGAN)', 105, 28, { align: 'center' });
    pdf.setLineWidth(0.5);
    pdf.line(20, 32, 190, 32);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Nama Santri / Siswa`, 20, 45); pdf.text(`: ${studentData?.name || userData?.username}`, 70, 45);
    pdf.text(`Nomor Induk / NISN`, 20, 52); pdf.text(`: ${studentData?.absen_number || '-'} / ${studentData?.nisn || '-'}`, 70, 52);
    pdf.text(`Kelas`, 130, 45); pdf.text(`: ${studentData?.classId || '-'}`, 160, 45);
    pdf.text(`Tahun Ajaran`, 130, 52); pdf.text(`: ${schoolSettings.tahunAjaran || '2026/2027'}`, 160, 52);

    const tableBody = subjects.map((subj, idx) => {
      const g = grades[subj] || { tugas: '-', pts: '-', pas: '-' };
      const subjKkm = getSubjectKKM(subj);
      const tugasStr = formatTugasDisplay(g.tugas);
      return [(idx + 1).toString(), subj, subjKkm.toString(), tugasStr, g.pts || '-', g.pas || '-'];
    });

    if (tableBody.length === 0) tableBody.push(['-', 'Belum ada mata pelajaran', '-', '-', '-', '-']);

    autoTable(pdf, {
      startY: 65,
      head: [['No', 'Mata Pelajaran', 'KKM', 'Nilai Tugas (Otomatis)', 'Nilai PTS', 'Nilai PAS']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 55 },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
      }
    });

    const finalY = (pdf as any).lastAutoTable.finalY || 100;
    
    // Check page break for signature
    if (finalY > 230) {
      pdf.addPage();
    }
    const signatureY = finalY > 230 ? 20 : finalY + 15;

    pdf.setFont("helvetica", "normal");
    pdf.text('Mengetahui,', 40, signatureY, { align: 'center' });
    pdf.text('Kepala Sekolah', 40, signatureY + 6, { align: 'center' });

    // Bubuhkan Tanda Tangan Digital Kepala Sekolah
    if (schoolSettings.tandaTanganKepalaSekolah) {
      try {
        pdf.addImage(schoolSettings.tandaTanganKepalaSekolah, 'PNG', 26, signatureY + 7, 28, 16);
      } catch (err) {
        console.warn('Gagal menambahkan tanda tangan digital ke PDF:', err);
      }
    }

    // Bubuhkan Stempel Resmi Sekolah
    if (schoolSettings.stempelSekolah) {
      try {
        pdf.addImage(schoolSettings.stempelSekolah, 'PNG', 19, signatureY + 6, 22, 22);
      } catch (err) {
        console.warn('Gagal menambahkan stempel resmi ke PDF:', err);
      }
    }
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`${schoolSettings.namaKepalaSekolah || '________________________'}`, 40, signatureY + 25, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    
    if(schoolSettings.nipKepalaSekolah) {
      pdf.text(`NIP. ${schoolSettings.nipKepalaSekolah}`, 40, signatureY + 30, { align: 'center' });
    } else {
      pdf.text(`NIP. __________________`, 40, signatureY + 30, { align: 'center' });
    }

    pdf.text(`${schoolSettings.namaSekolah || 'Sekolah'}, ${new Date().toLocaleDateString('id-ID')}`, 160, signatureY, { align: 'center' });
    pdf.text('Wali Kelas', 160, signatureY + 6, { align: 'center' });
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`(________________________)`, 160, signatureY + 25, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    pdf.text(`NIP. __________________`, 160, signatureY + 30, { align: 'center' });

    pdf.save(`Rapor_${(studentData?.name || '').replace(/\s+/g, '_')}.pdf`);
  };

  const tabunganBalance = savingTransactions.reduce((acc, curr) => {
    return curr.type === 'setor' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  const kasBalance = kasTransactions.reduce((acc, curr) => {
    return curr.type === 'masuk' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Memuat dasbor wali santri...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* 1. Header Profile Card: Simple, Elegant & Clear */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
            <div className="w-20 h-20 sm:w-22 sm:h-22 bg-white/15 rounded-3xl flex items-center justify-center backdrop-blur-md border border-white/20 shrink-0 shadow-inner">
              <UserCircle className="w-12 h-12 sm:w-14 sm:h-14 text-indigo-100" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-0.5 rounded-full text-xs font-bold mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Santri Aktif • {studentData?.classId || 'Kelas 1'}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1.5">
                {studentData?.name || userData?.username}
              </h1>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 text-xs sm:text-sm text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-300" />
                  <span>NISN: <b>{studentData?.nisn || '-'}</b></span>
                </span>
                <span className="hidden sm:inline text-indigo-400">•</span>
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-indigo-300" />
                  <span>No. Absen: <b>{studentData?.absen_number || '-'}</b></span>
                </span>
                <span className="hidden sm:inline text-indigo-400">•</span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-indigo-300" />
                  <span>T.A: <b>{schoolSettings.tahunAjaran || '2026/2027'}</b></span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center md:justify-end shrink-0 pt-2 md:pt-0">
            <button
              onClick={exportPDF}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              title="Cetak Laporan Hasil Belajar Siswa (Rapor Bayangan)"
            >
              <FileDown className="w-4 h-4" />
              <span>Cetak Rapor PDF</span>
            </button>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-initial bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl border border-white/20 transition-all font-bold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              title="Koreksi Data Profil Santri"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Koreksi Profil</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Alert Banner: Compact Notification for Unread Announcements or Deadlines */}
      {unreadCount > 0 && latestUnread && (
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 p-[1.5px] rounded-2xl shadow-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[15px] p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/50">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-600 text-white">
                    Pengumuman Baru ({unreadCount})
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {latestUnread.title}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                  {latestUnread.content}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={() => {
                  markAsRead(latestUnread.id);
                  setActiveTab('pengumuman');
                  setSelectedAnnouncementModal(latestUnread);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span>Baca Pengumuman</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => markAsRead(latestUnread.id)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium cursor-pointer"
              >
                Tandai Dibaca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 4 Clean Quick Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Rapor & Nilai */}
        <button
          onClick={() => setActiveTab('akademik')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
              <span>Buka</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nilai & Rapor</p>
          <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {subjects.length} Mapel
          </h4>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            Nilai Tugas Masuk Otomatis
          </p>
        </button>

        {/* Card 2: Tugas & PR */}
        <button
          onClick={() => setActiveTab('tugas')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <FileCheck className="w-5 h-5" />
            </div>
            {walimuridDeadlineAlerts.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                {walimuridDeadlineAlerts.length} Batas Waktu
              </span>
            ) : (
              <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                <span>Buka</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tugas & Kuis</p>
          <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
            Modul Siswa
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            Kuis Online & Lembar PR
          </p>
        </button>

        {/* Card 3: Kehadiran */}
        <button
          onClick={() => setActiveTab('akademik')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <span>Rincian</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kehadiran Santri</p>
          <h4 className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {attendance.hadir} Hadir
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {attendance.izin + attendance.sakit + attendance.alpa} Izin/Sakit/Alpa
          </p>
        </button>

        {/* Card 4: Tabungan */}
        <button
          onClick={() => setActiveTab('keuangan')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-teal-300 dark:hover:border-teal-700 transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 flex items-center gap-0.5">
              <span>Dompet</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tabungan Santri</p>
          <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
            Rp {tabunganBalance.toLocaleString('id-ID')}
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Kas: Rp {kasBalance.toLocaleString('id-ID')}
          </p>
        </button>
      </div>

      {/* 4. Catatan Wali Kelas (Jika Ada) */}
      {studentData?.catatanWaliKelas && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
          <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <h4 className="text-xs font-bold text-amber-950 dark:text-amber-300">
                Pesan Khusus dari Wali Kelas ({studentData?.classId})
              </h4>
              {studentData?.catatanWaliKelasUpdated && (
                <span className="text-[10px] text-amber-800/70 dark:text-amber-400/70">
                  Diperbarui: {new Date(studentData.catatanWaliKelasUpdated).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
              "{studentData.catatanWaliKelas}"
            </p>
          </div>
        </div>
      )}

      {/* 5. Navigation Tab Pills: Simple, Responsive & Uncluttered */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-x-auto border border-slate-200/70 dark:border-slate-700/60 no-scrollbar">
        <button
          onClick={() => setActiveTab('ringkasan')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'ringkasan'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Ringkasan</span>
        </button>

        <button
          onClick={() => setActiveTab('akademik')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'akademik'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Nilai Rapor & KKM</span>
        </button>

        <button
          onClick={() => setActiveTab('tugas')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'tugas'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Tugas & PR</span>
          {walimuridDeadlineAlerts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
              {walimuridDeadlineAlerts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pengumuman')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'pengumuman'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Pengumuman</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('jadwal')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'jadwal'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Jadwal & Kalender</span>
        </button>

        <button
          onClick={() => setActiveTab('keuangan')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'keuangan'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Keuangan & Tabungan</span>
        </button>

        <button
          onClick={() => setActiveTab('galeri')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'galeri'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Galeri Kegiatan</span>
        </button>

        <button
          onClick={() => setActiveTab('profil')}
          className={`py-2 px-3.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'profil'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <UserCircle className="w-3.5 h-3.5" />
          <span>Profil Santri</span>
        </button>
      </div>

      {/* 6. TAB CONTENT PANELS */}

      {/* TAB: RINGKASAN (Overview Utama) */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Quick Push Notification Setup & Device Status */}
          <PushNotificationManager />

          {/* Today's Schedule Quick View */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Jadwal Pelajaran Ananda ({studentData?.classId || 'Kelas 1'})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pantau mata pelajaran dan kegiatan belajar hari ini
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('jadwal')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Lihat Seluruh Jadwal</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <ScheduleWidget classId={studentData?.classId || 'Kelas 1'} title="" />
          </div>

          {/* Recent Announcements Preview (Simple List) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Pengumuman & Pemberitahuan Terbaru
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Informasi resmi dari pihak sekolah dan wali kelas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('pengumuman')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Lihat Semua ({announcements.length})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {announcements.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    markAsRead(item.id);
                    setSelectedAnnouncementModal(item);
                  }}
                  className="py-3 sm:py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-xl transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.authorRole === 'Guru'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                      }`}>
                        {item.authorRole === 'Guru' ? `Guru ${item.authorClass || ''}` : 'Admin Sekolah'}
                      </span>
                      {isUnread(item.id) && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white">
                          BARU
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {item.date?.toDate ? format(item.date.toDate(), 'dd MMM yyyy, HH:mm', { locale: id }) : 'Baru saja'}
                      </span>
                    </div>
                    <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                      {item.title}
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {item.content}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 self-center" />
                </div>
              ))}

              {announcements.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">Belum ada pengumuman.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: AKADEMIK (Laporan Nilai & Rapor) */}
      {activeTab === 'akademik' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Attendance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-emerald-100 dark:border-emerald-950/80 text-center">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Total Hadir</p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">{attendance.hadir}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-blue-100 dark:border-blue-950/80 text-center">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Total Izin</p>
              <p className="text-2xl sm:text-3xl font-black text-blue-700 dark:text-blue-300">{attendance.izin}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-amber-100 dark:border-amber-950/80 text-center">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Total Sakit</p>
              <p className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300">{attendance.sakit}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-rose-100 dark:border-rose-950/80 text-center">
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">Total Alpa</p>
              <p className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300">{attendance.alpa}</p>
            </div>
          </div>

          {/* Grades Table: Otomatis Menampilkan Nilai Tugas */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Daftar Nilai Akademik Santri (Rapor Bayangan)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Nilai tugas yang dikerjakan santri otomatis tersinkronisasi ke dalam tabel rapor ini.
                </p>
              </div>
              <button 
                onClick={exportPDF}
                className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-xl transition-all font-bold text-xs cursor-pointer border border-indigo-200 dark:border-indigo-800/60"
              >
                <FileDown className="w-4 h-4" />
                <span>Cetak Rapor PDF</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <th className="px-5 py-3.5">Mata Pelajaran</th>
                    <th className="px-5 py-3.5 text-center">KKM</th>
                    <th className="px-5 py-3.5 text-center bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                      Nilai Tugas (Otomatis)
                    </th>
                    <th className="px-5 py-3.5 text-center">PTS</th>
                    <th className="px-5 py-3.5 text-center">PAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {subjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-500">
                        Belum ada daftar mata pelajaran untuk kelas {studentData?.classId || ''}.
                      </td>
                    </tr>
                  ) : (
                    subjects.map(subj => {
                      const g = grades[subj] || { tugas: '-', pts: '-', pas: '-' };
                      const subjKkm = getSubjectKKM(subj);
                      const displayTugas = formatTugasDisplay(g.tugas);

                      return (
                        <tr key={subj} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-4 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                            {subj}
                          </td>
                          <td className="px-5 py-4 text-xs font-bold text-center text-slate-500 dark:text-slate-400">
                            {subjKkm}
                          </td>
                          <td className="px-5 py-4 text-xs sm:text-sm text-center font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20">
                            {displayTugas !== '-' ? (
                              <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 rounded-lg">
                                {displayTugas}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs sm:text-sm text-center text-slate-700 dark:text-slate-300 font-medium">
                            {g.pts || '-'}
                          </td>
                          <td className="px-5 py-4 text-xs sm:text-sm text-center text-slate-700 dark:text-slate-300 font-medium">
                            {g.pas || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: TUGAS (Modul Pengumpulan Tugas & Kuis Online) */}
      {activeTab === 'tugas' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <AssignmentsScreen />
        </div>
      )}

      {/* TAB: PENGUMUMAN (Tampilan Diperbaiki: Rapi, Responsif, Tidak Memanjang Sempit) */}
      {activeTab === 'pengumuman' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Header & Filter Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold mb-1">
                  <Megaphone className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pusat Pengumuman & Surat Resmi Sekolah</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Pengumuman Kelas {studentData?.classId || '1'} & Umum
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4 text-emerald-500" />
                    <span>Tandai Semua Telah Dibaca</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills & Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap gap-1.5 flex-1">
                <button
                  onClick={() => setAnnouncementFilter('semua')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    announcementFilter === 'semua'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Semua ({announcements.length})
                </button>

                <button
                  onClick={() => setAnnouncementFilter('unread')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    announcementFilter === 'unread'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span>Belum Dibaca</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200 text-rose-900 font-black">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setAnnouncementFilter('penting')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    announcementFilter === 'penting'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Penting / Mendesak
                </button>

                <button
                  onClick={() => setAnnouncementFilter('guru')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    announcementFilter === 'guru'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Wali Kelas
                </button>

                <button
                  onClick={() => setAnnouncementFilter('admin')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    announcementFilter === 'admin'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Admin Sekolah
                </button>
              </div>

              {/* Search */}
              <div className="relative min-w-[200px] sm:min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={announcementSearch}
                  onChange={(e) => setAnnouncementSearch(e.target.value)}
                  placeholder="Cari pengumuman..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Announcements List: Wide, Clean, No Squeezing */}
          <div className="space-y-4">
            {announcements
              .filter((a) => {
                if (announcementFilter === 'unread') return isUnread(a.id);
                if (announcementFilter === 'penting') return a.priority === 'Penting' || a.priority === 'Tinggi (Penting)';
                if (announcementFilter === 'guru') return a.authorRole === 'Guru';
                if (announcementFilter === 'admin') return a.authorRole !== 'Guru';
                return true;
              })
              .filter((a) => {
                if (!announcementSearch.trim()) return true;
                const term = announcementSearch.toLowerCase();
                return (
                  a.title.toLowerCase().includes(term) ||
                  a.content.toLowerCase().includes(term) ||
                  (a.category && a.category.toLowerCase().includes(term))
                );
              })
              .map((item) => {
                const unread = isUnread(item.id);
                const isUrgent = item.priority === 'Penting' || item.priority === 'Tinggi (Penting)';
                const isFromGuru = item.authorRole === 'Guru';

                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border transition-all duration-200 relative overflow-hidden ${
                      unread
                        ? 'border-indigo-300 dark:border-indigo-700/80 shadow-md ring-1 ring-indigo-200 dark:ring-indigo-900/50'
                        : 'border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md'
                    }`}
                  >
                    {/* Left Accent indicator for unread or urgent */}
                    {isUrgent ? (
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 sm:w-2 bg-rose-500" />
                    ) : unread ? (
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 sm:w-2 bg-indigo-600" />
                    ) : null}

                    {/* Card Content: Full Width Header & Content */}
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 w-full">
                      <div className="flex items-start gap-3 sm:gap-3.5 w-full flex-1 min-w-0">
                        <div
                          className={`p-2.5 sm:p-3 rounded-2xl shrink-0 ${
                            isUrgent
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                              : isFromGuru
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          <Megaphone className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0 w-full">
                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isFromGuru
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                              }`}
                            >
                              {isFromGuru ? `Guru ${item.authorClass || ''}` : 'Admin Sekolah'}
                            </span>

                            {isUrgent && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                Penting
                              </span>
                            )}

                            {item.targetClass && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {formatClassBadge(item.targetClass)}
                              </span>
                            )}

                            {item.category && (() => {
                              const badgeStyle = getCategoryBadgeStyle(item.category);
                              return (
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${badgeStyle.bg}`}>
                                  <span>{badgeStyle.icon}</span>
                                  <span>{item.category}</span>
                                </span>
                              );
                            })()}

                            {unread && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-2xs">
                                BARU
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug break-words">
                            {item.title}
                          </h4>

                          {/* Timestamp */}
                          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 font-medium my-1.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {item.date?.toDate
                                ? format(item.date.toDate(), 'EEEE, dd MMMM yyyy - HH:mm', { locale: id }) + ' WIB'
                                : 'Baru saja'}
                            </span>
                          </div>

                          {/* Content Snippet: Uses Full Width */}
                          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 bg-slate-50/80 dark:bg-slate-800/60 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl leading-relaxed whitespace-pre-wrap break-words border border-slate-100 dark:border-slate-800/80 mt-2 w-full">
                            {item.content}
                          </div>
                        </div>
                      </div>

                      {/* Right action buttons: Positioned at bottom on mobile, side on desktop */}
                      <div className="w-full sm:w-auto shrink-0 flex items-center justify-between sm:justify-end gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 mt-1 sm:mt-0">
                        <button
                          onClick={() => generateAnnouncementPDF(item, schoolSettings)}
                          className="flex-1 sm:flex-initial px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Download Surat / Dokumen PDF Resmi Pengumuman ini"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh PDF</span>
                        </button>

                        <button
                          onClick={() => {
                            markAsRead(item.id);
                            setSelectedAnnouncementModal(item);
                          }}
                          className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Rincian</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => markAsRead(item.id)}
                          className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                            unread
                              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              : 'bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                          }`}
                        >
                          {unread ? 'Tandai Dibaca' : 'Sudah Dibaca'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            {announcements.length === 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-500 mx-auto mb-3">
                  <Megaphone className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Belum Ada Pengumuman
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Pengumuman dan pemberitahuan resmi dari pihak Admin atau Guru sekolah akan tampil
                  secara otomatis di sini.
                </p>
              </div>
            )}
          </div>

          {/* Announcement Detail Modal: Clean and Wide */}
          {selectedAnnouncementModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        selectedAnnouncementModal.authorRole === 'Guru'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                      }`}
                    >
                      Pengirim: {selectedAnnouncementModal.authorName || (selectedAnnouncementModal.authorRole === 'Guru' ? 'Guru Kelas' : 'Admin Sekolah')}
                    </span>
                    {selectedAnnouncementModal.priority === 'Penting' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        Penting / Mendesak
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Sasaran: {formatClassBadge(selectedAnnouncementModal.targetClass)}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedAnnouncementModal(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                  {selectedAnnouncementModal.title}
                </h3>

                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {selectedAnnouncementModal.date?.toDate
                      ? format(selectedAnnouncementModal.date.toDate(), 'EEEE, dd MMMM yyyy - HH:mm', { locale: id }) + ' WIB'
                      : 'Baru saja'}
                  </span>
                  {selectedAnnouncementModal.category && (
                    <span>• {selectedAnnouncementModal.category}</span>
                  )}
                </div>

                <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words font-normal mb-6 bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 max-h-[50vh] overflow-y-auto">
                  {selectedAnnouncementModal.content}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => generateAnnouncementPDF(selectedAnnouncementModal, schoolSettings)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-colors border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Dokumen PDF</span>
                  </button>
                  <button
                    onClick={() => setSelectedAnnouncementModal(null)}
                    className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                  >
                    Tutup Pengumuman
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: JADWAL & KALENDER */}
      {activeTab === 'jadwal' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Jadwal Pelajaran Widget */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <ScheduleWidget classId={studentData?.classId || 'Kelas 1'} title={`Jadwal Pelajaran & Ujian Santri (${studentData?.classId || 'Kelas 1'})`} />
          </div>

          {/* Kalender Pendidikan Widget */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <CalendarWidget targetRole="walimurid" classFilter={studentData?.classId || 'Kelas 1'} />
          </div>
        </div>
      )}

      {/* TAB: KEUANGAN */}
      {activeTab === 'keuangan' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-3xl text-white shadow-lg">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-emerald-100 font-medium text-xs">Saldo Tabungan Santri</p>
                  <p className="text-xs text-emerald-100/80">Total simpanan {studentData?.name}</p>
                </div>
              </div>
              <h3 className="text-3xl sm:text-4xl font-black">Rp {tabunganBalance.toLocaleString('id-ID')}</h3>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-3xl text-white shadow-lg">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Coins className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-blue-100 font-medium text-xs">Uang Kas Kelas</p>
                  <p className="text-xs text-blue-100/80">Saldo kas kelas {studentData?.classId}</p>
                </div>
              </div>
              <h3 className="text-3xl sm:text-4xl font-black">Rp {kasBalance.toLocaleString('id-ID')}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Tabungan History */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Riwayat Tabungan</h4>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 font-bold">
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Keterangan</th>
                      <th className="px-4 py-3 text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {savingTransactions.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-xs">Belum ada transaksi tabungan</td></tr>
                    ) : (
                      savingTransactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                            {trx.date?.toDate ? format(trx.date.toDate(), 'dd/MM/yy', { locale: id }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{trx.note}</td>
                          <td className={`px-4 py-3 text-xs font-bold text-right ${trx.type === 'setor' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {trx.type === 'setor' ? '+' : '-'} Rp {trx.amount.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kas History */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Laporan Kas Kelas</h4>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 font-bold">
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Keterangan</th>
                      <th className="px-4 py-3 text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {kasTransactions.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-xs">Belum ada transaksi kas</td></tr>
                    ) : (
                      kasTransactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                            {trx.date?.toDate ? format(trx.date.toDate(), 'dd/MM/yy', { locale: id }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{trx.note}</td>
                          <td className={`px-4 py-3 text-xs font-bold text-right ${trx.type === 'masuk' ? 'text-blue-600' : 'text-rose-600'}`}>
                            {trx.type === 'masuk' ? '+' : '-'} Rp {trx.amount.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: GALERI KEGIATAN */}
      {activeTab === 'galeri' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Galeri Kegiatan Santri Kelas {studentData?.classId}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {photos.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800 flex flex-col items-center">
                <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">Belum Ada Foto Kegiatan</h4>
                <p className="text-xs text-slate-400 mt-1">Dokumentasi momen kegiatan kelas akan diunggah oleh wali kelas di sini.</p>
              </div>
            ) : (
              photos.map((photo) => (
                <div key={photo.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden group">
                  <div className="aspect-square bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                    <img 
                      src={photo.url} 
                      alt={photo.caption} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                      {photo.caption || 'Momen kegiatan kelas'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {photo.createdAt?.toDate ? format(photo.createdAt.toDate(), 'dd MMM yyyy', { locale: id }) : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: PROFIL SANTRI */}
      {activeTab === 'profil' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 p-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Data Induk Santri</h3>
              <p className="text-xs text-slate-400">Informasi biodata terdaftar di sistem madrasah / sekolah</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Data</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Nama Lengkap Santri</p>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{studentData?.name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Nomor Induk / NISN</p>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{studentData?.nisn || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Jenis Kelamin</p>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{studentData?.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Tempat, Tanggal Lahir</p>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{studentData?.birthPlace || '-'}, {studentData?.birthDate || '-'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400 mb-0.5">Alamat Tempat Tinggal</p>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{studentData?.address || '-'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Profil */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Koreksi Data Santri</h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap Santri</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Jenis Kelamin</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Tempat Lahir</label>
                  <input
                    type="text"
                    value={formData.birthPlace}
                    onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Alamat Lengkap</label>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
