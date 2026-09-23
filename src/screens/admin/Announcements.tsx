import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Bell,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
  Megaphone,
  Sparkles,
  Users,
  GraduationCap,
  Calendar,
  Filter,
  Send,
  AlertCircle,
  HeartPulse,
  Clock,
  ShieldAlert,
  Stethoscope
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  authorName?: string;
  authorRole?: string;
  authorId?: string;
  authorClass?: string;
  targetClass?: string;
  targetRole?: string;
  category?: string;
  priority?: 'Normal' | 'Penting' | string;
  date: any;
}

export const CATEGORIES = [
  'Pengumuman Umum',
  'Pulang Mendadak / Lebih Awal',
  'Libur Mendadak / Insidental',
  'Himbauan Imunisasi & Skrining',
  'Himbauan & Ketertiban Umum',
  'Akademik & Ujian',
  'Kegiatan Sekolah',
  'Informasi Wali Murid',
  'Administrasi & Keuangan',
  'Libur Sekolah'
];

export function getCategoryBadgeStyle(cat?: string) {
  if (!cat) {
    return {
      bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/40',
      icon: '📌'
    };
  }
  const lower = cat.toLowerCase();
  if (lower.includes('pulang')) {
    return {
      bg: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-800',
      icon: '🚨'
    };
  }
  if (lower.includes('libur mendadak') || lower.includes('insidental')) {
    return {
      bg: 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-200 border-rose-300 dark:border-rose-800',
      icon: '🛑'
    };
  }
  if (lower.includes('imunisasi') || lower.includes('skrining') || lower.includes('kesehatan')) {
    return {
      bg: 'bg-teal-100 text-teal-900 dark:bg-teal-950/80 dark:text-teal-200 border-teal-300 dark:border-teal-800',
      icon: '🩺'
    };
  }
  if (lower.includes('himbauan') || lower.includes('ketertiban')) {
    return {
      bg: 'bg-sky-100 text-sky-900 dark:bg-sky-950/80 dark:text-sky-200 border-sky-300 dark:border-sky-800',
      icon: '📢'
    };
  }
  if (lower.includes('ujian') || lower.includes('akademik') || lower.includes('pts')) {
    return {
      bg: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800',
      icon: '📝'
    };
  }
  if (lower.includes('wali') || lower.includes('paguyuban')) {
    return {
      bg: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
      icon: '🤝'
    };
  }
  if (lower.includes('libur')) {
    return {
      bg: 'bg-orange-100 text-orange-900 dark:bg-orange-950/80 dark:text-orange-200 border-orange-300 dark:border-orange-800',
      icon: '🏖️'
    };
  }
  return {
    bg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
    icon: '📢'
  };
}

export const SD_CLASSES = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'];
export const MTS_CLASSES = ['Kelas 7', 'Kelas 8', 'Kelas 9'];

export const CLASSES = [
  'Semua Kelas',
  ...SD_CLASSES,
  ...MTS_CLASSES
];

export const formatClassBadge = (cls?: string) => {
  if (!cls || cls === 'Semua Kelas') return 'Semua Kelas (SD & MTs)';
  const sd = SD_CLASSES.find((c) => cls === c || cls.startsWith(c + ' '));
  if (sd) return `${sd} (SD)`;
  const mts = MTS_CLASSES.find((c) => cls === c || cls.startsWith(c + ' '));
  if (mts) return `${mts} (MTs)`;
  return cls;
};

