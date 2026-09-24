/**
 * Offline IndexedDB Storage for CERDAS
 * Allows teachers, students, and parents to cache assignments, announcements, and submissions
 * so they can be viewed seamlessly even without an internet connection.
 */

const DB_NAME = 'cerdas_offline_db';
const DB_VERSION = 1;

export const STORES = {
  ASSIGNMENTS: 'offline_assignments',
  SUBMISSIONS: 'offline_submissions',
  ANNOUNCEMENTS: 'offline_announcements',
  META: 'offline_meta',
} as const;

export interface OfflineAssignment {
  id: string;
  title: string;
  subject: string;
  classId: string;
  dueDate: string;
  dueTime: string;
  description: string;
  maxScore: number;
  attachmentUrl?: string;
  attachmentName?: string;
  teacherId: string;
  teacherName: string;
  status: 'active' | 'closed' | 'archived';
  createdAt: string;
  cachedAt?: number;
}

export interface OfflineSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  classId: string;
  submittedAt: string;
  answerText?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  score?: number | null;
  feedback?: string;
  status: 'submitted' | 'graded' | 'revision';
  cachedAt?: number;
}

export interface OfflineAnnouncement {
  id: string;
  title: string;
  content: string;
  authorName?: string;
  authorRole?: string;
  authorId?: string;
  authorClass?: string;
  targetClass?: string;
  targetRole?: string;
  category?: string;
  priority?: 'Normal' | 'Penting' | string;
  date?: any;
  createdAt?: string;
  cachedAt?: number;
}

/**
 * Open or create IndexedDB database with object stores
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Assignments store
      if (!db.objectStoreNames.contains(STORES.ASSIGNMENTS)) {
        const store = db.createObjectStore(STORES.ASSIGNMENTS, { keyPath: 'id' });
        store.createIndex('classId', 'classId', { unique: false });
        store.createIndex('dueDate', 'dueDate', { unique: false });
      }

      // 2. Submissions store
      if (!db.objectStoreNames.contains(STORES.SUBMISSIONS)) {
        const store = db.createObjectStore(STORES.SUBMISSIONS, { keyPath: 'id' });
        store.createIndex('assignmentId', 'assignmentId', { unique: false });
        store.createIndex('studentId', 'studentId', { unique: false });
        store.createIndex('classId', 'classId', { unique: false });
      }

      // 3. Announcements store
      if (!db.objectStoreNames.contains(STORES.ANNOUNCEMENTS)) {
        const store = db.createObjectStore(STORES.ANNOUNCEMENTS, { keyPath: 'id' });
        store.createIndex('targetClass', 'targetClass', { unique: false });
        store.createIndex('targetRole', 'targetRole', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }

      // 4. Meta store
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

// ----------------------------------------------------
// Generic helper functions
// ----------------------------------------------------

async function putItems<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
  if (!items || items.length === 0) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const now = Date.now();

      items.forEach((item) => {
        // Sanitize object for IndexedDB (remove non-serializable properties like Firestore timestamps)
        const sanitized: any = { ...item, cachedAt: now };
        if (sanitized.date && typeof sanitized.date.toDate === 'function') {
          sanitized.date = sanitized.date.toDate().toISOString();
        }
        store.put(sanitized);
      });

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn(`IndexedDB putItems into ${storeName} error:`, err);
  }
}

async function getAllItems<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn(`IndexedDB getAllItems from ${storeName} error:`, err);
    return [];
  }
}

async function deleteItem(storeName: string, id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn(`IndexedDB deleteItem from ${storeName} error:`, err);
  }
}

// ----------------------------------------------------
// Public APIs for Assignments & Submissions
// ----------------------------------------------------

export async function saveOfflineAssignments(assignments: any[]): Promise<void> {
  await putItems(STORES.ASSIGNMENTS, assignments);
  await saveOfflineMeta('last_assignments_sync', {
    timestamp: Date.now(),
    count: assignments.length,
  });
}

export async function getOfflineAssignments(classId?: string): Promise<OfflineAssignment[]> {
  const all = await getAllItems<OfflineAssignment>(STORES.ASSIGNMENTS);
  if (!classId || classId === 'Semua' || classId === 'Semua Kelas') {
    return all;
  }
  return all.filter((a) => a.classId === classId);
}

export async function saveOfflineSubmissions(submissions: any[]): Promise<void> {
  await putItems(STORES.SUBMISSIONS, submissions);
}

export async function getOfflineSubmissions(classId?: string): Promise<OfflineSubmission[]> {
  const all = await getAllItems<OfflineSubmission>(STORES.SUBMISSIONS);
  if (!classId || classId === 'Semua') {
    return all;
  }
  return all.filter((s) => s.classId === classId);
}

// ----------------------------------------------------
// Public APIs for Announcements
// ----------------------------------------------------

export async function saveOfflineAnnouncements(announcements: any[]): Promise<void> {
  await putItems(STORES.ANNOUNCEMENTS, announcements);
  await saveOfflineMeta('last_announcements_sync', {
    timestamp: Date.now(),
    count: announcements.length,
  });
}

export async function getOfflineAnnouncements(options?: {
  classId?: string;
  role?: string;
}): Promise<OfflineAnnouncement[]> {
  const all = await getAllItems<OfflineAnnouncement>(STORES.ANNOUNCEMENTS);
  
  // Sort by date descending
  all.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  });

  if (!options) return all;

  return all.filter((item) => {
    const targetClass = item.targetClass || 'Semua Kelas';
    const targetRole = item.targetRole || 'Semua';

    if (options.role === 'Wali Murid') {
      const roleMatch = targetRole === 'Semua' || targetRole === 'Wali Murid';
      const classMatch =
        targetClass === 'Semua Kelas' ||
        !options.classId ||
        targetClass === options.classId ||
        targetClass.toLowerCase() === (options.classId || '').toLowerCase();
      return roleMatch && classMatch;
    }

    if (options.classId && options.classId !== 'Semua') {
      return targetClass === 'Semua Kelas' || targetClass === options.classId;
    }

    return true;
  });
}

export async function removeOfflineAnnouncement(id: string): Promise<void> {
  await deleteItem(STORES.ANNOUNCEMENTS, id);
}

export async function removeOfflineAssignment(id: string): Promise<void> {
  await deleteItem(STORES.ASSIGNMENTS, id);
}

// ----------------------------------------------------
// Meta & Sync Info
// ----------------------------------------------------

export async function saveOfflineMeta(key: string, data: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.META], 'readwrite');
      const store = tx.objectStore(STORES.META);
      store.put({ key, ...data });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('saveOfflineMeta error:', err);
  }
}

export async function getOfflineMeta(key: string): Promise<any> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.META], 'readonly');
      const store = tx.objectStore(STORES.META);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    return null;
  }
}

export async function clearAllOfflineData(): Promise<void> {
  try {
    const db = await openDB();
    const stores = [STORES.ASSIGNMENTS, STORES.SUBMISSIONS, STORES.ANNOUNCEMENTS, STORES.META];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach((s) => tx.objectStore(s).clear());
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('clearAllOfflineData error:', err);
  }
}
