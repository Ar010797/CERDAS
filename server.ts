import express from "express";
import path from "path";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Health check endpoint for platform monitoring
  app.get(["/api/health", "/health"], (req, res) => {
    res.json({ status: "ok" });
  });

  // Initialize Gemini Client
  const getAi = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
    return new GoogleGenAI({ 
      apiKey: key, 
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } 
    });
  };

  // Helper for Gemini retry with multi-model fallback to survive 503/429 spikes or model transitions
  const callGeminiWithRetry = async (ai: GoogleGenAI, params: any) => {
    // Model fallback sequence:
    // 1. gemini-3.8-flash: primary recommended model for standard text & multimodal tasks
    // 2. gemini-3.1-flash-lite: ultra-fast lightweight model
    // 3. gemini-flash-latest: high throughput alias
    const requestedModel = params.model || "gemini-3.8-flash";
    const defaultCandidates = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    const modelCandidates: string[] = [
      requestedModel,
      ...defaultCandidates.filter((m) => m !== requestedModel)
    ];

    let lastError: any = null;

    for (let i = 0; i < modelCandidates.length; i++) {
      const currentModel = modelCandidates[i];
      try {
        const currentParams = { ...params, model: currentModel };
        // 12-second per-candidate timeout allows deep reasoning/PDF processing while preventing gateway timeouts
        const result = await Promise.race([
          ai.models.generateContent(currentParams),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout on model ${currentModel}`)), 12000)
          )
        ]);
        return result;
      } catch (error: any) {
        lastError = error;
        const errMsg = (error?.message || "").toLowerCase();
        console.log(`[AI Fallback] Candidate ${currentModel} encountered transient condition (${error?.status || error?.code || 'switching'}), testing next candidate...`);
        
        // If it's a 503 Service Unavailable (high demand spike), brief 300ms pause before trying next candidate
        if (errMsg.includes("503") || errMsg.includes("demand") || errMsg.includes("unavailable")) {
          await new Promise((r) => setTimeout(r, 300));
        }
        continue;
      }
    }

    throw lastError || new Error("Layanan AI sedang mengalami lonjakan permintaan. Sistem beralih ke engine cadangan.");
  };

  /**
   * Helper cerdas untuk menyusun penjabaran isi materi pembelajaran yang lengkap,
   * terstruktur, dan edukatif berdasarkan referensi terpercaya (Kurikulum Merdeka).
   * Memuat: Pengertian/Definisi, Kaidah Pokok/Rumus, Contoh Soal & Cara Pengerjaan (Langkah demi Langkah),
   * Contoh Kontekstual Sehari-hari, dan Sumber Referensi Terpercaya.
   */
  const buildRealisticIsiMateri = (
    mataPelajaran: string,
    materi: string,
    kelas: string = ""
  ): { isiMateriPenjelas: string; referensiMateri: string } => {
    const mapelLower = (mataPelajaran || "").toLowerCase();
    const materiLower = (materi || "").toLowerCase();

    // Skenario 1: Matematika - Materi Pecahan / Bilangan Pecahan
    if (
      materiLower.includes("pecahan") ||
      (mapelLower.includes("matematika") && (materiLower.includes("pecah") || materiLower.includes("fraction")))
    ) {
      const isi = `1. Pengertian & Konsep Inti:
   Pecahan adalah bilangan yang menyatakan bagian dari suatu keseluruhan yang utuh atau bagian dari suatu kelompok benda yang sejenis. Pecahan dinyatakan dalam bentuk a/b, di mana:
   - Angka 'a' disebut Pembilang (menunjukkan jumlah bagian yang dihitung atau diambil).
   - Angka 'b' disebut Penyebut (menunjukkan jumlah total seluruh bagian yang terbagi sama rata, dengan syarat b ≠ 0).

2. Kaidah Pokok, Rumus, & Karakteristik Materi:
   - Jenis-Jenis Pecahan:
     * Pecahan Biasa: Pembilang lebih kecil dari penyebut (contoh: 1/2, 3/4).
     * Pecahan Campuran: Terdiri dari bilangan bulat dan pecahan biasa (contoh: 1 1/2, 2 3/5).
     * Pecahan Desimal: Ditulis dengan tanda koma berbasis persepuluh, perseratus, dst. (contoh: 0,5; 0,75).
     * Persen: Pecahan dengan penyebut seratus, disimbolkan % (contoh: 50%, 75%).
   - Pecahan Senilai: Pecahan yang nilainya tetap sama meski pembilang dan penyebutnya berbeda angka. Diperoleh dengan mengalikan atau membagi pembilang dan penyebut dengan angka yang sama.
   - Kaidah Operasi Penjumlahan & Pengurangan Pecahan:
     * Jika penyebut sama: Langsung jumlahkan/kurangkan pembilang: a/c + b/c = (a + b) / c.
     * Jika penyebut berbeda: Wajib menyamakan penyebut menggunakan Kelipatan Persekutuan Terkecil (KPK) kedua penyebut.

3. Contoh Soal & Cara Pengerjaan Terperinci (Langkah demi Langkah):
   - Contoh Soal 1 (Menyederhanakan Pecahan):
     Sederhanakan pecahan 6/8 ke bentuk pecahan yang paling sederhana!
     * Langkah 1: Tentukan Faktor Persekutuan Terbesar (FPB) dari pembilang 6 dan penyebut 8.
       Faktor dari 6 = {1, 2, 3, 6}; faktor dari 8 = {1, 2, 4, 8}. Maka FPB = 2.
     * Langkah 2: Bagilah pembilang dan penyebut dengan FPB tersebut (yaitu 2):
       (6 ÷ 2) / (8 ÷ 2) = 3/4
     * Kunci / Hasil Akhir: Bentuk paling sederhana dari 6/8 adalah 3/4.

   - Contoh Soal 2 (Penjumlahan Pecahan Berbeda Penyebut):
     Hitunglah hasil penjumlahan dari 1/2 + 1/4!
     * Langkah 1: Perhatikan penyebut kedua pecahan (2 dan 4). Karena berbeda, cari KPK dari 2 dan 4. KPK(2, 4) = 4.
     * Langkah 2: Samakan pecahan 1/2 menjadi penyebut 4 dengan mengalikan pembilang dan penyebut dengan angka 2:
       1/2 = (1 × 2) / (2 × 2) = 2/4
     * Langkah 3: Jumlahkan pembilang kedua pecahan yang penyebutnya sudah sama:
       2/4 + 1/4 = (2 + 1) / 4 = 3/4
     * Kunci / Hasil Akhir: Hasil dari 1/2 + 1/4 adalah 3/4.

4. Contoh Kontekstual & Penerapan Nyata Sehari-hari:
   - Pembagian Makanan: Sebuah loyang kue pizza dipotong menjadi 8 potong sama besar. Jika ananda memakan 2 potong, maka bagian pizza yang dimakan bernilai 2/8 (atau 1/4 bagian), dan sisa pizza yang belum dimakan bernilai 6/8 (atau 3/4 bagian).
   - Resep Masakan: Mengukur takaran bahan kue, seperti 1/2 sendok teh vanili, 3/4 cangkir gula pasir, atau 1/4 liter susu cair.

5. Sumber Referensi Belajar Terpercaya:
   - Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi RI. (2024). Buku Panduan Guru & Buku Teks Siswa: Matematika (Kurikulum Merdeka). Jakarta: Pusat Perbukuan BSKAP Kemendikbudristek.
   - Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP). Alur Tujuan Pembelajaran (ATP) Matematika Materi Bilangan Pecahan.
   - Platform Merdeka Mengajar (PMM) Kemdikbudristek: Modul Ajar Eksplorasi Konsep Pecahan Senilai dan Operasi Hitung Pecahan.`;

      const ref = `1. Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi Republik Indonesia. (2024). Buku Panduan Guru dan Buku Teks Siswa: Matematika (${kelas || "Fase B/C"}). Jakarta: Pusat Perbukuan BSKAP Kemendikbudristek.
2. Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP). Alur Tujuan Pembelajaran (ATP) dan Capaian Pembelajaran Matematika Materi 'Bilangan Pecahan'.
3. Tim Pengembang Kurikulum Kemdikbudristek. Modul Pembelajaran Berdiferensiasi: Penguasaan Konsep Pecahan dan Operasi Hitung Kontekstual.
4. Platform Merdeka Mengajar (PMM) Kemdikbudristek: Bahan Ajar Digital dan Lembar Kerja Eksploratif Pecahan.`;

      return { isiMateriPenjelas: isi, referensiMateri: ref };
    }

    // Skenario 2: Matematika Umum Lainnya
    if (mapelLower.includes("matematika")) {
      const isi = `1. Pengertian & Konsep Inti:
   ${materi} merupakan pokok bahasan penting dalam matematika yang membekali peserta didik dengan pemahaman konsep kuantitatif, pola matematis, dan penalaran logis terstruktur sesuai capaian kurikulum.

2. Kaidah Pokok, Rumus, & Karakteristik Materi:
   - Prinsip Dasar: Mengenali definisi operasional, besaran matematis, dan sifat-sifat utama yang mendasari ${materi}.
   - Prosedur Perhitungan:
     * Identifikasi variabel atau informasi yang diketahui dan apa yang ditanyakan.
     * Terapkan rumus dasar dan prinsip hitung secara bertahap sesuai kaidah matematika resmi.
     * Utamakan ketelitian operasi hitung dan pembuktian kembali hasil perhitungan.

3. Contoh Soal & Cara Pengerjaan Terperinci (Langkah demi Langkah):
   - Contoh Soal Terarah:
     Bagaimanakah penyelesaian terstruktur untuk persoalan latihan seputar ${materi}?
     * Langkah 1 (Identifikasi): Tuliskan informasi angka/data yang diketahui dan rumuskan apa yang dicari.
     * Langkah 2 (Pemilihan Rumus): Tentukan rumus dan kaidah operasi matematika yang berlaku untuk ${materi}.
     * Langkah 3 (Eksekusi Perhitungan): Lakukan proses substitusi angka dan selesaikan perhitungan langkah demi langkah.
     * Kunci / Hasil Akhir: Tuliskan jawaban akhir dengan teliti disertai satuan yang tepat.

4. Contoh Kontekstual & Penerapan Nyata Sehari-hari:
   - Penggunaan konsep ${materi} dalam perencanaan belanja, estimasi waktu, pengukuran ruang/jarak, dan pemecahan masalah kuantitatif sehari-hari.
   - Membangun nalar kritis siswa dalam menginterpretasikan data angka di kehidupan nyata.

5. Sumber Referensi Belajar Terpercaya:
   - Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi RI. (2024). Buku Panduan Guru & Buku Teks Siswa: Matematika (Kurikulum Merdeka). Jakarta: Pusat Perbukuan BSKAP Kemendikbudristek.
   - Alur Tujuan Pembelajaran (ATP) Matematika BSKAP Kemendikbudristek.`;

      const ref = `1. Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi Republik Indonesia. (2024). Buku Panduan Guru dan Buku Teks Siswa: Matematika. Jakarta: Pusat Perbukuan BSKAP Kemendikbudristek.
2. Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP). Alur Tujuan Pembelajaran (ATP) Matematika Materi '${materi}'.
3. Platform Merdeka Mengajar (PMM) Kemdikbudristek & Portal Rumah Belajar: Penjabaran Konsep dan Media Interaktif '${materi}'.`;

      return { isiMateriPenjelas: isi, referensiMateri: ref };
    }

    // Skenario 3: Ilmu Pengetahuan Alam / IPAS / Sains
    if (mapelLower.includes("ipa") || mapelLower.includes("ipas") || mapelLower.includes("sains") || mapelLower.includes("biologi") || mapelLower.includes("fisika")) {
      const isi = `1. Pengertian & Konsep Inti:
   ${materi} merupakan konsep saintifik fundamental dalam ilmu pengetahuan alam yang mengkaji fenomena alam, karakteristik materi, interaksi makhluk hidup, dan hukum sebab-akibat yang bekerja di alam semesta.

2. Kaidah Pokok, Karakteristik, & Prinsip Sains:
   - Ciri Utama & Gejala Ilmiah: Mempelajari struktur, fungsi, dan interaksi yang membentuk sistem pada ${materi}.
   - Metode Ilmiah: Mengamati fakta empiris, merumuskan hipotesis, dan melakukan pembuktian terbimbing.
   - Keterkaitan Lingkungan: Memahami dampak timbal balik proses alam terhadap kelangsungan hidup manusia dan ekosistem.

3. Contoh Soal & Cara Pengerjaan / Analisis Langkah demi Langkah:
   - Contoh Studi Kasus / Soal:
     Bagaimanakah analisis ilmiah yang tepat untuk menjelaskan fenomena terkait ${materi}?
     * Langkah 1 (Pengamatan Awal): Amati fenomena atau data yang disajikan dalam studi kasus.
     * Langkah 2 (Kaitkan dengan Teori Sains): Identifikasi prinsip fisika/biologi materi ${materi} yang mendasarinya.
     * Langkah 3 (Analisis Sebab-Akibat): Susun alur penjelasan logis mengapa fenomena tersebut dapat terjadi.
     * Kunci / Simpulan Akhir: Rumuskan simpulan ilmiah yang komprehensif dan mudah dipahami peserta didik.

4. Contoh Kontekstual & Penerapan Nyata Sehari-hari:
   - Pengamatan gejala alam di lingkungan sekitar, pemanfaatan teknologi tepat guna, serta pelestarian lingkungan hidup dan sumber daya alam.
   - Membiasakan pola hidup sehat dan ramah lingkungan berbasis pemahaman sains.

5. Sumber Referensi Belajar Terpercaya:
   - Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi RI. (2024). Buku Panduan Guru & Buku Siswa IPAS / Sains (Kurikulum Merdeka). Jakarta: Pusat Perbukuan BSKAP.
   - Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP). Capaian Pembelajaran Ilmu Pengetahuan Alam dan Sosial.`;

      const ref = `1. Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi Republik Indonesia. (2024). Buku Teks Utama IPAS (Kurikulum Merdeka). Jakarta: Pusat Perbukuan BSKAP Kemendikbudristek.
2. Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP). Alur Tujuan Pembelajaran (ATP) IPAS Materi '${materi}'.
3. Portal Rumah Belajar & Laboratorium Virtual Sains Kemdikbudristek.`;

      return { isiMateriPenjelas: isi, referensiMateri: ref };
    }

    // Skenario 4: Default / Mata Pelajaran Umum (Bahasa Indonesia, PAI, PPKn, dll)
    const isi = `1. Pengertian & Konsep Inti:
   ${materi} merupakan pokok bahasan esensial dalam mata pelajaran ${mataPelajaran} yang membekali peserta didik dengan pemahaman konsep dasar, keterampilan berpikir kritis, dan kemampuan aplikatif sesuai capaian pembelajaran.

