import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { GraduationCap, Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth, UserData } from '../contexts/AuthContext';
import ClassSelectWithCustom from '../components/ClassSelectWithCustom';
import { CLASS_GROUPS, isClassMatch, normalizeClassName, sortStudentsAlphabetically } from '../lib/schoolClasses';

type RoleOption = 'Admin' | 'Guru' | 'Wali Murid';

const normalizeStudentName = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

export default function Login() {
  const [selectedRole, setSelectedRole] = useState<RoleOption>('Wali Murid');
  const [studentClass, setStudentClass] = useState<string>('Semua Kelas');
  const [registeredClasses, setRegisteredClasses] = useState<string[]>([]);
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

  useEffect(() => {
    let active = true;
    const loadRegisteredClasses = async () => {
      try {
        const snap = await getDocs(collection(db, 'students'));
        if (!active) return;
        const unique = new Set<string>();
        snap.forEach((d) => {
          const rawCls = d.data()?.classId;
          if (rawCls && typeof rawCls === 'string' && rawCls.trim()) {
            unique.add(normalizeClassName(rawCls));
          }
        });
        const sorted = Array.from(unique).sort((a, b) =>
          a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })
        );
        setRegisteredClasses(sorted);
      } catch (err) {
        console.warn('Could not preload classes for student login:', err);
      }
    };
    loadRegisteredClasses();
    return () => {
      active = false;
    };
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();

      if (trimmedPassword.length < 6) {
        setError('Kata sandi terlalu pendek. Gunakan minimal 6 karakter.');
        setLoading(false);
        return;
      }

      const commonBreachedPasswords = ['guru123', 'admin123', '123456', '12345678', 'password', 'qwerty', 'sekolah123'];
      if (commonBreachedPasswords.includes(trimmedPassword.toLowerCase())) {
        setError('Kata sandi tersebut sangat umum dan telah terdata bocor di Google. Harap gunakan kata sandi pribadi yang unik agar akun Anda aman dan peringatan Google hilang.');
        setLoading(false);
        return;
      }

      const email = trimmedUsername.includes('@') ? trimmedUsername : `${trimmedUsername.toLowerCase().replace(/\s+/g, '')}@miftahussalam.sch.id`;
      
      let userUid = '';

      // 1. Try Firebase Auth first
      try {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        userUid = userCredential.user.uid;
      } catch (authErr: any) {
        // If Email/Password is not enabled in Firebase Console (auth/operation-not-allowed)
        // or network issue, gracefully register directly to Firestore DB so user is never blocked
        if (authErr.code === 'auth/operation-not-allowed' || authErr.code === 'auth/network-request-failed') {
          console.warn("Firebase Auth Email/Password disabled or unavailable, registering to Firestore DB:", authErr.message);
          userUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        } else if (authErr.code === 'auth/email-already-in-use') {
          throw authErr;
        } else {
          console.warn("Firebase Auth error, falling back to Firestore user:", authErr);
          userUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }
      }
      
      // 2. Save profile to Firestore
      const userPayload = {
        name: registerName,
        username: trimmedUsername,
        role: selectedRole,
        assigned_class: selectedRole === 'Guru' ? registerClass : null,
        password: password, // For Firestore authentication fallback
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', userUid), userPayload);

      const newUserData: UserData = {
        uid: userUid,
        name: registerName,
        username: trimmedUsername,
        role: selectedRole,
        assigned_class: selectedRole === 'Guru' ? registerClass : undefined,
      };

      login(newUserData);

      if (selectedRole === 'Guru') navigate('/guru/dashboard');
      else if (selectedRole === 'Admin') navigate('/admin/dashboard');

    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Username / Email ini sudah terdaftar. Silakan langsung masuk.');
      } else {
        setError(`Gagal mendaftar: ${err.message || err}`);
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
        const email = trimmedUsername.includes('@') ? trimmedUsername : `${trimmedUsername.toLowerCase().replace(/\s+/g, '')}@miftahussalam.sch.id`;
        
        // 1. Try Firebase Auth
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          if (userCredential.user) {
            if (selectedRole === 'Admin') navigate('/admin/dashboard');
            else navigate('/guru/dashboard');
            return; 
          }
        } catch (authError: any) {
          console.warn("Firebase Auth signIn:", authError.code);
        }

        // 2. Check Firestore 'users' collection (supports custom/hybrid registered users)
        try {
          const usersRef = collection(db, 'users');
          const qUser = query(usersRef, where('role', '==', selectedRole));
          const userSnap = await getDocs(qUser);

          const matchingDoc = userSnap.docs.find(d => {
            const u = (d.data().username || '').trim().toLowerCase();
            return u === trimmedUsername.toLowerCase();
          });

          if (matchingDoc) {
            const data = matchingDoc.data();
            if (data.password === password) {
              login({
                uid: matchingDoc.id,
                name: data.name || data.username,
                username: data.username,
                role: data.role,
                assigned_class: data.assigned_class,
              });
              if (selectedRole === 'Admin') navigate('/admin/dashboard');
              else navigate('/guru/dashboard');
              return;
            } else {
              throw new Error('Kata sandi salah. Silakan periksa kembali.');
            }
          }
        } catch (dbErr: any) {
          if (dbErr.message && dbErr.message.includes('Kata sandi')) {
            throw dbErr;
          }
          console.warn("Firestore user check:", dbErr);
        }

        throw new Error('Username atau Kata Sandi salah.');

      } else if (selectedRole === 'Wali Murid') {
        const targetName = normalizeStudentName(trimmedUsername);
        const cleanPass = password.trim();
        const parsedPassNum = /^\d+$/.test(cleanPass) ? parseInt(cleanPass, 10) : NaN;

        if (!targetName) {
          setError('Masukkan nama asli siswa yang terdaftar di kelas.');
          return;
        }

        if (Number.isNaN(parsedPassNum) || parsedPassNum <= 0) {
          setError('Password harus berupa nomor urut absensi siswa (angka, contoh: 1, 2, 3).');
          return;
        }

        // Ambil data seluruh siswa agar urutan absensi abjad A-Z per kelas selalu akurat
        const studentsRef = collection(db, 'students');
        const studentSnap = await getDocs(studentsRef);
        const allStudents = studentSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        // Filter kandidat siswa berdasarkan nama asli (dan kelas jika dipilih)
        const nameMatches = allStudents.filter((s) => {
          const sameName = normalizeStudentName(String(s.name || '')) === targetName;
          if (!sameName) return false;
          if (studentClass !== 'Semua Kelas') {
            return isClassMatch(s.classId, studentClass);
          }
          return true;
        });

        if (nameMatches.length === 0) {
          setError(
            studentClass !== 'Semua Kelas'
              ? `Siswa dengan nama "${trimmedUsername}" tidak ditemukan di ${studentClass}. Pastikan ejaan nama asli sesuai daftar kelas.`
              : `Siswa dengan nama "${trimmedUsername}" tidak ditemukan. Pastikan ejaan nama asli sesuai daftar kelas.`
          );
          return;
        }

        // Verifikasi nomor urut absensi berdasarkan urutan abjad A-Z di kelas masing-masing
        const validMatches: Array<{ docData: any; alphabeticalAbsen: number }> = [];
        for (const candidate of nameMatches) {
          const classRoster = allStudents.filter((s) =>
            candidate.classId
              ? isClassMatch(s.classId, candidate.classId)
              : normalizeClassName(s.classId) === normalizeClassName(candidate.classId)
          );
          const sortedRoster = sortStudentsAlphabetically(classRoster);
          const idx = sortedRoster.findIndex((s) => s.id === candidate.id);
          const alphabeticalAbsen = idx >= 0 ? idx + 1 : parseInt(String(candidate.absen_number || '').trim(), 10);

          if (alphabeticalAbsen === parsedPassNum) {
            validMatches.push({ docData: candidate, alphabeticalAbsen });
          }
        }

        if (validMatches.length === 0) {
          setError('Password (nomor urut absensi) salah. Periksa kembali nomor urut absen sesuai abjad di kelasnya.');
          return;
        }

        if (validMatches.length > 1) {
          const classesFound = Array.from(
            new Set(validMatches.map((m) => normalizeClassName(m.docData.classId)))
          ).join(', ');
          setError(
            `Ditemukan lebih dari satu siswa dengan nama dan nomor absen yang sama (${classesFound}). Silakan pilih Kelas siswa terlebih dahulu.`
          );
          return;
        }

        const { docData, alphabeticalAbsen } = validMatches[0];
        const expectedAbsenStr = String(alphabeticalAbsen);
        if (String(docData.absen_number || '').trim() !== expectedAbsenStr) {
          try {
            await updateDoc(doc(db, 'students', docData.id), { absen_number: expectedAbsenStr });
          } catch (syncErr) {
            console.warn('Could not sync student absen_number on login:', syncErr);
          }
        }

        foundUser = {
          uid: docData.id,
          username: docData.name,
          name: `Wali Murid ${docData.name}`,
          role: 'Wali Murid',
          nisn: docData.nisn,
          absen_number: expectedAbsenStr,
          assigned_class: docData.classId,
        };

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
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
      >
        <div className="bg-indigo-900 p-8 text-center relative overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, rotate: -20, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6, type: "spring" }}
            className="w-20 h-20 bg-indigo-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner relative z-10"
          >
            <GraduationCap className="w-12 h-12 text-indigo-300" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-4xl font-extrabold text-white tracking-tight relative z-10"
          >
            CERDAS
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="text-indigo-200 mt-2 relative z-10 text-sm font-medium"
          >
            Catatan Edukasi, Rapor, & Data Administrasi Sekolah
          </motion.p>
        </div>
        
        <div className="p-8">
          <motion.h2 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="text-xl font-bold text-slate-800 mb-6"
          >
            {isRegistering ? 'Buat Akun Baru' : 'Masuk ke Akun Anda'}
          </motion.h2>
          
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
                    <ClassSelectWithCustom
                      label="Wali Kelas Untuk"
                      value={registerClass}
                      onChange={(val) => setRegisterClass(val)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-800 font-medium"
                    />
                  </div>
                )}
              </>
            )}

            {isRegistering && (
              <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex items-center gap-2">
                <span className="font-bold">Catatan:</span>
                <span>Akun {selectedRole} baru akan langsung tersinkronisasi ke sistem sekolah.</span>
              </div>
            )}

            {selectedRole === 'Wali Murid' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kelas Siswa
                </label>
                <select
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-800 font-medium cursor-pointer"
                >
                  <option value="Semua Kelas">Semua Kelas (Deteksi Otomatis)</option>
                  {registeredClasses.length > 0 ? (
                    registeredClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))
                  ) : (
                    CLASS_GROUPS.map((group) => (
                      <optgroup key={group.groupName} label={group.groupName}>
                        {group.classes.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  )}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {selectedRole === 'Wali Murid' ? 'Username (Nama Asli Siswa)' : 'Username / ID Pengguna'}
              </label>
              <input
                id="login-username-field"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-800 font-medium"
                placeholder={selectedRole === 'Wali Murid' ? "Nama lengkap siswa sesuai daftar kelas" : "Username akun"}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {selectedRole === 'Wali Murid' ? 'Password (No. Urut Absensi)' : 'Kata Sandi'}
              </label>
              <div className="relative">
                <input
                  id="login-password-field"
                  name={selectedRole === 'Wali Murid' ? "student_absen" : "user_secret"}
                  type={showPassword ? "text" : (selectedRole === 'Wali Murid' ? "text" : "password")}
                  inputMode={selectedRole === 'Wali Murid' ? "numeric" : "text"}
                  autoComplete={selectedRole === 'Wali Murid' ? "off" : (isRegistering ? "new-password" : "current-password")}
                  data-lpignore="true"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-800 font-medium"
                  placeholder={selectedRole === 'Wali Murid' ? "No. urut absen abjad di kelas (contoh: 1)" : "••••••••"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {isRegistering ? (
                <p className="text-xs text-slate-500 mt-2">
                  🔒 Gunakan kata sandi pribadi yang unik (minimal 6 karakter). Hindari kata sandi umum seperti <i>guru123</i> agar Google Chrome tidak memunculkan notifikasi pelanggaran sandi.
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-2">
                  {selectedRole === 'Wali Murid' 
                    ? '*Username menggunakan nama asli siswa & password menggunakan nomor urut absen sesuai abjad di kelasnya (1, 2, 3, ...)' 
                    : '*Gunakan kata sandi akun resmi yang telah didaftarkan'}
                </p>
              )}
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
      </motion.div>
    </div>
  );
}
