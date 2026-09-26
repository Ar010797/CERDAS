import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  X,
  FileDown,
  Printer,
  ExternalLink,
  Award,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar,
  UserCheck,
  Building2,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTugasDisplay } from '../lib/gradeSync';

export interface RaporStudentInfo {
  id?: string;
  name: string;
  nisn?: string;
  absen_number?: string;
  classId?: string;
}

export interface RaporPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: RaporStudentInfo;
  schoolSettings: any;
  subjects: string[];
  gradesData: Record<string, any>;
  kkmMap?: Record<string, number>;
  academicYear?: string;
  teacherName?: string;
  isAdmin?: boolean;
}

export default function RaporPreviewModal({
  isOpen,
  onClose,
  student,
  schoolSettings,
  subjects,
  gradesData,
  kkmMap = {},
  academicYear,
  teacherName,
  isAdmin = false
}: RaporPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'pdf'>('ringkasan');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const resolvedAcademicYear = academicYear || schoolSettings?.tahunAjaran || '2026/2027';
  const resolvedTeacherName = teacherName || (isAdmin ? 'Guru Wali Kelas' : 'Wali Kelas');

  const getSubjectKKM = (subj: string): number => {
    if (kkmMap && kkmMap[subj] !== undefined && Number(kkmMap[subj]) > 0) {
      return Number(kkmMap[subj]);
    }
    if (schoolSettings?.kkmMap?.[subj] !== undefined && Number(schoolSettings.kkmMap[subj]) > 0) {
      return Number(schoolSettings.kkmMap[subj]);
    }
    return Number(schoolSettings?.kkmGlobal) || 75;
  };

  // Hitung data tabel nilai
  const tableRows = useMemo(() => {
    return subjects.map((subj, idx) => {
      const g = gradesData[subj] || {};
      const kkm = getSubjectKKM(subj);

      // Handle tugas
      let tugasDisplay = '-';
      let tugasNum: number | null = null;
      if (Array.isArray(g.tugas)) {
        tugasDisplay = formatTugasDisplay(g.tugas);
        const validScores = g.tugas.map((t: any) => parseFloat(t)).filter((t: number) => !isNaN(t));
        if (validScores.length > 0) {
          tugasNum = validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length;
        }
      } else if (g.tugas !== undefined && g.tugas !== null && g.tugas !== '') {
        tugasDisplay = formatTugasDisplay(g.tugas);
        const parsed = parseFloat(String(g.tugas));
        if (!isNaN(parsed)) tugasNum = parsed;
      }

      // Handle UH jika ada
      let uhDisplay = '-';
      let uhNum: number | null = null;
      if (Array.isArray(g.ulanganHarian)) {
        const validUH = g.ulanganHarian.map((t: any) => parseFloat(t)).filter((t: number) => !isNaN(t));
        if (validUH.length > 0) {
          uhNum = validUH.reduce((a: number, b: number) => a + b, 0) / validUH.length;
          uhDisplay = uhNum.toFixed(1);
        }
      }

      const ptsStr = g.pts !== undefined && g.pts !== null ? String(g.pts).trim() : '';
      const pasStr = g.pas !== undefined && g.pas !== null ? String(g.pas).trim() : '';
      const ptsNum = ptsStr !== '' && !isNaN(parseFloat(ptsStr)) ? parseFloat(ptsStr) : null;
      const pasNum = pasStr !== '' && !isNaN(parseFloat(pasStr)) ? parseFloat(pasStr) : null;

      // Hitung Nilai Akhir
      const validComponents: number[] = [];
      if (tugasNum !== null) validComponents.push(tugasNum);
      if (uhNum !== null) validComponents.push(uhNum);
      if (ptsNum !== null) validComponents.push(ptsNum);
      if (pasNum !== null) validComponents.push(pasNum);

      let finalScore: number | null = null;
      if (validComponents.length > 0) {
        finalScore = Math.round((validComponents.reduce((a, b) => a + b, 0) / validComponents.length) * 10) / 10;
      }

      const isPassed = finalScore !== null ? finalScore >= kkm : null;

      return {
        no: idx + 1,
        subject: subj,
        kkm,
        tugasDisplay,
        uhDisplay,
        pts: ptsStr || '-',
        pas: pasStr || '-',
        finalScore: finalScore !== null ? finalScore : '-',
        isPassed
      };
    });
  }, [subjects, gradesData, kkmMap, schoolSettings]);

  // Statistik nilai rapor
  const summaryStats = useMemo(() => {
    const finalScores = tableRows
      .map(r => typeof r.finalScore === 'number' ? r.finalScore : null)
      .filter((n): n is number => n !== null);

    const average = finalScores.length > 0
      ? (finalScores.reduce((a, b) => a + b, 0) / finalScores.length).toFixed(1)
      : '-';

    const passedCount = tableRows.filter(r => r.isPassed === true).length;
    const needHelpCount = tableRows.filter(r => r.isPassed === false).length;

    return {
      totalSubjects: subjects.length,
      average,
      passedCount,
      needHelpCount
    };
  }, [tableRows, subjects]);

  // Generate jsPDF instance
  const buildPdf = () => {
    const pdf = new jsPDF();
    const namaSekolah = (schoolSettings?.namaSekolah || 'SEKOLAH').toUpperCase();

    // 1. KOP SEKOLAH
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text(namaSekolah, 105, 20, { align: 'center' });

    pdf.setFontSize(12);
    pdf.setTextColor(71, 85, 105);
    pdf.text('LAPORAN HASIL BELAJAR (RAPOR PESERTA DIDIK)', 105, 28, { align: 'center' });

    pdf.setDrawColor(30, 41, 59);
    pdf.setLineWidth(0.6);
    pdf.line(20, 32, 190, 32);
    pdf.setLineWidth(0.2);
    pdf.line(20, 33.2, 190, 33.2);

    // 2. DATA IDENTITAS SISWA
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text('Nama Peserta Didik', 20, 44);
    pdf.text(`: ${student.name || '-'}`, 70, 44);
    pdf.text('Nomor Induk / NISN', 20, 51);
    pdf.text(`: ${student.absen_number || '-'} / ${student.nisn || '-'}`, 70, 51);

    pdf.text('Kelas', 130, 44);
    pdf.text(`: ${student.classId || '-'}`, 160, 44);
    pdf.text('Tahun Ajaran', 130, 51);
    pdf.text(`: ${resolvedAcademicYear}`, 160, 51);

    // 3. TABEL NILAI
    const tableBody = tableRows.map(r => [
      r.no.toString(),
      r.subject,
      r.kkm.toString(),
      r.tugasDisplay,
      r.pts,
      r.pas,
      r.finalScore.toString()
    ]);

    if (tableBody.length === 0) {
      tableBody.push(['-', 'Belum ada mata pelajaran', '-', '-', '-', '-', '-']);
    }

    autoTable(pdf, {
      startY: 62,
      head: [['No', 'Mata Pelajaran', 'KKM', 'Nilai Tugas', 'PTS', 'PAS', 'Nilai Akhir']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: {
        fontSize: 9,
        cellPadding: 2.8
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 54 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 38, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
      }
    });

    const finalY = (pdf as any).lastAutoTable?.finalY || 100;

    // Check page break for signature
    if (finalY > 225) {
      pdf.addPage();
    }
    const signatureY = finalY > 225 ? 25 : finalY + 16;

    // 4. BLOK TANDA TANGAN & PENGESAHAN
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(30, 41, 59);

    // Kiri: Kepala Sekolah
    pdf.text('Mengetahui,', 45, signatureY, { align: 'center' });
    pdf.text('Kepala Sekolah', 45, signatureY + 6, { align: 'center' });

    // Bubuhkan TTD Digital Kepala Sekolah jika ada
    if (schoolSettings?.tandaTanganKepalaSekolah) {
      try {
        pdf.addImage(schoolSettings.tandaTanganKepalaSekolah, 'PNG', 31, signatureY + 7, 28, 16);
      } catch (err) {
        console.warn('TTD digital embed note:', err);
      }
    }

    // Bubuhkan Stempel Sekolah jika ada
    if (schoolSettings?.stempelSekolah) {
      try {
        pdf.addImage(schoolSettings.stempelSekolah, 'PNG', 24, signatureY + 6, 22, 22);
      } catch (err) {
        console.warn('Stempel embed note:', err);
      }
    }

    pdf.setFont('helvetica', 'bold');
    pdf.text(
      schoolSettings?.namaKepalaSekolah || '________________________',
      45,
      signatureY + 25,
      { align: 'center' }
    );
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text(
      schoolSettings?.nipKepalaSekolah
        ? `NIP. ${schoolSettings.nipKepalaSekolah}`
        : 'NIP. __________________',
      45,
      signatureY + 30,
      { align: 'center' }
    );

    // Kanan: Wali Kelas
    const formattedDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    pdf.setFontSize(9.5);
    pdf.text(`${schoolSettings?.namaSekolah || 'Sekolah'}, ${formattedDate}`, 155, signatureY, { align: 'center' });
    pdf.text('Wali Kelas', 155, signatureY + 6, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.text(resolvedTeacherName, 155, signatureY + 25, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text('NIP. __________________', 155, signatureY + 30, { align: 'center' });

    // Footer catatan
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text(
      `Dokumen Rapor Digital • Diterbitkan secara resmi oleh ${namaSekolah} • Dicetak tanggal ${formattedDate}`,
      105,
      287,
      { align: 'center' }
    );

    return pdf;
  };

  // Generate blob URL untuk pratinjau saat modal dibuka
  useEffect(() => {
    if (!isOpen) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      setDownloadSuccess(false);
      return;
    }

    try {
      setIsGenerating(true);
      const pdf = buildPdf();
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (err) {
      console.error('Error generating PDF preview:', err);
    } finally {
      setIsGenerating(false);
    }

    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [isOpen, student, schoolSettings, gradesData, subjects]);

  if (!isOpen) return null;

  const safeFilename = `Rapor_${(student.name || 'Siswa').replace(/\s+/g, '_')}_${(student.classId || 'Kelas').replace(/\s+/g, '_')}.pdf`;

  const handleDownload = () => {
    try {
      const pdf = buildPdf();
      pdf.save(safeFilename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    }
  };

  const handleOpenNewTab = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-gradient-to-r from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-850 dark:to-indigo-950/40">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Tinjau Dulu Sebelum Unduh
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {student.classId || 'Kelas Santri'} • Th. {resolvedAcademicYear}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                Pratinjau Rapor: {student.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                NISN: {student.nisn || '-'} • No. Absen: {student.absen_number || '-'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Tutup Pratinjau"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center px-4 sm:px-6 pt-3 border-b border-slate-100 dark:border-slate-800 gap-2 bg-slate-50/60 dark:bg-slate-850/40">
          <button
            onClick={() => setActiveTab('ringkasan')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'ringkasan'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Tinjauan Data & Nilai</span>
          </button>
          <button
            onClick={() => setActiveTab('pdf')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'pdf'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Lembar Cetak PDF Asli</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/50">
          {activeTab === 'ringkasan' ? (
            <div className="space-y-5">
              {/* Alert notice */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Periksa Kembali Sebelum Mengunduh PDF:</p>
                  <p className="mt-0.5 leading-relaxed text-[11px] text-amber-800 dark:text-amber-300">
                    Pastikan seluruh nilai tugas otomatis, PTS, PAS, serta nama kepala sekolah dan wali kelas sudah benar. Jika ada yang ingin diperbaiki, Anda dapat menutup jendela ini dan mengeditnya terlebih dahulu.
                  </p>
                </div>
              </div>

              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Mapel
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      {summaryStats.totalSubjects}
                    </span>
                    <span className="text-xs text-slate-500">Mata Pelajaran</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                    Rata-Rata Rapor
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                      {summaryStats.average}
                    </span>
                    <span className="text-xs text-slate-500">skala 100</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">
                    Tuntas (≥ KKM)
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {summaryStats.passedCount}
                    </span>
                    <span className="text-xs text-slate-500">Mapel</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
                    Perlu Bimbingan
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                      {summaryStats.needHelpCount}
                    </span>
                    <span className="text-xs text-slate-500">Mapel</span>
                  </div>
                </div>
              </div>

              {/* Table of Grades */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-750 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <span>Rincian Nilai per Mata Pelajaran</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Nilai tugas masuk secara otomatis
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-850 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3 text-center w-10">No</th>
                        <th className="py-2.5 px-3">Mata Pelajaran</th>
                        <th className="py-2.5 px-3 text-center">KKM</th>
                        <th className="py-2.5 px-3 text-center">Nilai Tugas</th>
                        <th className="py-2.5 px-3 text-center">PTS</th>
                        <th className="py-2.5 px-3 text-center">PAS</th>
                        <th className="py-2.5 px-3 text-center">Nilai Akhir</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {tableRows.map((row) => (
                        <tr key={row.no} className="hover:bg-slate-50/60 dark:hover:bg-slate-750/50">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">{row.no}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {row.subject}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-medium">
                            {row.kkm}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                            {row.tugasDisplay}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">
                            {row.pts}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">
                            {row.pas}
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-slate-900 dark:text-white">
                            {row.finalScore}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {row.isPassed === true ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Tuntas
                              </span>
                            ) : row.isPassed === false ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
                                Perlu Bimbingan
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures & School verification checklist */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Cek Pengesahan Resmi Pada Dokumen PDF:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 dark:text-white block truncate">
                        {schoolSettings?.namaSekolah || 'Sekolah'}
                      </span>
                      <span className="text-[10px] text-slate-400">Kop Surat Resmi</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 dark:text-white block truncate">
                        {schoolSettings?.namaKepalaSekolah || 'Kepala Sekolah'}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {schoolSettings?.tandaTanganKepalaSekolah ? '✓ TTD Digital Terpasang' : 'Tanda Tangan Manual'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 dark:text-white block truncate">
                        Stempel Sekolah
                      </span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        {schoolSettings?.stempelSekolah ? '✓ Stempel Resmi Aktif' : 'Tanpa Stempel Digital'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* PDF Preview container */}
              {isGenerating ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Menyusun dokumen PDF rapor...</p>
                </div>
              ) : pdfBlobUrl ? (
                <div>
                  {/* Desktop Iframe */}
                  <div className="hidden md:block w-full h-[62vh] bg-white rounded-2xl shadow-inner border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <iframe
                      src={pdfBlobUrl}
                      title="Pratinjau PDF Rapor"
                      className="w-full h-full border-none"
                    />
                  </div>

                  {/* Mobile Preview View */}
                  <div className="md:hidden bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-4 shadow-sm">
                    <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
                      <FileText className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 dark:text-white text-base">
                        Pratinjau PDF Rapor Siap
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                        Dokumen PDF telah selesai disusun dengan format resmi standar Kemendikbudristek lengkap dengan tabel nilai dan pengesahan.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        onClick={handleOpenNewTab}
                        className="w-full py-2.5 px-4 bg-indigo-50 dark:bg-slate-750 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Buka Lembar Penuh di Tab Baru</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  Gagal memuat pratinjau PDF. Anda tetap dapat mengunduh langsung di bawah.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Pastikan semua nilai sudah sesuai sebelum diunduh.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup / Koreksi Dulu
            </button>

            <button
              onClick={handleOpenNewTab}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Buka pratinjau di tab baru"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Langsung</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>{downloadSuccess ? '✓ PDF Berhasil Diunduh!' : 'Konfirmasi & Unduh PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