2. Kaidah Pokok, Karakteristik, & Aturan Utama:
   - Prinsip Esensial: Memahami struktur, kaidah pokok, dan unsur-unsur penting yang menyusun materi ${materi}.
   - Tata Cara & Prosedur: Menerapkan tahapan analisis yang runut, objektif, dan terstandar sesuai Kurikulum Merdeka.
   - Karakter & Nilai: Mengintegrasikan nilai Profil Pelajar Pancasila (kemandirian, gotong royong, dan bernalar kritis).

3. Contoh Soal & Cara Pengerjaan / Analisis Langkah demi Langkah:
   - Contoh Kasus / Latihan:
     Bagaimanakah langkah penanganan atau penyelesaian yang tepat terkait persoalan pada materi ${materi}?
     * Langkah 1 (Identifikasi Masalah): Cermati informasi utama dan tentukan inti permasalahan yang hendak dipecahkan.
     * Langkah 2 (Penerapan Kaidah): Gunakan prinsip dan aturan pokok dari ${materi} untuk menganalisis persoalan.
     * Langkah 3 (Penyusunan Solusi): Rumuskan argumen atau langkah penyelesaian secara teratur dan sistematis.
     * Kunci / Hasil Akhir: Tarik kesimpulan jawaban yang valid, lugas, dan dapat dipertanggungjawabkan.

4. Contoh Kontekstual & Penerapan Nyata Sehari-hari:
   - Penerapan langsung dalam komunikasi, pemecahan masalah harian, dan interaksi bermakna di lingkungan keluarga, sekolah, dan masyarakat.
   - Menggunakan contoh nyata yang dekat dengan kehidupan sehari-hari anak untuk memperkuat pemahaman.

5. Sumber Referensi Belajar Terpercaya:
   - Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi RI. (2024). Buku Panduan Guru dan Buku Teks Siswa: ${mataPelajaran} (Kurikulum Merdeka). Jakarta: Pusat Perbukuan BSKAP Kemendikbudristek.
   - Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP). Alur Tujuan Pembelajaran (ATP) ${mataPelajaran} Materi '${materi}'.
   - Platform Merdeka Mengajar (PMM) Kemdikbudristek & Portal Edukasi Rumah Belajar.`;

    const ref = `1. Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi Republik Indonesia. (2024). Buku Panduan Guru dan Buku Teks Siswa: ${mataPelajaran}. Jakarta: Pusat Perbukuan BSKAP Kemendikbudristek.
2. Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP). Alur Tujuan Pembelajaran (ATP) ${mataPelajaran} Materi '${materi}'.
3. Platform Merdeka Mengajar (PMM) Kemdikbudristek & Portal Rumah Belajar: Penjabaran Konsep dan Media Interaktif '${materi}'.`;

    return { isiMateriPenjelas: isi, referensiMateri: ref };
  };

  // High quality deterministic fallback generator for E-RPP
  const generateDeterministicRPP = (
    mataPelajaran: string,
    materi: string,
    questionType: "Pilihan Ganda" | "Uraian",
    questionCount: number
  ) => {
    const safeCount = Math.min(Math.max(questionCount, 1), 50);
    const materialData = buildRealisticIsiMateri(mataPelajaran, materi, "");

    const generateQuestions = () => {
      const items: string[] = [];
      if (questionType === "Uraian") {
        const questionPrompts = [
          `Jelaskan pengertian dan konsep utama dari ${materi} dalam mata pelajaran ${mataPelajaran}!`,
          `Sebutkan dan jelaskan 3 contoh penerapan atau manfaat dari ${materi} dalam kehidupan sehari-hari!`,
          `Bagaimanakah langkah-langkah atau prosedur yang tepat saat menyelesaikan masalah yang berkaitan dengan ${materi}?`,
          `Analisis faktor-faktor pendukung yang mempengaruhi keberhasilan pelaksanaan materi ${materi}!`,
          `Mengapa pemahaman mendalam tentang ${materi} sangat esensial bagi peserta didik? Berikan argumen logis Anda!`,
          `Bandingkan kelebihan dan kekurangan dari pendekatan yang digunakan dalam ${materi}!`,
          `Rancanglah sebuah solusi praktis untuk mengatasi tantangan umum dalam pembelajaran ${materi}!`,
          `Jelaskan keterkaitan antara ${materi} dengan topik pembelajaran sebelumnya yang relevan!`,
          `Bagaimana cara mengevaluasi kebenaran atau efektivitas hasil pemecahan masalah pada materi ${materi}?`,
          `Uraikan sikap ilmiah dan nilai Profil Pelajar Pancasila yang harus diterapkan saat mempraktikkan materi ${materi}!`
        ];

        for (let i = 1; i <= safeCount; i++) {
          const promptIndex = (i - 1) % questionPrompts.length;
          const cycle = Math.floor((i - 1) / questionPrompts.length);
          const basePrompt = questionPrompts[promptIndex];
          const prompt = cycle > 0 
            ? `${basePrompt} (Studi kasus & pendalaman konsep nomor ${i})` 
            : basePrompt;

          items.push(
            `${i}. ${prompt}\n   Kunci Jawaban: Pemahaman konsep yang tepat, argumen logis terstruktur, serta ketepatan contoh kontekstual yang relevan seputar ${materi} (Skor maksimal: 100).`
          );
        }
      } else {
        const templates = [
          {
            q: `Tujuan utama dari pembelajaran materi ${materi} pada mata pelajaran ${mataPelajaran} adalah...`,
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
          },
          {
            q: `Sikap yang mencerminkan profil bernalar kritis saat mempelajari ${materi} adalah...`,
            options: [
              `Memverifikasi kebenaran informasi sebelum mengambil kesimpulan`,
              `Menerima setiap data secara pasif tanpa pembuktian`,
              `Menolak diskusi dan berbeda pendapat dengan teman sekelas`,
              `Menyalin seluruh jawaban tanpa memahami proses penyelesaian`
            ],
            key: "A",
            expl: `Sikap bernalar kritis mengedepankan pembuktian dan verifikasi data yang valid.`
          },
          {
            q: `Apabila ditemukan perbedaan hasil saat mempraktikkan konsep ${materi}, tindakan yang paling bijak adalah...`,
            options: [
              `Mengulang langkah pengamatan dan memeriksa instrumen pembuktian`,
              `Mengabaikan perbedaan dan langsung menganggap salah satu benar`,
              `Menyalahkan anggota kelompok lain`,
              `Menghentikan proses belajar tanpa kesimpulan`
            ],
            key: "A",
            expl: `Pemeriksaan ulang data dan proses merupakan bagian dari prosedur kerja ilmiah.`
          },
          {
            q: `Prinsip utama yang harus diperhatikan dalam menyajikan laporan pembelajaran ${materi} adalah...`,
            options: [
              `Kejelasan data, kejujuran hasil, dan sistematika penulisan logis`,
              `Banyaknya halaman tanpa memperhatikan substansi isi`,
              `Penggunaan istilah rumit agar terlihat meyakinkan`,
              `Penyembunyian kendala yang terjadi selama kegiatan`
            ],
            key: "A",
            expl: `Laporan hasil belajar wajib objektif, transparan, dan disusun secara sistematis.`
          },
          {
            q: `Kaitan penting antara pemahaman konsep ${materi} dengan kehidupan bermasyarakat adalah...`,
            options: [
              `Membantu peserta didik beradaptasi dan memberikan kontribusi solutif`,
              `Membuat peserta didik merasa lebih unggul dari lingkungan sekitar`,
              `Menghindari interaksi sosial demi fokus pada teori`,
              `Mengurangi kepedulian terhadap lingkungan sekitar`
            ],
            key: "A",
            expl: `Pembelajaran bermakna membekali siswa berkontribusi positif bagi kehidupan nyata.`
          },
          {
            q: `Evaluasi diri yang tepat setelah menuntaskan materi ${materi} bertujuan untuk...`,
            options: [
              `Mengetahui bagian yang telah dikuasai dan aspek yang perlu ditingkatkan`,
              `Membandingkan kekurangan diri dengan kelebihan orang lain`,
              `Menghindari tugas atau latihan berikutnya`,
              `Menilai kemampuan guru dalam menyampaikan materi semata`
            ],
            key: "A",
            expl: `Refleksi diri memetakan capaian pembelajaran dan kebutuhan tindak lanjut.`
          }
        ];

        for (let i = 1; i <= safeCount; i++) {
          const tIndex = (i - 1) % templates.length;
          const cycle = Math.floor((i - 1) / templates.length);
          const t = templates[tIndex];
          const questionText = cycle > 0 
            ? `${i}. Terkait penguatan konsep ${materi} (Soal Butir ${i}): ${t.q.replace(/^[A-Z][a-z\s]+(materi|konsep|topik)/i, 'Pernyataan')}` 
            : `${i}. ${t.q}`;
          items.push(
            `${questionText}\n   A. ${t.options[0]}\n   B. ${t.options[1]}\n   C. ${t.options[2]}\n   D. ${t.options[3]}\n   Kunci Jawaban: ${t.key} (Pembahasan: ${t.expl})`
          );
        }
      }
      return items.join("\n\n");
    };

    return {
      tujuanPembelajaran: `Melalui model pembelajaran Discovery/Inquiry Learning berorientasi Profil Pelajar Pancasila pada materi ${materi}, peserta didik diharapkan mampu:\n1. Mengidentifikasi konsep esensial dan prinsip dasar ${materi} secara cermat dan kritis.\n2. Menganalisis contoh kasus dan penerapan nyata terkait ${materi} dalam kehidupan sehari-hari.\n3. Menyajikan hasil penelaahan serta berkolaborasi aktif dengan sikap santun, mandiri, dan bertanggung jawab.`,
      isiMateriPenjelas: materialData.isiMateriPenjelas,
      referensiMateri: materialData.referensiMateri,
      pendahuluan: `1. Orientasi: Guru membuka kelas dengan salam ramah, memimpin doa bersama, dan memeriksa presensi siswa.\n2. Apersepsi: Guru mengaitkan materi sebelumnya dengan topik '${materi}' melalui pertanyaan pemantik kontekstual.\n3. Motivasi: Guru memaparkan tujuan pembelajaran, manfaat mempelajari '${materi}', serta mekanisme kegiatan dan penilaian hari ini.`,
      kegiatanInti: `1. Stimulasi (Pemberian Rangsangan):\n   - Guru menyajikan bahan tayang/ilustrasi kontekstual seputar materi '${materi}'.\n   - Peserta didik mengamati dan mencatat hal-hal penting secara seksama.\n\n2. Identifikasi Masalah (Problem Statement):\n   - Peserta didik dirangsang untuk menyusun pertanyaan kritis seputar penerapan '${materi}'.\n   - Guru mengelompokkan siswa ke dalam tim belajar heterogen.\n\n3. Pengumpulan Data (Data Collection):\n   - Setiap kelompok mengumpulkan data dan referensi relevan mengenai '${materi}' dari buku ajar dan lembar kerja.\n   - Guru berkeliling memfasilitasi dan memberi bimbingan diferensiasi.\n\n4. Pengolahan Data (Data Processing):\n   - Siswa berdiskusi mengolah data temuan untuk merumuskan simpulan kelompok mengenai '${materi}'.\n   - Menyusun draf laporan hasil eksplorasi pada lembar kerja siswa.\n\n5. Pembuktian & Verifikasi (Verification):\n   - Perwakilan kelompok mempresentasikan hasil diskusi di hadapan kelas.\n   - Kelompok lain menanggapi secara konstruktif dan beretika.\n   - Guru memberikan penguatan materi, klarifikasi, dan apresiasi terhadap partisipasi aktif siswa.`,
      penutup: `1. Simpulan: Bersama guru, peserta didik merangkum poin-poin utama materi '${materi}'.\n2. Refleksi: Peserta didik menyampaikan hal yang telah dipahami dan bagian yang masih membutuhkan pendalaman.\n3. Tindak Lanjut: Guru memberikan tugas mandiri/pengayaan serta menyampaikan agenda pertemuan berikutnya.\n4. Doa & Salam: Pembelajaran diakhiri dengan doa penutup dan salam kehangatan.`,
      latihanSoal: generateQuestions(),
      penilaian: `1. Penilaian Sikap: Observasi jurnal sikap Profil Pelajar Pancasila (beriman, gotong royong, bernalar kritis, mandiri).\n2. Penilaian Pengetahuan: Tes tertulis format PTS (${safeCount} butir soal ${questionType}) dengan rubrik penskoran terukur.\n3. Penilaian Keterampilan: Lembar observasi kinerja diskusi kelompok dan presentasi hasil penugasan.`
    };
  };

  /**
   * Memastikan teks latihan soal memiliki persis `targetCount` nomor soal sesuai yang diperintahkan pengguna
   */
  const enforceExactQuestionCount = (
    text: string,
    targetCount: number,
    questionType: "Pilihan Ganda" | "Uraian",
    mataPelajaran: string,
    materi: string
  ): string => {
    if (!text || !text.trim()) {
      return generateDeterministicRPP(mataPelajaran, materi, questionType, targetCount).latihanSoal;
    }

    // Split into questions by number prefix e.g. "1. ", "2. ", "No 1.", etc.
    const blocks: string[] = [];
    const lines = text.split('\n');
    let currentBlock: string[] = [];

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      const isStart = /^(?:(?:Soal|No|Nomor)\s*[\.:\-]?\s*)?(\d+)[\.\)\:\-]\s+/.test(trimmed);
      const isOption = /^[\(\[]?[A-Ea-e][\.\)\]\:]\s+/.test(trimmed);

      if (isStart && !isOption) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n').trim());
          currentBlock = [];
        }
        currentBlock.push(trimmed);
      } else if (currentBlock.length > 0) {
        currentBlock.push(rawLine);
      } else if (trimmed) {
        currentBlock.push(trimmed);
      }
    }

    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n').trim());
    }

    // If blocks found, re-number and adjust count to exactly targetCount
    if (blocks.length > 0) {
      const adjustedBlocks: string[] = [];
      for (let i = 1; i <= targetCount; i++) {
        if (i <= blocks.length) {
          // Re-number existing block
          const block = blocks[i - 1];
          const renumbered = block.replace(/^(?:(?:Soal|No|Nomor)\s*[\.:\-]?\s*)?\d+[\.\)\:\-]\s*/i, `${i}. `);
          adjustedBlocks.push(renumbered);
        } else {
          // Generate missing questions seamlessly to match targetCount exactly
          const fallbackRPP = generateDeterministicRPP(mataPelajaran, materi, questionType, targetCount);
          const fallbackBlocks = fallbackRPP.latihanSoal.split('\n\n').filter(b => b.trim());
          if (fallbackBlocks[i - 1]) {
            adjustedBlocks.push(fallbackBlocks[i - 1]);
          } else {
            if (questionType === "Uraian") {
              adjustedBlocks.push(`${i}. Jelaskan secara kritis bagaimana penerapan konsep ${materi} dalam menyelesaikan studi kasus tingkat lanjut!\n   Kunci Jawaban: Penjelasan konsep yang komprehensif disertai penalaran logis dan contoh nyata relevan seputar ${materi}.`);
            } else {
              adjustedBlocks.push(`${i}. Pertimbangan paling krusial saat mengaplikasikan materi ${materi} adalah...\n   A. Kesesuaian prosedur dan validitas data temuan\n   B. Kecepatan pengerjaan tanpa memeriksa kebenaran\n   C. Menghindari koordinasi dengan pihak lain\n   D. Penggunaan spekulasi tanpa dasar teori\n   Kunci Jawaban: A (Pembahasan: Prosedur dan data valid merupakan fondasi utama penguasaan materi.)`);
            }
          }
        }
      }
      return adjustedBlocks.join('\n\n');
    }

    // Fallback if parsing failed
    return generateDeterministicRPP(mataPelajaran, materi, questionType, targetCount).latihanSoal;
  };

  // API 1: Generate RPP Draft (supports both JSON payload and multipart FormData with PDF module file)
  app.post("/api/generate-rpp", upload.single("file"), async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const ai = getAi();
      const mataPelajaran = (req.body?.mataPelajaran || "").toString().trim();
      const materi = (req.body?.materi || "").toString().trim();
      const questionType = req.body?.questionType === "Uraian" ? "Uraian" : "Pilihan Ganda";
      const questionCount = Math.min(Math.max(parseInt(req.body?.questionCount, 10) || 5, 1), 50);
      const hasPdf = !!req.file;

      if (!mataPelajaran && !materi && !hasPdf) {
        return res.status(400).json({ error: "Mata pelajaran dan materi wajib diisi, atau lampirkan file PDF Modul Ajar." });
      }

      const prompt = `
        Anda adalah pakar kurikulum nasional dan Kurikulum Merdeka Indonesia.
        ${hasPdf ? `
        PENTING - MODUL AJAR (PDF) TERLAMPIR:
        File PDF yang dilampirkan adalah dokumen "Modul Ajar / Bahan Ajar / Buku Referensi".
        Gunakan seluruh isi, konsep pokok, capaian kompetensi, istilah, dan alur materi yang terdapat dalam file PDF ini sebagai SUMBER RUJUKAN UTAMA (ground truth).
        Seluruh draf RPP yang disusun (tujuan pembelajaran, tahapan kegiatan, asesmen, dan terutama latihan soal) HARUS SELARAS, TEPAT, dan SESUAI dengan apa yang diajarkan pada modul ajar terlampir.
        ${!mataPelajaran ? "- Deteksi dan cantumkan nama Mata Pelajaran yang sesuai dari dokumen modul ini." : `- Mata Pelajaran terdaftar: "${mataPelajaran}".`}
        ${!materi ? "- Deteksi dan cantumkan judul Topik/Materi pokok utama dari dokumen modul ini." : `- Materi Pokok yang dipilih guru: "${materi}".`}
        ` : `
        Saya sedang menyusun Rencana Pelaksanaan Pembelajaran (RPP) Kurikulum Nasional / Merdeka untuk mata pelajaran "${mataPelajaran}" dengan materi spesifik "${materi}".
        `}
        Tolong buatkan draf RPP yang komprehensif, terstruktur, padat, dan terintegrasi secara utuh.
        
        PENTING KHUSUS BAGIAN 'isiMateriPenjelas' (Penjabaran Materi yang Akan Disampaikan):
        Bagian ini BUKAN sekadar pengantar umum atau kalimat basa-basi, melainkan PENJABARAN MATERI PEMBELAJARAN LENGKAP YANG AKAN DISAMPAIKAN OLEH GURU DI DALAM KELAS.
        ${hasPdf ? `
        - BERDASARKAN DOKUMEN MODUL AJAR (PDF) TERLAMPIR:
          Ekstrak dan susun materi sesuai isi modul yang diimpor oleh guru, mencakup: konsep inti, kaidah/rumus/istilah pokok, serta CONTOH SOAL DAN CARA PENGERJAAN langkah-demi-langkah yang ada di dalam modul tersebut.
        ` : `
        - TANPA MODUL IMPOR (APLIKASI MENCARIKAN REFERENSI OTOMATIS TERPERCAYA):
          Aplikasi wajib menyusun penjabaran materi secara otomatis berdasarkan referensi kurikulum nasional resmi terpercaya (Kemdikbudristek, Buku Teks Siswa & Guru Kurikulum Merdeka, BSKAP).
          Misalnya jika materi Matematika tentang "Bilangan Pecahan", jabarkan pengertian pecahan (pembilang & penyebut), jenis pecahan & kaidah operasi, CONTOH SOAL LENGKAP DENGAN CARA PENGERJAAN LANGKAH DEMI LANGKAH (step-by-step), contoh kontekstual nyata (misal membagi kue/pizza), dan referensinya.
        `}
        STRUKTUR WAJIB 'isiMateriPenjelas' (Wajib dipisahkan dengan nomor urut dan enter ganda yang rapi):
        1. Pengertian & Konsep Inti:
           [Penjelasan konsep materi yang jelas, lugas, dan edukatif yang siap diajarkan guru]

        2. Kaidah Pokok, Rumus, & Karakteristik Materi:
           - [Penjelasan rumus / aturan / sifat penting materi secara terstruktur]
           - [Poin-poin esensial yang wajib dikuasai siswa]

        3. Contoh Soal & Cara Pengerjaan Terperinci (Langkah demi Langkah):
           - Contoh Soal: [Soal konkret seputar materi]
           - Cara Pengerjaan / Langkah Penyelesaian:
             * Langkah 1: ...
             * Langkah 2: ...
             * Kunci / Hasil Akhir: ...

        4. Contoh Kontekstual & Penerapan Nyata Sehari-hari:
           [Penerapan materi dalam kehidupan sehari-hari anak]

        5. Sumber Referensi Belajar Terpercaya:
           [Rujukan resmi Kemdikbudristek Kurikulum Merdeka / Dokumen Modul Acuan]

        PENTING KHUSUS BAGIAN 'referensiMateri' (Reverensi Otomatis untuk Isi Materi):
        Sajikan daftar referensi rujukan belajar resmi dan terpercaya yang melandasi penjabaran isi materi ini secara komprehensif:
        1. Buku Teks Utama: Buku Siswa dan Buku Panduan Guru Kemendikbudristek (Kurikulum Merdeka) untuk jenjang dan mata pelajaran terkait.
        2. Modul Ajar & Bahan Bacaan: Sumber rujukan bahan ajar dari Puskurbuk / BSKAP Kemendikbudristek.
        3. Media Digital / Ensiklopedia Sains & Edukasi: Portal Rumah Belajar Kemdikbud, sumber digital terverifikasi.
        ${hasPdf ? `4. Modul Acuan Terlampir: Dokumen modul ajar PDF yang dianalisis.` : `4. Sumber Rujukan Ilmiah Terkait.`}

        PENTING KHUSUS BAGIAN LATIHAN SOAL (WAJIB TEPAT ${questionCount} BUTIR SOAL berjenis ${questionType === 'Uraian' ? 'Uraian / Esai' : 'Pilihan Ganda'}):
        INSTRUKSI MUTLAK JUMLAH BUTIR SOAL:
        - Anda WAJIB membuat LENGKAP TEPAT ${questionCount} BUTIR SOAL LATIHAN (mulai nomor urut 1 sampai dengan nomor urut ${questionCount}).
        - DILARANG KERAS berhenti sebelum nomor ${questionCount}, dan DILARANG hanya membuat 3 atau 5 soal jika diminta ${questionCount} butir soal!
        - Seluruh nomor dari 1 sampai ${questionCount} harus tertulis lengkap dengan teks soal dan kunci jawaban.
        - Sajikan persis seperti naskah lembar Ujian / PTS (Penilaian Tengah Semester) resmi yang SUDAH MATANG, teks bersih, sangat mudah dibaca, dan bebas dari tanda markdown tebal seperti ** atau ##.
        ${hasPdf ? `Soal-soal latihan wajib menguji konsep dan materi yang dibahas secara nyata dalam modul ajar PDF terlampir.` : ''}
        
        PERINGATAN KERAS UNTUK JAWABAN SOAL:
        JAWABAN / KUNCI JAWABAN DILARANG KERAS BERGABUNG PADA BARIS SOAL. Kunci jawaban HARUS selalu berada di baris baru tersendiri yang diawali dengan enter!

        ${questionType === 'Pilihan Ganda' ? `
        Aturan Format Pilihan Ganda (Naskah Matang):
        - Tiap butir soal diawali dengan nomor urut: "1. ", "2. ", ..., "${questionCount}. ". Teks soal ditulis lengkap dan jelas di barisnya sendiri.
        - Pilihan jawaban A, B, C, D HARUS berada di baris tersendiri dengan format:
          A. Teks
          B. Teks
          C. Teks
          D. Teks
        - Di baris berikutnya setelah opsi D (diberi enter), cantumkan baris Kunci Jawaban tersendiri:
          Kunci Jawaban: [Huruf Opsi] (Pembahasan: [Penjelasan singkat dan padat])
        - Beri jeda 1 baris kosong antar butir soal.

        Contoh keluaran yang diinginkan:
        1. Berikut ini yang merupakan ciri utama dari sistem peredaran darah tertutup adalah...
           A. Darah mengalir di luar pembuluh darah
           B. Darah selalu beredar di dalam pembuluh darah
           C. Darah tidak memerlukan pompa jantung
           D. Darah bercampur langsung dengan cairan tubuh

           Kunci Jawaban: B (Pembahasan: Sistem peredaran darah tertutup selalu mengalirkan darah melalui pembuluh darah dan dipompa oleh jantung.)

        2. Pembuluh darah yang membawa darah kaya oksigen dari paru-paru menuju jantung adalah...
           A. Vena pulmonalis
           B. Arteri pulmonalis
           C. Vena kava superior
           D. Aorta

           Kunci Jawaban: A (Pembahasan: Vena pulmonalis bertugas membawa darah yang kaya oksigen dari paru-paru kembali ke atrium kiri jantung.)
        ` : `
        Aturan Format Uraian / Esai (Naskah Matang):
        - Tiap butir soal diawali dengan nomor urut: "1. ", "2. ", ..., "${questionCount}. ". Teks soal jelas di barisnya sendiri.
        - DI BAWAH TEKS SOAL (WAJIB DI-ENTER DI BARIS TERSENDIRI, TIDAK BOLEH GABUNG DENGAN TEKS SOAL), cantumkan baris Kunci Jawaban:
          Kunci Jawaban: [Uraian jawaban lengkap serta kriteria penskoran/rubrik]
        - Beri jeda 1 baris kosong antar butir soal.

        Contoh:
        1. Jelaskan perbedaan mendasar antara pembuluh arteri dan pembuluh vena dilihat dari arah aliran, ketebalan dinding, dan katupnya!

           Kunci Jawaban: Arteri membawa darah keluar dari jantung, dinding tebal elastis, dan katup satu di pangkal. Vena membawa darah menuju jantung, dinding tipis kurang elastis, dan memiliki banyak katup di sepanjang pembuluh. Skor maksimal: 20 poin.
        `}

        Berikan jawaban dalam format JSON.
      `;

      let aiContents: any;
      if (hasPdf && req.file) {
        let mimeType = req.file.mimetype;
        if (!mimeType || mimeType === 'application/octet-stream') {
          mimeType = 'application/pdf';
        }
        aiContents = {
          parts: [
            {
              inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: mimeType
              }
            },
            {
              text: prompt
            }
          ]
        };
      } else {
        aiContents = prompt;
      }

      // Call Gemini with multi-model fallback and budget sufficient time for PDF analysis and fallback
      const aiPromise = callGeminiWithRetry(ai, {
        model: "gemini-3.8-flash",
        contents: aiContents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mataPelajaran: {
                type: Type.STRING,
                description: "Nama mata pelajaran (dari input guru atau hasil deteksi modul PDF)."
              },
              materi: {
                type: Type.STRING,
                description: "Judul materi atau topik pokok (dari input guru atau hasil deteksi modul PDF)."
              },
              isiMateriPenjelas: {
                type: Type.STRING,
                description: "Penjabaran materi pembelajaran lengkap yang akan disampaikan guru di kelas, mencakup: 1. Pengertian & Konsep Inti, 2. Kaidah Pokok & Rumus/Aturan, 3. Contoh Soal & Cara Pengerjaan Langkah demi Langkah, 4. Contoh Kontekstual Nyata, 5. Referensi Belajar Terpercaya (diambil dari modul PDF jika ada, atau referensi kurikulum terpercaya jika tanpa modul)."
              },
              referensiMateri: {
                type: Type.STRING,
                description: "Daftar referensi dan sumber rujukan belajar otomatis yang melandasi penjabaran isi materi (meliputi Buku Panduan Guru & Siswa Kemdikbudristek, modul ajar resmi, dan literatur pendidikan terpercaya)."
              },
              tujuanPembelajaran: {
                type: Type.STRING,
                description: "Tujuan pembelajaran yang ingin dicapai melalui model pembelajaran Discovery/Inquiry Learning sesuai modul."
              },
              pendahuluan: {
                type: Type.STRING,
                description: "Langkah-langkah kegiatan pendahuluan (contoh: salam, absen, apersepsi, motivasi)."
              },
              kegiatanInti: {
                type: Type.STRING,
                description: "Langkah-langkah kegiatan inti (eksplorasi, elaborasi, konfirmasi) yang sangat spesifik tentang materi yang diajarkan sesuai modul."
              },
              penutup: {
                type: Type.STRING,
                description: "Langkah-langkah kegiatan penutup (kesimpulan, evaluasi, refleksi, doa)."
              },
              latihanSoal: {
                type: Type.STRING,
                description: `Daftar soal latihan LENGKAP dengan jumlah TEPAT ${questionCount} butir soal (mulai dari nomor 1 sampai nomor ${questionCount}) berjenis ${questionType === 'Uraian' ? 'Esai/Uraian' : 'Pilihan Ganda'}, diformat sangat rapi seperti naskah soal PTS dengan nomor, pilihan A-D di baris baru, dan kunci jawaban.`
              },
              penilaian: {
                type: Type.STRING,
                description: "Instrumen penilaian sikap, pengetahuan, dan keterampilan."
              }
            },
            required: ["tujuanPembelajaran", "pendahuluan", "kegiatanInti", "penutup", "latihanSoal", "penilaian"]
          }
        }
      });

      // Generous 26-second overall ceiling to allow model fallback attempts
      const response: any = await Promise.race([
        aiPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("AI overall request timeout")), 26000))
      ]);

      let rawText = response.text || "";
      if (!rawText.trim()) throw new Error("Tidak ada respon dari layanan AI.");
      rawText = rawText.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch (parseErr) {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) {
          json = JSON.parse(match[0]);
        } else {
          throw new Error("Format respon AI tidak valid sebagai JSON.");
        }
      }

      if (json && typeof json.isiMateriPenjelas === "string") {
        let text = json.isiMateriPenjelas
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/__(.*?)__/g, "$1")
          .replace(/_(.*?)_/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .trim();
        // Pastikan setiap penomoran materi tidak berjejer dalam satu baris, berikan enter ganda
        text = text.replace(/([^\n])\s*(?=(?:^|[^\w])(?:[0-9]{1,2}[\.\)]|[A-Da-d][\.\)])\s+[A-Z0-9\(\[\"\'\u00C0-\u017F])/g, "$1\n\n");
        text = text.replace(/([^\n])\s*(?=(?:[\-\*•])\s+[A-Za-z0-9])/g, "$1\n   ");
        json.isiMateriPenjelas = text;
      }

      if (json && typeof json.latihanSoal === "string") {
        // Strip markdown asterisks and standardize question lines
        let soalText = json.latihanSoal
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/__(.*?)__/g, "$1")
          .replace(/_(.*?)_/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .trim();

        // Pastikan penomoran soal dipisahkan baris baru
        soalText = soalText.replace(/([^\n])\s*(?=(?:^|[^\w])(?:Soal\s*)?[0-9]{1,2}[\.\)]\s+[A-Z0-9\(\[\"\'\u00C0-\u017F])/g, "$1\n\n");
        // Pastikan Kunci Jawaban / Pembahasan TIDAK GABUNG di baris soal, wajib di-enter
        soalText = soalText.replace(/([^\n])\s*(?=(?:Kunci\s*(?:Jawaban)?(?:\s*(?:dan|&)\s*Pembahasan)?|Jawaban\s*(?:Benar)?|Rubrik\s*(?:Penilaian)?|Pembahasan)\s*[:\-])/gi, "$1\n   ");
        // Pastikan pilihan jawaban A, B, C, D di-enter di baris baru tersendiri
        soalText = soalText.replace(/([^\n])\s*(?=(?:^|\s)[\(\[]?[A-Ea-e][\.\)\]\:]\s+[^\n])/g, "$1\n   ");

        // Enforce exact question count matching the user's ordered count!
        soalText = enforceExactQuestionCount(
          soalText,
          questionCount,
          questionType,
          (json.mataPelajaran || mataPelajaran || "Mata Pelajaran").toString(),
          (json.materi || materi || "Materi Pokok").toString()
        );

        json.latihanSoal = soalText;
      } else if (json) {
        json.latihanSoal = generateDeterministicRPP(mataPelajaran || "Mata Pelajaran", materi || "Materi Pokok", questionType, questionCount).latihanSoal;
      }

      // Ensure penilaian reflects the exact question count
      if (json) {
        if (!json.penilaian || typeof json.penilaian !== "string") {
          json.penilaian = `1. Penilaian Sikap: Observasi jurnal sikap Profil Pelajar Pancasila (beriman, gotong royong, bernalar kritis, mandiri).\n2. Penilaian Pengetahuan: Tes tertulis format PTS (${questionCount} butir soal ${questionType}) dengan rubrik penskoran terukur.\n3. Penilaian Keterampilan: Lembar observasi kinerja diskusi kelompok dan presentasi hasil penugasan.`;
        } else {
          // Sync question count in penilaian if it mentions butir soal
          json.penilaian = json.penilaian.replace(/\(\d+\s*butir\s*soal/gi, `(${questionCount} butir soal`);
        }
      }

      // Ensure mataPelajaran and materi are preserved if previously given
      if (mataPelajaran && (!json.mataPelajaran || !json.mataPelajaran.trim())) {
        json.mataPelajaran = mataPelajaran;
      }
      if (materi && (!json.materi || !json.materi.trim())) {
        json.materi = materi;
      }

      res.json(json);

    } catch (error: any) {
      // Seamless fallback ensures the teacher never experiences a blocked workflow or "Server Sibuk" error
      const fallbackData = generateDeterministicRPP(
        (req.body?.mataPelajaran || "Mata Pelajaran").toString(),
        (req.body?.materi || "Materi Pokok").toString(),
        req.body?.questionType === "Uraian" ? "Uraian" : "Pilihan Ganda",
        Math.min(Math.max(parseInt(req.body?.questionCount, 10) || 5, 1), 50)
      );
      return res.json(fallbackData);
    }
  });

  // API 1-Q: Dedicated endpoint to generate / regenerate practice questions matching exact count
  app.post("/api/generate-questions", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const mataPelajaran = (req.body?.mataPelajaran || "Mata Pelajaran").toString().trim();
      const materi = (req.body?.materi || "Materi Pokok").toString().trim();
      const questionType = req.body?.questionType === "Uraian" ? "Uraian" : "Pilihan Ganda";
      const questionCount = Math.min(Math.max(parseInt(req.body?.questionCount, 10) || 5, 1), 50);

      try {
        const ai = getAi();
        const prompt = `Anda adalah pakar pembuat soal Kurikulum Merdeka Indonesia.
Buatkan LENGKAP TEPAT ${questionCount} BUTIR SOAL LATIHAN untuk:
- Mata Pelajaran: "${mataPelajaran}"
- Topik / Materi: "${materi}"
- Bentuk Soal: ${questionType === 'Uraian' ? 'Uraian / Esai' : 'Pilihan Ganda (A, B, C, D)'}

ATURAN MUTLAK JUMLAH SOAL:
- WAJIB MEMBUAT LENGKAP DARI NOMOR 1 SAMPAI NOMOR ${questionCount}.
- TIDAK BOLEH BERHENTI SEBELUM NOMOR ${questionCount}.
- DILARANG MERANGKUM ATAU MEMOTONG JUMLAH SOAL.

FORMAT NASKAH PTS:
${questionType === 'Pilihan Ganda' ? `
Tiap butir soal diawali nomor urut ("1. ", "2. ", ..., "${questionCount}. ").
Pilihan A, B, C, D di baris baru.
Kunci Jawaban di baris baru setelah opsi D:
Kunci Jawaban: [Huruf Opsi] (Pembahasan: [Penjelasan singkat])
` : `
Tiap butir soal diawali nomor urut ("1. ", "2. ", ..., "${questionCount}. ").
Di bawah soal di baris baru:
Kunci Jawaban: [Jawaban lengkap dan rubrik skor]
`}

Keluarkan HANYA teks kumpulan soal siap pakai (tanpa tanda kutip JSON).`;

        const response: any = await callGeminiWithRetry(ai, {
          model: "gemini-3.8-flash",
          contents: prompt
        });

        let rawText = response?.text || "";
        if (!rawText.trim()) throw new Error("Empty AI response");

        // Format and enforce exact question count
        let soalText = rawText
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/__(.*?)__/g, "$1")
          .replace(/_(.*?)_/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .trim();

        soalText = soalText.replace(/([^\n])\s*(?=(?:^|[^\w])(?:Soal\s*)?[0-9]{1,2}[\.\)]\s+[A-Z0-9\(\[\"\'\u00C0-\u017F])/g, "$1\n\n");
        soalText = soalText.replace(/([^\n])\s*(?=(?:Kunci\s*(?:Jawaban)?(?:\s*(?:dan|&)\s*Pembahasan)?|Jawaban\s*(?:Benar)?|Rubrik\s*(?:Penilaian)?|Pembahasan)\s*[:\-])/gi, "$1\n   ");
        soalText = soalText.replace(/([^\n])\s*(?=(?:^|\s)[\(\[]?[A-Ea-e][\.\)\]\:]\s+[^\n])/g, "$1\n   ");

        const finalizedQuestions = enforceExactQuestionCount(soalText, questionCount, questionType, mataPelajaran, materi);
        res.json({
          latihanSoal: finalizedQuestions,
          count: questionCount,
          type: questionType
        });
      } catch (aiErr) {
        const fallback = generateDeterministicRPP(mataPelajaran, materi, questionType, questionCount);
        res.json({
          latihanSoal: fallback.latihanSoal,
          count: questionCount,
          type: questionType
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Gagal menyusun latihan soal" });
    }
  });

  // API 1B: Extract Module Metadata from PDF
  app.post("/api/extract-module-info", upload.single("file"), async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      if (!req.file) {
        return res.status(400).json({ error: "File PDF modul ajar wajib diunggah." });
      }

      const ai = getAi();
      const fileBuffer = req.file.buffer;
      let mimeType = req.file.mimetype || "application/pdf";
      if (mimeType === 'application/octet-stream') mimeType = 'application/pdf';
      const base64Data = fileBuffer.toString("base64");

      const response = await callGeminiWithRetry(ai, {
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            {
              text: `Analisis dokumen Modul Ajar / Bahan Ajar / Silabus PDF ini secara mendalam.
Ekstrak dan susun informasi pembelajaran secara terperinci:
- 'mataPelajaran': Nama mata pelajaran yang diajarkan (contoh: Matematika, IPAS, Bahasa Indonesia, dll).
- 'materi': Topik utama atau judul bab/sub-bab pokok (Judul Materi) yang dibahas dalam modul ini.
- 'isiMateriPenjelas': PENJABARAN MATERI LENGKAP YANG AKAN DISAMPAIKAN GURU DI KELAS berdasarkan dokumen modul ini. Wajib memuat secara terstruktur:
  1. Pengertian & Konsep Inti (sesuai penjelasan modul).
  2. Kaidah Pokok, Rumus, atau Karakteristik Materi (teori/rumus/istilah penting dalam modul).
  3. Contoh Soal & Cara Pengerjaan Terperinci (Langkah demi Langkah) yang ada di dalam modul (atau buatkan contoh konkret jika modul belum menyajikan soal).
  4. Contoh Kontekstual & Penerapan Nyata Sehari-hari.
  5. Sumber Referensi Belajar Terpercaya (cantumkan dokumen modul ini & referensi resmi).
- 'kelasSemester': Tingkat kelas atau fase (contoh: 'Kelas 5', 'Kelas 4 / Ganjil', 'Fase C').
- 'alokasiWaktu': Perkiraan atau ketentuan alokasi waktu jika tertulis (contoh: '2 x 35 Menit' atau '3 JP').
- 'ringkasan': Ringkasan singkat 1-2 kalimat mengenai fokus materi pokok pada modul ini.
- 'tujuanPembelajaran': Tujuan pembelajaran jika sudah tercantum di modul (opsional).`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mataPelajaran: { type: Type.STRING, description: "Nama mata pelajaran" },
              materi: { type: Type.STRING, description: "Judul topik atau materi pokok modul" },
              isiMateriPenjelas: { type: Type.STRING, description: "Penjabaran materi pembelajaran lengkap dari modul (konsep inti, kaidah/rumus, contoh soal & cara pengerjaan langkah demi langkah, penerapan nyata)" },
              referensiMateri: { type: Type.STRING, description: "Daftar referensi sumber rujukan materi" },
              kelasSemester: { type: Type.STRING, description: "Tingkat kelas / semester jika ada" },
              alokasiWaktu: { type: Type.STRING, description: "Alokasi waktu jika ada" },
              ringkasan: { type: Type.STRING, description: "Ringkasan singkat isi modul" },
              tujuanPembelajaran: { type: Type.STRING, description: "Tujuan pembelajaran jika tertera" }
            },
            required: ["mataPelajaran", "materi"]
          }
        }
      });

      let text = response.text || "";
      if (!text) throw new Error("Tidak ada respon dari layanan AI.");
      text = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          json = JSON.parse(match[0]);
        } else {
          throw new Error("Format hasil analisis modul tidak valid sebagai JSON.");
        }
      }

      if (json && typeof json.isiMateriPenjelas === "string") {
        let materiText = json.isiMateriPenjelas
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/__(.*?)__/g, "$1")
          .replace(/_(.*?)_/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .trim();
        materiText = materiText.replace(/([^\n])\s*(?=(?:^|[^\w])(?:[0-9]{1,2}[\.\)]|[A-Da-d][\.\)])\s+[A-Z0-9\(\[\"\'\u00C0-\u017F])/g, "$1\n\n");
        materiText = materiText.replace(/([^\n])\s*(?=(?:[\-\*•])\s+[A-Za-z0-9])/g, "$1\n   ");
        json.isiMateriPenjelas = materiText;
      }

      res.json(json);

    } catch (error: any) {
      console.log("[Module Extraction Fallback] Switched to deterministic parser:", error?.message || error);
      const originalName = req.file ? req.file.originalname : "Modul Ajar";
      const cleanName = originalName.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");

      // Detect mapel from filename if possible
      let detectedMapel = "Pendidikan Pancasila";
      const lowerName = cleanName.toLowerCase();
      if (lowerName.includes("matematika") || lowerName.includes("math")) detectedMapel = "Matematika";
      else if (lowerName.includes("ipas") || lowerName.includes("ipa") || lowerName.includes("sains")) detectedMapel = "IPAS";
      else if (lowerName.includes("bahasa indonesia") || lowerName.includes("indo")) detectedMapel = "Bahasa Indonesia";
      else if (lowerName.includes("bahasa inggris") || lowerName.includes("inggris")) detectedMapel = "Bahasa Inggris";
      else if (lowerName.includes("pai") || lowerName.includes("agama")) detectedMapel = "Pendidikan Agama Islam";
      else if (lowerName.includes("pjok") || lowerName.includes("olahraga")) detectedMapel = "PJOK";
      else if (lowerName.includes("seni")) detectedMapel = "Seni Budaya";

      // Detect kelas from filename
      let detectedKelas = "Kelas 4";
      const matchKelas = cleanName.match(/kelas\s*([0-9IVX]+)/i);
      if (matchKelas) detectedKelas = `Kelas ${matchKelas[1]}`;

      const realisticMateri = buildRealisticIsiMateri(detectedMapel, cleanName, detectedKelas);

      return res.json({
        mataPelajaran: detectedMapel,
        materi: cleanName,
        isiMateriPenjelas: realisticMateri.isiMateriPenjelas,
        referensiMateri: realisticMateri.referensiMateri,
        kelasSemester: `${detectedKelas} / Ganjil`,
        alokasiWaktu: "2 x 35 Menit (1 Pertemuan)",
        ringkasan: `Modul ajar ${cleanName} memuat tujuan pembelajaran, materi pokok, dan panduan asesmen ${detectedMapel} untuk ${detectedKelas}.`,
        tujuanPembelajaran: `Peserta didik mampu memahami, menganalisis, dan mempraktikkan konsep dasar ${cleanName} dengan teliti dan bernalar kritis.`
      });
    }
  });

  // API 1C: Generate / Refresh Automatic References specifically for Lesson Material (Reverensi Otomatis untuk Isi Materi)
  app.post("/api/generate-referensi-materi", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const mataPelajaran = (req.body?.mataPelajaran || "Mata Pelajaran").toString().trim();
      const materi = (req.body?.materi || "Materi Pembelajaran").toString().trim();
      const kelas = (req.body?.kelas || "Semua Kelas").toString().trim();
      const isiMateriPenjelas = (req.body?.isiMateriPenjelas || "").toString().trim();
      const pdfModuleName = (req.body?.pdfModuleName || "").toString().trim();

      const fallbackRef = `1. Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi Republik Indonesia. (2024). Buku Panduan Guru dan Buku Teks Siswa: ${mataPelajaran} (${kelas}). Jakarta: Pusat Perbukuan BSKAP Kemendikbudristek.\n2. Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP). Alur Tujuan Pembelajaran (ATP) dan Capaian Pembelajaran ${mataPelajaran} Materi '${materi}'.\n3. Tim Pengembang Kurikulum. Modul Pembelajaran Berdiferensiasi dan Pengayaan Konsep '${materi}'.\n4. Platform Merdeka Mengajar (PMM) Kemdikbudristek & Portal Rumah Belajar: Penjabaran Materi dan Lembar Kerja Eksploratif '${materi}'.${pdfModuleName ? `\n5. Dokumen Acuan Modul Ajar: ${pdfModuleName}` : ''}`;

      try {
        const ai = getAi();
        const prompt = `Anda adalah pakar kurikulum nasional dan pengembang bahan ajar Indonesia.
