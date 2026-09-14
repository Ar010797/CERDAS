import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Sparkles, Save, FileDown, BookOpen, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const CLASSES_LIST = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Kelas 7', 'Kelas 8', 'Kelas 9'];

export default function LessonPlansGuru() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';
  
  const [selectedClass, setSelectedClass] = useState(
    isAdmin ? 'Kelas 1' : (userData?.assigned_class || 'Kelas 1')
  );
  
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [kelasSemester, setKelasSemester] = useState(`${selectedClass} / Ganjil`);
  const [alokasiWaktu, setAlokasiWaktu] = useState('');
  const [materi, setMateri] = useState('');
  const [tujuanPembelajaran, setTujuanPembelajaran] = useState('');
  const [pendahuluan, setPendahuluan] = useState('');
  const [kegiatanInti, setKegiatanInti] = useState('');
  const [penutup, setPenutup] = useState('');
  const [latihanSoal, setLatihanSoal] = useState('');
  const [penilaian, setPenilaian] = useState('');
  const [saving, setSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [questionType, setQuestionType] = useState<'Pilihan Ganda' | 'Uraian'>('Pilihan Ganda');
  const [questionCount, setQuestionCount] = useState(5);

  // Settings
  const [schoolSettings, setSchoolSettings] = useState({
    namaSekolah: 'CERDAS',
    namaKepalaSekolah: '',
    nipKepalaSekolah: ''
  });
  
  useEffect(() => {
    setKelasSemester(`${selectedClass} / Ganjil`);
  }, [selectedClass]);
  
  useEffect(() => {
    const unsubSchool = onSnapshot(doc(db, 'pengaturan_sekolah', 'utama'), (docSnap) => {
      if (docSnap.exists()) {
        setSchoolSettings(docSnap.data() as any);
      }
    });
    return () => unsubSchool();
  }, []);

  const handleGenerateTemplate = async () => {
    if (!mataPelajaran.trim() || !materi.trim()) {
      alert("Silakan isi Mata Pelajaran dan Materi yang Disampaikan terlebih dahulu.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-rpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mataPelajaran, materi, questionType, questionCount })
      });
      const data = await response.json();
      if (response.ok) {
        setKelasSemester(`${selectedClass} / Ganjil`);
        setAlokasiWaktu("2 x 45 Menit (1 Pertemuan)");
        if (data.tujuanPembelajaran) setTujuanPembelajaran(data.tujuanPembelajaran);
        if (data.pendahuluan) setPendahuluan(data.pendahuluan);
        if (data.kegiatanInti) setKegiatanInti(data.kegiatanInti);
        if (data.penutup) setPenutup(data.penutup);
        if (data.latihanSoal) setLatihanSoal(data.latihanSoal);
        if (data.penilaian) setPenilaian(data.penilaian);
      } else {
        alert(data.error || "Gagal membuat draft RPP.");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsGenerating(false);
    }
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
        materi,
        tujuanPembelajaran,
        pendahuluan,
        kegiatanInti,
        penutup,
        latihanSoal,
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

    let yPos = 60;
    const lineHeight = 5;
    const maxWidth = 170;

    const printSection = (title: string, content: string) => {
      if (yPos > 260) {
        pdf.addPage();
        yPos = 20;
      }
      pdf.setFont("helvetica", "bold");
      pdf.text(title, 20, yPos);
      yPos += lineHeight;
      
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(content || '-', maxWidth);
      
      if (yPos + (lines.length * lineHeight) > 280) {
        pdf.addPage();
        yPos = 20;
      }
      
      pdf.text(lines, 20, yPos);
      yPos += (lines.length * lineHeight) + 8;
    };

    printSection('A. Tujuan Pembelajaran', tujuanPembelajaran);
    printSection('B. Materi Pembelajaran', materi);
    printSection('C. Kegiatan Pendahuluan', pendahuluan);
    printSection('D. Kegiatan Inti', kegiatanInti);
    printSection('E. Kegiatan Penutup', penutup);
    printSection('F. Latihan Soal', latihanSoal);
    printSection('G. Penilaian Pembelajaran', penilaian);

    // Tanda Tangan
    if (yPos > 230) {
      pdf.addPage();
      yPos = 20;
    } else {
      yPos += 10;
    }

    pdf.setFont("helvetica", "normal");
    pdf.text('Mengetahui,', 40, yPos, { align: 'center' });
    pdf.text('Kepala Sekolah', 40, yPos + 6, { align: 'center' });
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`${schoolSettings.namaKepalaSekolah || '________________________'}`, 40, yPos + 25, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    
    if(schoolSettings.nipKepalaSekolah) {
      pdf.text(`NIP. ${schoolSettings.nipKepalaSekolah}`, 40, yPos + 30, { align: 'center' });
    } else {
      pdf.text(`NIP. __________________`, 40, yPos + 30, { align: 'center' });
    }

    pdf.text(`${schoolSettings.namaSekolah || 'Sekolah'}, ${format(new Date(), 'dd MMMM yyyy', { locale: id })}`, 160, yPos, { align: 'center' });
    pdf.text('Guru Mata Pelajaran', 160, yPos + 6, { align: 'center' });
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`${isAdmin ? '________________________' : (userData?.name || '________________________')}`, 160, yPos + 25, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    pdf.text(`NIP. __________________`, 160, yPos + 30, { align: 'center' });

    pdf.save(`RPP_1_Lembar_${mataPelajaran.replace(/\s+/g, '_')}_${selectedClass.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs text-indigo-100 font-medium mb-2 border border-white/10">
              <BookOpen className="w-3.5 h-3.5 text-indigo-200" />
              <span>Modul E-RPP Dapodik</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">E-RPP 1 Lembar</h1>
            <p className="text-indigo-100 text-sm mt-1 max-w-xl">
              Susun Rencana Pelaksanaan Pembelajaran (RPP) sesuai standar Dapodik (SE Mendikbud No.14 2019).
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/20">
                <Filter className="w-4 h-4 text-white" />
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-white outline-none [&>option]:text-slate-800"
                >
                  {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <button
              onClick={handleGenerateTemplate}
              disabled={isGenerating}
              className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-2xl text-xs font-semibold backdrop-blur-md border border-white/20 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{isGenerating ? 'Membuat Draft...' : 'Isi Otomatis (AI Draft)'}</span>
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm transition-all"
            >
              <FileDown className="w-4 h-4" />
              <span>Cetak PDF</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Draft'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        {/* Identitas Section */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Identitas Pembelajaran</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Mata Pelajaran</label>
              <input
                type="text"
                placeholder="Contoh: Matematika"
                value={mataPelajaran}
                onChange={(e) => setMataPelajaran(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 placeholder:font-normal"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Kelas / Semester</label>
              <input
                type="text"
                placeholder="Contoh: Kelas 1 / Ganjil"
                value={kelasSemester}
                onChange={(e) => setKelasSemester(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Alokasi Waktu</label>
              <input
                type="text"
                placeholder="Contoh: 2 x 45 Menit"
                value={alokasiWaktu}
                onChange={(e) => setAlokasiWaktu(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Materi yang Disampaikan</label>
            <textarea
              rows={2}
              placeholder="Contoh: Operasi Hitung Campuran"
              value={materi}
              onChange={(e) => setMateri(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
            />
          </div>
          
          <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-indigo-900 mb-1">Tipe Soal (Otomatis)</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"
              >
                <option value="Pilihan Ganda">Pilihan Ganda</option>
                <option value="Uraian">Uraian / Esai</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-indigo-900 mb-1">Jumlah Soal</label>
              <input
                type="number"
                min="1"
                max="20"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"
              />
            </div>
            <div className="flex-1 text-xs text-indigo-600 font-medium">
              *Tipe dan Jumlah Soal di atas akan digunakan saat Anda menekan tombol <strong className="text-indigo-800">Isi Otomatis (AI Draft)</strong>
            </div>
          </div>
        </div>

        {/* Komponen Inti Section */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Komponen Inti (3 Pilar)</h2>
          <div className="space-y-6">
            
            {/* A. Tujuan Pembelajaran */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
              <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-md flex items-center justify-center text-xs">A</span>
                Tujuan Pembelajaran
              </label>
              <textarea
                rows={3}
                placeholder="Tuliskan tujuan pembelajaran yang ingin dicapai..."
                value={tujuanPembelajaran}
                onChange={(e) => setTujuanPembelajaran(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed"
              />
            </div>

            {/* B. Langkah Pembelajaran */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
              <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-md flex items-center justify-center text-xs">B</span>
                Langkah-Langkah Kegiatan Pembelajaran
              </label>
              
              <div className="ml-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">1. Kegiatan Pendahuluan (15 Menit)</label>
                  <textarea
                    rows={3}
                    placeholder="Kegiatan awal, apersepsi, motivasi..."
                    value={pendahuluan}
                    onChange={(e) => setPendahuluan(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">2. Kegiatan Inti (60 Menit)</label>
                  <textarea
                    rows={4}
                    placeholder="Model pembelajaran, sintaks, eksplorasi, diskusi..."
                    value={kegiatanInti}
                    onChange={(e) => setKegiatanInti(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">3. Kegiatan Penutup (15 Menit)</label>
                  <textarea
                    rows={3}
                    placeholder="Kesimpulan, refleksi, penugasan, doa..."
                    value={penutup}
                    onChange={(e) => setPenutup(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* C. Penilaian */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
              <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-md flex items-center justify-center text-xs">C</span>
                Penilaian Pembelajaran (Assessment)
              </label>
              <textarea
                rows={4}
                placeholder="Jelaskan instrumen penilaian sikap, pengetahuan, dan keterampilan..."
                value={penilaian}
                onChange={(e) => setPenilaian(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed"
              />
            </div>

            {/* D. Latihan Soal */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
              <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-md flex items-center justify-center text-xs">D</span>
                Latihan Soal
              </label>
              <textarea
                rows={4}
                placeholder="Tuliskan latihan soal untuk siswa..."
                value={latihanSoal}
                onChange={(e) => setLatihanSoal(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed"
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
