import { QuizQuestion, QuizOption } from '../types/quiz';

/**
 * Intelligent client-side question parser from raw text.
 * Handles Indonesian school exams, worksheets, homework, and test papers.
 * Supports:
 * - Numbering formats: 1., 1), No. 1, Soal 1, [1], (1)
 * - Multiple choice options on separate lines (A. / B. / C. / D.)
 * - Horizontal options on the same line (e.g. A. 1/2   B. 2/4   C. 3/4   D. 4/4) - common in math/fractions!
 * - Essay questions (no options)
 * - Answer key blocks at the end (e.g. "Kunci Jawaban: 1. A, 2. B, 3. C")
 */
export function parseQuestionsFromText(rawText: string): QuizQuestion[] {
  if (!rawText || rawText.trim().length === 0) return [];

  // 1. Check for answer key block at bottom
  const answerKeyMap = new Map<number, string>();
  const answerKeyBlockMatch = rawText.match(/(?:Kunci\s*(?:Jawaban)?|KUNCI\s*JAWABAN)[:\s]+([\s\S]+?)(?=$|\n\s*\n\s*[A-Z])/i);
  if (answerKeyBlockMatch && answerKeyBlockMatch[1]) {
    const keyPairs = [...answerKeyBlockMatch[1].matchAll(/(\d+)[\.\):\s]+([A-Da-d])/g)];
    for (const kp of keyPairs) {
      answerKeyMap.set(parseInt(kp[1], 10), kp[2].toUpperCase());
    }
  }

  // Remove the answer key block from the question parsing text
  let cleanText = rawText;
  if (answerKeyBlockMatch) {
    cleanText = rawText.slice(0, answerKeyBlockMatch.index);
  }

  const lines = cleanText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const parsedItems: Array<{
    number: number;
    questionText: string;
    options: QuizOption[];
    type: 'multiple_choice' | 'essay';
    correctAnswer: string;
    points: number;
    explanation?: string;
  }> = [];

  let currentItem: typeof parsedItems[0] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line starts with question number:
    // e.g. "1.", "1)", "1 .", "No. 1", "Soal 1:", "[1]", "(1)"
    const numMatch = line.match(/^(?:(?:Soal|Nomor|No\.?)\s*)?\(?(\d+)[\.\)\]]\s*(.+)/i);
    if (numMatch) {
      if (currentItem) {
        parsedItems.push(currentItem);
      }
      const qNum = parseInt(numMatch[1], 10);
      currentItem = {
        number: qNum,
        questionText: numMatch[2].trim(),
        options: [],
        type: 'multiple_choice',
        correctAnswer: answerKeyMap.get(qNum) || 'A',
        points: 10,
        explanation: 'Kunci jawaban & pembahasan'
      };
      continue;
    }

    if (!currentItem) continue;

    // A. Check for horizontal options on the same line:
    // e.g. "A. 1/4   B. 2/4   C. 3/4   D. 4/4" or "A) 1/4  B) 2/4"
    const horizontalOptions = [
      ...line.matchAll(/(?:^|\s+)([A-D])[\.\)]\s*([^\s][^A-D\n]*?)(?=(?:\s+[A-D][\.\)]|$))/gi)
    ];

    if (horizontalOptions.length >= 2) {
      for (const m of horizontalOptions) {
        currentItem.options.push({
          id: m[1].toUpperCase(),
          text: m[2].trim()
        });
      }
      continue;
    }

    // B. Check for single vertical option:
    // e.g. "A. Pilihan satu", "a. pilihan", "(A) Pilihan"
    const singleOptMatch = line.match(/^(?:\()?([A-D])[\.\)]\s*(.+)/i);
    if (singleOptMatch) {
      currentItem.options.push({
        id: singleOptMatch[1].toUpperCase(),
        text: singleOptMatch[2].trim()
      });
      continue;
    }

    // C. Check for inline answer indicator:
    // e.g. "Kunci: A" or "Jawaban: B"
    const ansMatch = line.match(/^(?:Kunci|Jawaban)\s*[:=]\s*([A-Da-d])/i);
    if (ansMatch) {
      currentItem.correctAnswer = ansMatch[1].toUpperCase();
      continue;
    }

    // D. Otherwise, if no options have been recorded yet, append to question text
    if (currentItem.options.length === 0) {
      currentItem.questionText += ' ' + line;
    }
  }

  if (currentItem) {
    parsedItems.push(currentItem);
  }

  // Post-process and sanitize items
  return parsedItems.map((item, idx) => {
    // If fewer than 2 options were extracted, classify as essay
    const isEssay = item.options.length < 2;
    const finalType = isEssay ? 'essay' : 'multiple_choice';

    let finalOptions: QuizOption[] | undefined = undefined;
    if (!isEssay) {
      // Deduplicate options by ID
      const optMap = new Map<string, string>();
      for (const opt of item.options) {
        if (!optMap.has(opt.id)) {
          optMap.set(opt.id, opt.text);
        }
      }
      finalOptions = Array.from(optMap.entries()).map(([id, text]) => ({
        id,
        text: text.replace(/^[A-D][\.\)]\s*/i, '').trim() || `Pilihan ${id}`
      }));
    }

    return {
      id: `q_extracted_${Date.now()}_${idx + 1}`,
      type: finalType,
      questionText: item.questionText.replace(/^\d+[\.\)]\s*/, '').trim(),
      points: isEssay ? 20 : 10,
      options: finalOptions,
      correctAnswer: item.correctAnswer || (isEssay ? '' : 'A'),
      explanation: item.explanation || (isEssay ? 'Jawaban esai' : `Pilihan yang benar adalah ${item.correctAnswer || 'A'}`)
    };
  });
}

