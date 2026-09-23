import React, { useState, useRef, useEffect } from 'react';
import { Bell, Volume2, VolumeX, CheckCheck, Megaphone, AlertCircle, Calendar, Clock, X, ArrowRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAnnouncementsNotification, AnnouncementItem } from '../hooks/useAnnouncementsNotification';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Props {
  studentClassId?: string;
  onOpenAnnouncementsTab?: () => void;
}

export default function AnnouncementNotificationBell({ studentClassId, onOpenAnnouncementsTab }: Props) {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    announcements,
    unreadAnnouncements,
    unreadCount,
    readIds,
    soundEnabled,
    markAsRead,
    markAllAsRead,
    toggleSound,
    isUnread
  } = useAnnouncementsNotification(studentClassId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (val: any) => {
    if (!val) return 'Baru saja';
    try {
      const d = val.toDate ? val.toDate() : new Date(val);
      return format(d, 'd MMM yyyy, HH:mm', { locale: idLocale });
    } catch {
      return 'Baru saja';
    }
  };

  const handleOpenItem = (item: AnnouncementItem) => {
    markAsRead(item.id);
    setSelectedAnnouncement(item);
  };

  const handleViewAll = () => {
    setIsOpen(false);
    if (userData?.role === 'Wali Murid') {
      if (onOpenAnnouncementsTab) {
        onOpenAnnouncementsTab();
      } else {
        navigate('/walimurid/dashboard', { state: { tab: 'pengumuman' } });
      }
    } else if (userData?.role === 'Guru') {
      navigate('/guru/announcements');
    } else {
      navigate('/admin/announcements');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Pemberitahuan & Pengumuman Sekolah"
        title="Pengumuman & Pemberitahuan dari Admin / Guru"
        className={`relative p-2.5 rounded-xl transition-all duration-200 ${
          unreadCount > 0
            ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/90 dark:text-indigo-200 ring-2 ring-indigo-400 dark:ring-indigo-600'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}
      >
        <Megaphone className="w-4 h-4" />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-rose-600 text-[9px] font-black text-white shadow-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Notification Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[100] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-300" />
                <div>
                  <h4 className="font-bold text-sm leading-tight">Pengumuman & Pemberitahuan</h4>
                  <p className="text-[11px] text-indigo-200">
                    {unreadCount > 0 ? `${unreadCount} pemberitahuan baru` : 'Semua telah dibaca'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={toggleSound}
                  title={soundEnabled ? 'Suara Notifikasi Aktif' : 'Suara Notifikasi Hening'}
                  className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-amber-300" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-white/60" />
                  )}
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    title="Tandai semua telah dibaca"
                    className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors flex items-center gap-1 text-[11px]"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List of Announcements */}
            <div className="p-3 max-h-84 overflow-y-auto space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
              {announcements.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Belum Ada Pengumuman</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Pemberitahuan dari Admin dan Guru akan tampil di sini.
                  </p>
                </div>
              ) : (
                announcements.slice(0, 6).map((item) => {
                  const unread = isUnread(item.id);
                  const isUrgent = item.priority === 'Penting' || item.priority === 'Tinggi (Penting)';
                  const isFromGuru = item.authorRole === 'Guru' || (item.authorName && item.authorName.toLowerCase().includes('guru'));

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenItem(item)}
                      className={`pt-2.5 first:pt-0 cursor-pointer rounded-xl p-2.5 transition-colors ${
                        unread
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Sender badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isFromGuru
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                            }`}
                          >
                            {isFromGuru ? `Guru ${item.authorClass || ''}` : 'Admin Sekolah'}
                          </span>

                          {/* Priority badge */}
                          {isUrgent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Penting
                            </span>
                          )}

                          {item.category && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              • {item.category}
                            </span>
                          )}
                        </div>

                        {unread && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1" />
                        )}
                      </div>

                      <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100 mt-1.5 line-clamp-1">
                        {item.title}
                      </h5>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                        {item.content}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/80 dark:border-slate-800/80 text-[10px] text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(item.date)}
                        </span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                          Baca selengkapnya →
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={handleViewAll}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <span>Lihat Seluruh Pengumuman & Arsip</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAnnouncement && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      selectedAnnouncement.authorRole === 'Guru'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                    }`}
                  >
                    Pengirim: {selectedAnnouncement.authorName || (selectedAnnouncement.authorRole === 'Guru' ? 'Guru Kelas' : 'Admin Sekolah')}
                  </span>
                  {selectedAnnouncement.priority === 'Penting' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      Pemberitahuan Penting
                    </span>
                  )}
                  {selectedAnnouncement.targetClass && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Sasaran: {selectedAnnouncement.targetClass}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                {selectedAnnouncement.title}
              </h3>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(selectedAnnouncement.date)}
                </span>
                {selectedAnnouncement.category && (
                  <span>• Kategori: {selectedAnnouncement.category}</span>
                )}
              </div>

              <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-normal mb-6">
                {selectedAnnouncement.content}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
