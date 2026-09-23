import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar, Clock, BookOpen, User, MapPin, FileText, Sparkles, Image as ImageIcon, X, Maximize2, LayoutGrid, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import IllustratedSchedulePoster from './IllustratedSchedulePoster';
import { parseScheduleTime } from '../hooks/useScheduleReminder';

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
  const [viewMode, setViewMode] = useState<'poster' | 'cards'>('poster');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [schoolName, setSchoolName] = useState<string>('SEKOLAH DASAR');

  useEffect(() => {
    const unsubSchool = onSnapshot(doc(db, 'settings', 'school'), (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        const detected = (d.schoolName || d.namaSekolah || '').trim();
        if (detected && !detected.toUpperCase().includes('CERDAS')) {
          setSchoolName(detected);
        }
      }
    });
    return () => unsubSchool();
  }, []);

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

    let unsubImage = () => {};
    if (classId && classId !== 'Semua Kelas') {
      unsubImage = onSnapshot(doc(db, 'jadwal_images', classId), (docSnap) => {
        if (docSnap.exists()) {
          setImageUrl(docSnap.data().imageUrl);
        } else {
          setImageUrl(null);
        }
      });
    }

    return () => {
      unsub();
      unsubImage();
    };
  }, [classId]);

  const filtered = schedules.filter(s => s.type === activeTab);
  
  const groupedByDay = HARI_ORDER.map(day => ({
    day,
    items: filtered.filter(s => s.hari === day).sort((a, b) => a.jam.localeCompare(b.jam))
  })).filter(group => group.items.length > 0);

  const examItems = filtered.sort((a, b) => a.hari.localeCompare(b.hari) || a.jam.localeCompare(b.jam));

  return (
    <div className="bg-gradient-to-br from-indigo-50/70 via-white to-pink-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 rounded-3xl p-4 sm:p-6 shadow-md border border-indigo-100/70 dark:border-slate-800 flex flex-col h-full relative overflow-hidden transition-colors">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pink-200/30 via-purple-200/20 to-transparent dark:from-indigo-500/10 dark:via-purple-500/5 rounded-bl-full -z-0 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-sky-200/30 to-transparent dark:from-pink-500/10 rounded-tr-full -z-0 pointer-events-none" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-2xl shadow-sm rotate-2">
            <Calendar className="w-6 h-6 -rotate-2" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                {title || `Jadwal ${classId}`}
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              </h3>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                {classId}
              </span>

              {imageUrl && (
                <button
                  onClick={() => setShowImageModal(true)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1.5 transition-colors border border-indigo-100 dark:border-indigo-800"
                >
                  <ImageIcon className="w-3 h-3" />
                  Lihat Gambar Asli
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls: View Switcher (Poster vs Cards) & Tab Switcher (Pelajaran vs Ujian) */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
          {/* View Switcher */}
          <div className="flex bg-slate-200/80 dark:bg-slate-800/90 p-1 rounded-2xl text-xs font-bold shadow-inner">
            <button
              onClick={() => setViewMode('poster')}
              className={`px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                viewMode === 'poster'
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Poster Ceria</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kartu Ringkas</span>
            </button>
          </div>

          {/* Tab Switcher (Pelajaran vs Ujian) */}
          <div className="flex bg-slate-200/80 dark:bg-slate-800/90 p-1 rounded-2xl text-xs font-bold shadow-inner">
            <button
              onClick={() => setActiveTab('pelajaran')}
              className={`px-4 py-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'pelajaran'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Pelajaran</span>
            </button>
            <button
              onClick={() => setActiveTab('ujian')}
              className={`px-4 py-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'ujian'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ujian</span>
            </button>
          </div>

          {/* Fullscreen Poster Modal Button */}
          <button
            onClick={() => setShowPosterModal(true)}
            className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors"
            title="Buka Layar Penuh Poster"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex-1">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
            </motion.div>
          ) : viewMode === 'poster' ? (
            /* Mode 1: Illustrated Graphic Poster matching reference image */
            <motion.div
              key={`poster-${activeTab}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <IllustratedSchedulePoster
                classId={classId}
                schedules={schedules}
                type={activeTab}
                schoolName={schoolName}
                customImageUrl={imageUrl}
                readOnly={true}
              />
            </motion.div>
          ) : activeTab === 'pelajaran' ? (
            /* Mode 2: Compact Card Grid for Lessons */
            groupedByDay.length === 0 ? (
              <motion.div key="empty-pelajaran" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500 space-y-3">
                <div className="w-16 h-16 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-2">
                  <BookOpen className="w-8 h-8 text-indigo-300 dark:text-indigo-400" />
                </div>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Belum ada jadwal harian untuk {classId}.</p>
                <button
                  onClick={() => setViewMode('poster')}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Lihat format poster ilustrasi
                </button>
              </motion.div>
            ) : (
              <motion.div key="pelajaran" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                {groupedByDay.map(group => (
                  <div key={group.day} className="bg-white/90 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl p-4 border border-white dark:border-slate-700/60 shadow-xs">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-xs font-extrabold rounded-xl mb-3 shadow-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      {group.day}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.items.map((item, idx) => {
                        const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                        const todayDayName = DAY_NAMES[new Date().getDay()];
                        const isToday = group.day.toLowerCase() === todayDayName.toLowerCase();
                        const parsed = parseScheduleTime(item.jam);
                        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
                        const diff = parsed ? parsed.startMinutes - nowMinutes : -999;
                        const isStartingSoon = isToday && diff > 0 && diff <= 15;

                        return (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                            key={item.id} 
                            className={`p-4 rounded-2xl border shadow-xs hover:shadow-md transition-all group space-y-2 relative overflow-hidden ${
                              isStartingSoon
                                ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 ring-2 ring-amber-400'
                                : 'bg-white dark:bg-slate-800 border-indigo-50 dark:border-slate-700/60 hover:border-indigo-200 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${isStartingSoon ? 'bg-amber-500 w-1.5' : 'bg-indigo-500 group-hover:w-1.5'}`} />
                            
                            {isStartingSoon && (
                              <div className="flex items-center gap-1 text-[10px] font-black text-amber-900 dark:text-amber-200 bg-amber-200/90 dark:bg-amber-900/90 px-2 py-0.5 rounded-full w-fit animate-pulse mb-1">
                                <Clock className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                                <span>Segera Dimulai ({diff} Menit Lagi!)</span>
                              </div>
                            )}

                            <div className="flex justify-between items-start">
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                {item.mataPelajaran}
                              </span>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 border ${
                                isStartingSoon
                                  ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 border-amber-300'
                                  : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-100 dark:border-indigo-800'
                              }`}>
                                <Clock className="w-3 h-3" />
                                {item.jam}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-2">
                              <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 px-2 py-1 rounded-md">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                {item.pengajar || '-'}
                              </span>
                              {item.ruangan && (
                                <span className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                  {item.ruangan}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </motion.div>
            )
          ) : (
            /* Mode 2: Compact Card Grid for Exams */
            examItems.length === 0 ? (
              <motion.div key="empty-ujian" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500 space-y-3">
                <div className="w-16 h-16 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-2">
                  <FileText className="w-8 h-8 text-purple-300" />
                </div>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Belum ada jadwal ujian khusus untuk {classId}.</p>
                <button
                  onClick={() => setViewMode('poster')}
                  className="text-xs font-bold text-purple-600 hover:underline"
                >
                  Lihat format poster ujian lengkap
                </button>
              </motion.div>
            ) : (
              <motion.div key="ujian" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                {examItems.map((item, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                    key={item.id} 
                    className="bg-gradient-to-br from-white to-purple-50/50 dark:from-slate-800 dark:to-purple-950/20 border border-purple-100 dark:border-purple-900/40 p-5 rounded-2xl space-y-3 shadow-xs hover:shadow-md transition-all relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-purple-100/50 dark:bg-purple-900/20 rounded-bl-full -z-0" />
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-purple-800 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-3 py-1.5 rounded-xl shadow-xs">
                        {item.hari}
                      </span>
                      <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg shadow-xs border border-purple-50 dark:border-slate-800">
                        <Clock className="w-3.5 h-3.5" />
                        {item.jam}
                      </span>
                    </div>
                    <h4 className="relative z-10 text-base font-black text-slate-800 dark:text-white flex items-center gap-2 pt-1">
                      <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      {item.mataPelajaran}
                    </h4>
                    <div className="relative z-10 flex items-center justify-between text-xs pt-3 border-t border-purple-100/60 dark:border-slate-700/60 mt-1">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                        Pengawas: {item.pengajar || '-'}
                      </span>
                      {item.ruangan && (
                        <span className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg">
                          <MapPin className="w-3.5 h-3.5 text-purple-500" />
                          {item.ruangan}
                        </span>
                      )}
                    </div>
                    {item.keterangan && (
                      <p className="relative z-10 text-xs font-medium text-purple-800 dark:text-purple-300 bg-purple-100/60 dark:bg-purple-950/50 p-2.5 rounded-xl border border-purple-200/50 dark:border-purple-800/50 mt-2 flex items-start gap-2">
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

      {/* Full Illustrated Schedule Poster Modal */}
      <AnimatePresence>
        {showPosterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-auto"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base">
                    Layar Penuh Poster {activeTab === 'pelajaran' ? 'Jadwal Pelajaran' : 'Jadwal Ujian'} ({classId})
                  </h3>
                </div>
                <button
                  onClick={() => setShowPosterModal(false)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/60 dark:bg-slate-950">
                <IllustratedSchedulePoster
                  classId={classId}
                  schedules={schedules}
                  type={activeTab}
                  schoolName={schoolName}
                  customImageUrl={imageUrl}
                  readOnly={true}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Modal */}
      <AnimatePresence>
        {showImageModal && imageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-2 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative border border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Gambar Jadwal Asli {classId}
                </h3>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 flex justify-center items-center bg-slate-50 dark:bg-slate-950">
                <img src={imageUrl} alt={`Jadwal ${classId}`} className="max-w-full h-auto rounded-xl shadow-sm object-contain" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
