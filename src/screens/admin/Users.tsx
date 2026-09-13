import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Users, Plus, Edit2, Trash2, Shield, User, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: 'Admin' | 'Guru';
  assigned_class?: string;
}

const CLASSES_LIST = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Kelas 7', 'Kelas 8', 'Kelas 9'];

export default function UsersAdmin() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'Guru' as 'Admin' | 'Guru',
    assigned_class: 'Kelas 1'
  });
  const [saving, setSaving] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserData)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openModal = (user?: UserData) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        username: user.username,
        password: user.password || '',
        role: user.role,
        assigned_class: user.assigned_class || 'Kelas 1'
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        username: '',
        password: '',
        role: 'Guru',
        assigned_class: 'Kelas 1'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSave: any = {
        name: formData.name,
        username: formData.username,
        role: formData.role
      };
      if (formData.role === 'Guru') {
        dataToSave.assigned_class = formData.assigned_class;
      } else {
        dataToSave.assigned_class = null; // Admin doesn't need a specific class
      }

      if (editingUser) {
        if (formData.password) dataToSave.password = formData.password;
        await updateDoc(doc(db, 'users', editingUser.id), dataToSave);
        showToast('Pengguna berhasil diperbarui!', 'success');
      } else {
        const { createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
        const { adminAuth } = await import('../../lib/firebase');
        const email = formData.username.includes('@') ? formData.username : `${formData.username.toLowerCase().replace(/\s+/g, '')}@miftahussalam.sch.id`;
        const userCredential = await createUserWithEmailAndPassword(adminAuth, email, formData.password);
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          ...dataToSave,
          password: formData.password
        });
        await signOut(adminAuth);
        showToast('Pengguna baru berhasil ditambahkan!', 'success');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error(error);
      showToast(`Gagal menyimpan: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (userId: string) => {
    const user = users.find(u => (u as any).id === userId || u.uid === userId);
    if (user) {
      setUserToDelete(user);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', (userToDelete as any).id || userToDelete.uid));
      showToast('Pengguna dihapus.', 'success');
      setUserToDelete(null);
    } catch (error) {
      console.error(error);
      showToast('Gagal menghapus pengguna.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Pengguna</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola akses akun Admin dan Guru Wali Kelas.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all font-bold text-sm shadow-sm shadow-indigo-200"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-3">
           <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
             <Users className="w-5 h-5" />
           </div>
           <h2 className="text-lg font-bold text-slate-800">Daftar Akun Sistem</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-sm text-slate-500">
                <th className="px-6 py-4 font-medium">Informasi Pengguna</th>
                <th className="px-6 py-4 font-medium">Peran / Hak Akses</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Memuat pengguna...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    Belum ada data pengguna.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${user.role === 'Admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                           {user.role === 'Admin' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{user.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Username: {user.username} {user.password && <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">• Password: {user.password}</span>}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'Admin' ? (
                        <span className="inline-flex items-center space-x-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold border border-indigo-100">
                          <span>Administrator</span>
                        </span>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-100">
                            <span>Wali Kelas</span>
                          </span>
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"/>{user.assigned_class}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openModal(user)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        title="Edit Akun"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Hapus Akun"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Hapus Pengguna */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Hapus Akun Pengguna?</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun <strong>{userToDelete.name}</strong>? Akses sistem untuk pengguna ini akan dicabut secara permanen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{isDeleting ? 'Menghapus...' : 'Lanjut Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">
                {editingUser ? 'Edit Pengguna' : 'Tambah Pengguna'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                  placeholder="Nama Lengkap"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Username</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                    placeholder="Username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                  <input
                    type="text"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                    placeholder={editingUser ? "(Abaikan jika tidak diubah)" : "Password"}
                  />
                  {editingUser && (
                    <p className="text-xs text-amber-600 mt-2 leading-tight">
                      *Catatan: Mengubah password di sini hanya memperbarui catatan di database. Karena batasan keamanan Firebase Client, password asli di Firebase Auth tidak akan berubah. Harap hapus dan buat ulang akun jika guru lupa password.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Peran (Role)</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-indigo-700"
                >
                  <option value="Guru">Guru / Wali Kelas</option>
                  <option value="Admin">Administrator</option>
                </select>
              </div>

              {formData.role === 'Guru' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Wali Kelas Untuk</label>
                  <select
                    value={formData.assigned_class}
                    onChange={(e) => setFormData({...formData, assigned_class: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                  >
                    {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-colors font-bold text-sm shadow-sm disabled:opacity-50"
                >
                  <span>{saving ? 'Menyimpan...' : 'Simpan Akun'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
