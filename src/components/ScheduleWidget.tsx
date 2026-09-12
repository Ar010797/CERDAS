import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar, Clock, BookOpen, User, MapPin, FileText, ChevronRight } from 'lucide-react';

export interface ScheduleItem {
  id: string;
  classId: string;
  type: 'pelajaran' | 'ujian';
  hari: string; // e.g., 'Senin' or '2026-10-15'
  jam: string; // e.g., '07:30 - 09:00'
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

  // Group by Hari for Pelajaran
  const groupedByDay = HARI_ORDER.map(day => ({
    day,
    items: filtered.filter(s => s.hari === day)
  })).filter(group => group.items.length > 0);

  // For exams or ungrouped
  const examItems = filtered;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {title || `Jadwal Kegiatan (${classId})`}
            </h3>
            <p className="text-xs text-slate-500">Jadwal pelajaran harian & agenda ujian</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-semibold self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('pelajaran')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl transition-all ${activeTab === 'pelajaran' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Jadwal Pelajaran
          </button>
          <button
            onClick={() => setActiveTab('ujian')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl transition-all ${activeTab === 'ujian' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Jadwal Ujian
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'pelajaran' ? (
        groupedByDay.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 space-y-2">
            <BookOpen className="w-8 h-8 opacity-30" />
            <p className="text-sm font-medium">Belum ada jadwal pelajaran untuk {classId}.</p>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto max-h-[380px] pr-1">
            {groupedByDay.map(group => (
              <div key={group.day} className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
                <div className="inline-block px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg mb-3">
                  {group.day}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {group.items.map(item => (
                    <div key={item.id} className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                          {item.mataPelajaran}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {item.jam}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {item.pengajar || 'Guru Mapel'}
                        </span>
                        {item.ruangan && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <MapPin className="w-3 h-3" />
                            {item.ruangan}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Jadwal Ujian */
        examItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 space-y-2">
            <FileText className="w-8 h-8 opacity-30" />
            <p className="text-sm font-medium">Belum ada jadwal ujian untuk {classId}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto max-h-[380px] pr-1">
            {examItems.map(item => (
              <div key={item.id} className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 bg-amber-200/60 px-2.5 py-1 rounded-lg">
                    {item.hari}
                  </span>
                  <span className="text-xs font-medium text-amber-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {item.jam}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  {item.mataPelajaran}
                </h4>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-amber-100">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    Pengawas: {item.pengajar || '-'}
                  </span>
                  {item.ruangan && (
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <MapPin className="w-3 h-3 text-amber-600" />
                      {item.ruangan}
                    </span>
                  )}
                </div>
                {item.keterangan && (
                  <p className="text-[11px] text-amber-800/80 bg-amber-100/50 p-2 rounded-lg italic">
                    Ket: {item.keterangan}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
