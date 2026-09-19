import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Sparkles, Save, FileDown, BookOpen, Filter, Plus, Trash2, Edit2, ChevronLeft, Calendar, FileText, X, ListOrdered, Edit3, CheckCircle2, HelpCircle, ExternalLink, Printer, Eye, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

const CLASSES_LIST = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Kelas 7', 'Kelas 8', 'Kelas 9'];

export const QUICK_TOPICS = [
  { label: '📐 MTK: Operasi Pecahan', mapel: 'Matematika', materi: 'Operasi Hitung Penjumlahan dan Pengurangan Pecahan' },
  { label: '🔬 IPA: Tata Surya & Planet', mapel: 'Ilmu Pengetahuan Alam (IPA)', materi: 'Sistem Tata Surya dan Karakteristik Planet' },
  { label: '📖 B.IND: Teks Eksplanasi', mapel: 'Bahasa Indonesia', materi: 'Menemukan Gagasan Pokok dan Menulis Teks Eksplanasi' },
  { label: '🌍 IPS: Kenampakan Alam', mapel: 'Ilmu Pengetahuan Sosial (IPS)', materi: 'Kenampakan Alam dan Pemanfaatan Sumber Daya Lingkungan' },
  { label: '🕌 PAI: Akhlak Terpuji', mapel: 'Pendidikan Agama Islam', materi: 'Meneladani Sikap Jujur dan Amanah dalam Kehidupan Sehari-hari' },
  { label: '🇬🇧 B.ING: Daily Routines', mapel: 'Bahasa Inggris', materi: 'Describing Daily Routine using Simple Present Tense' },
  { label: '🏃 PJOK: Kebugaran Jasmani', mapel: 'Pendidikan Jasmani & Kesehatan', materi: 'Aktivitas Latihan Daya Tahan Jantung dan Kelincahan Tubuh' },
];

export interface FormattedPTSQuestion {
  number: number;
  question: string;
  options: { label: string; text: string }[];
  answerKey: string;
}

export function parsePTSQuestions(text: string): FormattedPTSQuestion[] {
  if (!text || !text.trim()) return [];

  const rawLines = text.split('\n');
  const questions: FormattedPTSQuestion[] = [];
  let currentQ: { number: number; lines: string[] } | null = null;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check if line indicates a new question number (e.g. 1., 1), No. 1, Soal 1:)
    const isOptionStart = /^[\(\[]?[A-Da-d][\.\)\]]/.test(trimmed);
    const numMatch = trimmed.match(/^(?:Soal\s+|No\.\s*)?(\d+)[\.\)\:\-]\s*(.*)/i);

    if (numMatch && !isOptionStart) {
      if (currentQ) {
        questions.push(buildPTSQuestion(currentQ.number, currentQ.lines));
      }
      currentQ = { number: parseInt(numMatch[1], 10), lines: numMatch[2].trim() ? [numMatch[2].trim()] : [] };
    } else if (currentQ) {
      // Check if line has multiple inline options (e.g. 'A. x   B. y   C. z   D. w')
      const inlineMatches = trimmed.match(/[\(\[]?[A-Da-d][\.\)\]]\s+/g);
      if (inlineMatches && inlineMatches.length > 1) {
        const parts = trimmed.split(/(?=[\(\[]?[A-Da-d][\.\)\]]\s+)/);
        for (const p of parts) {
          if (p.trim()) currentQ.lines.push(p.trim());
        }
      } else {
        currentQ.lines.push(trimmed);
      }
    }
  }

  if (currentQ) {
    questions.push(buildPTSQuestion(currentQ.number, currentQ.lines));
  }

  return questions;
}

