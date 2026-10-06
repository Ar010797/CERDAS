import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, writeBatch, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Save, Calendar, FileDown, Filter, MessageSquare, CheckCircle2, AlertCircle, Bell, Users, Clock, Share2, Copy, Check, CheckCheck, Send, Printer, FileText, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/activity';
import { ALL_AVAILABLE_CLASSES, CLASS_GROUPS, getClassVariants } from '../../lib/schoolClasses';

interface Student {
  id: string;
  nisn: string;
  name: string;
  absen_number?: string;
  parentPhone?: string;
}

type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';

const CLASSES_LIST = ALL_AVAILABLE_CLASSES;

const MONTHS_LIST = [
  { value: '01', name: 'Januari' },
  { value: '02', name: 'Februari' },
  { value: '03', name: 'Maret' },
  { value: '04', name: 'April' },
  { value: '05', name: 'Mei' },
  { value: '06', name: 'Juni' },
  { value: '07', name: 'Juli' },
  { value: '08', name: 'Agustus' },
  { value: '09', name: 'September' },
  { value: '10', name: 'Oktober' },
  { value: '11', name: 'November' },
  { value: '12', name: 'Desember' },
];

export default function AttendanceGuru() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';
  
  const [selectedClass, setSelectedClass] = useState(
    isAdmin ? 'Kelas 1 A' : (userData?.assigned_class || 'Kelas 1 A')
  );

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isWaBroadcastModalOpen, setIsWaBroadcastModalOpen] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);

  // Modal Cetak Rekap Bulanan
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState<string>(format(new Date(), 'MM'));
  const [exportYear, setExportYear] = useState<string>(format(new Date(), 'yyyy'));
  const [isExporting, setIsExporting] = useState(false);

  // Pengaturan Sekolah untuk Kop & Tanda Tangan PDF
  const [schoolSettings, setSchoolSettings] = useState<any>({
    namaSekolah: 'SI Miftahussalam',
    namaKepalaSekolah: '',
    nipKepalaSekolah: '',
    tandaTanganKepalaSekolah: '',
    stempelSekolah: '',
    tahunAjaran: '2026/2027'
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Realtime listener pengaturan sekolah
  useEffect(() => {
    const unsubSchool = onSnapshot(doc(db, 'pengaturan_sekolah', 'utama'), (docSnap) => {
      if (docSnap.exists()) {
        setSchoolSettings(docSnap.data());
      }
    });
    return () => unsubSchool();
  }, []);

  useEffect(() => {
    const fetchStudentsAndAttendance = async () => {
      setLoading(true);
      try {
        const variants = getClassVariants(selectedClass);
        const qStudents = variants.length === 1
          ? query(collection(db, 'students'), where('classId', '==', variants[0]))
          : query(collection(db, 'students'), where('classId', 'in', variants.length > 0 ? variants : [selectedClass]));
        
        const snap = await getDocs(qStudents);
        const studentsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        // Urutkan nomor absen lalu alfabetis
        studentsData.sort((a, b) => {
          const numA = parseInt(a.absen_number || '999', 10);
          const numB = parseInt(b.absen_number || '999', 10);
          if (numA !== numB) return numA - numB;
          return a.name.localeCompare(b.name);
        });
        setStudents(studentsData);
        
        // Fetch existing attendance for today if already saved
        const qAttToday = variants.length === 1
          ? query(
              collection(db, 'attendance'),
              where('classId', '==', variants[0]),
              where('date', '==', todayStr)
            )
          : query(
              collection(db, 'attendance'),
              where('classId', 'in', variants.length > 0 ? variants : [selectedClass]),
              where('date', '==', todayStr)
            );
        const snapAtt = await getDocs(qAttToday);
        const existingAtt: Record<string, AttendanceStatus> = {};
        snapAtt.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d.studentId && d.status) {
            existingAtt[d.studentId] = d.status as AttendanceStatus;
          }
        });

        // Initialize default attendance as Hadir or existing saved status
        const initialAtt: Record<string, AttendanceStatus> = {};
        studentsData.forEach(s => {
          initialAtt[s.id] = existingAtt[s.id] || 'Hadir';
        });
        setAttendance(initialAtt);
      } catch (error) {
        console.error("Error loading attendance:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentsAndAttendance();
  }, [selectedClass, todayStr]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSetAllHadir = () => {
    const updated: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      updated[s.id] = 'Hadir';
    });
    setAttendance(updated);
    showToast('Seluruh siswa berhasil diatur berstatus HADIR.', 'success');
  };

  const handleSaveMassal = async () => {
    if (students.length === 0) {
      showToast('Belum ada siswa di kelas ini untuk diabsen.', 'error');
      return;
    }

    setSaving(true);
    try {
      // Chunk students into groups of 150 (each student creates 2 docs: attendance + student_notifications)
      const chunkSize = 150;
      const nowIso = new Date().toISOString();

      for (let i = 0; i < students.length; i += chunkSize) {
        const chunk = students.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach(student => {
          const status = attendance[student.id] || 'Hadir';
          
          // 1. Catat ke koleksi attendance
          const docId = `${student.id}_${todayStr}`;
          const ref = doc(db, 'attendance', docId);
          batch.set(ref, {
            studentId: student.id,
            studentName: student.name,
            nisn: student.nisn || '',
            classId: selectedClass,
            date: todayStr,
            status: status,
            academicYearId: 'active',
            recordedBy: userData?.name || 'Wali Kelas',
            recordedRole: userData?.role || 'Guru',
            recordedAt: nowIso,
            notifiedToWali: true,
            notifiedAt: nowIso,
            updatedAt: serverTimestamp()
          }, { merge: true });

          // 2. Kirim notifikasi individual ke wali murid
          const notifId = `${student.id}_att_${todayStr}`;
          const notifRef = doc(db, 'student_notifications', notifId);
          batch.set(notifRef, {
            studentId: student.id,
            studentName: student.name,
            classId: selectedClass,
            date: todayStr,
            type: 'attendance',
            status: status,
            title: status === 'Hadir' 
              ? '✅ Ananda Telah Masuk Sekolah' 
              : (status === 'Izin' ? 'ℹ️ Izin Kehadiran Santri' : (status === 'Sakit' ? '🏥 Keterangan Santri Sakit' : '⚠️ Kehadiran: Alpa')),
            body: status === 'Hadir'
              ? `Alhamdulillah, ananda ${student.name} telah masuk sekolah dan tercatat HADIR di ${selectedClass} hari ini (${todayDisplay}).`
              : `Informasi Kehadiran: ananda ${student.name} tercatat status "${status}" pada absensi ${selectedClass} hari ini (${todayDisplay}).`,
            recordedBy: userData?.name || 'Wali Kelas',
            recordedAt: nowIso,
            createdAt: serverTimestamp(),
            isRead: false
          }, { merge: true });
        });

        await batch.commit();
      }
      
      if (userData) {
        await logActivity(userData.name, userData.assigned_class || 'Admin', `Menyimpan absensi ${selectedClass} (${todayStr}) dan mengirimkan notifikasi ke wali murid`);
      }
      
      showToast(`Absensi berhasil disimpan! Notifikasi otomatis terkirim ke seluruh Wali Murid agar mengetahui anak telah masuk sekolah.`, 'success');
    } catch (error: any) {
      console.error(error);
      showToast('Gagal menyimpan absensi: ' + (error?.message || 'Terjadi kesalahan.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Hitung jumlah status kehadiran saat ini
  const counts = {
    hadir: students.filter(s => (attendance[s.id] || 'Hadir') === 'Hadir').length,
    izin: students.filter(s => attendance[s.id] === 'Izin').length,
    sakit: students.filter(s => attendance[s.id] === 'Sakit').length,
    alpa: students.filter(s => attendance[s.id] === 'Alpa').length,
  };

  // Teks broadcast untuk WhatsApp Group Wali Murid
  const waBroadcastText = `*LAPORAN KEHADIRAN SISWA*\n*${selectedClass}*\n*Hari/Tanggal:* ${todayDisplay}\n\n*Ringkasan Presensi:*\n✅ Hadir: ${counts.hadir} siswa\nℹ️ Izin: ${counts.izin} siswa\n🏥 Sakit: ${counts.sakit} siswa\n⚠️ Alpa: ${counts.alpa} siswa\nTotal: ${students.length} siswa\n\n*Keterangan:*\nAbsensi telah selesai diverifikasi oleh Wali Kelas (${userData?.name || 'Wali Kelas'}). Bapak/Ibu Wali Murid dapat melihat detail riwayat kehadiran ananda secara langsung melalui aplikasi CERDAS.\n\nTerima kasih atas kerja samanya. Wassalamu'alaikum wr. wb.`;

  const handleCopyWaText = () => {
    navigator.clipboard.writeText(waBroadcastText);
    setCopiedWa(true);
    setTimeout(() => setCopiedWa(false), 2500);
    showToast('Teks rekap presensi berhasil disalin!', 'success');
  };

  const handleGenerateMonthlyPDF = async () => {
    setIsExporting(true);
    try {
      const targetMonthNum = parseInt(exportMonth, 10);
      const targetYearNum = parseInt(exportYear, 10);
      const startDate = `${exportYear}-${exportMonth.padStart(2, '0')}-01`;
      const lastDay = new Date(targetYearNum, targetMonthNum, 0).getDate();
      const endDate = `${exportYear}-${exportMonth.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const monthName = format(new Date(targetYearNum, targetMonthNum - 1, 1), 'MMMM', { locale: id });

      // 1. Ambil daftar siswa kelas target (menggunakan getClassVariants agar MTs & SD terakomodasi)
      const variants = getClassVariants(selectedClass);
      const qStudents = variants.length === 1
        ? query(collection(db, 'students'), where('classId', '==', variants[0]))
        : query(collection(db, 'students'), where('classId', 'in', variants.length > 0 ? variants : [selectedClass]));
      
      const snapStudents = await getDocs(qStudents);
      const studentList = snapStudents.docs.map(d => ({ id: d.id, ...d.data() } as Student));

      if (studentList.length === 0) {
        showToast(`Tidak ditemukan data siswa yang terdaftar di kelas ${selectedClass}.`, 'error');
        setIsExporting(false);
        return;
      }

      // Urutkan siswa berdasarkan nomor absen, lalu alfabetis nama
      studentList.sort((a, b) => {
        const numA = parseInt(a.absen_number || '999', 10);
        const numB = parseInt(b.absen_number || '999', 10);
        if (numA !== numB) return numA - numB;
        return a.name.localeCompare(b.name);
      });

      // 2. Ambil data absensi NYATA yang telah disimpan guru di Firestore pada rentang bulan tersebut
      const attMap: Record<string, Record<string, AttendanceStatus>> = {}; // studentId -> { date -> status }
      const recordedDatesSet = new Set<string>();

      const targetClassesToQuery = variants.length > 0 ? variants : [selectedClass];
      for (const cls of targetClassesToQuery) {
        const qAtt = query(
          collection(db, 'attendance'),
          where('classId', '==', cls),
          where('date', '>=', startDate),
          where('date', '<=', endDate)
        );
        const snapAtt = await getDocs(qAtt);
        snapAtt.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d.studentId && d.date && d.status) {
            if (!attMap[d.studentId]) attMap[d.studentId] = {};
            attMap[d.studentId][d.date] = d.status as AttendanceStatus;
            recordedDatesSet.add(d.date);
          }
        });
      }

      const recordedDates = Array.from(recordedDatesSet).sort();

      // 3. Verifikasi: JIKA TIDAK ADA HARI YANG DICATAT / DISIMPAN OLEH GURU
      if (recordedDates.length === 0) {
        showToast(
          `Belum ada data absensi yang dicatat oleh guru pada bulan ${monthName} ${exportYear} untuk ${selectedClass}. Hanya tanggal yang telah disimpan yang akan dicetak.`,
          'error'
        );
        setIsExporting(false);
        return;
      }

      // 4. Inisialisasi Dokumen PDF Landscape A4 yang Rapi & Proporsional
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm
      const margin = 10;

      // Header Kop Lembaga / Sekolah
      const namaSekolah = schoolSettings?.namaSekolah || userData?.schoolName || 'MADRASAH TSANAWIYAH / SEKOLAH';
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(30, 41, 59); // slate-800
      pdf.text(namaSekolah.toUpperCase(), pageWidth / 2, 14, { align: 'center' });

      pdf.setFontSize(10.5);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(67, 56, 202); // indigo-700
      pdf.text('REKAPITULASI PRESENSI / KEHADIRAN SISWA BULANAN', pageWidth / 2, 20, { align: 'center' });

      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(71, 85, 105); // slate-600
      const subheaderText = `Kelas: ${selectedClass}   •   Bulan: ${monthName} ${exportYear}   •   Tahun Ajaran: ${schoolSettings?.tahunAjaran || '2026/2027'}   •   Hari Efektif Presensi: ${recordedDates.length} Pertemuan`;
      pdf.text(subheaderText, pageWidth / 2, 25.5, { align: 'center' });

      // Garis Kop Ganda Resmi
      pdf.setDrawColor(67, 56, 202);
      pdf.setLineWidth(0.7);
      pdf.line(margin, 28, pageWidth - margin, 28);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.3);
      pdf.line(margin, 29, pageWidth - margin, 29);

      // 5. Header Kolom Tabel:
      // Hanya menyertakan tanggal yang ADA datanya (recordedDates)
      const dateHeaders = recordedDates.map(d => {
        // Ambil dua digit hari, misal "06"
        return d.split('-')[2];
      });

      const head = [
        [
          'No',
          'NISN',
          'Nama Lengkap Siswa',
          ...dateHeaders,
          'H',
          'I',
          'S',
          'A',
          '% H'
        ]
      ];

      // Rekap total kehadiran per tanggal untuk baris footer
      const dateTotals: Record<string, { H: number; I: number; S: number; A: number }> = {};
      recordedDates.forEach(d => {
        dateTotals[d] = { H: 0, I: 0, S: 0, A: 0 };
      });

      let grandTotalH = 0;
      let grandTotalI = 0;
      let grandTotalS = 0;
      let grandTotalA = 0;

      const body = studentList.map((student, idx) => {
        let countH = 0;
        let countI = 0;
        let countS = 0;
        let countA = 0;

        const dateCells = recordedDates.map(d => {
          const status = attMap[student.id]?.[d];
          if (status === 'Hadir') {
            countH++;
            dateTotals[d].H++;
            return 'H';
          } else if (status === 'Izin') {
            countI++;
            dateTotals[d].I++;
            return 'I';
          } else if (status === 'Sakit') {
            countS++;
            dateTotals[d].S++;
            return 'S';
          } else if (status === 'Alpa') {
            countA++;
            dateTotals[d].A++;
            return 'A';
          }
          return '-';
        });

        grandTotalH += countH;
        grandTotalI += countI;
        grandTotalS += countS;
        grandTotalA += countA;

        const pct = recordedDates.length > 0 
          ? Math.round((countH / recordedDates.length) * 100) + '%'
          : '0%';

        return [
          String(student.absen_number || idx + 1),
          student.nisn || '-',
          student.name,
          ...dateCells,
          String(countH),
          String(countI),
          String(countS),
          String(countA),
          pct
        ];
      });

      // Baris Rangkuman / Footer Tabel
      const footerRows = [
        [
          '',
          '',
          'Jumlah Hadir (H)',
          ...recordedDates.map(d => String(dateTotals[d].H)),
          String(grandTotalH),
          '',
          '',
          '',
          ''
        ],
        [
          '',
          '',
          'Jumlah Izin (I)',
          ...recordedDates.map(d => String(dateTotals[d].I)),
          '',
          String(grandTotalI),
          '',
          '',
          ''
        ],
        [
          '',
          '',
          'Jumlah Sakit (S)',
          ...recordedDates.map(d => String(dateTotals[d].S)),
          '',
          '',
          String(grandTotalS),
          '',
          ''
        ],
        [
          '',
          '',
          'Jumlah Alpa (A)',
          ...recordedDates.map(d => String(dateTotals[d].A)),
          '',
          '',
          '',
          String(grandTotalA),
          ''
        ]
      ];

      // Penyesuaian Lebar Kolom secara Dinamis
      const totalDateCols = recordedDates.length;
      const baseFontSize = totalDateCols > 24 ? 6.2 : (totalDateCols > 16 ? 7 : 7.8);
      const dateCellWidth = totalDateCols > 24 ? 5.2 : (totalDateCols > 16 ? 6.2 : 7.5);

      const columnStylesConfig: Record<number, any> = {
        0: { cellWidth: 7, halign: 'center' }, // No
        1: { cellWidth: 18, halign: 'center' }, // NISN
        2: { cellWidth: totalDateCols > 20 ? 36 : 44, halign: 'left' }, // Nama
      };

      for (let c = 0; c < totalDateCols; c++) {
        columnStylesConfig[3 + c] = { cellWidth: dateCellWidth, halign: 'center' };
      }

      const summaryStartIdx = 3 + totalDateCols;
      columnStylesConfig[summaryStartIdx] = { cellWidth: 7.5, halign: 'center', fontStyle: 'bold' }; // H
      columnStylesConfig[summaryStartIdx + 1] = { cellWidth: 7.5, halign: 'center', fontStyle: 'bold' }; // I
      columnStylesConfig[summaryStartIdx + 2] = { cellWidth: 7.5, halign: 'center', fontStyle: 'bold' }; // S
      columnStylesConfig[summaryStartIdx + 3] = { cellWidth: 7.5, halign: 'center', fontStyle: 'bold' }; // A
      columnStylesConfig[summaryStartIdx + 4] = { cellWidth: 10, halign: 'center', fontStyle: 'bold' }; // %

      autoTable(pdf, {
        startY: 32,
        margin: { left: margin, right: margin, top: 32, bottom: 20 },
        head: head,
        body: [...body, ...footerRows],
        theme: 'grid',
        headStyles: {
          fillColor: [67, 56, 202], // Indigo-700
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: baseFontSize,
          halign: 'center',
          valign: 'middle',
          cellPadding: 1.2
        },
        bodyStyles: {
          fontSize: baseFontSize,
          cellPadding: 1.1,
          valign: 'middle',
          textColor: [30, 41, 59]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate-50
        },
        columnStyles: columnStylesConfig,
        didParseCell: (data) => {
          // Pewarnaan khusus untuk baris footer
          if (data.row.index >= body.length) {
            data.cell.styles.fillColor = [241, 245, 249]; // Slate-100
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [15, 23, 42];
            return;
          }

          // Pewarnaan status kehadiran
          const val = data.cell.text[0];
          if (val === 'H') {
            data.cell.styles.textColor = [5, 150, 105]; // emerald-600
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'I') {
            data.cell.styles.textColor = [37, 99, 235]; // blue-600
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'S') {
            data.cell.styles.textColor = [217, 119, 6]; // amber-600
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'A') {
            data.cell.styles.textColor = [220, 38, 38]; // red-600
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      // 6. Keterangan & Tanda Tangan Resmi
      let finalY = (pdf as any).lastAutoTable.finalY + 5;
      
      if (finalY + 38 > pageHeight) {
        pdf.addPage();
        finalY = 18;
      }

      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        'Catatan: H = Hadir  |  I = Izin  |  S = Sakit  |  A = Alpa  |  *Hanya hari efektif yang dicatat/disimpan guru yang dimasukkan ke tabel.',
        margin,
        finalY
      );

      const signY = finalY + 5;

      // Tanda Tangan Kepala Sekolah (Kiri)
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.text('Mengetahui,', 45, signY, { align: 'center' });
      pdf.text('Kepala Sekolah', 45, signY + 4.5, { align: 'center' });

      // Stempel Sekolah jika ada
      if (schoolSettings?.stempelSekolah) {
        try {
          pdf.addImage(schoolSettings.stempelSekolah, 'PNG', 26, signY + 5, 20, 20);
        } catch (err) {
          console.warn('Stempel tidak dapat dimuat ke PDF:', err);
        }
      }

      // TTD Kepala Sekolah jika ada
      if (schoolSettings?.tandaTanganKepalaSekolah) {
        try {
          pdf.addImage(schoolSettings.tandaTanganKepalaSekolah, 'PNG', 36, signY + 6, 20, 12);
        } catch (err) {
          console.warn('TTD tidak dapat dimuat ke PDF:', err);
        }
      }

      pdf.setFont("helvetica", "bold");
      pdf.text(schoolSettings?.namaKepalaSekolah || '________________________', 45, signY + 23, { align: 'center' });
      pdf.setFont("helvetica", "normal");
      pdf.text(schoolSettings?.nipKepalaSekolah ? `NIP. ${schoolSettings.nipKepalaSekolah}` : 'NIP. -', 45, signY + 27, { align: 'center' });

      // Tanda Tangan Wali Kelas (Kanan)
      const todayFormatted = format(new Date(), 'dd MMMM yyyy', { locale: id });
      pdf.text(`Kotayasa, ${todayFormatted}`, pageWidth - 45, signY, { align: 'center' });
      pdf.text('Wali Kelas', pageWidth - 45, signY + 4.5, { align: 'center' });

      pdf.setFont("helvetica", "bold");
      const waliName = userData?.name || 'Wali Kelas';
      pdf.text(waliName, pageWidth - 45, signY + 23, { align: 'center' });
      pdf.setFont("helvetica", "normal");
      pdf.text('NIP. -', pageWidth - 45, signY + 27, { align: 'center' });

      const cleanFileName = `Rekap_Presensi_${selectedClass.replace(/\s+/g, '_')}_${monthName}_${exportYear}.pdf`;
      pdf.save(cleanFileName);

      showToast(`Rekap presensi bulan ${monthName} ${exportYear} berhasil diunduh (${recordedDates.length} hari efektif).`, 'success');
      setIsExportModalOpen(false);
    } catch (error: any) {
      console.error("Error generating monthly attendance PDF:", error);
      showToast('Gagal mencetak rekap: ' + (error?.message || 'Terjadi kesalahan sistem'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const statusColors = {
    'Hadir': 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    'Izin': 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    'Sakit': 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    'Alpa': 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${
            toast.type === 'success' 
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20' 
              : 'bg-red-600 text-white border-red-500 shadow-red-500/20'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>Absensi Harian Kelas</span>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
              {selectedClass}
            </span>
          </h1>
          <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 mt-1 text-sm">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <span className="font-medium">{todayDisplay}</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" />
              Notifikasi otomatis ke HP Wali Murid aktif
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 flex-wrap sm:flex-nowrap gap-y-2">
           {isAdmin && (
               <div className="flex items-center space-x-2 bg-white dark:bg-slate-850 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mr-1 transition-colors">
                 <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                 <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    {CLASSES_LIST.map(c => <option key={c} value={c} className="dark:bg-slate-800 dark:text-white">{c}</option>)}
                  </select>
               </div>
           )}

          <button
            onClick={() => setIsWaBroadcastModalOpen(true)}
            className="flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 rounded-xl transition-all font-semibold text-xs shadow-xs cursor-pointer active:scale-95"
            title="Bagikan rekap kehadiran ke WhatsApp Group Wali Murid"
          >
            <Share2 className="w-4 h-4" />
            <span>Broadcast Rekap WA</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center space-x-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl transition-colors font-medium text-xs shadow-xs cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">Cetak Rekap PDF</span>
          </button>

          <button
            onClick={handleSaveMassal}
            disabled={saving || loading || students.length === 0}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl transition-all font-bold text-xs shadow-md shadow-indigo-500/20 cursor-pointer active:scale-95"
            title="Simpan absensi dan kirim notifikasi ke wali murid agar tahu anaknya telah masuk sekolah"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            <span>{saving ? 'Menyimpan & Mengirim...' : 'Simpan & Beritahu Wali'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges & Quick Action */}
      <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 flex-1">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-center border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">Total Siswa</span>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100">{students.length}</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl text-center border border-emerald-200/60 dark:border-emerald-800/60">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block">✅ Hadir</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{counts.hadir}</span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/50 p-2.5 rounded-xl text-center border border-blue-200/60 dark:border-blue-800/60">
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold block">ℹ️ Izin</span>
            <span className="text-lg font-black text-blue-700 dark:text-blue-300">{counts.izin}</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded-xl text-center border border-amber-200/60 dark:border-amber-800/60">
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block">🏥 Sakit</span>
            <span className="text-lg font-black text-amber-700 dark:text-amber-300">{counts.sakit}</span>
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-xl text-center border border-rose-200/60 dark:border-rose-800/60">
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold block">⚠️ Alpa</span>
            <span className="text-lg font-black text-rose-700 dark:text-rose-300">{counts.alpa}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-4">
          <button
            onClick={handleSetAllHadir}
            className="w-full md:w-auto px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            title="Atur status seluruh siswa menjadi Hadir"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Set Semua Hadir</span>
          </button>
        </div>
      </div>

      {/* Main Student Attendance Table */}
      <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                <th className="px-6 py-4 font-medium">Siswa & Kontak Wali</th>
                <th className="px-6 py-4 font-medium">Status Kehadiran Hari Ini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    Memuat data siswa dan absensi hari ini...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    Belum ada siswa di {selectedClass}.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const currentStatus = attendance[student.id] || 'Hadir';
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                              <span>{student.name}</span>
                              {currentStatus === 'Hadir' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                                  Masuk Sekolah
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              NISN: {student.nisn || '-'} {student.parentPhone ? `• HP Wali: ${student.parentPhone}` : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (student.parentPhone) {
                                const phoneClean = student.parentPhone.replace(/\D/g, '');
                                const phoneFormatted = phoneClean.startsWith('0') ? '62' + phoneClean.slice(1) : phoneClean;
                                
                                const waMsg = currentStatus === 'Hadir'
                                  ? `Assalamu'alaikum wr. wb. Yth. Bapak/Ibu Wali Murid dari *${student.name}*.\n\nMenginformasikan bahwa ananda telah hadir dan masuk sekolah di *${selectedClass}* hari ini (${todayDisplay}).\nPresensi telah dicatat oleh Wali Kelas (${userData?.name || 'Wali Kelas'}). Terima kasih atas perhatian dan kerja samanya.\n\nWassalamu'alaikum wr. wb.`
                                  : `Assalamu'alaikum wr. wb. Yth. Bapak/Ibu Wali Murid dari *${student.name}*.\n\nMenginformasikan bahwa pada absensi kelas *${selectedClass}* hari ini (${todayDisplay}), ananda tercatat berstatus *${currentStatus.toUpperCase()}*.\n\nTerima kasih atas perhatiannya.\nWali Kelas (${userData?.name || 'Wali Kelas'})`;

                                const waLink = `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(waMsg)}`;
                                window.open(waLink, '_blank');
                              } else {
                                showToast('Nomor HP Wali Murid belum diatur untuk siswa ini. Silakan lengkapi di menu Siswa.', 'error');
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-all ml-2 cursor-pointer active:scale-95"
                            title="Kirim pesan langsung ke WhatsApp Wali Murid"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((status) => (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(student.id, status)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                currentStatus === status 
                                  ? statusColors[status] + ' shadow-xs scale-105' 
                                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                              }`}
                            >
                              {status === 'Hadir' ? '✅ Hadir' : status === 'Izin' ? 'ℹ️ Izin' : status === 'Sakit' ? '🏥 Sakit' : '⚠️ Alpa'}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Broadcast WhatsApp Grup Wali Murid */}
      {isWaBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Broadcast Rekap Presensi WhatsApp</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Bagikan ringkasan kehadiran hari ini ke grup WhatsApp Wali Murid</p>
                </div>
              </div>
              <button
                onClick={() => setIsWaBroadcastModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {waBroadcastText}
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/50 p-3.5 rounded-2xl border border-indigo-200/60 dark:border-indigo-800/60 flex items-start gap-2.5">
                <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-800 dark:text-indigo-200 leading-relaxed">
                  Selain via WhatsApp, wali murid yang login ke aplikasi <strong>CERDAS</strong> juga otomatis menerima notifikasi pop-up dan banner bahwa anak telah masuk sekolah begitu tombol <strong>"Simpan & Beritahu Wali"</strong> ditekan.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-850/50">
              <button
                onClick={() => setIsWaBroadcastModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={handleCopyWaText}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copiedWa ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedWa ? 'Tersalin!' : 'Salin Teks'}</span>
              </button>
              <button
                onClick={() => {
                  const url = `https://wa.me/?text=${encodeURIComponent(waBroadcastText)}`;
                  window.open(url, '_blank');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/20 active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Buka WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Rekap Absensi Bulanan (PDF) */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Cetak Rekap Presensi Bulanan</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Unduh dokumen PDF resmi presensi siswa</p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Target Kelas */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Kelas Target:
                </label>
                <div className="px-3.5 py-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl font-bold text-sm text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                  <span>{selectedClass}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-600 text-white rounded-lg">
                    {students.length} Siswa Terdaftar
                  </span>
                </div>
              </div>

              {/* Pilihan Periode Bulan & Tahun */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    Pilih Bulan:
                  </label>
                  <select
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {MONTHS_LIST.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    Pilih Tahun:
                  </label>
                  <select
                    value={exportYear}
                    onChange={(e) => setExportYear(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {[2024, 2025, 2026, 2027].map((yr) => (
                      <option key={yr} value={String(yr)}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Informasi Ketentuan */}
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                  <p className="font-bold mb-0.5">Ketentuan Data Presensi:</p>
                  <p>
                    Data yang dicatat adalah <strong>data yang telah disimpan guru</strong> di database. Jika ada hari tidak dicatat atau disimpan guru (misal hari libur atau belum diabsen), hari tersebut <strong>tidak dimasukkan</strong> ke dalam tabel.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 bg-slate-50/70 dark:bg-slate-850/50">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                disabled={isExporting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleGenerateMonthlyPDF}
                disabled={isExporting}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/30 active:scale-95"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyiapkan PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Unduh Rekap PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
