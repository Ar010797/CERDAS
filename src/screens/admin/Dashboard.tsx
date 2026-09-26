import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Users,
  GraduationCap,
  Megaphone,
  CheckCircle2,
  Activity,
  Clock,
  CalendarDays,
  ShieldAlert,
  Trash2,
  ArrowRight,
  Filter,
  RefreshCw,
  Search,
  School,
  UserPlus,
  FileSpreadsheet,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import ScheduleWidget from '../../components/ScheduleWidget';
import CalendarWidget from '../../components/CalendarWidget';

interface LogAktivitas {
  id: string;
  guruName: string;
  className: string;
  activity: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTeachers: 0,
    totalStudents: 0,
    attendanceToday: 0,
    totalAnnouncements: 0
  });

  const [logs, setLogs] = useState<LogAktivitas[]>([]);
  const [loading, setLoading] = useState(true);
  const [classList, setClassList] = useState<string[]>(['Semua Kelas']);
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');
  const [activeTab, setActiveTab] = useState<'monitoring' | 'jadwal' | 'pemeliharaan'>('monitoring');

  // Reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [resetting, setResetting] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id });

  useEffect(() => {
    // 1. Users real-time listener
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      let teachersCount = 0;
      const classes = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        if (data.role === 'Guru') {
          teachersCount++;
          if (data.assigned_class) classes.add(data.assigned_class);
        }
      });
      setStats((prev) => ({
        ...prev,
        totalUsers: snap.size,
        totalTeachers: teachersCount
      }));
      setClassList(['Semua Kelas', ...Array.from(classes)]);
    }, (err) => console.warn("Users listener error:", err));

    // 2. Students real-time listener
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStats((prev) => ({ ...prev, totalStudents: snap.size }));
    }, (err) => console.warn("Students listener error:", err));

    // 3. Attendance today count
    const qAttToday = query(collection(db, 'attendance'), where('date', '==', todayStr));
    const unsubAttToday = onSnapshot(qAttToday, (snap) => {
      setStats((prev) => ({ ...prev, attendanceToday: snap.size }));
    }, (err) => console.warn("Attendance listener error:", err));

    // 4. Announcements count
    const unsubAnnouncements = onSnapshot(collection(db, 'announcements'), (snap) => {
      setStats((prev) => ({ ...prev, totalAnnouncements: snap.size }));
    }, (err) => console.warn("Announcements listener error:", err));

    // 5. Activity logs today
    const qLogs = query(
      collection(db, 'log_aktivitas'),
      where('timestamp', '>=', todayStr),
      where('timestamp', '<=', todayStr + 'T23:59:59')
    );

    const unsubLogs = onSnapshot(qLogs, (snap) => {
      let data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LogAktivitas));
      if (selectedClass !== 'Semua Kelas') {
        data = data.filter((item) => item.className === selectedClass);
      }
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(data);
      setLoading(false);
    }, (err) => {
      console.warn("Logs listener error:", err);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubStudents();
      unsubAttToday();
      unsubAnnouncements();
      unsubLogs();
    };
  }, [selectedClass, todayStr]);

  const executeGlobalReset = async () => {
    if (resetConfirmationText !== 'RESET-TOTAL') {
      showToast('Konfirmasi teks tidak cocok. Ketik RESET-TOTAL', 'error');
      return;
    }
    setResetting(true);
    try {
      const collectionsToClear = [
        'students', 'grades', 'attendance', 'log_aktivitas', 'mata_pelajaran',
        'lesson_plans', 'jadwal_kelas', 'kas', 'savings', 'question_folders',
        'questions', 'announcements', 'student_notifications', 'pengumpulan_tugas', 'tugas'
      ];

      for (const collName of collectionsToClear) {
        const snap = await getDocs(collection(db, collName));
        let batch = writeBatch(db);
        let count = 0;

        for (const d of snap.docs) {
          batch.delete(d.ref);
          count++;
          if (count === 490) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }

      showToast('Berhasil mereset seluruh data sekolah!', 'success');
      setIsResetModalOpen(false);
      setResetConfirmationText('');
    } catch (error: any) {
      console.error(error);
      showToast(`Gagal menghapus data: ${error.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setResetting(false);
    }
  };

  const statCards = [
    {
      title: 'Total Santri Aktif',
      value: stats.totalStudents,
      subtext: 'Terdaftar di Kelas 1-9',
      icon: GraduationCap,
      color: 'bg-emerald-500',
      link: '/admin/students'
    },
    {
      title: 'Dewan Guru & Staf',
      value: stats.totalTeachers,
      subtext: `${stats.totalUsers} total akun sistem`,
      icon: Users,
      color: 'bg-indigo-600',
      link: '/admin/users'
    },
    {
      title: 'Presensi Hari Ini',
      value: stats.attendanceToday,
      subtext: `Tercatat per ${format(new Date(), 'dd MMM')}`,
      icon: CheckCircle2,
      color: 'bg-blue-600',
      link: '/admin/students'
    },
    {
      title: 'Pengumuman Aktif',
      value: stats.totalAnnouncements,
      subtext: 'Pemberitahuan madrasah',
      icon: Megaphone,
      color: 'bg-purple-600',
      link: '/admin/announcements'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header Banner: Clean, Modern, Elegant */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-indigo-900/30">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2">
              <School className="w-3.5 h-3.5" />
              <span>Pusat Administrasi & Pengendalian Sistem</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1.5">
              Dashboard Administrator
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">
              Monitoring operasional sekolah, manajemen siswa, dewan guru, jadwal pelajaran, serta integrasi data wali murid secara real-time.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 text-xs font-semibold text-slate-200">
              <CalendarDays className="w-4 h-4 text-indigo-400" />
              <span>{todayDisplay}</span>
            </div>

            <Link
              to="/admin/announcements"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Megaphone className="w-4 h-4" />
              <span>Kirim Pengumuman</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. 4 Clean Key Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              to={c.link}
              className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2.5 rounded-xl text-white ${c.color} shadow-xs group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                  <span>Kelola</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{c.title}</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                {c.value}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                {c.subtext}
              </p>
            </Link>
          );
        })}
      </div>

      {/* 3. Quick Navigation Launcher: Admin Workflows */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Navigasi Pengelolaan Utama</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pintasan menu cepat untuk tugas administratif harian</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/admin/students"
            className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 transition-all group"
          >
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 w-fit mb-2 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
              Data Santri & Siswa
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Impor massal Excel & pembagian kelas
            </p>
          </Link>

          <Link
            to="/admin/users"
            className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 transition-all group"
          >
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 w-fit mb-2 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
              Manajemen Pengguna
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Akun guru, wali kelas, & hak akses
            </p>
          </Link>

          <Link
            to="/admin/announcements"
            className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 transition-all group"
          >
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 w-fit mb-2 group-hover:scale-105 transition-transform">
              <Megaphone className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
              Pusat Pengumuman
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Broadcast info & surat edaran PDF
            </p>
          </Link>

          <Link
            to="/admin/academic-years"
            className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 transition-all group"
          >
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 w-fit mb-2 group-hover:scale-105 transition-transform">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
              Tahun Ajaran & Kalender
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Atur semester & kalender madrasah
            </p>
          </Link>
        </div>
      </div>

      {/* 4. Segmented Tab Navigation for Admin Sections */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-fit border border-slate-200/70 dark:border-slate-700/60">
        <button
          onClick={() => setActiveTab('monitoring')}
          className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'monitoring'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-indigo-500" />
          <span>Monitoring Aktivitas Guru ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('jadwal')}
          className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'jadwal'
              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
          <span>Jadwal & Kalender Akademik</span>
        </button>

        <button
          onClick={() => setActiveTab('pemeliharaan')}
          className={`py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'pemeliharaan'
              ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          <span>Pemeliharaan & Keamanan Data</span>
        </button>
      </div>

      {/* 5. TAB PANELS */}

      {/* TAB 1: MONITORING AKTIVITAS GURU */}
      {activeTab === 'monitoring' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xs border border-slate-200/80 dark:border-slate-800 overflow-hidden space-y-0">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Log Aktivitas Pengajaran Hari Ini
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pencatatan otomatis saat guru menyimpan presensi, nilai, atau menerbitkan tugas
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Filter Kelas:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {classList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2 text-center">
                <Clock className="w-10 h-10 opacity-30 text-indigo-400" />
                <p className="text-xs font-semibold">Belum ada aktivitas guru yang tercatat hari ini ({todayStr}).</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-xs border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Waktu</th>
                    <th className="px-5 py-3">Nama Guru</th>
                    <th className="px-5 py-3">Kelas</th>
                    <th className="px-5 py-3">Aktivitas Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                        {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss', { locale: id }) + ' WIB' : '-'}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {log.guruName}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md text-[11px] font-bold border border-indigo-100 dark:border-indigo-800/50">
                          {log.className}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        {log.activity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: JADWAL & KALENDER */}
      {activeTab === 'jadwal' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <ScheduleWidget classId={selectedClass} title={`Monitoring Jadwal Pelajaran (${selectedClass})`} />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <CalendarWidget targetRole="admin" classFilter={selectedClass} />
          </div>
        </div>
      )}

      {/* TAB 3: PEMELIHARAAN & KEAMANAN DATA (Danger Zone Tucked Cleanly) */}
      {activeTab === 'pemeliharaan' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-rose-200 dark:border-rose-950/60 shadow-sm relative overflow-hidden space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/80 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Pusat Pemeliharaan Data & Pergantian Tahun Ajaran
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Fitur di area ini memiliki dampak permanen terhadap seluruh arsip database sekolah. Gunakan hanya saat madrasah memasuki pergantian tahun ajaran baru setelah seluruh rapor selesai dicetak dan diarsipkan.
              </p>
            </div>
          </div>

          <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wide">
              Danger Zone: Reset Total Data Sekolah
            </h4>
            <p className="text-xs text-rose-800/80 dark:text-rose-300/80 leading-relaxed">
              Tindakan ini akan mengosongkan seluruh koleksi data Siswa, Nilai Akademik, Presensi Harian, Jadwal, Soal Online, Tabungan & Kas dari Kelas 1 hingga Kelas 9. Data pengguna guru dan admin akan tetap aman.
            </p>
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Buka Konfirmasi Reset Total Data</span>
            </button>
          </div>
        </div>
      )}

      {/* Custom Reset Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Konfirmasi Reset Database Total</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                Tindakan ini akan <strong>MENGHAPUS SELURUH DATA SEKOLAH</strong> secara permanen.
                <br /><br />
                Ketik <strong className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded font-mono">RESET-TOTAL</strong> untuk melanjutkan.
              </p>

              <input
                type="text"
                placeholder="Ketik RESET-TOTAL"
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 transition-all outline-none mb-5 font-mono text-xs text-slate-900 dark:text-white text-center font-bold uppercase"
              />

              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setIsResetModalOpen(false);
                    setResetConfirmationText('');
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={executeGlobalReset}
                  disabled={resetConfirmationText !== 'RESET-TOTAL' || resetting}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {resetting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{resetting ? 'Menghapus...' : 'Konfirmasi Hapus'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-white text-xs font-bold ${
                toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
