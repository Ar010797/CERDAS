import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  AlertTriangle, 
  Trash2, 
  Activity, 
  Clock, 
  CheckCircle, 
  CalendarDays, 
  Bell, 
  ShieldCheck, 
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Filter
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
  const [stats, setStats] = useState({ users: 0, students: 0, classes: 0 });
  const [logs, setLogs] = useState<LogAktivitas[]>([]);
  const [loading, setLoading] = useState(true);
  const [classList, setClassList] = useState<string[]>(['Semua Kelas']);
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');
  const [activeAdminTab, setActiveAdminTab] = useState<'aktivitas' | 'jadwal' | 'kalender'>('aktivitas');
  const [showDangerZone, setShowDangerZone] = useState(false);

  useEffect(() => {
    // Stats real-time
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      // Generate class list from teachers
      const classes = new Set<string>();
      snap.forEach(d => {
        const data = d.data();
        if (data.role === 'Guru' && data.assigned_class) {
          classes.add(data.assigned_class);
        }
      });
      const classArr = Array.from(classes);
      setClassList(['Semua Kelas', ...classArr]);
      setStats(prev => ({ ...prev, users: snap.size, classes: classArr.length || 9 }));
    }, (err) => console.warn("unsubUsers error:", err));
    
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStats(prev => ({ ...prev, students: snap.size }));
    }, (err) => console.warn("unsubStudents error:", err));

    // Real-time activity logs for TODAY
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const qLogs = query(
      collection(db, 'log_aktivitas'),
      where('timestamp', '>=', todayStr),
      where('timestamp', '<=', todayStr + 'T23:59:59')
    );

    const unsubLogs = onSnapshot(qLogs, (snap) => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as LogAktivitas));
      if (selectedClass !== 'Semua Kelas') {
        data = data.filter(item => item.className === selectedClass);
      }
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(data);
      setLoading(false);
    }, (err) => {
      console.warn("unsubLogs error:", err);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubStudents();
      unsubLogs();
    };
  }, [selectedClass]);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [resetting, setResetting] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
        'questions', 'announcements', 'student_notifications'
      ];
      
      for (const collName of collectionsToClear) {
        const snap = await getDocs(collection(db, collName));
        let batch = writeBatch(db);
        let count = 0;
        
        for (const doc of snap.docs) {
          batch.delete(doc.ref);
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
    { title: 'Total Siswa Aktif', value: stats.students, icon: GraduationCap, color: 'bg-emerald-600', sub: 'Terdata di sistem' },
    { title: 'Pengguna / Guru', value: stats.users, icon: Users, color: 'bg-indigo-600', sub: 'Admin, Guru, & Staf' },
    { title: 'Rombel / Kelas', value: stats.classes || 9, icon: BookOpen, color: 'bg-blue-600', sub: 'Kelas 1 s/d Kelas 9' },
    { title: 'Aktivitas Hari Ini', value: logs.length, icon: Activity, color: 'bg-purple-600', sub: 'Log tindakan guru' },
  ];

  const adminShortcuts = [
    { title: 'Data Siswa', desc: 'Daftar, tambah, & impor massal Excel', to: '/admin/students', icon: GraduationCap },
    { title: 'Kelola Pengguna', desc: 'Akun guru, wali kelas, & hak akses', to: '/admin/users', icon: Users },
    { title: 'Absensi Siswa', desc: 'Monitoring rekap kehadiran sekolah', to: '/admin/attendance', icon: CheckCircle },
    { title: 'Rapor & Nilai', desc: 'Pantau nilai seluruh kelas & siswa', to: '/admin/grades', icon: BookOpen },
    { title: 'Pengumuman', desc: 'Kirim siaran penting ke guru & wali', to: '/admin/announcements', icon: Bell },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Alert */}
      {toast && (
        <div className={`p-3.5 rounded-2xl text-xs font-bold fixed bottom-5 right-5 z-50 shadow-lg flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2">✕</button>
        </div>
      )}

      {/* 1. Header Admin Ringkas */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold mb-2 border border-white/15">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pusat Kendali Administrator</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Dashboard Admin</h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
            Ringkasan data operasional sekolah, manajemen siswa, guru, jadwal pelajaran, dan log aktivitas real-time.
          </p>
        </div>

        <div className="bg-white/10 px-4 py-2.5 rounded-2xl border border-white/15 flex items-center gap-3 shrink-0">
          <CalendarDays className="w-5 h-5 text-indigo-300" />
          <div>
            <p className="text-[10px] text-slate-300 uppercase tracking-wider font-bold">Tanggal</p>
            <p className="text-xs font-bold">{format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}</p>
          </div>
        </div>
      </div>

      {/* 2. Kartu Metrik Utama */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{stat.title}</p>
              {loading ? (
                <div className="h-7 w-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-1.5" />
              ) : (
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {stat.value}
                </h3>
              )}
              <p className="text-[11px] text-slate-400 mt-1">{stat.sub}</p>
            </div>
            <div className={`p-3 rounded-2xl text-white ${stat.color} shadow-2xs shrink-0`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Pintasan Cepat Menu Admin */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Akses Cepat Pengelolaan Sekolah
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {adminShortcuts.map((s, idx) => (
            <Link
              key={idx}
              to={s.to}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 hover:bg-indigo-50/70 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-750 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-2xs mb-2 group-hover:scale-105 transition-transform">
                  <s.icon className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">
                  {s.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                  {s.desc}
                </p>
              </div>
              <div className="mt-2.5 flex items-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                <span>Buka</span>
                <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 4. Tab Monitoring Terpadu (Aktivitas Guru, Jadwal Pelajaran, Kalender) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          {/* Tab Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl self-start">
            <button
              onClick={() => setActiveAdminTab('aktivitas')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeAdminTab === 'aktivitas'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Log Aktivitas Guru ({logs.length})
            </button>
            <button
              onClick={() => setActiveAdminTab('jadwal')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeAdminTab === 'jadwal'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Monitoring Jadwal
            </button>
            <button
              onClick={() => setActiveAdminTab('kalender')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeAdminTab === 'kalender'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Kalender Akademik
            </button>
          </div>

          {/* Filter Kelas */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filter Kelas:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {classList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Tab 1: Log Aktivitas Guru */}
        {activeAdminTab === 'aktivitas' && (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
                <Clock className="w-9 h-9 opacity-30" />
                <p className="text-xs font-medium">Belum ada aktivitas guru tercatat hari ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[380px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-850 z-10 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">Waktu</th>
                      <th className="px-4 py-2.5 font-bold">Nama Guru</th>
                      <th className="px-4 py-2.5 font-bold">Kelas</th>
                      <th className="px-4 py-2.5 font-bold">Aktivitas Terakhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-medium text-[11px]">
                          {log.timestamp ? format(new Date(log.timestamp), 'd MMM, HH:mm', { locale: id }) + ' WIB' : '-'}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{log.guruName}</td>
                        <td className="px-4 py-3">
                          <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-indigo-100 dark:border-indigo-800">
                            {log.className}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{log.activity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Jadwal Pelajaran */}
        {activeAdminTab === 'jadwal' && (
          <div>
            <ScheduleWidget classId={selectedClass} title={`Monitoring Jadwal Pelajaran & Ujian (${selectedClass})`} />
          </div>
        )}

        {/* Tab 3: Kalender Akademik */}
        {activeAdminTab === 'kalender' && (
          <div>
            <CalendarWidget targetRole="admin" classFilter={selectedClass} />
          </div>
        )}
      </div>

      {/* 5. Danger Zone Rapi di Bawah */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-red-200 dark:border-red-950/60 shadow-2xs overflow-hidden transition-all">
        <button
          onClick={() => setShowDangerZone(!showDangerZone)}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-950 text-red-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Pemeliharaan & Reset Total Sekolah</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Digunakan khusus saat pergantian tahun ajaran baru</p>
            </div>
          </div>
          {showDangerZone ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {showDangerZone && (
          <div className="p-5 border-t border-red-100 dark:border-red-950/60 bg-red-50/30 dark:bg-red-950/10 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tindakan ini akan menghapus <strong>SELURUH DATA SEKOLAH</strong> termasuk semua Siswa, Nilai Rapot, Absensi, Tabungan, Kas, dan Tugas dari Kelas 1 hingga Kelas 9. Akun pengguna tidak akan terhapus.
            </p>
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>Buka Konfirmasi Reset Total</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Reset Total */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-red-200 dark:border-red-900/60 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Konfirmasi Reset Total</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Ketik <strong>RESET-TOTAL</strong> di bawah ini untuk mengonfirmasi penghapusan seluruh data siswa, absensi, nilai, dan keuangan.
                </p>
              </div>

              <input
                type="text"
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                placeholder="Ketik RESET-TOTAL"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-center font-bold outline-none focus:ring-2 focus:ring-red-500"
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(false);
                    setResetConfirmationText('');
                  }}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={resetConfirmationText !== 'RESET-TOTAL' || resetting}
                  onClick={executeGlobalReset}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {resetting ? 'Menghapus...' : 'Hapus Total'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
