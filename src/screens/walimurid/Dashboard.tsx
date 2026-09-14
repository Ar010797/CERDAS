import React, { useState, useEffect } from 'react';
import { collection, query, where, doc, onSnapshot, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { FileDown, CalendarDays, BookOpen, UserCircle, CheckCircle2, Edit2, X, Save, MessageSquare, Clock, Image as ImageIcon, Wallet, Coins } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ScheduleWidget from '../../components/ScheduleWidget';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function WaliMuridDashboard() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'profil' | 'akademik' | 'galeri' | 'keuangan'>('profil');
  
  // Real-time data
  const [studentData, setStudentData] = useState<any>(null);
  const [grades, setGrades] = useState<Record<string, { tugas: string, pts: string, pas: string }>>({});
  const [attendance, setAttendance] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [schoolSettings, setSchoolSettings] = useState({ namaSekolah: 'CERDAS', namaKepalaSekolah: '', nipKepalaSekolah: '' });
  const [loading, setLoading] = useState(true);

  // Extra Data
  const [photos, setPhotos] = useState<any[]>([]);
  const [savingTransactions, setSavingTransactions] = useState<any[]>([]);
  const [kasTransactions, setKasTransactions] = useState<any[]>([]);

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', gender: 'L', address: '', birthDate: '', birthPlace: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userData?.uid) return;

    // Student Profile
    const unsubStudent = onSnapshot(doc(db, 'students', userData.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStudentData(data);
        setFormData({
          name: data.name || '',
          gender: data.gender || 'L',
          address: data.address || '',
          birthDate: data.birthDate || '',
          birthPlace: data.birthPlace || ''
        });
      }
    });

    // Grades
    const unsubGrades = onSnapshot(doc(db, 'grades', userData.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGrades(data.gradesBySubject || {});
      }
    });

    // Attendance (Listen to changes if needed, but summary usually from a query)
    const qAtt = query(collection(db, 'attendance'), where('studentId', '==', userData.uid));
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      const attCount = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
      snap.forEach(d => {
        const status = d.data().status;
        if (status === 'Hadir') attCount.hadir++;
        else if (status === 'Izin') attCount.izin++;
        else if (status === 'Sakit') attCount.sakit++;
        else if (status === 'Alpa') attCount.alpa++;
      });
      setAttendance(attCount);
    });

    // School Settings
    const unsubSchool = onSnapshot(doc(db, 'pengaturan_sekolah', 'utama'), (docSnap) => {
      if (docSnap.exists()) setSchoolSettings(docSnap.data() as any);
    });

    setLoading(false);

    return () => {
      unsubStudent();
      unsubGrades();
      unsubAtt();
      unsubSchool();
    };
  }, [userData]);

  // We also need subjects from class, gallery, and finance
  useEffect(() => {
    if (!studentData?.classId || !studentData?.id) return;
    
    // Subjects
    const unsubSubjects = onSnapshot(doc(db, 'mata_pelajaran', studentData.classId), (docSnap) => {
      if (docSnap.exists()) setSubjects(docSnap.data().subjects || []);
    });

    // Gallery
    const qGallery = query(collection(db, 'gallery'), where('classId', '==', studentData.classId), orderBy('createdAt', 'desc'));
    const unsubGallery = onSnapshot(qGallery, (snap) => setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Tabungan
    const qSavings = query(collection(db, 'savings'), where('studentId', '==', studentData.id), orderBy('date', 'desc'));
    const unsubSavings = onSnapshot(qSavings, (snap) => setSavingTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Kas
    const qKas = query(collection(db, 'kas'), where('classId', '==', studentData.classId), orderBy('date', 'desc'));
    const unsubKas = onSnapshot(qKas, (snap) => setKasTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => {
      unsubSubjects();
      unsubGallery();
      unsubSavings();
      unsubKas();
    };
  }, [studentData?.classId, studentData?.id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'students', userData!.uid), formData);
      alert('Profil berhasil diperbarui!');
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('Gagal memperbarui profil.');
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text((schoolSettings.namaSekolah || 'SEKOLAH').toUpperCase(), 105, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text('LAPORAN HASIL BELAJAR (RAPOR BAYANGAN)', 105, 28, { align: 'center' });
    pdf.setLineWidth(0.5);
    pdf.line(20, 32, 190, 32);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Nama Peserta Didik`, 20, 45); pdf.text(`: ${studentData?.name || userData?.username}`, 70, 45);
    pdf.text(`Nomor Induk / NISN`, 20, 52); pdf.text(`: ${studentData?.absen_number || '-'} / ${studentData?.nisn || '-'}`, 70, 52);
    pdf.text(`Kelas`, 130, 45); pdf.text(`: ${studentData?.classId || '-'}`, 160, 45);
    // Note: To show precise Wali Kelas name in parent's dash, we'd need to query the users table for that class.
    // For now we'll leave it as a general format.
    pdf.text(`Tahun Ajaran`, 130, 52); pdf.text(`: ${schoolSettings.tahunAjaran || '2026/2027'}`, 160, 52);

    const tableBody = subjects.map(subj => {
      const g = grades[subj] || { tugas: '-', pts: '-', pas: '-' };
      return [subj, g.tugas || '-', g.pts || '-', g.pas || '-'];
    });

    if (tableBody.length === 0) tableBody.push(['Belum ada mata pelajaran', '-', '-', '-']);

    autoTable(pdf, {
      startY: 65,
      head: [['Mata Pelajaran', 'Nilai Tugas', 'Nilai PTS', 'Nilai PAS']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

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
    pdf.text(`(________________________)`, 160, signatureY + 60, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    pdf.text(`NIP. __________________`, 160, signatureY + 65, { align: 'center' });

    pdf.save(`Rapor_${(studentData?.name || '').replace(/\s+/g, '_')}.pdf`);
  };

  const tabunganBalance = savingTransactions.reduce((acc, curr) => {
    return curr.type === 'setor' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  const kasBalance = kasTransactions.reduce((acc, curr) => {
    return curr.type === 'masuk' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  if (loading) {
    return <div className="text-center py-10">Memuat data anak Anda...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header Profile Summary */}
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 shrink-0">
            <UserCircle className="w-12 h-12 text-white/80" />
          </div>
          <div className="text-center md:text-left flex-1">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/30 px-3 py-1 rounded-full border border-indigo-400/30 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-medium text-indigo-100">Siswa Aktif</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">{studentData?.name || userData?.username}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-indigo-100">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">NISN: {studentData?.nisn || '-'}</span>
              </div>
              <div className="w-1 h-1 bg-indigo-300 rounded-full hidden md:block" />
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-4 h-4" />
                <span className="text-sm">Kelas: {studentData?.classId || '-'}</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 mt-4 md:mt-0">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl border border-white/20 transition-colors font-medium text-sm flex items-center space-x-2"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit Profil</span>
            </button>
          </div>
        </div>
      </div>

      {/* Catatan / Pesan Khusus dari Wali Kelas */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 rounded-3xl p-6 border border-amber-200/80 shadow-xs relative overflow-hidden">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
                Pesan Khusus dari Wali Kelas ({studentData?.classId || 'Kelas'})
              </h3>
              {studentData?.catatanWaliKelasUpdated && (
                <span className="text-xs text-amber-800/70 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Diperbarui: {new Date(studentData.catatanWaliKelasUpdated).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            {studentData?.catatanWaliKelas ? (
              <p className="text-sm text-amber-900 leading-relaxed font-medium bg-white/70 p-4 rounded-2xl border border-amber-200/60 shadow-2xs mt-2">
                "{studentData.catatanWaliKelas}"
              </p>
            ) : (
              <p className="text-xs text-amber-800/80 italic mt-1">
                Belum ada catatan khusus yang disampaikan oleh Wali Kelas untuk ananda {studentData?.name || ''}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Jadwal Pelajaran & Ujian Widget */}
      <ScheduleWidget classId={studentData?.classId || 'Kelas 1'} title={`Jadwal Pelajaran & Ujian Ananda (${studentData?.classId || 'Kelas 1'})`} />

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-full max-w-2xl mx-auto md:mx-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profil')}
          className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'profil' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Data Profil
        </button>
        <button
          onClick={() => setActiveTab('akademik')}
          className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'akademik' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Akademik & Nilai
        </button>
        <button
          onClick={() => setActiveTab('galeri')}
          className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'galeri' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Galeri Kelas
        </button>
        <button
          onClick={() => setActiveTab('keuangan')}
          className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'keuangan' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Keuangan
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'profil' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Detail Informasi Siswa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500 mb-1">Nama Lengkap</p>
              <p className="font-medium text-slate-800">{studentData?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Jenis Kelamin</p>
              <p className="font-medium text-slate-800">{studentData?.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Tempat, Tanggal Lahir</p>
              <p className="font-medium text-slate-800">{studentData?.birthPlace || '-'}, {studentData?.birthDate || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Alamat Lengkap</p>
              <p className="font-medium text-slate-800">{studentData?.address || '-'}</p>
            </div>
          </div>
        </div>
      ) : activeTab === 'akademik' ? (
        <div className="space-y-6">
          {/* Attendance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 text-center">
              <p className="text-sm font-medium text-emerald-600 mb-1">Hadir</p>
              <p className="text-3xl font-bold text-emerald-700">{attendance.hadir}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 text-center">
              <p className="text-sm font-medium text-blue-600 mb-1">Izin</p>
              <p className="text-3xl font-bold text-blue-700">{attendance.izin}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100 text-center">
              <p className="text-sm font-medium text-amber-600 mb-1">Sakit</p>
              <p className="text-3xl font-bold text-amber-700">{attendance.sakit}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 text-center">
              <p className="text-sm font-medium text-red-600 mb-1">Alpa</p>
              <p className="text-3xl font-bold text-red-700">{attendance.alpa}</p>
            </div>
          </div>

          {/* Grades Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Daftar Nilai Akademik</h3>
              <button 
                onClick={exportPDF}
                className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl transition-colors font-medium text-sm"
              >
                <FileDown className="w-4 h-4" />
                <span className="hidden sm:inline">Cetak PDF</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-sm text-slate-500">
                    <th className="px-6 py-4 font-medium">Mata Pelajaran</th>
                    <th className="px-6 py-4 font-medium text-center">Tugas</th>
                    <th className="px-6 py-4 font-medium text-center">PTS</th>
                    <th className="px-6 py-4 font-medium text-center">PAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Belum ada nilai.</td>
                    </tr>
                  ) : (
                    subjects.map(subj => {
                      const g = grades[subj] || { tugas: '-', pts: '-', pas: '-' };
                      return (
                        <tr key={subj} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-slate-700">{subj}</td>
                          <td className="px-6 py-4 text-sm text-center text-slate-600 font-medium">{g.tugas || '-'}</td>
                          <td className="px-6 py-4 text-sm text-center text-slate-600 font-medium">{g.pts || '-'}</td>
                          <td className="px-6 py-4 text-sm text-center text-slate-600 font-medium">{g.pas || '-'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'galeri' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Galeri Kegiatan Kelas</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-100 flex flex-col items-center">
                <ImageIcon className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-700">Belum Ada Foto</h3>
                <p className="text-sm text-slate-500 mt-1">Belum ada momen kegiatan kelas yang dibagikan.</p>
              </div>
            ) : (
              photos.map((photo) => (
                <div key={photo.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group">
                  <div className="aspect-square bg-slate-100 relative">
                    <img 
                      src={photo.url} 
                      alt={photo.caption} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-medium text-slate-800 line-clamp-2">
                      {photo.caption || 'Tanpa keterangan'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {photo.createdAt?.toDate ? format(photo.createdAt.toDate(), 'dd MMM yyyy', { locale: id }) : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-3xl text-white shadow-lg shadow-emerald-200">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-emerald-100 font-medium">Saldo Tabungan Siswa</p>
                  <p className="text-sm text-emerald-50 opacity-80">Total simpanan {studentData?.name}</p>
                </div>
              </div>
              <h3 className="text-4xl font-bold">Rp {tabunganBalance.toLocaleString('id-ID')}</h3>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl text-white shadow-lg shadow-blue-200">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Coins className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-blue-100 font-medium">Uang Kas Kelas</p>
                  <p className="text-sm text-blue-50 opacity-80">Saldo kas {studentData?.classId}</p>
                </div>
              </div>
              <h3 className="text-4xl font-bold">Rp {kasBalance.toLocaleString('id-ID')}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabungan History */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800">Riwayat Tabungan</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">Tanggal</th>
                      <th className="px-4 py-3 font-medium">Ket</th>
                      <th className="px-4 py-3 font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {savingTransactions.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500 text-sm">Belum ada transaksi</td></tr>
                    ) : (
                      savingTransactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-xs text-slate-600">{trx.date?.toDate ? format(trx.date.toDate(), 'dd/MM/yy', { locale: id }) : '-'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{trx.note}</td>
                          <td className={`px-4 py-3 text-xs font-bold ${trx.type === 'setor' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {trx.type === 'setor' ? '+' : '-'} Rp {trx.amount.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kas History */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800">Laporan Kas Kelas</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">Tanggal</th>
                      <th className="px-4 py-3 font-medium">Ket</th>
                      <th className="px-4 py-3 font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kasTransactions.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500 text-sm">Belum ada transaksi</td></tr>
                    ) : (
                      kasTransactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-xs text-slate-600">{trx.date?.toDate ? format(trx.date.toDate(), 'dd/MM/yy', { locale: id }) : '-'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{trx.note}</td>
                          <td className={`px-4 py-3 text-xs font-bold ${trx.type === 'masuk' ? 'text-blue-600' : 'text-red-600'}`}>
                            {trx.type === 'masuk' ? '+' : '-'} Rp {trx.amount.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Profil */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Koreksi Data Siswa</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tempat Lahir</label>
                  <input
                    type="text"
                    value={formData.birthPlace}
                    onChange={(e) => setFormData({...formData, birthPlace: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat Lengkap</label>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
