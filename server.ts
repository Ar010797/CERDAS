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

  // Initialize Gemini Client
  const getAi = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
    return new GoogleGenAI({ 
      apiKey: key, 
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } 
    });
  };

  // Helper for Gemini retry
  const callGeminiWithRetry = async (ai: GoogleGenAI, params: any, maxRetries = 5) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await ai.models.generateContent(params);
      } catch (error: any) {
        const isRetryable = error?.status === 503 || error?.status === 429 || error?.status === 'UNAVAILABLE' || error?.error?.code === 503 || error?.error?.code === 429 || (error?.message && error.message.includes('503')) || (error?.message && error.message.includes('429')) || (error?.message && error.message.includes('UNAVAILABLE'));
        if (isRetryable) {
          if (i === maxRetries - 1) throw new Error("Layanan AI sedang sibuk karena tingginya permintaan. Mohon coba beberapa saat lagi.");
          const delay = Math.min(Math.pow(2, i) * 2000, 10000); // 2s, 4s, 8s, 10s...
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  };

  // API 1: Generate RPP Draft
  app.post("/api/generate-rpp", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const ai = getAi();
      const { mataPelajaran, materi, questionType, questionCount } = req.body;

      if (!mataPelajaran || !materi) {
        return res.status(400).json({ error: "mataPelajaran and materi are required." });
      }

      const prompt = `
        Saya sedang menyusun Rencana Pelaksanaan Pembelajaran (RPP) Kurikulum Nasional / Merdeka untuk mata pelajaran "${mataPelajaran}" dengan materi spesifik "${materi}".
        Tolong buatkan draf RPP yang komprehensif, padat, dan saling terhubung dengan materi tersebut.
        
        PENTING: KHUSUS LATIHAN SOAL (${questionCount || 5} soal berjenis ${questionType === 'Uraian' ? 'Uraian / Esai' : 'Pilihan Ganda'}):
        Sajikan persis seperti naskah naskah soal Ujian / PTS (Penilaian Tengah Semester) resmi dengan posisi, nomor, dan format yang SANGAT RAPI:
        ${questionType === 'Pilihan Ganda' ? `
        Format Pilihan Ganda PTS:
        - Tiap soal memiliki nomor urut jelas (1, 2, 3, dst).
        - Setiap pilihan (A, B, C, D) berada di baris baru dengan jarak dan indentasi teratur.
        - Di bawah setiap soal, sediakan 1 baris khusus Kunci Jawaban beserta ringkasan pembahasannya.
        
        Contoh penulisan:
        1. Berikut ini yang merupakan ciri utama dari ... adalah?
           A. Pilihan jawaban A
           B. Pilihan jawaban B
           C. Pilihan jawaban C
           D. Pilihan jawaban D
           Kunci Jawaban: A (Pembahasan: ...)

        2. Pertanyaan nomor dua ...?
           A. Pilihan jawaban A
           B. Pilihan jawaban B
           C. Pilihan jawaban C
           D. Pilihan jawaban D
           Kunci Jawaban: C (Pembahasan: ...)
        ` : `
        Format Uraian / Esai PTS:
        - Tiap soal memiliki nomor urut jelas (1, 2, 3, dst).
        - Di bawah setiap soal, sediakan Kunci Jawaban / Rubrik Penilaian yang jelas.
        
        Contoh penulisan:
        1. Jelaskan proses terjadinya ... dan sebutkan 3 contohnya!
           Kunci Jawaban / Rubrik: Pembahasan lengkap dan kriteria penskoran...

        2. Bagaimana hubungan antara ... dengan ...?
           Kunci Jawaban / Rubrik: Pembahasan lengkap dan kriteria penskoran...
        `}

        Berikan jawaban dalam format JSON.
      `;

      const response = await callGeminiWithRetry(ai, {
        model: "gemini-3.8-flash",
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
                description: `Daftar soal latihan (${questionCount || 5} butir) berjenis ${questionType === 'Uraian' ? 'Esai/Uraian' : 'Pilihan Ganda'}, diformat sangat rapi seperti naskah soal PTS dengan nomor, pilihan A-D di baris baru, dan kunci jawaban.`
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

      const text = response.text;
      if (!text) throw new Error("No response from Gemini");
      const json = JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
      res.json(json);

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to generate RPP" });
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

      const text = response.text;
      if (!text) throw new Error("No response from Gemini");
      const json = JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
