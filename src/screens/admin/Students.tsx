import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, deleteDoc, doc, writeBatch, query, where, onSnapshot, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Upload, Plus, Trash2, Search, FileSpreadsheet, Filter, Edit2, X, FileDown, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeClassName, CLASS_GROUPS, POPULAR_CLASSES, ALL_AVAILABLE_CLASSES } from '../../lib/schoolClasses';

interface Student {
  id: string;
  nisn: string;
  absen_number: string;
  name: string;
  gender: string;
  classId: string;
  catatanWaliKelas?: string;
  catatanWaliKelasUpdated?: string;
  parentPhone?: string;
}

export default function StudentsAdmin() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';
  
  const [selectedClass, setSelectedClass] = useState<string>(
    isAdmin ? 'Semua Kelas' : (userData?.assigned_class || 'Kelas 1 A')
  );
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Modal & Toast States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({ nisn: '', absen_number: '', name: '', gender: 'L', classId: '', catatanWaliKelas: '', parentPhone: '' });
  
  // Delete Confirmation Dialog State
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast Notification State (SnackBar)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const classesList = ['Semua Kelas', ...ALL_AVAILABLE_CLASSES];
  const singleClasses = ALL_AVAILABLE_CLASSES;

  useEffect(() => {
    setLoading(true);
    let q = collection(db, 'students') as any;
    
    if (selectedClass !== 'Semua Kelas') {
      q = query(collection(db, 'students'), where('classId', '==', selectedClass));
    }

    const unsubscribe = onSnapshot(q, (snap: any) => {
      const data = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Student));
      // Sort by absen_number if possible
      data.sort((a: Student, b: Student) => {
        return (parseInt(a.absen_number) || 0) - (parseInt(b.absen_number) || 0);
      });
      setStudents(data);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching students: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedClass]);

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    
    const headers = [
      ['Nomor Absen', 'Nama Lengkap', 'NISN', 'Kelas', 'Jenis Kelamin (L/P)', 'Nomor HP Wali Murid', 'Tempat Lahir', 'Tanggal Lahir (YYYY-MM-DD)']
    ];
    const data = [
      ['01', 'Ahmad Budi Santoso', '1234567890', 'Kelas 1 A', 'L', '08123456789', 'Jakarta', '2018-05-14'],
      ['02', 'Siti Nur Aminah', '0987654321', 'Kelas 1 A', 'P', '08129876543', 'Bandung', '2018-08-20'],
      ['01', 'Rian Hidayat', '1122334455', 'Kelas 1 B', 'L', '08131122334', 'Semarang', '2018-03-11'],
      ['02', 'Dewi Anggraini', '5566778899', 'Kelas 1 B', 'P', '08135566778', 'Yogyakarta', '2018-09-04'],
      ['01', 'Farhan Ramadhan', '2233445566', 'Kelas 2 A', 'L', '08137788990', 'Surabaya', '2017-04-15'],
      ['02', 'Zahra Aulia', '3344556677', 'Kelas 2 B', 'P', '08138899001', 'Malang', '2017-10-22'],
      ['01', 'Muhammad Iqbal', '4455667788', 'Kelas 7 MTs A', 'L', '08139900112', 'Kediri', '2012-01-18'],
      ['02', 'Fatimah Az-Zahra', '5566778800', 'Kelas 7 MTs B', 'P', '08130011223', 'Blitar', '2012-07-29'],
      ['01', 'Bagas Saputra', '6677889900', 'Kelas 8 MTs A', 'L', '08131122330', 'Jember', '2011-06-12'],
      ['01', 'Nadia Syahrini', '7788990011', 'Kelas 9 MTs A', 'P', '08132233440', 'Banyuwangi', '2010-02-14'],
      ['02', 'Dimas Prasetyo', '8899001122', 'Kelas 9 MTs B', 'L', '08133344550', 'Madiun', '2010-08-08']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...data]);
    
    // Auto-size columns
    ws['!cols'] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
      { wch: 20 },
      { wch: 25 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');
    XLSX.writeFile(wb, 'Template_Seluruh_Siswa_Per_Kelas.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length <= 1) {
        showToast('Berkas template kosong atau tidak memiliki baris data siswa.', 'error');
        setIsImporting(false);
        return;
      }

      // Deteksi Header Kolom
      const headerRow = (jsonData[0] as any[]).map((h) => String(h || '').trim().toLowerCase());
      let colAbsen = headerRow.findIndex((h) => h.includes('absen') || h.includes('no'));
      let colNama = headerRow.findIndex((h) => h.includes('nama'));
      let colNisn = headerRow.findIndex((h) => h.includes('nisn') || h.includes('induk'));
      let colKelas = headerRow.findIndex((h) => h.includes('kelas') || h.includes('tingkat'));
      let colGender = headerRow.findIndex((h) => h.includes('kelamin') || h.includes('gender') || h === 'l/p');
      let colPhone = headerRow.findIndex((h) => h.includes('hp') || h.includes('telepon') || h.includes('wa') || h.includes('wali'));
      let colTempat = headerRow.findIndex((h) => h.includes('tempat'));
      let colTanggal = headerRow.findIndex((h) => h.includes('tanggal') || h.includes('lahir'));

      // Positional fallback jika header format berbeda
      if (colNama === -1) colNama = 1;
      if (colAbsen === -1) colAbsen = 0;
      if (colNisn === -1) colNisn = 2;
      if (colKelas === -1 && headerRow.length >= 7) colKelas = 3;
      if (colGender === -1) colGender = colKelas === 3 ? 4 : 3;
      if (colPhone === -1) colPhone = colKelas === 3 ? 5 : -1;
      if (colTempat === -1) colTempat = colKelas === 3 ? 6 : 4;
      if (colTanggal === -1) colTanggal = colKelas === 3 ? 7 : 5;

      const studentsRef = collection(db, 'students');
      const classCounters: Record<string, number> = {};
      let totalCount = 0;

      // Kumpulkan seluruh data siswa yang valid
      const studentsToInsert: any[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        const rawName = String(row[colNama] || '').trim();
        if (!rawName) continue; // Nama wajib ada

        // Tentukan kelas masing-masing siswa secara otomatis
        let studentClass = '';
        if (colKelas !== -1 && row[colKelas]) {
          studentClass = normalizeClassName(String(row[colKelas]));
        } else if (selectedClass !== 'Semua Kelas') {
          studentClass = selectedClass;
        } else {
          studentClass = 'Kelas 1 A';
        }

        const rawGender = String(row[colGender] || 'L').trim().toUpperCase();
        const gender = rawGender.startsWith('P') ? 'P' : 'L';

        studentsToInsert.push({
          absen_number: String(row[colAbsen] || `${totalCount + 1}`).trim(),
          name: rawName,
          nisn: String(row[colNisn] || '').trim(),
          gender,
          classId: studentClass,
          parentPhone: colPhone !== -1 ? String(row[colPhone] || '').trim() : '',
          birthPlace: colTempat !== -1 ? String(row[colTempat] || '').trim() : '',
          birthDate: colTanggal !== -1 ? String(row[colTanggal] || '').trim() : '',
          catatanWaliKelas: '',
          importedAt: new Date().toISOString()
        });

        classCounters[studentClass] = (classCounters[studentClass] || 0) + 1;
        totalCount++;
      }

      if (studentsToInsert.length === 0) {
        showToast('Tidak ada data siswa yang valid untuk diimpor.', 'error');
        setIsImporting(false);
        return;
      }

      // Batch Write in Chunks of 400 (Firebase batch limit is 500)
      const chunkSize = 400;
      for (let i = 0; i < studentsToInsert.length; i += chunkSize) {
        const chunk = studentsToInsert.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const item of chunk) {
          const newDocRef = doc(studentsRef);
          batch.set(newDocRef, item);
        }
        await batch.commit();
      }

      // Buat ringkasan pembagian per kelas
      const classSummary = Object.entries(classCounters)
        .map(([cls, count]) => `${cls}: ${count} siswa`)
        .join(', ');

      showToast(
        `Berhasil mengimpor ${totalCount} siswa! Otomatis terbagi ke ${Object.keys(classCounters).length} kelas (${classSummary}).`,
        'success'
      );
    } catch (error: any) {
      console.error(error);
      showToast('Gagal mengimpor data excel: ' + (error?.message || 'Format tidak valid'), 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Delete the student document
      batch.delete(doc(db, 'students', studentToDelete.id));
      
      // 2. Delete grades document
      batch.delete(doc(db, 'grades', studentToDelete.id));
      
      // 3. Delete attendance records
      const qAtt = query(collection(db, 'attendance'), where('studentId', '==', studentToDelete.id));
      const snapAtt = await getDocs(qAtt);
      snapAtt.forEach(d => {
        batch.delete(d.ref);
      });
      
      await batch.commit();
      
      showToast(`Data siswa ${studentToDelete.name} beserta nilai dan absensinya berhasil dihapus!`, 'success');
      setStudentToDelete(null);
    } catch (error: any) {
      console.error("Error deleting student:", error);
      showToast(`Gagal menghapus: ${error.message || 'Terjadi kesalahan sistem'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetData = async () => {
    // We will handle this using a modal state
    setIsResetModalOpen(true);
  };
  
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const confirmResetData = async () => {
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      const qStudents = query(collection(db, 'students'), where('classId', '==', selectedClass));
      const snapStudents = await getDocs(qStudents);
      
      for (const st of snapStudents.docs) {
        batch.delete(st.ref); // Delete student
        batch.delete(doc(db, 'grades', st.id)); // Delete grades
        
        // Delete attendance
        const qAtt = query(collection(db, 'attendance'), where('studentId', '==', st.id));
        const snapAtt = await getDocs(qAtt);
        snapAtt.forEach(d => batch.delete(d.ref));
      }
      
      await batch.commit();
      showToast(`Seluruh data siswa kelas ${selectedClass} berhasil direset!`, 'success');
    } catch (error: any) {
      console.error("Error resetting students:", error);
      showToast(`Gagal mereset data: ${error.message || 'Terjadi kesalahan sistem'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFormData({ 
        nisn: student.nisn || '', 
        absen_number: student.absen_number || '', 
        name: student.name || '', 
        gender: student.gender || 'L', 
        classId: student.classId || '',
        catatanWaliKelas: student.catatanWaliKelas || '',
        parentPhone: student.parentPhone || ''
      });
    } else {
      setEditingStudent(null);
      setFormData({ 
        nisn: '', 
        absen_number: '', 
        name: '', 
        gender: 'L', 
        classId: isAdmin && selectedClass !== 'Semua Kelas' ? selectedClass : (userData?.assigned_class || 'Kelas 1'),
        catatanWaliKelas: '',
        parentPhone: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        catatanWaliKelasUpdated: new Date().toISOString()
      };
      if (editingStudent) {
        await updateDoc(doc(db, 'students', editingStudent.id), payload);
        showToast('Data siswa & Catatan Wali Kelas berhasil diperbarui!', 'success');
      } else {
        await addDoc(collection(db, 'students'), payload);
        showToast('Siswa baru berhasil ditambahkan!', 'success');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving student:", error);
      showToast(`Gagal menyimpan: ${error.message || 'Terjadi kesalahan'}`, 'error');
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.nisn.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Siswa</h1>
          {!isAdmin && <p className="text-sm text-slate-500 mt-1">Mengelola siswa: {userData?.assigned_class}</p>}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl transition-colors font-medium text-sm"
          >
            <FileDown className="w-4 h-4" />
            <span>Download Template</span>
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition-all font-bold text-sm shadow-sm shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
            title="Impor seluruh data siswa dari template Excel (Otomatis terbagi ke kelasnya masing-masing)"
          >
            {isImporting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            <span>{isImporting ? 'Mengimpor Seluruh Siswa...' : 'Impor Data Siswa'}</span>
          </button>
          
          {isAdmin && selectedClass !== 'Semua Kelas' && (
            <button 
              onClick={handleResetData}
              disabled={isDeleting || students.length === 0}
              className="flex items-center space-x-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2.5 rounded-xl transition-colors font-medium text-sm disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset Data</span>
            </button>
          )}

          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-colors font-medium text-sm shadow-sm shadow-indigo-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama atau NISN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm"
            />
          </div>
          
          {isAdmin && (
            <div className="relative w-full sm:w-64">
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select 
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm font-semibold text-slate-700 cursor-pointer"
              >
                <option value="Semua Kelas">📢 Semua Kelas (Seluruh Siswa)</option>
                {CLASS_GROUPS.map((group) => (
                  <optgroup key={group.groupName} label={group.groupName}>
                    {group.classes.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-sm text-slate-500">
                <th className="px-6 py-4 font-medium">No. Absen</th>
                <th className="px-6 py-4 font-medium">NISN</th>
                <th className="px-6 py-4 font-medium">Nama Lengkap</th>
                <th className="px-6 py-4 font-medium">L/P</th>
                {isAdmin && selectedClass === 'Semua Kelas' && <th className="px-6 py-4 font-medium">Kelas</th>}
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin && selectedClass === 'Semua Kelas' ? 6 : 5} className="px-6 py-8 text-center text-slate-500">
                    <div className="flex justify-center mb-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                    Memuat data...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin && selectedClass === 'Semua Kelas' ? 6 : 5} className="px-6 py-8 text-center text-slate-500">
                    Tidak ada data siswa ditemukan.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{student.absen_number || '-'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{student.nisn}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{student.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${student.gender === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                        {student.gender}
                      </span>
                    </td>
                    {isAdmin && selectedClass === 'Semua Kelas' && (
                       <td className="px-6 py-4 text-sm text-slate-600 font-medium">{student.classId}</td>
                    )}
                    <td className="px-6 py-4 text-sm text-right space-x-2">
                      <button
                        onClick={() => {
                          if (student.parentPhone) {
                            const waLink = `https://wa.me/${student.parentPhone.replace(/\D/g, '')}?text=Halo%20Bapak/Ibu%20Wali%20Murid%20dari%20${encodeURIComponent(student.name)}...`;
                            window.open(waLink, '_blank');
                          } else {
                            showToast('Nomor HP Wali Murid belum diatur untuk siswa ini', 'error');
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Kirim Info via WA"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(student)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setStudentToDelete(student)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus"
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

      {/* Toast Notification (SnackBar) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Peringatan Fatal!</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus SELURUH DATA siswa kelas <strong>{selectedClass}</strong>? Ini akan menghapus data siswa, absensi, dan nilai secara permanen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  await confirmResetData();
                  setIsResetModalOpen(false);
                }}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{isDeleting ? 'Mereset...' : 'Lanjut Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (AlertDialog) */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Hapus Data Siswa?</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus siswa <strong>{studentToDelete.name}</strong>? Data nilai dan seluruh absensinya juga akan dihapus permanen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStudentToDelete(null)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteStudent}
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

      {/* Modal Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveModal} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NISN</label>
                  <input
                    type="text"
                    required
                    value={formData.nisn}
                    onChange={(e) => setFormData({...formData, nisn: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">No. Absen</label>
                  <input
                    type="text"
                    required
                    value={formData.absen_number}
                    onChange={(e) => setFormData({...formData, absen_number: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kelas</label>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({...formData, classId: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-semibold text-slate-700"
                  >
                    {CLASS_GROUPS.map((group) => (
                      <optgroup key={group.groupName} label={group.groupName}>
                        {group.classes.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">No. HP Wali Murid (Untuk WA)</label>
                <input
                  type="text"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({...formData, parentPhone: e.target.value})}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Catatan Wali Kelas (Untuk Wali Murid)</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.catatanWaliKelas}
                  onChange={(e) => setFormData({...formData, catatanWaliKelas: e.target.value})}
                  placeholder="Pesan khusus untuk orang tua/wali murid anak ini (misal: perlu bimbingan membaca/matematika)..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none"
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
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