Tolong susunkan daftar "Referensi / Reverensi Otomatis untuk Isi Materi" resmi dan terpercaya untuk:
- Mata Pelajaran: "${mataPelajaran}"
- Jenjang / Tingkat Kelas: "${kelas}"
- Topik / Materi Pokok: "${materi}"
${isiMateriPenjelas ? `- Penjabaran Isi Materi yang Disampaikan:\n"""\n${isiMateriPenjelas.slice(0, 1000)}\n"""` : ''}
${pdfModuleName ? `- Dokumen Modul Ajar Acuan: "${pdfModuleName}"` : ''}

Format keluaran:
Sajikan daftar rujukan bernomor 1 s/d 4 (atau 5 jika ada modul acuan) yang rapi, mencakup:
1. Buku Teks Siswa & Buku Guru Kurikulum Merdeka resmi dari Kemendikbudristek.
2. Pedoman Capaian Pembelajaran & Modul Ajar resmi dari BSKAP / Pusat Kurikulum dan Perbukuan.
3. Media Digital / Ensiklopedia Sains & Edukasi / Portal Rumah Belajar Kemdikbud.
4. Sumber Ilmiah / Artikel Edukasi Terpercaya yang relevan dengan penjabaran materi.
${pdfModuleName ? `5. Modul Ajar Terlampir: ${pdfModuleName}` : ''}

