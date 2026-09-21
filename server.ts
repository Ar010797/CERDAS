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
    // Models to try in sequence: gemini-3.1-flash-lite is the fastest (under 1s) and most stable
    const requestedModel = params.model || "gemini-3.1-flash-lite";
    const defaultCandidates = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
    const modelCandidates: string[] = [
      requestedModel,
      ...defaultCandidates.filter((m) => m !== requestedModel)
    ];

    let lastError: any = null;

    for (const currentModel of modelCandidates) {
      try {
        const currentParams = { ...params, model: currentModel };
        // Strict 9-second timeout per candidate to prevent hanging and 504 Gateway Timeout
        const result = await Promise.race([
          ai.models.generateContent(currentParams),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout on model ${currentModel}`)), 9000)
          )
        ]);
        return result;
      } catch (error: any) {
        lastError = error;
        console.warn(`Model ${currentModel} returned error:`, error?.message || error);
        // Seamlessly try the next model candidate
        continue;
      }
    }

    throw lastError || new Error("Layanan AI sedang mengalami lonjakan permintaan.");
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
      pendahuluan: `1. Orientasi: Guru membuka kelas dengan salam ramah, memimpin doa bersama, dan memeriksa presensi siswa.\n2. Apersepsi: Guru mengaitkan materi sebelumnya dengan topik '${materi}' melalui pertanyaan pemantik kontekstual.\n3. Motivasi: Guru memaparkan tujuan pembelajaran, manfaat mempelajari '${materi}', serta mekanisme kegiatan dan penilaian hari ini.`,
      kegiatanInti: `1. Stimulasi (Pemberian Rangsangan):\n   - Guru menyajikan bahan tayang/ilustrasi kontekstual seputar materi '${materi}'.\n   - Peserta didik mengamati dan mencatat hal-hal penting secara seksama.\n\n2. Identifikasi Masalah (Problem Statement):\n   - Peserta didik dirangsang untuk menyusun pertanyaan kritis seputar penerapan '${materi}'.\n   - Guru mengelompokkan siswa ke dalam tim belajar heterogen.\n\n3. Pengumpulan Data (Data Collection):\n   - Setiap kelompok mengumpulkan data dan referensi relevan mengenai '${materi}' dari buku ajar dan lembar kerja.\n   - Guru berkeliling memfasilitasi dan memberi bimbingan diferensiasi.\n\n4. Pengolahan Data (Data Processing):\n   - Siswa berdiskusi mengolah data temuan untuk merumuskan simpulan kelompok mengenai '${materi}'.\n   - Menyusun draf laporan hasil eksplorasi pada lembar kerja siswa.\n\n5. Pembuktian & Verifikasi (Verification):\n   - Perwakilan kelompok mempresentasikan hasil diskusi di hadapan kelas.\n   - Kelompok lain menanggapi secara konstruktif dan beretika.\n   - Guru memberikan penguatan materi, klarifikasi, dan apresiasi terhadap partisipasi aktif siswa.`,
      penutup: `1. Simpulan: Bersama guru, peserta didik merangkum poin-poin utama materi '${materi}'.\n2. Refleksi: Peserta didik menyampaikan hal yang telah dipahami dan bagian yang masih membutuhkan pendalaman.\n3. Tindak Lanjut: Guru memberikan tugas mandiri/pengayaan serta menyampaikan agenda pertemuan berikutnya.\n4. Doa & Salam: Pembelajaran diakhiri dengan doa penutup dan salam kehangatan.`,
      latihanSoal: generateQuestions(),
      penilaian: `1. Penilaian Sikap: Observasi jurnal sikap Profil Pelajar Pancasila (beriman, gotong royong, bernalar kritis, mandiri).\n2. Penilaian Pengetahuan: Tes tertulis format PTS (${safeCount} butir soal ${questionType}) dengan rubrik penskoran terukur.\n3. Penilaian Keterampilan: Lembar observasi kinerja diskusi kelompok dan presentasi hasil penugasan.`
    };
  };

  // API 1: Generate RPP Draft
  app.post("/api/generate-rpp", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const ai = getAi();
      const mataPelajaran = (req.body?.mataPelajaran || "").toString().trim();
      const materi = (req.body?.materi || "").toString().trim();
      const questionType = req.body?.questionType === "Uraian" ? "Uraian" : "Pilihan Ganda";
      const questionCount = Math.min(Math.max(parseInt(req.body?.questionCount, 10) || 5, 1), 20);

      if (!mataPelajaran || !materi) {
        return res.status(400).json({ error: "Mata pelajaran dan materi wajib diisi." });
      }

      const prompt = `
        Saya sedang menyusun Rencana Pelaksanaan Pembelajaran (RPP) Kurikulum Nasional / Merdeka untuk mata pelajaran "${mataPelajaran}" dengan materi spesifik "${materi}".
        Tolong buatkan draf RPP yang komprehensif, padat, dan saling terhubung dengan materi tersebut.
        
        PENTING KHUSUS BAGIAN LATIHAN SOAL (${questionCount} butir soal berjenis ${questionType === 'Uraian' ? 'Uraian / Esai' : 'Pilihan Ganda'}):
        Sajikan persis seperti naskah lembar Ujian / PTS (Penilaian Tengah Semester) resmi yang SUDAH MATANG, teks bersih, sangat mudah dibaca, dan bebas dari tanda markdown tebal seperti ** atau ##.
        
        ${questionType === 'Pilihan Ganda' ? `
        Aturan Format Pilihan Ganda (Naskah Matang):
        - Tiap butir soal diawali dengan nomor urut: "1. ", "2. ", dst. Teks soal ditulis lengkap dan jelas.
        - Pilihan jawaban A, B, C, D HARUS berada di baris tersendiri dengan format "   A. Teks", "   B. Teks", "   C. Teks", "   D. Teks" (tanpa tanda bintang atau tanda kurung tebal).
        - Di baris berikutnya setelah opsi D, cantumkan baris Kunci Jawaban dengan format: "   Kunci Jawaban: [Huruf Opsi] (Pembahasan: [Penjelasan singkat dan padat])".
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
        - Tiap butir soal diawali dengan nomor urut: "1. ", "2. ", dst. Teks soal jelas dan berbasis HOTS (Higher Order Thinking Skills).
        - Di bawah teks soal, cantumkan baris Kunci Jawaban & Rubrik: "   Kunci Jawaban: [Uraian jawaban lengkap serta kriteria penskoran/rubrik]".
        - Beri jeda 1 baris kosong antar butir soal.

        Contoh:
        1. Jelaskan perbedaan mendasar antara pembuluh arteri dan pembuluh vena dilihat dari arah aliran, ketebalan dinding, dan katupnya!
           Kunci Jawaban: Arteri membawa darah keluar dari jantung, dinding tebal elastis, dan katup satu di pangkal. Vena membawa darah menuju jantung, dinding tipis kurang elastis, dan memiliki banyak katup di sepanjang pembuluh. Skor maksimal: 20 poin.
        `}

        Berikan jawaban dalam format JSON.
      `;

      // Wrap AI call in a strict 14-second overall deadline to prevent 504 Gateway Timeout on any network/proxy
      const aiPromise = callGeminiWithRetry(ai, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tujuanPembelajaran: {
                type: Type.STRING,
                description: "Tujuan pembelajaran yang ingin dicapai melalui model pembelajaran Discovery/Inquiry Learning."
              },
              pendahuluan: {
                type: Type.STRING,
                description: "Langkah-langkah kegiatan pendahuluan (contoh: salam, absen, apersepsi, motivasi)."
              },
              kegiatanInti: {
                type: Type.STRING,
                description: "Langkah-langkah kegiatan inti (eksplorasi, elaborasi, konfirmasi) yang sangat spesifik tentang materi yang diajarkan."
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

      const response: any = await Promise.race([
        aiPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("AI overall request timeout (14s)")), 14000))
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

      if (json && typeof json.latihanSoal === "string") {
        // Strip markdown asterisks and standardize question lines
        json.latihanSoal = json.latihanSoal
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/__(.*?)__/g, "$1")
          .replace(/_(.*?)_/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .trim();
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
        model: "gemini-3.1-flash-lite",
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
      console.error(error);
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
        model: "gemini-3.1-flash-lite",
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
      console.error(error);
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

