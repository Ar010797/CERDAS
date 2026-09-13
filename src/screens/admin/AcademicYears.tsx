import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Save, School, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AcademicYears() {
  const [settings, setSettings] = useState({
    namaSekolah: '',
    namaKepalaSekolah: '',
    nipKepalaSekolah: '',
    academicYear: '2026/2027',
    semester: 'Ganjil',
    kkmGlobal: '75'
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'pengaturan_sekolah', 'utama');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'pengaturan_sekolah', 'utama'), settings, { merge: true });
      showToast('Pengaturan Sekolah berhasil disimpan!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Gagal menyimpan pengaturan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan Sekolah & Tahun Ajaran</h1>
        <p className="text-sm text-slate-500 mt-1">Konfigurasi data institusi yang akan tercetak pada laporan dan rapor.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
            <School className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Form Identitas Instansi</h2>
            <p className="text-xs text-slate-500">Perbarui data utama sekolah di bawah ini.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">Nama Sekolah</label>
              <input
                type="text"
                required
                value={settings.namaSekolah}
                onChange={(e) => setSettings({...settings, namaSekolah: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                placeholder="Misal: SD Negeri 1 Kotayasa"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Nama Kepala Sekolah</label>
              <input
                type="text"
                required
                value={settings.namaKepalaSekolah}
                onChange={(e) => setSettings({...settings, namaKepalaSekolah: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                placeholder="Nama Lengkap & Gelar"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">NIP Kepala Sekolah</label>
              <input
                type="text"
                value={settings.nipKepalaSekolah}
                onChange={(e) => setSettings({...settings, nipKepalaSekolah: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                placeholder="Kosongkan jika tidak ada"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Tahun Ajaran Aktif</label>
              <input
                type="text"
                required
                value={settings.academicYear}
                onChange={(e) => setSettings({...settings, academicYear: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                placeholder="Misal: 2026/2027"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Semester</label>
              <select
                value={settings.semester}
                onChange={(e) => setSettings({...settings, semester: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">KKM Global (Default)</label>
              <input
                type="number"
                required
                value={settings.kkmGlobal}
                onChange={(e) => setSettings({...settings, kkmGlobal: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                placeholder="Misal: 75"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl transition-all font-bold text-sm shadow-sm disabled:opacity-50"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Toast Notification */}
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