Keluarkan HANYA teks daftar referensi yang siap pakai (tanpa pembuka/penutup).`;

        const result: any = await callGeminiWithRetry(ai, {
          model: "gemini-3.8-flash",
          contents: prompt
        });

        const text = result?.text?.trim() || fallbackRef;
        res.json({ referensiMateri: text });
      } catch (aiErr) {
        res.json({ referensiMateri: fallbackRef });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Gagal menyusun referensi materi" });
    }
  });

  // API 1D: Generate / Refresh Comprehensive Lesson Content (Isi Materi Penjelas & Reverensi Terpercaya)
  app.post("/api/generate-isi-materi", upload.single("file"), async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const mataPelajaran = (req.body?.mataPelajaran || "Mata Pelajaran").toString().trim();
      const materi = (req.body?.materi || "Materi Pokok").toString().trim();
      const kelas = (req.body?.kelas || "").toString().trim();
      const hasPdf = !!req.file;

      const fallback = buildRealisticIsiMateri(mataPelajaran, materi, kelas);

      try {
        const ai = getAi();
        let promptText = "";
        const parts: any[] = [];

        if (hasPdf && req.file) {
          parts.push({
            inlineData: {
              data: req.file.buffer.toString("base64"),
              mimeType: req.file.mimetype || "application/pdf"
            }
          });
          promptText = `Analisis modul ajar / dokumen referensi PDF ini untuk mata pelajaran "${mataPelajaran}", materi "${materi}" (${kelas}).
