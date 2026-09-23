import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  authorName?: string;
  authorRole?: 'Admin' | 'Guru' | string;
  authorId?: string;
  authorClass?: string;
  targetClass?: string; // 'Semua Kelas' | 'Kelas 1' | ...
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

  // Subscribe to announcements collection
  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: AnnouncementItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const targetClass = data.targetClass || 'Semua Kelas';
          const targetRole = data.targetRole || 'Semua';

          // For Wali Murid role, filter relevant announcements
          if (userData?.role === 'Wali Murid') {
            // Role filter: targetRole must be 'Semua' or 'Wali Murid'
            const roleMatch = targetRole === 'Semua' || targetRole === 'Wali Murid';
            // Class filter: either target is 'Semua Kelas', or matches student class
            const currentClass = studentClassId || '';
            const classMatch =
              targetClass === 'Semua Kelas' ||
              !currentClass ||
              targetClass === currentClass ||
              targetClass.toLowerCase() === currentClass.toLowerCase();

            if (roleMatch && classMatch) {
              items.push({ id: docSnap.id, ...data } as AnnouncementItem);
            }
          } else {
            // Admin and Guru see all or their relevant scope
            items.push({ id: docSnap.id, ...data } as AnnouncementItem);
          }
        });

        setAnnouncements(items);
        setLoading(false);

        // Play chime if new announcement arrived after initial load
        if (prevCountRef.current !== -1 && items.length > prevCountRef.current) {
          if (soundEnabled) {
            playAnnouncementChime();
          }
        }
        prevCountRef.current = items.length;
      },
      (error) => {
        console.warn('Announcements notification listener error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userData?.role, studentClassId, soundEnabled]);

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
