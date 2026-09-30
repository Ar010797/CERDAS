import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { showDeviceNotification } from '../lib/pushNotification';
import {
  saveOfflineAnnouncements,
  getOfflineAnnouncements,
  OfflineAnnouncement
} from '../lib/offlineStorage';
import { isClassTargetMatching } from '../lib/schoolClasses';

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  authorName?: string;
  authorRole?: 'Admin' | 'Guru' | string;
  authorId?: string;
  authorClass?: string;
  targetClass?: string; // 'Semua Kelas' | 'Kelas 1 A, Kelas 1 B' | ...
  targetClasses?: string[];
  targetRole?: 'Semua' | 'Wali Murid' | 'Guru' | string;
  category?: string;
  priority?: 'Normal' | 'Penting' | string;
  date?: any;
  createdAt?: string;
}

export function playAnnouncementChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    
    // First tone - D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second tone - A5 (880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.25, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn('Audio chime notice error:', err);
  }
}

export function useAnnouncementsNotification(studentClassId?: string) {
  const { userData } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('announcement_sound_enabled') !== 'false';
  });

  const prevCountRef = useRef<number>(-1);
  const storageKey = `read_announcements_${userData?.uid || 'guest'}`;

  // Load read status from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setReadIds(JSON.parse(stored));
      } else {
        setReadIds([]);
      }
    } catch {
      setReadIds([]);
    }
  }, [storageKey]);

  // Subscribe to announcements collection (with IndexedDB offline cache & fallback)
  useEffect(() => {
    // 1. Initial fast load from IndexedDB
    getOfflineAnnouncements({
      classId: studentClassId,
      role: userData?.role
    }).then((cached) => {
      if (cached && cached.length > 0) {
        setAnnouncements(cached as AnnouncementItem[]);
        setLoading(false);
      }
    });

    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(35));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rawAll: AnnouncementItem[] = [];
        const items: AnnouncementItem[] = [];

        const userRole = userData?.role || 'Wali Murid';
        const userClass = (studentClassId || userData?.assigned_class || userData?.studentClass || '').trim();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const item = { id: docSnap.id, ...data } as AnnouncementItem;
          rawAll.push(item);

          const targetClassStr = (data.targetClass || 'Semua Kelas').trim();
          const targetClassesArr: string[] = Array.isArray(data.targetClasses) && data.targetClasses.length > 0 
            ? data.targetClasses 
            : targetClassStr.split(',').map(s => s.trim());
          const targetRole = data.targetRole || 'Semua';

          // 1. Admin selalu dapat memantau seluruh pengumuman sekolah
          if (userRole === 'Admin') {
            items.push(item);
            return;
          }

          // 2. Pemeriksaan Peran Sasaran (Target Role)
          // Jika ditujukan khusus Guru, Wali Murid tidak mendapatkan notifikasi
          // Jika ditujukan khusus Wali Murid, Guru yang bukan penulis tidak mendapatkan notifikasi
          let isRoleTarget = false;
          if (targetRole === 'Semua') {
            isRoleTarget = true;
          } else if (targetRole === 'Wali Murid' && userRole === 'Wali Murid') {
            isRoleTarget = true;
          } else if (targetRole === 'Guru' && userRole === 'Guru') {
            isRoleTarget = true;
          } else if (item.authorId && item.authorId === userData?.uid) {
            isRoleTarget = true; // Penulis pengumuman selalu dapat melihat
          }

          if (!isRoleTarget) return;

          // 3. Pemeriksaan Kelas Sasaran (Target Class)
          // Jika ditujukan 'Semua' atau 'Semua Kelas', maka semua kelas sasaran mendapatkan notifikasi
          const isTargetAllClasses = 
            targetClassStr.toLowerCase() === 'semua' || 
            targetClassStr.toLowerCase() === 'semua kelas' ||
            targetClassesArr.some(c => c.toLowerCase() === 'semua' || c.toLowerCase() === 'semua kelas');

          if (isTargetAllClasses) {
            items.push(item);
            return;
          }

          // Jika sasaran adalah kelas tertentu, HANYA kelas sasaran tersebut yang menerima
          // Guru dan wali murid yang bukan sasaran TIDAK mendapat notifikasi!
          if (userClass) {
            const isMatch = isClassTargetMatching(targetClassesArr, userClass);
            if (isMatch || (item.authorId && item.authorId === userData?.uid)) {
              items.push(item);
            }
          } else if (item.authorId && item.authorId === userData?.uid) {
            items.push(item);
          }
        });

        setAnnouncements(items);
        setLoading(false);

        // Cache all announcements into IndexedDB for offline access
        saveOfflineAnnouncements(rawAll).catch((err) => console.warn('Cache announcements error:', err));

        // Notifikasi visual HP & suara jika ada pengumuman baru setelah load awal
        if (prevCountRef.current !== -1 && items.length > prevCountRef.current) {
          const newest = items[0];
          if (newest) {
            const authorText = newest.authorName ? `Dari ${newest.authorName}: ` : '';
            const previewText = newest.content.length > 100 ? newest.content.slice(0, 100) + '...' : newest.content;
            showDeviceNotification({
              title: `📢 ${newest.title}`,
              body: `${authorText}${previewText}`,
              url: '/?tab=pengumuman',
              tag: newest.id
            });
          } else if (soundEnabled) {
            playAnnouncementChime();
          }
        }
        prevCountRef.current = items.length;
      },
      (error) => {
        console.warn('Announcements notification listener error (offline fallback):', error);
        // Fallback to IndexedDB offline cache
        getOfflineAnnouncements({
          classId: studentClassId,
          role: userData?.role
        }).then((cached) => {
          if (cached && cached.length > 0) {
            setAnnouncements(cached as AnnouncementItem[]);
          }
          setLoading(false);
        });
      }
    );

    return () => unsubscribe();
  }, [userData?.role, userData?.assigned_class, userData?.studentClass, userData?.uid, studentClassId, soundEnabled]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save read state:', e);
      }
      return updated;
    });
  }, [storageKey]);

  const markAllAsRead = useCallback(() => {
    const allIds = announcements.map((a) => a.id);
    setReadIds(allIds);
    try {
      localStorage.setItem(storageKey, JSON.stringify(allIds));
    } catch (e) {
      console.warn('Failed to save all read state:', e);
    }
  }, [announcements, storageKey]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('announcement_sound_enabled', String(next));
      if (next) {
        playAnnouncementChime();
      }
      return next;
    });
  }, []);

  const unreadAnnouncements = announcements.filter((a) => !readIds.includes(a.id));
  const unreadCount = unreadAnnouncements.length;
  const latestUnread = unreadAnnouncements.length > 0 ? unreadAnnouncements[0] : null;

  return {
    announcements,
    unreadAnnouncements,
    unreadCount,
    latestUnread,
    readIds,
    loading,
    soundEnabled,
    markAsRead,
    markAllAsRead,
    toggleSound,
    isUnread: (id: string) => !readIds.includes(id),
  };
}
