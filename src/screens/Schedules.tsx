import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Plus, Trash2, Edit2, Upload, FileDown, Clock, BookOpen, User, MapPin, X, CheckCircle, AlertTriangle, FileSpreadsheet, Filter, Image as ImageIcon } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ScheduleItem {
  id: string;
  classId: string;
  type: 'pelajaran' | 'ujian';
  hari: string; // e.g. 'Senin' or '2026-10-15'
  jam: string; // e.g. '07:30 - 09:00'
  mataPelajaran: string;
  pengajar: string;
  ruangan?: string;
  keterangan?: string;
}

const DAYS_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const CLASSES_LIST = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Kelas 7', 'Kelas 8', 'Kelas 9'];

export default function SchedulesScreen() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';
  
  const [selectedClass, setSelectedClass] = useState<string>(
    isAdmin ? 'Kelas 1' : (userData?.assigned_class || 'Kelas 1')
  );
  
  const [activeTab, setActiveTab] = useState<'pelajaran' | 'ujian'>('pelajaran');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [formData, setFormData] = useState({
    classId: selectedClass,
    type: 'pelajaran' as 'pelajaran' | 'ujian',
    hari: 'Senin',
    jam: '07:30 - 08:30',
    mataPelajaran: '',
    pengajar: '',
    ruangan: 'Kelas R1',
    keterangan: ''
  });

  // Delete State
  const [itemToDelete, setItemToDelete] = useState<ScheduleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, 'jadwal_kelas'));
    if (selectedClass) {
      q = query(collection(db, 'jadwal_kelas'), where('classId', '==', selectedClass));
    }

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleItem));
      setSchedules(items);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedClass]);

  const handleOpenModal = (item?: ScheduleItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        classId: item.classId,
        type: item.type,
        hari: item.hari,
        jam: item.jam,
        mataPelajaran: item.mataPelajaran,
        pengajar: item.pengajar || '',
        ruangan: item.ruangan || '',
        keterangan: item.keterangan || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        classId: selectedClass,
        type: activeTab,
        hari: activeTab === 'pelajaran' ? 'Senin' : new Date().toISOString().split('T')[0],
        jam: '07:30 - 08:30',
        mataPelajaran: '',
        pengajar: userData?.name || '',
        ruangan: 'Kelas R1',
        keterangan: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'jadwal_kelas', editingItem.id), formData);
        showToast('Jadwal berhasil diperbarui!', 'success');
      } else {
        await addDoc(collection(db, 'jadwal_kelas'), formData);
        showToast('Jadwal baru berhasil ditambahkan!', 'success');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error(error);
      showToast(`Gagal menyimpan jadwal: ${error.message || 'Terjadi kesalahan'}`, 'error');
    }
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'jadwal_kelas', itemToDelete.id));
      showToast('Jadwal berhasil dihapus!', 'success');
      setItemToDelete(null);
    } catch (error: any) {
      console.error(error);
      showToast(`Gagal menghapus: ${error.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteAllItems = async () => {
    setIsDeleting(true);
    try {
      const q = query(collection(db, 'jadwal_kelas'), where('classId', '==', selectedClass));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
      
      showToast(`Semua jadwal ${selectedClass} berhasil dihapus!`, 'success');
      setIsConfirmDeleteAllOpen(false);
    } catch (error: any) {
      console.error(error);
      showToast(`Gagal menghapus jadwal: ${error.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Download Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Tipe (pelajaran/ujian)': 'pelajaran',
        'Hari / Tanggal': 'Senin',
        'Jam (WIB)': '07:30 - 08:30',
        'Mata Pelajaran': 'Matematika',
        'Guru / Pengawas': 'Pak Budi, S.Pd.',
        'Ruangan': 'Ruang 101',
        'Keterangan': 'Membawa Penggaris'
      },
      {
        'Tipe (pelajaran/ujian)': 'pelajaran',
        'Hari / Tanggal': 'Senin',
        'Jam (WIB)': '08:30 - 09:30',
        'Mata Pelajaran': 'Bahasa Indonesia',
        'Guru / Pengawas': 'Ibu Siti, M.Pd.',
        'Ruangan': 'Ruang 101',
        'Keterangan': ''
      },
      {
        'Tipe (pelajaran/ujian)': 'ujian',
        'Hari / Tanggal': '2026-10-20',
        'Jam (WIB)': '08:00 - 10:00',
        'Mata Pelajaran': 'IPA (PTS Ganjil)',
        'Guru / Pengawas': 'Pak Joko, S.Si.',
        'Ruangan': 'Aula Utama',
        'Keterangan': 'Ujian Tertulis'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal_Kelas");
    XLSX.writeFile(wb, `Template_Jadwal_${selectedClass.replace(/\s+/g, '_')}.xlsx`);
    showToast('Template Excel Jadwal berhasil diunduh!', 'success');
  };

  // Import Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          showToast('File Excel kosong atau format tidak sesuai.', 'error');
          return;
        }

        const batch = writeBatch(db);
        let count = 0;

        for (const row of data as any[]) {
          const typeVal = String(row['Tipe (pelajaran/ujian)'] || row['Tipe'] || 'pelajaran').toLowerCase().includes('ujian') ? 'ujian' : 'pelajaran';
          const hariVal = String(row['Hari / Tanggal'] || row['Hari'] || row['Tanggal'] || 'Senin');
          const jamVal = String(row['Jam (WIB)'] || row['Jam'] || '07:30 - 08:30');
          const mapelVal = String(row['Mata Pelajaran'] || row['Mapel'] || '-');
          const guruVal = String(row['Guru / Pengawas'] || row['Guru'] || '-');
          const ruangVal = String(row['Ruangan'] || '');
          const ketVal = String(row['Keterangan'] || '');

          const newDocRef = doc(collection(db, 'jadwal_kelas'));
          batch.set(newDocRef, {
            classId: selectedClass,
            type: typeVal,
            hari: hariVal,
            jam: jamVal,
            mataPelajaran: mapelVal,
            pengajar: guruVal,
            ruangan: ruangVal,
            keterangan: ketVal
          });
          count++;

          if (count === 480) {
            await batch.commit();
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }

        showToast(`Berhasil mengimpor ${data.length} data jadwal ke ${selectedClass}!`, 'success');
      } catch (err: any) {
        console.error(err);
        showToast(`Gagal mengimpor Excel: ${err.message || 'Format tidak valid'}`, 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    showToast('Sedang mengekstrak jadwal menggunakan AI...', 'success');

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract-schedule", {
        method: "POST",
        body: formData,
      });
      
      let extractedData;
      const textRes = await res.text();
      try {
        extractedData = JSON.parse(textRes);
      } catch (e) {
        if (!res.ok) {
          throw new Error(`Server error (${res.status}): Server sibuk atau gambar terlalu besar.`);
        }
        throw new Error('Respons server tidak valid.');
      }

      if (res.ok && Array.isArray(extractedData)) {
        const batch = writeBatch(db);
        let count = 0;

        for (const item of extractedData) {
          const newDocRef = doc(collection(db, 'jadwal_kelas'));
          batch.set(newDocRef, {
            classId: selectedClass,
            type: item.type === 'ujian' ? 'ujian' : 'pelajaran',
            hari: item.hari || 'Senin',
            jam: item.jam || '07:30',
            mataPelajaran: item.mataPelajaran || 'Tidak Diketahui',
            pengajar: item.pengajar || '',
            ruangan: item.ruangan || '',
            keterangan: item.keterangan || ''
          });
          count++;

          if (count === 480) {
            await batch.commit();
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }

        // Upload image to Firebase Storage so we can display it on dashboard
        try {
          const timestamp = Date.now();
          const extension = file.name.split('.').pop() || 'jpg';
          const storageRef = ref(storage, `schedules/${selectedClass}_${timestamp}.${extension}`);
          await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(storageRef);
          
          // Save the URL to a specific collection per class
          const imageDocRef = doc(db, 'jadwal_images', selectedClass);
          await setDoc(imageDocRef, { 
            classId: selectedClass, 
            imageUrl: downloadUrl,
            updatedAt: new Date().toISOString()
          });
        } catch (uploadError) {
          console.error("Gagal mengunggah gambar ke storage:", uploadError);
        }

        showToast(`Berhasil mengekstrak dan menyimpan ${extractedData.length} jadwal ke ${selectedClass}!`, 'success');
      } else {
        showToast(extractedData.error || "Gagal mengekstrak jadwal dari gambar.", 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Terjadi kesalahan jaringan saat mengekstrak gambar.", 'error');
    } finally {
      setIsExtracting(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const filteredSchedules = schedules.filter(s => s.type === activeTab);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs text-indigo-100 font-medium mb-2 border border-white/10">
              <Calendar className="w-3.5 h-3.5 text-indigo-200" />
              <span>Modul Kelola Jadwal Pelajaran & Ujian</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Manajemen Jadwal Kelas</h1>
            <p className="text-indigo-100 text-sm mt-1 max-w-xl">
              Atur dan terbitkan jadwal mata pelajaran harian serta jadwal ujian resmi untuk seluruh siswa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-2xl text-xs font-semibold backdrop-blur-md border border-white/20 transition-all"
            >
              <FileDown className="w-4 h-4" />
              <span>Template Excel</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import Excel</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx, .xls"
              className="hidden"
            />

            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isExtracting}
              className="flex items-center space-x-2 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-400 text-white px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-sm transition-all"
            >
              {isExtracting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
              <span>{isExtracting ? 'Mengekstrak AI...' : 'Scan Gambar/Foto'}</span>
            </button>
            <input
              type="file"
              ref={imageInputRef}
              onChange={handleImportImage}
              accept="image/*,.pdf"
              className="hidden"
            />

            <button
              onClick={() => setIsConfirmDeleteAllOpen(true)}
              className="flex items-center space-x-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Semua</span>
            </button>

            <button
              onClick={() => handleOpenModal()}
              className="flex items-center space-x-2 bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jadwal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Pilih Kelas:
            </span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
            >
              {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex bg-slate-200/80 p-1 rounded-2xl text-xs font-semibold w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('pelajaran')}
              className={`flex-1 sm:flex-initial px-5 py-2 rounded-xl transition-all ${activeTab === 'pelajaran' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Jadwal Pelajaran
            </button>
            <button
              onClick={() => setActiveTab('ujian')}
              className={`flex-1 sm:flex-initial px-5 py-2 rounded-xl transition-all ${activeTab === 'ujian' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Jadwal Ujian
            </button>
          </div>
        </div>

        {/* Schedule List */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
              <Calendar className="w-12 h-12 opacity-30" />
              <p className="text-base font-semibold text-slate-600">
                Belum ada {activeTab === 'pelajaran' ? 'Jadwal Pelajaran' : 'Jadwal Ujian'} untuk {selectedClass}
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Klik tombol "Tambah Jadwal" di atas atau unggah file Excel untuk mengisinya secara otomatis.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSchedules.map(item => (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition-all hover:shadow-md relative group ${item.type === 'ujian' ? 'bg-amber-50/60 border-amber-200/80' : 'bg-white border-slate-200/80'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${item.type === 'ujian' ? 'bg-amber-200 text-amber-900' : 'bg-indigo-100 text-indigo-800'}`}>
                      {item.hari}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.jam}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <BookOpen className={`w-4 h-4 ${item.type === 'ujian' ? 'text-amber-600' : 'text-indigo-600'}`} />
                    {item.mataPelajaran}
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-600 mb-4 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {item.type === 'ujian' ? 'Pengawas:' : 'Guru:'} <strong>{item.pengajar || '-'}</strong>
                      </span>
                    </div>
                    {item.ruangan && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>Ruangan: {item.ruangan}</span>
                      </div>
                    )}
                    {item.keterangan && (
                      <div className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">
                        Catatan: {item.keterangan}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-1 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setItemToDelete(item)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification (SnackBar) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Hapus Jadwal?</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus jadwal <strong>{itemToDelete.mataPelajaran}</strong> ({itemToDelete.hari})?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteItem}
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

      {/* Delete All Confirmation Modal */}
      {isConfirmDeleteAllOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Hapus Seluruh Jadwal?</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus <strong>seluruh jadwal</strong> untuk <strong>{selectedClass}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsConfirmDeleteAllOpen(false)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteAllItems}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Semua'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Jadwal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">
                {editingItem ? 'Edit Jadwal' : 'Tambah Jadwal Baru'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kelas Target</label>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({...formData, classId: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Jadwal</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-indigo-700"
                  >
                    <option value="pelajaran">Jadwal Pelajaran</option>
                    <option value="ujian">Jadwal Ujian</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {formData.type === 'pelajaran' ? 'Hari' : 'Tanggal Ujian'}
                  </label>
                  {formData.type === 'pelajaran' ? (
                    <select
                      value={formData.hari}
                      onChange={(e) => setFormData({...formData, hari: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {DAYS_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  ) : (
                    <input
                      type="date"
                      required
                      value={formData.hari}
                      onChange={(e) => setFormData({...formData, hari: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jam (WIB)</label>
                  <input
                    type="text"
                    required
                    placeholder="misal: 07:30 - 09:00"
                    value={formData.jam}
                    onChange={(e) => setFormData({...formData, jam: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mata Pelajaran</label>
                <input
                  type="text"
                  required
                  placeholder="misal: Matematika, Bahasa Indonesia..."
                  value={formData.mataPelajaran}
                  onChange={(e) => setFormData({...formData, mataPelajaran: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {formData.type === 'pelajaran' ? 'Nama Guru' : 'Pengawas Ujian'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Guru / Pengawas"
                    value={formData.pengajar}
                    onChange={(e) => setFormData({...formData, pengajar: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ruangan</label>
                  <input
                    type="text"
                    placeholder="misal: Kelas R1, Lab Komputer..."
                    value={formData.ruangan}
                    onChange={(e) => setFormData({...formData, ruangan: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan Opsional</label>
                <input
                  type="text"
                  placeholder="misal: Membawa perlengkapan gambar / laptop"
                  value={formData.keterangan}
                  onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
