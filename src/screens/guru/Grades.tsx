import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { FileDown, Save, Edit2, X, Plus, Trash2, Filter, Settings, Check, RefreshCw, Sparkles } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/activity';
import { syncAllClassAssignmentGrades } from '../../lib/gradeSync';
import RaporPreviewModal, { RaporStudentInfo } from '../../components/RaporPreviewModal';
import { ALL_AVAILABLE_CLASSES, CLASS_GROUPS } from '../../lib/schoolClasses';

interface Student {
  id: string;
  nisn: string;
  absen_number: string;
  name: string;
  classId: string;
}

interface GradeSubject {
  tugas: string[];
  ulanganHarian?: string[];
  pts: string;
  pas: string;
}

const CLASSES_LIST = ALL_AVAILABLE_CLASSES;

export default function GradesGuru() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';
  
  const [selectedClass, setSelectedClass] = useState(
    isAdmin ? 'Kelas 1 A' : (userData?.assigned_class || 'Kelas 1 A')
  );
  
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, Record<string, GradeSubject>>>({});
  const [subjects, setSubjects] = useState<string[]>([]);
  const [kkmMap, setKkmMap] = useState<Record<string, number>>({});
  const [isKkmModalOpen, setIsKkmModalOpen] = useState(false);
  const [savingKkm, setSavingKkm] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<any>({ namaSekolah: 'CERDAS', namaKepalaSekolah: '', nipKepalaSekolah: '', kkmGlobal: '75' });
  const [previewStudent, setPreviewStudent] = useState<RaporStudentInfo | null>(null);
  
  const [loading, setLoading] = useState(true);

  const getSubjectKKM = (subj: string): number => {
    if (kkmMap && kkmMap[subj] !== undefined && Number(kkmMap[subj]) > 0) {
      return Number(kkmMap[subj]);
    }
    if (schoolSettings?.kkmMap?.[subj] !== undefined && Number(schoolSettings.kkmMap[subj]) > 0) {
      return Number(schoolSettings.kkmMap[subj]);
    }
    return Number(schoolSettings?.kkmGlobal) || 75;
  };
  
  // Modal Edit Grade State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [tempGrades, setTempGrades] = useState<Record<string, GradeSubject>>({});
  const [saving, setSaving] = useState(false);
  const [syncingAssignments, setSyncingAssignments] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const handleSyncAssignments = async () => {
    setSyncingAssignments(true);
    setSyncNotice(null);
    try {
      const res = await syncAllClassAssignmentGrades(selectedClass);
      if (res.success) {
        setSyncNotice(`Berhasil menyinkronkan ${res.totalSubmissionsSynced} nilai tugas untuk ${res.syncedStudentsCount} siswa ke dalam rapor!`);
      } else {
        setSyncNotice(`Pemberitahuan: ${res.error || 'Gagal sinkron'}`);
      }
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err: any) {
      setSyncNotice('Gagal menyinkronkan nilai tugas: ' + (err.message || ''));
      setTimeout(() => setSyncNotice(null), 5000);
    } finally {
      setSyncingAssignments(false);
    }
  };
  
  // We can track the max number of tugas per subject to render columns
  const [tugasCountPerSubject, setTugasCountPerSubject] = useState<Record<string, number>>({});

  useEffect(() => {
    setLoading(true);
    
    // Listen to Students
    const qStudents = query(collection(db, 'students'), where('classId', '==', selectedClass));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const studentsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      studentsData.sort((a, b) => (parseInt(a.absen_number) || 0) - (parseInt(b.absen_number) || 0));
      setStudents(studentsData);
    });

    // Listen to Grades
    const unsubGrades = onSnapshot(collection(db, 'grades'), (snap) => {
      const gradesData: any = {};
      snap.forEach(d => {
        const data = d.data();
        
        // Normalize legacy data: { tugas: string } to { tugas: string[] }
        const normalizedGrades: any = {};
        if (data.gradesBySubject) {
          for (const [subj, g] of Object.entries<any>(data.gradesBySubject)) {
             normalizedGrades[subj] = {
               ...g,
               tugas: Array.isArray(g.tugas) ? g.tugas : (g.tugas ? [g.tugas] : []),
               ulanganHarian: Array.isArray(g.ulanganHarian) ? g.ulanganHarian : (g.ulanganHarian ? [g.ulanganHarian] : [])
             };
          }
        }
        
        gradesData[data.studentId] = normalizedGrades;
      });
      setGrades(gradesData);
      setLoading(false);
    });

    // Listen to Subjects
    const unsubSubjects = onSnapshot(doc(db, 'mata_pelajaran', selectedClass), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSubjects(data.subjects || []);
        setKkmMap(data.kkmMap || {});
      } else {
        setSubjects([]);
        setKkmMap({});
      }
    });

    // Listen to School Settings
    const unsubSchool = onSnapshot(doc(db, 'pengaturan_sekolah', 'utama'), (docSnap) => {
      if (docSnap.exists()) {
        setSchoolSettings(docSnap.data() as any);
      }
    });

    return () => {
      unsubStudents();
      unsubGrades();
      unsubSubjects();
      unsubSchool();
    };
  }, [selectedClass]);

  useEffect(() => {
    // Calculate max tugas count per subject for the table header
    const counts: Record<string, number> = {};
    subjects.forEach(subj => {
       let max = 1; // minimum 1 tugas column
       students.forEach(student => {
         const g = grades[student.id]?.[subj];
         if (g && g.tugas && g.tugas.length > max) {
           max = g.tugas.length;
         }
       });
       counts[subj] = max;
    });
    setTugasCountPerSubject(counts);
  }, [subjects, grades, students]);

  const openGradeModal = (student: Student) => {
    setEditingStudent(student);
    const existingGrades = grades[student.id] || {};
    
    const initTemp: Record<string, GradeSubject> = {};
    subjects.forEach(subj => {
      const g = existingGrades[subj] || { tugas: [''], ulanganHarian: [''], pts: '', pas: '' };
      initTemp[subj] = {
        tugas: [...(g.tugas?.length > 0 ? g.tugas : [''])],
        ulanganHarian: [...(g.ulanganHarian?.length > 0 ? g.ulanganHarian : [''])],
        pts: g.pts || '',
        pas: g.pas || ''
      };
    });
    setTempGrades(initTemp);
    setIsModalOpen(true);
  };

  const handleTempGradeChange = (subj: string, type: 'pts' | 'pas', value: string) => {
    setTempGrades(prev => ({
      ...prev,
      [subj]: {
        ...prev[subj],
        [type]: value
      }
    }));
  };

  const handleTugasChange = (subj: string, index: number, value: string) => {
    setTempGrades(prev => {
      const newTugas = [...prev[subj].tugas];
      newTugas[index] = value;
      return {
        ...prev,
        [subj]: {
          ...prev[subj],
          tugas: newTugas
        }
      };
    });
  };

  const handleAddTugas = (subj: string) => {
    setTempGrades(prev => ({
      ...prev,
      [subj]: {
        ...prev[subj],
        tugas: [...prev[subj].tugas, '']
      }
    }));
  };

  const handleRemoveTugas = (subj: string, index: number) => {
    setTempGrades(prev => {
      const newTugas = [...prev[subj].tugas];
      newTugas.splice(index, 1);
      return {
        ...prev,
        [subj]: {
          ...prev[subj],
          tugas: newTugas.length > 0 ? newTugas : ['']
        }
      };
    });
  };

  const handleUlanganHarianChange = (subj: string, index: number, value: string) => {
    setTempGrades(prev => {
      const newUh = [...prev[subj].ulanganHarian];
      newUh[index] = value;
      return {
        ...prev,
        [subj]: {
          ...prev[subj],
          ulanganHarian: newUh
        }
      };
    });
  };

  const handleAddUlanganHarian = (subj: string) => {
    setTempGrades(prev => ({
      ...prev,
      [subj]: {
        ...prev[subj],
        ulanganHarian: [...(prev[subj].ulanganHarian || []), '']
      }
    }));
  };

  const handleRemoveUlanganHarian = (subj: string, index: number) => {
    setTempGrades(prev => {
      const newUh = [...prev[subj].ulanganHarian];
      newUh.splice(index, 1);
      return {
        ...prev,
        [subj]: {
          ...prev[subj],
          ulanganHarian: newUh.length > 0 ? newUh : ['']
        }
      };
    });
  };

  const handleSaveGrades = async () => {
    if (!editingStudent) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'grades', editingStudent.id), {
        studentId: editingStudent.id,
        gradesBySubject: tempGrades,
        academicYearId: 'active' // could be dynamic
      }, { merge: true });

      if (userData) {
        await logActivity(userData.name, userData.assigned_class || 'Admin', `Memasukkan Nilai ${editingStudent.name}`);
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan nilai.');
    } finally {
      setSaving(false);
    }
  };

  const calculateAverage = (g: GradeSubject) => {
     let sum = 0;
     let count = 0;
     
     // Avg of tugas
     const tugasScores = (g.tugas || []).map(t => parseFloat(t)).filter(t => !isNaN(t));
     let tugasAvg = 0;
     if (tugasScores.length > 0) {
       tugasAvg = tugasScores.reduce((a,b) => a+b, 0) / tugasScores.length;
       sum += tugasAvg;
       count++;
     }
     
     // Avg of ulangan harian
     const uhScores = (g.ulanganHarian || []).map(t => parseFloat(t)).filter(t => !isNaN(t));
     let uhAvg = 0;
     if (uhScores.length > 0) {
       uhAvg = uhScores.reduce((a,b) => a+b, 0) / uhScores.length;
       sum += uhAvg;
       count++;
     }
     
     const pts = parseFloat(g.pts);
     if (!isNaN(pts)) { sum += pts; count++; }
     
     const pas = parseFloat(g.pas);
     if (!isNaN(pas)) { sum += pas; count++; }
     
     return count > 0 ? (sum / count) : 0;
  };

  const exportPDF = (student: Student) => {
    const studentGrades = grades[student.id] || {};
    const pdf = new jsPDF();
    const kkm = schoolSettings?.kkmGlobal || 75; // Use KKM from settings or default to 75

    // Header
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text((schoolSettings.namaSekolah || 'SEKOLAH').toUpperCase(), 105, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text('LAPORAN HASIL BELAJAR (RAPOR)', 105, 28, { align: 'center' });
    
    pdf.setLineWidth(0.5);
    pdf.line(20, 32, 190, 32);

    // Data Siswa
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Nama Peserta Didik`, 20, 45); pdf.text(`: ${student.name}`, 70, 45);
    pdf.text(`Nomor Induk / NISN`, 20, 52); pdf.text(`: ${student.absen_number} / ${student.nisn}`, 70, 52);
    pdf.text(`Kelas`, 130, 45); pdf.text(`: ${student.classId}`, 160, 45);
    pdf.text(`Tahun Ajaran`, 130, 52); pdf.text(`: ${userData?.academicYear || '2026/2027'}`, 160, 52);

    // Prepare Table Data
    let totalScore = 0;
    
    // Header for table
    const head = [['No', 'Mata Pelajaran', 'KKM', 'Tugas', 'UH', 'PTS', 'PAS', 'Nilai Akhir']];
    
    const tableBody = subjects.map((subj, idx) => {
      const g = studentGrades[subj] || { tugas: [], ulanganHarian: [], pts: '', pas: '' };
      const avg = calculateAverage(g);
      totalScore += avg;
      const subjKKM = getSubjectKKM(subj);
      
      const tugasScores = (g.tugas || []).map(t => parseFloat(t)).filter(t => !isNaN(t));
      const tugasAvg = tugasScores.length > 0 ? (tugasScores.reduce((a,b)=>a+b,0)/tugasScores.length).toFixed(1) : '-';

      const uhScores = (g.ulanganHarian || []).map(t => parseFloat(t)).filter(t => !isNaN(t));
      const uhAvg = uhScores.length > 0 ? (uhScores.reduce((a,b)=>a+b,0)/uhScores.length).toFixed(1) : '-';

      return [
        (idx + 1).toString(),
        subj,
        subjKKM.toString(),
        tugasAvg,
        uhAvg,
        g.pts || '-',
        g.pas || '-',
        avg > 0 ? avg.toFixed(1) : '-'
      ];
    });

    if (tableBody.length === 0) {
      tableBody.push(['-', 'Belum ada mata pelajaran', '-', '-', '-', '-', '-', '-']);
    }
    
    // Add Summary Row
    const finalAvg = tableBody.length > 0 ? (totalScore / subjects.length) : 0;
    tableBody.push([
      '', 
      'JUMLAH NILAI', 
      '', '', '', '', '', 
      totalScore > 0 ? totalScore.toFixed(1) : '-'
    ]);
    tableBody.push([
      '', 
      'RATA-RATA', 
      '', '', '', '', '', 
      finalAvg > 0 ? finalAvg.toFixed(1) : '-'
    ]);

    // Tabel Nilai
    autoTable(pdf, {
      startY: 65,
      head: head,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' }, // No
        1: { cellWidth: 45 }, // Mapel
        2: { halign: 'center' }, // KKM
        3: { halign: 'center' }, // Tugas
        4: { halign: 'center' }, // UH
        5: { halign: 'center' }, // PTS
        6: { halign: 'center' }, // PAS
        7: { halign: 'center', fontStyle: 'bold' }, // Nilai Akhir
      }
    });

    // Tanda Tangan
    const finalY = (pdf as any).lastAutoTable.finalY || 100;
    
    if (finalY > 230) {
      pdf.addPage();
    }
    const signatureY = finalY > 230 ? 20 : finalY + 20;

    pdf.setFont("helvetica", "normal");
    pdf.text('Mengetahui,', 40, signatureY, { align: 'center' });
    pdf.text('Kepala Sekolah', 40, signatureY + 6, { align: 'center' });

    // Bubuhkan Tanda Tangan Digital Kepala Sekolah
    if (schoolSettings.tandaTanganKepalaSekolah) {
      try {
        pdf.addImage(schoolSettings.tandaTanganKepalaSekolah, 'PNG', 26, signatureY + 7, 28, 16);
      } catch (err) {
        console.warn('Gagal menambahkan tanda tangan digital ke PDF:', err);
      }
    }

    // Bubuhkan Stempel Resmi Sekolah
    if (schoolSettings.stempelSekolah) {
      try {
        pdf.addImage(schoolSettings.stempelSekolah, 'PNG', 19, signatureY + 6, 22, 22);
      } catch (err) {
        console.warn('Gagal menambahkan stempel resmi ke PDF:', err);
      }
    }
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`${schoolSettings.namaKepalaSekolah || '________________________'}`, 40, signatureY + 25, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    
    if(schoolSettings.nipKepalaSekolah) {
      pdf.text(`NIP. ${schoolSettings.nipKepalaSekolah}`, 40, signatureY + 30, { align: 'center' });
    } else {
      pdf.text(`NIP. __________________`, 40, signatureY + 30, { align: 'center' });
    }

    pdf.text(`${schoolSettings.namaSekolah || 'Sekolah'}, ${new Date().toLocaleDateString('id-ID')}`, 160, signatureY, { align: 'center' });
    pdf.text('Wali Kelas', 160, signatureY + 6, { align: 'center' });
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`${isAdmin ? '________________________' : (userData?.name || '________________________')}`, 160, signatureY + 25, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    pdf.text(`NIP. __________________`, 160, signatureY + 30, { align: 'center' });

    pdf.save(`Rapor_${student.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Manajemen Nilai & Rapor</h1>
        <p className="text-indigo-100 text-sm mt-1 max-w-xl">
          Kelola nilai tugas, PTS, dan PAS siswa. Cetak otomatis ke PDF dalam bentuk Laporan Hasil Belajar.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-850 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-3">
             {isAdmin ? (
               <div className="flex items-center space-x-2">
                 <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                 <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
                  >
                    {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
               </div>
             ) : (
               <>
                 <div className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm">
                   {selectedClass}
                 </div>
                 <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                   Total {students.length} Siswa
                 </span>
               </>
             )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSyncAssignments}
              disabled={syncingAssignments}
              className="flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2 rounded-xl transition-all font-bold text-xs cursor-pointer shadow-2xs active:scale-95"
              title="Tarik seluruh nilai tugas dan kuis online siswa yang telah dinilai langsung ke dalam tabel rapor"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAssignments ? 'animate-spin' : ''}`} />
              <span>{syncingAssignments ? 'Menyinkronkan...' : 'Sinkronkan Nilai Tugas ke Rapor'}</span>
            </button>
            <button
              onClick={() => setIsKkmModalOpen(true)}
              className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl transition-colors font-medium text-xs cursor-pointer shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-500" />
              <span>Atur KKM Mapel</span>
            </button>
            <button
              onClick={() => {
                students.forEach(s => exportPDF(s));
              }}
              className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-xl transition-colors font-medium text-sm cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Cetak Semua Rapor</span>
            </button>
          </div>
        </div>

        {syncNotice && (
          <div className="mx-4 my-3 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
            <span>✨ {syncNotice}</span>
            <button onClick={() => setSyncNotice(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">✕</button>
          </div>
        )}

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                  <th className="px-6 py-4 font-medium w-16 text-center">No</th>
                  <th className="px-6 py-4 font-medium">Nama Siswa</th>
                  {subjects.length === 0 ? (
                    <th className="px-6 py-4 font-medium text-center text-red-500">Mata pelajaran belum diatur</th>
                  ) : (
                    <th className="px-6 py-4 font-medium text-center">Rata-rata Kelas (Total)</th>
                  )}
                  <th className="px-6 py-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student, index) => {
                  const studentGrades = grades[student.id] || {};
                  let sum = 0;
                  let count = 0;
                  subjects.forEach(s => {
                     const g = studentGrades[s] || { tugas: [], ulanganHarian: [], pts: '', pas: '' };
                     const avg = calculateAverage(g);
                     if (avg > 0) {
                        sum += avg;
                        count++;
                     }
                  });
                  const finalAvg = count > 0 ? (sum / count) : 0;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-400 text-center">{student.absen_number || index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 dark:text-white">{student.name}</div>
                        <div className="text-xs text-slate-400 font-medium mt-0.5">NISN: {student.nisn}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-200 text-center">
                         {finalAvg > 0 ? (
                           <span className={`px-2 py-1 rounded-md ${finalAvg >= 75 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'}`}>
                             {finalAvg.toFixed(1)}
                           </span>
                         ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openGradeModal(student)}
                          className="p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-colors inline-flex items-center"
                          title="Input Nilai"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setPreviewStudent({
                              id: student.id,
                              name: student.name,
                              nisn: student.nisn,
                              absen_number: student.absen_number,
                              classId: student.classId || selectedClass
                            });
                          }}
                          className="p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-colors inline-flex items-center font-bold text-xs gap-1"
                          title="Tinjau Dulu & Unduh PDF Rapor"
                        >
                          <FileDown className="w-4 h-4" />
                          <span className="hidden sm:inline">Tinjau Rapor</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      Belum ada siswa di kelas ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Input Nilai */}
      {isModalOpen && editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-850 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Input Nilai: {editingStudent.name}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Kelas {editingStudent.classId} • NISN {editingStudent.nisn}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900/50">
              <div className="space-y-6">
                {subjects.map((subj) => {
                  const currentGrade = tempGrades[subj] || { tugas: [''], ulanganHarian: [''], pts: '', pas: '' };
                  return (
                    <div key={subj} className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-indigo-500" />
                           {subj}
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                              onClick={() => handleAddTugas(subj)}
                             className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-indigo-200 dark:border-indigo-800"
                          >
                             <Plus className="w-3.5 h-3.5" />
                             Tambah Tugas
                          </button>
                          <button
                              onClick={() => handleAddUlanganHarian(subj)}
                             className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-emerald-200 dark:border-emerald-800"
                          >
                             <Plus className="w-3.5 h-3.5" />
                             Tambah UH
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Tugas & UH Section */}
                        <div className="md:col-span-8 space-y-4">
                          <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nilai Tugas</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {currentGrade.tugas.map((t, index) => (
                                <div key={`tugas-${index}`} className="relative group">
                                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Tugas {index + 1}</label>
                                  <div className="flex items-center">
                                    <input
                                      type="number"
                                      min="0" max="100"
                                      value={t}
                                      onChange={(e) => handleTugasChange(subj, index, e.target.value)}
                                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm pr-8"
                                      placeholder="0-100"
                                    />
                                    {currentGrade.tugas.length > 1 && (
                                      <button
                                         onClick={() => handleRemoveTugas(subj, index)}
                                        className="absolute right-2 text-slate-400 hover:text-red-500 transition-colors p-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ulangan Harian</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {(currentGrade.ulanganHarian || []).map((t, index) => (
                                <div key={`uh-${index}`} className="relative group">
                                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">UH {index + 1}</label>
                                  <div className="flex items-center">
                                    <input
                                      type="number"
                                      min="0" max="100"
                                      value={t}
                                      onChange={(e) => handleUlanganHarianChange(subj, index, e.target.value)}
                                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm pr-8"
                                      placeholder="0-100"
                                    />
                                    {(currentGrade.ulanganHarian?.length > 1) && (
                                      <button
                                         onClick={() => handleRemoveUlanganHarian(subj, index)}
                                        className="absolute right-2 text-slate-400 hover:text-red-500 transition-colors p-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* PTS & PAS Section */}
                        <div className="md:col-span-4 space-y-3 border-l-0 md:border-l border-slate-100 dark:border-slate-800 md:pl-6 pt-4 md:pt-0">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ujian</p>
                          <div className="grid grid-cols-2 gap-3">
                             <div>
                              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">PTS</label>
                              <input
                                type="number"
                                min="0" max="100"
                                value={currentGrade.pts}
                                onChange={(e) => handleTempGradeChange(subj, 'pts', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                placeholder="0-100"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">PAS</label>
                              <input
                                type="number"
                                min="0" max="100"
                                value={currentGrade.pas}
                                onChange={(e) => handleTempGradeChange(subj, 'pas', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                placeholder="0-100"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850 shrink-0 flex justify-end gap-3 rounded-b-3xl">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveGrades}
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Nilai'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengaturan KKM per Mata Pelajaran */}
      {isKkmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  Target KKM {selectedClass}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Setiap mata pelajaran dapat memiliki target KKM berbeda-beda.
                </p>
              </div>
              <button
                onClick={() => setIsKkmModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {subjects.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Belum ada mata pelajaran untuk {selectedClass}. Silakan tambahkan pada menu Pengaturan Kelas.
                </p>
              ) : (
                subjects.map((subj) => {
                  const val = kkmMap[subj] !== undefined ? kkmMap[subj] : (schoolSettings?.kkmGlobal || 75);
                  return (
                    <div
                      key={subj}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{subj}</p>
                        <p className="text-[11px] text-slate-400">Target kelulusan / ketuntasan</p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
                        <span className="text-[11px] font-bold text-slate-400">KKM:</span>
                        <input
                          type="number"
                          min={50}
                          max={100}
                          value={val}
                          onChange={(e) => {
                            const num = Number(e.target.value);
                            setKkmMap((prev) => ({ ...prev, [subj]: num }));
                          }}
                          className="w-12 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 outline-none bg-transparent"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsKkmModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={savingKkm}
                onClick={async () => {
                  setSavingKkm(true);
                  try {
                    await setDoc(
                      doc(db, 'mata_pelajaran', selectedClass),
                      { kkmMap },
                      { merge: true }
                    );
                    setIsKkmModalOpen(false);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setSavingKkm(false);
                  }
                }}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingKkm ? 'Menyimpan...' : 'Simpan KKM'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tinjau Dulu Rapor Siswa Sebelum Unduh */}
      {previewStudent && (
        <RaporPreviewModal
          isOpen={Boolean(previewStudent)}
          onClose={() => setPreviewStudent(null)}
          student={previewStudent}
          schoolSettings={schoolSettings}
          subjects={subjects}
          gradesData={grades[previewStudent.id || ''] || {}}
          kkmMap={kkmMap}
          academicYear={schoolSettings?.tahunAjaran || '2026/2027'}
          teacherName={userData?.name}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