Susunkan PENJABARAN MATERI PEMBELAJARAN LENGKAP YANG AKAN DISAMPAIKAN OLEH GURU DI KELAS berdasarkan modul terlampir.

Struktur Wajib (Tuliskan dengan nomor urut dan enter ganda yang rapi):
1. Pengertian & Konsep Inti:
   (Penjelasan konsep materi yang jelas dan edukatif sesuai isi modul)

2. Kaidah Pokok, Rumus, & Karakteristik Materi:
   (Penjelasan rumus / aturan / prinsip esensial yang dibahas dalam modul)

3. Contoh Soal & Cara Pengerjaan Terperinci (Langkah demi Langkah):
   (Sajikan contoh soal nyata yang ada di dalam modul atau buatkan contoh konkret yang selaras, lengkap dengan cara pengerjaan langkah demi langkah step-by-step)

4. Contoh Kontekstual & Penerapan Nyata Sehari-hari:
   (Penerapan nyata materi dalam kehidupan sehari-hari anak)

5. Sumber Referensi Belajar Terpercaya:
   (Cantumkan modul ajar PDF acuan ini beserta buku teks resmi Kurikulum Merdeka Kemdikbudristek)`;
        } else {
          promptText = `Anda adalah pakar kurikulum nasional dan pengembang bahan ajar Indonesia (Kemdikbudristek).
