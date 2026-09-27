import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit } from 'firebase/firestore';
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
  Layers
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import ScheduleWidget from '../../components/ScheduleWidget';
import CalendarWidget from '../../components/CalendarWidget';

export default function GuruDashboard() {
  const { userData } = useAuth();
  const assignedClass = userData?.assigned_class || 'Kelas 1';
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [todayAttendanceCount, setTodayAttendanceCount] = useState<{ hadir: number; total: number }>({ hadir: 0, total: 0 });
  const [activeAssignmentsCount, setActiveAssignmentsCount] = useState<number>(0);
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
      let hadirCount = 0;
      snap.forEach(d => {
        if (d.data().status === 'Hadir') hadirCount++;
      });
      setTodayAttendanceCount({ hadir: hadirCount, total: snap.size });
    }, (err) => console.warn('unsubAtt error:', err));

    // 3. Tugas Aktif
    const qAssign = query(
      collection(db, 'assignments'),
      where('classId', '==', assignedClass),
      where('status', '==', 'active')
    );
    const unsubAssign = onSnapshot(qAssign, (snap) => {
      setActiveAssignmentsCount(snap.size);
    }, (err) => console.warn('unsubAssign error:', err));

    // 4. Pengumuman Terbaru
    const qAnnounce = query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(4));
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
      unsubAnnounce();
    };
  }, [assignedClass, todayStr]);

  const quickMenus = [
    {
      title: 'Absensi Harian',
      desc: todayAttendanceCount.total > 0
        ? `${todayAttendanceCount.hadir} dari ${studentCount} santri hadir`
        : 'Belum input kehadiran hari ini',
      icon: ClipboardList,
      to: '/guru/attendance',
      color: 'bg-emerald-500',
      badge: todayAttendanceCount.total > 0 ? 'Sudah Diisi' : 'Perlu Diisi'
    },
    {
      title: 'Penilaian & Rapor',
      desc: 'Kelola nilai tugas, PTS, PAS & cetak rapor',
      icon: BookOpen,
      to: '/guru/grades',
      color: 'bg-indigo-600',
      badge: 'Akademik'
    },
    {
      title: 'Tugas & Ujian Online',
      desc: `${activeAssignmentsCount} tugas online sedang aktif`,
      icon: FileCheck,
      to: '/guru/assignments',
      color: 'bg-blue-600',
      badge: `${activeAssignmentsCount} Aktif`
    },
    {
      title: 'Bank Soal Ujian',
      desc: 'Buat & impor naskah soal PDF otomatis',
      icon: Layers,
      to: '/guru/question-bank',
      color: 'bg-purple-600',
      badge: 'Cepat & AI'
    },
    {
      title: 'Tabungan & Kas',
      desc: 'Catat setoran tabungan & pengeluaran kas',
      icon: Wallet,
      to: '/guru/finance',
      color: 'bg-amber-600',
      badge: 'Keuangan'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Ringkas & Elegan */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden border border-indigo-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold mb-3 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Wali Kelas • {assignedClass}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Selamat Bertugas, {userData?.name || 'Bapak/Ibu Guru'}!
            </h1>
            <p className="text-indigo-100 dark:text-slate-300 text-xs sm:text-sm mt-1.5 max-w-xl leading-relaxed">
              Pantau kehadiran santri, nilai akademik, tugas online, dan jadwal mengajar dengan mudah di satu tempat.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className="bg-white/15 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2.5 rounded-2xl border border-white/20 flex items-center gap-2.5">
              <CalendarDays className="w-5 h-5 text-indigo-200" />
              <div className="text-left">
                <p className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Hari Ini</p>
                <p className="text-xs font-bold">{format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}</p>
              </div>
            </div>

            <Link
              to="/guru/attendance"
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Input Absensi</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Menu Pintar Cepat (Simple & Berfungsi Maksimal) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            Menu Utama Pengajaran
          </h2>
          <span className="text-xs text-slate-400">Kelas: {assignedClass} ({studentCount} Siswa Terdaftar)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {quickMenus.map((item, idx) => (
            <Link
              key={idx}
              to={item.to}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-2xs hover:shadow-sm transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${item.color} text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {item.badge}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <span>Buka Menu</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 3. Grid: Jadwal Pelajaran & Pengumuman Sekolah */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Jadwal & Kalender */}
        <div className="lg:col-span-2 space-y-6">
          <ScheduleWidget classId={assignedClass} title={`Jadwal Pengajaran & Ujian (${assignedClass})`} />
          <CalendarWidget targetRole="guru" classFilter={assignedClass} />
        </div>

        {/* Kolom Kanan: Pengumuman Terkini */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xs border border-slate-200/80 dark:border-slate-800 flex flex-col h-fit">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Bell className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Pengumuman Sekolah</h3>
            </div>
            <Link
              to="/guru/announcements"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Lihat Semua
            </Link>
          </div>

          <div className="space-y-3">
            {loading ? (
              <p className="text-slate-400 text-xs text-center py-6">Memuat pengumuman...</p>
            ) : announcements.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-slate-500">Belum ada pengumuman baru.</p>
              </div>
            ) : (
              announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 hover:border-indigo-200 transition-colors"
                >
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 mb-1 line-clamp-1">
                    {ann.title}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 text-xs line-clamp-2 leading-relaxed">
                    {ann.content}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{ann.author || 'Admin Sekolah'}</span>
                    <span>
                      {ann.date?.toDate ? format(ann.date.toDate(), 'dd MMM yyyy') : (ann.date || '')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
