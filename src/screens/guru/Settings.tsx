import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Building, AlertTriangle, Plus, Trash2, Save, Users, CheckCircle, PenTool } from 'lucide-react';
import DigitalSignatureUpload from '../../components/DigitalSignatureUpload';

export default function SettingsGuru() {
  const { userData, login } = useAuth();
  const assignedClass = userData?.assigned_class || 'Kelas 1';
  const isAdmin = userData?.role === 'Admin';

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // --- Assigned Class State ---
  const [kelasName, setKelasName] = useState(assignedClass);
  const [waliName, setWaliName] = useState(userData?.name || '');
  const [tahunAjaran, setTahunAjaran] = useState(userData?.academicYear || '2026/2027 - Ganjil');
  const [savingKelas, setSavingKelas] = useState(false);

  // --- Kop Surat State ---
  const [schoolSettings, setSchoolSettings] = useState({
    namaSekolah: '',
    namaKepalaSekolah: '',
    nipKepalaSekolah: '',
    tandaTanganKepalaSekolah: '',
    stempelSekolah: ''
  });
  const [savingKop, setSavingKop] = useState(false);

  // --- Mata Pelajaran & KKM per Mapel State ---
  const [subjects, setSubjects] = useState<string[]>([]);
  const [kkmMap, setKkmMap] = useState<Record<string, number>>({});
  const [newSubject, setNewSubject] = useState('');
  const [newSubjectKkm, setNewSubjectKkm] = useState(75);
  const [savingSubjects, setSavingSubjects] = useState(false);

  useEffect(() => {
    // Realtime listener for School Settings
    const unsubSchool = onSnapshot(doc(db, 'pengaturan_sekolah', 'utama'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSchoolSettings({
          namaSekolah: data.namaSekolah || data.schoolName || '',
          namaKepalaSekolah: data.namaKepalaSekolah || data.kepalaSekolah || '',
          nipKepalaSekolah: data.nipKepalaSekolah || '',
          tandaTanganKepalaSekolah: data.tandaTanganKepalaSekolah || '',
          stempelSekolah: data.stempelSekolah || ''
        });
      }
    });

    // Realtime listener for Subjects & KKM
    const unsubSubjects = onSnapshot(doc(db, 'mata_pelajaran', assignedClass), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSubjects(data.subjects || []);
        setKkmMap(data.kkmMap || {});
      } else {
        setSubjects([]);
        setKkmMap({});
      }
    });

    return () => {
      unsubSchool();
      unsubSubjects();
    };
  }, [assignedClass]);

  const handleSaveKelas = async () => {
    if (!kelasName.trim() || !waliName.trim() || !userData?.uid) return;
    setSavingKelas(true);
    try {
      await updateDoc(doc(db, 'users', userData.uid), { 
        assigned_class: kelasName,
        name: waliName,
        academicYear: tahunAjaran
      });
      login({ 
        ...userData, 
        assigned_class: kelasName,
        name: waliName,
        academicYear: tahunAjaran
      });
      alert('Identitas kelas berhasil diperbarui!');
    } catch (error) {
      console.error(error);
      alert('Gagal memperbarui identitas kelas.');
    } finally {
      setSavingKelas(false);
    }
  };

  const handleSaveKop = async () => {
    setSavingKop(true);
    try {
      await setDoc(doc(db, 'pengaturan_sekolah', 'utama'), schoolSettings, { merge: true });
      // Sinkronkan juga ke settings/school agar RPP dan Bank Soal langsung mendeteksi
      await setDoc(doc(db, 'settings', 'school'), {
        schoolName: schoolSettings.namaSekolah,
        namaSekolah: schoolSettings.namaSekolah,
        kepalaSekolah: schoolSettings.namaKepalaSekolah,
        nipKepalaSekolah: schoolSettings.nipKepalaSekolah,
        tandaTanganKepalaSekolah: schoolSettings.tandaTanganKepalaSekolah,
        stempelSekolah: schoolSettings.stempelSekolah
      }, { merge: true });
      showToast('Kop Surat dan Satuan Pendidikan berhasil disimpan!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Gagal menyimpan Kop Surat.', 'error');
    } finally {
      setSavingKop(false);
    }
  };

  const handleSaveSignature = async (sigBase64: string | null) => {
    try {
      setSchoolSettings(prev => ({ ...prev, tandaTanganKepalaSekolah: sigBase64 || '' }));
      await setDoc(doc(db, 'pengaturan_sekolah', 'utama'), { tandaTanganKepalaSekolah: sigBase64 || '' }, { merge: true });
      await setDoc(doc(db, 'settings', 'school'), { tandaTanganKepalaSekolah: sigBase64 || '' }, { merge: true });
      showToast(sigBase64 ? 'Tanda tangan digital berhasil disimpan!' : 'Tanda tangan dihapus.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memperbarui tanda tangan digital.', 'error');
    }
  };

  const handleSaveStamp = async (stampBase64: string | null) => {
    try {
      setSchoolSettings(prev => ({ ...prev, stempelSekolah: stampBase64 || '' }));
      await setDoc(doc(db, 'pengaturan_sekolah', 'utama'), { stempelSekolah: stampBase64 || '' }, { merge: true });
      await setDoc(doc(db, 'settings', 'school'), { stempelSekolah: stampBase64 || '' }, { merge: true });
      showToast(stampBase64 ? 'Stempel resmi berhasil disimpan!' : 'Stempel dihapus.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memperbarui stempel resmi.', 'error');
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    if (subjects.includes(newSubject.trim())) {
      showToast('Mata pelajaran sudah ada.', 'error');
      return;
    }
    
    setSavingSubjects(true);
    try {
      const updated = [...subjects, newSubject.trim()];
      const updatedKkm = { ...kkmMap, [newSubject.trim()]: Number(newSubjectKkm) || 75 };
      await setDoc(doc(db, 'mata_pelajaran', assignedClass), { 
        subjects: updated,
        kkmMap: updatedKkm
      }, { merge: true });
      setNewSubject('');
      setNewSubjectKkm(75);
      showToast(`Mata pelajaran ${newSubject} dengan KKM ${newSubjectKkm} berhasil ditambahkan!`, 'success');
    } catch (error) {
      console.error(error);
      showToast('Gagal menambah mata pelajaran.', 'error');
    } finally {
      setSavingSubjects(false);
    }
  };

  const handleUpdateSubjectKkm = (subj: string, val: number) => {
    setKkmMap(prev => ({
      ...prev,
      [subj]: val
    }));
  };

  const handleSaveAllKkm = async () => {
    setSavingSubjects(true);
    try {
      await setDoc(doc(db, 'mata_pelajaran', assignedClass), {
        subjects,
        kkmMap
      }, { merge: true });
      showToast('Daftar KKM per mata pelajaran berhasil diperbarui!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan KKM mata pelajaran.', 'error');
    } finally {
      setSavingSubjects(false);
    }
  };

  const handleRemoveSubject = async (subj: string) => {
    setSavingSubjects(true);
    try {
      const updated = subjects.filter(s => s !== subj);
      const updatedKkm = { ...kkmMap };
      delete updatedKkm[subj];
      await setDoc(doc(db, 'mata_pelajaran', assignedClass), { 
        subjects: updated,
        kkmMap: updatedKkm
      }, { merge: true });
      showToast(`Mata pelajaran ${subj} dihapus.`, 'success');
    } catch (error) {
      console.error(error);
      showToast('Gagal menghapus mata pelajaran.', 'error');
    } finally {
      setSavingSubjects(false);
    }
  };

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [resetting, setResetting] = useState(false);

  const executeDangerReset = async () => {
    if (resetConfirmationText !== `RESET-${assignedClass}`.toUpperCase()) {
      showToast(`Konfirmasi teks tidak cocok. Ketik RESET-${assignedClass}`, 'error');
      return;
    }
    
    setResetting(true);
    try {
      // 1. Get all students in this class
      const qStudents = query(collection(db, 'students'), where('classId', '==', assignedClass));
      const snapStudents = await getDocs(qStudents);
      
      const studentIds = snapStudents.docs.map(d => d.id);
      
      let batch = writeBatch(db);
      let count = 0;

      // Delete Students
      for (const d of snapStudents.docs) {
        batch.delete(d.ref);
        count++;
      }

      // Delete Grades for these students
      for (const id of studentIds) {
        batch.delete(doc(db, 'grades', id));
        count++;
        if (count >= 480) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      // Delete Attendance for these students
      for (const id of studentIds) {
        const qAtt = query(collection(db, 'attendance'), where('studentId', '==', id));
        const snapAtt = await getDocs(qAtt);
        for (const docAtt of snapAtt.docs) {
           batch.delete(docAtt.ref);
           count++;
           if (count >= 480) {
             await batch.commit();
             batch = writeBatch(db);
             count = 0;
           }
        }
      }

      // Delete Lesson Plans for this teacher
      if (userData?.uid) {
         const qLP = query(collection(db, 'lesson_plans'), where('teacherId', '==', userData.uid));
         const snapLP = await getDocs(qLP);
         for (const docLP of snapLP.docs) {
           batch.delete(docLP.ref);
           count++;
           if (count >= 480) {
             await batch.commit();
             batch = writeBatch(db);
             count = 0;
           }
         }
      }

      if (count > 0) {
        await batch.commit();
      }

      showToast(`Berhasil menghapus seluruh data siswa, nilai, absensi, dan RPP di ${assignedClass}!`, 'success');
      setIsResetModalOpen(false);
      setResetConfirmationText('');
    } catch (error: any) {
      console.error(error);
      showToast(`Gagal menghapus data: ${error.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan Kelas</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola preferensi dan pengaturan untuk {assignedClass}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Kolom 1 */}
        <div className="space-y-8">
          {/* Identitas Kelas */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <span>Identitas Kelas</span>
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Kelas yang Anda Pegang</label>
                <input
                  type="text"
                  placeholder="Contoh: Kelas 1, Kelas 2A"
                  value={kelasName}
                  onChange={e => setKelasName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Wali Kelas (beserta gelar)</label>
                <input
                  type="text"
                  placeholder="Contoh: Ahmad Budi, S.Pd."
                  value={waliName}
                  onChange={e => setWaliName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tahun Ajaran & Semester</label>
                <input
                  type="text"
                  placeholder="Contoh: 2026/2027 - Ganjil"
                  value={tahunAjaran}
                  onChange={e => setTahunAjaran(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <p className="text-xs text-slate-500 mt-2">Semua pengaturan ini akan otomatis digunakan pada Kop Surat RPP dan E-Rapor.</p>
              </div>
              <button
                onClick={handleSaveKelas}
                disabled={savingKelas || !kelasName.trim() || !waliName.trim()}
                className="flex items-center justify-center space-x-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-colors font-medium text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingKelas ? 'Menyimpan...' : 'Simpan Identitas Kelas'}</span>
              </button>
            </div>
          </div>

          {/* Pengaturan Kop Surat */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center space-x-2">
              <Building className="w-5 h-5 text-indigo-500" />
              <span>Satuan Pendidikan & Kop Surat (RPP & E-Rapor)</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Nama sekolah yang dimasukkan di sini akan menjadi identitas "Satuan Pendidikan" pada RPP, lembar soal, dan E-Rapor (bukan nama aplikasi).
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Sekolah (Satuan Pendidikan)</label>
                <input
                  type="text"
                  placeholder="Contoh: SDN 1 Merdeka Belajar"
                  value={schoolSettings.namaSekolah}
                  onChange={e => setSchoolSettings({...schoolSettings, namaSekolah: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Kepala Sekolah</label>
                <input
                  type="text"
                  value={schoolSettings.namaKepalaSekolah}
                  onChange={e => setSchoolSettings({...schoolSettings, namaKepalaSekolah: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">NIP Kepala Sekolah</label>
                <input
                  type="text"
                  value={schoolSettings.nipKepalaSekolah}
                  onChange={e => setSchoolSettings({...schoolSettings, nipKepalaSekolah: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <button
                onClick={handleSaveKop}
                disabled={savingKop}
                className="flex items-center justify-center space-x-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-colors font-medium text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingKop ? 'Menyimpan...' : 'Simpan Kop Surat'}</span>
              </button>
            </div>
          </div>

          {/* Tanda Tangan Digital & Stempel Resmi */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <PenTool className="w-5 h-5 text-indigo-500" />
              <span>Tanda Tangan Digital & Stempel Resmi</span>
            </h3>
            <p className="text-xs text-slate-500">
              Tanda tangan digital ini akan otomatis tercetak di lembar Rapor Siswa, Rekap Presensi, Modul Ajar (RPP), dan Dokumen Pengumuman.
            </p>
            <DigitalSignatureUpload
              signatureUrl={schoolSettings.tandaTanganKepalaSekolah}
              stampUrl={schoolSettings.stempelSekolah}
              principalName={schoolSettings.namaKepalaSekolah || 'Kepala Sekolah'}
              principalNip={schoolSettings.nipKepalaSekolah || '-'}
              schoolName={schoolSettings.namaSekolah || 'Satuan Pendidikan'}
              onSaveSignature={handleSaveSignature}
              onSaveStamp={handleSaveStamp}
            />
          </div>
        </div>

        {/* Kolom 2 */}
        <div className="space-y-8">
          {/* Pengaturan Mata Pelajaran & KKM per Mapel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <span>Mata Pelajaran & KKM {assignedClass}</span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Atur daftar mata pelajaran beserta nilai KKM (Kriteria Ketuntasan Minimal) masing-masing mapel.
            </p>
            
            <form onSubmit={handleAddSubject} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Mata pelajaran baru..."
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs"
              />
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 border border-slate-200 rounded-xl">
                <span className="text-[11px] text-slate-400 font-bold">KKM:</span>
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={newSubjectKkm}
                  onChange={e => setNewSubjectKkm(Number(e.target.value))}
                  className="w-10 text-center text-xs font-bold bg-transparent outline-none text-slate-800"
                />
              </div>
              <button 
                type="submit"
                disabled={savingSubjects || !newSubject.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl transition-colors disabled:opacity-50 text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah</span>
              </button>
            </form>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {subjects.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4 border-2 border-dashed border-slate-200 rounded-xl">
                  Belum ada mata pelajaran. Silakan tambahkan.
                </p>
              ) : (
                subjects.map((subj) => {
                  const currentKkm = kkmMap[subj] !== undefined ? kkmMap[subj] : 75;
                  return (
                    <div key={subj} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 gap-2">
                      <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{subj}</span>
                      
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">KKM</span>
                        <input
                          type="number"
                          min={50}
                          max={100}
                          value={currentKkm}
                          onChange={(e) => handleUpdateSubjectKkm(subj, Number(e.target.value))}
                          className="w-9 text-center text-xs font-bold text-indigo-600 outline-none bg-transparent"
                        />
                      </div>

                      <button 
                        onClick={() => handleRemoveSubject(subj)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        title="Hapus Mapel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {subjects.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAllKkm}
                  disabled={savingSubjects}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan KKM</span>
                </button>
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -z-0 opacity-50" />
            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center space-x-2 relative z-10">
              <AlertTriangle className="w-5 h-5" />
              <span>Danger Zone</span>
            </h3>
            <p className="text-sm text-slate-600 mb-4 relative z-10">
              Menghapus seluruh data siswa (dan nilainya) pada <strong>{assignedClass}</strong>. 
              Tindakan ini tidak dapat dibatalkan!
            </p>
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="w-full flex items-center justify-center space-x-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-3 rounded-xl transition-colors font-medium text-sm relative z-10"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset Data {assignedClass}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Custom Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -z-0 opacity-50" />
            <div className="relative z-10">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              
              <h2 className="text-xl font-bold text-slate-800 mb-2">Apakah Anda Yakin?</h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Tindakan ini akan <strong>MENGHAPUS SELURUH DATA KELAS</strong> (Siswa, Nilai, Absensi, RPP) pada {assignedClass} secara permanen.
                <br/><br/>
                Ketik <strong>RESET-{assignedClass}</strong> untuk mengonfirmasi.
              </p>
              
              <input
                type="text"
                placeholder={`RESET-${assignedClass}`}
                value={resetConfirmationText}
                onChange={e => setResetConfirmationText(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none mb-6 font-medium text-slate-800 text-center uppercase"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsResetModalOpen(false);
                    setResetConfirmationText('');
                  }}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={executeDangerReset}
                  disabled={resetConfirmationText !== `RESET-${assignedClass}`.toUpperCase() || resetting}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {resetting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>{resetting ? 'Menghapus...' : 'Lanjut Hapus'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification (SnackBar) */}
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
