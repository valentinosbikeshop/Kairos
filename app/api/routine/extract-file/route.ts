import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { NextResponse } from 'next/server';
import {
  parseRoutineFromExtractedText,
  RoutineExtractionResult,
} from '@/lib/routineFileExtractor';
import { resolveExerciseIntelligently } from '@/lib/exerciseClassifierEngine';
import { generateWithGeminiCascade, parseCleanJsonFromAi } from '@/lib/geminiClient';
import { inferWeekdayIndexFromText } from '@/lib/aiRoutineEngine';
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
 * Uses Gemini AI (via Anti-Saturation Cascade) to understand contextual routine notes,
 * extract performance loads (targetWeightKg), preserve all biomechanical and equipment details,
 * and cleanly separate adjacent workout sections without header contamination.
 */
async function extractStructuredRoutineWithGemini(
  rawText: string,
  fileName?: string
): Promise<RoutineExtractionResult | null> {
  try {
    const prompt =
      `Eres el motor de análisis y extracción de entrenamientos de KAIROS (app de fitness y biomecánica avanzada).\n` +
      `Tu objetivo es transformar el texto sin formato provisto por el usuario (copiado de notas, WhatsApp, PDF o portapapeles) en una rutina estructurada y limpia.\n\n` +
      `REGLAS CRÍTICAS DE EXTRACCIÓN:\n` +
      `1. Nombres de ejercicios: Conserva SIEMPRE detalles biomecánicos y de equipamiento (ej: 'en máquina', 'con mancuernas', 'en polea', 'en smith', 'agarre neutro', 'unilateral', 'inclinado 30°'). NUNCA elimines estos modificadores del nombre.\n` +
      `2. Eliminación de RUIDO en el nombre: NUNCA dejes en el nombre cargas/pesos (ej: '120kg'), series/reps (ej: ': 2', '4x10'), ni nombres de secciones o días adyacentes (ej: '2. Espalda').\n` +
      `3. Cargas y Pesos (targetWeightKg): Si el texto indica el peso con el que entrena o levantó el usuario (ej: '120kg', '80kg', '40 lbs'), extráelo como número en 'targetWeightKg'.\n` +
      `4. Series y Repeticiones: Si el texto dice '120kg : 2' significa 2 series con 120kg. Extrae 'sets', 'repsNum', 'repRangeLabel', 'rir' ('0'|'1'|'2'|'3'), 'restSeconds'.\n` +
      `5. Agrupación por Días: Extrae TODOS los días presentes en el texto con TODOS sus ejercicios correspondientes. Si un título es un subgrupo muscular dentro del mismo día (ej: '1. Pecho' y '2. Espalda' dentro de un día de Torso), agrúpalos en el día correspondiente o en días separados completos, pero NUNCA dejes un día de entrenamiento con 'exercises: []' vacío.\n` +
      `6. Si los días son días de la semana (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo), pon "scheduleType": "weekday". Si son Día 1, Día 2, Torso, Pierna, etc., pon "scheduleType": "cyclic".\n\n` +
      `Texto a analizar:\n"""\n${rawText.slice(0, 8000)}\n"""\n\n` +
      `Responde ÚNICAMENTE un JSON con esta estructura exacta (sin markdown ni explicaciones adicionales):\n` +
      `{\n` +
      `  "routineName": "${fileName || 'Rutina Personalizada'}",\n` +
      `  "scheduleType": "cyclic",\n` +
      `  "days": [\n` +
      `    {\n` +
      `      "label": "Día 1",\n` +
      `      "focusTitle": "Torso",\n` +
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

    const aiRes = await generateWithGeminiCascade({
      prompt,
      tier: 'pro',
      temperature: 0.1,
      responseMimeType: 'application/json',
      cacheTtlMs: 30 * 60_000,
    });

    const parsedData = parseCleanJsonFromAi<{
      routineName?: string;
      scheduleType?: RoutineScheduleType;
      days?: any[];
    }>(aiRes.text);

    if (!parsedData || !Array.isArray(parsedData.days) || parsedData.days.length === 0) {
      return null;
    }

    const localFallback = parseRoutineFromExtractedText(rawText, fileName);

    let days: RoutineDayPlan[] = parsedData.days.map((d: any, dIdx: number) => {
      const rawExercises = Array.isArray(d.exercises) ? d.exercises : [];
      const exercises: RoutineExercisePrescription[] = rawExercises.map((e: any) => {
        const resolved = resolveExerciseIntelligently(e.name || 'Ejercicio');
        return {
          catalogId: resolved.canonicalCatalogId,
          name: resolved.canonicalName || e.name || 'Ejercicio',
          mode: (e.mode as TrainingMode) || resolved.mode,
          sets: typeof e.sets === 'number' && e.sets > 0 ? e.sets : 3,
          repsNum: typeof e.repsNum === 'number' && e.repsNum > 0 ? e.repsNum : 10,
          repRangeLabel: e.repRangeLabel || `${e.repsNum || 10} reps`,
          rir: (['0', '1', '2', '3'].includes(String(e.rir)) ? String(e.rir) : '2') as any,
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
      });

      // Cross-verify: if Gemini left this non-rest day with 0 exercises, backfill from deterministic parser
      const isRest = Boolean(d.isRestDay);
      if (!isRest && exercises.length === 0 && localFallback.routine.days[dIdx]?.exercises?.length) {
        exercises.push(...localFallback.routine.days[dIdx].exercises);
      }

      const labelStr = d.label || `Día ${dIdx + 1}`;
      const focusStr = d.focusTitle || (isRest ? 'Descanso' : 'Entrenamiento');
      const inferredWd =
        inferWeekdayIndexFromText(labelStr) ?? inferWeekdayIndexFromText(focusStr);

      return {
        id: uid('rday'),
        label: labelStr,
        weekdayIndex: inferredWd,
        focusTitle: focusStr,
        isRestDay: isRest && exercises.length === 0,
        primaryMode: (d.primaryMode as TrainingMode) || 'hypertrophy',
        estimatedMinutes: isRest && exercises.length === 0 ? 0 : Math.max(35, exercises.length * 10),
        exercises,
      };
    });

    // Never keep broken non-rest days with 0 exercises if there are populated active days
    const hasPopulatedDays = days.some((d) => d.exercises.length > 0);
    if (hasPopulatedDays) {
      days = days.filter((d) => d.exercises.length > 0 || d.isRestDay);
      // Re-index cyclic day labels cleanly if cyclic
      if (parsedData.scheduleType !== 'weekday') {
        days = days.map((d, idx) => ({
          ...d,
          label: inferWeekdayIndexFromText(d.label) !== undefined ? d.label : `Día ${idx + 1}`,
        }));
      }
    }

    const weekdayCount = days.filter((d) => d.weekdayIndex !== undefined).length;
    const resolvedScheduleType: RoutineScheduleType =
      weekdayCount >= 2 ? 'weekday' : (parsedData.scheduleType as RoutineScheduleType) || 'cyclic';

    const activeDaysCount = days.filter((d) => !d.isRestDay && d.exercises.length > 0).length;
    const totalExercisesCount = days.reduce((acc, d) => acc + d.exercises.length, 0);

    // If local deterministic parser extracted significantly more exercises or active days, prefer local
    if (
      localFallback.totalExercisesCount > totalExercisesCount &&
      localFallback.activeDaysCount >= activeDaysCount
    ) {
      return localFallback;
    }

    return {
      routine: {
        id: uid('rtn'),
        name: parsedData.routineName || fileName || 'Rutina Personalizada',
        scheduleType: resolvedScheduleType,
        source: 'manual',
        createdAtIso: new Date().toISOString(),
        cycleAnchorDateKey: toLocalDateKey(),
        cycleOffsetDays: 0,
        adaptedOverride: null,
        days,
      },
      detectedScheduleType: resolvedScheduleType,
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
  try {
    const base64Data = buffer.toString('base64');
    const aiRes = await generateWithGeminiCascade({
      prompt:
        'Extrae exactamente la rutina de entrenamiento de esta imagen en texto plano línea por línea, manteniendo todos los días (ej. Lunes, Día 1, Torso, Pierna) y cada ejercicio con sus series, repeticiones y kilos (ej. Press Militar 4x8-10 60kg). No agregues comentarios extra.',
      tier: 'vision',
      temperature: 0.1,
      inlineImage: {
        mimeType: mimeType || 'image/png',
        base64Data,
      },
      cacheTtlMs: 30 * 60_000,
    });

    if (aiRes.ok && aiRes.text && aiRes.text.length >= 10) {
      return aiRes.text;
    }
  } catch {
    // Fallback seamlessly to local Tesseract OCR
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
