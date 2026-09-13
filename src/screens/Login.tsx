import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { GraduationCap, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth, UserData } from '../contexts/AuthContext';

type RoleOption = 'Admin' | 'Guru' | 'Wali Murid';

const CLASSES_LIST = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Kelas 7', 'Kelas 8', 'Kelas 9'];

export default function Login() {
  const [selectedRole, setSelectedRole] = useState<RoleOption>('Wali Murid');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Registration States
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerClass, setRegisterClass] = useState('Kelas 1');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const trimmedUsername = username.trim();
      const email = trimmedUsername.includes('@') ? trimmedUsername : `${trimmedUsername.toLowerCase().replace(/\s+/g, '')}@miftahussalam.sch.id`;
      
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Save profile to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: registerName,
        username: trimmedUsername,
        role: selectedRole,
        assigned_class: selectedRole === 'Guru' ? registerClass : null
      });

      if (selectedRole === 'Guru') navigate('/guru/dashboard');
      else if (selectedRole === 'Admin') navigate('/admin/dashboard');

    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Username ini sudah terdaftar. Silakan login.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Gagal: Fitur Login "Email/Password" belum diaktifkan di Firebase Console Anda.');
      } else {
        setError(`Gagal mendaftar: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let foundUser: UserData | null = null;
      const trimmedUsername = username.trim();

      if (selectedRole === 'Admin' || selectedRole === 'Guru') {
        // Use Firebase Auth for Admin and Guru
        // Format username to a valid email to work with Firebase Auth (e.g., admin -> admin@miftahussalam.sch.id)
        const email = trimmedUsername.includes('@') ? trimmedUsername : `${trimmedUsername.toLowerCase().replace(/\s+/g, '')}@miftahussalam.sch.id`;
        
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          if (selectedRole === 'Admin') navigate('/admin/dashboard');
          else navigate('/guru/dashboard');
          return; 
        } catch (authError: any) {
          // If the error is 'operation-not-allowed', the user hasn't enabled Email/Password in Firebase Console.
          // To prevent them from being completely blocked in this preview, we will fallback to local mock login.
          if (authError.code === 'auth/operation-not-allowed' || (authError.message && authError.message.includes('operation-not-allowed'))) {
            // Check if they are using demo credentials
            if (selectedRole === 'Admin' && trimmedUsername.toLowerCase() === 'admin' && password === 'admin123') {
              login({ uid: 'admin_mock', username: 'admin', name: 'Admin Sekolah (Mock)', role: 'Admin' });
              navigate('/admin/dashboard');
              return;
            } else if (selectedRole === 'Guru' && trimmedUsername.toLowerCase() === 'guru' && password === 'guru123') {
              login({ uid: 'guru_mock', username: 'Guru', name: 'Bapak Guru (Mock)', role: 'Guru', assigned_class: 'Kelas 1' });
              navigate('/guru/dashboard');
              return;
            }
            throw new Error('Metode Email/Password belum diaktifkan di Firebase Console. Untuk menguji, gunakan kredensial demo (admin/admin123).');
          }

          // Auto-seed for demo credentials if they don't exist in Firebase Auth yet
          if (selectedRole === 'Admin' && trimmedUsername.toLowerCase() === 'admin' && password === 'admin123') {
            try {
              const { createUserWithEmailAndPassword } = await import('firebase/auth');
              const userCred = await createUserWithEmailAndPassword(auth, email, password);
              await setDoc(doc(db, 'users', userCred.user.uid), {
                name: 'Admin Sekolah',
                username: 'admin',
                role: 'Admin',
                password: 'admin123'
              });
              navigate('/admin/dashboard');
              return;
            } catch (e: any) {
              console.error("Auto-seed error admin:", e);
              if (e.code === 'auth/operation-not-allowed') {
                login({ uid: 'admin_mock', username: 'admin', name: 'Admin Sekolah (Mock)', role: 'Admin' });
                navigate('/admin/dashboard');
                return;
              }
            }
          } else if (selectedRole === 'Guru' && trimmedUsername.toLowerCase() === 'guru' && password === 'guru123') {
            try {
              const { createUserWithEmailAndPassword } = await import('firebase/auth');
              const userCred = await createUserWithEmailAndPassword(auth, email, password);
              await setDoc(doc(db, 'users', userCred.user.uid), {
                name: 'Bapak Guru',
                username: 'Guru',
                role: 'Guru',
                assigned_class: 'Kelas 1',
                password: 'guru123'
              });
              navigate('/guru/dashboard');
              return;
            } catch (e: any) {
              console.error("Auto-seed error guru:", e);
              if (e.code === 'auth/operation-not-allowed') {
                login({ uid: 'guru_mock', username: 'Guru', name: 'Bapak Guru (Mock)', role: 'Guru', assigned_class: 'Kelas 1' });
                navigate('/guru/dashboard');
                return;
              }
            }
          }
          
          if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password') {
            throw new Error('Username atau Password salah.');
          } else {
            throw new Error(`Gagal Login: ${authError.message}`);
          }
        }

      } else if (selectedRole === 'Wali Murid') {
        // Simple Student Login logic (Wali Murid uses Name & Absen Number)
        const studentsRef = collection(db, 'students');
        const qStudent = query(studentsRef, where('name', '==', trimmedUsername), where('absen_number', '==', password));
        const studentSnap = await getDocs(qStudent);

        if (!studentSnap.empty) {
          const docData = studentSnap.docs[0].data();
          foundUser = {
            uid: studentSnap.docs[0].id,
            username: docData.name,
            name: `Wali Murid ${docData.name}`,
            role: 'Wali Murid',
            nisn: docData.nisn,
            absen_number: docData.absen_number,
            assigned_class: docData.classId,
          };
        } else {
          setError('Data siswa tidak ditemukan.');
          return;
        }

        if (foundUser) {
          login(foundUser);
          navigate('/walimurid/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Gagal login. Periksa koneksi Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-indigo-900 p-8 text-center">
          <div className="w-20 h-20 bg-indigo-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <GraduationCap className="w-12 h-12 text-indigo-300" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SI Miftahussalam</h1>
          <p className="text-indigo-200 mt-2">Sistem Administrasi Sekolah</p>
        </div>
        
        <div className="p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">
            {isRegistering ? 'Buat Akun Baru' : 'Masuk ke Akun Anda'}
          </h2>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            {(['Wali Murid', 'Guru', 'Admin'] as RoleOption[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setSelectedRole(role);
                  setError('');
                  if (role === 'Wali Murid') setIsRegistering(false); // Students cannot self-register here
                }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  selectedRole === role 
                    ? 'bg-white text-indigo-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          {(selectedRole === 'Guru' || selectedRole === 'Admin') && (
             <div className="flex justify-end mb-4">
                <button
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {isRegistering ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
                </button>
             </div>
          )}

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-5">
            {isRegistering && (
              <>
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nama Lengkap</label>
                  <input
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    placeholder="Contoh: Budi Santoso, S.Pd"
                  />
                </div>
                
                {selectedRole === 'Guru' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Wali Kelas Untuk</label>
                    <select
                      value={registerClass}
                      onChange={(e) => setRegisterClass(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-800 font-medium"
                    >
                      {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {selectedRole === 'Wali Murid' ? 'Nama Siswa' : 'Username'}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                placeholder={selectedRole === 'Wali Murid' ? "Contoh: Budi" : (selectedRole === 'Admin' ? "admin" : "Guru")}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {selectedRole === 'Wali Murid' ? 'Nomor Absen Siswa (Password)' : 'Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2 italic">
                {selectedRole === 'Wali Murid' 
                  ? '*Gunakan kredensial demo: Budi / 01' 
                  : (selectedRole === 'Admin' 
                      ? '*Gunakan kredensial demo: admin / admin123'
                      : '*Gunakan kredensial demo: Guru / guru123')}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-md shadow-indigo-200 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? 'Daftar Akun Baru' : 'Masuk Dashboard')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