export default function Announcements() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';
  const isGuru = userData?.role === 'Guru';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetClass, setTargetClass] = useState<string>(
    isGuru && userData?.assigned_class ? userData.assigned_class : 'Semua Kelas'
  );
  const [targetRole, setTargetRole] = useState<'Semua' | 'Wali Murid' | 'Guru'>('Semua');
  const [category, setCategory] = useState('Pengumuman Umum');
  const [priority, setPriority] = useState<'Normal' | 'Penting'>('Normal');
  const [saving, setSaving] = useState(false);

  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter state
  const [selectedFilterClass, setSelectedFilterClass] = useState<string>('Semua');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('Semua');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
        setLoading(false);
      },
      (err) => {
        console.warn('Announcements snapshot error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleOpenModal = () => {
    const defaultSigner = isGuru && userData?.assigned_class
      ? `Wali Kelas ${userData.assigned_class} & Dewan Guru`
      : 'Pihak Sekolah & Dewan Guru';

    setTitle('');
    setContent(
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSalam sejahtera bagi kita semua.\n\nYth. Bapak/Ibu Wali Murid,\n\n[Tuliskan isi pengumuman atau informasi sekolah secara lengkap di sini...]\n\nDemikian pemberitahuan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu sekalian, kami ucapkan terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nHormat kami,\n${defaultSigner}`
    );
    setCategory('Pengumuman Umum');
    setPriority('Normal');
    setTargetRole('Semua');
    setTargetClass(isGuru && userData?.assigned_class ? userData.assigned_class : 'Semua Kelas');
    setIsModalOpen(true);
  };

  const insertFullSalam = () => {
    const defaultSigner = isGuru && userData?.assigned_class
      ? `Wali Kelas ${userData.assigned_class} & Dewan Guru`
      : 'Pihak Sekolah & Dewan Guru';

    const opening = "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSalam sejahtera bagi kita semua.\n\n";
    const closing = `\n\nDemikian pemberitahuan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu sekalian, kami ucapkan terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nHormat kami,\n${defaultSigner}`;

    if (!content.trim()) {
      setContent(`${opening}Yth. Bapak/Ibu Wali Murid,\n\n[Tuliskan isi pengumuman di sini...]${closing}`);
    } else {
      let updated = content;
      if (!updated.includes("Assalamu'alaikum Warahmatullahi Wabarakatuh")) {
        updated = opening + updated;
      }
      if (!updated.includes("Wassalamu'alaikum Warahmatullahi Wabarakatuh")) {
        updated = updated + closing;
      }
      setContent(updated);
    }
    showToast('Salam pembuka & penutup lengkap berhasil disisipkan.', 'success');
  };

  const applyTemplate = (type: 'pulang_mendadak' | 'libur_mendadak' | 'imunisasi_skrining' | 'himbauan_umum' | 'pts' | 'libur' | 'paguyuban' | 'tugas') => {
    const defaultClass = isGuru && userData?.assigned_class ? userData.assigned_class : 'Semua Kelas';
    const signer = isGuru && userData?.assigned_class ? `Wali Kelas ${userData.assigned_class} & Dewan Guru` : 'Pihak Sekolah & Dewan Guru';

    if (type === 'pulang_mendadak') {
      setTitle('Pemberitahuan: Peserta Didik Dipulangkan Lebih Awal Hari Ini');
      setContent(
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSalam sejahtera bagi kita semua.\n\nYth. Bapak/Ibu Wali Murid,\n\nDengan ini kami menginformasikan bahwa pada hari ini kegiatan pembelajaran di sekolah selesai lebih awal dikarenakan [alasan: rapat evaluasi dewan guru / cuaca ekstrem / kegiatan kedinasan].\n\nPeserta didik akan dipulangkan pada pukul: [contoh: 10.30 WIB].\n\nBagi Bapak/Ibu yang biasa menjemput ananda, dimohon hadir tepat waktu demi keamanan dan keselamatan bersama. Bagi siswa yang mandiri atau berjalan kaki, dewan guru telah mengimbau untuk langsung pulang ke rumah masing-masing dan tidak bermain di luar.\n\nDemikian pemberitahuan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu sekalian, kami ucapkan terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nHormat kami,\n${signer}`
      );
      setCategory('Pulang Mendadak / Lebih Awal');
      setPriority('Penting');
      setTargetRole('Wali Murid');
      showToast('Templat Pulang Lebih Awal diterapkan dengan salam lengkap.', 'success');
    } else if (type === 'libur_mendadak') {
      setTitle('Pemberitahuan: Libur Mendadak / Pembelajaran Mandiri di Rumah');
      setContent(
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSalam sejahtera bagi kita semua.\n\nYth. Bapak/Ibu Guru dan Wali Murid,\n\nSehubungan dengan adanya [alasan: kondisi cuaca ekstrem / pemeliharaan darurat fasilitas sekolah / agenda kedinasan], kami menginformasikan bahwa kegiatan pembelajaran tatap muka di sekolah pada hari [Hari, Tanggal] dialihkan menjadi pembelajaran mandiri di rumah (daring).\n\nSeluruh peserta didik diharapkan tetap berada di rumah, mempelajari materi pelajaran yang ditugaskan bapak/ibu guru, serta senantiasa menjaga kesehatan dan keselamatan.\n\nKegiatan pembelajaran tatap muka di sekolah akan aktif kembali seperti biasa pada hari [Hari berikutnya].\n\nDemikian pemberitahuan ini kami sampaikan. Atas perhatian, pengertian, dan kerja sama Bapak/Ibu sekalian, kami ucapkan terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nHormat kami,\n${signer}`
      );
      setCategory('Libur Mendadak / Insidental');
      setPriority('Penting');
      setTargetRole('Semua');
      showToast('Templat Libur Mendadak diterapkan dengan salam lengkap.', 'success');
    } else if (type === 'imunisasi_skrining') {
      setTitle('Himbauan & Pemberitahuan: Pelaksanaan Skrining Kesehatan & Imunisasi Berkala Siswa');
      setContent(
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSalam sejahtera bagi kita semua.\n\nYth. Bapak/Ibu Wali Murid,\n\nBekerja sama dengan UPTD Puskesmas setempat, pihak sekolah akan menyelenggarakan kegiatan Skrining Kesehatan Berkala dan Imunisasi (Bulan Imunisasi Anak Sekolah / BIAS) untuk peserta didik yang dijadwalkan pada:\n\n• Hari/Tanggal: [Hari, Tanggal]\n• Waktu: Pukul 08.00 WIB sampai dengan selesai\n• Tempat: Ruang UKS / Ruang Kelas Masing-masing\n• Rincian Kegiatan: Pemeriksaan kesehatan gigi dan mulut, pemeriksaan penglihatan, pengukuran tumbuh kembang (tinggi badan & berat badan), serta pemberian imunisasi berkala.\n\nHimbauan penting bagi Bapak/Ibu Wali Murid:\n1. Pastikan ananda sudah sarapan bergizi dari rumah sebelum berangkat ke sekolah.\n2. Pastikan ananda dalam kondisi sehat, bugar, dan cukup istirahat.\n3. Apabila ananda memiliki riwayat alergi khusus atau sedang dalam pengobatan, mohon menginformasikannya terlebih dahulu kepada wali kelas.\n\nMari bersama mendukung kesehatan dan tumbuh kembang anak-anak kita tercinta.\n\nDemikian himbauan dan pemberitahuan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu sekalian, kami ucapkan terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nHormat kami,\nTim UKS & ${signer}`
      );
      setCategory('Himbauan Imunisasi & Skrining');
      setPriority('Normal');
      setTargetRole('Wali Murid');
      showToast('Templat Himbauan Imunisasi diterapkan dengan salam lengkap.', 'success');
    } else if (type === 'himbauan_umum') {
      setTitle('Himbauan Umum: Ketertiban Lingkungan Sekolah & Kewaspadaan Cuaca');
      setContent(
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSalam sejahtera bagi kita semua.\n\nYth. Seluruh Warga Sekolah & Bapak/Ibu Wali Murid,\n\nDalam rangka menciptakan suasana sekolah yang senantiasa tertib, sehat, aman, dan kondusif, kami menyampaikan beberapa himbauan umum sebagai berikut:\n\n1. Kewaspadaan Cuaca: Mengingat kondisi cuaca yang sering turun hujan, dimohon membekali ananda dengan payung atau jas hujan saat berangkat ke sekolah.\n2. Ketertiban Antar-Jemput: Demi keamanan dan kelancaran bersama, dimohon para penjemput tidak memarkir kendaraan di badan jalan depan gerbang utama sekolah.\n3. Kebersihan & Jajanan Sehat: Mengingatkan ananda untuk selalu mencuci tangan dengan sabun dan membiasakan membawa bekal makanan serta botol minum yang higienis dari rumah.\n\nDemikian himbauan ini kami sampaikan. Atas kepedulian dan kerja sama seluruh keluarga besar sekolah, kami ucapkan terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nHormat kami,\n${signer}`
      );
      setCategory('Himbauan & Ketertiban Umum');
      setPriority('Normal');
      setTargetRole('Semua');
      showToast('Templat Himbauan Umum diterapkan dengan salam lengkap.', 'success');
    } else if (type === 'pts') {
      setTitle(`Pemberitahuan Pelaksanaan Penilaian Tengah Semester (PTS) ${defaultClass}`);
      setContent(
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSalam sejahtera bagi kita semua.\n\nYth. Bapak/Ibu Wali Murid ${defaultClass},\n\nDengan ini kami menginformasikan bahwa Penilaian Tengah Semester (PTS) untuk ${defaultClass} akan dilaksanakan mulai pekan depan. Mohon bimbingan, pendampingan, dan doa di rumah agar peserta didik dapat belajar dengan optimal, percaya diri, serta senantiasa menjaga kesehatan.\n\nJadwal mata pelajaran dan kisi-kisi telah diunggah di sistem CERDAS sekolah.\n\nDemikian pemberitahuan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu sekalian, kami ucapkan terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nHormat kami,\n${signer}`
      );
      setCategory('Akademik & Ujian');
      setPriority('Penting');
      setTargetRole('Wali Murid');
      showToast('Templat PTS diterapkan dengan salam lengkap.', 'success');
    } else if (type === 'libur') {
      setTitle('Pemberitahuan Hari Libur Nasional & Kegiatan Belajar Mandiri');
      setContent(
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSalam sejahtera bagi kita semua.\n\nYth. Bapak/Ibu Guru dan Wali Murid,\n\nSehubungan dengan ketetapan Hari Libur Nasional, kegiatan pembelajaran tatap muka di sekolah ditiadakan pada tanggal tersebut. Peserta didik diharapkan memanfaatkan waktu luang untuk membaca materi literasi mandiri di rumah dan berkegiatan positif bersama keluarga.\n\nKegiatan pembelajaran tatap muka akan aktif kembali seperti biasa pada hari berikutnya.\n\nDemikian pemberitahuan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu sekalian, kami ucapkan terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nHormat kami,\n${signer}`
      );
      setCategory('Libur Sekolah');
      setPriority('Normal');
      setTargetRole('Semua');
      showToast('Templat Libur Sekolah diterapkan dengan salam lengkap.', 'success');
    } else if (type === 'paguyuban') {
      setTitle(`Undangan Pertemuan Paguyuban Orang Tua / Wali Murid ${defaultClass}`);
      setContent(
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSalam sejahtera bagi kita semua.\n\nYth. Bapak/Ibu Wali Murid ${defaultClass},\n\nKami mengundang Bapak/Ibu untuk hadir dalam kegiatan Silaturahmi dan Pertemuan Paguyuban Wali Murid guna mempererat tali silaturahmi serta membahas program belajar dan perkembangan ananda di sekolah:\n\n• Hari/Tanggal: Sabtu pekan ini\n• Waktu: Pukul 08.30 sampai dengan 10.30 WIB\n• Tempat: Ruang Kelas ${defaultClass}\n\nKehadiran dan masukan berharga dari Bapak/Ibu sangat berarti bagi kemajuan belajar ananda.\n\nDemikian undangan ini kami sampaikan. Atas perhatian dan kehadiran Bapak/Ibu sekalian, kami ucapkan terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nHormat kami,\n${signer}`
      );
      setCategory('Informasi Wali Murid');
      setPriority('Normal');
      setTargetRole('Wali Murid');
      showToast('Templat Paguyuban diterapkan dengan salam lengkap.', 'success');
    } else if (type === 'tugas') {
      setTitle(`Pengingat Pengumpulan Tugas Proyek Belajar Siswa (${defaultClass})`);
      setContent(
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSalam sejahtera bagi kita semua.\n\nYth. Bapak/Ibu Wali Murid ${defaultClass},\n\nKami mengingatkan kembali perihal penyelesaian tugas proyek tematik siswa untuk ${defaultClass}. Batas akhir pengumpulan hasil karya adalah pada hari Jumat pekan ini.\n\nMohon dukungan dan pendampingan Bapak/Ibu untuk memeriksa kelengkapan buku tugas dan lembar kerja ananda sebelum dibawa ke sekolah.\n\nDemikian pengingat ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu sekalian, kami ucapkan terima kasih.\n\nWassalamu'alaikum Warahmatullahi Wabarakatuh.\n\nHormat kami,\n${signer}`
      );
      setCategory('Akademik & Ujian');
      setPriority('Normal');
      setTargetRole('Wali Murid');
      showToast('Templat Tugas Proyek diterapkan dengan salam lengkap.', 'success');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showToast('Judul dan isi pengumuman wajib diisi!', 'error');
      return;
    }

    setSaving(true);
    try {
      const authorRole = isAdmin ? 'Admin' : isGuru ? 'Guru' : 'Staf Sekolah';
      const authorName =
        userData?.name || (isAdmin ? 'Admin Sekolah' : `Guru ${userData?.assigned_class || ''}`);

      const docRef = await addDoc(collection(db, 'announcements'), {
        title: title.trim(),
        content: content.trim(),
        authorName,
        authorRole,
        authorId: userData?.uid || '',
        authorClass: userData?.assigned_class || '',
        targetClass,
        targetRole,
        category,
        priority,
        date: serverTimestamp(),
        createdAt: new Date().toISOString()
      });

      // Siarkan Push Notification ke seluruh HP wali murid & guru (Median APK & Web Push)
      try {
        await fetch('/api/send-push-announcement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: docRef.id,
            title: title.trim(),
            content: content.trim(),
            targetClass,
            targetRole,
            authorName,
            category,
            priority
          })
        });
      } catch (pushErr) {
        console.warn('Push announcement broadcast notice:', pushErr);
      }

      showToast('Pemberitahuan berhasil diterbitkan & disiarkan ke HP wali murid!', 'success');
      setIsModalOpen(false);
      setTitle('');
      setContent('');
    } catch (error: any) {
      console.error(error);
      showToast('Gagal menerbitkan pengumuman: ' + (error.message || 'Kesalahan sistem'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'announcements', announcementToDelete.id));
      showToast('Pengumuman berhasil dihapus dari sistem.', 'success');
      setAnnouncementToDelete(null);
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      showToast('Gagal menghapus pengumuman: ' + (error.message || 'Terjadi kesalahan sistem'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter announcements
  const filteredAnnouncements = announcements.filter((ann) => {
    const matchClass = selectedFilterClass === 'Semua' || ann.targetClass === selectedFilterClass || ann.targetClass === 'Semua Kelas';
    const matchCategory = selectedFilterCategory === 'Semua' || ann.category === selectedFilterCategory;
    return matchClass && matchCategory;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-indigo-200 mb-2">
            <Megaphone className="w-3.5 h-3.5 text-amber-300" />
            <span>Pusat Siaran & Notifikasi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Manajemen Pengumuman</h1>
          <p className="text-xs sm:text-sm text-indigo-100 max-w-xl mt-1 leading-relaxed">
            Terbitkan informasi dan pemberitahuan resmi dari Admin atau Guru secara langsung ke
            dashboard Wali Murid dengan notifikasi otomatis ke perangkat HP.
          </p>
        </div>

        <div className="relative z-10 shrink-0">
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 px-5 py-3 rounded-2xl transition-all font-bold text-sm shadow-lg shadow-amber-900/30 hover:scale-102 active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Buat Pengumuman Baru</span>
          </button>
        </div>
      </div>

      {/* Filter and stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Sasaran Kelas:</span>
            <select
              value={selectedFilterClass}
              onChange={(e) => setSelectedFilterClass(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Semua">Semua Sasaran</option>
              <option value="Semua Kelas">📢 Semua Kelas (SD & MTs)</option>
              <optgroup label="🏫 Tingkat SD / MI (Kelas 1 - 6)">
                {SD_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls} (SD)
                  </option>
                ))}
              </optgroup>
              <optgroup label="🕌 Tingkat MTs / SMP (Kelas 7 - 9)">
                {MTS_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls} (MTs)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Kategori:</span>
            <select
              value={selectedFilterCategory}
              onChange={(e) => setSelectedFilterCategory(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Semua">Semua Kategori</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Menampilkan <span className="font-bold text-indigo-600 dark:text-indigo-400">{filteredAnnouncements.length}</span> dari {announcements.length} pengumuman
        </div>
      </div>

      {/* Info Tip about Deleting and Clean Archive */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl text-xs text-indigo-900 dark:text-indigo-200">
        <span className="text-base">🗑️</span>
        <p>
          <b>Fitur Hapus Aktif:</b> Untuk menjaga kerapian informasi, Anda dapat menghapus pengumuman yang salah ketik atau yang masa kegiatannya sudah berlalu kapan saja menggunakan tombol <b>Hapus</b> berwarna merah pada kartu pengumuman.
        </p>
      </div>

      {/* Announcements List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center text-slate-500 border border-slate-200/80 dark:border-slate-800">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold">Memuat daftar pengumuman...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-slate-500 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-500 mb-3">
              <Megaphone className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Belum Ada Pengumuman</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
              Klik tombol "Buat Pengumuman Baru" untuk menerbitkan pemberitahuan kepada Wali Murid.
            </p>
          </div>
        ) : (
          filteredAnnouncements.map((ann) => {
            const isUrgent = ann.priority === 'Penting' || ann.priority === 'Tinggi (Penting)';
            const isGuruAuthor = ann.authorRole === 'Guru';
            const catBadge = getCategoryBadgeStyle(ann.category);

            return (
              <div
                key={ann.id}
                className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 hover:shadow-md transition-all group relative overflow-hidden"
              >
                {isUrgent && (
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-rose-500" />
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div
                      className={`p-3 rounded-2xl shrink-0 ${
                        isUrgent
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      {ann.category?.toLowerCase().includes('pulang') ? (
                        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      ) : ann.category?.toLowerCase().includes('libur mendadak') || ann.category?.toLowerCase().includes('insidental') ? (
                        <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      ) : ann.category?.toLowerCase().includes('imunisasi') || ann.category?.toLowerCase().includes('skrining') ? (
                        <HeartPulse className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      ) : (
                        <Bell className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {/* Author Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isGuruAuthor
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                          }`}
                        >
                          Pengirim: {ann.authorName || (isGuruAuthor ? 'Guru Kelas' : 'Admin')}
                        </span>

                        {/* Priority Badge */}
                        {isUrgent && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Penting / Mendesak
                          </span>
                        )}

                        {/* Target Class Badge */}
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          Sasaran: {formatClassBadge(ann.targetClass)}
                        </span>

                        {/* Category */}
                        {ann.category && (
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${catBadge.bg}`}>
                            <span>{catBadge.icon}</span>
                            <span>{ann.category}</span>
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {ann.title}
                      </h3>

                      {/* Timestamp */}
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-3 mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {ann.date?.toDate
                          ? format(ann.date.toDate(), 'EEEE, dd MMMM yyyy - HH:mm', {
                              locale: id
                            }) + ' WIB'
                          : 'Baru saja'}
                      </p>

                      {/* Content */}
                      <div className="text-sm text-slate-700 dark:text-slate-200 bg-slate-50/80 dark:bg-slate-800/60 p-4 rounded-xl leading-relaxed whitespace-pre-wrap border border-slate-100 dark:border-slate-800">
                        {ann.content}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {(isAdmin || isGuru || userData?.role !== 'Wali Murid') && (
                      <button
                        type="button"
                        onClick={() => setAnnouncementToDelete(ann)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 transition-all cursor-pointer hover:shadow-2xs active:scale-95"
                        title="Hapus pengumuman ini (yang salah atau sudah berlalu)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Konfirmasi Hapus Pengumuman */}
      {announcementToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Hapus Pengumuman?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Untuk pengumuman yang salah atau sudah berlalu
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl p-3.5 mb-4 border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <p className="font-bold text-slate-800 dark:text-slate-200 mb-1 leading-snug">
                {announcementToDelete.title}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Sasaran: {formatClassBadge(announcementToDelete.targetClass)}</span>
                <span>•</span>
                <span>Kategori: {announcementToDelete.category || 'Pengumuman Umum'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              Apakah Anda yakin ingin menghapus pengumuman ini secara permanen? Pengumuman yang sudah dihapus tidak akan lagi muncul di dashboard aplikasi Wali Murid maupun Guru.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setAnnouncementToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteAnnouncement}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Pengumuman'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form for Composing Announcement */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Megaphone className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Terbitkan Pemberitahuan Baru</h2>
                  <p className="text-xs text-indigo-200">
                    Pemberitahuan otomatis disiarkan ke akun Wali Murid
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Templates */}
            <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100/60 dark:border-indigo-900/40">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Pilih Templat Cepat (Otomatis Isi Judul, Format, & Prioritas):</span>
              </div>
              
              {/* Grup 1: Pengumuman Bersifat Umum & Insidental */}
              <div className="mb-2.5">
                <div className="text-[10px] font-bold text-indigo-900/70 dark:text-indigo-300/70 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span>📢</span>
                  <span>Pengumuman Umum, Mendadak & Himbauan:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyTemplate('pulang_mendadak')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/80 transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>🚨</span>
                    <span>Pulang Lebih Awal / Mendadak</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('libur_mendadak')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/80 transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>🛑</span>
                    <span>Libur Mendadak / Insidental</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('imunisasi_skrining')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/80 transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>🩺</span>
                    <span>Himbauan Imunisasi & Skrining (BIAS)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('himbauan_umum')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-sky-50 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/80 transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>📣</span>
                    <span>Himbauan Umum & Ketertiban</span>
                  </button>
                </div>
              </div>

              {/* Grup 2: Pengumuman Akademik & Sekolah */}
              <div>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span>📚</span>
                  <span>Agenda Rutin & Akademik:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyTemplate('pts')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors"
                  >
                    📝 Ujian / PTS
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('paguyuban')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors"
                  >
                    🤝 Pertemuan Wali Murid
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('libur')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors"
                  >
                    🏖️ Libur Sekolah
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('tugas')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors"
                  >
                    📌 Pengingat Tugas Proyek
                  </button>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Judul Pengumuman / Pemberitahuan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold text-slate-800 dark:text-white"
                  placeholder="Misal: Pelaksanaan PTS & Pertemuan Wali Murid"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Target Class */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sasaran Kelas
                  </label>
                  <select
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Semua Kelas">📢 Semua Kelas (Kelas 1 SD s.d. Kelas 9 MTs)</option>
                    <optgroup label="🏫 Tingkat SD / MI (Kelas 1 - 6)">
                      {SD_CLASSES.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls} (SD)
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🕌 Tingkat MTs / SMP (Kelas 7 - 9)">
                      {MTS_CLASSES.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls} (MTs)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Target Role */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sasaran Pengguna
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Semua">Semua (Guru & Wali)</option>
                    <option value="Wali Murid">Khusus Wali Murid</option>
                    <option value="Guru">Khusus Guru</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tingkat Prioritas
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${
                      priority === 'Penting'
                        ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white'
                    }`}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Penting">🚨 Penting / Mendesak</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori Pengumuman
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        category === cat
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Isi Pemberitahuan / Pengumuman <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={insertFullSalam}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline cursor-pointer"
                  >
                    <span>✨</span>
                    <span>Sisipkan Salam Pembuka & Penutup Lengkap</span>
                  </button>
                </div>

                <div className="mb-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <span className="shrink-0 text-sm">💡</span>
                  <span>
                    <b>Standar Pesan:</b> Diawali dengan salam pembuka lengkap (<i>Assalamu'alaikum Warahmatullahi Wabarakatuh</i>) dan diakhiri salam penutup lengkap (<i>Wassalamu'alaikum Warahmatullahi Wabarakatuh</i>) tanpa singkatan.
                  </span>
                </div>

                <textarea
                  required
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-normal text-slate-800 dark:text-white leading-relaxed placeholder:text-slate-400 font-sans"
                  placeholder="Tuliskan isi informasi secara rinci untuk orang tua / guru..."
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-400">
                  Pengirim: <b>{userData?.name || (isAdmin ? 'Admin' : 'Guru')}</b>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-xs transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-all font-bold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{saving ? 'Menyimpan & Menyiarkan...' : 'Terbitkan Sekarang'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div
            className={`flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl text-white ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
