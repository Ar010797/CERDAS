import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export const logActivity = async (guruName: string, className: string, activity: string) => {
  try {
    await addDoc(collection(db, 'log_aktivitas'), {
      guruName,
      className,
      activity,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Gagal mencatat log aktivitas:", error);
  }
};
