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
  Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ScheduleWidget from '../../components/ScheduleWidget';
import CalendarWidget from '../../components/CalendarWidget';
import PushNotificationManager from '../../components/PushNotificationManager';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useAnnouncementsNotification, AnnouncementItem } from '../../hooks/useAnnouncementsNotification';
import { getCategoryBadgeStyle } from '../admin/Announcements';

export default function WaliMuridDashboard() {
  const { userData } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'profil' | 'akademik' | 'galeri' | 'keuangan' | 'pengumuman'>('profil');
  
  // Real-time data
  const [studentData, setStudentData] = useState<any>(null);
  const [grades, setGrades] = useState<Record<string, { tugas: string, pts: string, pas: string }>>({});
  const [attendance, setAttendance] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<{ namaSekolah: string; namaKepalaSekolah: string; nipKepalaSekolah: string; tahunAjaran?: string }>({ namaSekolah: 'CERDAS', namaKepalaSekolah: '', nipKepalaSekolah: '', tahunAjaran: '2026/2027' });
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

  // Announcement tab filters
  const [announcementFilter, setAnnouncementFilter] = useState<'semua' | 'unread' | 'penting' | 'umum' | 'guru' | 'admin'>('semua');
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [selectedAnnouncementModal, setSelectedAnnouncementModal] = useState<AnnouncementItem | null>(null);

  // Sync tab from navigation location state
  useEffect(() => {
    if (location.state?.tab === 'pengumuman') {
      setActiveTab('pengumuman');
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

    // Attendance (Listen to changes if needed, but summary usually from a query)
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

  // We also need subjects from class, gallery, and finance
  useEffect(() => {
    if (!studentData?.classId || !studentData?.id) return;
    
    // Subjects
    const unsubSubjects = onSnapshot(doc(db, 'mata_pelajaran', studentData.classId), (docSnap) => {
      if (docSnap.exists()) setSubjects(docSnap.data().subjects || []);
    }, (err) => console.warn("unsubSubjects error:", err));

    // Gallery (avoid composite index requirement)
    const qGallery = query(collection(db, 'gallery'), where('classId', '==', studentData.classId));
    const unsubGallery = onSnapshot(qGallery, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setPhotos(docs);
    }, (err) => console.warn("unsubGallery error:", err));

    // Tabungan (avoid composite index requirement)
    const qSavings = query(collection(db, 'savings'), where('studentId', '==', studentData.id));
    const unsubSavings = onSnapshot(qSavings, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setSavingTransactions(docs);
    }, (err) => console.warn("unsubSavings error:", err));

    // Kas (avoid composite index requirement)
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
      alert('Profil berhasil diperbarui!');
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('Gagal memperbarui profil.');
    } finally {
      setSaving(false);
    }
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
    pdf.text(`Nama Peserta Didik`, 20, 45); pdf.text(`: ${studentData?.name || userData?.username}`, 70, 45);
    pdf.text(`Nomor Induk / NISN`, 20, 52); pdf.text(`: ${studentData?.absen_number || '-'} / ${studentData?.nisn || '-'}`, 70, 52);
    pdf.text(`Kelas`, 130, 45); pdf.text(`: ${studentData?.classId || '-'}`, 160, 45);
    // Note: To show precise Wali Kelas name in parent's dash, we'd need to query the users table for that class.
    // For now we'll leave it as a general format.
    pdf.text(`Tahun Ajaran`, 130, 52); pdf.text(`: ${schoolSettings.tahunAjaran || '2026/2027'}`, 160, 52);

    const tableBody = subjects.map(subj => {
      const g = grades[subj] || { tugas: '-', pts: '-', pas: '-' };
      return [subj, g.tugas || '-', g.pts || '-', g.pas || '-'];
    });

    if (tableBody.length === 0) tableBody.push(['Belum ada mata pelajaran', '-', '-', '-']);

    autoTable(pdf, {
      startY: 65,
      head: [['Mata Pelajaran', 'Nilai Tugas', 'Nilai PTS', 'Nilai PAS']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    const finalY = (pdf as any).lastAutoTable.finalY || 100;
    
    // Check page break for signature
    if (finalY > 230) {
      pdf.addPage();
    }
    const signatureY = finalY > 230 ? 20 : finalY;

    pdf.setFont("helvetica", "normal");
    pdf.text('Mengetahui,', 40, signatureY + 30, { align: 'center' });
    pdf.text('Kepala Sekolah', 40, signatureY + 38, { align: 'center' });
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`${schoolSettings.namaKepalaSekolah || '________________________'}`, 40, signatureY + 60, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    
    if(schoolSettings.nipKepalaSekolah) {
      pdf.text(`NIP. ${schoolSettings.nipKepalaSekolah}`, 40, signatureY + 65, { align: 'center' });
    } else {
      pdf.text(`NIP. __________________`, 40, signatureY + 65, { align: 'center' });
    }

    pdf.text(`${schoolSettings.namaSekolah || 'Sekolah'}, ${new Date().toLocaleDateString('id-ID')}`, 160, signatureY + 30, { align: 'center' });
    pdf.text('Wali Kelas', 160, signatureY + 38, { align: 'center' });
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`(________________________)`, 160, signatureY + 60, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    pdf.text(`NIP. __________________`, 160, signatureY + 65, { align: 'center' });

    pdf.save(`Rapor_${(studentData?.name || '').replace(/\s+/g, '_')}.pdf`);
  };

  const tabunganBalance = savingTransactions.reduce((acc, curr) => {
    return curr.type === 'setor' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  const kasBalance = kasTransactions.reduce((acc, curr) => {
    return curr.type === 'masuk' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  if (loading) {
    return <div className="text-center py-10">Memuat data anak Anda...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header Profile Summary */}
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 shrink-0">
            <UserCircle className="w-12 h-12 text-white/80" />
          </div>
          <div className="text-center md:text-left flex-1">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/30 px-3 py-1 rounded-full border border-indigo-400/30 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-medium text-indigo-100">Siswa Aktif</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">{studentData?.name || userData?.username}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-indigo-100">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">NISN: {studentData?.nisn || '-'}</span>
              </div>
              <div className="w-1 h-1 bg-indigo-300 rounded-full hidden md:block" />
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-4 h-4" />
                <span className="text-sm">Kelas: {studentData?.classId || '-'}</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 mt-4 md:mt-0">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl border border-white/20 transition-colors font-medium text-sm flex items-center space-x-2"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit Profil</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Notification Banner for Wali Murid: Pemberitahuan Baru dari Admin / Guru */}
      {unreadCount > 0 && latestUnread && (
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 p-[1.5px] rounded-3xl shadow-lg">
          <div className="bg-white dark:bg-slate-900 rounded-[22px] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/50 shadow-xs">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                    Pemberitahuan Baru ({unreadCount})
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      latestUnread.authorRole === 'Guru'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                    }`}
                  >
                    Dari: {latestUnread.authorName || (latestUnread.authorRole === 'Guru' ? 'Guru Kelas' : 'Admin Sekolah')}
                  </span>
                  {latestUnread.category && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      • {latestUnread.category}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {latestUnread.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 mt-1 leading-relaxed">
                  {latestUnread.content}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  markAsRead(latestUnread.id);
                  setActiveTab('pengumuman');
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5"
              >
                <span>Baca Sekarang</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => markAsRead(latestUnread.id)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                title="Tandai telah dibaca"
              >
                Tandai Dibaca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catatan / Pesan Khusus dari Wali Kelas */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 rounded-3xl p-6 border border-amber-200/80 shadow-xs relative overflow-hidden">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
                Pesan Khusus dari Wali Kelas ({studentData?.classId || 'Kelas'})
              </h3>
              {studentData?.catatanWaliKelasUpdated && (
                <span className="text-xs text-amber-800/70 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Diperbarui: {new Date(studentData.catatanWaliKelasUpdated).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            {studentData?.catatanWaliKelas ? (
              <p className="text-sm text-amber-900 leading-relaxed font-medium bg-white/70 p-4 rounded-2xl border border-amber-200/60 shadow-2xs mt-2">
                "{studentData.catatanWaliKelas}"
              </p>
            ) : (
              <p className="text-xs text-amber-800/80 italic mt-1">
                Belum ada catatan khusus yang disampaikan oleh Wali Kelas untuk ananda {studentData?.name || ''}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Jadwal Pelajaran & Ujian Widget */}
      <ScheduleWidget classId={studentData?.classId || 'Kelas 1'} title={`Jadwal Pelajaran & Ujian Ananda (${studentData?.classId || 'Kelas 1'})`} />

      {/* Kalender Pendidikan & Tanggal Penting Widget */}
      <CalendarWidget targetRole="walimurid" classFilter={studentData?.classId || 'Kelas 1'} />

      {/* Push Notification Manager (Median & PWA Device Sync) */}
      <PushNotificationManager />

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl w-full max-w-3xl mx-auto md:mx-0 overflow-x-auto border border-slate-200/60 dark:border-slate-700/60">
        <button
          onClick={() => setActiveTab('profil')}
          className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'profil'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Data Profil
        </button>
        <button
          onClick={() => setActiveTab('akademik')}
          className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'akademik'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Akademik & Nilai
        </button>
        <button
          onClick={() => setActiveTab('pengumuman')}
          className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
            activeTab === 'pengumuman'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Pengumuman</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('galeri')}
          className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'galeri'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Galeri Kelas
        </button>
        <button
          onClick={() => setActiveTab('keuangan')}
          className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'keuangan'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Keuangan
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'profil' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Detail Informasi Siswa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500 mb-1">Nama Lengkap</p>
              <p className="font-medium text-slate-800">{studentData?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Jenis Kelamin</p>
              <p className="font-medium text-slate-800">{studentData?.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Tempat, Tanggal Lahir</p>
              <p className="font-medium text-slate-800">{studentData?.birthPlace || '-'}, {studentData?.birthDate || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Alamat Lengkap</p>
              <p className="font-medium text-slate-800">{studentData?.address || '-'}</p>
            </div>
          </div>
        </div>
      ) : activeTab === 'akademik' ? (
        <div className="space-y-6">
          {/* Attendance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 text-center">
              <p className="text-sm font-medium text-emerald-600 mb-1">Hadir</p>
              <p className="text-3xl font-bold text-emerald-700">{attendance.hadir}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 text-center">
              <p className="text-sm font-medium text-blue-600 mb-1">Izin</p>
              <p className="text-3xl font-bold text-blue-700">{attendance.izin}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100 text-center">
              <p className="text-sm font-medium text-amber-600 mb-1">Sakit</p>
              <p className="text-3xl font-bold text-amber-700">{attendance.sakit}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 text-center">
              <p className="text-sm font-medium text-red-600 mb-1">Alpa</p>
              <p className="text-3xl font-bold text-red-700">{attendance.alpa}</p>
            </div>
          </div>

          {/* Grades Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Daftar Nilai Akademik</h3>
              <button 
                onClick={exportPDF}
                className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl transition-colors font-medium text-sm"
              >
                <FileDown className="w-4 h-4" />
                <span className="hidden sm:inline">Cetak PDF</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-sm text-slate-500">
                    <th className="px-6 py-4 font-medium">Mata Pelajaran</th>
                    <th className="px-6 py-4 font-medium text-center">Tugas</th>
                    <th className="px-6 py-4 font-medium text-center">PTS</th>
                    <th className="px-6 py-4 font-medium text-center">PAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Belum ada nilai.</td>
                    </tr>
                  ) : (
                    subjects.map(subj => {
                      const g = grades[subj] || { tugas: '-', pts: '-', pas: '-' };
                      return (
                        <tr key={subj} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-slate-700">{subj}</td>
                          <td className="px-6 py-4 text-sm text-center text-slate-600 font-medium">{g.tugas || '-'}</td>
                          <td className="px-6 py-4 text-sm text-center text-slate-600 font-medium">{g.pts || '-'}</td>
                          <td className="px-6 py-4 text-sm text-center text-slate-600 font-medium">{g.pas || '-'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'galeri' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Galeri Kegiatan Kelas</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-100 flex flex-col items-center">
                <ImageIcon className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-700">Belum Ada Foto</h3>
                <p className="text-sm text-slate-500 mt-1">Belum ada momen kegiatan kelas yang dibagikan.</p>
              </div>
            ) : (
              photos.map((photo) => (
                <div key={photo.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group">
                  <div className="aspect-square bg-slate-100 relative">
                    <img 
                      src={photo.url} 
                      alt={photo.caption} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-medium text-slate-800 line-clamp-2">
                      {photo.caption || 'Tanpa keterangan'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {photo.createdAt?.toDate ? format(photo.createdAt.toDate(), 'dd MMM yyyy', { locale: id }) : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-3xl text-white shadow-lg shadow-emerald-200">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-emerald-100 font-medium">Saldo Tabungan Siswa</p>
                  <p className="text-sm text-emerald-50 opacity-80">Total simpanan {studentData?.name}</p>
                </div>
              </div>
              <h3 className="text-4xl font-bold">Rp {tabunganBalance.toLocaleString('id-ID')}</h3>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl text-white shadow-lg shadow-blue-200">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Coins className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-blue-100 font-medium">Uang Kas Kelas</p>
                  <p className="text-sm text-blue-50 opacity-80">Saldo kas {studentData?.classId}</p>
                </div>
              </div>
              <h3 className="text-4xl font-bold">Rp {kasBalance.toLocaleString('id-ID')}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabungan History */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800">Riwayat Tabungan</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">Tanggal</th>
                      <th className="px-4 py-3 font-medium">Ket</th>
                      <th className="px-4 py-3 font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {savingTransactions.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500 text-sm">Belum ada transaksi</td></tr>
                    ) : (
                      savingTransactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-xs text-slate-600">{trx.date?.toDate ? format(trx.date.toDate(), 'dd/MM/yy', { locale: id }) : '-'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{trx.note}</td>
                          <td className={`px-4 py-3 text-xs font-bold ${trx.type === 'setor' ? 'text-emerald-600' : 'text-red-600'}`}>
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
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800">Laporan Kas Kelas</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">Tanggal</th>
                      <th className="px-4 py-3 font-medium">Ket</th>
                      <th className="px-4 py-3 font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kasTransactions.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500 text-sm">Belum ada transaksi</td></tr>
                    ) : (
                      kasTransactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-xs text-slate-600">{trx.date?.toDate ? format(trx.date.toDate(), 'dd/MM/yy', { locale: id }) : '-'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{trx.note}</td>
                          <td className={`px-4 py-3 text-xs font-bold ${trx.type === 'masuk' ? 'text-blue-600' : 'text-red-600'}`}>
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

      {/* Tab Content: Pengumuman & Pemberitahuan */}
      {activeTab === 'pengumuman' && (
        <div className="space-y-6">
          {/* Header & Filter Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold mb-1.5">
                  <Megaphone className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pusat Informasi & Notifikasi Wali Murid</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Pengumuman Resmi Sekolah & Guru
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pemberitahuan khusus untuk siswa kelas {studentData?.classId || '1'} serta informasi umum sekolah.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <PushNotificationManager compact />
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors"
                  >
                    <CheckCheck className="w-4 h-4 text-emerald-500" />
                    <span>Tandai Semua Telah Dibaca</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap gap-1.5 flex-1">
                <button
                  onClick={() => setAnnouncementFilter('semua')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    announcementFilter === 'semua'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Semua ({announcements.length})
                </button>

                <button
                  onClick={() => setAnnouncementFilter('unread')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    announcementFilter === 'unread'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span>Belum Dibaca</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200 text-rose-900">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setAnnouncementFilter('penting')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                    announcementFilter === 'penting'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Penting</span>
                </button>

                <button
                  onClick={() => setAnnouncementFilter('umum')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                    announcementFilter === 'umum'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span>📢</span>
                  <span>Pengumuman Umum</span>
                </button>

                <button
                  onClick={() => setAnnouncementFilter('guru')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    announcementFilter === 'guru'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Dari Guru
                </button>

                <button
                  onClick={() => setAnnouncementFilter('admin')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    announcementFilter === 'admin'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Dari Admin
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

          {/* Announcements Grid / List */}
          <div className="space-y-4">
            {announcements
              .filter((a) => {
                // Filter type
                if (announcementFilter === 'unread') return isUnread(a.id);
                if (announcementFilter === 'penting') return a.priority === 'Penting' || a.priority === 'Tinggi (Penting)';
                if (announcementFilter === 'umum') {
                  const cat = (a.category || '').toLowerCase();
                  return (
                    !a.category ||
                    cat.includes('umum') ||
                    cat.includes('himbauan') ||
                    cat.includes('pulang') ||
                    cat.includes('libur') ||
                    cat.includes('imunisasi') ||
                    cat.includes('skrining')
                  );
                }
                if (announcementFilter === 'guru') return a.authorRole === 'Guru';
                if (announcementFilter === 'admin') return a.authorRole !== 'Guru';
                return true;
              })
              .filter((a) => {
                // Search term
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
                    className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border transition-all duration-200 relative overflow-hidden ${
                      unread
                        ? 'border-indigo-300 dark:border-indigo-700/80 shadow-md ring-1 ring-indigo-200 dark:ring-indigo-900/50'
                        : 'border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md'
                    }`}
                  >
                    {/* Left Accent indicator for unread or urgent */}
                    {isUrgent ? (
                      <div className="absolute top-0 left-0 bottom-0 w-2 bg-rose-500" />
                    ) : unread ? (
                      <div className="absolute top-0 left-0 bottom-0 w-2 bg-indigo-600" />
                    ) : null}

                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div
                          className={`p-3 rounded-2xl shrink-0 ${
                            isUrgent
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                              : isFromGuru
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          <Megaphone className="w-6 h-6" />
                        </div>

                        <div className="flex-1">
                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {/* Author */}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isFromGuru
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                              }`}
                            >
                              {isFromGuru ? `Guru ${item.authorClass || ''}` : 'Admin Sekolah'}
                            </span>

                            {/* Priority */}
                            {isUrgent && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                Penting
                              </span>
                            )}

                            {/* Target Class */}
                            {item.targetClass && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {item.targetClass}
                              </span>
                            )}

                            {/* Category */}
                            {item.category && (() => {
                              const badgeStyle = getCategoryBadgeStyle(item.category);
                              return (
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${badgeStyle.bg}`}>
                                  <span>{badgeStyle.icon}</span>
                                  <span>{item.category}</span>
                                </span>
                              );
                            })()}

                            {/* Unread Pill */}
                            {unread && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-2xs">
                                BARU
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                            {item.title}
                          </h4>

                          {/* Timestamp */}
                          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 font-medium my-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {item.date?.toDate
                                ? format(item.date.toDate(), 'EEEE, dd MMMM yyyy - HH:mm', {
                                    locale: id
                                  }) + ' WIB'
                                : 'Baru saja'}
                            </span>
                          </div>

                          {/* Content Snippet */}
                          <div className="text-sm text-slate-700 dark:text-slate-200 bg-slate-50/80 dark:bg-slate-800/60 p-4 rounded-2xl leading-relaxed whitespace-pre-wrap border border-slate-100 dark:border-slate-800/80 mt-2">
                            {item.content}
                          </div>
                        </div>
                      </div>

                      {/* Right action buttons */}
                      <div className="flex sm:flex-col items-center gap-2 shrink-0 self-end sm:self-start w-full sm:w-auto justify-end pt-2 sm:pt-0">
                        <button
                          onClick={() => {
                            markAsRead(item.id);
                            setSelectedAnnouncementModal(item);
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <span>Rincian</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => markAsRead(item.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            unread
                              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
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

          {/* Announcement Detail Modal */}
          {selectedAnnouncementModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
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
                      ? format(selectedAnnouncementModal.date.toDate(), 'EEEE, dd MMMM yyyy - HH:mm', {
                          locale: id
                        }) + ' WIB'
                      : 'Baru saja'}
                  </span>
                  {selectedAnnouncementModal.category && (
                    <span>• {selectedAnnouncementModal.category}</span>
                  )}
                </div>

                <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-normal mb-6 bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {selectedAnnouncementModal.content}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setSelectedAnnouncementModal(null)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    Tutup Pengumuman
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Edit Profil */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Koreksi Data Siswa</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tempat Lahir</label>
                  <input
                    type="text"
                    value={formData.birthPlace}
                    onChange={(e) => setFormData({...formData, birthPlace: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat Lengkap</label>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
