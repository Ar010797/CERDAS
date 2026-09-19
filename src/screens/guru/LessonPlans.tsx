import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Sparkles, Save, FileDown, BookOpen, Filter, Plus, Trash2, Edit2, ChevronLeft, Calendar, FileText, X, ListOrdered, Edit3, CheckCircle2, HelpCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

const CLASSES_LIST = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Kelas 7', 'Kelas 8', 'Kelas 9'];

export interface FormattedPTSQuestion {
  number: number;
  question: string;
  options: { label: string; text: string }[];
  answerKey: string;
}

export function parsePTSQuestions(text: string): FormattedPTSQuestion[] {
  if (!text || !text.trim()) return [];

  const lines = text.split('\n');
  const questions: FormattedPTSQuestion[] = [];
  let currentQ: { number: number; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const matchNum = trimmed.match(/^(\d+)[\.\)]\s*(.*)/);
    if (matchNum) {
      if (currentQ) {
        questions.push(buildPTSQuestion(currentQ.number, currentQ.lines));
      }
      currentQ = { number: parseInt(matchNum[1], 10), lines: [matchNum[2]] };
    } else if (currentQ) {
      currentQ.lines.push(trimmed);
    }
  }
  if (currentQ) {
    questions.push(buildPTSQuestion(currentQ.number, currentQ.lines));
  }

  return questions;
}

function buildPTSQuestion(num: number, lines: string[]): FormattedPTSQuestion {
  let questionText = '';
  const options: { label: string; text: string }[] = [];
  let answerKey = '';
  let inOptions = false;

  for (const line of lines) {
    const optMatch = line.match(/^([A-Da-d])[\.\)]\s*(.*)/);
    const keyMatch = line.match(/^(?:Kunci(?:\s+Jawaban)?|Kunci|Rubrik(?:\s+Penilaian)?)\s*[:\-]\s*(.*)/i);

    if (keyMatch) {
      answerKey = keyMatch[1] || line;
      inOptions = false;
    } else if (optMatch) {
      options.push({ label: optMatch[1].toUpperCase(), text: optMatch[2] });
      inOptions = true;
    } else if (inOptions && options.length > 0) {
      options[options.length - 1].text += ' ' + line;
    } else if (!answerKey) {
      questionText = questionText ? questionText + ' ' + line : line;
    } else {
      answerKey += ' ' + line;
    }
  }

  return {
    number: num,
    question: questionText || lines[0] || '',
    options,
    answerKey
  };
}

export function formatAsPTS(text: string): string {
  const parsed = parsePTSQuestions(text);
  if (parsed.length === 0) return text;

  return parsed.map((q, idx) => {
    let out = `${idx + 1}. ${q.question}`;
    if (q.options && q.options.length > 0) {
      q.options.forEach(opt => {
        out += `\n   ${opt.label}. ${opt.text}`;
      });
    }
    if (q.answerKey) {
      out += `\n   Kunci Jawaban: ${q.answerKey}`;
    }
    return out;
  }).join('\n\n');
}

