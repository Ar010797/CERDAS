import express from "express";
import path from "path";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
    try {
      const ai = getAi();
      const { mataPelajaran, materi, questionType, questionCount } = req.body;

      if (!mataPelajaran || !materi) {
        return res.status(400).json({ error: "mataPelajaran and materi are required." });
      }

      const prompt = `
        Saya sedang menyusun Rencana Pelaksanaan Pembelajaran (RPP) untuk mata pelajaran "${mataPelajaran}" dengan materi spesifik "${materi}".
        Tolong buatkan draf RPP yang komprehensif, saling terhubung dengan materi tersebut.
        Saya juga butuh dibuatkan latihan soal sebanyak ${questionCount || 5} soal dengan tipe ${questionType === 'Uraian' ? 'Esai / Uraian' : 'Pilihan Ganda'}.
        Berikan jawaban dalam format JSON.
      `;

      const response = await callGeminiWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tujuanPembelajaran: {
                type: Type.STRING,
                description: "Tujuan pembelajaran yang ingin dicapai melalui model pembelajaran Discovery Learning."
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
                description: "Langkah-langkah kegiatan penutup (kesimpulan, evaluasi, PR)."
              },
              latihanSoal: {
                type: Type.STRING,
                description: `Daftar soal latihan (${questionCount || 5} soal) berjenis ${questionType === 'Uraian' ? 'Esai' : 'Pilihan Ganda'}, dilengkapi jawaban/pembahasan. Gunakan nomor list 1. 2. 3. dst.`
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
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ai = getAi();
      const fileBuffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      const base64Data = fileBuffer.toString("base64");

      // Valid mime types for GenAI include PDF and plain text, maybe others.
      // If it's a docx, we might want to fallback to just raw parsing or sending it to gemini as application/octet-stream if supported, but typically PDF/TXT is safest.
      // For standard PDF, word, text:
      let finalMime = mimeType;
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
         // Some word formats might not be officially parsed by default image/pdf endpoints, but 3.8-flash can handle standard documents often, or we can just send as application/pdf if we parse it.
         // Let's pass it as is, or plain text if it's a simple file. 
         // But GenAI handles standard documents!
      }

      const response = await callGeminiWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: finalMime
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
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ai = getAi();
      const fileBuffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      const base64Data = fileBuffer.toString("base64");

      const response = await callGeminiWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            {
              text: `Ekstrak jadwal dari gambar/dokumen ini. Kembalikan array objek jadwal. Setiap jadwal harus memiliki 'type' ('pelajaran' atau 'ujian'), 'hari' (misal 'Senin' atau tanggal), 'jam' (misal '07:30 - 09:00'), 'mataPelajaran', 'pengajar' (nama guru/pengawas), dan opsional 'ruangan' atau 'keterangan'. Jika hari tidak terdeteksi, tebak berdasarkan baris/kolom.`
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

      const text = response.text;
      if (!text) throw new Error("No response from Gemini");
      const json = JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
      res.json(json);

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to extract schedule" });
    }
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
