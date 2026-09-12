import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Sparkles, Save, FileDown, BookOpen } from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function LessonPlansGuru() {
  const { userData } = useAuth();
  
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [kelasSemester, setKelasSemester] = useState('');
  const [alokasiWaktu, setAlokasiWaktu] = useState('');
  const [tujuanPembelajaran, setTujuanPembelajaran] = useState('');
  const [pendahuluan, setPendahuluan] = useState('');
  const [kegiatanInti, setKegiatanInti] = useState('');
  const [penutup, setPenutup] = useState('');
  const [penilaian, setPenilaian] = useState('');
  const [saving, setSaving] = useState(false);

  // Settings
  const [schoolSettings, setSchoolSettings] = useState({
    namaSekolah: 'SI Miftahussalam',
    namaKepalaSekolah: '',
    nipKepalaSekolah: ''
  });
  
  useEffect(() => {
    const unsubSchool = onSnapshot(doc(db, 'pengaturan_sekolah', 'utama'), (docSnap) => {
      if (docSnap.exists()) {
        setSchoolSettings(docSnap.data() as any);
      }
    });
    return () => unsubSchool();
  }, []);

  const handleGenerateTemplate = () => {
    if (!mataPelajaran.trim()) {
      alert("Silakan isi Mata Pelajaran terlebih dahulu.");
      return;
    }
    
    setKelasSemester(userData?.assigned_class + " / Ganjil");
    setAlokasiWaktu("2 x 45 Menit (1 Pertemuan)");
    setTujuanPembelajaran(`Melalui model pembelajaran Discovery Learning, siswa mampu memahami, menjelaskan, dan mempraktekkan konsep ${mataPelajaran} dengan disiplin dan penuh tanggung jawab.`);
    setPendahuluan(`1. Guru mengucapkan salam dan memimpin doa.\n2. Mengabsen siswa dan mengecek kebersihan kelas.\n3. Apersepsi: Mengaitkan materi sebelumnya dengan materi ${mataPelajaran} yang akan dipelajari.\n4. Menyampaikan tujuan pembelajaran dan memotivasi siswa.`);
    setKegiatanInti(`1. Eksplorasi: Siswa mengamati video/gambar terkait ${mataPelajaran}.\n2. Elaborasi: Siswa dibagi dalam kelompok untuk mendiskusikan masalah dan menemukan solusi bersama.\n3. Konfirmasi: Siswa mempresentasikan hasil diskusi, guru memberikan umpan balik dan meluruskan miskonsepsi.`);
    setPenutup(`1. Guru dan siswa bersama-sama menyimpulkan materi ${mataPelajaran}.\n2. Melakukan evaluasi singkat/post-test.\n3. Memberikan penugasan (PR) dan menginformasikan materi pertemuan berikutnya.\n4. Menutup dengan doa dan salam.`);
    setPenilaian(`1. Sikap: Observasi keaktifan dan kedisiplinan selama pembelajaran.\n2. Pengetahuan: Tes tertulis (Pilihan Ganda/Uraian).\n3. Keterampilan: Praktik/Presentasi kelompok.`);
  };

  const handleSave = async () => {
    if (!mataPelajaran) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'lesson_plans'), {
        teacherId: userData?.uid,
        mataPelajaran,
        kelasSemester,
        alokasiWaktu,
        tujuanPembelajaran,
        pendahuluan,
        kegiatanInti,
        penutup,
        penilaian,
        createdAt: new Date().toISOString()
      });
      alert('RPP berhasil disimpan!');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan RPP.');
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = () => {
    const pdf = new jsPDF();
    
    // Header
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text('RENCANA PELAKSANAAN PEMBELAJARAN (RPP)', 105, 20, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Sesuai Surat Edaran Kemendikbud No 14 Tahun 2019`, 105, 26, { align: 'center' });
    
    pdf.setLineWidth(0.5);
    pdf.line(20, 30, 190, 30);

    // Identitas
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Nama Sekolah`, 20, 40); pdf.text(`: ${schoolSettings.namaSekolah}`, 60, 40);
    pdf.text(`Mata Pelajaran`, 20, 46); pdf.text(`: ${mataPelajaran}`, 60, 46);
    pdf.text(`Kelas/Semester`, 120, 40); pdf.text(`: ${kelasSemester}`, 155, 40);
    pdf.text(`Alokasi Waktu`, 120, 46); pdf.text(`: ${alokasiWaktu}`, 155, 46);
    
    pdf.line(20, 52, 190, 52);

    let y = 60;
    const addSection = (title: string, content: string) => {
      // Check page break
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      
      pdf.setFont("helvetica", "bold");
      pdf.text(title, 20, y);
      y += 6;
      pdf.setFont("helvetica", "normal");
      
      const splitContent = pdf.splitTextToSize(content, 170);
      
      // Check if content fits, if not add page before printing content
      if (y + (splitContent.length * 5) > 280) {
         pdf.addPage();
         y = 20;
      }

      pdf.text(splitContent, 20, y);
      y += (splitContent.length * 5) + 8;
    };

    addSection('A. TUJUAN PEMBELAJARAN', tujuanPembelajaran);
    addSection('B. KEGIATAN PENDAHULUAN', pendahuluan);
    addSection('C. KEGIATAN INTI', kegiatanInti);
    addSection('D. KEGIATAN PENUTUP', penutup);
    addSection('E. PENILAIAN / ASESMEN', penilaian);

    // Signatures
    if (y > 230) {
      pdf.addPage();
      y = 20;
    }
    
    y += 10;
    const today = format(new Date(), 'd MMMM yyyy', { locale: id });
    pdf.text(`Mengetahui,`, 20, y);
    pdf.text(`.................., ${today}`, 130, y);
    
    y += 6;
    pdf.text(`Kepala Sekolah`, 20, y);
    pdf.text(`Guru Mata Pelajaran / Wali Kelas`, 130, y);
    
    y += 25;
    pdf.setFont("helvetica", "bold");
    pdf.text(`${schoolSettings.namaKepalaSekolah || '________________________'}`, 20, y);
    pdf.text(`${userData?.name || '________________________'}`, 130, y);
    
    pdf.setFont("helvetica", "normal");
    y += 6;
    pdf.text(`NIP. ${schoolSettings.nipKepalaSekolah || '__________________'}`, 20, y);
    pdf.text(`NIP. __________________`, 130, y);

    pdf.save(`RPP_${mataPelajaran.replace(/\s+/g, '_')}_${userData?.assigned_class}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">E-RPP (Rencana Pelaksanaan Pembelajaran)</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Mata Pelajaran</label>
            <div className="flex gap-4">
              <input
                type="text"
                value={mataPelajaran}
                onChange={(e) => setMataPelajaran(e.target.value)}
                placeholder="Contoh: Matematika"
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
              <button
                onClick={handleGenerateTemplate}
                className="flex items-center space-x-2 bg-amber-100 hover:bg-amber-200 text-amber-700 px-6 py-3 rounded-xl transition-colors font-medium whitespace-nowrap"
              >
                <Sparkles className="w-5 h-5" />
                <span className="hidden sm:inline">Generate Template Dapodik</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">Isi mata pelajaran, lalu klik Generate untuk menyusun RPP 1 Lembar standar Dapodik.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Kelas / Semester</label>
              <input
                type="text"
                value={kelasSemester}
                onChange={(e) => setKelasSemester(e.target.value)}
                placeholder="Contoh: Kelas 1 / Ganjil"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Alokasi Waktu</label>
              <input
                type="text"
                value={alokasiWaktu}
                onChange={(e) => setAlokasiWaktu(e.target.value)}
                placeholder="Contoh: 2 x 45 Menit"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">A. Tujuan Pembelajaran</label>
            <textarea
              value={tujuanPembelajaran}
              onChange={(e) => setTujuanPembelajaran(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">B. Kegiatan Pendahuluan</label>
            <textarea
              value={pendahuluan}
              onChange={(e) => setPendahuluan(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">C. Kegiatan Inti</label>
            <textarea
              value={kegiatanInti}
              onChange={(e) => setKegiatanInti(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">D. Kegiatan Penutup</label>
            <textarea
              value={penutup}
              onChange={(e) => setPenutup(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">E. Penilaian / Asesmen</label>
            <textarea
              value={penilaian}
              onChange={(e) => setPenilaian(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none"
            />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-end">
          <button
            onClick={exportPDF}
            disabled={!mataPelajaran || !tujuanPembelajaran}
            className="flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl transition-colors font-medium disabled:opacity-50"
          >
            <FileDown className="w-5 h-5" />
            <span>Ekspor PDF (A4)</span>
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving || !mataPelajaran}
            className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl transition-colors font-medium shadow-sm shadow-indigo-200 disabled:opacity-50"
          >
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            <span>{saving ? 'Menyimpan...' : 'Simpan RPP'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
