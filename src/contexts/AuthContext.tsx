import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export type UserRole = 'Admin' | 'Guru' | 'Wali Murid' | null;

export interface UserData {
  uid: string;
  name: string;
  username: string;
  role: UserRole;
  assigned_class?: string;
  academicYear?: string;
  nisn?: string;
  absen_number?: string;
  schoolName?: string;
  sekolah?: string;
  studentId?: string;
  studentName?: string;
  studentClass?: string;
}

interface AuthContextType {
  userData: UserData | null;
  loading: boolean;
  login: (data: UserData) => void;
  logout: () => void;
}

const getStoredUser = (): UserData | null => {
  try {
    const stored = localStorage.getItem('sim_user');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && parsed.role) {
      return parsed as UserData;
    }
    return null;
  } catch (e) {
    console.warn("Storage access warning:", e);
    return null;
  }
};

const setStoredUser = (data: UserData | null) => {
  try {
    if (data) {
      localStorage.setItem('sim_user', JSON.stringify(data));
    } else {
      localStorage.removeItem('sim_user');
    }
  } catch (e) {
    console.warn("Storage write warning:", e);
  }
};

const AuthContext = createContext<AuthContextType>({
  userData: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronous immediate initialization from storage prevents blank screen on reload
  const [userData, setUserData] = useState<UserData | null>(() => getStoredUser());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: If Firebase Auth takes longer than 2 seconds (slow 3G/firewall), unblock UI
    const timer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 2000);

    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!isMounted) return;

        if (firebaseUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists() && isMounted) {
              const data = userDoc.data();
              const profile: UserData = {
                uid: firebaseUser.uid,
                name: data.name || '',
                username: data.username || '',
                role: data.role as UserRole,
                assigned_class: data.assigned_class,
              };
              setUserData(profile);
              setStoredUser(profile);
            }
          } catch (error) {
            console.warn("Error fetching user profile from Firestore:", error);
          }
        } else {
          // If no active Firebase Auth session, check if we have a valid stored profile
          const cached = getStoredUser();
          if (cached && isMounted) {
            setUserData(cached);
          } else if (isMounted) {
            setUserData(null);
            setStoredUser(null);
          }
        }

        if (isMounted) {
          setLoading(false);
          clearTimeout(timer);
        }
      });
    } catch (authInitErr) {
      console.warn("onAuthStateChanged initialization error:", authInitErr);
      if (isMounted) {
        setLoading(false);
        clearTimeout(timer);
      }
    }

    return () => {
      isMounted = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const login = (data: UserData) => {
    setUserData(data);
    setStoredUser(data);
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.warn("Logout error:", error);
    }
    setUserData(null);
    setStoredUser(null);
  };

  // If loading and no cached user, show a lightweight, styled splash loader instead of null
  if (loading && !userData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-base tracking-wide">CERDAS</span>
        </div>
        <p className="text-xs text-slate-400 mt-1 font-medium">Memuat sistem sekolah...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ userData, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
