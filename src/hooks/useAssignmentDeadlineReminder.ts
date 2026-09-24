import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getOfflineAssignments } from '../lib/offlineStorage';

export interface AssignmentDeadlineAlert {
  id: string; // `${assignmentId}_${hoursLeft}h`
  assignmentId: string;
  title: string;
  subject: string;
  classId: string;
  dueDate: string;
  dueTime: string;
  teacherName: string;
  dueDateTime: Date;
  diffMinutes: number; // minutes left until deadline
  diffHours: number; // rounded hours left
  timeFormatted: string; // e.g. "12:00 WIB" atau "2 jam lagi"
  urgency: 'critical' | 'warning' | 'reminder'; // < 3 jam = critical, < 12 jam = warning, < 24 jam = reminder
  isSimulated?: boolean;
}

export interface AssignmentItem {
  id: string;
  title: string;
  subject: string;
  classId: string;
  dueDate: string;
  dueTime: string;
  teacherName?: string;
  status: 'active' | 'closed' | string;
}

export interface SubmissionItem {
  id: string;
  assignmentId: string;
  studentId: string;
  status?: string;
}

/**
 * Memutar nada dering alert audio synthesizer untuk tenggat waktu tugas
 */
export function playDeadlineChime(urgency: 'critical' | 'warning' | 'reminder' = 'warning') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    if (urgency === 'critical') {
      // 2 nada cepat bernada tinggi (peringatan darurat < 3 jam)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, now + 0.15); // D6
      gain2.gain.setValueAtTime(0.25, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.55);
    } else {
      // 2 nada lembut (C5 -> G5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.12); // G5
      gain2.gain.setValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);
    }
  } catch (e) {
    console.warn('Deadline chime audio error:', e);
  }
}

/**
 * Meminta izin Web Notification browser
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    return await Notification.requestPermission();
  } catch (e) {
    console.warn('requestPermission error:', e);
    return Notification.permission;
  }
}

/**
 * Menampilkan Browser Notification API untuk pengingat tenggat tugas
 */
export function sendBrowserDeadlineNotification(alert: AssignmentDeadlineAlert) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const hours = alert.diffHours;
  const minutes = alert.diffMinutes;
  let timeStr = `${hours} jam lagi`;
  if (minutes < 60) {
    timeStr = `${minutes} menit lagi!`;
  }

  const title = alert.urgency === 'critical'
    ? `⚠️ Segera Kumpulkan: ${alert.title}`
    : `⏰ Pengingat Tugas: ${alert.title}`;

  const body = `Mata Pelajaran: ${alert.subject}\nBatas Waktu: ${alert.dueDate} pukul ${alert.dueTime} (${timeStr}). Segera selesaikan dan kirim lembar jawaban Anda!`;

  try {
    // 1. Coba lewat Service Worker jika ada
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: `assignment-deadline-${alert.assignmentId}`,
          data: {
            url: '/assignments'
          }
        });
      }).catch(() => {
        // Fallback standard Notification
        showStandardNotification(title, body);
      });
    } else {
      showStandardNotification(title, body);
    }
  } catch (e) {
    console.warn('Browser deadline notification error:', e);
  }
}

