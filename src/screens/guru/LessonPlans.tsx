import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Sparkles, Save, FileDown, BookOpen, Filter, Plus, Trash2, Edit2, ChevronLeft, 
  Calendar, FileText, X, ListOrdered, Edit3, CheckCircle2, HelpCircle, ExternalLink, 
  Printer, Eye, EyeOff, Copy, Check, AlertTriangle, Layers, Award, CheckSquare,
  FileUp, FileCheck, UploadCloud, RefreshCw, Info
} from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { 
  saveModuleToStorage, 
  updateModuleMetaInStorage, 
  getActiveModuleFromStorage, 
  deleteModuleFromStorage, 
  clearAllModulesFromStorage 
} from '../../lib/pdfModuleStorage';

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
  keyLetter?: string;
  explanation?: string;
}

export function cleanMarkdown(str: string): string {
  if (!str) return '';
  return str
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s*/gm, '')
    .trim();
}

/**
 * Merapikan penomoran pada isi materi agar nomor-nomor tidak berjejer dalam satu baris,
 * melainkan diberi enter/baris baru sehingga cepat dan mudah dibaca.
 */
export function formatIsiMateri(text: string): string {
  if (!text || !text.trim()) return '';
  let str = cleanMarkdown(text).trim();
  str = str.replace(/\r\n/g, '\n');

  // Berikan enter ganda sebelum nomor urut (1., 2., 1), 2), A., B., dll) jika didahului karakter biasa
  str = str.replace(/([^\n])\s*(?=(?:^|[^\w])(?:[0-9]{1,2}[\.\)]|[A-Da-d][\.\)])\s+[A-Z0-9\(\[\"\'\u00C0-\u017F])/g, '$1\n\n');

  // Berikan enter sebelum poin tanda hubung / peluru (- atau •)
  str = str.replace(/([^\n])\s*(?=(?:[\-\*•])\s+[A-Za-z0-9])/g, '$1\n   ');

  const rawLines = str.split('\n');
  const result: string[] = [];
  let prevWasEmpty = false;

  for (const raw of rawLines) {
    const trimmed = raw.trimEnd();
    if (!trimmed.trim()) {
      if (!prevWasEmpty && result.length > 0) {
        result.push('');
        prevWasEmpty = true;
      }
      continue;
    }
    prevWasEmpty = false;

    // Pastikan jika ada nomor seperti "1.", "2." ada jeda baris kosong sebelumnya
    const isNumbered = /^[0-9]{1,2}[\.\)]\s+/.test(trimmed.trim());
    if (isNumbered && result.length > 0 && result[result.length - 1] !== '') {
      result.push('');
    }
    result.push(trimmed);
  }

  return result.join('\n').trim();
}

/**
 * Menormalkan teks soal agar nomor soal, pilihan A-D, dan kunci jawaban dipisahkan baris baru secara rapi
 * sehingga jawaban tidak pernah bergabung pada baris soal.
 */
export function normalizePTSQuestionString(text: string): string {
  if (!text) return '';
  let str = cleanMarkdown(text).trim();
  str = str.replace(/\r\n/g, '\n');

  // 1. Enter ganda sebelum nomor soal jika sebelumnya teks biasa
  str = str.replace(/([^\n])\s*(?=(?:^|[^\w])(?:Soal\s*)?[0-9]{1,2}[\.\)]\s+[A-Z0-9\(\[\"\'\u00C0-\u017F])/g, '$1\n\n');

  // 2. Enter sebelum Kunci Jawaban / Jawaban / Pembahasan agar tidak gabung di baris soal atau opsi
  str = str.replace(/([^\n])\s*(?=(?:Kunci\s*(?:Jawaban)?(?:\s*(?:dan|&)\s*Pembahasan)?|Jawaban\s*(?:Benar)?|Rubrik\s*(?:Penilaian)?|Pembahasan)\s*[:\-])/gi, '$1\n   ');

  // 3. Enter sebelum pilihan A, B, C, D jika berada dalam satu baris
  str = str.replace(/([^\n])\s*(?=(?:^|\s)[\(\[]?[A-Ea-e][\.\)\]\:]\s+[^\n])/g, '$1\n   ');

  return str;
}

export function parsePTSQuestions(text: string): FormattedPTSQuestion[] {
  if (!text || !text.trim()) return [];

  const normalized = normalizePTSQuestionString(text);
  const rawLines = normalized.split('\n');
  const questions: FormattedPTSQuestion[] = [];
  let currentQ: { number: number; lines: string[] } | null = null;

  for (const rawLine of rawLines) {
    const cleaned = cleanMarkdown(rawLine).trim();
    if (!cleaned) continue;

    // Ignore redundant section headers or exam instructions
    if (
      /^(?:(?:Bagian\s+[A-Za-z0-9]|Bab\s+\d+|Latihan\s+Soal|Pilihan\s+Ganda|Soal\s+Uraian|Petunjuk\s+(?:Pengerjaan|Khusus|Umum)|Lembar\s+Soal)\s*[:\-]?)$/i.test(cleaned) ||
      /^(?:(?:Petunjuk|Pilihlah|Jawablah)\s+.*)$/i.test(cleaned) && !currentQ
    ) {
      continue;
    }

    // Check if line indicates an option (e.g. A. or A) or (A))
    const isOptionStart = /^[\(\[]?([A-Ea-e])[\.\)\]\:]\s+/.test(cleaned);

    // Check if line starts a new question number (e.g. 1., 1), No. 1, Soal 1:)
    const numMatch = cleaned.match(/^(?:(?:Soal|No|Nomor)\s*[\.:\-]?\s*)?(\d+)[\.\)\:\-]\s*(.*)/i);

    if (numMatch && !isOptionStart) {
      if (currentQ) {
        questions.push(buildPTSQuestion(currentQ.number, currentQ.lines));
      }
      currentQ = {
        number: parseInt(numMatch[1], 10),
        lines: numMatch[2].trim() ? [numMatch[2].trim()] : []
      };
    } else if (!currentQ && !isOptionStart) {
      // First question might not have explicit "1." prefix
      currentQ = { number: 1, lines: [cleaned] };
    } else if (currentQ) {
      // Check if line contains multiple inline options (e.g. 'A. x   B. y   C. z   D. w')
      const inlineMatches = cleaned.match(/[\(\[]?[A-Ea-e][\.\)\]\:]\s+/g);
      if (inlineMatches && inlineMatches.length > 1) {
        const parts = cleaned.split(/(?=[\(\[]?[A-Ea-e][\.\)\]\:]\s+)/);
        for (const p of parts) {
          if (p.trim()) currentQ.lines.push(p.trim());
        }
      } else {
        currentQ.lines.push(cleaned);
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

  for (const rawLine of lines) {
    let line = cleanMarkdown(rawLine).trim();
    if (!line) continue;

    // Pastikan jika ada kunci jawaban yang sempat tergabung dalam satu baris dengan soal, langsung dipisahkan
    const inlineKeyMatch = line.match(/^(.*?)(?:\s+(?:Kunci\s*(?:Jawaban)?(?:\s*(?:dan|&)\s*Pembahasan)?|Jawaban\s*(?:Benar)?|Rubrik\s*(?:Penilaian)?|Pembahasan)\s*[:\-]\s*(.*))$/i);
    if (inlineKeyMatch && !answerKey) {
      line = inlineKeyMatch[1].trim();
      answerKey = inlineKeyMatch[2].trim() || 'Terlampir';
    }

    const optMatch = line.match(/^[\(\[]?([A-Ea-e])[\.\)\]\:]\s*(.*)/);
    const keyMatch = line.match(/^(?:\*?\s*(?:Kunci\s*(?:Jawaban)?(?:\s*(?:dan|&)\s*Pembahasan)?|Jawaban\s*(?:Benar)?|Rubrik\s*(?:Penilaian)?|Pembahasan|Kunci))\s*[:\-]\s*(.*)/i);

    if (keyMatch) {
      answerKey = keyMatch[1] || line;
      inOptions = false;
    } else if (optMatch) {
      const cleanOpt = cleanMarkdown(optMatch[2]).replace(/^\[\s*|\s*\]$/g, '').trim();
      options.push({ label: optMatch[1].toUpperCase(), text: cleanOpt });
      inOptions = true;
    } else if (inOptions && options.length > 0) {
      // Continuation of previous option
      options[options.length - 1].text += ' ' + line;
    } else if (!answerKey) {
      questionParts.push(line);
    } else {
      answerKey += ' ' + line;
    }
  }

  const rawKey = answerKey.trim();
  let keyLetter = '';
  let explanation = '';

  if (rawKey) {
    // Matches option letter e.g. A, B, C, D, E with optional parentheses or bracket
    const letterMatch = rawKey.match(/^[\(\[]?([A-Ea-e])[\)\]]?\b(?:\s*[\.\:\-\(]\s*(.*)|[\s]+(.*))?/);
    if (letterMatch) {
      keyLetter = letterMatch[1].toUpperCase();
      let rest = (letterMatch[2] || letterMatch[3] || '').trim();
      if (rest.endsWith(')')) rest = rest.slice(0, -1).trim();
      rest = rest.replace(/^(?:Pembahasan|Penjelasan|Keterangan)\s*[:\-]\s*/i, '').trim();
      explanation = rest;
    } else {
      explanation = rawKey.replace(/^(?:Pembahasan|Penjelasan|Keterangan)\s*[:\-]\s*/i, '').trim();
    }
  }

  // Standardize the display key format
  let standardizedKey = rawKey;
  if (keyLetter) {
    standardizedKey = explanation ? `${keyLetter} (Pembahasan: ${explanation})` : keyLetter;
  }

  // Preserve multi-line question stimuli cleanly
  const questionStem = questionParts.join('\n').trim() || lines[0] || '';

  return {
    number: num,
    question: cleanMarkdown(questionStem),
    options,
    answerKey: standardizedKey,
    keyLetter,
    explanation
  };
}

export function formatAsPTS(text: string): string {
  const normalized = normalizePTSQuestionString(text);
  const parsed = parsePTSQuestions(normalized);
  if (parsed.length === 0) return cleanMarkdown(text);

  return parsed.map((q, idx) => {
    const stemLines = q.question.split('\n').map(l => l.trim()).filter(Boolean);
    let out = `${idx + 1}. ${stemLines[0] || ''}`;
    for (let i = 1; i < stemLines.length; i++) {
      out += `\n   ${stemLines[i]}`;
    }
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

export function generateClientSideRPP(
  mataPelajaran: string,
  materi: string,
  questionType: 'Pilihan Ganda' | 'Uraian',
  questionCount: number
) {
  const safeCount = Math.min(Math.max(questionCount, 1), 20);

  const generateQuestions = () => {
    const items: string[] = [];
    if (questionType === "Uraian") {
      const prompts = [
        `Jelaskan pengertian dan konsep fundamental dari ${materi} dalam mata pelajaran ${mataPelajaran}!`,
        `Sebutkan dan jelaskan 3 contoh penerapan kontekstual dari ${materi} dalam kehidupan sehari-hari!`,
        `Bagaimanakah langkah-langkah atau prosedur sistematis saat menyelesaikan masalah terkait ${materi}?`,
        `Analisis faktor-faktor esensial yang mempengaruhi keberhasilan pelaksanaan topik ${materi}!`,
        `Mengapa pemahaman mendalam tentang ${materi} sangat penting bagi peserta didik? Berikan analisis kritis Anda!`,
        `Bandingkan kelebihan dan kekurangan dari metode yang digunakan dalam ${materi}!`,
        `Rancanglah sebuah gagasan inovatif atau solusi praktis untuk memecahkan persoalan nyata seputar ${materi}!`,
        `Jelaskan keterkaitan langsung antara materi ${materi} dengan materi pembelajaran sebelumnya!`
      ];

      for (let i = 1; i <= safeCount; i++) {
        const prompt = prompts[(i - 1) % prompts.length];
        items.push(
          `${i}. ${prompt}\n   Kunci Jawaban: Pemahaman konsep yang tepat, argumen logis terstruktur, serta ketepatan contoh kontekstual yang relevan (Skor maksimal: 100).`
        );
      }
    } else {
      const templates = [
        {
          q: `Tujuan pokok dari pembelajaran materi ${materi} pada mata pelajaran ${mataPelajaran} adalah...`,
          options: [
            `Memahami prinsip dasar dan penerapannya secara kontekstual`,
            `Menghafalkan seluruh istilah teknis tanpa pemahaman konsep`,
            `Mengabaikan prosedur ilmiah yang telah ditetapkan`,
            `Membatasi wawasan dan tidak melakukan eksplorasi mandiri`
          ],
          key: "A",
          expl: `Pembelajaran ${materi} berorientasi pada pemahaman konsep dan penerapannya secara nyata.`
        },
        {
          q: `Berikut ini yang merupakan karakteristik esensial dari konsep ${materi} adalah...`,
          options: [
            `Bersifat statis dan tidak dapat dikembangkan`,
            `Tersusun secara sistematis, teruji, dan aplikatif`,
            `Hanya berlaku dalam kondisi teoritis tanpa bukti praktis`,
            `Tidak memiliki keterkaitan dengan materi lainnya`
          ],
          key: "B",
          expl: `Karakteristik materi ${materi} menekankan struktur sistematis dan kemampuan terapan.`
        },
        {
          q: `Langkah awal yang paling tepat saat mengkaji topik ${materi} adalah...`,
          options: [
            `Langsung menarik simpulan tanpa mengumpulkan data`,
            `Mengidentifikasi masalah dan merumuskan pertanyaan kunci`,
            `Menerima informasi tanpa melakukan pengujian kritis`,
            `Menghindari diskusi kelompok dan kolaborasi`
          ],
          key: "B",
          expl: `Identifikasi masalah dan perumusan pertanyaan kunci merupakan pijakan metode saintifik.`
        },
        {
          q: `Salah satu bentuk penerapan nyata materi ${materi} dalam pemecahan masalah adalah...`,
          options: [
            `Menganalisis data temuan untuk menghasilkan keputusan yang akurat`,
            `Membiarkan kesalahan tanpa evaluasi tindak lanjut`,
            `Mengganti standar prosedur dengan spekulasi bebas`,
            `Menolak masukan dan saran konstruktif dari lingkungan`
          ],
          key: "A",
          expl: `Analisis data temuan yang cermat menghasilkan solusi akurat dan terukur.`
        },
        {
          q: `Manfaat jangka panjang yang diperoleh peserta didik setelah menguasai ${materi} yaitu...`,
          options: [
            `Kemampuan bernalar kritis dan pemecahan masalah terarah`,
            `Ketergantungan tinggi terhadap instruksi verbal semata`,
            `Menurunnya minat eksplorasi di bidang ${mataPelajaran}`,
            `Kesulitan dalam mengaplikasikan teori ke bentuk karya`
          ],
          key: "A",
          expl: `Penguasaan ${materi} membentuk profil pelajar yang mandiri dan bernalar kritis.`
        }
      ];

      for (let i = 1; i <= safeCount; i++) {
        const t = templates[(i - 1) % templates.length];
        const questionText = i > 5 ? `${i}. Terkait materi ${materi} (Butir ${i}): Pernyataan berikut yang paling tepat adalah...` : `${i}. ${t.q}`;
        items.push(
          `${questionText}\n   A. ${t.options[0]}\n   B. ${t.options[1]}\n   C. ${t.options[2]}\n   D. ${t.options[3]}\n   Kunci Jawaban: ${t.key} (Pembahasan: ${t.expl})`
        );
      }
    }
    return items.join("\n\n");
  };

  return {
    tujuanPembelajaran: `Melalui model pembelajaran Discovery/Inquiry Learning berorientasi Profil Pelajar Pancasila pada materi ${materi}, peserta didik diharapkan mampu:\n1. Mengidentifikasi konsep esensial dan prinsip dasar ${materi} secara cermat dan kritis.\n2. Menganalisis contoh kasus dan penerapan nyata terkait ${materi} dalam kehidupan sehari-hari.\n3. Menyajikan hasil penelaahan serta berkolaborasi aktif dengan sikap santun, mandiri, dan bertanggung jawab.`,
    isiMateriPenjelas: `1. Konsep Pokok & Pengertian:\n   ${materi} merupakan salah satu materi pokok esensial dalam mata pelajaran ${mataPelajaran} yang membekali peserta didik dengan pemahaman konsep, struktur berpikir logis, dan keterampilan aplikatif.\n\n2. Uraian & Poin-Poin Pokok Bahasan:\n   - Mempelajari prinsip dasar, karakteristik, serta struktur penting yang mendasari ${materi}.\n   - Mengembangkan kemampuan bernalar kritis dan analitis dalam memecahkan persoalan seputar ${materi}.\n   - Menghubungkan pemahaman teoritis dengan fakta kontekstual di lingkungan sekitar peserta didik.\n\n3. Penerapan & Contoh Kontekstual:\n   - Penyelesaian studi kasus nyata baik secara mandiri maupun berkolaborasi dalam kelompok.\n   - Penggunaan analogi konkret dan bahan ajar pendukung untuk memperkuat pemahaman.`,
    pendahuluan: `1. Orientasi: Guru membuka kelas dengan salam ramah, memimpin doa bersama, dan memeriksa presensi siswa.\n2. Apersepsi: Guru mengaitkan materi sebelumnya dengan topik '${materi}' melalui pertanyaan pemantik kontekstual.\n3. Motivasi: Guru memaparkan tujuan pembelajaran, manfaat mempelajari '${materi}', serta mekanisme kegiatan dan penilaian hari ini.`,
    kegiatanInti: `1. Stimulasi (Pemberian Rangsangan):\n   - Guru menyajikan bahan tayang/ilustrasi kontekstual seputar materi '${materi}'.\n   - Peserta didik mengamati dan mencatat hal-hal penting secara seksama.\n\n2. Identifikasi Masalah (Problem Statement):\n   - Peserta didik dirangsang untuk menyusun pertanyaan kritis seputar penerapan '${materi}'.\n   - Guru mengelompokkan siswa ke dalam tim belajar heterogen.\n\n3. Pengumpulan Data (Data Collection):\n   - Setiap kelompok mengumpulkan data dan referensi relevan mengenai '${materi}' dari buku ajar dan lembar kerja.\n   - Guru berkeliling memfasilitasi dan memberi bimbingan diferensiasi.\n\n4. Pengolahan Data (Data Processing):\n   - Siswa berdiskusi mengolah data temuan untuk merumuskan simpulan kelompok mengenai '${materi}'.\n   - Menyusun draf laporan hasil eksplorasi pada lembar kerja siswa.\n\n5. Pembuktian & Verifikasi (Verification):\n   - Perwakilan kelompok mempresentasikan hasil diskusi di hadapan kelas.\n   - Kelompok lain menanggapi secara konstruktif dan beretika.\n   - Guru memberikan penguatan materi, klarifikasi, dan apresiasi terhadap partisipasi aktif siswa.`,
    penutup: `1. Simpulan: Bersama guru, peserta didik merangkum poin-poin utama materi '${materi}'.\n2. Refleksi: Peserta didik menyampaikan hal yang telah dipahami dan bagian yang masih membutuhkan pendalaman.\n3. Tindak Lanjut: Guru memberikan tugas mandiri/pengayaan serta menyampaikan agenda pertemuan berikutnya.\n4. Doa & Salam: Pembelajaran diakhiri dengan doa penutup dan salam kehangatan.`,
    latihanSoal: generateQuestions(),
    penilaian: `1. Penilaian Sikap: Observasi jurnal sikap Profil Pelajar Pancasila (beriman, gotong royong, bernalar kritis, mandiri).\n2. Penilaian Pengetahuan: Tes tertulis format PTS (${safeCount} butir soal ${questionType}) dengan rubrik penskoran terukur.\n3. Penilaian Keterampilan: Lembar observasi kinerja diskusi kelompok dan presentasi hasil penugasan.`
  };
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
  const [satuanPendidikan, setSatuanPendidikan] = useState('');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [kelasSemester, setKelasSemester] = useState(`${selectedClass} / Ganjil`);
  const [alokasiWaktu, setAlokasiWaktu] = useState('');
  const [materi, setMateri] = useState('');
  const [isiMateriPenjelas, setIsiMateriPenjelas] = useState('');
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
  const [questionTab, setQuestionTab] = useState<'paper' | 'cards' | 'raw'>('paper');
  const [showAnswerKeys, setShowAnswerKeys] = useState(true);
  const [copiedSoal, setCopiedSoal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Reference Module PDF State (Impor PDF Modul Ajar & Penyimpanan Acuan)
  const [modulePdfFile, setModulePdfFile] = useState<File | null>(null);
  const [modulePdfName, setModulePdfName] = useState<string>('');
  const [modulePdfSize, setModulePdfSize] = useState<string>('');
  const [storedModuleId, setStoredModuleId] = useState<string | null>(null);
  const [isExtractingModule, setIsExtractingModule] = useState<boolean>(false);
  const [moduleSummary, setModuleSummary] = useState<string | null>(null);
  const [isDraggingPdf, setIsDraggingPdf] = useState<boolean>(false);
  const pdfInputRef = React.useRef<HTMLInputElement | null>(null);

  // Cross-device PDF & modal states
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState<string>('');
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleteModuleConfirmOpen, setDeleteModuleConfirmOpen] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Restore stored active reference module on initial mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const stored = await getActiveModuleFromStorage();
        if (isMounted && stored) {
          setStoredModuleId(stored.id);
          setModulePdfFile(stored.file);
          setModulePdfName(stored.name);
          setModulePdfSize(stored.size);
          if (stored.summary) setModuleSummary(stored.summary);
        }
      } catch (err) {
        console.warn('Could not restore stored module from IndexedDB:', err);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const handlePdfFileSelect = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Hanya file PDF (Modul Ajar / Bahan Ajar) yang didukung.', 'error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast('Ukuran file PDF maksimal 20 MB.', 'error');
      return;
    }

    setModulePdfFile(file);
    setModulePdfName(file.name);
    setModulePdfSize(formatFileSize(file.size));
    setModuleSummary(null);

    try {
      const stored = await saveModuleToStorage(file);
      setStoredModuleId(stored.id);
      showToast(`Dokumen Modul Ajar "${file.name}" tersimpan sebagai acuan materi!`, 'success');
      // Auto-analyze to detect subject, topic, and summary
      handleAnalyzeModule(file, stored.id);
    } catch (err) {
      console.warn('Storage save error:', err);
      showToast(`Dokumen Modul Ajar "${file.name}" siap dijadikan rujukan!`, 'success');
      handleAnalyzeModule(file);
    }
  };

  const handleAnalyzeModule = async (fileToAnalyze?: File, activeId?: string) => {
    const targetFile = fileToAnalyze || modulePdfFile;
    if (!targetFile) return;

    setIsExtractingModule(true);
    try {
      const formData = new FormData();
      formData.append('file', targetFile);

      const res = await fetch('/api/extract-module-info', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const info = await res.json();
        if (info.mataPelajaran && (!mataPelajaran.trim() || mataPelajaran === 'Mata Pelajaran')) {
          setMataPelajaran(info.mataPelajaran);
        }
        if (info.materi && (!materi.trim() || materi === 'Materi Pokok')) {
          setMateri(info.materi);
        }
        if (info.isiMateriPenjelas && !isiMateriPenjelas.trim()) {
          setIsiMateriPenjelas(info.isiMateriPenjelas);
        }
        if (info.kelasSemester && (!kelasSemester.trim() || kelasSemester === `${selectedClass} / Ganjil`)) {
          setKelasSemester(info.kelasSemester);
        }
        if (info.alokasiWaktu && info.alokasiWaktu !== 'null' && !alokasiWaktu.trim()) {
          setAlokasiWaktu(info.alokasiWaktu);
        }
        if (info.ringkasan) {
          setModuleSummary(info.ringkasan);
        }
        if (info.tujuanPembelajaran && info.tujuanPembelajaran !== 'null' && !tujuanPembelajaran.trim()) {
          setTujuanPembelajaran(info.tujuanPembelajaran);
        }

        const idToUpdate = activeId || storedModuleId;
        if (idToUpdate) {
          updateModuleMetaInStorage(idToUpdate, {
            summary: info.ringkasan,
            mataPelajaran: info.mataPelajaran,
            materi: info.materi,
            kelasSemester: info.kelasSemester
          });
        }

        showToast('✨ Struktur dan materi pokok modul ajar berhasil diidentifikasi!', 'success');
      }
    } catch (err) {
      console.warn('Analysis error:', err);
    } finally {
      setIsExtractingModule(false);
    }
  };

  const handleDeleteStoredModule = async () => {
    try {
      if (storedModuleId) {
        await deleteModuleFromStorage(storedModuleId);
      } else {
        await clearAllModulesFromStorage();
      }
    } catch (err) {
      console.warn('Delete error:', err);
    }
    setStoredModuleId(null);
    setModulePdfFile(null);
    setModulePdfName('');
    setModulePdfSize('');
    setModuleSummary(null);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
    setDeleteModuleConfirmOpen(false);
    showToast('Acuan modul ajar PDF berhasil dihapus dari penyimpanan.', 'success');
  };

  const handleClearModulePdf = () => {
    setModulePdfFile(null);
    setModulePdfName('');
    setModulePdfSize('');
    setModuleSummary(null);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
    showToast('File referensi modul ajar telah dilepas dari form aktif.', 'success');
  };

  const handleFormatPTS = () => {
    if (!latihanSoal.trim()) return;
    const formatted = formatAsPTS(latihanSoal);
    setLatihanSoal(formatted);
    showToast('Naskah soal berhasil dirapikan sesuai format resmi PTS/Ujian!', 'success');
  };

  const handleFormatIsiMateri = () => {
    if (!isiMateriPenjelas.trim()) return;
    const formatted = formatIsiMateri(isiMateriPenjelas);
    setIsiMateriPenjelas(formatted);
    showToast('Format nomor materi berhasil dirapikan dengan enter!', 'success');
  };

  const handleCopyQuestions = () => {
    if (!latihanSoal.trim()) {
      showToast('Belum ada teks soal untuk disalin.', 'error');
      return;
    }
    const formatted = formatAsPTS(latihanSoal);
    navigator.clipboard.writeText(formatted);
    setCopiedSoal(true);
    showToast('Naskah soal latihan berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedSoal(false), 2500);
  };

  const defaultSchoolName = (userData?.schoolName || userData?.sekolah || 'SD / SMP / SMA Negeri').trim();

  const [schoolSettings, setSchoolSettings] = useState({
    namaSekolah: defaultSchoolName,
    namaKepalaSekolah: '',
    nipKepalaSekolah: ''
  });

  // Load Settings from both 'pengaturan_sekolah/utama' and 'settings/school'
  useEffect(() => {
    const unsub1 = onSnapshot(doc(db, 'pengaturan_sekolah', 'utama'), (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        const detectedName = (d.namaSekolah || d.schoolName || '').trim();
        if (detectedName && !detectedName.toUpperCase().includes('CERDAS')) {
          setSchoolSettings(prev => ({
            ...prev,
            namaSekolah: detectedName,
            namaKepalaSekolah: d.namaKepalaSekolah || d.kepalaSekolah || prev.namaKepalaSekolah,
            nipKepalaSekolah: d.nipKepalaSekolah || prev.nipKepalaSekolah
          }));
          setSatuanPendidikan(prev => prev.trim() ? prev : detectedName);
        }
      }
    });

    const unsub2 = onSnapshot(doc(db, 'settings', 'school'), (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        const detectedName = (d.schoolName || d.namaSekolah || '').trim();
        if (detectedName && !detectedName.toUpperCase().includes('CERDAS')) {
          setSchoolSettings(prev => ({
            ...prev,
            namaSekolah: detectedName,
            namaKepalaSekolah: d.kepalaSekolah || d.namaKepalaSekolah || prev.namaKepalaSekolah,
            nipKepalaSekolah: d.nipKepalaSekolah || prev.nipKepalaSekolah
          }));
          setSatuanPendidikan(prev => prev.trim() ? prev : detectedName);
        }
      }
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [userData]);

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

  const resetForm = async () => {
    setEditingId(null);
    setSatuanPendidikan(
      (schoolSettings.namaSekolah && !schoolSettings.namaSekolah.toUpperCase().includes('CERDAS') ? schoolSettings.namaSekolah : '') ||
      userData?.schoolName ||
      userData?.sekolah ||
      'SD / SMP / SMA Negeri'
    );
    setMataPelajaran('');
    setKelasSemester(`${selectedClass} / Ganjil`);
    setAlokasiWaktu('');
    setMateri('');
    setIsiMateriPenjelas('');
    setTujuanPembelajaran('');
    setPendahuluan('');
    setKegiatanInti('');
    setPenutup('');
    setLatihanSoal('');
    setPenilaian('');

    // If there is an active reference module saved in IndexedDB, preserve it for the next lesson plan
    try {
      const stored = await getActiveModuleFromStorage();
      if (stored) {
        setStoredModuleId(stored.id);
        setModulePdfFile(stored.file);
        setModulePdfName(stored.name);
        setModulePdfSize(stored.size);
        if (stored.summary) setModuleSummary(stored.summary);
        return;
      }
    } catch (e) {
      console.warn('Error reading stored module:', e);
    }

    setModulePdfFile(null);
    setModulePdfName('');
    setModulePdfSize('');
    setModuleSummary(null);
    setStoredModuleId(null);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  const handleOpenForm = async (rpp?: any, triggerPdfUpload: boolean = false) => {
    if (rpp) {
      setEditingId(rpp.id);
      setSelectedClass(rpp.kelasSemester ? rpp.kelasSemester.split(' / ')[0] : selectedClass);
      setSatuanPendidikan(
        rpp.satuanPendidikan ||
        (schoolSettings.namaSekolah && !schoolSettings.namaSekolah.toUpperCase().includes('CERDAS') ? schoolSettings.namaSekolah : '') ||
        userData?.schoolName ||
        userData?.sekolah ||
        'SD / SMP / SMA Negeri'
      );
      setMataPelajaran(rpp.mataPelajaran || '');
      setKelasSemester(rpp.kelasSemester || `${selectedClass} / Ganjil`);
      setAlokasiWaktu(rpp.alokasiWaktu || '');
      setMateri(rpp.materi || '');
      setIsiMateriPenjelas(rpp.isiMateriPenjelas ? formatIsiMateri(rpp.isiMateriPenjelas) : '');
      setTujuanPembelajaran(rpp.tujuanPembelajaran || '');
      setPendahuluan(rpp.pendahuluan || '');
      setKegiatanInti(rpp.kegiatanInti || '');
      setPenutup(rpp.penutup || '');
      setLatihanSoal(rpp.latihanSoal ? formatAsPTS(rpp.latihanSoal) : '');
      setPenilaian(rpp.penilaian || '');
    } else {
      await resetForm();
    }
    setView('form');
    if (triggerPdfUpload) {
      setTimeout(() => {
        pdfInputRef.current?.click();
      }, 150);
    }
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

    if (!modulePdfFile && (!cleanMapel || !cleanMateri)) {
      showToast("Silakan isi Mata Pelajaran dan Materi terlebih dahulu, atau unggah file PDF modul ajar di atas.", "error");
      return;
    }
    
    setIsGenerating(true);
    const controller = new AbortController();
    // 30 seconds client timeout ensures enough time for PDF processing and multi-model fallback
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let data: any = null;

    try {
      let response: Response;
      if (modulePdfFile) {
        const formData = new FormData();
        formData.append('file', modulePdfFile);
        formData.append('mataPelajaran', cleanMapel);
        formData.append('materi', cleanMateri);
        formData.append('questionType', questionType);
        formData.append('questionCount', questionCount.toString());

        response = await fetch('/api/generate-rpp', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
      } else {
        response = await fetch('/api/generate-rpp', {
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
      }
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const textResponse = await response.text();
        try {
          data = JSON.parse(textResponse);
        } catch {
          data = null;
        }
      }
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.warn("API generate-rpp encountered network/timeout condition, activating curriculum engine fallback:", fetchErr?.message || fetchErr);
    }

    // Seamless Fallback: if server was unreachable, 504 gateway timeout, or AI busy
    if (!data || !data.tujuanPembelajaran) {
      data = generateClientSideRPP(cleanMapel || "Mata Pelajaran", cleanMateri || "Materi Pokok", questionType, questionCount);
    }

    try {
      if (data.mataPelajaran && (!cleanMapel || cleanMapel === 'Mata Pelajaran')) {
        setMataPelajaran(data.mataPelajaran);
      }
      if (data.materi && (!cleanMateri || cleanMateri === 'Materi Pokok')) {
        setMateri(data.materi);
      }
      setKelasSemester(`${selectedClass} / Ganjil`);
      if (!alokasiWaktu.trim()) {
        setAlokasiWaktu("2 x 45 Menit (1 Pertemuan)");
      }
      if (data.tujuanPembelajaran) setTujuanPembelajaran(data.tujuanPembelajaran);
      if (data.isiMateriPenjelas) setIsiMateriPenjelas(formatIsiMateri(data.isiMateriPenjelas));
      if (data.pendahuluan) setPendahuluan(data.pendahuluan);
      if (data.kegiatanInti) setKegiatanInti(data.kegiatanInti);
      if (data.penutup) setPenutup(data.penutup);
      if (data.latihanSoal) setLatihanSoal(formatAsPTS(data.latihanSoal));
      if (data.penilaian) setPenilaian(data.penilaian);

      if (modulePdfFile) {
        showToast("✨ Draf E-RPP & bank soal berhasil disusun selaras dengan Modul Ajar PDF!", "success");
      } else {
        showToast("✨ Draf E-RPP & bank soal PTS berhasil disusun otomatis!", "success");
      }
    } catch (renderErr) {
      console.error(renderErr);
      showToast("Gagal memproses draf RPP.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!mataPelajaran.trim() || !materi.trim()) {
      showToast("Mata Pelajaran dan Judul Materi harus diisi.", "error");
      return;
    }
    setSaving(true);
    try {
      const cleanSchool = (
        satuanPendidikan.trim() ||
        (schoolSettings.namaSekolah && !schoolSettings.namaSekolah.toUpperCase().includes('CERDAS') ? schoolSettings.namaSekolah : '') ||
        userData?.schoolName ||
        userData?.sekolah ||
        'SD / SMP / SMA Negeri'
      ).trim();

      const payload = {
        teacherId: userData?.uid,
        teacherName: userData?.name || 'Guru',
        satuanPendidikan: cleanSchool,
        mataPelajaran: mataPelajaran.trim(),
        kelasSemester,
        alokasiWaktu: alokasiWaktu || "2 x 45 Menit (1 Pertemuan)",
        materi: materi.trim(),
        isiMateriPenjelas: formatIsiMateri(isiMateriPenjelas),
        tujuanPembelajaran,
        pendahuluan,
        kegiatanInti,
        penutup,
        latihanSoal: formatAsPTS(latihanSoal),
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
      satuanPendidikan,
      mataPelajaran,
      kelasSemester,
      alokasiWaktu,
      materi,
      isiMateriPenjelas,
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

    const resolvedSchoolName = (
      dataToExport.satuanPendidikan ||
      (schoolSettings.namaSekolah && !schoolSettings.namaSekolah.toUpperCase().includes('CERDAS') ? schoolSettings.namaSekolah : '') ||
      userData?.schoolName ||
      userData?.sekolah ||
      'SD / SMP / SMA Negeri'
    ).trim();

    // Left Column
    pdf.text('Satuan Pendidikan', 22, yPos + 5);
    pdf.setFont("helvetica", "normal");
    pdf.text(`: ${resolvedSchoolName}`, 54, yPos + 5);

    pdf.setFont("helvetica", "bold");
    pdf.text('Mata Pelajaran', 22, yPos + 10.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(`: ${dataToExport.mataPelajaran || '-'}`, 54, yPos + 10.5);

    pdf.setFont("helvetica", "bold");
    pdf.text('Judul Materi', 22, yPos + 16);
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

    // B. MATERI PEMBELAJARAN (Judul Materi & Isi Materi Penjelas)
    printSectionHeader('B. MATERI PEMBELAJARAN');
    checkPageBreak(8);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(30, 41, 59);
    pdf.text('1. Judul Materi:', 20, yPos);
    yPos += 4.5;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(51, 65, 85);
    const materiLinesSection = pdf.splitTextToSize(dataToExport.materi || '-', 166);
    for (const line of materiLinesSection) {
      checkPageBreak(5);
      pdf.text(line, 24, yPos);
      yPos += 4.5;
    }
    yPos += 2;

    if (dataToExport.isiMateriPenjelas && dataToExport.isiMateriPenjelas.trim()) {
      checkPageBreak(8);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text('2. Isi Materi Penjelas (Uraian Konsep Pokok):', 20, yPos);
      yPos += 5.0;

      const formattedMateri = formatIsiMateri(dataToExport.isiMateriPenjelas);
      const paragraphs = formattedMateri.split('\n');
      for (const p of paragraphs) {
        const trimmed = p.trim();
        if (!trimmed) {
          yPos += 2.0;
          continue;
        }

        const isNumbered = /^[0-9]{1,2}[\.\)]\s+/.test(trimmed);
        if (isNumbered) {
          yPos += 1.2;
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(15, 23, 42);
        } else {
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(51, 65, 85);
        }

        const explLines = pdf.splitTextToSize(trimmed, 166);
        for (const line of explLines) {
          checkPageBreak(5);
          pdf.text(line, 24, yPos);
          yPos += 4.5;
        }
      }
      yPos += 2.5;
    }
    yPos += 3;

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

    // 4. LATIHAN SOAL & ASESMEN (STANDAR ASESMEN PTS) - REFINED
    printSectionHeader('D. LATIHAN SOAL & ASESMEN (STANDAR ASESMEN PTS)');
    
    // Subtitle / Petunjuk Soal
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text("Petunjuk: Pilihlah salah satu jawaban yang paling tepat (A, B, C, atau D) atau jawablah uraian dengan singkat, tepat, dan terstruktur.", 20, yPos);
    yPos += 4.8;

    const parsedQuestions = parsePTSQuestions(dataToExport.latihanSoal);

    if (parsedQuestions.length > 0) {
      for (const q of parsedQuestions) {
        const cleanQText = cleanMarkdown(q.question);
        const qStemParagraphs = cleanQText.split('\n').map(p => p.trim()).filter(Boolean);
        let qStemLinesCount = 0;
        for (const p of qStemParagraphs) {
          qStemLinesCount += pdf.splitTextToSize(p, 163).length;
        }
        const qStemHeight = Math.max(qStemLinesCount * 4.6, 6);

        let optionsHeight = 0;
        if (q.options && q.options.length > 0) {
          for (const opt of q.options) {
            const optLines = pdf.splitTextToSize(cleanMarkdown(opt.text), 153);
            optionsHeight += (optLines.length * 4.4) + 0.8;
          }
        }

        let keyBoxHeight = 0;
        if (q.answerKey) {
          const explText = cleanMarkdown(q.explanation || (!q.keyLetter ? q.answerKey : ''));
          const explLines = explText ? pdf.splitTextToSize(explText, 154) : [];
          keyBoxHeight = (explLines.length > 0 ? (explLines.length * 4.0) + 8.5 : 7.0) + 3.5;
        }

        const totalQuestionBlockHeight = qStemHeight + optionsHeight + keyBoxHeight + 6;

        // Prevent breaking: If the full question block fits on a single page, keep it together!
        if (totalQuestionBlockHeight <= 240) {
          checkPageBreak(totalQuestionBlockHeight);
        } else {
          checkPageBreak(28);
        }

        // Question Number & Text with proper hanging indent
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`${q.number}.`, 20, yPos);

        for (let pIdx = 0; pIdx < qStemParagraphs.length; pIdx++) {
          const pText = qStemParagraphs[pIdx];
          const qTextLines = pdf.splitTextToSize(pText, 163);
          pdf.setFont("helvetica", pIdx === 0 ? "bold" : "normal");
          pdf.setTextColor(15, 23, 42);
          for (let i = 0; i < qTextLines.length; i++) {
            if (yPos > 275) {
              pdf.addPage();
              yPos = 20;
            }
            pdf.text(qTextLines[i], 27, yPos);
            yPos += 4.5;
          }
          if (pIdx < qStemParagraphs.length - 1) yPos += 1.0;
        }
        yPos += 1.2;

        // Options (A, B, C, D)
        if (q.options && q.options.length > 0) {
          pdf.setFontSize(8.5);
          for (const opt of q.options) {
            const cleanOptText = cleanMarkdown(opt.text);
            const optLines = pdf.splitTextToSize(cleanOptText, 153);

            if (yPos + (optLines.length * 4.4) > 275) {
              pdf.addPage();
              yPos = 20;
            }

            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(67, 56, 202);
            pdf.text(`${opt.label}.`, 28, yPos);

            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(51, 65, 85);
            for (let j = 0; j < optLines.length; j++) {
              pdf.text(optLines[j], 34, yPos);
              yPos += 4.4;
            }
            yPos += 0.8;
          }
        }

        // Answer Key & Pembahasan Box
        if (q.answerKey) {
          const explText = cleanMarkdown(q.explanation || (!q.keyLetter ? q.answerKey : ''));
          const explLines = explText ? pdf.splitTextToSize(explText, 154) : [];
          const actualBoxHeight = (explLines.length > 0 ? (explLines.length * 4.0) + 8.5 : 7.0);

          if (yPos + actualBoxHeight > 275) {
            pdf.addPage();
            yPos = 20;
          }

          const keyLabel = q.keyLetter ? `Kunci Jawaban: [ Pilihan ${q.keyLetter} ]` : 'Kunci Jawaban / Rubrik Penilaian:';

          pdf.setFillColor(248, 250, 252);
          pdf.setDrawColor(203, 213, 225);
          pdf.setLineWidth(0.2);
          pdf.roundedRect(26, yPos, 164, actualBoxHeight, 1.5, 1.5, 'FD');

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.setTextColor(13, 148, 136); // teal
          pdf.text(keyLabel, 29, yPos + 4.2);

          if (explLines.length > 0) {
            pdf.setFont("helvetica", "italic");
            pdf.setTextColor(51, 65, 85);
            let currentKeyY = yPos + 8.0;
            for (const kl of explLines) {
              pdf.text(kl, 29, currentKeyY);
              currentKeyY += 4.0;
            }
          }
          yPos += actualBoxHeight + 3.5;
        }

        // Question Divider
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.2);
        pdf.line(20, yPos, 190, yPos);
        yPos += 3.8;
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
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => handleOpenForm(undefined, true)}
                className="flex items-center space-x-2 bg-indigo-500/80 hover:bg-indigo-500 text-white border border-white/20 px-4 py-3 rounded-2xl text-sm font-bold shadow-lg transition-all hover:scale-105 backdrop-blur-sm"
                title="Unggah file PDF Modul Ajar untuk menyusun draf RPP otomatis"
              >
                <FileUp className="w-5 h-5 text-amber-300" />
                <span>Impor Modul (PDF)</span>
              </button>
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center space-x-2 bg-white text-indigo-700 hover:bg-indigo-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-lg transition-all hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                <span>Buat RPP Baru</span>
              </button>
            </div>
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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Daftar E-RPP Tersimpan
            </h2>
            <div className="bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              Total: {savedRpps.length} RPP
            </div>
          </div>

          {savedRpps.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/50 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-10 h-10 text-indigo-300 dark:text-indigo-400" />
              </div>
              <h3 className="text-slate-700 dark:text-slate-200 font-bold text-lg mb-2">Belum Ada RPP</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mb-6">Anda belum membuat RPP apapun. Klik tombol "Buat RPP Baru" di atas untuk mulai membuat RPP menggunakan AI.</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => handleOpenForm(undefined, true)}
                  className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-md transition-all hover:scale-105"
                >
                  <FileUp className="w-4 h-4" />
                  <span>Impor dari Modul (PDF)</span>
                </button>
                <button
                  onClick={() => handleOpenForm()}
                  className="flex items-center space-x-2 bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-3 rounded-2xl text-sm font-bold shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat RPP Manual / AI</span>
                </button>
              </div>
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
                    className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider border border-indigo-200 dark:border-indigo-800/50">
                        {rpp.kelasSemester}
                      </div>
                      <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => exportPDF(rpp)} 
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors" 
                          title="Unduh PDF E-RPP"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenForm(rpp)} 
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors" 
                          title="Edit E-RPP"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteModalId(rpp.id)} 
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors" 
                          title="Hapus E-RPP"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">{rpp.mataPelajaran}</h3>
                    <div className="mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">Judul Materi:</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">{rpp.materi}</p>
                    </div>
                    {rpp.isiMateriPenjelas && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2 italic leading-relaxed">
                        "{rpp.isiMateriPenjelas}"
                      </p>
                    )}
                    
                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {rpp.createdAt ? format(new Date(rpp.createdAt), 'dd MMM yyyy') : '-'}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300">
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/40">
              <h2 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
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
                  <span>{isGenerating ? 'Menyusun Draft AI...' : (modulePdfFile ? 'Isi Otomatis (Dari Modul)' : 'Isi Otomatis (AI)')}</span>
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
              {/* Generation in Progress Feedback Banner */}
              {isGenerating && (
                <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center gap-3 animate-pulse">
                  <div className="w-5 h-5 border-2 border-indigo-300 dark:border-indigo-700 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin shrink-0" />
                  <div className="text-xs text-indigo-900 dark:text-indigo-200">
                    <span className="font-bold">AI sedang menyusun draf E-RPP & bank soal secara otomatis...</span>
                    <span className="block text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {modulePdfFile 
                        ? `Memproses modul "${modulePdfName}" untuk menyelaraskan capaian materi, aktivitas, dan bank soal.` 
                        : 'Memproses tujuan, langkah kegiatan pendahuluan-inti-penutup, soal latihan, dan instrumen asesmen.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Hidden File Input for PDF */}
              <input
                type="file"
                ref={pdfInputRef}
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handlePdfFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {/* Referensi Modul Ajar (Impor PDF) Card */}
              <div className="mb-8 p-5 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 dark:from-slate-800/80 dark:to-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-slate-800 transition-all shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-xs shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>Referensi Modul Ajar (Impor PDF)</span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          modulePdfFile 
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                        }`}>
                          {modulePdfFile ? '✓ Tersimpan sebagai Acuan Materi' : 'Opsional'}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Unggah Modul Ajar PDF agar materi pembelajaran dan naskah latihan soal selaras dengan modul Anda. File tersimpan otomatis di perangkat untuk acuan materi selanjutnya dan dapat dihapus sewaktu-waktu jika sudah tidak terpakai.
                      </p>
                    </div>
                  </div>
                  
                  {modulePdfFile && (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleAnalyzeModule()}
                        disabled={isExtractingModule}
                        className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
                        title="Ekstrak ulang judul materi dan isi materi penjelas dari file modul"
                      >
                        {isExtractingModule ? (
                          <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-indigo-700 rounded-full animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <span>{isExtractingModule ? 'Membaca...' : 'Deteksi Data'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Ganti PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModuleConfirmOpen(true)}
                        className="px-2.5 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-red-200 dark:border-red-900/40"
                        title="Hapus file PDF acuan ini dari penyimpanan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Acuan</span>
                      </button>
                    </div>
                  )}
                </div>

                {!modulePdfFile ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingPdf(true); }}
                    onDragLeave={() => setIsDraggingPdf(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handlePdfFileSelect(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => pdfInputRef.current?.click()}
                    className={`cursor-pointer border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all ${
                      isDraggingPdf 
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 scale-[1.01]' 
                        : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-white/80 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <FileUp className="w-6 h-6" />
                      </div>
                      <div className="text-center sm:text-left">
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center sm:justify-start gap-2">
                          <span>Tarik atau Pilih Dokumen Modul Ajar (PDF)</span>
                          <span className="hidden sm:inline-block text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 underline">Pilih File</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Mendukung file PDF hingga 20 MB. Materi pokok, kegiatan inti, dan soal PTS otomatis berorientasi pada isi modul ajar ini.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-850 rounded-xl border border-emerald-200 dark:border-emerald-850/80 shadow-2xs gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-white truncate flex items-center gap-2 flex-wrap">
                            <span>{modulePdfName}</span>
                            <span className="text-[10px] font-medium text-slate-400">({modulePdfSize})</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              ✓ Tersimpan sebagai Acuan
                            </span>
                          </div>
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Tersimpan untuk acuan RPP ini & berikutnya. Dapat dihapus sewaktu-waktu.</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteModuleConfirmOpen(true)}
                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors shrink-0"
                        title="Hapus acuan modul PDF ini dari penyimpanan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {moduleSummary && (
                      <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Ringkasan Materi Modul: </span>
                          <span>{moduleSummary}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Identitas Section */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 uppercase tracking-wide">1. Identitas Pembelajaran</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Satuan Pendidikan <span className="text-xs font-normal text-slate-400">(Sekolah)</span>
                    </label>
                    <input
                      type="text"
                      placeholder={schoolSettings.namaSekolah || "Contoh: SDN 1 Merdeka"}
                      value={satuanPendidikan}
                      onChange={(e) => setSatuanPendidikan(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 dark:text-white placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Nama sekolah (bukan nama aplikasi)</span>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Mata Pelajaran <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="Contoh: Matematika"
                      value={mataPelajaran}
                      onChange={(e) => setMataPelajaran(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 dark:text-white placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Kelas / Semester</label>
                    <input
                      type="text"
                      placeholder="Contoh: Kelas 1 / Ganjil"
                      value={kelasSemester}
                      onChange={(e) => setKelasSemester(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Alokasi Waktu</label>
                    <input
                      type="text"
                      placeholder="Contoh: 2 x 45 Menit"
                      value={alokasiWaktu}
                      onChange={(e) => setAlokasiWaktu(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                      Judul Materi <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">Contoh topik dapat dipilih di bawah</span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Operasi Hitung Campuran pada Pecahan"
                    value={materi}
                    onChange={(e) => setMateri(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                  
                  {/* Quick Topics Helper Chips */}
                  <div className="mt-2.5">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block mb-1.5 uppercase tracking-wider">
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
                          className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors font-medium text-left"
                        >
                          {topic.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Kolom Isi Materi Penjelas */}
                <div className="mt-5 p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="block text-sm font-bold text-slate-800 dark:text-white">
                          Isi Materi Penjelas (Uraian Konsep Pembelajaran)
                        </label>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          modulePdfFile 
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                        }`}>
                          {modulePdfFile ? '📄 Terisi Otomatis Sesuai Modul Ajar PDF' : '🌐 Terisi Otomatis dari Referensi Internet/Kurikulum Terpercaya'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Uraian materi pokok, konsep esensial, dan rangkuman yang diajarkan kepada siswa. Terisi otomatis dari modul PDF terlampir atau referensi internet pendidikan terpercaya.
                      </p>
                    </div>
                    {isiMateriPenjelas && (
                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={handleFormatIsiMateri}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center gap-1 shadow-2xs transition-colors"
                          title="Rapikan format nomor materi agar diberi enter dan tidak berjejer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Rapikan Enter Nomor</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(isiMateriPenjelas);
                            showToast('Isi materi penjelas berhasil disalin!', 'success');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 shadow-2xs"
                          title="Salin isi materi penjelas"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <textarea
                    rows={5}
                    placeholder={`Uraian materi penjelas terisi otomatis saat mengklik tombol "Isi Otomatis (AI)" atau "Deteksi Data" dari modul PDF.\n\nContoh Uraian:\n1. Pengertian & Konsep Inti: ...\n2. Uraian & Poin Pokok Bahasan: ...\n3. Contoh Kontekstual & Penerapan Nyata: ...`}
                    value={isiMateriPenjelas}
                    onChange={(e) => setIsiMateriPenjelas(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-normal text-slate-800 dark:text-white leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                
                {/* AI Configuration Box */}
                <div className="mt-6 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800/80 dark:to-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-slate-800 flex flex-col lg:flex-row items-center gap-4 relative overflow-hidden transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Sparkles className="w-16 h-16 text-indigo-500" />
                  </div>
                  <div className="w-full sm:w-auto flex-1 relative z-10">
                    <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">Tipe Latihan Soal AI</label>
                    <select
                      value={questionType}
                      onChange={(e) => setQuestionType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 shadow-sm"
                    >
                      <option value="Pilihan Ganda">Pilihan Ganda</option>
                      <option value="Uraian">Uraian / Esai</option>
                    </select>
                  </div>
                  <div className="w-full sm:w-auto flex-1 relative z-10">
                    <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">Jumlah Soal AI</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 shadow-sm"
                    />
                  </div>
                  <div className="w-full lg:w-auto flex flex-col items-stretch lg:items-end gap-1.5 relative z-10">
                    <button
                      type="button"
                      onClick={handleGenerateTemplate}
                      disabled={isGenerating}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0"
                    >
                      {isGenerating ? (
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>{isGenerating ? 'Menyusun Draft...' : (modulePdfFile ? '⚡ Isi Otomatis dari Modul PDF' : '⚡ Isi Otomatis dengan AI')}</span>
                    </button>
                    {modulePdfFile && (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[200px]">Acuan: {modulePdfName}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Komponen Inti Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 uppercase tracking-wide">2. Komponen Inti & Lampiran</h3>
                <div className="space-y-5">
                  
                  <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                    <label className="block text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                      <span className="bg-indigo-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs shadow-sm">A</span>
                      Tujuan Pembelajaran
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Tuliskan tujuan pembelajaran yang ingin dicapai..."
                      value={tujuanPembelajaran}
                      onChange={(e) => setTujuanPembelajaran(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-colors">
                    <label className="block text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <span className="bg-indigo-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs shadow-sm">B</span>
                      Langkah-Langkah Kegiatan Pembelajaran
                    </label>
                    
                    <div className="ml-0 md:ml-8 space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">1. Kegiatan Pendahuluan</label>
                        <textarea
                          rows={3}
                          placeholder="Kegiatan awal, apersepsi, motivasi..."
                          value={pendahuluan}
                          onChange={(e) => setPendahuluan(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">2. Kegiatan Inti</label>
                        <textarea
                          rows={5}
                          placeholder="Model pembelajaran, sintaks, eksplorasi, diskusi..."
                          value={kegiatanInti}
                          onChange={(e) => setKegiatanInti(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">3. Kegiatan Penutup</label>
                        <textarea
                          rows={3}
                          placeholder="Kesimpulan, refleksi, penugasan, doa..."
                          value={penutup}
                          onChange={(e) => setPenutup(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                    <label className="block text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                      <span className="bg-indigo-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs shadow-sm">C</span>
                      Penilaian Pembelajaran (Assessment)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Jelaskan instrumen penilaian sikap, pengetahuan, dan keterampilan..."
                      value={penilaian}
                      onChange={(e) => setPenilaian(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div className="bg-white dark:bg-slate-850 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-colors">
                    {/* Header & Controls */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="bg-indigo-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs font-extrabold shadow-xs">D</span>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white">
                          Latihan Soal & Kunci Jawaban
                        </h3>
                        <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Format Naskah Ujian PTS
                        </span>
                      </div>

                      {/* Action buttons & View Switcher */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* View Switcher */}
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setQuestionTab('paper')}
                            title="Tampilan naskah lembar ujian resmi siap pakai"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              questionTab === 'paper' 
                                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Naskah Ujian (Matang)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuestionTab('cards')}
                            title="Tampilan kartu per butir soal"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              questionTab === 'cards' 
                                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Kartu Soal</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuestionTab('raw')}
                            title="Edit teks mentah atau tempel naskah soal"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              questionTab === 'raw' 
                                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Teks</span>
                          </button>
                        </div>

                        {latihanSoal.trim() && (
                          <div className="flex items-center gap-1.5">
                            {/* Toggle Answer Key */}
                            <button
                              type="button"
                              onClick={() => setShowAnswerKeys(!showAnswerKeys)}
                              title={showAnswerKeys ? "Sembunyikan kunci jawaban (Mode Lembar Siswa)" : "Tampilkan kunci jawaban (Mode Guru)"}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                showAnswerKeys 
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {showAnswerKeys ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              <span className="hidden sm:inline">{showAnswerKeys ? 'Kunci: Tampil' : 'Kunci: Sembunyi'}</span>
                            </button>

                            {/* Copy Questions */}
                            <button
                              type="button"
                              onClick={handleCopyQuestions}
                              title="Salin seluruh naskah soal yang sudah rapi ke clipboard"
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs"
                            >
                              {copiedSoal ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                              <span className="hidden sm:inline">{copiedSoal ? 'Tersalin!' : 'Salin Naskah'}</span>
                            </button>

                            {/* Auto Format */}
                            <button
                              type="button"
                              onClick={handleFormatPTS}
                              title="Rapikan penomoran dan posisi pilihan A-D secara otomatis"
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-2xs"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span className="hidden sm:inline">Rapikan Format</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* VIEW 1: LEMBAR NASKAH UJIAN (SOAL MATANG) */}
                    {questionTab === 'paper' && (
                      <div>
                        {(() => {
                          const parsed = parsePTSQuestions(latihanSoal);
                          if (parsed.length === 0) {
                            return (
                              <div className="text-center py-12 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6">
                                <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                <p className="text-slate-800 dark:text-slate-200 font-extrabold text-sm mb-1">Naskah Soal Latihan Belum Tersedia</p>
                                <p className="text-slate-400 dark:text-slate-400 text-xs max-w-md mx-auto mb-5 leading-relaxed">
                                  Klik tombol <strong className="text-orange-600 dark:text-orange-400 font-extrabold">Isi Otomatis (AI)</strong> di bagian atas untuk menyusun paket soal PTS matang secara instan, atau beralih ke tab <strong>Edit Teks</strong> untuk mengetik manual.
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
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm transition-colors"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Ketik / Tempel Soal</span>
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="bg-slate-50/70 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-750 p-5 sm:p-7 space-y-6 shadow-inner">
                              {/* Kop Lembar Ujian Resmi */}
                              <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-xs space-y-3">
                                <div className="text-center border-b border-slate-200 dark:border-slate-700 pb-3">
                                  <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
                                    Kurikulum Merdeka / Asesmen Pembelajaran
                                  </span>
                                  <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-wide mt-0.5">
                                    LEMBAR SOAL ASESMEN & LATIHAN SISWA
                                  </h4>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    Standar Penilaian Tengah Semester (PTS) / Sumatif Lingkup Materi
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
                                  <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                                    <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-bold">Mata Pelajaran</span>
                                    <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate block mt-0.5">
                                      {mataPelajaran || 'Mata Pelajaran'}
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                                    <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-bold">Topik / Materi</span>
                                    <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate block mt-0.5">
                                      {materi || 'Materi Pokok'}
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                                    <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-bold">Kelas / Semester</span>
                                    <span className="font-extrabold text-slate-800 dark:text-slate-100 block mt-0.5">
                                      {kelasSemester || selectedClass}
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                                    <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-bold">Bentuk & Jumlah Soal</span>
                                    <span className="font-extrabold text-slate-800 dark:text-slate-100 block mt-0.5">
                                      {parsed.some(q => q.options?.length > 0) ? 'Pilihan Ganda' : 'Uraian'} ({parsed.length} Butir)
                                    </span>
                                  </div>
                                </div>

                                {/* Petunjuk Pengerjaan Box */}
                                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 rounded-xl text-xs text-amber-900 dark:text-amber-200 leading-relaxed flex items-start gap-2">
                                  <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-extrabold mr-1">PETUNJUK PENGERJAAN:</span>
                                    {parsed.some(q => q.options?.length > 0) 
                                      ? "Bacalah pertanyaan dengan teliti. Pilihlah salah satu jawaban yang paling tepat dengan memberikan tanda silang (X) pada pilihan jawaban A, B, C, atau D!" 
                                      : "Jawablah pertanyaan-pertanyaan berikut dengan singkat, tepat, dan sertakan argumen atau penjelasan yang jelas!"}
                                  </div>
                                </div>
                              </div>

                              {/* Daftar Butir Soal (Naskah Matang) */}
                              <div className="space-y-6">
                                {parsed.map((q, idx) => (
                                  <div
                                    key={q.number}
                                    className="bg-white dark:bg-slate-850 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-xs hover:border-indigo-200 dark:hover:border-indigo-800 transition-all space-y-4"
                                  >
                                    {/* Question Stem */}
                                    <div className="flex items-start gap-3">
                                      <span className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 font-black text-sm flex items-center justify-center shrink-0">
                                        {q.number}
                                      </span>
                                       <div className="flex-1 pt-0.5">
                                        <p className="text-slate-900 dark:text-slate-100 font-bold text-[14.5px] leading-relaxed select-text whitespace-pre-line">
                                          {cleanMarkdown(q.question)}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Options (A, B, C, D) */}
                                    {q.options && q.options.length > 0 && (
                                      <div className={`grid grid-cols-1 ${q.options.some(o => o.text.length > 65) ? '' : 'md:grid-cols-2'} gap-2.5 pl-0 sm:pl-10`}>
                                        {q.options.map((opt) => (
                                          <div
                                            key={opt.label}
                                            className="flex items-start gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-2xs group"
                                          >
                                            <span className="w-6 h-6 rounded-lg bg-white dark:bg-slate-750 border border-slate-300 dark:border-slate-650 text-slate-800 dark:text-slate-200 font-extrabold text-xs flex items-center justify-center shrink-0 group-hover:border-indigo-400 group-hover:text-indigo-600 transition-colors">
                                              {opt.label}
                                            </span>
                                            <span className="text-slate-800 dark:text-slate-200 font-medium text-sm leading-relaxed pt-0.5 select-text">
                                              {cleanMarkdown(opt.text)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Answer Key & Explanation */}
                                    {q.answerKey && (
                                      <div className="pl-0 sm:pl-10 pt-1">
                                        {showAnswerKeys ? (
                                          <div className="p-3.5 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 rounded-xl text-xs text-emerald-950 dark:text-emerald-200 space-y-1.5 shadow-2xs">
                                            <div className="flex items-center gap-2">
                                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                              <span className="font-extrabold text-emerald-900 dark:text-emerald-300 text-xs">
                                                Kunci Jawaban:
                                              </span>
                                              {q.keyLetter ? (
                                                <span className="bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-md text-[11px] shadow-2xs">
                                                  Pilihan {q.keyLetter}
                                                </span>
                                              ) : null}
                                            </div>
                                            {q.explanation ? (
                                              <p className="text-emerald-900/90 dark:text-emerald-200 leading-relaxed font-medium pl-6">
                                                <strong className="font-bold">Pembahasan: </strong>
                                                {cleanMarkdown(q.explanation)}
                                              </p>
                                            ) : (
                                              !q.keyLetter && (
                                                <p className="text-emerald-900/90 dark:text-emerald-200 leading-relaxed font-medium pl-6">
                                                  {cleanMarkdown(q.answerKey)}
                                                </p>
                                              )
                                            )}
                                          </div>
                                        ) : (
                                          <div className="text-[11px] text-slate-400 dark:text-slate-500 italic flex items-center gap-1.5 py-1">
                                            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Kunci jawaban disembunyikan (Mode Naskah Siswa)</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Footer Summary Strip */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-750 text-xs text-slate-600 dark:text-slate-300">
                                <span className="font-bold flex items-center gap-2">
                                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                                  Total {parsed.length} Butir Soal Telah Berformat Rapi Sesuai Standar PTS
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCopyQuestions}
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                                  >
                                    Salin Naskah Soal &rarr;
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* VIEW 2: KARTU SOAL INTERAKTIF */}
                    {questionTab === 'cards' && (
                      <div>
                        {(() => {
                          const parsed = parsePTSQuestions(latihanSoal);
                          if (parsed.length === 0) {
                            return (
                              <div className="text-center py-10 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6">
                                <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                <p className="text-slate-700 dark:text-slate-200 font-bold text-sm mb-1">Belum Ada Butir Soal</p>
                                <p className="text-slate-400 dark:text-slate-400 text-xs max-w-md mx-auto mb-4">
                                  Gunakan tombol AI atau beralih ke editor teks untuk membuat butir soal.
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-4">
                              {parsed.map((q) => (
                                <div
                                  key={q.number}
                                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all space-y-3.5 shadow-xs"
                                >
                                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <span className="bg-indigo-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg shadow-xs">
                                        Soal {q.number}
                                      </span>
                                      <span className="bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold px-2.5 py-0.5 rounded-md">
                                        {q.options && q.options.length > 0 ? 'Pilihan Ganda' : 'Uraian / Esai'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-slate-800 dark:text-white font-bold text-sm leading-relaxed whitespace-pre-wrap pl-1">
                                    {cleanMarkdown(q.question)}
                                  </div>

                                   {q.options && q.options.length > 0 && (
                                    <div className={`grid grid-cols-1 ${q.options.some(o => o.text.length > 65) ? '' : 'md:grid-cols-2'} gap-2.5 pt-1`}>
                                      {q.options.map((opt) => (
                                        <div
                                          key={opt.label}
                                          className="flex items-start gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors shadow-xs"
                                        >
                                          <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                                            {opt.label}
                                          </span>
                                          <span className="text-slate-700 dark:text-slate-200 font-medium pt-0.5 leading-snug select-text">
                                            {cleanMarkdown(opt.text)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {q.answerKey && (
                                    <div className="mt-2.5 p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                      <div className="leading-relaxed">
                                        <strong className="font-extrabold text-emerald-900 dark:text-emerald-300 mr-1.5">
                                          Kunci Jawaban & Pembahasan:
                                        </strong>
                                        <span className="font-medium text-emerald-800 dark:text-emerald-200">{cleanMarkdown(q.answerKey)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* VIEW 3: EDITOR TEKS MENTAH */}
                    {questionTab === 'raw' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                          <span>Editor Teks Mentah (Monospace)</span>
                          <span className="font-mono">{latihanSoal.length} karakter</span>
                        </div>
                        <textarea
                          rows={11}
                          placeholder={`Format standar PTS:\n1. Pertanyaan soal nomor satu?\n   A. Pilihan jawaban A\n   B. Pilihan jawaban B\n   C. Pilihan jawaban C\n   D. Pilihan jawaban D\n   Kunci Jawaban: A (Pembahasan singkat)\n\n2. Pertanyaan soal nomor dua?`}
                          value={latihanSoal}
                          onChange={(e) => setLatihanSoal(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          <span>Ketik atau tempel soal dengan nomor urut (1., 2.) dan pilihan (A., B., C., D.).</span>
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={handleFormatPTS}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-2xs flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Rapikan Format (Auto)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuestionTab('paper')}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Lihat Naskah Ujian &rarr;</span>
                            </button>
                          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden transition-colors">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white truncate">
                    Pratinjau Dokumen E-RPP
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-400 font-medium truncate">
                    {pdfPreviewFilename || 'RPP_Merdeka_Belajar.pdf'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(pdfPreviewUrl, '_blank')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-colors border border-indigo-200 dark:border-slate-750"
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
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  title="Tutup Pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/50 dark:bg-slate-950/50">
              {/* Desktop Iframe */}
              <div className="hidden md:block w-full h-[65vh] bg-white rounded-2xl shadow-inner border border-slate-200 dark:border-slate-800 overflow-hidden">
                <iframe
                  src={pdfPreviewUrl}
                  title="Pratinjau PDF E-RPP"
                  className="w-full h-full border-none"
                />
              </div>

              {/* Mobile Card */}
              <div className="md:hidden bg-white dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 dark:text-white text-base">Dokumen PDF E-RPP Siap!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
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
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Buka di Tab Baru / Cetak
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Sesuai Standar Kemendikbudristek No. 14/2019</span>
              <button
                onClick={() => setPdfPreviewUrl(null)}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 transition-colors">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Hapus E-RPP Ini?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tindakan ini permanen dan tidak dapat dibatalkan.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700">
              Dokumen RPP yang dihapus akan dihilangkan dari database sekolah dan tidak dapat dipulihkan kembali.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalId(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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

      {/* Delete Stored PDF Module Confirmation Modal */}
      {deleteModuleConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 transition-colors">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Hapus Acuan Modul PDF?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-xs">{modulePdfName || 'Modul Ajar PDF'}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700">
              File PDF modul ajar yang tersimpan di memori perangkat ini akan dihapus. Anda dapat mengunggah file modul ajar baru sewaktu-waktu jika diperlukan.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModuleConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleDeleteStoredModule();
                  setDeleteModuleConfirmOpen(false);
                }}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                Ya, Hapus Acuan Modul
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
