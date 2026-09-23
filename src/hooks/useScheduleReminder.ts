import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface UpcomingScheduleAlert {
  id: string;
  classId: string;
  hari: string;
  jam: string;
  mataPelajaran: string;
  pengajar: string;
  ruangan?: string;
  keterangan?: string;
  type?: 'pelajaran' | 'ujian';
  minutesUntilStart: number;
  startsAt: string; // e.g. "07:30"
  status: 'starting_soon' | 'just_started';
  isSimulated?: boolean;
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function parseScheduleTime(jamStr: string): { startMinutes: number; endMinutes: number; startTimeFormatted: string } | null {
  if (!jamStr) return null;
  const normalized = jamStr.replace(/(\d{1,2})\.(\d{2})/g, '$1:$2');
  const parts = normalized.split('-');
  const startPart = parts[0].trim();
  const endPart = parts[1]?.trim();

  const startMatch = startPart.match(/(\d{1,2}):(\d{2})/);
  if (!startMatch) return null;

  const startHour = parseInt(startMatch[1], 10);
  const startMin = parseInt(startMatch[2], 10);
  const startMinutes = startHour * 60 + startMin;
  const startTimeFormatted = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

  let endMinutes = startMinutes + 60;
  if (endPart) {
    const endMatch = endPart.match(/(\d{1,2}):(\d{2})/);
    if (endMatch) {
      endMinutes = parseInt(endMatch[1], 10) * 60 + parseInt(endMatch[2], 10);
    }
  }

  return { startMinutes, endMinutes, startTimeFormatted };
}

export function playScheduleChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    
    // Bell Chime 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Bell Chime 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.18); // A5
    gain2.gain.setValueAtTime(0.15, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.8);

    // Bell Chime 3
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1046.5, now + 0.36); // C6
    gain3.gain.setValueAtTime(0.18, now + 0.36);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.36);
    osc3.stop(now + 1.1);
  } catch (e) {
    console.warn("Audio chime play error:", e);
  }
}