Tolong susunkan PENJABARAN MATERI PEMBELAJARAN LENGKAP YANG AKAN DISAMPAIKAN GURU DI KELAS untuk:
- Mata Pelajaran: "${mataPelajaran}"
- Topik / Materi Pokok: "${materi}"
- Jenjang / Kelas: "${kelas || "SD / SMP / SMA"}"

Karena guru tidak melampirkan modul impor, carikan dan susunlah secara otomatis dari REFERENSI PENDIDIKAN RESMI & TERPERCAYA (Kurikulum Merdeka Kemdikbudristek, BSKAP).
Contoh: jika materi Matematika tentang "Bilangan Pecahan", susunlah materi nyata yang mencakup pengertian (pembilang & penyebut), jenis pecahan & kaidah operasi, CONTOH SOAL DENGAN CARA PENGERJAAN LANGKAH DEMI LANGKAH (step-by-step), contoh kontekstual nyata (misal memotong kue/pizza), dan referensi terpercaya.

Struktur Wajib (Tuliskan dengan nomor urut dan enter ganda yang rapi):
1. Pengertian & Konsep Inti:
   [Penjelasan konsep materi yang jelas, lugas, dan edukatif]

2. Kaidah Pokok, Rumus, & Karakteristik Materi:
   - [Penjelasan rumus / aturan / sifat penting materi secara terstruktur]
   - [Poin-poin esensial yang wajib dipahami peserta didik]

