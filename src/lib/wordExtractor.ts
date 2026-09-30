import * as mammoth from 'mammoth';
import { QuizQuestion, parseImportedQuestions } from '../types/quiz';

/**
 * Ekstraktor Soal dari Berkas Microsoft Word (.docx) & Teks (.txt)
 * Bekerja 100% di sisi klien & peramban mobile (Median APK, Android, iOS, Desktop)
 * Mendukung Bahasa Arab, Rumus Matematika, Pilihan Ganda, Esai, dan Penomoran Otomatis.
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
      const result = await mammoth.extractRawText({ arrayBuffer });
      rawText = (result?.value || '').trim();
    }

    if (!rawText || rawText.length < 10) {
      return {
        success: false,
        questions: [],
        text: '',
        error: 'Dokumen tidak memuat teks soal yang dapat dibaca.'
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