function showStandardNotification(title: string, body: string) {
  try {
    const notif = new Notification(title, {
      body,
      icon: '/icon.svg',
      tag: `assignment-deadline-${Date.now()}`
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
      window.location.href = '/assignments';
    };
  } catch {}
}

/**
 * Hook useAssignmentDeadlineReminder:
 * Memantau tugas aktif dan memeriksa apakah batas waktu pengumpulan sudah dekat (misal: <= 24 jam).
 * Jika siswa belum mengumpulkan tugas tersebut, akan membunyikan audio chime dan memicu
 * Web Notification API pada browser pengguna.
 */
export function useAssignmentDeadlineReminder(customClassId?: string) {
  const { userData } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<Record<string, boolean>>({});
  const [activeAlerts, setActiveAlerts] = useState<AssignmentDeadlineAlert[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('cerdas_dismissed_deadline_alerts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('cerdas_deadline_reminder_sound');
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const [simulatedAlert, setSimulatedAlert] = useState<AssignmentDeadlineAlert | null>(null);
  const alertedKeysRef = useRef<Set<string>>(new Set());

  // Tentukan target kelas
  const targetClass = customClassId || (
    userData?.role === 'Wali Murid' ? (userData?.studentClass || userData?.assigned_class || 'Kelas 1') :
    userData?.role === 'Guru' ? (userData?.assigned_class || 'Kelas 1') :
    undefined
  );

  // Student identifier (untuk memfilter apakah siswa ini sudah mengumpulkan tugas atau belum)
  const currentStudentId = userData?.studentId || (userData?.role === 'Wali Murid' ? userData?.uid : null);

  // Toggle Sound
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cerdas_deadline_reminder_sound', JSON.stringify(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  }, []);

  // Request browser permission
  const requestPermission = useCallback(async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotificationPermission(perm);
    return perm;
  }, []);

  // 1. Ambil daftar tugas aktif untuk kelas ini (Firestore + Offline IndexedDB fallback)
  useEffect(() => {
    if (!targetClass) return;

    // Load offline cached assignments first
    getOfflineAssignments(targetClass).then((cached) => {
      if (cached && cached.length > 0) {
        setAssignments(cached.filter(a => a.status === 'active'));
      }
    });

    const q = query(
      collection(db, 'tugas'),
      where('classId', '==', targetClass),
      where('status', '==', 'active')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentItem));
        setAssignments(list);
      },
      (err) => {
        console.warn('Assignments listener for deadline reminder (fallback to cached):', err);
      }
    );

    return () => unsub();
  }, [targetClass]);

  // 2. Pantau riwayat pengumpulan tugas siswa ini
  useEffect(() => {
    if (!targetClass || !currentStudentId) return;

    const q = query(
      collection(db, 'pengumpulan_tugas'),
      where('classId', '==', targetClass),
      where('studentId', '==', currentStudentId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const map: Record<string, boolean> = {};
        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.assignmentId) {
            map[data.assignmentId] = true;
          }
        });
        setUserSubmissions(map);
      },
      (err) => {
        console.warn('Submissions listener for deadline reminder:', err);
      }
    );

    return () => unsub();
  }, [targetClass, currentStudentId]);

  // 3. Periksa tenggat waktu tugas secara berkala (setiap 30 detik)
  const checkDeadlines = useCallback(() => {
    const now = new Date();
    const alerts: AssignmentDeadlineAlert[] = [];

    // Jika ada simulasi testing
    if (simulatedAlert) {
      alerts.push(simulatedAlert);
    }

    for (const assignment of assignments) {
      // Jika siswa sudah mengumpulkan tugas ini, jangan beri peringatan
      if (currentStudentId && userSubmissions[assignment.id]) {
        continue;
      }

      if (!assignment.dueDate) continue;

      // Parse batas waktu: YYYY-MM-DD + HH:mm
      const timeStr = assignment.dueTime || '23:59';
      const deadlineDate = new Date(`${assignment.dueDate}T${timeStr}`);
      if (isNaN(deadlineDate.getTime())) continue;

      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.ceil(diffMinutes / 60);

      // Peringatan aktif jika batas waktu dalam 24 jam ke depan dan belum lewat
      // (1 menit <= diffMinutes <= 24 * 60 menit)
      if (diffMinutes > 0 && diffMinutes <= 24 * 60) {
        let urgency: 'critical' | 'warning' | 'reminder' = 'reminder';
        if (diffMinutes <= 3 * 60) {
          urgency = 'critical'; // Kurang dari 3 jam (Sangat Mendesak)
        } else if (diffMinutes <= 12 * 60) {
          urgency = 'warning'; // Kurang dari 12 jam
        }

        let timeFormatted = `${diffHours} Jam Lagi`;
        if (diffMinutes < 60) {
          timeFormatted = `${diffMinutes} Menit Lagi`;
        }

        alerts.push({
          id: `${assignment.id}_due_${urgency}`,
          assignmentId: assignment.id,
          title: assignment.title,
          subject: assignment.subject,
          classId: assignment.classId,
          dueDate: assignment.dueDate,
          dueTime: timeStr,
          teacherName: assignment.teacherName || 'Guru Mata Pelajaran',
          dueDateTime: deadlineDate,
          diffMinutes,
          diffHours,
          timeFormatted,
          urgency
        });
      }
    }

    // Urutkan alert dari yang paling mendesak (sisa menit terkecil)
    alerts.sort((a, b) => a.diffMinutes - b.diffMinutes);

    // Filter yang sudah di-dismiss user
    const unDismissed = alerts.filter(a => !dismissedAlertIds.includes(a.id));
    setActiveAlerts(unDismissed);

    // Picu browser notification dan audio chime untuk alert baru
    for (const alert of unDismissed) {
      if (!alertedKeysRef.current.has(alert.id)) {
        alertedKeysRef.current.add(alert.id);

        // Bunyikan chime
        if (soundEnabled) {
          playDeadlineChime(alert.urgency);
        }

        // Tampilkan Browser Notification
        sendBrowserDeadlineNotification(alert);
      }
    }
  }, [assignments, userSubmissions, currentStudentId, dismissedAlertIds, soundEnabled, simulatedAlert]);

  useEffect(() => {
    checkDeadlines();
    const timer = setInterval(checkDeadlines, 25000); // Periksa setiap 25 detik
    return () => clearInterval(timer);
  }, [checkDeadlines]);

  // Tutup / Dismiss sebuah notifikasi peringatan
  const dismissAlert = useCallback((alertId: string) => {
    setDismissedAlertIds(prev => {
      const next = [...prev, alertId];
      try {
        localStorage.setItem('cerdas_dismissed_deadline_alerts', JSON.stringify(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });

    if (simulatedAlert && simulatedAlert.id === alertId) {
      setSimulatedAlert(null);
    }
  }, [simulatedAlert]);

  // Tombol simulasi pengetesan (misal untuk menguji suara & notifikasi browser langsung 2 jam sebelum deadline)
  const triggerSimulation = useCallback((minutes = 115) => {
    const now = new Date();
    const simulatedDeadline = new Date(now.getTime() + minutes * 60 * 1000);
    const dueTime = `${String(simulatedDeadline.getHours()).padStart(2, '0')}:${String(simulatedDeadline.getMinutes()).padStart(2, '0')}`;
    const dueDate = `${simulatedDeadline.getFullYear()}-${String(simulatedDeadline.getMonth() + 1).padStart(2, '0')}-${String(simulatedDeadline.getDate()).padStart(2, '0')}`;

    const diffHours = Math.ceil(minutes / 60);
    const simAlert: AssignmentDeadlineAlert = {
      id: `sim_assignment_${Date.now()}`,
      assignmentId: `sim_assign_1`,
      title: 'Tugas Matematika: Latihan Bangun Ruang',
      subject: 'Matematika',
      classId: targetClass || 'Kelas 1',
      dueDate: dueDate,
      dueTime: dueTime,
      teacherName: 'Ustadzah Siti Rahma, S.Pd',
      dueDateTime: simulatedDeadline,
      diffMinutes: minutes,
      diffHours,
      timeFormatted: minutes < 60 ? `${minutes} Menit Lagi` : `${diffHours} Jam Lagi`,
      urgency: minutes <= 180 ? 'critical' : 'warning',
      isSimulated: true
    };

    setSimulatedAlert(simAlert);
    if (soundEnabled) {
      playDeadlineChime(simAlert.urgency);
    }
    sendBrowserDeadlineNotification(simAlert);
  }, [targetClass, soundEnabled]);

  return {
    activeAlerts,
    dismissAlert,
    soundEnabled,
    toggleSound,
    notificationPermission,
    requestPermission,
    triggerSimulation,
    checkDeadlines
  };
}
