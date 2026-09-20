import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarDays, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import ScheduleWidget from '../../components/ScheduleWidget';

export default function GuruDashboard() {
  const { userData } = useAuth();
  const assignedClass = userData?.assigned_class || 'Kelas 1';
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const q = query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAnnouncements(data);
      } catch (error) {
        console.error("Error fetching announcements", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Dashboard Guru</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-700 dark:to-slate-900 rounded-3xl p-8 text-white shadow-lg shadow-indigo-200/50 dark:shadow-none border border-transparent dark:border-slate-800">
            <h2 className="text-3xl font-bold mb-2">Selamat Mengajar!</h2>
            <p className="text-indigo-100 mb-6 max-w-md">
              Wali Kelas: <strong>{assignedClass}</strong> | Pastikan Anda mengisi absensi harian dan mengecek agenda mengajar hari ini.
            </p>
            <div className="inline-flex items-center space-x-2 bg-white/20 dark:bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
              <CalendarDays className="w-5 h-5" />
              <span className="font-medium">{format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}</span>
            </div>
          </div>

          {/* Schedule Widget */}
          <ScheduleWidget classId={assignedClass} title={`Jadwal Pengajaran (${assignedClass})`} />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col transition-colors">
          <div className="flex items-center space-x-2 mb-6">
            <Bell className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Pengumuman Terbaru</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4">
            {loading ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">Memuat pengumuman...</p>
            ) : announcements.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">Belum ada pengumuman.</p>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{ann.title}</h4>
                  <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2">{ann.content}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    {ann.date?.toDate ? format(ann.date.toDate(), 'dd MMM yyyy') : ''}
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
