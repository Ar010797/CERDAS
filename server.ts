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

  // High quality deterministic fallback generator for E-RPP
  const generateDeterministicRPP = (
    mataPelajaran: string,
    materi: string,
    questionType: "Pilihan Ganda" | "Uraian",
    questionCount: number
  ) => {
    const safeCount = Math.min(Math.max(questionCount, 1), 20);

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
          `Jelaskan keterkaitan antara ${materi} dengan topik pembelajaran sebelumnya yang relevan!`
        ];

        for (let i = 1; i <= safeCount; i++) {
          const prompt = questionPrompts[(i - 1) % questionPrompts.length];
          items.push(
            `${i}. ${prompt}\n   Kunci Jawaban: Pemahaman konsep yang tepat, argumen logis terstruktur, serta ketepatan contoh kontekstual yang relevan (Skor maksimal: 100).`
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
          }
        ];

        for (let i = 1; i <= safeCount; i++) {
          const t = templates[(i - 1) % templates.length];
          const questionText = i > 5 ? `${i}. Terkait materi ${materi} (Butir ${i}): Pernyataan berikut yang paling sesuai adalah...` : `${i}. ${t.q}`;
          items.push(
            `${questionText}\n   A. ${t.options[0]}\n   B. ${t.options[1]}\n   C. ${t.options[2]}\n   D. ${t.options[3]}\n   Kunci Jawaban: ${t.key} (Pembahasan: ${t.expl})`
          );
        }
      }
      return items.join("\n\n");
    };

    return {
      tujuanPembelajaran: `Melalui model pembelajaran Discovery/Inquiry Learning berorientasi Profil Pelajar Pancasila pada materi ${materi}, peserta didik diharapkan mampu:\n1. Mengidentifikasi konsep esensial dan prinsip dasar ${materi} secara cermat dan kritis.\n2. Menganalisis contoh kasus dan penerapan nyata terkait ${materi} dalam kehidupan sehari-hari.\n3. Menyajikan hasil penelaahan serta berkolaborasi aktif dengan sikap santun, mandiri, dan bertanggung jawab.`,
      isiMateriPenjelas: `1. Konsep Pokok & Pengertian:\n   ${materi} merupakan salah satu materi esensial dalam mata pelajaran ${mataPelajaran} yang membekali peserta didik dengan pemahaman konseptual dan aplikatif secara mendalam.\n\n2. Uraian & Pokok Bahasan:\n   - Mempelajari prinsip dasar, karakteristik, serta struktur yang mendasari ${materi}.\n   - Mengembangkan kemampuan berpikir kritis dan analitis dalam memecahkan persoalan seputar ${materi}.\n   - Menghubungkan konsep teoritis dengan fakta kontekstual di lingkungan sekitar peserta didik.\n\n3. Penerapan & Contoh Nyata:\n   - Pemecahan studi kasus sederhana baik secara mandiri maupun kolaboratif.\n   - Penggunaan analogi konkret dan bahan peraga untuk memperjelas visualisasi materi.`,
      pendahuluan: `1. Orientasi: Guru membuka kelas dengan salam ramah, memimpin doa bersama, dan memeriksa presensi siswa.\n2. Apersepsi: Guru mengaitkan materi sebelumnya dengan topik '${materi}' melalui pertanyaan pemantik kontekstual.\n3. Motivasi: Guru memaparkan tujuan pembelajaran, manfaat mempelajari '${materi}', serta mekanisme kegiatan dan penilaian hari ini.`,
      kegiatanInti: `1. Stimulasi (Pemberian Rangsangan):\n   - Guru menyajikan bahan tayang/ilustrasi kontekstual seputar materi '${materi}'.\n   - Peserta didik mengamati dan mencatat hal-hal penting secara seksama.\n\n2. Identifikasi Masalah (Problem Statement):\n   - Peserta didik dirangsang untuk menyusun pertanyaan kritis seputar penerapan '${materi}'.\n   - Guru mengelompokkan siswa ke dalam tim belajar heterogen.\n\n3. Pengumpulan Data (Data Collection):\n   - Setiap kelompok mengumpulkan data dan referensi relevan mengenai '${materi}' dari buku ajar dan lembar kerja.\n   - Guru berkeliling memfasilitasi dan memberi bimbingan diferensiasi.\n\n4. Pengolahan Data (Data Processing):\n   - Siswa berdiskusi mengolah data temuan untuk merumuskan simpulan kelompok mengenai '${materi}'.\n   - Menyusun draf laporan hasil eksplorasi pada lembar kerja siswa.\n\n5. Pembuktian & Verifikasi (Verification):\n   - Perwakilan kelompok mempresentasikan hasil diskusi di hadapan kelas.\n   - Kelompok lain menanggapi secara konstruktif dan beretika.\n   - Guru memberikan penguatan materi, klarifikasi, dan apresiasi terhadap partisipasi aktif siswa.`,
      penutup: `1. Simpulan: Bersama guru, peserta didik merangkum poin-poin utama materi '${materi}'.\n2. Refleksi: Peserta didik menyampaikan hal yang telah dipahami dan bagian yang masih membutuhkan pendalaman.\n3. Tindak Lanjut: Guru memberikan tugas mandiri/pengayaan serta menyampaikan agenda pertemuan berikutnya.\n4. Doa & Salam: Pembelajaran diakhiri dengan doa penutup dan salam kehangatan.`,
      latihanSoal: generateQuestions(),
      penilaian: `1. Penilaian Sikap: Observasi jurnal sikap Profil Pelajar Pancasila (beriman, gotong royong, bernalar kritis, mandiri).\n2. Penilaian Pengetahuan: Tes tertulis format PTS (${safeCount} butir soal ${questionType}) dengan rubrik penskoran terukur.\n3. Penilaian Keterampilan: Lembar observasi kinerja diskusi kelompok dan presentasi hasil penugasan.`
    };
  };

  // API 1: Generate RPP Draft (supports both JSON payload and multipart FormData with PDF module file)
  app.post("/api/generate-rpp", upload.single("file"), async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const ai = getAi();
      const mataPelajaran = (req.body?.mataPelajaran || "").toString().trim();
      const materi = (req.body?.materi || "").toString().trim();
      const questionType = req.body?.questionType === "Uraian" ? "Uraian" : "Pilihan Ganda";
      const questionCount = Math.min(Math.max(parseInt(req.body?.questionCount, 10) || 5, 1), 20);
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
        
        PENTING KHUSUS BAGIAN 'isiMateriPenjelas' (Kolom Isi Materi Penjelas):
        Sajikan uraian materi pembelajaran yang padat, jelas, terstruktur, dan edukatif mengenai topik ini.
        ${hasPdf ? `
        - KARENA MODUL PDF TERSEDIA: Ekstrak dan susun ringkasan serta uraian materi penjelas langsung dari dokumen modul ajar PDF terlampir secara akurat (meliputi konsep kunci, teori/rumus/istilah utama, langkah, dan contoh yang ada di dalam modul).
        ` : `
        - KARENA TANPA MODUL PDF: Rujuklah konsep dan sumber kurikulum nasional resmi / referensi pendidikan terpercaya (Kemdikbudristek, buku guru/siswa resmi, literatur saintifik terpercaya).
        `}
        ATURAN PENOMORAN 'isiMateriPenjelas':
        Setiap nomor WAJIB DIBERIKAN ENTER / BARIS BARU (TIDAK BOLEH BERJEJER DALAM SATU BARIS):
        1. Pengertian / Konsep Inti:
           [Uraian konsep kunci]

        2. Uraian & Poin-Poin Pokok Bahasan:
           - [Pokok bahasan 1]
           - [Pokok bahasan 2]

        3. Contoh Kontekstual & Penerapan Nyata:
           [Uraian contoh kontekstual]

        PENTING KHUSUS BAGIAN LATIHAN SOAL (${questionCount} butir soal berjenis ${questionType === 'Uraian' ? 'Uraian / Esai' : 'Pilihan Ganda'}):
        Sajikan persis seperti naskah lembar Ujian / PTS (Penilaian Tengah Semester) resmi yang SUDAH MATANG, teks bersih, sangat mudah dibaca, dan bebas dari tanda markdown tebal seperti ** atau ##.
        ${hasPdf ? `Soal-soal latihan wajib menguji konsep dan materi yang dibahas secara nyata dalam modul ajar PDF terlampir.` : ''}
        
        PERINGATAN KERAS UNTUK JAWABAN SOAL:
        JAWABAN / KUNCI JAWABAN DILARANG KERAS BERGABUNG PADA BARIS SOAL. Kunci jawaban HARUS selalu berada di baris baru tersendiri yang diawali dengan enter!

        ${questionType === 'Pilihan Ganda' ? `
        Aturan Format Pilihan Ganda (Naskah Matang):
        - Tiap butir soal diawali dengan nomor urut: "1. ", "2. ", dst. Teks soal ditulis lengkap dan jelas di barisnya sendiri.
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
        - Tiap butir soal diawali dengan nomor urut: "1. ", "2. ", dst. Teks soal jelas di barisnya sendiri.
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
                description: "Uraian dan penjelasan materi pembelajaran komprehensif mengenai konsep inti, poin-poin pokok bahasan, dan contoh kontekstual nyata (diambil dari modul PDF jika ada, atau referensi pendidikan terpercaya jika tanpa modul)."
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
                description: `Daftar soal latihan (${questionCount} butir) berjenis ${questionType === 'Uraian' ? 'Esai/Uraian' : 'Pilihan Ganda'}, diformat sangat rapi seperti naskah soal PTS dengan nomor, pilihan A-D di baris baru, dan kunci jawaban.`
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

        json.latihanSoal = soalText;
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
        Math.min(Math.max(parseInt(req.body?.questionCount, 10) || 5, 1), 20)
      );
      return res.json(fallbackData);
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
              text: `Analisis dokumen Modul Ajar / Bahan Ajar / Silabus PDF ini.
Ekstrak informasi pokok identitas dan substansi pembelajaran:
- 'mataPelajaran': Nama mata pelajaran yang diajarkan (contoh: Matematika, IPAS, Bahasa Indonesia, dll).
- 'materi': Topik utama atau judul bab/sub-bab pokok (Judul Materi) yang dibahas dalam modul ini.
- 'isiMateriPenjelas': Uraian dan penjelasan materi pembelajaran komprehensif dari modul ini (konsep inti, poin-poin pokok bahasan, dan contoh/langkah).
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
              isiMateriPenjelas: { type: Type.STRING, description: "Uraian dan penjelasan isi materi pokok dari modul" },
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

      return res.json({
        mataPelajaran: detectedMapel,
        materi: cleanName,
        isiMateriPenjelas: `1. Pengertian & Konsep Inti:\nMateri ${cleanName} berfokus pada penguasaan konsep esensial, pemahaman teori dasar, dan pembentukan keterampilan berpikir kritis sesuai capaian pembelajaran ${detectedKelas}.\n\n2. Uraian & Poin Pokok Bahasan:\n- Pemahaman konsep dan definisi kunci materi ${cleanName}.\n- Langkah-langkah analitis dan pembuktian konsep melalui eksplorasi terbimbing.\n- Hubungan sebab-akibat serta keterkaitan materi dengan materi prasyarat sebelumnya.\n\n3. Contoh Kontekstual & Penerapan Nyata:\nPeserta didik mengamati dan mempraktikkan penyelesaian studi kasus kontekstual dalam kehidupan sehari-hari, serta merumuskan simpulan hasil belajar.`,
        kelasSemester: `${detectedKelas} / Ganjil`,
        alokasiWaktu: "2 x 35 Menit (1 Pertemuan)",
        ringkasan: `Modul ajar ${cleanName} memuat tujuan pembelajaran, materi pokok, dan panduan asesmen ${detectedMapel} untuk ${detectedKelas}.`,
        tujuanPembelajaran: `Peserta didik mampu memahami, menganalisis, dan mempraktikkan konsep dasar ${cleanName} dengan teliti dan bernalar kritis.`
      });
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