function buildPTSQuestion(num: number, lines: string[]): FormattedPTSQuestion {
  const questionParts: string[] = [];
  const options: { label: string; text: string }[] = [];
  let answerKey = '';
  let inOptions = false;

  for (const line of lines) {
    if (!line) continue;
    const optMatch = line.match(/^[\(\[]?([A-Da-d])[\.\)\]]\s*(.*)/);
    const keyMatch = line.match(/^(?:\*?\s*(?:Kunci\s*(?:Jawaban)?|Jawaban|Rubrik\s*(?:Penilaian)?|Pembahasan))\s*[:\-]\s*(.*)/i);

    if (keyMatch) {
      answerKey = keyMatch[1] || line;
      inOptions = false;
    } else if (optMatch) {
      options.push({ label: optMatch[1].toUpperCase(), text: optMatch[2] });
      inOptions = true;
    } else if (inOptions && options.length > 0) {
      options[options.length - 1].text += ' ' + line;
    } else if (!answerKey) {
      questionParts.push(line);
    } else {
      answerKey += ' ' + line;
    }
  }

  return {
    number: num,
    question: questionParts.join(' ').trim() || lines[0] || '',
    options,
    answerKey: answerKey.trim()
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

  // Cross-device PDF & modal states
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState<string>('');
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
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
      setMataPelajaran(rpp.mataPelajaran || '');
      setKelasSemester(rpp.kelasSemester || `${selectedClass} / Ganjil`);
      setAlokasiWaktu(rpp.alokasiWaktu || '');
      setMateri(rpp.materi || '');
      setTujuanPembelajaran(rpp.tujuanPembelajaran || '');
      setPendahuluan(rpp.pendahuluan || '');
      setKegiatanInti(rpp.kegiatanInti || '');
      setPenutup(rpp.penutup || '');
      setLatihanSoal(rpp.latihanSoal || '');
      setPenilaian(rpp.penilaian || '');
    } else {
      resetForm();
    }
    setView('form');
  };

  const confirmDelete = async () => {
    if (!deleteModalId) return;
    try {
      await deleteDoc(doc(db, 'lesson_plans', deleteModalId));
      showToast("E-RPP berhasil dihapus dari sistem.", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Gagal menghapus E-RPP: " + (err.message || 'Kesalahan sistem'), "error");
    } finally {
      setDeleteModalId(null);
    }
  };

  const handleGenerateTemplate = async () => {
    const cleanMapel = mataPelajaran.trim();
    const cleanMateri = materi.trim();

    if (!cleanMapel || !cleanMateri) {
      showToast("Silakan isi Mata Pelajaran dan Materi terlebih dahulu, atau gunakan tombol rekomendasi di bawah.", "error");
      return;
    }
    
    setIsGenerating(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch('/api/generate-rpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mataPelajaran: cleanMapel, 
          materi: cleanMateri, 
          questionType, 
          questionCount 
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      let data: any;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        if (!response.ok) {
          throw new Error(`Server (${response.status}): Silakan coba beberapa saat lagi.`);
        }
        throw new Error('Respons dari server tidak sesuai format JSON.');
      }

      if (response.ok && data) {
        setKelasSemester(`${selectedClass} / Ganjil`);
        if (!alokasiWaktu.trim()) {
          setAlokasiWaktu("2 x 45 Menit (1 Pertemuan)");
        }
        if (data.tujuanPembelajaran) setTujuanPembelajaran(data.tujuanPembelajaran);
        if (data.pendahuluan) setPendahuluan(data.pendahuluan);
        if (data.kegiatanInti) setKegiatanInti(data.kegiatanInti);
        if (data.penutup) setPenutup(data.penutup);
        if (data.latihanSoal) setLatihanSoal(data.latihanSoal);
        if (data.penilaian) setPenilaian(data.penilaian);
        showToast("✨ Draf E-RPP & bank soal PTS berhasil disusun otomatis!", "success");
      } else {
        showToast(data?.error || "Gagal menyusun draf RPP.", "error");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error(err);
      if (err.name === 'AbortError') {
        showToast("Waktu permintaan habis (timeout). Silakan periksa jaringan dan coba lagi.", "error");
      } else {
        showToast(err.message || "Terjadi kesalahan saat menghubungi layanan AI.", "error");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!mataPelajaran.trim() || !materi.trim()) {
      showToast("Mata Pelajaran dan Materi harus diisi.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        teacherId: userData?.uid,
        teacherName: userData?.name || 'Guru',
        mataPelajaran: mataPelajaran.trim(),
        kelasSemester,
        alokasiWaktu: alokasiWaktu || "2 x 45 Menit (1 Pertemuan)",
        materi: materi.trim(),
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
        showToast('E-RPP berhasil diperbarui!', 'success');
      } else {
        await addDoc(collection(db, 'lesson_plans'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        showToast('E-RPP berhasil disimpan ke database!', 'success');
      }
      setView('list');
    } catch (error: any) {
      console.error(error);
      showToast('Gagal menyimpan E-RPP: ' + (error.message || 'Kesalahan sistem'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = (rppData?: any) => {
    const dataToExport = rppData || {
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
      teacherName: userData?.name || 'Guru Mata Pelajaran'
    };

    const cleanMapel = (dataToExport.mataPelajaran || 'Mata_Pelajaran').trim();
    const cleanKelas = (dataToExport.kelasSemester || selectedClass || 'Kelas').split(' / ')[0].trim();
    const safeFilename = `RPP_${cleanMapel.replace(/\s+/g, '_')}_${cleanKelas.replace(/\s+/g, '_')}.pdf`;

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    let yPos = 18;

    const checkPageBreak = (neededHeight: number = 8) => {
      if (yPos + neededHeight > 275) {
        pdf.addPage();
        yPos = 20;
        return true;
      }
      return false;
    };

    // 1. KOP / HEADER
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text('RENCANA PELAKSANAAN PEMBELAJARAN (RPP)', 105, yPos, { align: 'center' });
    yPos += 5.5;

    pdf.setFontSize(9.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(71, 85, 105);
    pdf.text('Berdasarkan Surat Edaran Mendikbudristek No. 14 Tahun 2019 (Format 1 Lembar / Merdeka Belajar)', 105, yPos, { align: 'center' });
    yPos += 4.5;

    // Dual divider line
    pdf.setDrawColor(30, 41, 59);
    pdf.setLineWidth(0.6);
    pdf.line(18, yPos, 192, yPos);
    pdf.setLineWidth(0.2);
    pdf.line(18, yPos + 1.2, 192, yPos + 1.2);
    yPos += 5.5;

    // 2. IDENTITAS PEMBELAJARAN
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(18, yPos, 174, 23, 1.5, 1.5, 'FD');

    pdf.setFontSize(8.5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 41, 59);

    // Left Column
    pdf.text('Satuan Pendidikan', 22, yPos + 5);
    pdf.setFont("helvetica", "normal");
    pdf.text(`: ${schoolSettings.namaSekolah || 'Sekolah'}`, 54, yPos + 5);

    pdf.setFont("helvetica", "bold");
    pdf.text('Mata Pelajaran', 22, yPos + 10.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(`: ${dataToExport.mataPelajaran || '-'}`, 54, yPos + 10.5);

    pdf.setFont("helvetica", "bold");
    pdf.text('Materi Pokok', 22, yPos + 16);
    pdf.setFont("helvetica", "normal");
    const cleanMateri = (dataToExport.materi || '-');
    const materiLines = pdf.splitTextToSize(`: ${cleanMateri}`, 64);
    pdf.text(materiLines[0], 54, yPos + 16);

    // Right Column
    pdf.setFont("helvetica", "bold");
    pdf.text('Kelas / Semester', 120, yPos + 5);
    pdf.setFont("helvetica", "normal");
    pdf.text(`: ${dataToExport.kelasSemester || '-'}`, 150, yPos + 5);

    pdf.setFont("helvetica", "bold");
    pdf.text('Alokasi Waktu', 120, yPos + 10.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(`: ${dataToExport.alokasiWaktu || '2 x 45 Menit (1 Pertemuan)'}`, 150, yPos + 10.5);

    pdf.setFont("helvetica", "bold");
    pdf.text('Tahun Ajaran', 120, yPos + 16);
    pdf.setFont("helvetica", "normal");
    pdf.text(`: ${new Date().getFullYear()} / ${new Date().getFullYear() + 1}`, 150, yPos + 16);

    yPos += 27;

    // Helper for Section Headers
    const printSectionHeader = (title: string) => {
      checkPageBreak(12);
      pdf.setFillColor(241, 245, 249);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(18, yPos - 3.8, 174, 6.8, 1, 1, 'FD');
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(title, 21, yPos + 1);
      yPos += 7;
    };

    // Helper for regular Multiline Sections
    const printRegularSection = (title: string, content: string) => {
      printSectionHeader(title);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);

      const paragraphs = (content || '-').split('\n');
      for (const p of paragraphs) {
        const trimmed = p.trim();
        if (!trimmed) {
          yPos += 1.5;
          continue;
        }
        const lines = pdf.splitTextToSize(trimmed, 170);
        for (const line of lines) {
          checkPageBreak(5);
          pdf.text(line, 20, yPos);
          yPos += 4.6;
        }
      }
      yPos += 4;
    };

    // 3. SECTIONS
    printRegularSection('A. TUJUAN PEMBELAJARAN', dataToExport.tujuanPembelajaran);
    printRegularSection('B. MATERI PEMBELAJARAN', dataToExport.materi);

    // Langkah Kegiatan
    printSectionHeader('C. LANGKAH-LANGKAH KEGIATAN PEMBELAJARAN');
    
    // 1. Pendahuluan
    checkPageBreak(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(30, 41, 59);
    pdf.text('1. Kegiatan Pendahuluan (Awal Pembelajaran)', 20, yPos);
    yPos += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(51, 65, 85);
    const pendahuluanLines = pdf.splitTextToSize(dataToExport.pendahuluan || '-', 166);
    for (const l of pendahuluanLines) {
      checkPageBreak(5);
      pdf.text(l, 24, yPos);
      yPos += 4.5;
    }
    yPos += 2.5;

    // 2. Inti
    checkPageBreak(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(30, 41, 59);
    pdf.text('2. Kegiatan Inti (Eksplorasi, Elaborasi & Konfirmasi)', 20, yPos);
    yPos += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(51, 65, 85);
    const intiLines = pdf.splitTextToSize(dataToExport.kegiatanInti || '-', 166);
    for (const l of intiLines) {
      checkPageBreak(5);
      pdf.text(l, 24, yPos);
      yPos += 4.5;
    }
    yPos += 2.5;

    // 3. Penutup
    checkPageBreak(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(30, 41, 59);
    pdf.text('3. Kegiatan Penutup (Refleksi, Evaluasi & Tindak Lanjut)', 20, yPos);
    yPos += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(51, 65, 85);
    const penutupLines = pdf.splitTextToSize(dataToExport.penutup || '-', 166);
    for (const l of penutupLines) {
      checkPageBreak(5);
      pdf.text(l, 24, yPos);
      yPos += 4.5;
    }
    yPos += 4;

    // 4. LATIHAN SOAL & ASESMEN (STANDAR PTS) - REFINED
    printSectionHeader('D. LATIHAN SOAL & ASESMEN (STANDAR ASESMEN PTS)');
    
    const parsedQuestions = parsePTSQuestions(dataToExport.latihanSoal);

    if (parsedQuestions.length > 0) {
      for (const q of parsedQuestions) {
        // Prevent awkward question breaking
        checkPageBreak(22);

        // Question Number & Text with proper hanging indent
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`${q.number}.`, 20, yPos);

        const qTextLines = pdf.splitTextToSize(q.question, 163);
        for (let i = 0; i < qTextLines.length; i++) {
          if (i > 0) checkPageBreak(5);
          pdf.text(qTextLines[i], 27, yPos);
          yPos += 4.6;
        }
        yPos += 1;

        // Options (A, B, C, D)
        if (q.options && q.options.length > 0) {
          pdf.setFontSize(8.5);
          for (const opt of q.options) {
            checkPageBreak(6);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(67, 56, 202);
            pdf.text(`${opt.label}.`, 28, yPos);

            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(51, 65, 85);
            const optLines = pdf.splitTextToSize(opt.text, 153);
            for (let j = 0; j < optLines.length; j++) {
              if (j > 0) checkPageBreak(4.5);
              pdf.text(optLines[j], 34, yPos);
              yPos += 4.4;
            }
            yPos += 0.8;
          }
        }

        // Answer Key & Pembahasan Box
        if (q.answerKey) {
          checkPageBreak(12);
          pdf.setFontSize(8);
          const keyLines = pdf.splitTextToSize(q.answerKey, 152);
          const keyBoxHeight = (keyLines.length * 4.2) + 6.5;

          pdf.setFillColor(248, 250, 252);
          pdf.setDrawColor(203, 213, 225);
          pdf.setLineWidth(0.2);
          pdf.roundedRect(26, yPos, 164, keyBoxHeight, 1.5, 1.5, 'FD');

          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(13, 148, 136); // teal
          pdf.text('Kunci Jawaban & Pembahasan:', 29, yPos + 4.2);

          pdf.setFont("helvetica", "italic");
          pdf.setTextColor(51, 65, 85);
          let currentKeyY = yPos + 8.4;
          for (const kl of keyLines) {
            pdf.text(kl, 29, currentKeyY);
            currentKeyY += 4.2;
          }
          yPos += keyBoxHeight + 3.5;
        }

        // Question Divider
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.2);
        pdf.line(20, yPos, 190, yPos);
        yPos += 3.5;
      }
      yPos += 2;
    } else {
      // Fallback for plain text
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      const lines = pdf.splitTextToSize(dataToExport.latihanSoal || '-', 170);
      for (const line of lines) {
        checkPageBreak(5);
        pdf.text(line, 20, yPos);
        yPos += 4.6;
      }
      yPos += 4;
    }

    // 5. PENILAIAN PEMBELAJARAN
    printRegularSection('E. PENILAIAN PEMBELAJARAN (ASESMEN)', dataToExport.penilaian);

    // 6. TANDA TANGAN (SIGNATURE BLOCK)
    checkPageBreak(40);
    yPos += 4;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30, 41, 59);

    // Left: Kepala Sekolah
    pdf.text('Mengetahui,', 45, yPos, { align: 'center' });
    pdf.text('Kepala Sekolah', 45, yPos + 5, { align: 'center' });

    pdf.setFont("helvetica", "bold");
    pdf.text(`${schoolSettings.namaKepalaSekolah || '________________________'}`, 45, yPos + 24, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(
      schoolSettings.nipKepalaSekolah ? `NIP. ${schoolSettings.nipKepalaSekolah}` : 'NIP. __________________',
      45,
      yPos + 29,
      { align: 'center' }
    );

    // Right: Guru Mata Pelajaran
    pdf.setFontSize(9);
    const formattedDate = format(new Date(), 'dd MMMM yyyy', { locale: id });
    pdf.text(`${schoolSettings.namaSekolah || 'Sekolah'}, ${formattedDate}`, 155, yPos, { align: 'center' });
    pdf.text('Guru Mata Pelajaran', 155, yPos + 5, { align: 'center' });

    pdf.setFont("helvetica", "bold");
    const teacherName = dataToExport.teacherName || (isAdmin ? '________________________' : (userData?.name || 'Guru Mata Pelajaran'));
    pdf.text(`${teacherName}`, 155, yPos + 24, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text('NIP. __________________', 155, yPos + 29, { align: 'center' });

    // 7. RUNNING HEADERS & FOOTERS (ALL PAGES)
    const totalPages = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(148, 163, 184);

      if (i > 1) {
        pdf.text(`E-RPP: ${cleanMapel} - ${cleanKelas}`, 18, 11);
        pdf.text(`${schoolSettings.namaSekolah || 'Sekolah'}`, 192, 11, { align: 'right' });
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.2);
        pdf.line(18, 13, 192, 13);
      }

      pdf.text(`Dokumen E-RPP Digital Kemendikbudristek • Dicetak pada ${format(new Date(), 'dd/MM/yyyy HH:mm')} WIB`, 18, 288);
      pdf.text(`Halaman ${i} dari ${totalPages}`, 192, 288, { align: 'right' });
    }

    // 8. CROSS-DEVICE EXPORT & MODAL PREVIEW
    try {
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      setPdfPreviewUrl(blobUrl);
      setPdfPreviewFilename(safeFilename);

      // Trigger standard download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
      }, 2000);

      showToast('PDF E-RPP berhasil disusun dan siap diunduh / dicetak!', 'success');
    } catch (e: any) {
      console.warn('Fallback to pdf.save:', e);
      pdf.save(safeFilename);
      showToast('Mengunduh dokumen PDF E-RPP...', 'success');
    }
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
                      <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => exportPDF(rpp)} 
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" 
                          title="Unduh PDF E-RPP"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenForm(rpp)} 
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                          title="Edit E-RPP"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteModalId(rpp.id)} 
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                          title="Hapus E-RPP"
                        >
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-bold text-slate-700">
                      Materi yang Disampaikan <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs text-slate-400 font-normal">Contoh topik dapat dipilih di bawah</span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Operasi Hitung Campuran pada Pecahan"
                    value={materi}
                    onChange={(e) => setMateri(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                  />
                  
                  {/* Quick Topics Helper Chips */}
                  <div className="mt-2.5">
                    <span className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
                      ⚡ Rekomendasi Topik Cepat (Ketuk untuk Mengisi):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TOPICS.map((topic, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setMataPelajaran(topic.mapel);
                            setMateri(topic.materi);
                            showToast(`Topik "${topic.mapel}" berhasil diterapkan!`, 'success');
                          }}
                          className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg text-slate-600 transition-colors font-medium text-left"
                        >
                          {topic.label}
                        </button>
                      ))}
                    </div>
                  </div>
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
                                <p className="text-slate-400 text-xs max-w-md mx-auto mb-5">
                                  Klik tombol <strong className="text-orange-600 font-extrabold">Isi Otomatis (AI)</strong> untuk membuat paket soal PTS rapi secara instan, atau ketik soal secara manual.
                                </p>
                                <div className="flex flex-wrap items-center justify-center gap-2.5">
                                  <button
                                    type="button"
                                    onClick={handleGenerateTemplate}
                                    disabled={isGenerating}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>{isGenerating ? 'Menyusun Draft...' : 'Buat Soal dengan AI'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuestionTab('raw')}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-sm transition-colors"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Ketik / Tempel Soal</span>
                                  </button>
                                </div>
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

      {/* PDF Preview & Action Modal */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-800 truncate">
                    Pratinjau Dokumen E-RPP
                  </h3>
                  <p className="text-xs text-slate-400 font-medium truncate">
                    {pdfPreviewFilename || 'RPP_Merdeka_Belajar.pdf'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(pdfPreviewUrl, '_blank')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors border border-indigo-200"
                  title="Buka di tab baru untuk mencetak langsung"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Tab Baru</span>
                </button>
                <a
                  href={pdfPreviewUrl}
                  download={pdfPreviewFilename}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                  title="Unduh file PDF"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </a>
                <button
                  onClick={() => setPdfPreviewUrl(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                  title="Tutup Pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/50">
              {/* Desktop Iframe */}
              <div className="hidden md:block w-full h-[65vh] bg-white rounded-2xl shadow-inner border border-slate-200 overflow-hidden">
                <iframe
                  src={pdfPreviewUrl}
                  title="Pratinjau PDF E-RPP"
                  className="w-full h-full border-none"
                />
              </div>

              {/* Mobile Card */}
              <div className="md:hidden bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-base">Dokumen PDF E-RPP Siap!</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    Dokumen telah diformat rapi dengan kop standar, penomoran soal PTS simetris, dan tanda tangan resmi.
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2.5">
                  <a
                    href={pdfPreviewUrl}
                    download={pdfPreviewFilename}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors"
                  >
                    <FileDown className="w-4 h-4" />
                    Simpan / Unduh ke Perangkat
                  </a>
                  <button
                    onClick={() => window.open(pdfPreviewUrl, '_blank')}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Buka di Tab Baru / Cetak
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Sesuai Standar Kemendikbudristek No. 14/2019</span>
              <button
                onClick={() => setPdfPreviewUrl(null)}
                className="text-slate-600 hover:text-slate-900 font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Hapus E-RPP Ini?</h3>
                <p className="text-xs text-slate-500 font-medium">Tindakan ini permanen dan tidak dapat dibatalkan.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              Dokumen RPP yang dihapus akan dihilangkan dari database sekolah dan tidak dapat dipulihkan kembali.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalId(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                Ya, Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
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
