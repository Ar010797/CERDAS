import * as mammoth from 'mammoth';
import { QuizQuestion, parseImportedQuestions } from '../types/quiz';

/**
 * Ekstraktor Soal dari Berkas Microsoft Word (.docx) & Teks (.txt)
 * Bekerja 100% di sisi klien & peramban mobile (Median APK, Android, iOS, Desktop)
 * Mendukung Bahasa Arab, Rumus Matematika, Pilihan Ganda, Esai, dan Penomoran Otomatis.
 * Mengonversi struktur tabel Word, paragraf, dan daftar berbutir menjadi teks terstruktur rapi.
 */
export async function extractQuestionsFromWord(file: File): Promise<{
  success: boolean;
  questions: QuizQuestion[];
  text: string;
  error?: string;
}> {
  try {
    const lowerName = file.name.toLowerCase();
    let rawText = '';

    if (lowerName.endsWith('.txt')) {
      rawText = await file.text();
    } else {
      const arrayBuffer = await file.arrayBuffer();

      // 1. Coba konversi via HTML untuk mempertahankan struktur tabel, kolom opsi, dan pemisah paragraf
      try {
        const htmlRes = await mammoth.convertToHtml({ arrayBuffer });
        if (htmlRes && htmlRes.value && htmlRes.value.trim().length > 10) {
          let converted = htmlRes.value;
          // Format sel tabel Word: sel baru dipisahkan tab, baris baru dipisahkan newline
          converted = converted.replace(/<\/td>\s*<td[^>]*>/gi, '\t');
          converted = converted.replace(/<\/tr>/gi, '\n');
          converted = converted.replace(/<\/p>|<\/div>|<\/li>|<br\s*\/?>/gi, '\n');
          // Buang sisa tag HTML
          converted = converted.replace(/<[^>]+>/g, ' ');
          // Dekode HTML entities umum
          converted = converted
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

          if (converted.trim().length > 15) {
            rawText = converted.trim();
          }
        }
      } catch (htmlErr) {
        console.warn('[Word Extractor] HTML conversion notice, fallback to rawText:', htmlErr);
      }

      // 2. Fallback ke ekstraksi raw text standar jika HTML kosong
      if (!rawText || rawText.length < 15) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        rawText = (result?.value || '').trim();
      }
    }

    if (!rawText || rawText.length < 10) {
      return {
        success: false,
        questions: [],
        text: '',
        error: 'Dokumen Word tidak memuat teks soal yang dapat dibaca.'
      };
    }

    const questions = parseImportedQuestions(rawText);
    return {
      success: questions.length > 0,
      questions,
      text: rawText
    };
  } catch (err: any) {
    console.warn('[Word Extractor] Client extract error:', err);
    return {
      success: false,
      questions: [],
      text: '',
      error: err?.message || 'Gagal mengekstrak naskah soal dari berkas Word.'
    };
  }
}
