import {
  RirValue,
  RoutineDayPlan,
  RoutineExercisePrescription,
  RoutineScheduleType,
  TrainingMode,
  UserRoutine,
} from '@/types/kairos';
import { ORDERED_WEEKDAYS } from '@/lib/aiRoutineEngine';
import { BUILTIN_EXERCISES, smartSearchExercises } from '@/lib/exerciseDatabase';
import { toLocalDateKey, uid } from '@/lib/formatters';

export interface RoutineExtractionResult {
  routine: UserRoutine;
  detectedScheduleType: RoutineScheduleType;
  activeDaysCount: number;
  totalExercisesCount: number;
  warnings: string[];
}

const WEEKDAY_HEADER_PATTERNS: { index: number; label: string; regex: RegExp }[] = [
  {
    index: 1,
    label: 'Lunes',
    regex: /^(?:[\d#•\-*▪◦]+\s*[.):\-]?\s*)?(?:d[ií]a\s+)?(?:lunes|monday)\b(?:\s*[:\-–—|/()]\s*(.*))?$/i,
  },
  {
    index: 2,
    label: 'Martes',
    regex: /^(?:[\d#•\-*▪◦]+\s*[.):\-]?\s*)?(?:d[ií]a\s+)?(?:martes|tuesday)\b(?:\s*[:\-–—|/()]\s*(.*))?$/i,
  },
  {
    index: 3,
    label: 'Miércoles',
    regex: /^(?:[\d#•\-*▪◦]+\s*[.):\-]?\s*)?(?:d[ií]a\s+)?(?:mi[eé]rcoles|wednesday)\b(?:\s*[:\-–—|/()]\s*(.*))?$/i,
  },
  {
    index: 4,
    label: 'Jueves',
    regex: /^(?:[\d#•\-*▪◦]+\s*[.):\-]?\s*)?(?:d[ií]a\s+)?(?:jueves|thursday)\b(?:\s*[:\-–—|/()]\s*(.*))?$/i,
  },
  {
    index: 5,
    label: 'Viernes',
    regex: /^(?:[\d#•\-*▪◦]+\s*[.):\-]?\s*)?(?:d[ií]a\s+)?(?:viernes|friday)\b(?:\s*[:\-–—|/()]\s*(.*))?$/i,
  },
  {
    index: 6,
    label: 'Sábado',
    regex: /^(?:[\d#•\-*▪◦]+\s*[.):\-]?\s*)?(?:d[ií]a\s+)?(?:s[aá]bado|saturday)\b(?:\s*[:\-–—|/()]\s*(.*))?$/i,
  },
  {
    index: 0,
    label: 'Domingo',
    regex: /^(?:[\d#•\-*▪◦]+\s*[.):\-]?\s*)?(?:d[ií]a\s+)?(?:domingo|sunday)\b(?:\s*[:\-–—|/()]\s*(.*))?$/i,
  },
];

const CYCLIC_DAY_REGEX =
  /^(?:[•\-*▪◦]+\s*)?(?:d[ií]a|day|sesi[oó]n|entrenamiento|rutina|workout|bloque)\s*#?\s*(\d+|[a-f])\b(?:\s*[:\-–—|/()]\s*(.*))?$/i;

const STANDALONE_SPLIT_REGEX =
  /^(?:torso|pierna|piernas|empuje|tir[oó]n|jale|push|pull|legs|upper|lower|full\s*body|cuerpo\s*completo|pecho\s+y\s+\w+|espalda\s+y\s+\w+|hombro[s]?\s+y\s+\w+|gl[uú]teo[s]?\s+e?\s*\w+)(?:\s+[1-3a-c])?$/i;

const NOISE_LINE_REGEX =
  /^(?:ejercicio[s]?|series|repeticiones|reps|descanso|pausa|notas?|observaciones|objetivo|semana\s+\d+|mesociclo|microciclo|entrenador|coach|alumno|atleta|nombre|fecha|p[aá]gina\s+\d+|calentamiento\s+general|movilidad\s+articular|estiramiento[s]?|hidrataci[oó]n|www\.|https?:\/\/|@[\w.]+)$/i;

const EXERCISE_KEYWORD_HINT_REGEX =
  /\b(?:press|banca|inclinad[oa]|declinad[oa]|aperturas?|cruces?|pec\s*deck|fondos?|dips?|flexiones|lagartijas|push\s*ups?|dominadas?|pull\s*ups?|chin\s*ups?|jal[oó]n|remo|row|pull\s*over|face\s*pull|p[aá]jaros|elevaciones|laterales|vuelos|militar|hombro|arnold|encogimientos|trapecio|curl|b[ií]ceps|martillo|predicador|bayesian|ara[ñn]a|tr[ií]ceps|franc[eé]s|rompecr[aá]neos|rompecabezas|copa|katana|extensi[oó]n|pushdown|sentadilla|squat|prensa|hack|zancadas?|estocadas?|lunges?|b[uú]lgara|peso\s*muerto|rumano|rdl|deadlift|hip\s*thrust|puente|gl[uú]teo|patada|abducci[oó]n|aducci[oó]n|femoral|isquios?|cu[aá]driceps|sill[oó]n|camilla|gemelos?|pantorrilla|calf|plancha|plank|crunch|abdominal|rueda|ab\s*wheel|leg\s*raise|l-sit|front\s*lever|back\s*lever|handstand|pino|muscle\s*up|pistol|cuerda|saltos?|double\s*unders?|running|correr|carrera|sprint|remo\s*erg|skierg|sled|trineo|burpees?|wall\s*balls?|farmers?|lunges|nataci[oó]n|crol|bicicleta|ciclismo)\b/i;

function slugifyId(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
}

function capitalizeClean(str: string): string {
  const trimmed = str.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function inferModeFromRawName(name: string): TrainingMode {
  if (/\b(?:skierg|sled\s*push|sled\s*pull|roxzone|wall\s*balls|farmers\s*carry|sandbag|hyrox)\b/i.test(name)) {
    return 'hyrox';
  }
  if (/\b(?:cuerda|comba|double\s*under|running|carrera|trote|sprint|km|nataci[oó]n|piscina|crol|ciclismo|bici\b|watts)\b/i.test(name)) {
    return 'cardio';
  }
  if (/\b(?:front\s*lever|back\s*lever|planche|plancha\s*isom|handstand|pino|muscle\s*up|l-sit|pistol\s*squat|dragon\s*flag|dominadas?\s*estrictas)\b/i.test(name)) {
    return 'calisthenics';
  }
  if (/\b(?:1rm|rpe\s*[89]|competi|pausa\s*1s|fuerza\s*m[aá]xima|low\s*bar|sumo\s*deadlift)\b/i.test(name)) {
    return 'strength';
  }
  return 'hypertrophy';
}

function inferFocusTitleFromExercises(exercises: RoutineExercisePrescription[]): string {
  if (exercises.length === 0) return 'Entrenamiento';
  const groups = new Set<string>();
  for (const ex of exercises) {
    const cat = BUILTIN_EXERCISES.find((c) => c.id === ex.catalogId);
    const sample = `${cat?.muscleGroup ?? ''} ${ex.name}`.toLowerCase();
    if (/pectoral|pecho|banca|apertura/.test(sample)) groups.add('Pecho');
    else if (/espalda|dorsal|remo|jal[oó]n|dominada/.test(sample)) groups.add('Espalda');
    else if (/deltoide|hombro|militar|lateral/.test(sample)) groups.add('Hombros');
    else if (/cu[aá]driceps|sentadilla|prensa|hack|pierna/.test(sample)) groups.add('Pierna');
    else if (/gl[uú]teo|isquio|femoral|rumano|hip\s*thrust/.test(sample)) groups.add('Glúteo e Isquios');
    else if (/b[ií]ceps|tr[ií]ceps|brazo|franc[eé]s|curl|copa/.test(sample)) groups.add('Brazos');
    else if (/cardio|cuerda|running|hyrox/.test(sample)) groups.add('Acondicionamiento');
    if (groups.size >= 2) break;
  }
  const arr = Array.from(groups);
  if (arr.length === 0) return 'Sesión Principal';
  if (arr.length === 1) return arr[0];
  return `${arr[0]} y ${arr[1]}`;
}

function matchBestCatalogExercise(cleanExerciseName: string): {
  catalogId: string;
  displayName: string;
  mode: TrainingMode;
  defaultRestSeconds: number;
} {
  const allModes: TrainingMode[] = ['hypertrophy', 'strength', 'calisthenics', 'hyrox', 'cardio'];
  let topMatch: { id: string; name: string; mode: TrainingMode; rest: number; score: number } | null =
    null;

  for (const m of allModes) {
    const matches = smartSearchExercises(BUILTIN_EXERCISES, m, cleanExerciseName);
    if (matches.length > 0) {
      const candidate = matches[0];
      // Subtract the +25 same-mode bonus so we compare pure lexical/synonym relevance across modes
      const rawRelevance = candidate.isCrossMode ? candidate.score : candidate.score - 25;
      if (!topMatch || rawRelevance > topMatch.score) {
        topMatch = {
          id: candidate.item.id,
          name: candidate.item.name,
          mode: candidate.item.mode,
          rest: candidate.item.defaultRestSeconds,
          score: rawRelevance,
        };
      }
    }
  }

  // High confidence match (direct match or strong synonym like "Press Francés" / "Press Militar")
  if (topMatch && topMatch.score >= 92) {
    return {
      catalogId: topMatch.id,
      displayName: topMatch.score >= 108 ? topMatch.name : capitalizeClean(cleanExerciseName),
      mode: topMatch.mode,
      defaultRestSeconds: topMatch.rest,
    };
  }

  // Moderate match: link catalogId for tracking but preserve the coach's exact exercise wording
  if (topMatch && topMatch.score >= 82) {
    return {
      catalogId: topMatch.id,
      displayName: capitalizeClean(cleanExerciseName),
      mode: topMatch.mode,
      defaultRestSeconds: topMatch.rest,
    };
  }

  // Custom exercise written by coach: preserve 100% faithfully
  const inferredMode = inferModeFromRawName(cleanExerciseName);
  return {
    catalogId: `custom_imp_${slugifyId(cleanExerciseName) || uid('cx')}`,
    displayName: capitalizeClean(cleanExerciseName),
    mode: inferredMode,
    defaultRestSeconds: inferredMode === 'strength' ? 180 : inferredMode === 'cardio' ? 45 : 105,
  };
}

/**
 * Parses a single candidate exercise line (from OCR or PDF row) into a RoutineExercisePrescription.
 * Returns null if the line is noise / header / non-exercise text.
 */
export function parseExerciseLine(rawLine: string): RoutineExercisePrescription | null {
  let line = rawLine
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[|¦]/g, ' ')
    .replace(/\t+/g, '  ')
    .trim();

  if (line.length < 3 || line.length > 160) return null;
  if (NOISE_LINE_REGEX.test(line)) return null;

  // Reject lines that are predominantly metadata headers (e.g. "Ejercicio Series Reps Descanso")
  if (
    /\bejercicio[s]?\b/i.test(line) &&
    /\b(?:series|reps|repeticiones|descanso|rir|rpe)\b/i.test(line)
  ) {
    return null;
  }

  const hadBulletOrNumberPrefix = /^(?:[a-d]?\d{1,2}[.):\-]\s+|[•\-*▪◦►▸]\s+)/i.test(line);

  // Strip leading numbering / bullets like "1.", "1)", "A1.", "B2 -", "•"
  line = line.replace(/^(?:[a-d]?\d{1,2}[.):\-]\s+|[•\-*▪◦►▸]\s+)/i, '').trim();
  if (line.length < 3) return null;

  let sets = 3;
  let repsNum = 10;
  let repRangeLabel = '8–12 reps';
  let rir: RirValue = '2';
  let restSeconds: number | undefined;
  let foundExplicitPrescription = false;

  // 1. Extract Rest time if present (e.g. "90s", "120 seg", "2 min", "2'")
  const restSecMatch = line.match(/\b(\d{2,3})\s*(?:seg(?:undos)?|s|'')\b(?:\s*descanso)?/i);
  const restMinMatch = line.match(
    /\b(\d(?:[.,]\d)?)\s*(?:min(?:utos)?|')\s*(?:de\s*descanso|descanso|pausa)?\b/i
  );
  if (restSecMatch && Number(restSecMatch[1]) >= 25 && Number(restSecMatch[1]) <= 360) {
    restSeconds = Number(restSecMatch[1]);
    line = line.replace(restSecMatch[0], ' ');
  } else if (
    restMinMatch &&
    (/descanso|pausa|rest|'/i.test(restMinMatch[0]) || /\d\s*[x×]/i.test(line))
  ) {
    const mins = parseFloat(restMinMatch[1].replace(',', '.'));
    if (mins >= 0.5 && mins <= 6) {
      restSeconds = Math.round(mins * 60);
      line = line.replace(restMinMatch[0], ' ');
    }
  }

  // 2. Extract RIR / RPE / Failure
  const rirMatch = line.match(/\bRIR\s*[:=]?\s*([0-4])(?:\s*[-/]\s*[0-4])?\+?/i);
  const rpeMatch = line.match(/\b(?:RPE|@)\s*[:=]?\s*(10|[6-9](?:[.,]5)?)\b/i);
  if (rirMatch) {
    const val = rirMatch[1];
    rir = (['0', '1', '2', '3'].includes(val) ? val : '2') as RirValue;
    line = line.replace(rirMatch[0], ' ');
  } else if (rpeMatch) {
    const rpeVal = parseFloat(rpeMatch[1].replace(',', '.'));
    rir = rpeVal >= 9.5 ? '0' : rpeVal >= 8.5 ? '1' : rpeVal >= 7.5 ? '2' : '3';
    line = line.replace(rpeMatch[0], ' ');
  } else if (/\bal\s+fallo\b/i.test(line)) {
    rir = '0';
    line = line.replace(/\bal\s+fallo\b/i, ' ');
  }

  // 3. Extract Sets x Reps or Sets x Time
  // Pattern A: "4 x 8-10", "3x12", "4×10/12", "3 x 45 seg", "4 x 1 min"
  const setsXTimeMatch = line.match(
    /\b([1-9]|10)\s*[x×X*]\s*(\d{1,3})\s*(seg(?:undos)?|s|min(?:utos)?)\b/i
  );
  const setsXRepsMatch = line.match(
    /\b([1-9]|10)\s*(?:series?\s*(?:de|[x×X])\s*|[x×X*]\s*)(\d{1,3})(?:\s*[-/a]\s*(\d{1,3}))?\s*(?:reps?|repeticiones|c\/u|por\s*pierna|por\s*lado)?\b/i
  );
  // Pattern B: Tabular PDF columns at end of line: "Press Militar   4   8-10" or "Sentadilla  4  8"
  const tabularMatch = line.match(
    /^(.{4,}?)\s{2,}([1-9])\s+(\d{1,2}(?:\s*[-/]\s*\d{1,2})?)\s*(?:reps?)?$/i
  );

  if (setsXTimeMatch) {
    foundExplicitPrescription = true;
    sets = Math.max(1, Math.min(10, parseInt(setsXTimeMatch[1], 10)));
    const amt = parseInt(setsXTimeMatch[2], 10);
    const isMin = /min/i.test(setsXTimeMatch[3]);
    repsNum = isMin ? amt * 60 : amt;
    repRangeLabel = isMin ? `${amt} min` : `${amt}s`;
    line = line.replace(setsXTimeMatch[0], ' ');
  } else if (setsXRepsMatch) {
    foundExplicitPrescription = true;
    sets = Math.max(1, Math.min(10, parseInt(setsXRepsMatch[1], 10)));
    const low = parseInt(setsXRepsMatch[2], 10);
    const high = setsXRepsMatch[3] ? parseInt(setsXRepsMatch[3], 10) : null;
    repsNum = high ? high : low;
    repRangeLabel = high ? `${low}–${high} reps` : `${low} reps`;
    line = line.replace(setsXRepsMatch[0], ' ');
  } else if (tabularMatch) {
    foundExplicitPrescription = true;
    line = tabularMatch[1];
    sets = Math.max(1, Math.min(10, parseInt(tabularMatch[2], 10)));
    const rawRange = tabularMatch[3].replace(/\s+/g, '').replace(/[-/]/g, '–');
    const nums = rawRange.split('–').map((n) => parseInt(n, 10));
    repsNum = nums[nums.length - 1] || 10;
    repRangeLabel = `${rawRange} reps`;
  } else {
    // Pattern C: "4 series" and "10-12 repeticiones" separated
    const seriesWordMatch = line.match(/\b([1-9])\s*series?\b/i);
    const repsWordMatch = line.match(/\b(\d{1,2})(?:\s*[-/a]\s*(\d{1,2}))?\s*(?:reps?|repeticiones)\b/i);
    if (seriesWordMatch || repsWordMatch) {
      foundExplicitPrescription = true;
      if (seriesWordMatch) {
        sets = parseInt(seriesWordMatch[1], 10);
        line = line.replace(seriesWordMatch[0], ' ');
      }
      if (repsWordMatch) {
        const low = parseInt(repsWordMatch[1], 10);
        const high = repsWordMatch[2] ? parseInt(repsWordMatch[2], 10) : null;
        repsNum = high ?? low;
        repRangeLabel = high ? `${low}–${high} reps` : `${low} reps`;
        line = line.replace(repsWordMatch[0], ' ');
      }
    } else {
      // Pattern D: Single-space table columns ("Press Militar 4 8-10") or OCR-dropped 'x' ("Press Militar 310" / "412")
      const singleSpaceTableMatch = line.match(
        /^(.{4,}?)\s+([2-6])\s+(\d{1,2}(?:\s*[-/]\s*\d{1,2})?)\s*(?:reps?)?$/i
      );
      const ocrDroppedXMatch = line.match(/^(.{4,}?)\s+([2-5])(1[025]|0?[68])$/i);

      if (singleSpaceTableMatch) {
        foundExplicitPrescription = true;
        line = singleSpaceTableMatch[1];
        sets = parseInt(singleSpaceTableMatch[2], 10);
        const rawRange = singleSpaceTableMatch[3].replace(/\s+/g, '').replace(/[-/]/g, '–');
        const nums = rawRange.split('–').map((n) => parseInt(n, 10));
        repsNum = nums[nums.length - 1] || 10;
        repRangeLabel = `${rawRange} reps`;
      } else if (ocrDroppedXMatch) {
        foundExplicitPrescription = true;
        line = ocrDroppedXMatch[1];
        sets = parseInt(ocrDroppedXMatch[2], 10);
        repsNum = parseInt(ocrDroppedXMatch[3], 10);
        repRangeLabel = `${repsNum} reps`;
      }
    }
  }

  // Clean residual punctuation from exercise name
  const cleanName = line
    .replace(/\(\s*\)/g, '')
    .replace(/\b(?:descanso|pausa|series|reps|repeticiones)\b/gi, '')
    .replace(/^[\s:\-–—•*.,/]+|[\s:\-–—•*.,/]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (cleanName.length < 3) return null;
  // Must contain letters
  if (!/[a-záéíóúñ]{3,}/i.test(cleanName)) return null;

  const hasExerciseKeyword = EXERCISE_KEYWORD_HINT_REGEX.test(cleanName);

  // If there was neither sets×reps, nor an exercise keyword, nor a numbered/bulleted item in an active day, ignore noise
  if (!foundExplicitPrescription && !hasExerciseKeyword && !hadBulletOrNumberPrefix) {
    return null;
  }

  // Reject general non-exercise instructions like "Dormir 8 horas" or "Tomar creatina 5g"
  if (
    !hasExerciseKeyword &&
    /\b(?:dormir|agua|prote[ií]na|creatina|kcal|calor[ií]as|gramos|comida|desayuno|cena|pasos\s+diarios)\b/i.test(
      cleanName
    )
  ) {
    return null;
  }

  const matched = matchBestCatalogExercise(cleanName);

  return {
    catalogId: matched.catalogId,
    name: matched.displayName,
    mode: matched.mode,
    sets,
    repsNum,
    repRangeLabel,
    rir,
    restSeconds: restSeconds ?? matched.defaultRestSeconds,
  };
}

interface ParsedDayBucket {
  type: 'weekday' | 'cyclic';
  weekdayIndex?: number;
  label: string;
  explicitFocusTitle: string;
  isRestDay: boolean;
  exercises: RoutineExercisePrescription[];
}

/**
 * Converts raw OCR / PDF text into a structured KAIROS UserRoutine,
 * preserving the exact day groupings and exercise order from the user's file.
 */
export function parseRoutineFromExtractedText(
  rawText: string,
  fileName?: string
): RoutineExtractionResult {
  const warnings: string[] = [];
  const normalizedBlock = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const rawLines = normalizedBlock
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const buckets: ParsedDayBucket[] = [];
  let currentBucket: ParsedDayBucket | null = null;

  for (const line of rawLines) {
    // 1. Check Weekday Header
    let matchedWeekday = false;
    for (const wd of WEEKDAY_HEADER_PATTERNS) {
      const m = line.match(wd.regex);
      if (m) {
        const trailing = (m[1] ?? '').replace(/[)\]]+$/, '').trim();
        // Make sure it's not a sentence like "Lunes a Viernes caminar 10000 pasos"
        if (/^a\s+(?:viernes|s[aá]bado|domingo)\b/i.test(trailing)) {
          break;
        }
        const isRest = /\b(?:descanso|rest|libre|off)\b/i.test(trailing);
        currentBucket = {
          type: 'weekday',
          weekdayIndex: wd.index,
          label: wd.label,
          explicitFocusTitle: isRest ? 'Descanso' : capitalizeClean(trailing),
          isRestDay: isRest,
          exercises: [],
        };
        buckets.push(currentBucket);
        matchedWeekday = true;
        break;
      }
    }
    if (matchedWeekday) continue;

    // 2. Check Cyclic Day Header ("Día 1: Empuje", "Sesión A - Torso", etc.)
    const cycMatch = line.match(CYCLIC_DAY_REGEX);
    if (cycMatch) {
      const tag = cycMatch[1].toUpperCase();
      const trailing = (cycMatch[2] ?? '').replace(/[)\]]+$/, '').trim();
      const isRest = /\b(?:descanso|rest|libre|off)\b/i.test(trailing);
      currentBucket = {
        type: 'cyclic',
        label: `Día ${buckets.length + 1}`,
        explicitFocusTitle: isRest
          ? 'Descanso'
          : trailing
            ? capitalizeClean(trailing)
            : `Sesión ${tag}`,
        isRestDay: isRest,
        exercises: [],
      };
      buckets.push(currentBucket);
      continue;
    }

    // 3. Check Standalone Split Section Title (e.g. "TORSO A", "PIERNA B", "PECHO Y TRÍCEPS")
    if (!/\d\s*[x×X]\s*\d/.test(line) && STANDALONE_SPLIT_REGEX.test(line)) {
      currentBucket = {
        type: 'cyclic',
        label: `Día ${buckets.length + 1}`,
        explicitFocusTitle: capitalizeClean(line.toLowerCase()),
        isRestDay: false,
        exercises: [],
      };
      buckets.push(currentBucket);
      continue;
    }

    // 4. Parse Exercise Line
    const parsedEx = parseExerciseLine(line);
    if (parsedEx) {
      if (!currentBucket) {
        currentBucket = {
          type: 'cyclic',
          label: 'Día 1',
          explicitFocusTitle: '',
          isRestDay: false,
          exercises: [],
        };
        buckets.push(currentBucket);
      }
      currentBucket.isRestDay = false;
      currentBucket.exercises.push(parsedEx);
    }
  }

  // Filter buckets that actually have exercises or explicit rest day markers
  const validBuckets = buckets.filter((b) => b.exercises.length > 0 || b.isRestDay);
  const weekdayBuckets = validBuckets.filter((b) => b.type === 'weekday' && b.weekdayIndex !== undefined);

  const cleanBaseName = fileName
    ? capitalizeClean(
        fileName
          .replace(/\.(pdf|png|jpe?g|webp|heic)$/i, '')
          .replace(/[_-]+/g, ' ')
          .trim()
      )
    : '';
  const routineName =
    cleanBaseName && cleanBaseName.length >= 3 && !/^img|^whatsapp|^screenshot|^image/i.test(cleanBaseName)
      ? cleanBaseName
      : 'Rutina Importada';

  // Build final UserRoutine (Weekday if >= 1 explicit weekday header found, else Cyclic)
  if (weekdayBuckets.length >= 1) {
    const byWeekday = new Map<number, ParsedDayBucket>();
    for (const b of weekdayBuckets) {
      if (b.weekdayIndex === undefined) continue;
      const existing = byWeekday.get(b.weekdayIndex);
      if (existing) {
        existing.exercises.push(...b.exercises);
        if (!existing.explicitFocusTitle && b.explicitFocusTitle) {
          existing.explicitFocusTitle = b.explicitFocusTitle;
        }
        if (b.exercises.length > 0) existing.isRestDay = false;
      } else {
        byWeekday.set(b.weekdayIndex, { ...b, exercises: [...b.exercises] });
      }
    }

    const days: RoutineDayPlan[] = ORDERED_WEEKDAYS.map((wd) => {
      const found = byWeekday.get(wd.index);
      if (!found || (found.isRestDay && found.exercises.length === 0)) {
        return {
          id: uid('rday'),
          label: wd.label,
          weekdayIndex: wd.index,
          isRestDay: true,
          focusTitle: 'Descanso',
          primaryMode: 'hypertrophy',
          estimatedMinutes: 0,
          exercises: [],
        };
      }
      const focusTitle =
        found.explicitFocusTitle || inferFocusTitleFromExercises(found.exercises);
      const primaryMode = found.exercises[0]?.mode ?? 'hypertrophy';
      return {
        id: uid('rday'),
        label: wd.label,
        weekdayIndex: wd.index,
        isRestDay: false,
        focusTitle,
        primaryMode,
        estimatedMinutes: Math.max(35, found.exercises.length * 10),
        exercises: found.exercises,
      };
    });

    const activeDaysCount = days.filter((d) => !d.isRestDay).length;
    const totalExercisesCount = days.reduce((acc, d) => acc + d.exercises.length, 0);

    return {
      routine: {
        id: uid('rtn'),
        name: routineName,
        scheduleType: 'weekday',
        source: 'manual',
        createdAtIso: new Date().toISOString(),
        cycleAnchorDateKey: toLocalDateKey(),
        cycleOffsetDays: 0,
        adaptedOverride: null,
        days,
      },
      detectedScheduleType: 'weekday',
      activeDaysCount,
      totalExercisesCount,
      warnings,
    };
  }

  // Cyclic Routine output
  const cyclicDays: RoutineDayPlan[] = validBuckets.map((b, idx) => {
    const isRest = b.isRestDay && b.exercises.length === 0;
    const focusTitle = isRest
      ? 'Descanso'
      : b.explicitFocusTitle || inferFocusTitleFromExercises(b.exercises);
    const primaryMode = b.exercises[0]?.mode ?? 'hypertrophy';
    return {
      id: uid('rday'),
      label: `Día ${idx + 1}`,
      isRestDay: isRest,
      focusTitle,
      primaryMode,
      estimatedMinutes: isRest ? 0 : Math.max(35, b.exercises.length * 10),
      exercises: b.exercises,
    };
  });

  if (cyclicDays.length === 0) {
    warnings.push(
      'No logramos distinguir ejercicios claros en el archivo. Intenta con una captura más nítida o revisa el texto.'
    );
  }

  const activeDaysCount = cyclicDays.filter((d) => !d.isRestDay).length;
  const totalExercisesCount = cyclicDays.reduce((acc, d) => acc + d.exercises.length, 0);

  return {
    routine: {
      id: uid('rtn'),
      name: routineName,
      scheduleType: 'cyclic',
      source: 'manual',
      createdAtIso: new Date().toISOString(),
      cycleAnchorDateKey: toLocalDateKey(),
      cycleOffsetDays: 0,
      adaptedOverride: null,
      days: cyclicDays,
    },
    detectedScheduleType: 'cyclic',
    activeDaysCount,
    totalExercisesCount,
    warnings,
  };
}
