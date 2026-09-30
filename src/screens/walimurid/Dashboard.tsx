import React, { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, updateDoc, collection, query, where } from 'firebase/firestore';
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
  Wallet,
  Coins,
  GraduationCap,
  Award,
  Sparkles,
  Phone,
  MapPin,
  Calendar as CalendarIcon,
  TrendingUp,
  Receipt,
  AlertCircle
} from 'lucide-react';
import ScheduleWidget from '../../components/ScheduleWidget';
import CalendarWidget from '../../components/CalendarWidget';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatTugasDisplay } from '../../lib/gradeSync';
import { triggerFloatingNotification } from '../../components/FloatingNotificationCenter';
import RaporPreviewModal from '../../components/RaporPreviewModal';

export default function WaliMuridDashboard() {
  const { userData } = useAuth();
  const [isRaporPreviewOpen, setIsRaporPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'rapor' | 'keuangan' | 'jadwal'>('rapor');
  
  // Real-time data
  const [studentData, setStudentData] = useState<any>(null);
  const [grades, setGrades] = useState<Record<string, { tugas: any, ulanganHarian?: any, pts: string, pas: string }>>({});
  const [attendance, setAttendance] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 });
  const [todayAttendance, setTodayAttendance] = useState<any | null>(null);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id });
  const [subjects, setSubjects] = useState<string[]>([]);
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

  // Tabungan & Kas
  const [savingTransactions, setSavingTransactions] = useState<any[]>([]);
  const [kasBalance, setKasBalance] = useState<number>(0);

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', gender: 'L', address: '', birthDate: '', birthPlace: '', parentPhone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userData?.uid) return;

    // 1. Profil Siswa
    const unsubStudent = onSnapshot(doc(db, 'students', userData.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStudentData({ id: docSnap.id, ...data });
        setFormData({
          name: data.name || '',
          gender: data.gender || 'L',
          address: data.address || '',
          birthDate: data.birthDate || '',
          birthPlace: data.birthPlace || '',
          parentPhone: data.parentPhone || ''
        });
      } else {
        // Fallback jika login menggunakan akun santri
        setStudentData({
          id: userData.uid,
          name: userData.username,
          classId: userData.assigned_class || 'Kelas 1',
          nisn: userData.nisn || '-',
          absen_number: userData.absen_number || '-'
        });
      }
    }, (err) => console.warn("unsubStudent error:", err));

    // 2. Nilai Siswa
    const unsubGrades = onSnapshot(doc(db, 'grades', userData.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGrades(data.gradesBySubject || {});
      }
    }, (err) => console.warn("unsubGrades error:", err));

    // 3. Presensi
    const qAtt = query(collection(db, 'attendance'), where('studentId', '==', userData.uid));
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      const attCount = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
      let todayRecord: any = null;

      snap.forEach(d => {
        const item = { id: d.id, ...d.data() } as any;
        const status = item.status;
        if (status === 'Hadir') attCount.hadir++;
        else if (status === 'Izin') attCount.izin++;
        else if (status === 'Sakit') attCount.sakit++;
        else if (status === 'Alpa') attCount.alpa++;

        if (item.date === todayStr) {
          todayRecord = item;
        }
      });

      setAttendance(attCount);
      setTodayAttendance(todayRecord);

      if (todayRecord) {
        const notifyKey = `att_notif_${todayStr}_${userData.uid}_${todayRecord.status}`;
        if (!sessionStorage.getItem(notifyKey)) {
          sessionStorage.setItem(notifyKey, 'true');
          const isHadir = todayRecord.status === 'Hadir';
          triggerFloatingNotification({
            title: isHadir ? '✅ Ananda Telah Masuk Sekolah' : `Presensi Hari Ini: ${todayRecord.status}`,
            body: isHadir 
              ? `Alhamdulillah, ananda telah masuk sekolah dan tercatat HADIR hari ini oleh Wali Kelas (${todayRecord.recordedBy || 'Wali Kelas'}).`
              : `Catatan presensi hari ini: ananda berstatus "${todayRecord.status}" (${todayRecord.recordedBy || 'Wali Kelas'}).`,
            type: 'general',
            durationMs: 8000
          });
        }
      }
    }, (err) => console.warn("unsubAtt error:", err));

    // 4. Pengaturan Sekolah
    const unsubSchool = onSnapshot(doc(db, 'pengaturan_sekolah', 'utama'), (docSnap) => {
      if (docSnap.exists()) setSchoolSettings(docSnap.data() as any);
      setLoading(false);
    }, (err) => {
      console.warn("unsubSchool error:", err);
      setLoading(false);
    });

    return () => {
      unsubStudent();
      unsubGrades();
      unsubAtt();
      unsubSchool();
    };
  }, [userData, todayStr]);

  // Mata Pelajaran, Tabungan Santri, & Kas Kelas
  useEffect(() => {
    const classId = studentData?.classId || userData?.assigned_class;
    const currentStudentId = studentData?.id || userData?.uid;
    const currentStudentName = (studentData?.name || userData?.username || '').trim();
    if (!classId && !currentStudentId && !currentStudentName) return;

    // 1. Subjects
    let unsubSubjects = () => {};
    if (classId) {
      unsubSubjects = onSnapshot(doc(db, 'mata_pelajaran', classId), (docSnap) => {
        if (docSnap.exists()) {
          setSubjects(docSnap.data().subjects || []);
        } else {
          setSubjects(['Matematika', 'Bahasa Indonesia', 'IPA', 'IPS', 'Pendidikan Agama Islam', 'Bahasa Inggris']);
        }
      });
    }

    // 2. Tabungan Santri (Sinkronisasi Ganda: Berdasarkan studentId & studentName)
    const savingsMap = new Map<string, any>();

    const updateTransactions = () => {
      const allTrx = Array.from(savingsMap.values());
      allTrx.sort((a, b) => {
        const timeA = a.createdAt || (a.date?.toDate ? a.date.toDate().getTime() : (a.date?.seconds ? a.date.seconds * 1000 : new Date(a.date || 0).getTime()));
        const timeB = b.createdAt || (b.date?.toDate ? b.date.toDate().getTime() : (b.date?.seconds ? b.date.seconds * 1000 : new Date(b.date || 0).getTime()));
        return timeB - timeA;
      });
      setSavingTransactions(allTrx);
    };

    let unsubSavingsId = () => {};
    if (currentStudentId) {
      const qSavings = query(
        collection(db, 'savings'),
        where('studentId', '==', currentStudentId)
      );
      unsubSavingsId = onSnapshot(qSavings, (snap) => {
        snap.docs.forEach(d => savingsMap.set(d.id, { id: d.id, ...d.data() }));
        updateTransactions();
      }, (err) => console.warn("Savings by ID snapshot notice:", err));
    }

    let unsubSavingsName = () => {};
    if (currentStudentName) {
      const qName = query(
        collection(db, 'savings'),
        where('studentName', '==', currentStudentName)
      );
      unsubSavingsName = onSnapshot(qName, (snap) => {
        snap.docs.forEach(d => savingsMap.set(d.id, { id: d.id, ...d.data() }));
        updateTransactions();
      }, (err) => console.warn("Savings by Name snapshot notice:", err));
    }

    // 3. Kas Kelas
    let unsubKas = () => {};
    if (classId) {
      const qKas = query(
        collection(db, 'kas'),
        where('classId', '==', classId)
      );
      unsubKas = onSnapshot(qKas, (snap) => {
        let bal = 0;
        snap.forEach(d => {
          const item = d.data();
          if (item.type === 'masuk') bal += Number(item.amount) || 0;
          else if (item.type === 'keluar') bal -= Number(item.amount) || 0;
        });
        setKasBalance(bal);
      }, (err) => console.warn("Kas snapshot notice:", err));
    }

    return () => {
      unsubSubjects();
      unsubSavingsId();
      unsubSavingsName();
      unsubKas();
    };
  }, [studentData?.id, studentData?.name, studentData?.classId, userData?.uid, userData?.username, userData?.assigned_class]);


  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.uid) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'students', userData.uid), {
        name: formData.name.trim(),
        gender: formData.gender,
        address: formData.address.trim(),
        birthDate: formData.birthDate,
        birthPlace: formData.birthPlace.trim(),
        parentPhone: formData.parentPhone.trim()
      });
      setIsModalOpen(false);
      alert('Data biodata ananda berhasil diperbarui!');
    } catch (err: any) {
      console.error(err);
      alert('Gagal memperbarui profil: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const getSubjectKKM = (subj: string): number => {
    if (schoolSettings?.kkmMap?.[subj] !== undefined && Number(schoolSettings.kkmMap[subj]) > 0) {
      return Number(schoolSettings.kkmMap[subj]);
    }
    return Number(schoolSettings?.kkmGlobal) || 75;
  };

  const tabunganBalance = useMemo(() => {
    return savingTransactions.reduce((acc, curr) => {
      return curr.type === 'setor' ? acc + (Number(curr.amount) || 0) : acc - (Number(curr.amount) || 0);
    }, 0);
  }, [savingTransactions]);

  const totalPresensi = attendance.hadir + attendance.izin + attendance.sakit + attendance.alpa;
  const persentaseHadir = totalPresensi > 0 ? Math.round((attendance.hadir / totalPresensi) * 100) : 100;

  // Rata-rata nilai keseluruhan
  const academicSummary = useMemo(() => {
    if (subjects.length === 0) return { avg: '-', tuntasCount: 0, total: 0 };
    const averages: number[] = [];
    let tuntas = 0;

    subjects.forEach((subj) => {
      const g = grades[subj] || { tugas: '-', ulanganHarian: [], pts: '-', pas: '-' };
      const subjKkm = getSubjectKKM(subj);
      const comps: number[] = [];

      if (Array.isArray(g.tugas)) {
        const valid = g.tugas.map((t: any) => parseFloat(t)).filter((t: number) => !isNaN(t));
        if (valid.length > 0) comps.push(valid.reduce((a: number, b: number) => a + b, 0) / valid.length);
      } else if (g.tugas && !isNaN(parseFloat(String(g.tugas)))) {
        comps.push(parseFloat(String(g.tugas)));
      }

      if (Array.isArray(g.ulanganHarian)) {
        const valid = g.ulanganHarian.map((t: any) => parseFloat(t)).filter((t: number) => !isNaN(t));
        if (valid.length > 0) comps.push(valid.reduce((a: number, b: number) => a + b, 0) / valid.length);
      }
      if (g.pts && !isNaN(parseFloat(String(g.pts)))) comps.push(parseFloat(String(g.pts)));
      if (g.pas && !isNaN(parseFloat(String(g.pas)))) comps.push(parseFloat(String(g.pas)));

      if (comps.length > 0) {
        const itemAvg = comps.reduce((a, b) => a + b, 0) / comps.length;
        averages.push(itemAvg);
        if (itemAvg >= subjKkm) tuntas++;
      }
    });

    if (averages.length === 0) return { avg: '-', tuntasCount: 0, total: subjects.length };
    const globalAvg = (averages.reduce((a, b) => a + b, 0) / averages.length).toFixed(1);
    return { avg: globalAvg, tuntasCount: tuntas, total: subjects.length };
  }, [subjects, grades, schoolSettings]);

  const formatTrxDate = (val: any, createdAt?: number) => {
    if (!val && !createdAt) return 'Baru saja';
    try {
      if (createdAt && typeof createdAt === 'number') {
        return format(new Date(createdAt), 'dd MMM yyyy, HH:mm', { locale: id });
      }
      const d = val?.toDate ? val.toDate() : (val?.seconds ? new Date(val.seconds * 1000) : new Date(val));
      if (isNaN(d.getTime())) return 'Baru saja';
      return format(d, 'dd MMM yyyy, HH:mm', { locale: id });
    } catch {
      return 'Baru saja';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Memuat dasbor wali murid...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-14">
      {/* 1. Header Profil Siswa & Identitas Utama */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5">
            <div className="w-20 h-20 sm:w-22 sm:h-22 bg-white/15 rounded-3xl flex items-center justify-center backdrop-blur-md border border-white/20 shrink-0 shadow-inner">
              <UserCircle className="w-14 h-14 sm:w-16 sm:h-16 text-indigo-100" />
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 px-3 py-0.5 rounded-full text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Santri Aktif • {studentData?.classId || 'Kelas 1'}</span>
                </span>

                {todayAttendance?.status === 'Hadir' ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    ✅ Masuk & Hadir Hari Ini
                  </span>
                ) : todayAttendance ? (
                  <span className="inline-flex items-center gap-1 bg-amber-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                    Presensi: {todayAttendance.status}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-white/20 text-indigo-100 px-2.5 py-0.5 rounded-full text-[10px] font-medium">
                    Menunggu Absensi Harian
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {studentData?.name || userData?.username}
              </h1>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs sm:text-sm text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-300" />
                  <span>NISN: <b>{studentData?.nisn || '-'}</b></span>
                </span>
                <span className="text-indigo-400">•</span>
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-indigo-300" />
                  <span>No. Absen: <b>{studentData?.absen_number || '-'}</b></span>
                </span>
                <span className="text-indigo-400">•</span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-indigo-300" />
                  <span>{schoolSettings.tahunAjaran || 'T.A 2026/2027'}</span>
                </span>
              </div>

              {(studentData?.address || studentData?.parentPhone) && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-0.5 text-xs text-indigo-200/90 font-medium">
                  {studentData?.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-300" />
                      <span>{studentData.address}</span>
                    </span>
                  )}
                  {studentData?.parentPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{studentData.parentPhone}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Header */}
          <div className="flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl border border-white/20 transition-all font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Koreksi Profil</span>
            </button>

            <button
              onClick={() => setIsRaporPreviewOpen(true)}
              className="bg-white hover:bg-yellow-200 text-slate-900 px-4 py-2 rounded-xl transition-all font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-700" />
              <span>Cetak Rapor</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4 Kartu Metrik Ringkas & Interaktif */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metrik 1: Kehadiran Siswa */}
        <div 
          className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Kehadiran Santri</span>
              <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {persentaseHadir}%
              </span>
              <span className="text-xs text-slate-400">({attendance.hadir} Hari)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {attendance.izin} Izin • {attendance.sakit} Sakit • {attendance.alpa} Alpa
          </p>
        </div>

        {/* Metrik 2: Tabungan Santri (Live dari Guru) */}
        <div 
          onClick={() => setActiveTab('keuangan')}
          className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer active:scale-98 flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Tabungan Santri</span>
              <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 truncate">
              Rp {tabunganBalance.toLocaleString('id-ID')}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>Tersimpan di Wali Kelas</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[10px] group-hover:underline">Buka Mutasi →</span>
          </p>
        </div>

        {/* Metrik 3: Kas Kelas */}
        <div 
          onClick={() => setActiveTab('keuangan')}
          className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer active:scale-98 flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Kas Kelas</span>
              <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-700 dark:text-indigo-400 truncate">
              Rp {kasBalance.toLocaleString('id-ID')}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>Kas {studentData?.classId || 'Kelas'}</span>
            <span className="text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Detail →</span>
          </p>
        </div>

        {/* Metrik 4: Rata-Rata Rapor */}
        <div 
          onClick={() => setActiveTab('rapor')}
          className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer active:scale-98 flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Rata-Rata Nilai</span>
              <div className="p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {academicSummary.avg}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {academicSummary.tuntasCount} Mapel Tuntas
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>Standar KKM: {schoolSettings?.kkmGlobal || 75}</span>
            <span className="text-[10px] text-purple-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Buka Rapor →</span>
          </p>
        </div>
      </div>



      {/* 3. Pesan Khusus dari Wali Kelas (Jika Ada) */}
      {studentData?.catatanWaliKelas && (
        <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-3xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
          <div className="p-2 bg-amber-500 text-white rounded-2xl shrink-0 shadow-xs">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
              <h4 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-300">
                Catatan Wali Kelas ({studentData?.classId})
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

      {/* 4. Tab Navigasi Bersih & Simpel (Tidak Berulang) */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('rapor')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'rapor'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Nilai & Rapor Hasil Belajar</span>
        </button>

        <button
          onClick={() => setActiveTab('keuangan')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'keuangan'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Tabungan & Kas Santri</span>
          {savingTransactions.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {savingTransactions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('jadwal')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'jadwal'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>Jadwal & Kalender</span>
        </button>
      </div>

      {/* TAB 1: NILAI & RAPOR */}
      {activeTab === 'rapor' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-in fade-in">
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/20">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Daftar Nilai & Rapor Hasil Belajar Siswa
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nilai tugas otomatis masuk dari hasil pengerjaan kuis/tugas. Nilai UH, PTS, dan PAS diinput oleh guru mata pelajaran.
              </p>
            </div>

            <button
              onClick={() => setIsRaporPreviewOpen(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all font-bold text-xs shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Unduh Rapor PDF</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <th className="px-5 py-3.5 text-center w-12">No</th>
                  <th className="px-5 py-3.5 min-w-[180px]">Mata Pelajaran</th>
                  <th className="px-4 py-3.5 text-center w-20">KKM</th>
                  <th className="px-4 py-3.5 text-center bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 min-w-[150px]">
                    Nilai Tugas
                  </th>
                  <th className="px-4 py-3.5 text-center min-w-[100px]">Ulangan Harian</th>
                  <th className="px-4 py-3.5 text-center w-24">PTS</th>
                  <th className="px-4 py-3.5 text-center w-24">PAS</th>
                  <th className="px-4 py-3.5 text-center w-28 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
                    Nilai Akhir
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {subjects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-xs text-slate-500">
                      Belum ada mata pelajaran untuk kelas {studentData?.classId || ''}.
                    </td>
                  </tr>
                ) : (
                  subjects.map((subj, idx) => {
                    const g = grades[subj] || { tugas: '-', ulanganHarian: [], pts: '-', pas: '-' };
                    const subjKkm = getSubjectKKM(subj);
                    const displayTugas = formatTugasDisplay(g.tugas);

                    // Hitung UH
                    let displayUH = '-';
                    let uhAvg: number | null = null;
                    if (Array.isArray(g.ulanganHarian)) {
                      const validUH = g.ulanganHarian.map((t: any) => parseFloat(t)).filter((t: number) => !isNaN(t));
                      if (validUH.length > 0) {
                        uhAvg = validUH.reduce((a: number, b: number) => a + b, 0) / validUH.length;
                        displayUH = uhAvg.toFixed(1);
                      }
                    } else if (g.ulanganHarian) {
                      displayUH = String(g.ulanganHarian);
                    }

                    // Hitung rata-rata akhir
                    const comps: number[] = [];
                    if (Array.isArray(g.tugas)) {
                      const valid = g.tugas.map((t: any) => parseFloat(t)).filter((t: number) => !isNaN(t));
                      if (valid.length > 0) comps.push(valid.reduce((a: number, b: number) => a + b, 0) / valid.length);
                    } else if (g.tugas && !isNaN(parseFloat(String(g.tugas)))) {
                      comps.push(parseFloat(String(g.tugas)));
                    }
                    if (uhAvg !== null) comps.push(uhAvg);
                    if (g.pts && !isNaN(parseFloat(String(g.pts)))) comps.push(parseFloat(String(g.pts)));
                    if (g.pas && !isNaN(parseFloat(String(g.pas)))) comps.push(parseFloat(String(g.pas)));

                    let finalAvg = '-';
                    let isTuntas = false;
                    if (comps.length > 0) {
                      const avgNum = Math.round((comps.reduce((a, b) => a + b, 0) / comps.length) * 10) / 10;
                      finalAvg = avgNum.toString();
                      isTuntas = avgNum >= subjKkm;
                    }

                    return (
                      <tr key={subj} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 text-xs font-semibold text-center text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-3.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                          {subj}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-bold text-center text-slate-500 dark:text-slate-400">
                          {subjKkm}
                        </td>
                        <td className="px-4 py-3.5 text-xs sm:text-sm text-center font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20">
                          {displayTugas !== '-' ? (
                            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 rounded-md inline-block">
                              {displayTugas}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs sm:text-sm text-center font-medium text-slate-700 dark:text-slate-300">
                          {displayUH}
                        </td>
                        <td className="px-4 py-3.5 text-xs sm:text-sm text-center font-medium text-slate-700 dark:text-slate-300">
                          {g.pts || '-'}
                        </td>
                        <td className="px-4 py-3.5 text-xs sm:text-sm text-center font-medium text-slate-700 dark:text-slate-300">
                          {g.pas || '-'}
                        </td>
                        <td className="px-4 py-3.5 text-xs sm:text-sm text-center font-black bg-emerald-50/40 dark:bg-emerald-950/20">
                          {finalAvg !== '-' ? (
                            <span className={`px-2 py-0.5 rounded-md ${isTuntas ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                              {finalAvg} {isTuntas ? '✓' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TABUNGAN SANTRI & KAS KELAS */}
      {activeTab === 'keuangan' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Card Saldo Utama */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Saldo Tabungan Pribadi */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                  Tabungan Simpanan Pribadi
                </span>
                <div className="p-2 rounded-2xl bg-white/20 backdrop-blur-md">
                  <Coins className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="text-3xl font-black mt-3">
                Rp {tabunganBalance.toLocaleString('id-ID')}
              </div>
              <p className="text-xs text-emerald-100 mt-1">
                Tersimpan aman & dikelola oleh Wali Kelas {studentData?.classId}
              </p>
            </div>

            {/* Saldo Kas Kelas */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-800 rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">
                  Kas Perbendaharaan Kelas ({studentData?.classId})
                </span>
                <div className="p-2 rounded-2xl bg-white/20 backdrop-blur-md">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="text-3xl font-black mt-3">
                Rp {kasBalance.toLocaleString('id-ID')}
              </div>
              <p className="text-xs text-indigo-100 mt-1">
                Dana bersama untuk kegiatan & sarana santri di kelas
              </p>
            </div>
          </div>

          {/* Riwayat Mutasi Tabungan Terperinci */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Riwayat Transaksi Tabungan Santri
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Catatan setoran dan penarikan yang diinput oleh Guru / Wali Kelas
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Total: {savingTransactions.length} Transaksi
              </span>
            </div>

            <div className="space-y-2.5">
              {savingTransactions.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Coins className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Belum ada riwayat transaksi tabungan untuk ananda.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Setoran tabungan yang dicatat oleh Wali Kelas akan langsung muncul di sini secara real-time.
                  </p>
                </div>
              ) : (
                savingTransactions.map((trx) => (
                  <div
                    key={trx.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs transition-all hover:bg-slate-100/60"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${
                        trx.type === 'setor'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                          {trx.type === 'setor' ? 'Setoran Tabungan' : 'Penarikan Tabungan'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatTrxDate(trx.date)} • {trx.note || 'Transaksi tabungan'}
                        </p>
                      </div>
                    </div>

                    <span className={`text-sm sm:text-base font-black ${
                      trx.type === 'setor' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {trx.type === 'setor' ? '+' : '-'} Rp {Number(trx.amount).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: JADWAL PELAJARAN & KALENDER AKADEMIK */}
      {activeTab === 'jadwal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
          <div className="space-y-4">
            <ScheduleWidget classId={studentData?.classId || 'Kelas 1'} title={`Jadwal Pelajaran (${studentData?.classId || 'Kelas 1'})`} />
          </div>
          <div className="space-y-4">
            <CalendarWidget targetRole="walimurid" classFilter={studentData?.classId || 'Kelas 1'} />
          </div>

        </div>
      )}

      {/* Modal Koreksi Profil Siswa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Koreksi Profil Siswa
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Perbarui identitas ananda agar data pada rapor dan absensi selalu akurat.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    No. HP Wali (WhatsApp)
                  </label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tempat Lahir
                  </label>
                  <input
                    type="text"
                    value={formData.birthPlace}
                    onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Alamat Lengkap Tempat Tinggal
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tinjau & Cetak Rapor Lengkap */}
      {isRaporPreviewOpen && (
        <RaporPreviewModal
          isOpen={isRaporPreviewOpen}
          onClose={() => setIsRaporPreviewOpen(false)}
          student={{
            id: studentData?.id || userData?.uid,
            name: studentData?.name || userData?.username || 'Santri',
            nisn: studentData?.nisn || '-',
            absen_number: studentData?.absen_number || '-',
            classId: studentData?.classId || 'Kelas 1'
          }}
          schoolSettings={schoolSettings}
          subjects={subjects}
          gradesData={grades}
          kkmMap={schoolSettings?.kkmMap || {}}
          academicYear={schoolSettings?.tahunAjaran || '2026/2027'}
          isAdmin={false}
        />
      )}
    </div>
  );
}
