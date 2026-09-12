import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, getDocs, writeBatch, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Users, GraduationCap, BookOpen, AlertTriangle, Trash2, Activity, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import ScheduleWidget from '../../components/ScheduleWidget';

interface LogAktivitas {
  id: string;
  guruName: string;
  className: string;
  activity: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, students: 0 });
  const [logs, setLogs] = useState<LogAktivitas[]>([]);
  const [loading, setLoading] = useState(true);
  const [classList, setClassList] = useState<string[]>(['Semua Kelas']);
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');

  useEffect(() => {
    // Stats real-time
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setStats(prev => ({ ...prev, users: snap.size }));
      // Generate class list from teachers
      const classes = new Set<string>();
      snap.forEach(d => {
        const data = d.data();
        if (data.role === 'Guru' && data.assigned_class) {
          classes.add(data.assigned_class);
        }
      });
      setClassList(['Semua Kelas', ...Array.from(classes)]);
    });
    
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStats(prev => ({ ...prev, students: snap.size }));
    });

    // Real-time activity logs for TODAY
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let qLogs = query(
      collection(db, 'log_aktivitas'),
      where('timestamp', '>=', todayStr),
      where('timestamp', '<=', todayStr + 'T23:59:59'),
    );

    if (selectedClass !== 'Semua Kelas') {
      qLogs = query(
        collection(db, 'log_aktivitas'),
        where('timestamp', '>=', todayStr),
        where('timestamp', '<=', todayStr + 'T23:59:59'),
        where('className', '==', selectedClass)
      );
    }

    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as LogAktivitas));
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(data);
    });

    setLoading(false);

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
      // Chunking for batch deletes if more than 500 docs
      const collectionsToClear = ['students', 'grades', 'attendance', 'log_aktivitas', 'mata_pelajaran', 'lesson_plans', 'jadwal_kelas'];
      
      for (const collName of collectionsToClear) {
        const snap = await getDocs(collection(db, collName));
        let batch = writeBatch(db);
        let count = 0;
        
        for (const doc of snap.docs) {
          batch.delete(doc.ref);
          count++;
          if (count === 490) { // Keep under 500 limit safely
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
    { title: 'Total Pengguna', value: stats.users, icon: Users, color: 'bg-blue-500' },
    { title: 'Total Siswa', value: stats.students, icon: GraduationCap, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Admin</h1>
        <p className="text-sm text-slate-500 mt-1">Pantau seluruh aktivitas dan ringkasan sekolah.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center">
            <div className={`p-4 rounded-xl text-white ${stat.color} shadow-sm mr-5`}>
              <stat.icon className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">{stat.title}</p>
              {loading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded mt-1" />
              ) : (
                <h3 className="text-3xl font-bold text-slate-800 mt-1">{stat.value}</h3>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Schedule Widget for Admin */}
      <ScheduleWidget classId={selectedClass} title={`Monitoring Jadwal Pelajaran & Ujian (${selectedClass})`} />

      {/* Monitoring Aktivitas & Danger Zone Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Log Aktivitas Guru */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[500px]">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 rounded-t-2xl shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Monitoring Aktivitas Guru Hari Ini</h3>
                <p className="text-xs text-slate-500">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}</p>
              </div>
            </div>
            
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium text-slate-700"
            >
              {classList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="p-0 flex-1 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                <Clock className="w-10 h-10 opacity-20" />
                <p className="text-sm">Belum ada aktivitas guru tercatat hari ini.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-semibold">Waktu</th>
                    <th className="px-5 py-3 font-semibold">Nama Guru</th>
                    <th className="px-5 py-3 font-semibold">Kelas</th>
                    <th className="px-5 py-3 font-semibold">Aktivitas Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap font-medium">
                        {log.timestamp ? format(new Date(log.timestamp), 'd MMM yyyy, HH:mm', { locale: id }) + ' WIB' : '-'}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-700">{log.guruName}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium border border-indigo-100/50">
                          {log.className}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">{log.activity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Danger Zone Global */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 relative overflow-hidden h-fit">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -z-0 opacity-50" />
          <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center space-x-2 relative z-10">
            <AlertTriangle className="w-5 h-5" />
            <span>Danger Zone</span>
          </h3>
          <p className="text-sm text-slate-600 mb-6 relative z-10 leading-relaxed">
            Menghapus <strong>SELURUH DATA</strong> sekolah termasuk semua data Siswa, Nilai Akademik, Absensi, Pengaturan Kelas, dan Log Aktivitas dari Kelas 1-9.
            <br/><br/>
            Gunakan fitur ini hanya saat pergantian tahun ajaran baru!
          </p>
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="w-full flex items-center justify-center space-x-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-3 rounded-xl transition-colors font-medium text-sm relative z-10"
          >
            <Trash2 className="w-5 h-5" />
            <span>Hapus Seluruh Data Sekolah</span>
          </button>
        </div>

      </div>

      {/* Custom Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -z-0 opacity-50" />
            <div className="relative z-10">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              
              <h2 className="text-xl font-bold text-slate-800 mb-2">Apakah Anda Yakin?</h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Tindakan ini akan <strong>MENGHAPUS SELURUH DATA SEKOLAH</strong> secara permanen (Siswa, Nilai, Absensi, Pengaturan, Log). Data yang dihapus tidak dapat dikembalikan.
                <br/><br/>
                Ketik <strong>RESET-TOTAL</strong> untuk mengonfirmasi.
              </p>
              
              <input
                type="text"
                placeholder="Ketik RESET-TOTAL"
                value={resetConfirmationText}
                onChange={e => setResetConfirmationText(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none mb-6 font-medium text-slate-800 text-center uppercase"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsResetModalOpen(false);
                    setResetConfirmationText('');
                  }}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={executeGlobalReset}
                  disabled={resetConfirmationText !== 'RESET-TOTAL' || resetting}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {resetting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>{resetting ? 'Menghapus...' : 'Lanjut Hapus'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification (SnackBar) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}
