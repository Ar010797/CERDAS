import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar, Clock, BookOpen, User, MapPin, FileText, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ScheduleItem {
  id: string;
  classId: string;
  type: 'pelajaran' | 'ujian';
  hari: string;
  jam: string;
  mataPelajaran: string;
  pengajar: string;
  ruangan?: string;
  keterangan?: string;
}

interface ScheduleWidgetProps {
  classId: string;
  title?: string;
}

const HARI_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function ScheduleWidget({ classId, title }: ScheduleWidgetProps) {
  const [activeTab, setActiveTab] = useState<'pelajaran' | 'ujian'>('pelajaran');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, 'jadwal_kelas'));
    if (classId && classId !== 'Semua Kelas') {
      q = query(collection(db, 'jadwal_kelas'), where('classId', '==', classId));
    }

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleItem));
      setSchedules(items);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching schedules:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [classId]);

  const filtered = schedules.filter(s => s.type === activeTab);
  
  const groupedByDay = HARI_ORDER.map(day => ({
    day,
    items: filtered.filter(s => s.hari === day).sort((a, b) => a.jam.localeCompare(b.jam))
  })).filter(group => group.items.length > 0);

  const examItems = filtered.sort((a, b) => a.hari.localeCompare(b.hari) || a.jam.localeCompare(b.jam));

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-3xl p-6 shadow-md border border-indigo-100/50 flex flex-col h-full relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-200/40 via-purple-200/20 to-transparent rounded-bl-full -z-0 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-pink-200/30 to-transparent rounded-tr-full -z-0 pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-sm rotate-3">
            <Calendar className="w-6 h-6 -rotate-3" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              {title || `Jadwal ${classId}`}
              <Sparkles className="w-4 h-4 text-amber-500" />
            </h3>
            <p className="text-xs font-medium text-slate-500 bg-white/60 px-2 py-0.5 rounded-md inline-block mt-1 backdrop-blur-sm border border-slate-200/50">Jadwal Harian & Ujian</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-200/70 p-1.5 rounded-2xl text-xs font-bold self-stretch sm:self-auto shadow-inner backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('pelajaran')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl transition-all duration-300 ${activeTab === 'pelajaran' ? 'bg-white text-indigo-700 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-800 scale-95'}`}
          >
            Pelajaran
          </button>
          <button
            onClick={() => setActiveTab('ujian')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl transition-all duration-300 ${activeTab === 'ujian' ? 'bg-white text-purple-700 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-800 scale-95'}`}
          >
            Ujian
          </button>
        </div>
      </div>

      <div className="relative z-10 flex-1">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </motion.div>
          ) : activeTab === 'pelajaran' ? (
            groupedByDay.length === 0 ? (
              <motion.div key="empty-pelajaran" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
                <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center mb-2">
                  <BookOpen className="w-8 h-8 text-indigo-300" />
                </div>
                <p className="text-sm font-bold text-slate-500">Belum ada jadwal untuk {classId}.</p>
              </motion.div>
            ) : (
              <motion.div key="pelajaran" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 overflow-y-auto max-h-[420px] pr-2 custom-scrollbar">
                {groupedByDay.map(group => (
                  <div key={group.day} className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white shadow-sm">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-xs font-extrabold rounded-xl mb-4 shadow-sm">
                      <Calendar className="w-3.5 h-3.5" />
                      {group.day}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.items.map((item, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                          key={item.id} 
                          className="bg-white p-4 rounded-2xl border border-indigo-50 hover:border-indigo-200 shadow-sm hover:shadow-md transition-all group space-y-2 relative overflow-hidden"
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 group-hover:w-1.5 transition-all" />
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              {item.mataPelajaran}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-indigo-100">
                              <Clock className="w-3 h-3" />
                              {item.jam}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-2">
                            <span className="flex items-center gap-1.5 font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded-md">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {item.pengajar || '-'}
                            </span>
                            {item.ruangan && (
                              <span className="flex items-center gap-1.5 font-medium text-slate-500">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {item.ruangan}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )
          ) : (
            examItems.length === 0 ? (
              <motion.div key="empty-ujian" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
                <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center mb-2">
                  <FileText className="w-8 h-8 text-purple-300" />
                </div>
                <p className="text-sm font-bold text-slate-500">Belum ada jadwal ujian untuk {classId}.</p>
              </motion.div>
            ) : (
              <motion.div key="ujian" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[420px] pr-2 custom-scrollbar">
                {examItems.map((item, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                    key={item.id} 
                    className="bg-gradient-to-br from-white to-purple-50/50 border border-purple-100 p-5 rounded-2xl space-y-3 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-purple-100/50 rounded-bl-full -z-0" />
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-purple-800 bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-xl shadow-sm">
                        {item.hari}
                      </span>
                      <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg shadow-sm border border-purple-50">
                        <Clock className="w-3.5 h-3.5" />
                        {item.jam}
                      </span>
                    </div>
                    <h4 className="relative z-10 text-base font-black text-slate-800 flex items-center gap-2 pt-1">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      {item.mataPelajaran}
                    </h4>
                    <div className="relative z-10 flex items-center justify-between text-xs pt-3 border-t border-purple-100/60 mt-1">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                        Pengawas: {item.pengajar || '-'}
                      </span>
                      {item.ruangan && (
                        <span className="flex items-center gap-1.5 font-bold text-purple-700 bg-white px-2 py-1 rounded-lg">
                          <MapPin className="w-3.5 h-3.5 text-purple-500" />
                          {item.ruangan}
                        </span>
                      )}
                    </div>
                    {item.keterangan && (
                      <p className="relative z-10 text-xs font-medium text-purple-800 bg-purple-100/60 p-2.5 rounded-xl border border-purple-200/50 mt-2 flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70" />
                        {item.keterangan}
                      </p>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
