import { QuizQuestion, parseImportedQuestions } from '../types/quiz';

/**
 * Universal client-side question parser from raw text.
 * Delegates to the unified multi-subject parser in types/quiz.
 */
export function parseQuestionsFromText(rawText: string): QuizQuestion[] {
  return parseImportedQuestions(rawText);
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
