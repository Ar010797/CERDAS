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

  // Helper for Gemini retry with multi-model fallback to survive 503/429 spikes
  const callGeminiWithRetry = async (ai: GoogleGenAI, params: any, maxRetries = 3) => {
    const requestedModel = params.model || "gemini-3.8-flash";
    // Models to try in sequence: requested model first, then ultra-fast low-latency lite model, then flash alias
    const modelCandidates: string[] = [requestedModel];
    if (requestedModel !== "gemini-3.1-flash-lite") {
      modelCandidates.push("gemini-3.1-flash-lite");
    }
    if (!modelCandidates.includes("gemini-flash-latest")) {
      modelCandidates.push("gemini-flash-latest");
    }

    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      for (const currentModel of modelCandidates) {
        try {
          const currentParams = { ...params, model: currentModel };
          return await ai.models.generateContent(currentParams);
        } catch (error: any) {
          lastError = error;
          const status = error?.status || error?.error?.code || error?.code;
          const msg = (error?.message || "").toLowerCase();
          const isOverloadedOrRateLimited =
            status === 503 ||
            status === 429 ||
            status === 500 ||
            msg.includes("503") ||
            msg.includes("429") ||
            msg.includes("unavailable") ||
            msg.includes("high demand") ||
            msg.includes("overloaded") ||
            msg.includes("spikes in demand") ||
            msg.includes("quota") ||
            msg.includes("rate limit") ||
            msg.includes("resource has been exhausted");

          if (isOverloadedOrRateLimited) {
            console.warn(`[Gemini Fallback] Model ${currentModel} returned ${status} (${msg.slice(0, 80)}). Trying alternative model...`);
            continue; // Immediately try the next candidate model
          }

          // Fatal client error (e.g. invalid arguments or bad schema)
          throw error;
        }
      }

      // If all candidate models were busy in this round, back off briefly before retrying
      if (attempt < maxRetries - 1) {
        const delay = (attempt + 1) * 1200;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.error("[Gemini Fallback] All model attempts exhausted:", lastError);
    throw new Error("Layanan AI sedang mengalami lonjakan permintaan tinggi. Silakan coba kembali dalam beberapa saat.");
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
        
        PENTING: KHUSUS LATIHAN SOAL (${questionCount} butir soal berjenis ${questionType === 'Uraian' ? 'Uraian / Esai' : 'Pilihan Ganda'}):
        Sajikan persis seperti naskah lembar Ujian / PTS (Penilaian Tengah Semester) resmi dengan posisi, nomor, dan format yang SANGAT RAPI:
        ${questionType === 'Pilihan Ganda' ? `
        Format Pilihan Ganda PTS:
        - Tiap soal memiliki nomor urut jelas (1, 2, 3, dst).
        - Setiap pilihan (A, B, C, D) HARUS berada di baris tersendiri dengan indentasi teratur.
        - Di bawah setiap soal, sediakan baris khusus Kunci Jawaban beserta ringkasan pembahasannya.
        
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
           Kunci Jawaban: Pembahasan lengkap dan kriteria penskoran...

        2. Bagaimana hubungan antara ... dengan ...?
           Kunci Jawaban: Pembahasan lengkap dan kriteria penskoran...
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

      res.json(json);

    } catch (error: any) {
      console.error("Error in /api/generate-rpp:", error);
      res.status(500).json({ error: error.message || "Gagal menyusun draft E-RPP otomatis." });
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

