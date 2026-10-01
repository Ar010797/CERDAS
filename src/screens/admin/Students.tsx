import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, deleteDoc, doc, writeBatch, query, where, onSnapshot, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Upload, Plus, Trash2, Search, FileSpreadsheet, Filter, Edit2, X, FileDown, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeClassName, CLASS_GROUPS, POPULAR_CLASSES, ALL_AVAILABLE_CLASSES } from '../../lib/schoolClasses';
import ClassSelectWithCustom from '../../components/ClassSelectWithCustom';

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

function isRealClassSheetName(raw?: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const clean = raw.trim().toLowerCase();
  // Sheet generic names yang BUKAN kelas
  if (/^(?:sheet\s*\d*|data\s*(?:siswa)?|rekap\s*(?:siswa)?|all|semua|page\s*\d*|table\s*\d*|daftar\s*(?:siswa)?|murid)$/i.test(clean)) {
    return false;
  }
  // Pola nama kelas seperti "1 A", "1A", "7 MTs A", "VII A", "8 B", "kls 1", "kelas 2b", "x ipa", "vii-1"
  if (/^(?:kelas|kls|rombel|tingkat)?\s*([0-9]{1,2}|vii|viii|ix|vi|iv|v|iii|ii|i|x|xi|xii)\s*[\-_]?\s*(?:mts|smp|sd|mi|ma|sma)?\s*([a-z0-9])?$/i.test(clean)) {
    return true;
  }
  return ALL_AVAILABLE_CLASSES.some(c => c.toLowerCase() === clean || c.toLowerCase() === `kelas ${clean}`);
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

  // Jumlah siswa per kelas di seluruh sekolah secara realtime
  const [allClassCounts, setAllClassCounts] = useState<Record<string, number>>({});

  // Modal & Toast States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({ nisn: '', absen_number: '', name: '', gender: 'L', classId: '', catatanWaliKelas: '', parentPhone: '' });
  
  // Delete Confirmation Dialog State
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Preview Impor Sekaligus
  const [importPreview, setImportPreview] = useState<{
    students: any[];
    classCounters: Record<string, number>;
    sheetsCount: number;
    fileName: string;
  } | null>(null);
  const [overrideClass, setOverrideClass] = useState<string>('auto');

  // Modal Hapus Data Per Kelas
  const [isResetPerClassModalOpen, setIsResetPerClassModalOpen] = useState(false);
  const [targetClassToReset, setTargetClassToReset] = useState<string>('Kelas 1 A');
  const [confirmResetChecked, setConfirmResetChecked] = useState(false);

  // Toast Notification State (SnackBar)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const classesList = ['Semua Kelas', ...ALL_AVAILABLE_CLASSES];
  const singleClasses = ALL_AVAILABLE_CLASSES;

  // Realtime listener seluruh data siswa untuk menghitung jumlah siswa per kelas
  useEffect(() => {
    const unsubAll = onSnapshot(collection(db, 'students'), (snap) => {
      const counts: Record<string, number> = {};
      snap.forEach(d => {
        const c = d.data().classId || 'Kelas 1 A';
        counts[c] = (counts[c] || 0) + 1;
      });
      setAllClassCounts(counts);
    });
    return () => unsubAll();
  }, []);

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

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        showToast('Berkas Excel kosong atau tidak terbaca.', 'error');
        setIsImporting(false);
        return;
      }

      const classCounters: Record<string, number> = {};
      const studentsToInsert: any[] = [];
      let totalCount = 0;
      let sheetsWithData = 0;

      // Iterasi ke SELURUH SHEET di dalam berkas Excel
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (!jsonData || jsonData.length <= 1) continue;

        // Cek apakah nama sheet itu sendiri merupakan nama kelas (contoh: "1A", "Kelas 1 A", "7 MTs A", "VII A")
        const sheetIsClass = isRealClassSheetName(sheetName);
        const inferredSheetClass = sheetIsClass ? normalizeClassName(sheetName) : '';

        // Deteksi baris header secara cerdas (mencari baris dengan kata kunci kolom terbanyak)
        let headerRowIndex = 0;
        let maxHeaderScore = 0;

        for (let r = 0; r < Math.min(6, jsonData.length); r++) {
          const row = jsonData[r] || [];
          let score = 0;
          for (const cell of row) {
            const str = String(cell || '').trim().toLowerCase();
            if (str.includes('nama') || str === 'name') score += 3;
            if (str.includes('absen') || str === 'no' || str === 'no.' || str.includes('urut')) score += 2;
            if (str.includes('nisn') || str.includes('nis') || str.includes('induk')) score += 2;
            if (str.includes('kelas') || str.includes('kls') || str.includes('rombel') || str.includes('tingkat') || str === 'grade') score += 3;
            if (str.includes('kelamin') || str.includes('gender') || str === 'l/p' || str === 'jk' || str === 'l / p') score += 2;
          }
          if (score > maxHeaderScore) {
            maxHeaderScore = score;
            headerRowIndex = r;
          }
        }

        // Cek apakah di baris-baris atas sebelum header ada judul yang memuat nama kelas (misal: "DAFTAR SISWA KELAS 2 B")
        let bannerClass = '';
        for (let r = 0; r < headerRowIndex; r++) {
          const rowStr = (jsonData[r] || []).map((c: any) => String(c || '')).join(' ');
          const m = rowStr.match(/(?:kelas\s*)?([0-9]{1,2}|vii|viii|ix|vi|iv|v|iii|ii|i)\s*[\-_]?\s*(?:mts|smp)?\s*([a-z])\b/i);
          if (m) {
            bannerClass = normalizeClassName(m[0]);
            break;
          }
        }

        const headerRow = (jsonData[headerRowIndex] as any[]).map((h) => String(h || '').trim().toLowerCase());
        let colAbsen = headerRow.findIndex((h) => h.includes('absen') || h.includes('no') || h === 'no.' || h.includes('urut'));
        let colNama = headerRow.findIndex((h) => h.includes('nama') || h.includes('name') || h.includes('siswa') || h.includes('peserta'));
        let colNisn = headerRow.findIndex((h) => h.includes('nisn') || h.includes('induk') || h.includes('nis') || h.includes('nik'));
        let colKelas = headerRow.findIndex((h) => h.includes('kelas') || h.includes('kls') || h.includes('rombel') || h.includes('tingkat') || h.includes('grade') || h.includes('ruang'));
        let colGender = headerRow.findIndex((h) => h.includes('kelamin') || h.includes('gender') || h === 'l/p' || h === 'jk' || h === 'l / p' || h === 'lp');
        let colPhone = headerRow.findIndex((h) => h.includes('hp') || h.includes('telepon') || h.includes('telp') || h.includes('wa') || h.includes('wali') || h.includes('kontak') || h.includes('phone'));
        let colTempat = headerRow.findIndex((h) => h.includes('tempat') || h.includes('tmp') || h.includes('kota'));
        let colTanggal = headerRow.findIndex((h) => h.includes('tanggal') || h.includes('tgl') || h.includes('lahir') || h.includes('birth'));

        // Jika colKelas belum terdeteksi dari teks header, telusuri isi sel data untuk mencari kolom format kelas
        if (colKelas === -1) {
          const sampleRows = jsonData.slice(headerRowIndex + 1, headerRowIndex + 8);
          for (let c = 0; c < (jsonData[headerRowIndex] || []).length; c++) {
            let classPatternMatches = 0;
            for (const sr of sampleRows) {
              const val = String(sr[c] || '').trim();
              if (/^(?:kelas\s*)?([0-9]{1,2}|vii|viii|ix|vi|iv|v|iii|ii|i)\s*[\-_]?\s*(?:mts|smp)?\s*([a-z])?$/i.test(val)) {
                classPatternMatches++;
              }
            }
            if (classPatternMatches >= 2) {
              colKelas = c;
              break;
            }
          }
        }

        // Positional fallback jika header tidak teridentifikasi sama sekali
        if (colNama === -1) colNama = 1;
        if (colAbsen === -1) colAbsen = 0;
        if (colNisn === -1) colNisn = 2;

        let sheetCount = 0;
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          const rawName = String(row[colNama] || '').trim();
          if (!rawName || rawName.toLowerCase() === 'nama' || rawName.toLowerCase() === 'nama lengkap' || rawName.toLowerCase() === 'nama siswa') continue;

          // Penyesuaian kelas secara akurat & presisi:
          // 1. Ambil dari kolom 'Kelas' di dalam sheet baris tersebut jika ada isinya
          // 2. Jika kolom kelas kosong/tidak ada, ambil dari nama Sheet yang bersangkutan jika nama sheet adalah nama kelas
          // 3. Jika sheet memuat judul banner kelas di atas
          // 4. Jika sedang difilter ke kelas spesifik di layar admin
          // 5. Default ke 'Kelas 1 A'
          let studentClass = '';
          if (colKelas !== -1 && row[colKelas] && String(row[colKelas]).trim()) {
            studentClass = normalizeClassName(String(row[colKelas]));
          } else if (inferredSheetClass) {
            studentClass = inferredSheetClass;
          } else if (bannerClass) {
            studentClass = bannerClass;
          } else if (selectedClass !== 'Semua Kelas') {
            studentClass = selectedClass;
          } else {
            studentClass = 'Kelas 1 A';
          }

          const rawGender = colGender !== -1 ? String(row[colGender] || 'L').trim().toUpperCase() : 'L';
          const gender = rawGender.startsWith('P') || rawGender.startsWith('W') ? 'P' : 'L';

          studentsToInsert.push({
            absen_number: String(row[colAbsen] || `${sheetCount + 1}`).trim(),
            name: rawName,
            nisn: colNisn !== -1 ? String(row[colNisn] || '').trim() : '',
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
          sheetCount++;
        }

        if (sheetCount > 0) {
          sheetsWithData++;
        }
      }

      if (studentsToInsert.length === 0) {
        showToast('Tidak ada baris data siswa yang valid di seluruh sheet.', 'error');
        setIsImporting(false);
        return;
      }

      // Buka modal konfirmasi / preview impor dengan ringkasan kelas
      setOverrideClass('auto');
      setImportPreview({
        students: studentsToInsert,
        classCounters,
        sheetsCount: sheetsWithData,
        fileName: file.name
      });
    } catch (error: any) {
      console.error(error);
      showToast('Gagal membaca berkas Excel: ' + (error?.message || 'Format tidak valid'), 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCommitImport = async () => {
    if (!importPreview || importPreview.students.length === 0) return;
    setIsImporting(true);
    try {
      const studentsRef = collection(db, 'students');
      const finalStudents = importPreview.students.map(s => {
        if (overrideClass && overrideClass !== 'auto') {
          return { ...s, classId: overrideClass };
        }
        return s;
      });

      // Hitung ringkasan final
      const finalCounters: Record<string, number> = {};
      finalStudents.forEach(s => {
        finalCounters[s.classId] = (finalCounters[s.classId] || 0) + 1;
      });

      // Simpan dalam batch per 400 dokumen
      const chunkSize = 400;
      for (let i = 0; i < finalStudents.length; i += chunkSize) {
        const chunk = finalStudents.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const item of chunk) {
          const newDocRef = doc(studentsRef);
          batch.set(newDocRef, item);
        }
        await batch.commit();
      }

      const classSummary = Object.entries(finalCounters)
        .map(([cls, count]) => `${cls} (${count} siswa)`)
        .join(', ');

      showToast(
        `Alhamdulillah! Berhasil mengimpor ${finalStudents.length} siswa! Otomatis terbagi ke: ${classSummary}.`,
        'success'
      );
      setImportPreview(null);
    } catch (err: any) {
      console.error(err);
      showToast('Gagal menyimpan data siswa: ' + (err.message || 'Terjadi kesalahan sistem'), 'error');
    } finally {
      setIsImporting(false);
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

  // Daftar seluruh kelas dengan jumlah siswa terdaftar saat ini
  const availableClassesWithCount = useMemo(() => {
    const list: Array<{ className: string; count: number }> = [];
    const visited = new Set<string>();

    // Masukkan kelas yang sudah ada siswa di sistem
    Object.entries(allClassCounts).forEach(([className, count]) => {
      list.push({ className, count });
      visited.add(className);
    });

    // Masukkan kelas dari master list jika belum ada
    ALL_AVAILABLE_CLASSES.forEach((c) => {
      if (!visited.has(c)) {
        list.push({ className: c, count: 0 });
        visited.add(c);
      }
    });

    return list.sort((a, b) => {
      if (a.count > 0 && b.count === 0) return -1;
      if (a.count === 0 && b.count > 0) return 1;
      return a.className.localeCompare(b.className, undefined, { numeric: true });
    });
  }, [allClassCounts]);

  const handleOpenResetModal = () => {
    const classesWithStudents = Object.keys(allClassCounts).filter(c => (allClassCounts[c] || 0) > 0);
    const initialClass = selectedClass !== 'Semua Kelas' 
      ? selectedClass 
      : (classesWithStudents[0] || 'Kelas 1 A');
    setTargetClassToReset(initialClass);
    setConfirmResetChecked(false);
    setIsResetPerClassModalOpen(true);
  };

  const executeResetClass = async () => {
    if (!targetClassToReset) return;
    setIsDeleting(true);
    try {
      // 1. Ambil seluruh siswa di kelas target
      const qStudents = query(collection(db, 'students'), where('classId', '==', targetClassToReset));
      const snapStudents = await getDocs(qStudents);
      const studentIds = snapStudents.docs.map(d => d.id);

      // Hapus data siswa & rapor (chunking for batch limit 500)
      for (let i = 0; i < snapStudents.docs.length; i += 200) {
        const chunk = snapStudents.docs.slice(i, i + 200);
        const batch = writeBatch(db);
        for (const st of chunk) {
          batch.delete(st.ref);
          batch.delete(doc(db, 'grades', st.id));
        }
        await batch.commit();
      }

      // 2. Hapus absensi kelas target
      const qAtt = query(collection(db, 'attendance'), where('classId', '==', targetClassToReset));
      const snapAtt = await getDocs(qAtt);
      for (let i = 0; i < snapAtt.docs.length; i += 400) {
        const chunk = snapAtt.docs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // 3. Hapus pengumpulan tugas siswa kelas target
      const qSubs = query(collection(db, 'pengumpulan_tugas'), where('classId', '==', targetClassToReset));
      const snapSubs = await getDocs(qSubs);
      for (let i = 0; i < snapSubs.docs.length; i += 400) {
        const chunk = snapSubs.docs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      showToast(`Data siswa kelas ${targetClassToReset} (${studentIds.length} siswa) beserta nilai dan absensinya berhasil direset & dihapus bersih! Kelas lain tetap aman.`, 'success');
      setIsResetPerClassModalOpen(false);
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
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition-all font-bold text-sm shadow-sm shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
            title="Impor data siswa sekaligus dari template atau lembar kerja Excel (Otomatis menyesuaikan kelas)"
          >
            {isImporting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            <span>{isImporting ? 'Membaca Data Excel...' : 'Impor Data Siswa'}</span>
          </button>
          
          <button 
            onClick={handleOpenResetModal}
            disabled={isDeleting}
            className="flex items-center space-x-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-xl transition-all font-semibold text-sm cursor-pointer shadow-xs disabled:opacity-50"
            title="Pilih kelas tertentu untuk mereset atau menghapus seluruh data siswanya"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Hapus Data Per Kelas</span>
          </button>

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

      {/* Modal Hapus / Reset Data Siswa Per Kelas */}
      {isResetPerClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">Reset Data Siswa Per Kelas</h2>
                  <p className="text-xs text-slate-500">Pilih kelas yang ingin dihapus atau dibersihkan</p>
                </div>
              </div>
              <button 
                onClick={() => setIsResetPerClassModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Pilih Kelas yang Ingin Direset / Dihapus:
                </label>
                <select
                  value={targetClassToReset}
                  onChange={(e) => setTargetClassToReset(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {availableClassesWithCount.map(({ className, count }) => (
                    <option key={className} value={className}>
                      {className} — ({count} Siswa Terdaftar)
                    </option>
                  ))}
                </select>
              </div>

              {/* Info Card Rincian Dampak Reset */}
              <div className="p-4 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-rose-900 dark:text-rose-200">
                  <span>Target Penghapusan:</span>
                  <span className="px-2.5 py-0.5 bg-rose-200/80 dark:bg-rose-900 text-rose-800 dark:text-rose-100 rounded-lg">{targetClassToReset}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
                  <span>Jumlah Siswa Terhapus:</span>
                  <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">{allClassCounts[targetClassToReset] || 0} Siswa</span>
                </div>
                <div className="text-[11px] text-rose-700 dark:text-rose-300/80 leading-relaxed pt-1 border-t border-rose-200/60 dark:border-rose-900/40">
                  ⚠️ Tindakan ini akan menghapus <strong>seluruh data siswa {targetClassToReset}</strong> beserta catatan rapor, absensi, dan nilai tugas kelas ini secara permanen. 
                  <span className="block mt-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                    ✓ Siswa di kelas lain tidak akan tersentuh dan tetap 100% aman.
                  </span>
                </div>
              </div>

              {/* Konfirmasi Checkbox */}
              <div className="flex items-start space-x-2.5 pt-1">
                <input
                  type="checkbox"
                  id="confirmResetPerClassCheck"
                  checked={confirmResetChecked}
                  onChange={(e) => setConfirmResetChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-rose-600 rounded-md border-slate-300 focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="confirmResetPerClassCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Saya yakin dan mengonfirmasi ingin menghapus seluruh data siswa di <strong>{targetClassToReset}</strong>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetPerClassModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeResetClass}
                disabled={!confirmResetChecked || isDeleting}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-sm shadow-rose-600/30 cursor-pointer"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{isDeleting ? 'Mereset...' : `Hapus Data ${targetClassToReset}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tinjau / Konfirmasi Impor Data Siswa Sekaligus */}
      {importPreview && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">Tinjau & Konfirmasi Impor Siswa</h2>
                  <p className="text-xs text-slate-500">Berkas: {importPreview.fileName} ({importPreview.sheetsCount} sheet terbaca)</p>
                </div>
              </div>
              <button 
                onClick={() => setImportPreview(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto space-y-4 flex-1">
              {/* Ringkasan Kelas Terdeteksi */}
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Total Terdeteksi: <span className="text-emerald-600 font-extrabold">{importPreview.students.length} Siswa</span> terbagi ke kelas:
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(importPreview.classCounters).map(([cls, count]) => (
                    <div key={cls} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <span>{cls}:</span>
                      <span className="bg-emerald-600 text-white px-1.5 py-0.2 rounded-md text-[11px]">{count} siswa</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opsi Penyesuaian Kelas Sasaran */}
              <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl">
                <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-1.5">
                  Penyesuaian Penempatan Kelas:
                </label>
                <select
                  value={overrideClass}
                  onChange={(e) => setOverrideClass(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-xl text-xs font-semibold text-indigo-900 dark:text-indigo-200 outline-none"
                >
                  <option value="auto">✨ Otomatis Sesuai Kolom 'Kelas' & Nama Sheet Masing-Masing (Direkomendasikan)</option>
                  <optgroup label="Atau Paksa Seluruh Siswa Masuk ke Kelas Spesifik:">
                    {ALL_AVAILABLE_CLASSES.map(cls => (
                      <option key={cls} value={cls}>Semua Siswa Dimasukkan ke: {cls}</option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1">
                  {overrideClass === 'auto' 
                    ? 'Siswa akan terdistribusi otomatis sesuai kelas yang tertulis di sheet atau kolom kelas masing-masing.'
                    : `Perhatian: Seluruh ${importPreview.students.length} siswa akan ditempatkan ke dalam ${overrideClass}.`}
                </p>
              </div>

              {/* Preview 5 Sampel Siswa */}
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Sampel Data Siswa Terbaca:</p>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 font-semibold">No</th>
                        <th className="px-3 py-2 font-semibold">Nama Siswa</th>
                        <th className="px-3 py-2 font-semibold">NISN</th>
                        <th className="px-3 py-2 font-semibold">Kelas</th>
                        <th className="px-3 py-2 font-semibold">L/P</th>
                        <th className="px-3 py-2 font-semibold">Kontak Wali</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {importPreview.students.slice(0, 6).map((st, sIdx) => (
                        <tr key={sIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400">{st.absen_number || sIdx + 1}</td>
                          <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{st.name}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{st.nisn || '-'}</td>
                          <td className="px-3 py-2 font-semibold text-indigo-600 dark:text-indigo-400">
                            {overrideClass === 'auto' ? st.classId : overrideClass}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{st.gender}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{st.parentPhone || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.students.length > 6 && (
                    <div className="p-2 bg-slate-50 dark:bg-slate-800/40 text-center text-[11px] text-slate-500">
                      ... dan {importPreview.students.length - 6} siswa lainnya siap dimasukkan ke sistem.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={isImporting}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shadow-sm shadow-emerald-600/30 cursor-pointer"
              >
                {isImporting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span>{isImporting ? 'Menyimpan...' : `Simpan & Impor ${importPreview.students.length} Siswa Sekarang`}</span>
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
                <div className="w-full">
                  <ClassSelectWithCustom
                    label="Kelas"
                    value={formData.classId}
                    onChange={(val) => setFormData({...formData, classId: val})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-semibold text-slate-700"
                  />
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
