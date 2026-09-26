import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarDays,
  Bell,
  FileCheck,
  ArrowRight,
  Users,
  CheckCircle2,
  Clock,
  Wallet,
  BookOpen,
  Award,
  Sparkles,
  ClipboardList,
  FolderKanban,
  Coins,
  ChevronRight,
  Megaphone,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import ScheduleWidget from '../../components/ScheduleWidget';
import CalendarWidget from '../../components/CalendarWidget';

export default function GuruDashboard() {
  const { userData } = useAuth();
  const assignedClass = userData?.assigned_class || 'Kelas 1';
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id });

  // Real-time metrics
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [attendanceStats, setAttendanceStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0, total: 0 });
  const [isAttendanceDoneToday, setIsAttendanceDoneToday] = useState(false);
  const [activeAssignmentsCount, setActiveAssignmentsCount] = useState<number>(0);
  const [kasBalance, setKasBalance] = useState<number>(0);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View switch for schedules & academic calendar
  const [scheduleView, setScheduleView] = useState<'jadwal' | 'kalender'>('jadwal');

  useEffect(() => {
    // 1. Total students in class
    const qStudents = query(collection(db, 'students'), where('classId', '==', assignedClass));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      setTotalStudents(snap.size);
    }, (err) => console.warn("Students listener error:", err));

    // 2. Attendance today in class
    const qAttendance = query(
      collection(db, 'attendance'),
      where('classId', '==', assignedClass),
      where('date', '==', todayStr)
    );
    const unsubAttendance = onSnapshot(qAttendance, (snap) => {
      const stats = { hadir: 0, izin: 0, sakit: 0, alpa: 0, total: snap.size };
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'Hadir') stats.hadir++;
        else if (data.status === 'Izin') stats.izin++;
        else if (data.status === 'Sakit') stats.sakit++;
        else if (data.status === 'Alpa') stats.alpa++;
      });
      setAttendanceStats(stats);
      setIsAttendanceDoneToday(snap.size > 0);
    }, (err) => console.warn("Attendance listener error:", err));

    // 3. Active assignments count
    const qAssignments = query(
      collection(db, 'tugas'),
      where('classId', '==', assignedClass),
      where('status', '==', 'active')
    );
    const unsubAssignments = onSnapshot(qAssignments, (snap) => {
      setActiveAssignmentsCount(snap.size);
    }, (err) => console.warn("Assignments listener error:", err));

    // 4. Kas Kelas balance
    const qKas = query(collection(db, 'kas'), where('classId', '==', assignedClass));
    const unsubKas = onSnapshot(qKas, (snap) => {
      let balance = 0;
      snap.forEach((doc) => {
        const d = doc.data();
        const amt = Number(d.amount) || 0;
        if (d.type === 'masuk') balance += amt;
        else if (d.type === 'keluar') balance -= amt;
      });
      setKasBalance(balance);
    }, (err) => console.warn("Kas listener error:", err));

    // 5. Announcements (ordered by date)
    const qAnnouncements = query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(5));
    const unsubAnnouncements = onSnapshot(qAnnouncements, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAnnouncements(list);
      setLoading(false);
    }, (err) => {
      console.warn("Announcements listener error:", err);
      setLoading(false);
    });

    return () => {
      unsubStudents();
      unsubAttendance();
      unsubAssignments();
      unsubKas();
      unsubAnnouncements();
    };
  }, [assignedClass, todayStr]);

  const quickActions = [
    {
      title: 'Presensi Harian',
      desc: isAttendanceDoneToday ? `${attendanceStats.hadir} Hadir Hari Ini` : 'Belum diabsen hari ini',
      href: '/guru/attendance',
      icon: ClipboardList,
      color: 'bg-emerald-500',
      badge: isAttendanceDoneToday ? 'Sudah Diisi' : 'Perlu Diisi',
      badgeColor: isAttendanceDoneToday ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
    },
    {
      title: 'Input Nilai Siswa',
      desc: 'Tugas harian, PTS & PAS',
      href: '/guru/grades',
      icon: Award,
      color: 'bg-indigo-600',
      badge: 'Rapor',
      badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
    },
    {
      title: 'Tugas & Soal Online',
      desc: `${activeAssignmentsCount} tugas online aktif`,
      href: '/guru/assignments',
      icon: FileCheck,
      color: 'bg-purple-600',
      badge: 'Interaktif',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
    },
    {
      title: 'Keuangan & Kas',
      desc: `Kas: Rp ${kasBalance.toLocaleString('id-ID')}`,
      href: '/guru/finance',
      icon: Wallet,
      color: 'bg-teal-600',
      badge: 'Tabungan',
      badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
    },
    {
      title: 'RPP & Modul Ajar',
      desc: 'Perangkat ajar kurikulum',
      href: '/guru/lesson-plans',
      icon: FolderKanban,
      color: 'bg-blue-600',
      badge: 'Dokumen',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header Banner: Simple, Elegant & Informative */}
      <div className="bg-gradient-to-r from-indigo-800 via-indigo-700 to-purple-800 rounded-3xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-white/15 backdrop-blur-md text-indigo-100 border border-white/20">
                Wali Kelas: {assignedClass}
              </span>
              {isAttendanceDoneToday ? (
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Presensi Hari Ini Lengkap</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>Menunggu Presensi Hari Ini</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1.5">
              Selamat Mengajar, {userData?.name || 'Bapak/Ibu Guru'}!
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm max-w-2xl">
              Dasbor kendali harian kelas {assignedClass}. Input presensi, pantau pengumpulan tugas siswa, dan input nilai santri secara terpusat.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-xs font-semibold text-indigo-100">
              <CalendarDays className="w-4 h-4 text-indigo-200" />
              <span>{todayDisplay}</span>
            </div>
            <Link
              to="/guru/attendance"
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Buka Absensi</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. 4 Key Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Siswa */}
        <Link
          to="/guru/attendance"
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
              <span>{assignedClass}</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Santri Binaan</p>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {totalStudents} Siswa
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Terdaftar di kelas {assignedClass}
          </p>
        </Link>

        {/* Presensi Hari Ini */}
        <Link
          to="/guru/attendance"
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isAttendanceDoneToday ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {isAttendanceDoneToday ? 'Tersimpan' : 'Pending'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Presensi Hari Ini</p>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {attendanceStats.hadir} Hadir
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {attendanceStats.izin} Izin • {attendanceStats.sakit} Sakit • {attendanceStats.alpa} Alpa
          </p>
        </Link>

        {/* Tugas Aktif */}
        <Link
          to="/guru/assignments"
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <FileCheck className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
              <span>Buka</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tugas & Soal Online</p>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            {activeAssignmentsCount} Aktif
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Soal online & tugas terstruktur
          </p>
        </Link>

        {/* Saldo Kas */}
        <Link
          to="/guru/finance"
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-teal-300 dark:hover:border-teal-700 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 flex items-center gap-0.5">
              <span>Rincian</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kas Kelas {assignedClass}</p>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 truncate">
            Rp {kasBalance.toLocaleString('id-ID')}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Kelola kas & tabungan siswa
          </p>
        </Link>
      </div>

      {/* 3. Action Launcher: 5 Primary Teacher Workflows */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Akses Cepat Pengelolaan Kelas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pilih menu untuk input data yang langsung terintegrasi ke dasbor wali murid</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {quickActions.map((act) => {
            const Icon = act.icon;
            return (
              <Link
                key={act.title}
                to={act.href}
                className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 transition-all flex flex-col justify-between group active:scale-98"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl text-white ${act.color} shadow-xs group-hover:scale-105 transition-transform`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${act.badgeColor}`}>
                      {act.badge}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {act.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {act.desc}
                  </p>
                </div>
                <div className="pt-3 mt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  <span>Masuk Menu</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 4. Main 2-Column Section: Schedule/Calendar + School Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Schedule & Calendar with toggle */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Agenda Pengajaran & Kalender ({assignedClass})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pantau jadwal harian dan agenda kegiatan resmi sekolah</p>
                </div>
              </div>

              {/* Segmented View Switch */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setScheduleView('jadwal')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    scheduleView === 'jadwal'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Jadwal Mapel
                </button>
                <button
                  onClick={() => setScheduleView('kalender')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    scheduleView === 'kalender'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Kalender Pendidikan
                </button>
              </div>
            </div>

            {scheduleView === 'jadwal' ? (
              <ScheduleWidget classId={assignedClass} title="" />
            ) : (
              <CalendarWidget targetRole="guru" classFilter={assignedClass} />
            )}
          </div>
        </div>

        {/* Right Column: School Announcements */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pengumuman Sekolah</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Informasi resmi dari Admin</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {announcements.length} Berita
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-3 space-y-2">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Memuat pengumuman...</div>
              ) : announcements.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">Belum ada pengumuman terbaru.</div>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="pt-3 first:pt-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                        {ann.category || 'Umum'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {ann.date?.toDate ? format(ann.date.toDate(), 'dd MMM yyyy', { locale: id }) : 'Baru saja'}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 hover:text-indigo-600 transition-colors">
                      {ann.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/guru/assignments"
              className="w-full py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <span>Lihat Detail Tugas & Soal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
