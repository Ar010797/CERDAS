import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Save,
  School,
  CheckCircle,
  AlertTriangle,
  PenTool,
  BookOpen,
  Bell,
  Plus,
  Trash2,
  Smartphone,
  Info
} from 'lucide-react';
import DigitalSignatureUpload from '../../components/DigitalSignatureUpload';
import { sendTestPushNotification } from '../../lib/pushNotification';

const DEFAULT_MAPEL_KKM: Record<string, number> = {
  'Pendidikan Agama dan Budi Pekerti': 75,
  'Pendidikan Pancasila dan Kewarganegaraan': 75,
  'Bahasa Indonesia': 75,
  'Matematika': 70,
  'Ilmu Pengetahuan Alam (IPA)': 75,
  'Ilmu Pengetahuan Sosial (IPS)': 75,
  'Bahasa Inggris': 70,
  'Seni Budaya dan Prakarya': 75,
  'Pendidikan Jasmani, Olahraga, dan Kesehatan': 75,
  'Informatika / TIK': 75,
  'Bahasa Daerah / Muatan Lokal': 75
};

export default function AcademicYears() {
  const [settings, setSettings] = useState({
    namaSekolah: 'SD / MTs CERDAS Kotayasa',
    namaKepalaSekolah: '',
    nipKepalaSekolah: '',
    alamatSekolah: 'Jl. Raya Pendidikan No. 1, Kotayasa, Banyumas',
    nomorTelepon: '(0281) 684210',
    emailSekolah: 'admin@sekolah.sch.id',
    academicYear: '2026/2027',
    semester: 'Ganjil',
    kkmGlobal: '75',
    tandaTanganKepalaSekolah: '',
    stempelSekolah: '',
    oneSignalAppId: '',
    oneSignalRestKey: ''
  });

  const [kkmMap, setKkmMap] = useState<Record<string, number>>(DEFAULT_MAPEL_KKM);
  const [newMapelName, setNewMapelName] = useState('');
  const [newMapelKkm, setNewMapelKkm] = useState(75);

  const [activeTab, setActiveTab] = useState<'identitas' | 'ttd' | 'kkm' | 'notif'>('identitas');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);
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
          const data = docSnap.data();
          setSettings((prev) => ({ ...prev, ...data }));
          if (data.kkmMap && typeof data.kkmMap === 'object') {
            setKkmMap({ ...DEFAULT_MAPEL_KKM, ...data.kkmMap });
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const dataToSave = {
        ...settings,
        kkmMap,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'pengaturan_sekolah', 'utama'), dataToSave, { merge: true });

      // Sinkronkan ke settings/school untuk modul ajar/RPP
      await setDoc(
        doc(db, 'settings', 'school'),
        {
          schoolName: settings.namaSekolah,
          namaSekolah: settings.namaSekolah,
          kepalaSekolah: settings.namaKepalaSekolah,
          nipKepalaSekolah: settings.nipKepalaSekolah,
          tandaTanganKepalaSekolah: settings.tandaTanganKepalaSekolah,
          stempelSekolah: settings.stempelSekolah
        },
        { merge: true }
      );

      showToast('Pengaturan Sekolah & Tanda Tangan berhasil disimpan!', 'success');
    } catch (error: any) {
      console.error(error);
      showToast('Gagal menyimpan pengaturan: ' + (error.message || 'Kesalahan sistem'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Simpan tanda tangan digital khusus
  const handleSaveSignature = async (sigBase64: string | null) => {
    try {
      const updated = { ...settings, tandaTanganKepalaSekolah: sigBase64 || '' };
      setSettings(updated);
      await setDoc(
        doc(db, 'pengaturan_sekolah', 'utama'),
        { tandaTanganKepalaSekolah: sigBase64 || '' },
        { merge: true }
      );
      await setDoc(
        doc(db, 'settings', 'school'),
        { tandaTanganKepalaSekolah: sigBase64 || '' },
        { merge: true }
      );
      showToast(
        sigBase64
          ? 'Tanda tangan digital Kepala Sekolah berhasil disimpan & diaktifkan!'
          : 'Tanda tangan digital dihapus.',
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan tanda tangan digital.', 'error');
    }
  };

  // Simpan stempel sekolah khusus
  const handleSaveStamp = async (stampBase64: string | null) => {
    try {
      const updated = { ...settings, stempelSekolah: stampBase64 || '' };
      setSettings(updated);
      await setDoc(
        doc(db, 'pengaturan_sekolah', 'utama'),
        { stempelSekolah: stampBase64 || '' },
        { merge: true }
      );
      await setDoc(
        doc(db, 'settings', 'school'),
        { stempelSekolah: stampBase64 || '' },
        { merge: true }
      );
      showToast(
        stampBase64
          ? 'Stempel resmi sekolah berhasil disimpan & diaktifkan!'
          : 'Stempel resmi dihapus.',
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan stempel resmi.', 'error');
    }
  };

  // KKM per mapel handlers
  const handleAddMapelKkm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMapelName.trim()) return;
    setKkmMap((prev) => ({
      ...prev,
      [newMapelName.trim()]: Number(newMapelKkm) || 75
    }));
    setNewMapelName('');
    setNewMapelKkm(75);
    showToast(`Mata pelajaran ${newMapelName} ditambahkan dengan KKM ${newMapelKkm}`);
  };

  const handleRemoveMapelKkm = (subj: string) => {
    setKkmMap((prev) => {
      const copy = { ...prev };
      delete copy[subj];
      return copy;
    });
    showToast(`Mata pelajaran ${subj} dihapus dari daftar KKM.`);
  };

  const handleUpdateKkmValue = (subj: string, val: number) => {
    setKkmMap((prev) => ({
      ...prev,
      [subj]: val
    }));
  };

  // Test Notification
  const handleTestNotification = async () => {
    setTestingNotif(true);
    try {
      await sendTestPushNotification({
        name: settings.namaKepalaSekolah || 'Admin Sekolah',
        role: 'Admin'
      });
      showToast('Tes notifikasi dikirim! Periksa layar atas perangkat Anda.', 'success');
    } catch (err: any) {
      showToast('Gagal memicu tes notifikasi: ' + err.message, 'error');
    } finally {
      setTestingNotif(false);
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Pengaturan Administrasi Sekolah & Tanda Tangan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Konfigurasi identitas lembaga, tanda tangan digital otomatis, KKM per mapel, dan notifikasi Median.
          </p>
        </div>

        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-2xl font-bold text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('identitas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'identitas'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <School className="w-4 h-4" />
          <span>1. Identitas & Kop Surat</span>
        </button>

        <button
          onClick={() => setActiveTab('ttd')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'ttd'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>2. Tanda Tangan & Stempel Otomatis</span>
          {settings.tandaTanganKepalaSekolah && (
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('kkm')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'kkm'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>3. KKM per Mata Pelajaran</span>
        </button>

        <button
          onClick={() => setActiveTab('notif')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'notif'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>4. Notifikasi Mengambang Layar HP</span>
        </button>
      </div>

      {/* TAB 1: IDENTITAS SATUAN PENDIDIKAN & KOP SURAT */}
      {activeTab === 'identitas' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              Data Institusi & Pejabat Penandatangan
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Data ini menjadi kop surat dan identitas resmi pada Rapor, Rekap Absensi, RPP, dan Surat Pengumuman.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Satuan Pendidikan / Sekolah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={settings.namaSekolah}
                  onChange={(e) => setSettings({ ...settings, namaSekolah: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Misal: SD / MTs CERDAS Kotayasa"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Kepala Sekolah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={settings.namaKepalaSekolah}
                  onChange={(e) => setSettings({ ...settings, namaKepalaSekolah: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nama Lengkap & Gelar (misal: H. Ahmad Fauzi, M.Pd.)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  NIP Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={settings.nipKepalaSekolah}
                  onChange={(e) => setSettings({ ...settings, nipKepalaSekolah: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nomor Induk Pegawai (atau kosongkan jika non-PNS)"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Alamat Lengkap Sekolah (Untuk Kop Surat Dokumen)
                </label>
                <input
                  type="text"
                  value={settings.alamatSekolah}
                  onChange={(e) => setSettings({ ...settings, alamatSekolah: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Misal: Jl. Raya Kotayasa No. 12, Kec. Sumbang, Kab. Banyumas"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nomor Telepon / WhatsApp Sekolah
                </label>
                <input
                  type="text"
                  value={settings.nomorTelepon}
                  onChange={(e) => setSettings({ ...settings, nomorTelepon: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Misal: (0281) 684210"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Resmi Sekolah
                </label>
                <input
                  type="email"
                  value={settings.emailSekolah}
                  onChange={(e) => setSettings({ ...settings, emailSekolah: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Misal: info@cerdas.sch.id"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tahun Ajaran Aktif <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={settings.academicYear}
                  onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Misal: 2026/2027"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Semester Aktif
                </label>
                <select
                  value={settings.semester}
                  onChange={(e) => setSettings({ ...settings, semester: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Ganjil">Semester 1 (Ganjil)</option>
                  <option value="Genap">Semester 2 (Genap)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Simpan Identitas Lembaga</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: TANDA TANGAN DIGITAL & STEMPEL RESMI */}
      {activeTab === 'ttd' && (
        <div className="space-y-6">
          <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
            <span className="text-xl">✍️</span>
            <div>
              <p className="font-bold mb-0.5">Pembubuhan Otomatis Berfungsi Penuh</p>
              <p>
                Tanda tangan digital dan stempel resmi yang Anda simpan di sini akan <b>otomatis dibubuhkan</b> pada seluruh dokumen administrasi yang dihasilkan sistem CERDAS: <b>Rapor Siswa, Rekap Presensi Harian, Modul Ajar/RPP, dan Surat Pengumuman Resmi PDF</b>.
              </p>
            </div>
          </div>

          <DigitalSignatureUpload
            signatureUrl={settings.tandaTanganKepalaSekolah}
            stampUrl={settings.stempelSekolah}
            principalName={settings.namaKepalaSekolah || 'Kepala Sekolah'}
            principalNip={settings.nipKepalaSekolah || '-'}
            schoolName={settings.namaSekolah || 'Satuan Pendidikan'}
            onSaveSignature={handleSaveSignature}
            onSaveStamp={handleSaveStamp}
          />
        </div>
      )}

      {/* TAB 3: KKM PER MATA PELAJARAN (BEDA-BEDA KKM) */}
      {activeTab === 'kkm' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              Standar KKM per Mata Pelajaran (Kriteria Ketuntasan Minimal)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Setiap mata pelajaran dapat memiliki target KKM yang berbeda sesuai karakteristik kompetensi dan materi ajar. KKM ini menjadi acuan hitung ketuntasan dan predikat nilai (A, B, C, D) di rapor.
            </p>
          </div>

          {/* KKM Global Default */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 max-w-md">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              KKM Global (Nilai Default Cadangan)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={50}
                max={100}
                value={settings.kkmGlobal}
                onChange={(e) => setSettings({ ...settings, kkmGlobal: e.target.value })}
                className="w-28 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white text-center focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Digunakan jika suatu mata pelajaran baru belum ditentukan KKM khususnya.
              </span>
            </div>
          </div>

          {/* Form Tambah / Modifikasi Mapel */}
          <form onSubmit={handleAddMapelKkm} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Nama mata pelajaran baru (misal: Bahasa Arab)..."
              value={newMapelName}
              onChange={(e) => setNewMapelName(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl">
                <span className="text-xs text-slate-500 font-bold">KKM:</span>
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={newMapelKkm}
                  onChange={(e) => setNewMapelKkm(Number(e.target.value))}
                  className="w-14 text-center text-xs font-bold bg-transparent outline-none text-slate-800 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={!newMapelName.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Mapel</span>
              </button>
            </div>
          </form>

          {/* Daftar KKM Mapel Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">No</th>
                  <th className="px-4 py-3">Mata Pelajaran</th>
                  <th className="px-4 py-3 w-36 text-center">Target KKM (Minimal)</th>
                  <th className="px-4 py-3 w-40 text-center">Status Ketuntasan</th>
                  <th className="px-4 py-3 w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {Object.entries(kkmMap).map(([subj, kkmVal], idx) => (
                  <tr key={subj} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                      {subj}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
                        <input
                          type="number"
                          min={50}
                          max={100}
                          value={kkmVal}
                          onChange={(e) => handleUpdateKkmValue(subj, Number(e.target.value))}
                          className="w-12 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 outline-none bg-transparent"
                        />
                        <span className="text-[10px] text-slate-400">/ 100</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        ≥ {kkmVal} Tuntas
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveMapelKkm(subj)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Mapel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan KKM per Mapel</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: PENGATURAN NOTIFIKASI MENGAMBANG MEDIAN & HP */}
      {activeTab === 'notif' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              Pengaturan Notifikasi Mengambang Layar HP (Median.co / OneSignal)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Agar notifikasi pengumuman muncul mengambang (heads-up banner) di layar HP pengguna meskipun aplikasi sedang ditutup.
            </p>
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl text-xs text-emerald-900 dark:text-emerald-300 flex items-start gap-3">
            <Smartphone className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Dukungan Aplikasi Median.co (APK Android & iOS)</p>
              <p>
                Sistem CERDAS telah terintegrasi dengan OneSignal Push Bridge bawaan Median.co. Ketika Admin atau Guru mempublikasikan pengumuman, sistem secara otomatis mengirimkan sinyal berprioritas tinggi (<b>Priority 10 / Max Heads-Up</b>) sehingga HP pengguna langsung bergetar, bersuara, dan menampilkan pop-up mengambang di bilah atas layar.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                OneSignal App ID (dari dasbor Median / OneSignal)
              </label>
              <input
                type="text"
                value={settings.oneSignalAppId}
                onChange={(e) => setSettings({ ...settings, oneSignalAppId: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Contoh: b39497e2-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Ditemukan di OneSignal Dashboard &gt; Settings &gt; Keys &amp; IDs.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                OneSignal REST API Key
              </label>
              <input
                type="password"
                value={settings.oneSignalRestKey}
                onChange={(e) => setSettings({ ...settings, oneSignalRestKey: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Contoh: os_v2_app_xxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Digunakan oleh server untuk memicu notifikasi jarak jauh tanpa batas perangkat.
              </p>
            </div>
          </div>

          {/* Tombol Aksi & Tes */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testingNotif}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm w-full sm:w-auto justify-center"
            >
              {testingNotif ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              <span>Tes Notifikasi Mengambang di HP Ini</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer w-full sm:w-auto justify-center"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Kredensial Notifikasi</span>
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div
            className={`flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl text-white ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
