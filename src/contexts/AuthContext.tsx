import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
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
}

interface AuthContextType {
  userData: UserData | null;
  loading: boolean;
  login: (data: UserData) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  userData: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We listen to Firebase Auth state for Admin & Guru.
    // For "Wali Murid", we still keep a fallback since they might not be in Firebase Auth
    // (the prompt asks to migrate Admin/Guru to Firebase Auth, Wali Murid might just use simple NISN login, 
    // but we can support both).
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch extra profile data from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData({
              uid: firebaseUser.uid,
              name: data.name || '',
              username: data.username || '',
              role: data.role as UserRole,
              assigned_class: data.assigned_class,
            });
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        // Fallback to local storage session if not logged into Firebase Auth
        const storedUser = localStorage.getItem('sim_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed && parsed.role) {
              setUserData(parsed);
            } else {
              setUserData(null);
            }
          } catch (e) {
            setUserData(null);
          }
        } else {
          setUserData(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (data: UserData) => {
    setUserData(data);
    localStorage.setItem('sim_user', JSON.stringify(data));
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUserData(null);
    localStorage.removeItem('sim_user');
  };

  return (
    <AuthContext.Provider value={{ userData, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
