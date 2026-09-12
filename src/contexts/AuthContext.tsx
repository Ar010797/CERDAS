import React, { createContext, useContext, useEffect, useState } from 'react';

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
    // Custom auth logic using localStorage instead of Firebase Auth
    const storedUser = localStorage.getItem('sim_user');
    if (storedUser) {
      try {
        setUserData(JSON.parse(storedUser));
      } catch (e) {
        console.error(e);
      }
    }
    setLoading(false);
  }, []);

  const login = (data: UserData) => {
    setUserData(data);
    localStorage.setItem('sim_user', JSON.stringify(data));
  };

  const logout = () => {
    setUserData(null);
    localStorage.removeItem('sim_user');
  };

  return (
    <AuthContext.Provider value={{ userData, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
