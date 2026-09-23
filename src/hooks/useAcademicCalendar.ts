import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CalendarEvent, DEFAULT_ACADEMIC_EVENTS, CalendarCategory, isDateInRange } from '../types/calendar';

export function useAcademicCalendar(selectedClassFilter: string = 'Semua Kelas') {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [scheduleExams, setScheduleExams] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Listen to dedicated academic calendar events
  useEffect(() => {
    setLoading(true);
    const unsubCalendar = onSnapshot(
      collection(db, 'kalender_akademik'),
      (snapshot) => {
        const items: CalendarEvent[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: docSnap.id,
            title: data.title || '',
            category: data.category || 'kegiatan',
            startDate: data.startDate || '',
            endDate: data.endDate || data.startDate || '',
            description: data.description || '',
            targetClass: data.targetClass || 'Semua Kelas',
            isHoliday: Boolean(data.isHoliday),
            color: data.color || '',
            time: data.time || '',
            ruangan: data.ruangan || '',
            pengajar: data.pengajar || '',
            source: data.source || 'manual',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt || ''
          });
        });

        // Sort by startDate ascending
        items.sort((a, b) => a.startDate.localeCompare(b.startDate));
        setEvents(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching kalender_akademik:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    // 2. Also listen to jadwal_kelas where type === 'ujian' so exams created in Schedules screen are automatically highlighted!
    const unsubSchedules = onSnapshot(
      collection(db, 'jadwal_kelas'),
      (snapshot) => {
        const exams: CalendarEvent[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.type === 'ujian' && d.hari) {
            // Check if hari is a date format YYYY-MM-DD
            const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(d.hari);
            if (isIsoDate) {
              exams.push({
                id: `schedule_exam_${docSnap.id}`,
                title: `Ujian ${d.mataPelajaran || 'Mata Pelajaran'} (${d.classId})`,
                category: 'ujian',
                startDate: d.hari,
                endDate: d.hari,
                description: d.keterangan || `Ujian ${d.mataPelajaran} untuk ${d.classId}`,
                targetClass: d.classId || 'Semua Kelas',
                isHoliday: false,
                time: d.jam || '',
                ruangan: d.ruangan || '',
                pengajar: d.pengajar || '',
                source: 'jadwal_ujian'
              });
            }
          }
        });
        setScheduleExams(exams);
      },
      (err) => {
        console.warn('Error fetching jadwal_kelas for calendar:', err);
      }
    );

    return () => {
      unsubCalendar();
      unsubSchedules();
    };
  }, []);

  // Combined events: Academic Calendar + Class Exam Schedules
  const allEvents = useMemo(() => {
    const combined = [...events, ...scheduleExams];
    // Filter by class if specific class selected
    if (selectedClassFilter && selectedClassFilter !== 'Semua Kelas') {
      return combined.filter(
        (e) => !e.targetClass || e.targetClass === 'Semua Kelas' || e.targetClass === selectedClassFilter
      );
    }
    return combined;
  }, [events, scheduleExams, selectedClassFilter]);

  // Seed default 2026/2027 academic calendar into Firestore if user desires
  const seedDefaultEvents = async (creatorName: string = 'Admin'): Promise<number> => {
    try {
      const batch = writeBatch(db);
      let count = 0;
      const nowIso = new Date().toISOString();

      DEFAULT_ACADEMIC_EVENTS.forEach((item) => {
        // Check if an event with the exact title and date already exists
        const exists = events.some(
          (e) => e.title.toLowerCase() === item.title.toLowerCase() && e.startDate === item.startDate
        );
        if (!exists) {
          const docRef = doc(collection(db, 'kalender_akademik'));
          batch.set(docRef, {
            ...item,
            createdBy: creatorName,
            createdAt: nowIso
          });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
      }
      return count;
    } catch (err: any) {
      console.error('Gagal memuat template kalender:', err);
      throw err;
    }
  };

  // Add new event
  const addEvent = async (eventData: Omit<CalendarEvent, 'id'>) => {
    const docRef = await addDoc(collection(db, 'kalender_akademik'), {
      ...eventData,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  };

  // Update existing event
  const updateEvent = async (id: string, eventData: Partial<CalendarEvent>) => {
    const docRef = doc(db, 'kalender_akademik', id);
    await updateDoc(docRef, { ...eventData });
  };

  // Delete event
  const deleteEvent = async (id: string) => {
    const docRef = doc(db, 'kalender_akademik', id);
    await deleteDoc(docRef);
  };

  // Helper to get events for a specific day string 'YYYY-MM-DD'
  const getEventsForDay = (dateStr: string) => {
    return allEvents.filter((event) => isDateInRange(dateStr, event.startDate, event.endDate));
  };

  // Upcoming events within next N days from today
  const getUpcomingEvents = (daysAhead: number = 30) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);
    const futureStr = futureDate.toISOString().split('T')[0];

    return allEvents
      .filter((e) => e.endDate >= todayStr && e.startDate <= futureStr)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  };

  return {
    events: allEvents,
    rawAcademicEvents: events,
    scheduleExams,
    loading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
    seedDefaultEvents,
    getEventsForDay,
    getUpcomingEvents
  };
}
