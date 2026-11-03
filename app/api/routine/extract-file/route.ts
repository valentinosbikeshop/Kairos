import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { NextResponse } from 'next/server';
import {
  parseRoutineFromExtractedText,
  RoutineExtractionResult,
} from '@/lib/routineFileExtractor';
import { resolveExerciseIntelligently } from '@/lib/exerciseClassifierEngine';
import { toLocalDateKey, uid } from '@/lib/formatters';
import {
  RoutineDayPlan,
  RoutineExercisePrescription,
  RoutineScheduleType,
  TrainingMode,
} from '@/types/kairos';

export const runtime = 'nodejs';

interface PdfTextItemLike {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
}

/**
 * Uses Gemini AI to understand contextual routine notes, extract performance loads (targetWeightKg),
 * preserve all biomechanical and equipment details ("en máquina", "en smith", "con mancuernas"),
 * and cleanly separate adjacent workout sections without header contamination.
 */
async function extractStructuredRoutineWithGemini(
  rawText: string,
  fileName?: string
): Promise<RoutineExtractionResult | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;

  try {
    const prompt =
      `Eres el motor de análisis y extracción de entrenamientos de KAIROS (app de fitness y biomecánica avanzada).\n` +
      `Tu objetivo es transformar el texto sin formato provisto por el usuario (copiado de notas, WhatsApp, o portapapeles) en una rutina estructurada y limpia.\n\n` +
      `REGLAS CRÍTICAS DE EXTRACCIÓN:\n` +
      `1. Nombres de ejercicios: Conserva SIEMPRE detalles biomecánicos y de equipamiento (ej: 'en máquina', 'con mancuernas', 'en polea', 'en smith', 'agarre neutro', 'unilateral', 'inclinado 30°'). NUNCA elimines estos modificadores del nombre.\n` +
      `2. Eliminación de RUIDO en el nombre: NUNCA dejes en el nombre cargas/pesos (ej: '120kg'), series/reps (ej: ': 2', '4x10'), ni nombres de secciones o días adyacentes (ej: '2. Espalda').\n` +
      `3. Cargas y Pesos (targetWeightKg): Si el texto indica el peso con el que entrena o levantó el usuario (ej: '120kg', '80kg', '40 lbs'), extráelo como número en 'targetWeightKg'.\n` +
      `4. Series y Repeticiones: Si el texto dice '120kg : 2' significa 2 series con 120kg. Extrae 'sets', 'repsNum', 'repRangeLabel', 'rir' ('0'|'1'|'2'|'3'), 'restSeconds'.\n` +
      `5. Agrupación por Días o Secciones: Si hay títulos como '2. Espalda', 'Lunes - Pecho', 'Día 1: Torso', crea un día o sección separado para cada uno. Jamás agregues el título de un día dentro del nombre de un ejercicio.\n\n` +
      `Texto a analizar:\n"""\n${rawText.slice(0, 8000)}\n"""\n\n` +
      `Responde ÚNICAMENTE un JSON con esta estructura exacta (sin markdown ni explicaciones adicionales):\n` +
      `{\n` +
      `  "routineName": "${fileName || 'Rutina Personalizada'}",\n` +
      `  "scheduleType": "cyclic",\n` +
      `  "days": [\n` +
      `    {\n` +
      `      "label": "Día 1",\n` +
      `      "focusTitle": "Pecho y Tríceps",\n` +
      `      "isRestDay": false,\n` +
      `      "primaryMode": "hypertrophy",\n` +
      `      "exercises": [\n` +
      `        {\n` +
      `          "name": "Press Plano en Máquina",\n` +
      `          "sets": 2,\n` +
      `          "repsNum": 10,\n` +
      `          "repRangeLabel": "8-10 reps",\n` +
      `          "rir": "2",\n` +
      `          "restSeconds": 105,\n` +
      `          "targetWeightKg": 120\n` +
      `        }\n` +
      `      ]\n` +
      `    }\n` +
      `  ]\n` +
      `}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawAi = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawAi) return null;

    const parsedData = JSON.parse(rawAi);
    if (!parsedData || !Array.isArray(parsedData.days) || parsedData.days.length === 0) {
      return null;
    }

    const days: RoutineDayPlan[] = parsedData.days.map((d: any, dIdx: number) => {
      const exercises: RoutineExercisePrescription[] = Array.isArray(d.exercises)
        ? d.exercises.map((e: any) => {
            const resolved = resolveExerciseIntelligently(e.name || 'Ejercicio');
            return {
              catalogId: resolved.canonicalCatalogId,
              name: e.name || resolved.canonicalName,
              mode: (e.mode as TrainingMode) || resolved.mode,
              sets: typeof e.sets === 'number' && e.sets > 0 ? e.sets : 3,
              repsNum: typeof e.repsNum === 'number' && e.repsNum > 0 ? e.repsNum : 10,
              repRangeLabel: e.repRangeLabel || `${e.repsNum || 10} reps`,
              rir: (['0', '1', '2', '3'].includes(e.rir) ? e.rir : '2') as any,
              restSeconds:
                typeof e.restSeconds === 'number' && e.restSeconds > 0
                  ? e.restSeconds
                  : resolved.defaultRestSeconds,
              targetWeightKg:
                typeof e.targetWeightKg === 'number' && e.targetWeightKg > 0
                  ? e.targetWeightKg
                  : undefined,
              note: e.note || undefined,
            };
          })
        : [];

      return {
        id: uid('rday'),
        label: d.label || `Día ${dIdx + 1}`,
        focusTitle: d.focusTitle || 'Entrenamiento',
        isRestDay: Boolean(d.isRestDay),
        primaryMode: (d.primaryMode as TrainingMode) || 'hypertrophy',
        estimatedMinutes: Math.max(35, exercises.length * 10),
        exercises,
      };
    });

    const activeDaysCount = days.filter((d) => !d.isRestDay).length;
    const totalExercisesCount = days.reduce((acc, d) => acc + d.exercises.length, 0);

    return {
      routine: {
        id: uid('rtn'),
        name: parsedData.routineName || fileName || 'Rutina Personalizada',
        scheduleType: (parsedData.scheduleType as RoutineScheduleType) || 'cyclic',
        source: 'manual',
        createdAtIso: new Date().toISOString(),
        cycleAnchorDateKey: toLocalDateKey(),
        cycleOffsetDays: 0,
        adaptedOverride: null,
        days,
      },
      detectedScheduleType: (parsedData.scheduleType as RoutineScheduleType) || 'cyclic',
      activeDaysCount,
      totalExercisesCount,
      warnings: [],
    };
  } catch {
    return null;
  }
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
      // 1. Try contextual Gemini AI extraction if key is present
      const geminiResult = await extractStructuredRoutineWithGemini(rawText, body.fileName);
      // 2. Fallback to enhanced local deterministic regex & AST parser
      const parsed =
        geminiResult && geminiResult.totalExercisesCount > 0
          ? geminiResult
          : parseRoutineFromExtractedText(rawText, body.fileName);

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

    // 1. Try contextual Gemini AI extraction if key is present
    const geminiResult = await extractStructuredRoutineWithGemini(combinedText, primaryFileName);
    // 2. Fallback to enhanced local deterministic regex & AST parser
    const parsed =
      geminiResult && geminiResult.totalExercisesCount > 0
        ? geminiResult
        : parseRoutineFromExtractedText(combinedText, primaryFileName);

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
