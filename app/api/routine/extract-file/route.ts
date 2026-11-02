import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { NextResponse } from 'next/server';
import { parseRoutineFromExtractedText } from '@/lib/routineFileExtractor';

export const runtime = 'nodejs';

interface PdfTextItemLike {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
}

/**
 * Extracts text from a PDF buffer preserving horizontal table rows via Y-coordinate grouping.
 */
async function extractStructuredTextFromPdf(buffer: Buffer): Promise<string> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  const uint8 = new Uint8Array(buffer);

  try {
    const pdf = await getDocumentProxy(uint8);
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const items = (content.items ?? []) as PdfTextItemLike[];

      // Group text items by approximate Y coordinate (within 4pt tolerance) so PDF tables stay on one line
      const rows: { y: number; cells: { x: number; text: string }[] }[] = [];

      for (const item of items) {
        const text = (item.str ?? '').trim();
        if (!text) continue;
        const x = item.transform ? item.transform[4] ?? 0 : 0;
        const y = item.transform ? item.transform[5] ?? 0 : 0;

        let targetRow = rows.find((r) => Math.abs(r.y - y) <= 4.5);
        if (!targetRow) {
          targetRow = { y, cells: [] };
          rows.push(targetRow);
        }
        targetRow.cells.push({ x, text });
      }

      // PDF Y coordinates run bottom-to-top, so sort descending by Y, then ascending by X
      rows.sort((a, b) => b.y - a.y);

      const lines = rows.map((row) => {
        row.cells.sort((a, b) => a.x - b.x);
        return row.cells.map((c) => c.text).join('   ');
      });

      if (lines.length > 0) {
        pageTexts.push(lines.join('\n'));
      }
    }

    const combined = pageTexts.join('\n\n').trim();
    if (combined.length >= 15) {
      return combined;
    }
  } catch {
    // Fallback to standard extractText below
  }

  const fallback = await extractText(new Uint8Array(buffer), { mergePages: true });
  return typeof fallback.text === 'string' ? fallback.text : '';
}

/**
 * Extracts text from an image buffer using optional Gemini Vision (if GEMINI_API_KEY is set)
 * or built-in neural Spanish+English OCR via tesseract.js (100% local, zero API key required).
 */
async function extractTextFromImageBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const base64Data = buffer.toString('base64');
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Extrae exactamente la rutina de entrenamiento de esta imagen en texto plano línea por línea, manteniendo los días (ej. Lunes, Día 1) y cada ejercicio con sus series y repeticiones (ej. Press Militar 4x8-10). No agregues comentarios extra.',
                  },
                  {
                    inline_data: {
                      mime_type: mimeType || 'image/png',
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );
      if (resp.ok) {
        const json = (await resp.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const aiText = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (aiText && aiText.length >= 10) {
          return aiText;
        }
      }
    } catch {
      // Fallback seamlessly to local Tesseract OCR
    }
  }

  const isVercel = Boolean(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV);
  const cacheDir = isVercel
    ? path.join('/tmp', 'ocr-cache')
    : path.join(os.tmpdir(), 'kairos-ocr-cache');
  try {
    await fs.mkdir(cacheDir, { recursive: true });
  } catch {
    // Ignore if directory already exists or read-only
  }

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['spa', 'eng'], 1, {
    cachePath: cacheDir,
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text ?? '';
  } finally {
    await worker.terminate();
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Allow re-parsing edited raw text directly
    if (contentType.includes('application/json')) {
      const body = (await req.json()) as { rawText?: string; fileName?: string };
      const rawText = (body.rawText ?? '').trim();
      if (!rawText) {
        return NextResponse.json(
          { ok: false, error: 'El texto para analizar está vacío.' },
          { status: 400 }
        );
      }
      const parsed = parseRoutineFromExtractedText(rawText, body.fileName);
      return NextResponse.json({
        ok: true,
        extractedText: rawText,
        ...parsed,
      });
    }

    const formData = await req.formData();
    const uploadedEntries = formData.getAll('files');
    const singleFile = formData.get('file');
    const files: File[] = [];

    for (const item of uploadedEntries) {
      if (item instanceof File) files.push(item);
    }
    if (files.length === 0 && singleFile instanceof File) {
      files.push(singleFile);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Selecciona al menos una imagen o archivo PDF.' },
        { status: 400 }
      );
    }

    const textChunks: string[] = [];
    let primaryFileName = files[0].name;

    for (const file of files) {
      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const lowerName = (file.name || '').toLowerCase();
      const mime = (file.type || '').toLowerCase();

      if (mime.includes('pdf') || lowerName.endsWith('.pdf')) {
        const pdfText = await extractStructuredTextFromPdf(buffer);
        if (pdfText.trim().length > 0) {
          textChunks.push(pdfText);
        }
      } else if (
        mime.startsWith('image/') ||
        /\.(png|jpe?g|webp|bmp|gif|heic)$/i.test(lowerName)
      ) {
        const ocrText = await extractTextFromImageBuffer(buffer, mime || 'image/png');
        if (ocrText.trim().length > 0) {
          textChunks.push(ocrText);
        }
      } else {
        // Plain text fallback (.txt / .csv)
        textChunks.push(buffer.toString('utf-8'));
      }
    }

    const combinedText = textChunks.join('\n\n').trim();
    if (!combinedText) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No se pudo leer texto legible del archivo. Si es un PDF escaneado oscuro, prueba subiendo una captura de pantalla nítida.',
        },
        { status: 422 }
      );
    }

    const parsed = parseRoutineFromExtractedText(combinedText, primaryFileName);

    return NextResponse.json({
      ok: true,
      extractedText: combinedText,
      ...parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al analizar el archivo.';
    return NextResponse.json(
      { ok: false, error: `No se pudo procesar el archivo: ${msg}` },
      { status: 500 }
    );
  }
}
