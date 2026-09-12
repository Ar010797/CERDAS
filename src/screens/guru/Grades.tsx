import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { FileDown, Save, Edit2, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/activity';

interface Student {
  id: string;
  nisn: string;
  absen_number: string;
  name: string;
  classId: string;
}

export default function GradesGuru() {
  const { userData } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, Record<string, { tugas: string; pts: string; pas: string }>>>({});
  const [subjects, setSubjects] = useState<string[]>([]);
  const [schoolSettings, setSchoolSettings] = useState({ namaSekolah: 'SI Miftahussalam', namaKepalaSekolah: '', nipKepalaSekolah: '' });
  
  const [loading, setLoading] = useState(true);
  
  // Modal Edit Grade State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [tempGrades, setTempGrades] = useState<Record<string, { tugas: string; pts: string; pas: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const assignedClass = userData?.assigned_class || 'Kelas 1';
    
    // Listen to Students
    const qStudents = query(collection(db, 'students'), where('classId', '==', assignedClass));
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
        gradesData[data.studentId] = data.gradesBySubject || {};
      });
      setGrades(gradesData);
      setLoading(false);
    });

    // Listen to Subjects
    const unsubSubjects = onSnapshot(doc(db, 'mata_pelajaran', assignedClass), (docSnap) => {
      if (docSnap.exists()) {
        setSubjects(docSnap.data().subjects || []);
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
  }, [userData]);

  const openGradeModal = (student: Student) => {
    setEditingStudent(student);
    const existingGrades = grades[student.id] || {};
    
    // Initialize temp grades for all subjects
    const initTemp: any = {};
    subjects.forEach(subj => {
      initTemp[subj] = existingGrades[subj] || { tugas: '', pts: '', pas: '' };
    });
    setTempGrades(initTemp);
    setIsModalOpen(true);
  };

  const handleTempGradeChange = (subj: string, type: 'tugas' | 'pts' | 'pas', value: string) => {
    setTempGrades(prev => ({
      ...prev,
      [subj]: {
        ...prev[subj],
        [type]: value
      }
    }));
  };

  const handleSaveGrades = async () => {
    if (!editingStudent) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'grades', editingStudent.id), {
        studentId: editingStudent.id,
        gradesBySubject: tempGrades,
        academicYearId: 'active'
      }, { merge: true });

      if (userData) {
        await logActivity(userData.name, userData.assigned_class || 'Kelas ?', `Memasukkan Nilai ${editingStudent.name}`);
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan nilai.');
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = (student: Student) => {
    const studentGrades = grades[student.id] || {};
    const pdf = new jsPDF();

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
    const tableBody = subjects.map(subj => {
      const g = studentGrades[subj] || { tugas: '-', pts: '-', pas: '-' };
      return [subj, g.tugas || '-', g.pts || '-', g.pas || '-'];
    });

    if (tableBody.length === 0) {
      tableBody.push(['Belum ada mata pelajaran', '-', '-', '-']);
    }

    // Tabel Nilai
    autoTable(pdf, {
      startY: 65,
      head: [['Mata Pelajaran', 'Nilai Tugas', 'Nilai PTS', 'Nilai PAS']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    // Tanda Tangan
    const finalY = (pdf as any).lastAutoTable.finalY || 100;
    
    // Check page break for signature
    if (finalY > 230) {
      pdf.addPage();
    }
    const signatureY = finalY > 230 ? 20 : finalY;

    pdf.setFont("helvetica", "normal");
    pdf.text('Mengetahui,', 40, signatureY + 30, { align: 'center' });
    pdf.text('Kepala Sekolah', 40, signatureY + 38, { align: 'center' });
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`${schoolSettings.namaKepalaSekolah || '________________________'}`, 40, signatureY + 60, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    
    if(schoolSettings.nipKepalaSekolah) {
      pdf.text(`NIP. ${schoolSettings.nipKepalaSekolah}`, 40, signatureY + 65, { align: 'center' });
    } else {
      pdf.text(`NIP. __________________`, 40, signatureY + 65, { align: 'center' });
    }

    pdf.text(`${schoolSettings.namaSekolah || 'Sekolah'}, ${new Date().toLocaleDateString('id-ID')}`, 160, signatureY + 30, { align: 'center' });
    pdf.text('Wali Kelas', 160, signatureY + 38, { align: 'center' });
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`${userData?.name || '________________________'}`, 160, signatureY + 60, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    pdf.text(`NIP. __________________`, 160, signatureY + 65, { align: 'center' });

    pdf.save(`Rapor_${student.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Penilaian & E-Rapor</h1>
          <p className="text-sm text-slate-500 mt-1">Mengelola nilai: {userData?.assigned_class}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-sm text-slate-500">
                <th className="px-6 py-4 font-medium">No. Absen</th>
                <th className="px-6 py-4 font-medium">NISN</th>
                <th className="px-6 py-4 font-medium">Nama Lengkap</th>
                <th className="px-6 py-4 font-medium text-center">Status Nilai</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Memuat data...</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Belum ada data siswa di kelas ini.</td>
                </tr>
              ) : (
                students.map((student) => {
                  const sGrades = grades[student.id];
                  const hasSomeGrades = sGrades && Object.keys(sGrades).length > 0;
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-700">{student.absen_number || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{student.nisn}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">{student.name}</td>
                      <td className="px-6 py-4 text-sm text-center">
                        {hasSomeGrades ? (
                           <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">Terisi</span>
                        ) : (
                           <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700">Belum Diisi</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-right space-x-2">
                        <button 
                          onClick={() => openGradeModal(student)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors font-medium"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span>Input Nilai</span>
                        </button>
                        <button 
                          onClick={() => exportPDF(student)}
                          className="inline-flex items-center space-x-1 p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Cetak E-Rapor PDF"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grade Modal */}
      {isModalOpen && editingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Input Nilai: {editingStudent.name}</h2>
                <p className="text-sm text-slate-500">{editingStudent.nisn} | No. Absen: {editingStudent.absen_number || '-'}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {subjects.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>Belum ada mata pelajaran yang diatur untuk kelas ini.</p>
                  <p className="text-sm mt-1">Silakan tambah mata pelajaran di Menu "Pengaturan Kelas".</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 pb-2 border-b border-slate-100 text-sm font-medium text-slate-500">
                    <div className="col-span-5">Mata Pelajaran</div>
                    <div className="col-span-2 text-center">Tugas</div>
                    <div className="col-span-2 text-center">PTS</div>
                    <div className="col-span-2 text-center">PAS</div>
                  </div>
                  
                  {subjects.map(subj => (
                    <div key={subj} className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-5 text-sm font-medium text-slate-700">{subj}</div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="0-100"
                          value={tempGrades[subj]?.tugas || ''}
                          onChange={(e) => handleTempGradeChange(subj, 'tugas', e.target.value)}
                          className="w-full px-2 py-1.5 text-center bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="0-100"
                          value={tempGrades[subj]?.pts || ''}
                          onChange={(e) => handleTempGradeChange(subj, 'pts', e.target.value)}
                          className="w-full px-2 py-1.5 text-center bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="0-100"
                          value={tempGrades[subj]?.pas || ''}
                          onChange={(e) => handleTempGradeChange(subj, 'pas', e.target.value)}
                          className="w-full px-2 py-1.5 text-center bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveGrades}
                disabled={saving || subjects.length === 0}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Simpan Nilai</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