export function useScheduleReminder(customClassId?: string) {
  const { userData } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [upcomingAlerts, setUpcomingAlerts] = useState<UpcomingScheduleAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('schedule_reminder_sound');
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });
  const [simulatedAlert, setSimulatedAlert] = useState<UpcomingScheduleAlert | null>(null);
  const alertedIdsRef = useRef<Set<string>>(new Set());

  // Determine which class to filter by
  const targetClass = customClassId || (
    userData?.role === 'Guru' ? userData?.assigned_class :
    userData?.role === 'Wali Murid' ? (userData?.assigned_class || 'Kelas 1') :
    undefined // Admin can monitor all or assigned
  );

  // Toggle Sound Setting
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('schedule_reminder_sound', JSON.stringify(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  }, []);

  // Fetch Schedules from Firestore
  useEffect(() => {
    let q = query(collection(db, 'jadwal_kelas'));
    if (targetClass && targetClass !== 'Semua Kelas') {
      q = query(collection(db, 'jadwal_kelas'), where('classId', '==', targetClass));
    }

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(items);
    }, (error) => {
      console.warn("Error fetching schedules for reminder:", error);
    });

    return () => unsub();
  }, [targetClass]);

  // Request browser notification permission once if supported
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // Check schedules every 10 seconds against current time
  const checkUpcomingSchedules = useCallback(() => {
    const now = new Date();
    const currentDayName = DAY_NAMES[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const alerts: UpcomingScheduleAlert[] = [];

    // Check simulated alert first if active
    if (simulatedAlert) {
      alerts.push(simulatedAlert);
    }

    for (const item of schedules) {
      // Must match today's day (e.g. 'Senin', 'Selasa') or test
      const itemDay = (item.hari || '').trim();
      const isToday = itemDay.toLowerCase() === currentDayName.toLowerCase();
      if (!isToday) continue;

      const parsed = parseScheduleTime(item.jam);
      if (!parsed) continue;

      const diff = parsed.startMinutes - currentMinutes;

      // Condition: Begins within the next 15 minutes! (1 <= diff <= 15)
      if (diff > 0 && diff <= 15) {
        alerts.push({
          id: item.id,
          classId: item.classId || targetClass || 'Kelas',
          hari: item.hari,
          jam: item.jam,
          mataPelajaran: item.mataPelajaran || 'Pelajaran',
          pengajar: item.pengajar || 'Guru Mata Pelajaran',
          ruangan: item.ruangan,
          keterangan: item.keterangan,
          type: item.type || 'pelajaran',
          minutesUntilStart: diff,
          startsAt: parsed.startTimeFormatted,
          status: 'starting_soon'
        });
      }
    }

    // Filter out dismissed items
    const activeAlerts = alerts.filter(a => !dismissedIds.includes(a.id));
    setUpcomingAlerts(activeAlerts);

    // Play chime and send browser notification for newly detected upcoming schedules
    for (const alert of activeAlerts) {
      if (!alertedIdsRef.current.has(alert.id)) {
        alertedIdsRef.current.add(alert.id);
        
        if (soundEnabled) {
          playScheduleChime();
        }

        // Browser notification if in background
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`🔔 Jadwal Dimulai dalam ${alert.minutesUntilStart} Menit!`, {
              body: `${alert.mataPelajaran} (${alert.classId}) akan dimulai pukul ${alert.startsAt} WIB. Pengajar: ${alert.pengajar}`,
              icon: '/favicon.ico'
            });
          } catch {
            // Ignore error in some sandbox environments
          }
        }
      }
    }
  }, [schedules, targetClass, dismissedIds, soundEnabled, simulatedAlert]);

  useEffect(() => {
    checkUpcomingSchedules();
    const interval = setInterval(checkUpcomingSchedules, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [checkUpcomingSchedules]);

  // Dismiss an alert
  const dismissAlert = useCallback((id: string) => {
    setDismissedIds(prev => [...prev, id]);
    if (simulatedAlert && simulatedAlert.id === id) {
      setSimulatedAlert(null);
    }
  }, [simulatedAlert]);

  // Trigger a realistic 15-minute simulation for testing anytime
  const triggerSimulation = useCallback((minutes = 12) => {
    const now = new Date();
    const currentDayName = DAY_NAMES[now.getDay()];
    const startHour = Math.floor((now.getHours() * 60 + now.getMinutes() + minutes) / 60) % 24;
    const startMin = (now.getMinutes() + minutes) % 60;
    const endMin = (startMin + 45) % 60;
    const endHour = Math.floor((startHour * 60 + startMin + 45) / 60) % 24;

    const timeStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
    const startTimeFormatted = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

    const simItem: UpcomingScheduleAlert = {
      id: 'simulated-alert-' + Date.now(),
      classId: targetClass || 'Kelas 1',
      hari: currentDayName,
      jam: timeStr,
      mataPelajaran: 'Matematika & Berhitung Ceria',
      pengajar: userData?.name || 'Ustadz / Ustadzah',
      ruangan: 'Ruang Kelas 1A',
      keterangan: 'Materi Bab 3: Penjumlahan & Pengurangan Cepat. Siapkan buku pegangan dan alat tulis.',
      type: 'pelajaran',
      minutesUntilStart: minutes,
      startsAt: startTimeFormatted,
      status: 'starting_soon',
      isSimulated: true
    };

    setSimulatedAlert(simItem);
    if (soundEnabled) {
      playScheduleChime();
    }
  }, [targetClass, userData, soundEnabled]);

  const clearSimulation = useCallback(() => {
    setSimulatedAlert(null);
  }, []);

  return {
    upcomingAlerts,
    dismissAlert,
    soundEnabled,
    toggleSound,
    triggerSimulation,
    clearSimulation,
    playChime: playScheduleChime
  };
}
