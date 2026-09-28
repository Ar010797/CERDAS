import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import config from '../../firebase-applet-config.json';

const firebaseConfig = {
  projectId: config.projectId,
  appId: config.appId,
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  measurementId: config.measurementId,
};

// Initialize or reuse main Firebase App safely
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore with offline persistent cache so schedules, assignments & data are available offline
const firestoreDatabaseId = config.firestoreDatabaseId;

let resolvedDb: Firestore;
try {
  if (firestoreDatabaseId) {
    resolvedDb = initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      },
      firestoreDatabaseId
    );
  } else {
    resolvedDb = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  }
} catch {
  // If already initialized or fallback
  resolvedDb = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
}

export const db: Firestore = resolvedDb;

export const auth: Auth = getAuth(app);
export const storage = getStorage(app);

// Safe secondary app instance for Admin to create users without signing themselves out
let resolvedAdminAuth: Auth | null = null;
try {
  const existingAdmin = getApps().find(a => a.name === 'AdminApp');
  const adminApp = existingAdmin || initializeApp(firebaseConfig, 'AdminApp');
  resolvedAdminAuth = getAuth(adminApp);
} catch (e) {
  console.warn("Secondary AdminApp initialization fallback:", e);
}

export const adminAuth: Auth = resolvedAdminAuth || auth;

