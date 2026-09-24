import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatClassBadge } from '../screens/admin/Announcements';

export interface AnnouncementForPDF {
  id?: string;
  title: string;
  content: string;
  category?: string;
  priority?: string;
  targetClass?: string;
  targetRole?: string;
  authorName?: string;
  authorRole?: string;
  authorClass?: string;
  date?: any;
  createdAt?: string;
}

export interface SchoolProfileForPDF {
  namaSekolah?: string;
  schoolName?: string;
  namaKepalaSekolah?: string;
  kepalaSekolah?: string;
  nipKepalaSekolah?: string;
  alamatSekolah?: string;
  nomorTelepon?: string;
  emailSekolah?: string;
  academicYear?: string;
  tandaTanganKepalaSekolah?: string; // base64 PNG data url
  stempelSekolah?: string; // base64 PNG data url
}

/**
 * Menghasilkan dan mengunduh Dokumen Surat Pengumuman Resmi Sekolah (PDF)
 * lengkap dengan Kop Surat Resmi, salam lengkap, dan tanda tangan digital / stempel.
 */
export function generateAnnouncementPDF(
  announcement: AnnouncementForPDF,
  school: SchoolProfileForPDF
) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let y = 18;

  // 1. KOP SURAT RESMI
  const schoolName = (school.namaSekolah || school.schoolName || 'SATUAN PENDIDIKAN CERDAS').toUpperCase();
  const schoolAddress = school.alamatSekolah || 'Jl. Raya Pendidikan No. 1, Kotayasa, Kec. Sumbang, Kab. Banyumas';
  const schoolContact = `Telp: ${school.nomorTelepon || '(0281) 684210'} | Email: ${school.emailSekolah || 'administrasi@sekolah.sch.id'}`;

  // Logo / Icon Sekolah di Kop Surat
  pdf.setDrawColor(79, 70, 229);
  pdf.setFillColor(238, 242, 255);
  pdf.roundedRect(margin, y - 2, 16, 16, 2, 2, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(79, 70, 229);
  pdf.text('CDS', margin + 8, y + 8, { align: 'center' });

  // Teks Kop
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(schoolName, margin + 20, y + 2);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(schoolAddress, margin + 20, y + 7);
  pdf.text(schoolContact, margin + 20, y + 12);

  y += 20;

  // Garis Pembatas Kop Surat (Ganda: tebal dan tipis)
  pdf.setDrawColor(30, 41, 59);
  pdf.setLineWidth(0.8);
  pdf.line(margin, y, pageWidth - margin, y);
  pdf.setLineWidth(0.2);
  pdf.line(margin, y + 1.2, pageWidth - margin, y + 1.2);

  y += 9;

  // 2. JUDUL DOKUMEN & NOMOR SURAT
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text('SURAT PEMBERITAHUAN / PENGUMUMAN RESMI', pageWidth / 2, y, { align: 'center' });

  const yearNow = new Date().getFullYear();
  const cleanId = (announcement.id || 'DOC').slice(0, 6).toUpperCase();
  const noSurat = `Nomor : 421.1 / PENG / ${yearNow} / ${cleanId}`;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(noSurat, pageWidth / 2, y + 5, { align: 'center' });

  y += 14;

  // 3. TABEL INFORMASI SURAT (Perihal, Lampiran, Sifat, Sasaran)
  let dateText = '';
  try {
    if (announcement.date?.toDate) {
      dateText = format(announcement.date.toDate(), 'dd MMMM yyyy', { locale: id });
    } else if (announcement.createdAt) {
      dateText = format(new Date(announcement.createdAt), 'dd MMMM yyyy', { locale: id });
    } else {
      dateText = format(new Date(), 'dd MMMM yyyy', { locale: id });
    }
  } catch {
    dateText = format(new Date(), 'dd MMMM yyyy', { locale: id });
  }

  const targetClassFormatted = formatClassBadge(announcement.targetClass);

  pdf.setFontSize(9);
  pdf.setTextColor(30, 41, 59);

  // Kiri: Sifat & Perihal
  pdf.setFont('helvetica', 'bold');
  pdf.text('Perihal', margin, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`: ${announcement.title}`, margin + 22, y);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Kategori', margin, y + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`: ${announcement.category || 'Pengumuman Umum'}`, margin + 22, y + 5);

  // Kanan: Tanggal & Sifat
  pdf.setFont('helvetica', 'bold');
  pdf.text('Tanggal', pageWidth - margin - 50, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`: ${dateText}`, pageWidth - margin - 32, y);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Prioritas', pageWidth - margin - 50, y + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`: ${announcement.priority || 'Normal'}`, pageWidth - margin - 32, y + 5);

  y += 12;

  // 4. KEPADA YTH
  pdf.setFont('helvetica', 'normal');
  pdf.text('Kepada Yth.', margin, y);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Bapak / Ibu Wali Murid & Siswa ${targetClassFormatted}`, margin, y + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('di Tempat', margin, y + 10);

  y += 18;

  // 5. ISI PENGUMUMAN
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);

  const lines = pdf.splitTextToSize(announcement.content, contentWidth);

  // Periksa apakah halaman cukup
  const neededHeight = lines.length * 5.2 + 65; // perkiraan tinggi teks + blok ttd
  if (y + neededHeight > pageHeight) {
    // Muat bertahap dengan penanganan pemisahan baris
    lines.forEach((line: string) => {
      if (y > pageHeight - 60) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, margin, y);
      y += 5.2;
    });
  } else {
    pdf.text(lines, margin, y);
    y += lines.length * 5.2;
  }

  y += 10;

  // 6. BLOK TANDA TANGAN RESMI
  if (y + 55 > pageHeight) {
    pdf.addPage();
    y = 25;
  }

  const signDateLocation = `${school.namaSekolah ? school.namaSekolah.split(' ')[0] : 'Kotayasa'}, ${dateText}`;
  const signRightX = pageWidth - margin - 35; // Posisi tengah blok kanan

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(signDateLocation, signRightX, y, { align: 'center' });
  pdf.text('Mengetahui,', signRightX, y + 5, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.text('Kepala Sekolah', signRightX, y + 10, { align: 'center' });

  // Bubuhkan Tanda Tangan Digital jika tersedia
  if (school.tandaTanganKepalaSekolah) {
    try {
      pdf.addImage(
        school.tandaTanganKepalaSekolah,
        'PNG',
        signRightX - 16,
        y + 11,
        32,
        18
      );
    } catch (sigErr) {
      console.warn('Gagal membubuhkan tanda tangan digital pada PDF:', sigErr);
    }
  }

  // Bubuhkan Stempel Resmi Sekolah jika tersedia (sedikit overlapping dengan tanda tangan)
  if (school.stempelSekolah) {
    try {
      pdf.addImage(
        school.stempelSekolah,
        'PNG',
        signRightX - 25,
        y + 10,
        24,
        24
      );
    } catch (stampErr) {
      console.warn('Gagal membubuhkan stempel resmi pada PDF:', stampErr);
    }
  }

  // Nama & NIP Kepala Sekolah
  const namaKepsek = school.namaKepalaSekolah || school.kepalaSekolah || '__________________________';
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.text(namaKepsek, signRightX, y + 33, { align: 'center' });
  pdf.setLineWidth(0.2);
  const nameWidth = pdf.getTextWidth(namaKepsek);
  pdf.line(signRightX - nameWidth / 2, y + 34, signRightX + nameWidth / 2, y + 34);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.text(
    school.nipKepalaSekolah ? `NIP. ${school.nipKepalaSekolah}` : 'NIP. ____________________',
    signRightX,
    y + 38,
    { align: 'center' }
  );

  // Kolom Kiri: Penanggung Jawab / Pembuat Pengumuman
  if (announcement.authorName) {
    const signLeftX = margin + 35;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('Pemberi Informasi / Guru,', signLeftX, y + 5, { align: 'center' });
    pdf.setFont('helvetica', 'bold');
    pdf.text(announcement.authorRole || 'Guru Mata Pelajaran', signLeftX, y + 10, { align: 'center' });

    pdf.text(announcement.authorName, signLeftX, y + 33, { align: 'center' });
    const authorWidth = pdf.getTextWidth(announcement.authorName);
    pdf.setLineWidth(0.2);
    pdf.line(signLeftX - authorWidth / 2, y + 34, signLeftX + authorWidth / 2, y + 34);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text(announcement.authorClass ? `Wali ${announcement.authorClass}` : 'Staf Tenaga Pendidik', signLeftX, y + 38, { align: 'center' });
  }

  // 7. FOOTER RESMI & QR VERIFIKASI SISTEM
  const totalPages = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);

    const footerText = `Dokumen Resmi Sistem Informasi & Administrasi Sekolah CERDAS • Dicetak otomatis pada ${format(new Date(), 'dd/MM/yyyy HH:mm')} WIB`;
    pdf.text(footerText, margin, pageHeight - 10);
    pdf.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  // Bersihkan karakter nama file
  const cleanTitle = announcement.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const fileName = `Pengumuman_${cleanTitle}_${dateText.replace(/\s+/g, '_')}.pdf`;
  pdf.save(fileName);
}
