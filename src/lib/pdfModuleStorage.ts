// Utility to store and manage imported Reference Module PDF files in IndexedDB
// This allows PDF modules to persist across page reloads and multiple lesson plans,
// and be deleted anytime when no longer needed.

export interface StoredModuleRef {
  id: string;
  name: string;
  size: string;
  blob: Blob;
  summary?: string;
  mataPelajaran?: string;
  materi?: string;
  kelasSemester?: string;
  createdAt: string;
}

const DB_NAME = 'CerdaSMP_ModuleStorage';
const STORE_NAME = 'saved_reference_modules';
const ACTIVE_KEY = 'cerdasmp_active_module_id';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB tidak didukung pada peramban ini'));
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveModuleToStorage(
  file: File,
  meta?: { summary?: string; mataPelajaran?: string; materi?: string; kelasSemester?: string }
): Promise<StoredModuleRef> {
  const db = await openDB();
  const id = `modul_${Date.now()}`;
  const record: StoredModuleRef = {
    id,
    name: file.name,
    size: (file.size < 1024 * 1024) 
      ? `${(file.size / 1024).toFixed(1)} KB` 
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    blob: file,
    summary: meta?.summary || '',
    mataPelajaran: meta?.mataPelajaran || '',
    materi: meta?.materi || '',
    kelasSemester: meta?.kelasSemester || '',
    createdAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => {
      try {
        localStorage.setItem(ACTIVE_KEY, id);
      } catch (e) {
        console.warn('Could not set active module in localStorage:', e);
      }
      resolve(record);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateModuleMetaInStorage(
  id: string,
  meta: { summary?: string; mataPelajaran?: string; materi?: string; kelasSemester?: string }
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          if (meta.summary !== undefined) item.summary = meta.summary;
          if (meta.mataPelajaran !== undefined) item.mataPelajaran = meta.mataPelajaran;
          if (meta.materi !== undefined) item.materi = meta.materi;
          if (meta.kelasSemester !== undefined) item.kelasSemester = meta.kelasSemester;
          store.put(item);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn('Failed to update module meta:', err);
  }
}

export async function getActiveModuleFromStorage(): Promise<{
  id: string;
  file: File;
  name: string;
  size: string;
  summary?: string;
  mataPelajaran?: string;
  materi?: string;
  kelasSemester?: string;
  createdAt: string;
} | null> {
  try {
    const activeId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_KEY) : null;
    const db = await openDB();

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      if (activeId) {
        const req = store.get(activeId);
        req.onsuccess = () => {
          const res: StoredModuleRef = req.result;
          if (res && res.blob) {
            const file = new File([res.blob], res.name, { type: 'application/pdf' });
            resolve({
              id: res.id,
              file,
              name: res.name,
              size: res.size,
              summary: res.summary,
              mataPelajaran: res.mataPelajaran,
              materi: res.materi,
              kelasSemester: res.kelasSemester,
              createdAt: res.createdAt
            });
            return;
          }
          getNewest();
        };
        req.onerror = () => getNewest();
      } else {
        getNewest();
      }

      function getNewest() {
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          const list: StoredModuleRef[] = allReq.result || [];
          if (list.length > 0) {
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const newest = list[0];
            const file = new File([newest.blob], newest.name, { type: 'application/pdf' });
            try {
              localStorage.setItem(ACTIVE_KEY, newest.id);
            } catch {}
            resolve({
              id: newest.id,
              file,
              name: newest.name,
              size: newest.size,
              summary: newest.summary,
              mataPelajaran: newest.mataPelajaran,
              materi: newest.materi,
              kelasSemester: newest.kelasSemester,
              createdAt: newest.createdAt
            });
          } else {
            resolve(null);
          }
        };
        allReq.onerror = () => resolve(null);
      }
    });
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
    return null;
  }
}

export async function deleteModuleFromStorage(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => {
        try {
          const activeId = localStorage.getItem(ACTIVE_KEY);
          if (activeId === id) {
            localStorage.removeItem(ACTIVE_KEY);
          }
        } catch {}
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error deleting from IndexedDB:', err);
  }
}

export async function clearAllModulesFromStorage(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => {
        try {
          localStorage.removeItem(ACTIVE_KEY);
        } catch {}
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error clearing IndexedDB:', err);
  }
}
