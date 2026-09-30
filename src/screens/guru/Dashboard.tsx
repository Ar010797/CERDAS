import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  CalendarDays, 
  Bell, 
  FileCheck, 
  ArrowRight, 
  Users, 
  ClipboardList, 
  BookOpen, 
  Wallet, 
  CheckCircle2, 
  Sparkles,
  Clock,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import ScheduleWidget from '../../components/ScheduleWidget';
import CalendarWidget from '../../components/CalendarWidget';

export default function GuruDashboard() {
  const { userData } = useAuth();
  const assignedClass = userData?.assigned_class || 'Kelas 1 A';
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id });

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [attendanceBreakdown, setAttendanceBreakdown] = useState<{
    hadir: number;
    izin: number;
    sakit: number;
    alpa: number;
    total: number;
  }>({ hadir: 0, izin: 0, sakit: 0, alpa: 0, total: 0 });
  const [activeAssignmentsCount, setActiveAssignmentsCount] = useState<number>(0);
  const [pendingGradingCount, setPendingGradingCount] = useState<number>(0);
  const [kasBalance, setKasBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Siswa di kelas yang diampu
    const qStudents = query(collection(db, 'students'), where('classId', '==', assignedClass));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      setStudentCount(snap.size);
    }, (err) => console.warn('unsubStudents error:', err));

    // 2. Absensi hari ini
    const qAtt = query(
      collection(db, 'attendance'),
      where('classId', '==', assignedClass),
      where('date', '==', todayStr)
    );
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      let hadir = 0;
      let izin = 0;
      let sakit = 0;
      let alpa = 0;
      snap.forEach(d => {
        const st = d.data().status;
        if (st === 'Hadir') hadir++;
        else if (st === 'Izin') izin++;
        else if (st === 'Sakit') sakit++;
        else if (st === 'Alpa') alpa++;
      });
      setAttendanceBreakdown({ hadir, izin, sakit, alpa, total: snap.size });
    }, (err) => console.warn('unsubAtt error:', err));

    // 3. Tugas Aktif
    const qAssign = query(
      collection(db, 'tugas'),
      where('classId', '==', assignedClass),
      where('status', '==', 'active')
    );
    const unsubAssign = onSnapshot(qAssign, (snap) => {
      setActiveAssignmentsCount(snap.size);
    }, (err) => console.warn('unsubAssign error:', err));

    // 4. Submisi Tugas yang Belum Dinilai (Pending Grading)
    const qSubmissions = query(
      collection(db, 'pengumpulan_tugas'),
      where('classId', '==', assignedClass),
      where('status', '==', 'submitted')
    );
    const unsubSubmissions = onSnapshot(qSubmissions, (snap) => {
      setPendingGradingCount(snap.size);
    }, (err) => console.warn('unsubSubmissions error:', err));

    // 5. Kas Kelas
    const qKas = query(
      collection(db, 'kas'),
      where('classId', '==', assignedClass)
    );
    const unsubKas = onSnapshot(qKas, (snap) => {
      let balance = 0;
      snap.forEach(d => {
        const item = d.data();
        if (item.type === 'masuk') balance += Number(item.amount) || 0;
        else if (item.type === 'keluar') balance -= Number(item.amount) || 0;
      });
      setKasBalance(balance);
    }, (err) => console.warn('unsubKas error:', err));

    // 6. Pengumuman Terbaru
    const qAnnounce = query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(3));
    const unsubAnnounce = onSnapshot(qAnnounce, (snap) => {
      setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.warn('unsubAnnounce error:', err);
      setLoading(false);
    });

    return () => {
      unsubStudents();
      unsubAtt();
      unsubAssign();
      unsubSubmissions();
      unsubKas();
      unsubAnnounce();
    };
  }, [assignedClass, todayStr]);

  const hasAttendanceToday = attendanceBreakdown.total > 0;
  const attendanceRate = studentCount > 0 
    ? Math.round((attendanceBreakdown.hadir / studentCount) * 100) 
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header Ringkas, Elegan, & Fokus Informasi Utama */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Wali Kelas • {assignedClass}</span>
              <span className="text-indigo-200">|</span>
              <span className="text-indigo-200">{userData?.academicYear || 'T.A 2026/2027'}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Selamat Bertugas, {userData?.name || 'Ustadz / Ustadzah'}
            </h1>

            <p className="text-xs sm:text-sm text-indigo-200 font-medium">
              Kelola aktivitas belajar, pantau kehadiran santri, dan tinjau kemajuan kelas Anda secara efektif.
            </p>
          </div>

          {/* Quick Date & Attendance Status CTA */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-indigo-300 shrink-0" />
              <div>
                <p className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Hari Ini</p>
                <p className="text-xs font-bold text-white">{todayDisplay}</p>
              </div>
            </div>

            <Link
              to="/guru/attendance"
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 ${
                hasAttendanceToday
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>{hasAttendanceToday ? '✅ Presensi Terisi' : '⚠️ Input Absensi Hari Ini'}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. 4 Kartu Metrik Utama Operasional (Bukan Duplikasi Menu) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metrik 1: Kehadiran Siswa Hari Ini */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Kehadiran Santri</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <ClipboardList className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {attendanceBreakdown.hadir}
              </span>
              <span className="text-xs text-slate-400">
                / {studentCount} Santri
              </span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, attendanceRate)}%` }} 
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {hasAttendanceToday 
              ? `${attendanceBreakdown.izin} Izin, ${attendanceBreakdown.sakit} Sakit, ${attendanceBreakdown.alpa} Alpa`
              : 'Belum ada absensi tersimpan'}
          </p>
        </div>

        {/* Metrik 2: Tugas Menunggu Penilaian Guru */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Perlu Dinilai</span>
              <div className={`p-2 rounded-xl ${
                pendingGradingCount > 0
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
              }`}>
                <FileCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black ${pendingGradingCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                {pendingGradingCount}
              </span>
              <span className="text-xs text-slate-400">Submisi Masuk</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {pendingGradingCount > 0 ? (
              <Link 
                to="/guru/assignments" 
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1"
              >
                <span>Beri Nilai Sekarang</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            ) : (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Semua tugas terkirim telah dinilai
              </span>
            )}
          </div>
        </div>

        {/* Metrik 3: Tugas Aktif Berjalan */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tugas Aktif</span>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {activeAssignmentsCount}
              </span>
              <span className="text-xs text-slate-400">Tugas & Kuis</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            Nilai tugas otomatis masuk ke rapor
          </p>
        </div>

        {/* Metrik 4: Saldo Kas Kelas */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Saldo Kas Kelas</span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Wallet className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold text-slate-400">Rp</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                {kasBalance.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            Kas perbendaharaan {assignedClass}
          </p>
        </div>
      </div>

      {/* 3. Action Alert Banner jika ada Tugas Siswa yang belum dinilai */}
      {pendingGradingCount > 0 && (
        <div className="bg-gradient-to-r from-rose-500 via-red-500 to-amber-600 text-white rounded-3xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black">
                {pendingGradingCount} Tugas Siswa Baru Masuk Menunggu Penilaian
              </h4>
              <p className="text-xs text-white/90 font-medium">
                Santri telah mengumpulkan tugas. Berikan nilai dan feedback agar skor otomatis tersinkronisasi ke buku rapor siswa.
              </p>
            </div>
          </div>

          <Link
            to="/guru/assignments"
            className="px-4 py-2 bg-white text-slate-900 hover:bg-yellow-200 rounded-xl font-bold text-xs transition-all shadow-sm shrink-0 flex items-center gap-1.5"
          >
            <span>Buka Lembar Penilaian</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 4. Tampilan Utama: Jadwal Pelajaran & Kalender Kegiatan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Jadwal Mengajar & Kalender Kelas */}
        <div className="lg:col-span-2 space-y-6">
          <ScheduleWidget classId={assignedClass} title={`Jadwal Pelajaran & Mengajar (${assignedClass})`} />
          <CalendarWidget targetRole="guru" classFilter={assignedClass} />
        </div>

        {/* Kolom Kanan: Pengumuman Terkini */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xs border border-slate-200/80 dark:border-slate-800 flex flex-col h-fit">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Bell className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                Pengumuman Sekolah
              </h3>
            </div>
            <Link
              to="/guru/announcements"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Semua</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Belum ada pengumuman terbaru saat ini.
              </p>
            ) : (
              announcements.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      {item.category || 'Informasi'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.date}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {item.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