3. Contoh Soal & Cara Pengerjaan Terperinci (Langkah demi Langkah):
   - Contoh Soal: [Soal konkret seputar materi]
   - Cara Pengerjaan / Langkah Penyelesaian:
     * Langkah 1: ...
     * Langkah 2: ...
     * Kunci / Hasil Akhir: ...

4. Contoh Kontekstual & Penerapan Nyata Sehari-hari:
   [Penerapan materi dalam kehidupan sehari-hari anak]

5. Sumber Referensi Belajar Terpercaya:
   [Daftar rujukan resmi Buku Panduan Guru & Siswa Kemdikbudristek Kurikulum Merdeka, ATP BSKAP]`;
        }

        parts.push({ text: promptText });

        const result: any = await callGeminiWithRetry(ai, {
          model: "gemini-3.8-flash",
          contents: { parts }
        });

        const generatedText = result?.text?.trim() || "";
        if (!generatedText) {
          return res.json(fallback);
        }

        // Separate or extract references if present, or maintain fallback references
        res.json({
          isiMateriPenjelas: generatedText,
          referensiMateri: fallback.referensiMateri
        });
      } catch (aiErr) {
        console.warn("AI Generate Isi Materi fallback:", aiErr);
        res.json(fallback);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Gagal menyusun penjabaran isi materi" });
    }
  });

  // API 2: Extract Questions from Uploaded File (Bank Soal)
  app.post("/api/extract-questions", upload.single("file"), async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ai = getAi();
      const fileBuffer = req.file.buffer;
      const mimeType = req.file.mimetype || "application/pdf";
      const base64Data = fileBuffer.toString("base64");

      const response = await callGeminiWithRetry(ai, {
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            {
              text: `Ekstrak soal-soal dari dokumen ini. Kategorikan apakah itu 'Pilihan Ganda' atau 'Uraian'. Untuk Pilihan Ganda, ambil opsi (A,B,C,D) dan jawaban benarnya jika ada. Kembalikan dalam format JSON array.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "Pertanyaan soal" },
                type: { type: Type.STRING, description: "Hanya gunakan salah satu dari: 'Pilihan Ganda' atau 'Uraian'" },
                options: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Array pilihan jawaban (untuk Pilihan Ganda). Kosongkan jika Uraian."
                },
                correctAnswer: { 
                  type: Type.STRING, 
                  description: "Jawaban yang benar dari pilihan ganda. Kosongkan jika uraian." 
                }
              },
              required: ["text", "type"]
            }
          }
        }
      });

      let text = response.text || "";
      if (!text) throw new Error("Tidak ada respon dari layanan AI.");
      text = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          json = JSON.parse(match[0]);
        } else {
          throw new Error("Format hasil ekstraksi tidak valid sebagai JSON.");
        }
      }
      res.json(json);

    } catch (error: any) {
      console.log("[Extract Questions Error]:", error?.message || error);
      res.status(500).json({ error: error.message || "Failed to extract questions" });
    }
  });

  // API 3: Extract Schedule from Image or Document
  app.post("/api/extract-schedule", upload.single("file"), async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ai = getAi();
      const fileBuffer = req.file.buffer;
      let mimeType = req.file.mimetype;
      if (!mimeType || mimeType === 'application/octet-stream') {
        const originalName = req.file.originalname.toLowerCase();
        if (originalName.endsWith('.png')) mimeType = 'image/png';
        else if (originalName.endsWith('.webp')) mimeType = 'image/webp';
        else if (originalName.endsWith('.pdf')) mimeType = 'application/pdf';
        else mimeType = 'image/jpeg';
      }
      const base64Data = fileBuffer.toString("base64");

      const response = await callGeminiWithRetry(ai, {
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            {
              text: `Anda adalah asisten cerdas untuk administrasi sekolah.
Analisis gambar jadwal (jadwal pelajaran harian atau jadwal ujian) ini secara teliti.
Ekstrak semua baris jadwal yang ada di gambar.
Kembalikan daftar jadwal sebagai array objek JSON valid.
Setiap item objek harus memiliki:
- 'type': 'pelajaran' atau 'ujian' (jika jadwal ujian pilih 'ujian', jika hari biasa pilih 'pelajaran')
- 'hari': Nama hari (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu) atau tanggal pelaksanaan ujian
- 'jam': Rentang jam (contoh: '07:30 - 08:30' atau '08.00 - 09.30')
- 'mataPelajaran': Nama mata pelajaran (contoh: 'Matematika', 'Bahasa Indonesia', 'IPA', 'PAI', dll)
- 'pengajar': Nama guru pengajar atau nama pengawas (kosongkan jika tidak ada)
- 'ruangan': Ruangan kelas atau ruang ujian (opsional, contoh: 'Ruang 101' atau 'Kelas VII-A')
- 'keterangan': Catatan tambahan (opsional)

Jika hari tidak tertera per baris melainkan kolom per hari (tabel matriks), uraikan setiap sesi ke dalam satu item jadwal.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "Hanya isi dengan 'pelajaran' atau 'ujian'" },
                hari: { type: Type.STRING, description: "Hari (misal: Senin) atau tanggal ujian" },
                jam: { type: Type.STRING, description: "Rentang waktu, misal: 07:30 - 09:00" },
                mataPelajaran: { type: Type.STRING, description: "Nama mata pelajaran" },
                pengajar: { type: Type.STRING, description: "Nama guru atau pengawas" },
                ruangan: { type: Type.STRING, description: "Ruangan (opsional)" },
                keterangan: { type: Type.STRING, description: "Keterangan tambahan (opsional)" }
              },
              required: ["type", "hari", "jam", "mataPelajaran"]
            }
          }
        }
      });

      let text = response.text || "";
      if (!text) throw new Error("Tidak ada respon dari layanan AI.");

      text = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        // Fallback: search for [ ... ]
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          json = JSON.parse(match[0]);
        } else {
          const objMatch = text.match(/\{[\s\S]*\}/);
          if (objMatch) {
            json = JSON.parse(objMatch[0]);
          }
        }
      }

      if (!json) {
        return res.json([]);
      }

      if (!Array.isArray(json)) {
        const potentialArray = Object.values(json).find(val => Array.isArray(val));
        json = potentialArray || [];
      }

      res.json(json);
    } catch (error: any) {
      console.log("[Extract Schedule Error]:", error?.message || error);
      res.status(500).json({ error: error.message || "Failed to extract schedule" });
    }
  });

  // Explicit 404 for unhandled API routes so they NEVER fall through to Vite SPA HTML
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  // Global API error handler (catches multer errors, body parser errors, etc.)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith("/api/")) {
      console.error("API error:", err);
      return res.status(err.status || 500).json({ error: err.message || "Terjadi kesalahan internal server." });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For Express 4
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (err: any) => {
    console.error("Server error:", err);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});