/**
 * Extracts raw readable text directly from a PDF ArrayBuffer or base64 in the browser/WebView.
 * Reads:
 * 1. Text enclosed in parenthesis: ( ... ) Tj and [ (...) ... ] TJ
 * 2. Text blocks in BT ... ET
 * 3. Decompresses FlateDecode (deflate) streams using native DecompressionStream if available
 */
export async function extractTextFromPdfData(
  data: ArrayBuffer | Uint8Array | string
): Promise<string> {
  let uint8: Uint8Array;

  if (typeof data === 'string') {
    // Clean base64
    let cleanB64 = data;
    if (cleanB64.includes('base64,')) {
      cleanB64 = cleanB64.split('base64,')[1];
    }
    const binary = atob(cleanB64);
    uint8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      uint8[i] = binary.charCodeAt(i);
    }
  } else if (data instanceof ArrayBuffer) {
    uint8 = new Uint8Array(data);
  } else {
    uint8 = data;
  }

  // Convert to latin1 string for regex inspection
  let binaryStr = '';
  // Chunking to avoid stack overflow with huge buffers
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.subarray(i, i + chunkSize);
    binaryStr += String.fromCharCode.apply(null, chunk as any);
  }

  const collectedPieces: string[] = [];

  // 1. Direct BT ... ET text blocks
  const btMatches = binaryStr.match(/BT[\s\S]*?ET/g) || [];
  for (const block of btMatches) {
    // Match (Text) Tj
    const tjMatches = block.match(/\(([^)]+)\)\s*Tj/g) || [];
    for (const m of tjMatches) {
      const match = m.match(/\(([^)]+)\)\s*Tj/);
      if (match && match[1]) {
        const decoded = match[1].replace(/\\([nrtbf\\])/g, ' ').trim();
        if (decoded.length > 0) collectedPieces.push(decoded);
      }
    }

    // Match [(T) 20 (ext)] TJ array format
    const tjArrayMatches = block.match(/\[([\s\S]*?)\]\s*TJ/g) || [];
    for (const arr of tjArrayMatches) {
      const innerT = arr.match(/\(([^)]+)\)/g) || [];
      const joined = innerT.map(x => x.slice(1, -1).replace(/\\([nrtbf\\])/g, ' ')).join('').trim();
      if (joined.length > 0) collectedPieces.push(joined);
    }
  }

  // 2. Try native DecompressionStream for FlateDecode streams if few pieces were found
  if (collectedPieces.length < 5 && typeof DecompressionStream !== 'undefined') {
    try {
      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let match: RegExpExecArray | null;

      while ((match = streamRegex.exec(binaryStr)) !== null) {
        const streamData = match[1];
        if (!streamData || streamData.length < 10) continue;

        try {
          const rawBytes = new Uint8Array(streamData.length);
          for (let j = 0; j < streamData.length; j++) {
            rawBytes[j] = streamData.charCodeAt(j);
          }

          // In PDF, FlateDecode streams typically have a 2-byte zlib header (0x78)
          // We can use 'deflate' or 'deflate-raw'
          const ds = new DecompressionStream('deflate');
          const writer = ds.writable.getWriter();
          writer.write(rawBytes).catch(() => {});
          writer.close().catch(() => {});

          const reader = ds.readable.getReader();
          let decompressedStr = '';
          const decoder = new TextDecoder('latin1');

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) decompressedStr += decoder.decode(value, { stream: true });
          }

          if (decompressedStr && decompressedStr.length > 20) {
            // Extract text from decompressed PDF stream
            const innerBt = decompressedStr.match(/BT[\s\S]*?ET/g) || [];
            for (const b of innerBt) {
              const inTj = b.match(/\(([^)]+)\)\s*Tj/g) || [];
              for (const it of inTj) {
                const subMatch = it.match(/\(([^)]+)\)\s*Tj/);
                if (subMatch && subMatch[1]) {
                  const cl = subMatch[1].replace(/\\([nrtbf\\])/g, ' ').trim();
                  if (cl.length > 0) collectedPieces.push(cl);
                }
              }
            }
          }
        } catch {
          // Continue to next stream
        }
      }
    } catch {
      // DecompressionStream fallback ignored
    }
  }

  // 3. Fallback: match any text string in parentheses with typical sentence length
  if (collectedPieces.length < 3) {
    const generalMatches = binaryStr.match(/\(([a-zA-Z0-9\s.,?!:;/'"()_+=-]{3,})\)/g) || [];
    for (const gm of generalMatches) {
      const clean = gm.slice(1, -1).trim();
      if (clean.length > 2 && !clean.startsWith('/') && !clean.includes('CreationDate')) {
        collectedPieces.push(clean);
      }
    }
  }

  return collectedPieces.join('\n');
}

/**
 * Universal client-side extractor that works on ANY Android device, WebView, iOS, or desktop.
 * Runs instantly without depending on server availability.
 */
export async function extractQuestionsDirectlyFromPdf(
  fileOrBase64: File | string
): Promise<{
  success: boolean;
  questions: QuizQuestion[];
  text: string;
  source: 'client_local_extractor';
}> {
  let base64 = '';

  if (typeof fileOrBase64 === 'string') {
    base64 = fileOrBase64;
  } else {
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = (reader.result as string) || '';
        resolve(res.includes('base64,') ? res.split('base64,')[1] : res);
      };
      reader.onerror = () => reject(new Error('Gagal membaca berkas di perangkat Anda.'));
      reader.readAsDataURL(fileOrBase64);
    });
  }

  const extractedText = await extractTextFromPdfData(base64);
  const questions = parseQuestionsFromText(extractedText);

  return {
    success: questions.length > 0,
    questions,
    text: extractedText,
    source: 'client_local_extractor'
  };
}
