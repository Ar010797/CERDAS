import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GraduationCap, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth, UserData } from '../contexts/AuthContext';

type RoleOption = 'Admin' | 'Guru' | 'Wali Murid';

export default function Login() {
  const [selectedRole, setSelectedRole] = useState<RoleOption>('Wali Murid');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let foundUser: UserData | null = null;

      if (selectedRole === 'Admin' || selectedRole === 'Guru') {
        const usersRef = collection(db, 'users');
        const qUser = query(usersRef, where('username', '==', username), where('password', '==', password), where('role', '==', selectedRole));
        const userSnap = await getDocs(qUser);

        if (!userSnap.empty) {
          const docData = userSnap.docs[0].data();
          foundUser = {
            uid: userSnap.docs[0].id,
            username: docData.username,
            name: docData.name,
            role: docData.role,
            assigned_class: docData.assigned_class,
          };
        } else {
          // Dummy seeding fallback
          if (selectedRole === 'Admin' && username === 'admin' && password === 'admin123') {
            foundUser = { uid: 'admin_dummy', username: 'admin', name: 'Admin Sekolah', role: 'Admin' };
            await setDoc(doc(db, 'users', 'admin_dummy'), { ...foundUser, password: 'admin123' });
          } else if (selectedRole === 'Guru' && username === 'Guru' && password === 'guru123') {
            foundUser = { uid: 'guru_dummy', username: 'Guru', name: 'Bapak Guru', role: 'Guru', assigned_class: 'Kelas 1' };
            await setDoc(doc(db, 'users', 'guru_dummy'), { ...foundUser, password: 'guru123' });
          }
        }
      } else if (selectedRole === 'Wali Murid') {
        const studentsRef = collection(db, 'students');
        const qStudent = query(studentsRef, where('name', '==', username), where('absen_number', '==', password));
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
          // Dummy seeding fallback
          if (username === 'Budi' && password === '01') {
            await setDoc(doc(db, 'students', 'student_dummy'), { nisn: '123456', absen_number: '01', name: 'Budi', gender: 'L', classId: 'Kelas 1' });
            foundUser = { uid: 'student_dummy', username: 'Budi', name: 'Wali Murid Budi', role: 'Wali Murid', nisn: '123456', absen_number: '01', assigned_class: 'Kelas 1' };
          }
        }
      }

      if (foundUser) {
        login(foundUser);
        if (foundUser.role === 'Admin') navigate('/admin/dashboard');
        else if (foundUser.role === 'Guru') navigate('/guru/dashboard');
        else if (foundUser.role === 'Wali Murid') navigate('/walimurid/dashboard');
      } else {
        setError('Akses ditolak: Username atau Password salah.');
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
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Masuk ke Akun Anda</h2>
          
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

          <form onSubmit={handleLogin} className="space-y-5">
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
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Masuk Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
