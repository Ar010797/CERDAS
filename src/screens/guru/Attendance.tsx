import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Save, Calendar, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/activity';

interface Student {
  id: string;
  nisn: string;
  name: string;
}

type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';

export default function AttendanceGuru() {
  const { userData } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const assignedClass = userData?.assigned_class || 'Kelas 1';
        const qStudents = query(collection(db, 'students'), where('classId', '==', assignedClass));
        const snap = await getDocs(qStudents);
        const studentsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        setStudents(studentsData);
        
        // Initialize default attendance as Hadir
        const initialAtt: Record<string, AttendanceStatus> = {};
        studentsData.forEach(s => {
          initialAtt[s.id] = 'Hadir';
        });
        setAttendance(initialAtt);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (userData) {
      fetchStudents();
    }
  }, [userData]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSaveMassal = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      students.forEach(student => {
        const status = attendance[student.id];
        const docId = `${student.id}_${todayStr}`;
        const ref = doc(db, 'attendance', docId);
        
        batch.set(ref, {
          studentId: student.id,
          date: todayStr,
          status: status,
          academicYearId: 'active'
        }, { merge: true });
      });

      await batch.commit();
      
      if (userData) {
        await logActivity(userData.name, userData.assigned_class || 'Kelas ?', `Mengisi Absen harian (${todayStr})`);
      }
      
      alert('Absensi hari ini berhasil disimpan!');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan absensi.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportRekap = () => {
    const pdf = new jsPDF('landscape');
    
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text('REKAP ABSENSI BULANAN', 140, 20, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text(`Bulan: ${format(new Date(), 'MMMM yyyy', { locale: id })} | ${userData?.assigned_class || ''}`, 140, 26, { align: 'center' });
    
    // Simulate table data (1-5 dates for example)
    const head = [['Nama Siswa', '1', '2', '3', '4', '5', 'H', 'I', 'S', 'A']];
    const body = students.map(s => {
      const isHadirToday = attendance[s.id] === 'Hadir' ? 'H' : attendance[s.id].charAt(0);
      return [
        s.name, 
        isHadirToday, 'H', 'H', 'I', 'H', // dummy dates 1-5
        '4', '1', '0', '0' // dummy totals
      ];
    });

    autoTable(pdf, {
      startY: 35,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 50 },
      }
    });

    const finalY = (pdf as any).lastAutoTable.finalY || 100;
    pdf.text('Mengetahui,', 60, finalY + 20, { align: 'center' });
    pdf.text('Kepala Sekolah', 60, finalY + 28, { align: 'center' });
    pdf.text('(........................)', 60, finalY + 45, { align: 'center' });

    pdf.text(`Kotayasa, ${format(new Date(), 'dd MMMM yyyy', { locale: id })}`, 220, finalY + 20, { align: 'center' });
    pdf.text('Wali Kelas', 220, finalY + 28, { align: 'center' });
    pdf.text(`(${userData?.name || '........................'})`, 220, finalY + 45, { align: 'center' });

    pdf.save(`Rekap_Absen_${format(new Date(), 'MMM_yyyy')}.pdf`);
  };

  const statusColors = {
    'Hadir': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Izin': 'bg-blue-50 text-blue-700 border-blue-200',
    'Sakit': 'bg-amber-50 text-amber-700 border-amber-200',
    'Alpa': 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Absensi Harian</h1>
          <div className="flex items-center space-x-2 text-slate-500 mt-1">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })} - {userData?.assigned_class}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportRekap}
            className="flex items-center space-x-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl transition-colors font-medium text-sm"
          >
            <FileDown className="w-4 h-4" />
            <span>Cetak Rekap PDF</span>
          </button>
          <button
            onClick={handleSaveMassal}
            disabled={saving}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-colors font-medium text-sm shadow-sm shadow-indigo-200"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Menyimpan...' : 'Simpan Absen Massal'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-sm text-slate-500">
                <th className="px-6 py-4 font-medium">Siswa</th>
                <th className="px-6 py-4 font-medium">Status Kehadiran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-slate-500">
                    Memuat data...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-slate-500">
                    Belum ada siswa di {userData?.assigned_class}.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-700">{student.name}</p>
                      <p className="text-xs text-slate-500">{student.nisn}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(student.id, status)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                              attendance[student.id] === status
                                ? statusColors[status]
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