export default function LessonPlansGuru() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';
  
  const [view, setView] = useState<'list' | 'form'>('list');
  const [savedRpps, setSavedRpps] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedClass, setSelectedClass] = useState(
    isAdmin ? 'Kelas 1' : (userData?.assigned_class || 'Kelas 1')
  );
  
  // Form State
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
  const [questionTab, setQuestionTab] = useState<'pts' | 'raw'>('pts');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFormatPTS = () => {
    if (!latihanSoal.trim()) return;
    const formatted = formatAsPTS(latihanSoal);
    setLatihanSoal(formatted);
    showToast('Format soal berhasil dirapikan sesuai standar PTS!', 'success');
  };

  const [schoolSettings, setSchoolSettings] = useState({
    namaSekolah: 'CERDAS',
    namaKepalaSekolah: '',
    nipKepalaSekolah: ''
  });

  // Load Settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'school'), (doc) => {
      if (doc.exists()) {
        setSchoolSettings({
          namaSekolah: doc.data().schoolName || 'CERDAS',
          namaKepalaSekolah: doc.data().kepalaSekolah || '',
          nipKepalaSekolah: doc.data().nipKepalaSekolah || ''
        });
      }
    });
    return () => unsub();
  }, []);

  // Load Saved RPPs
  useEffect(() => {
    if (!userData) return;
    
    let q = query(collection(db, 'lesson_plans'));
    
    if (!isAdmin) {
      q = query(collection(db, 'lesson_plans'), where('teacherId', '==', userData.uid));
    }

    const unsub = onSnapshot(q, (snap) => {
      const plans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory because Firestore composite index might not exist
      plans.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSavedRpps(plans);
    });
    
    return () => unsub();
  }, [userData, isAdmin]);

  const resetForm = () => {
    setEditingId(null);
    setMataPelajaran('');
    setKelasSemester(`${selectedClass} / Ganjil`);
    setAlokasiWaktu('');
    setMateri('');
    setTujuanPembelajaran('');
    setPendahuluan('');
    setKegiatanInti('');
    setPenutup('');
    setLatihanSoal('');
    setPenilaian('');
  };

  const handleOpenForm = (rpp?: any) => {
    if (rpp) {
      setEditingId(rpp.id);
      setSelectedClass(rpp.kelasSemester.split(' / ')[0] || selectedClass);
      setMataPelajaran(rpp.mataPelajaran);
      setKelasSemester(rpp.kelasSemester);
      setAlokasiWaktu(rpp.alokasiWaktu);
      setMateri(rpp.materi);
      setTujuanPembelajaran(rpp.tujuanPembelajaran);
      setPendahuluan(rpp.pendahuluan);
      setKegiatanInti(rpp.kegiatanInti);
      setPenutup(rpp.penutup);
      setLatihanSoal(rpp.latihanSoal);
      setPenilaian(rpp.penilaian);
    } else {
      resetForm();
    }
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus E-RPP ini?")) {
      try {
        await deleteDoc(doc(db, 'lesson_plans', id));
      } catch (err) {
        console.error(err);
        alert("Gagal menghapus E-RPP.");
      }
    }
  };

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
      
      let data;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        if (!response.ok) {
          throw new Error(`Server error (${response.status}): Server sibuk atau waktu habis. Silakan coba lagi.`);
        }
        throw new Error('Respons server tidak valid.');
      }

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
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Terjadi kesalahan saat menghubungi layanan AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!mataPelajaran || !materi) {
      alert("Mata Pelajaran dan Materi harus diisi.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        teacherId: userData?.uid,
        teacherName: userData?.name || 'Guru',
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
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'lesson_plans', editingId), payload);
        alert('RPP berhasil diperbarui!');
      } else {
        await addDoc(collection(db, 'lesson_plans'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        alert('RPP berhasil disimpan!');
      }
      setView('list');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan RPP.');
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = (rppData?: any) => {
    const dataToExport = rppData || {
      mataPelajaran, kelasSemester, alokasiWaktu, materi,
      tujuanPembelajaran, pendahuluan, kegiatanInti, penutup, latihanSoal, penilaian
    };

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
    pdf.text(`Mata Pelajaran`, 20, 46); pdf.text(`: ${dataToExport.mataPelajaran}`, 60, 46);
    pdf.text(`Kelas/Semester`, 120, 40); pdf.text(`: ${dataToExport.kelasSemester}`, 155, 40);
    pdf.text(`Alokasi Waktu`, 120, 46); pdf.text(`: ${dataToExport.alokasiWaktu}`, 155, 46);
    
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

    const printQuestionsSection = (title: string, content: string) => {
      if (yPos > 255) {
        pdf.addPage();
        yPos = 20;
      }
      pdf.setFont("helvetica", "bold");
      pdf.text(title, 20, yPos);
      yPos += lineHeight + 2;

      const parsed = parsePTSQuestions(content);
      if (parsed.length > 0) {
        for (const q of parsed) {
          if (yPos > 260) {
            pdf.addPage();
            yPos = 20;
          }

          pdf.setFont("helvetica", "bold");
          const qTextLines = pdf.splitTextToSize(`${q.number}. ${q.question}`, maxWidth);
          pdf.text(qTextLines, 20, yPos);
          yPos += (qTextLines.length * lineHeight) + 1;

          if (q.options && q.options.length > 0) {
            pdf.setFont("helvetica", "normal");
            for (const opt of q.options) {
              if (yPos > 275) {
                pdf.addPage();
                yPos = 20;
              }
              const optLines = pdf.splitTextToSize(`${opt.label}. ${opt.text}`, maxWidth - 10);
              pdf.text(optLines, 28, yPos);
              yPos += (optLines.length * lineHeight);
            }
          }

          if (q.answerKey) {
            if (yPos > 275) {
              pdf.addPage();
              yPos = 20;
            }
            pdf.setFont("helvetica", "italic");
            const keyLines = pdf.splitTextToSize(`* Kunci Jawaban: ${q.answerKey}`, maxWidth - 10);
            pdf.text(keyLines, 28, yPos);
            yPos += (keyLines.length * lineHeight) + 1;
          }

          yPos += 3;
        }
        yPos += 5;
      } else {
        pdf.setFont("helvetica", "normal");
        const lines = pdf.splitTextToSize(content || '-', maxWidth);
        if (yPos + (lines.length * lineHeight) > 280) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(lines, 20, yPos);
        yPos += (lines.length * lineHeight) + 8;
      }
    };

    printSection('A. Tujuan Pembelajaran', dataToExport.tujuanPembelajaran);
    printSection('B. Materi Pembelajaran', dataToExport.materi);
    printSection('C. Kegiatan Pendahuluan', dataToExport.pendahuluan);
    printSection('D. Kegiatan Inti', dataToExport.kegiatanInti);
    printSection('E. Kegiatan Penutup', dataToExport.penutup);
    printQuestionsSection('F. Latihan Soal & Kunci Jawaban (Format PTS)', dataToExport.latihanSoal);
    printSection('G. Penilaian Pembelajaran', dataToExport.penilaian);

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
    const teacherName = dataToExport.teacherName || (isAdmin ? '________________________' : (userData?.name || '________________________'));
    pdf.text(`${teacherName}`, 160, yPos + 25, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    pdf.text(`NIP. __________________`, 160, yPos + 30, { align: 'center' });

    pdf.save(`RPP_${dataToExport.mataPelajaran.replace(/\s+/g, '_')}_${dataToExport.kelasSemester.split(' / ')[0].replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-400 opacity-20 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs text-indigo-100 font-medium mb-2 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Didukung oleh AI</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">
              E-RPP Cerdas
            </h1>
            <p className="text-indigo-100 font-medium text-sm md:text-base max-w-2xl">
              Buat, kelola, dan cetak Rencana Pelaksanaan Pembelajaran dalam hitungan detik dengan bantuan AI.
            </p>
          </div>

          {view === 'list' ? (
            <button
              onClick={() => handleOpenForm()}
              className="flex items-center space-x-2 bg-white text-indigo-700 hover:bg-indigo-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-lg transition-all hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              <span>Buat RPP Baru</span>
            </button>
          ) : (
            <button
              onClick={() => setView('list')}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-lg transition-all backdrop-blur-md"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Kembali ke Daftar</span>
            </button>
          )}
        </div>
      </div>

      {view === 'list' ? (
        /* LIST VIEW */
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Daftar E-RPP Tersimpan
            </h2>
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200">
              Total: {savedRpps.length} RPP
            </div>
          </div>

          {savedRpps.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-10 h-10 text-indigo-300" />
              </div>
              <h3 className="text-slate-700 font-bold text-lg mb-2">Belum Ada RPP</h3>
              <p className="text-slate-500 text-sm max-w-sm mb-6">Anda belum membuat RPP apapun. Klik tombol "Buat RPP Baru" di atas untuk mulai membuat RPP menggunakan AI.</p>
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center space-x-2 bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-3 rounded-2xl text-sm font-bold shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Buat RPP Pertama</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {savedRpps.map((rpp) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={rpp.id} 
                    className="bg-white border border-slate-200 hover:border-indigo-300 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {rpp.kelasSemester}
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => exportPDF(rpp)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Unduh PDF">
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleOpenForm(rpp)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(rpp.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="text-base font-bold text-slate-800 mb-1">{rpp.mataPelajaran}</h3>
                    <p className="text-sm font-medium text-slate-500 mb-4 line-clamp-2">{rpp.materi}</p>
                    
                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {rpp.createdAt ? format(new Date(rpp.createdAt), 'dd MMM yyyy') : '-'}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md">
                          Guru: {rpp.teacherName}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      ) : (
        /* FORM VIEW */
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                {editingId ? 'Edit E-RPP' : 'Buat E-RPP Baru'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleGenerateTemplate}
                  disabled={isGenerating}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {isGenerating ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{isGenerating ? 'Menyusun Draft AI...' : 'Isi Otomatis (AI)'}</span>
                </button>
                <button
                  onClick={() => exportPDF()}
                  className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Pratinjau PDF</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center space-x-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{saving ? 'Menyimpan...' : 'Simpan RPP'}</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Identitas Section */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 uppercase tracking-wide">1. Identitas Pembelajaran</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Mata Pelajaran <span className="text-red-500">*</span></label>
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
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Materi yang Disampaikan <span className="text-red-500">*</span></label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Operasi Hitung Campuran pada Pecahan"
                    value={materi}
                    onChange={(e) => setMateri(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                  />
                </div>
                
                {/* AI Configuration Box */}
                <div className="mt-6 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Sparkles className="w-16 h-16 text-indigo-500" />
                  </div>
                  <div className="flex-1 relative z-10">
                    <label className="block text-xs font-bold text-indigo-900 mb-1">Tipe Latihan Soal AI</label>
                    <select
                      value={questionType}
                      onChange={(e) => setQuestionType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-sm"
                    >
                      <option value="Pilihan Ganda">Pilihan Ganda</option>
                      <option value="Uraian">Uraian / Esai</option>
                    </select>
                  </div>
                  <div className="flex-1 relative z-10">
                    <label className="block text-xs font-bold text-indigo-900 mb-1">Jumlah Soal AI</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-sm"
                    />
                  </div>
                  <div className="flex-1 text-xs text-indigo-700 font-medium relative z-10 bg-white/60 p-3 rounded-xl border border-white backdrop-blur-sm">
                    Isi bagian di atas, lalu klik tombol <strong className="text-orange-600 font-extrabold">Isi Otomatis (AI)</strong> untuk menyusun draft lengkap secara instan.
                  </div>
                </div>
              </div>

              {/* Komponen Inti Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 uppercase tracking-wide">2. Komponen Inti & Lampiran</h3>
                <div className="space-y-5">
                  
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="bg-indigo-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs shadow-sm">A</span>
                      Tujuan Pembelajaran
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Tuliskan tujuan pembelajaran yang ingin dicapai..."
                      value={tujuanPembelajaran}
                      onChange={(e) => setTujuanPembelajaran(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed"
                    />
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                    <label className="block text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span className="bg-indigo-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs shadow-sm">B</span>
                      Langkah-Langkah Kegiatan Pembelajaran
                    </label>
                    
                    <div className="ml-0 md:ml-8 space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">1. Kegiatan Pendahuluan</label>
                        <textarea
                          rows={3}
                          placeholder="Kegiatan awal, apersepsi, motivasi..."
                          value={pendahuluan}
                          onChange={(e) => setPendahuluan(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed whitespace-pre-wrap"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">2. Kegiatan Inti</label>
                        <textarea
                          rows={5}
                          placeholder="Model pembelajaran, sintaks, eksplorasi, diskusi..."
                          value={kegiatanInti}
                          onChange={(e) => setKegiatanInti(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed whitespace-pre-wrap"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">3. Kegiatan Penutup</label>
                        <textarea
                          rows={3}
                          placeholder="Kesimpulan, refleksi, penugasan, doa..."
                          value={penutup}
                          onChange={(e) => setPenutup(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed whitespace-pre-wrap"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="bg-indigo-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs shadow-sm">C</span>
                      Penilaian Pembelajaran (Assessment)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Jelaskan instrumen penilaian sikap, pengetahuan, dan keterampilan..."
                      value={penilaian}
                      onChange={(e) => setPenilaian(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed whitespace-pre-wrap"
                    />
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <span className="bg-indigo-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs shadow-sm">D</span>
                        <span>Latihan Soal & Kunci Jawaban</span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Format PTS
                        </span>
                      </label>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setQuestionTab('pts')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              questionTab === 'pts' 
                                ? 'bg-white text-indigo-700 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <ListOrdered className="w-3.5 h-3.5" />
                            <span>Tampilan Rapi (PTS)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuestionTab('raw')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              questionTab === 'raw' 
                                ? 'bg-white text-indigo-700 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Teks</span>
                          </button>
                        </div>

                        {latihanSoal.trim() && (
                          <button
                            type="button"
                            onClick={handleFormatPTS}
                            title="Rapikan penomoran dan posisi pilihan soal secara otomatis"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Rapikan Format</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {questionTab === 'pts' ? (
                      <div>
                        {(() => {
                          const parsed = parsePTSQuestions(latihanSoal);
                          if (parsed.length === 0) {
                            return (
                              <div className="text-center py-10 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 p-6">
                                <ListOrdered className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-700 font-bold text-sm mb-1">Belum Ada Soal Latihan</p>
                                <p className="text-slate-400 text-xs max-w-md mx-auto mb-4">
                                  Klik tombol <strong className="text-orange-600 font-extrabold">Isi Otomatis (AI)</strong> di atas untuk membuat paket soal PTS rapi secara instan, atau beralih ke tab <strong>Edit Teks</strong> untuk mengetik manual.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setQuestionTab('raw')}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-sm"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Ketik / Tempel Soal
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-indigo-900 bg-indigo-50/70 px-4 py-2.5 rounded-xl border border-indigo-100">
                                <span className="font-extrabold flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                  Tersusun {parsed.length} Butir Soal Standar PTS
                                </span>
                                <span className="text-[11px] text-indigo-600 font-medium">
                                  Penomoran, pilihan jawaban, dan kunci tersusun simetris
                                </span>
                              </div>

                              <div className="space-y-4">
                                {parsed.map((q) => (
                                  <div
                                    key={q.number}
                                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition-all space-y-3.5 shadow-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                      <div className="flex items-center gap-2">
                                        <span className="bg-indigo-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg shadow-xs">
                                          Soal {q.number}
                                        </span>
                                        <span className="bg-slate-200/80 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-md">
                                          {q.options && q.options.length > 0 ? 'Pilihan Ganda' : 'Uraian / Esai'}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="text-slate-800 font-bold text-sm leading-relaxed whitespace-pre-wrap pl-1">
                                      {q.question}
                                    </div>

                                    {q.options && q.options.length > 0 && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                                        {q.options.map((opt) => (
                                          <div
                                            key={opt.label}
                                            className="flex items-start gap-3 p-3 rounded-xl border border-slate-200/80 bg-white text-sm hover:border-indigo-200 transition-colors shadow-xs"
                                          >
                                            <span className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                                              {opt.label}
                                            </span>
                                            <span className="text-slate-700 font-medium pt-0.5 leading-snug">
                                              {opt.text}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {q.answerKey && (
                                      <div className="mt-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div className="leading-relaxed">
                                          <strong className="font-extrabold text-emerald-900 mr-1.5">
                                            Kunci Jawaban & Pembahasan:
                                          </strong>
                                          <span className="font-medium text-emerald-800">{q.answerKey}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          rows={9}
                          placeholder={`Format standar PTS:\n1. Pertanyaan soal nomor satu?\n   A. Pilihan jawaban A\n   B. Pilihan jawaban B\n   C. Pilihan jawaban C\n   D. Pilihan jawaban D\n   Kunci Jawaban: A (Pembahasan singkat)\n\n2. Pertanyaan soal nomor dua?`}
                          value={latihanSoal}
                          onChange={(e) => setLatihanSoal(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed whitespace-pre-wrap"
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 pt-1">
                          <span>Ketik atau tempel soal dengan nomor urut (1., 2.) dan pilihan (A., B., C., D.).</span>
                          <button
                            type="button"
                            onClick={() => setQuestionTab('pts')}
                            className="text-indigo-600 hover:text-indigo-700 font-bold self-end sm:self-auto"
                          >
                            Lihat Tampilan Rapi (PTS) &rarr;
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Toast Notification (SnackBar) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            <span className="font-semibold text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
