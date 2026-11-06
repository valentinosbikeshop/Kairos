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
import {
  extractStructuredExerciseTokens,
  resolveExerciseIntelligently,
} from '@/lib/exerciseClassifierEngine';
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
  /^(?:[\d#•\-*▪◦]+\s*[.):\-]?\s*)?(?:d[ií]a\s+de\s+)?(torso|pierna|piernas|empuje|tir[oó]n|jale|push|pull|legs|upper|lower|full\s*body|cuerpo\s*completo|pecho(?:\s+y\s+\w+)?|espalda(?:\s+y\s+\w+)?|hombro[s]?(?:\s+y\s+\w+)?|brazo[s]?(?:\s+y\s+\w+)?|gl[uú]teo[s]?(?:\s+[ey]\s+\w+)?|cu[aá]driceps(?:\s+[ey]\s+\w+)?|isquios?(?:\s+[ey]\s+\w+)?|descanso|rest\s*day)(?:\s+[1-3a-c])?$/i;

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
  const resolved = resolveExerciseIntelligently(cleanExerciseName);
  return {
    catalogId: resolved.canonicalCatalogId,
    displayName: resolved.canonicalName,
    mode: resolved.mode,
    defaultRestSeconds: resolved.defaultRestSeconds,
  };
}

/**
 * Parses a single candidate exercise line (from OCR or text block) into a RoutineExercisePrescription.
 * Returns null if the line is noise / header / non-exercise text.
 */
export function parseExerciseLine(rawLine: string): RoutineExercisePrescription | null {
  const line = rawLine
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

  // Extract structured tokens (weight, sets, reps, rir, rest, cleanName, leaked next section)
  const tokens = extractStructuredExerciseTokens(line);
  const cleanName = tokens.cleanName;

  if (cleanName.length < 3) return null;
  if (!/[a-záéíóúñ]{3,}/i.test(cleanName)) return null;

  const hasExerciseKeyword = EXERCISE_KEYWORD_HINT_REGEX.test(cleanName);
  const foundExplicitPrescription =
    tokens.sets !== undefined ||
    tokens.repsNum !== undefined ||
    tokens.targetWeightKg !== undefined;

  // If there was neither explicit prescription, nor exercise keyword, nor bullet prefix, ignore noise
  if (!foundExplicitPrescription && !hasExerciseKeyword && !hadBulletOrNumberPrefix) {
    return null;
  }

  // Reject general non-exercise instructions
  if (
    !hasExerciseKeyword &&
    /\b(?:dormir|agua|prote[ií]na|creatina|kcal|calor[ií]as|gramos|comida|desayuno|cena|pasos\s+diarios)\b/i.test(
      cleanName
    )
  ) {
    return null;
  }

  const resolved = resolveExerciseIntelligently(cleanName);

  return {
    catalogId: resolved.canonicalCatalogId,
    name: resolved.canonicalName,
    mode: resolved.mode,
    sets: tokens.sets ?? 3,
    repsNum: tokens.repsNum ?? 10,
    repRangeLabel: tokens.repRangeLabel ?? '8–12 reps',
    rir: tokens.rir ?? '2',
    restSeconds: tokens.restSeconds ?? resolved.defaultRestSeconds,
    targetWeightKg: tokens.targetWeightKg,
    leakedNextSection: tokens.leakedNextSection,
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

    // 3. Check Standalone Split Section Title (e.g. "TORSO A", "2. PIERNA", "PECHO Y TRÍCEPS")
    if (!/\d\s*[x×X]\s*\d/.test(line) && STANDALONE_SPLIT_REGEX.test(line)) {
      const cleanedSplitTitle = capitalizeClean(
        line.replace(/^(?:[\d#•\-*▪◦]+\s*[.):\-]?\s*)/, '').toLowerCase()
      );
      const isRest = /\b(?:descanso|rest|libre|off)\b/i.test(cleanedSplitTitle);
      currentBucket = {
        type: 'cyclic',
        label: `Día ${buckets.length + 1}`,
        explicitFocusTitle: isRest ? 'Descanso' : cleanedSplitTitle,
        isRestDay: isRest,
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
      const nextSection = parsedEx.leakedNextSection;
      delete parsedEx.leakedNextSection;
      currentBucket.exercises.push(parsedEx);

      // If a subsequent section header leaked into this line (e.g. ": 2. Espalda"),
      // immediately transition to the new workout section
      if (nextSection && nextSection.length >= 3) {
        const cleanSection = capitalizeClean(
          nextSection.replace(/^[\d#•\-*▪◦]+[.):\-]?\s*/, '')
        );
        const isRest = /\b(?:descanso|rest|libre|off)\b/i.test(cleanSection);
        currentBucket = {
          type: 'cyclic',
          label: `Día ${buckets.length + 1}`,
          explicitFocusTitle: isRest ? 'Descanso' : cleanSection,
          isRestDay: isRest,
          exercises: [],
        };
        buckets.push(currentBucket);
      }
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
