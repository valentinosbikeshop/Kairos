import { ExerciseCatalogItem, RirValue, TrainingMode } from '@/types/kairos';
import { BUILTIN_EXERCISES, normalizeSearchText, smartSearchExercises } from '@/lib/exerciseDatabase';

export interface ExerciseClassificationResult {
  rawInput: string;
  cleanName: string;
  canonicalCatalogId: string;
  canonicalName: string;
  isCanonicalMatch: boolean;
  confidence: number; // 0 to 100
  muscleGroup: string;
  mode: TrainingMode;
  defaultRestSeconds: number;
  matchedAlias?: string;
  biomechanicalCue?: string;
  movementPattern?:
    | 'Empuje Horizontal'
    | 'Empuje Vertical'
    | 'Tracción Horizontal'
    | 'Tracción Vertical'
    | 'Dominante de Rodilla'
    | 'Dominante de Cadera'
    | 'Aislamiento'
    | 'Core'
    | 'Cardio';
  targetWeightKg?: number;
  extractedSets?: number;
  extractedReps?: number;
  extractedRepRangeLabel?: string;
  extractedRir?: RirValue;
  leakedNextSection?: string;
}

export interface StructuredExerciseTokens {
  cleanName: string;
  targetWeightKg?: number;
  sets?: number;
  repsNum?: number;
  repRangeLabel?: string;
  rir?: RirValue;
  restSeconds?: number;
  leakedNextSection?: string;
}

// Common fitness equipment / posture phrases (USED ONLY FOR CORE ALIAS FALLBACK - NEVER STRIPPED FROM USER-VISIBLE NAMES)
const EQUIPMENT_MODIFIERS = [
  /\bcon\s+mancuernas?\b/gi,
  /\bc\/mancuernas?\b/gi,
  /\bc\/manc\b/gi,
  /\bc\/m\b/gi,
  /\bcon\s+barra\b/gi,
  /\bc\/barra\b/gi,
  /\bc\/b\b/gi,
  /\ben\s+polea\b/gi,
  /\ben\s+poleas\b/gi,
  /\ben\s+maquina\b/gi,
  /\ben\s+máquina\b/gi,
  /\ben\s+multipower\b/gi,
  /\ben\s+smith\b/gi,
  /\bcon\s+kettlebell\b/gi,
  /\bc\/kettlebell\b/gi,
  /\bcon\s+goma\b/gi,
  /\bcon\s+banda\b/gi,
  /\bcon\s+disco\b/gi,
  /\bagarre\s+neutro\b/gi,
  /\bagarre\s+supino\b/gi,
  /\bagarre\s+prono\b/gi,
  /\bunilateral\b/gi,
  /\bbilateral\b/gi,
  /\bsentado\b/gi,
  /\bde\s+pie\b/gi,
  /\bacostado\b/gi,
  /\btumbado\b/gi,
];

// Noise words in exercise lines
const NOISE_WORDS = [
  /\bcalentamiento\b/gi,
  /\baprox\b/gi,
  /\baproximacion\b/gi,
  /\bpesado\b/gi,
  /\bliviano\b/gi,
];

// Anatomical keyword inference for novel custom exercises
const MUSCLE_KEYWORDS: {
  regex: RegExp;
  muscleGroup: string;
  pattern?: ExerciseClassificationResult['movementPattern'];
}[] = [
  // Pectoral / Pecho
  {
    regex: /\b(?:pecho|pectoral|banca|aperturas?|cruces?|pec\s*deck|press\s*plano|inclinado|declinado|guillotina|chest)\b/i,
    muscleGroup: 'Pectoral',
    pattern: 'Empuje Horizontal',
  },
  // Espalda / Dorsal
  {
    regex: /\b(?:espalda|dorsal|remo|jal[oó]n|dominada|pull\s*ups?|chin\s*ups?|pull\s*down|pull\s*over|lat\b|back|trapecio|encogimientos?|t-bar|landmine\s*row)\b/i,
    muscleGroup: 'Espalda / Dorsal',
    pattern: 'Tracción Vertical',
  },
  // Hombros / Deltoides
  {
    regex: /\b(?:hombro[s]?|deltoide[s]?|militar|overhead|ohp|arnold|laterales|vuelos|p[aá]jaros|face\s*pull|frontales|shoulder)\b/i,
    muscleGroup: 'Deltoides',
    pattern: 'Empuje Vertical',
  },
  // Tríceps
  {
    regex: /\b(?:tr[ií]ceps?|franc[eé]s|rompecr[aá]neos|rompecabezas|skull\s*crusher|pushdown|copa\s*tr[ií]ceps|patada\s*tr[ií]ceps|fondos?\s*en\s*paralelas|fondos?\s*entre\s*bancos)\b/i,
    muscleGroup: 'Tríceps',
    pattern: 'Aislamiento',
  },
  // Bíceps
  {
    regex: /\b(?:b[ií]ceps?|curl|martillo|hammer|predicador|scott|bayesian|spider|ara[ñn]a|concentrado|biceps)\b/i,
    muscleGroup: 'Bíceps',
    pattern: 'Aislamiento',
  },
  // Cuádriceps
  {
    regex: /\b(?:cu[aá]driceps?|sentadilla|squat|prensa|leg\s*press|hack|hacka|sill[oó]n|sissy|extension(?:es)?\s*de\s*pierna|b[uú]lgara|estocada|zancada|lunge)\b/i,
    muscleGroup: 'Cuádriceps',
    pattern: 'Dominante de Rodilla',
  },
  // Isquios / Femoral
  {
    regex: /\b(?:femoral|isquios?|isquiotibiales?|leg\s*curl|camilla|nordic|curl\s*femoral|stiff|piernas\s*r[ií]gidas)\b/i,
    muscleGroup: 'Isquiosurales',
    pattern: 'Dominante de Cadera',
  },
  // Glúteos
  {
    regex: /\b(?:gl[uú]teo[s]?|hip\s*thrust|puente|patada\s*gl[uú]teo|abductor|abducci[oó]n|kas\s*glute)\b/i,
    muscleGroup: 'Glúteos',
    pattern: 'Dominante de Cadera',
  },
  // Gemelos / Pantorrillas
  {
    regex: /\b(?:gemelos?|pantorrilla[s]?|calf|elevacion\s*talones|soleo|tibial)\b/i,
    muscleGroup: 'Pantorrillas',
    pattern: 'Aislamiento',
  },
  // Core / Abdomen
  {
    regex: /\b(?:abdominal(?:es)?|abdomen|core|crunch|plancha|plank|rueda|ab\s*wheel|l-sit|leg\s*raise|elevacion\s*de\s*piernas|hollow|pallof)\b/i,
    muscleGroup: 'Abdomen / Core',
    pattern: 'Core',
  },
  // Calistenia estáticos
  {
    regex: /\b(?:front\s*lever|back\s*lever|planche|handstand|pino|muscle\s*up|dragon\s*flag)\b/i,
    muscleGroup: 'Espalda / Core / Hombros',
    pattern: 'Core',
  },
  // Cardio / Hyrox
  {
    regex: /\b(?:cuerda|comba|running|correr|trote|sprint|nataci[oó]n|ciclismo|bici|skierg|sled|burpees?|wall\s*balls?|farmers)\b/i,
    muscleGroup: 'Cardiovascular / Full Body',
    pattern: 'Cardio',
  },
];

/**
 * Checks if user specified an explicit equipment that contradicts the catalog item.
 * E.g., user said "con mancuernas" but catalog item is "con Barra".
 */
function hasConflictingEquipment(userText: string, catalogItemName: string): boolean {
  const normUser = userText.toLowerCase();
  const normItem = catalogItemName.toLowerCase();

  const eqCategories = [
    { key: 'mancuerna', match: /\b(?:mancuernas?|c\/manc|dumbbell)\b/ },
    { key: 'barra', match: /\b(?:barra|c\/barra|barbell)\b/ },
    { key: 'polea', match: /\b(?:poleas?|cable)\b/ },
    { key: 'maquina', match: /\b(?:m[aá]quinas?|hammer|guiada)\b/ },
    { key: 'smith', match: /\b(?:multipower|smith)\b/ },
  ];

  for (const cat of eqCategories) {
    if (cat.match.test(normUser)) {
      for (const other of eqCategories) {
        if (other.key !== cat.key && other.match.test(normItem) && !cat.match.test(normItem)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Extracts structured performance data (weights, sets, reps, RIR, rest, leaked section headers)
 * and isolates the clean exercise name while strictly PRESERVING equipment details (polea, mancuerna, máquina, smith).
 */
export function extractStructuredExerciseTokens(rawInput: string): StructuredExerciseTokens {
  let line = rawInput
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[|¦]/g, ' ')
    .replace(/\t+/g, ' ')
    .trim();

  // Strip leading list bullets/numbering (e.g. "1. ", "• ", "A) ")
  line = line.replace(/^(?:[a-d]?\d{1,2}[.):\-]\s+|[•\-*▪◦►▸]\s+)/i, '').trim();

  let targetWeightKg: number | undefined;
  let sets: number | undefined;
  let repsNum: number | undefined;
  let repRangeLabel: string | undefined;
  let rir: RirValue | undefined;
  let restSeconds: number | undefined;
  let leakedNextSection: string | undefined;

  // 1. Extract Performance Weight / Load (e.g. "120kg", "120 kg", "120.5kg", "80 lbs", "40 kilos")
  const weightMatch = line.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*(kg|kilos?|lbs?|libras?)\b/i);
  if (weightMatch) {
    const rawVal = parseFloat(weightMatch[1].replace(',', '.'));
    const unit = weightMatch[2].toLowerCase();
    if (!isNaN(rawVal) && rawVal > 0 && rawVal <= 600) {
      targetWeightKg = unit.startsWith('lb') ? Math.round(rawVal * 0.453592 * 10) / 10 : rawVal;
    }
    line = line.replace(weightMatch[0], ' ');
  }

  // 2. Extract Colon notation for sets and/or concatenated leaked next sections
  // E.g. ": 2. Espalda" or ": 2 series" or ": 2"
  const colonSetsMatch = line.match(
    /(?:\s*[:=]\s*)(\d{1,2})(?:\s*(?:series|sets|s))?(?:\s*[.]?\s*)(?:(\b(?:espalda|pecho|pectoral|pierna|piernas|hombro|hombros|brazo|brazos|b[ií]ceps|tr[ií]ceps|core|abdomen|gl[uú]teo|gluteos|cardio|d[ií]a\s*\d*|sesi[oó]n\s*\w*|bloque\s*\d*)\b.*))?/i
  );
  if (colonSetsMatch) {
    const parsedSets = parseInt(colonSetsMatch[1], 10);
    if (!isNaN(parsedSets) && parsedSets >= 1 && parsedSets <= 15) {
      sets = parsedSets;
    }
    if (colonSetsMatch[2]) {
      leakedNextSection = colonSetsMatch[2].trim();
    }
    line = line.replace(colonSetsMatch[0], ' ');
  }

  // 3. Extract Trailing Leaked Next Section Header (if not matched by colon regex)
  // E.g. ". Espalda", " - 2. Espalda", "Espalda" at end of line (ignoring prepositions like "al pecho")
  const trailingSectionMatch = line.match(
    /(?:[:\-–|/.]\s*|\s+)(?<!\b(?:al|a|en|de|del|para)\s+)(?:(\d{1,2}\s*[.):\-]\s*)?(espalda|pecho|pectoral|pierna|piernas|hombro|hombros|brazo|brazos|b[ií]ceps|tr[ií]ceps|core|abdomen|gl[uú]teo|gluteos|cardio|d[ií]a\s*\d*|sesi[oó]n\s*\w*|bloque\s*\d*)\b.*)$/i
  );
  if (trailingSectionMatch) {
    if (!leakedNextSection) {
      leakedNextSection = trailingSectionMatch[0].replace(/^[\s:\-–|/.]+/, '').trim();
    }
    line = line.slice(0, trailingSectionMatch.index).trim();
  }

  // 4. Extract Rest Time (e.g. "90s", "120 seg", "2 min", "2'")
  const restSecMatch = line.match(/\b(\d{2,3})\s*(?:seg(?:undos)?|s|'')\b(?:\s*descanso)?/i);
  const restMinMatch = line.match(
    /\b(\d(?:[.,]\d)?)\s*(?:min(?:utos)?|')\s*(?:de\s*descanso|descanso|pausa)?\b/i
  );
  if (restSecMatch && Number(restSecMatch[1]) >= 20 && Number(restSecMatch[1]) <= 400) {
    restSeconds = Number(restSecMatch[1]);
    line = line.replace(restSecMatch[0], ' ');
  } else if (restMinMatch) {
    const mins = parseFloat(restMinMatch[1].replace(',', '.'));
    if (mins >= 0.5 && mins <= 6) {
      restSeconds = Math.round(mins * 60);
      line = line.replace(restMinMatch[0], ' ');
    }
  }

  // 5. Extract RIR / RPE / Fallo
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

  // 6. Extract Sets x Reps or Sets x Time (e.g. "4x10", "3 x 8-12", "4×10/12", "3 x 45 seg")
  const setsXTimeMatch = line.match(
    /\b([1-9]|10)\s*[x×X*]\s*(\d{1,3})\s*(seg(?:undos)?|s|min(?:utos)?)\b/i
  );
  const setsXRepsMatch = line.match(
    /\b([1-9]|10)\s*(?:series?\s*(?:de|[x×X])\s*|[x×X*]\s*)(\d{1,3})(?:\s*[-/a]\s*(\d{1,3}))?\s*(?:reps?|repeticiones|c\/u|por\s*pierna|por\s*lado)?\b/i
  );
  const tabularMatch = line.match(
    /^(.{4,}?)\s{2,}([1-9])\s+(\d{1,2}(?:\s*[-/]\s*\d{1,2})?)\s*(?:reps?)?$/i
  );

  if (setsXTimeMatch) {
    sets = Math.max(1, Math.min(10, parseInt(setsXTimeMatch[1], 10)));
    const amt = parseInt(setsXTimeMatch[2], 10);
    const isMin = /min/i.test(setsXTimeMatch[3]);
    repsNum = isMin ? amt * 60 : amt;
    repRangeLabel = isMin ? `${amt} min` : `${amt}s`;
    line = line.replace(setsXTimeMatch[0], ' ');
  } else if (setsXRepsMatch) {
    sets = Math.max(1, Math.min(10, parseInt(setsXRepsMatch[1], 10)));
    const low = parseInt(setsXRepsMatch[2], 10);
    const high = setsXRepsMatch[3] ? parseInt(setsXRepsMatch[3], 10) : null;
    repsNum = high ?? low;
    repRangeLabel = high ? `${low}–${high} reps` : `${low} reps`;
    line = line.replace(setsXRepsMatch[0], ' ');
  } else if (tabularMatch) {
    line = tabularMatch[1];
    sets = Math.max(1, Math.min(10, parseInt(tabularMatch[2], 10)));
    const rawRange = tabularMatch[3].replace(/\s+/g, '').replace(/[-/]/g, '–');
    const nums = rawRange.split('–').map((n) => parseInt(n, 10));
    repsNum = nums[nums.length - 1] || 10;
    repRangeLabel = `${rawRange} reps`;
  } else {
    // Separate "4 series" and "10-12 repeticiones"
    const seriesWordMatch = line.match(/\b([1-9])\s*series?\b/i);
    const repsWordMatch = line.match(
      /\b(\d{1,2})(?:\s*[-/a]\s*(\d{1,2}))?\s*(?:reps?|repeticiones)\b/i
    );
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
  }

  // 7. Strip noise words
  for (const nw of NOISE_WORDS) {
    line = line.replace(nw, ' ');
  }

  // 8. Clean residual punctuation while keeping equipment intact
  const cleanName = line
    .replace(/\(\s*\)/g, ' ')
    .replace(/^[\s:\-–—•*.,/]+|[\s:\-–—•*.,/]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    cleanName,
    targetWeightKg,
    sets,
    repsNum,
    repRangeLabel,
    rir,
    restSeconds,
    leakedNextSection,
  };
}

/**
 * Normalizes an exercise string by stripping punctuation, extra spaces,
 * weights/loads, sets/reps artifacts, and common noise,
 * while STRICTLY PRESERVING equipment words (máquina, mancuerna, smith, polea).
 */
export function cleanRawExerciseString(raw: string): string {
  const tokens = extractStructuredExerciseTokens(raw);
  return tokens.cleanName;
}

/**
 * Intelligently classifies any exercise string (from routine import, manual input, or live workout)
 * into a canonical catalog match or a high-precision enriched custom definition.
 * Equipment specifications ("en máquina", "en smith", "con mancuernas", "en polea") are ALWAYS preserved.
 */
export function resolveExerciseIntelligently(
  rawInput: string,
  targetMode?: TrainingMode,
  catalogPool: ExerciseCatalogItem[] = BUILTIN_EXERCISES
): ExerciseClassificationResult {
  const tokens = extractStructuredExerciseTokens(rawInput);
  const clean = tokens.cleanName || rawInput.trim();
  const normClean = normalizeSearchText(clean);

  // 1. Direct and Alias search across modes
  const allModes: TrainingMode[] = targetMode
    ? [targetMode, 'hypertrophy', 'strength', 'calisthenics', 'hyrox', 'cardio']
    : ['hypertrophy', 'strength', 'calisthenics', 'hyrox', 'cardio'];

  let bestMatch: {
    item: ExerciseCatalogItem;
    score: number;
    matchedAlias?: string;
  } | null = null;

  for (const m of Array.from(new Set(allModes))) {
    const hits = smartSearchExercises(catalogPool, m, clean);
    if (hits.length > 0) {
      const top = hits[0];
      const rawScore = top.isCrossMode ? top.score : top.score - 20; // balance cross-mode bonus
      if (!bestMatch || rawScore > bestMatch.score) {
        bestMatch = {
          item: top.item,
          score: rawScore,
          matchedAlias: top.matchedAlias,
        };
      }
    }
  }

  // 2. High confidence catalog match (exact match, close synonym or alias)
  if (bestMatch && bestMatch.score >= 88) {
    const item = bestMatch.item;
    const hasConflict = hasConflictingEquipment(clean, item.name);
    const finalCanonicalName = hasConflict ? formatCapitalizedExercise(clean) : item.name;

    return {
      rawInput,
      cleanName: clean,
      canonicalCatalogId: item.id,
      canonicalName: finalCanonicalName,
      isCanonicalMatch: !hasConflict,
      confidence: Math.min(100, bestMatch.score),
      muscleGroup: item.muscleGroup,
      mode: item.mode,
      defaultRestSeconds: item.defaultRestSeconds,
      matchedAlias: bestMatch.matchedAlias,
      biomechanicalCue: item.biomechanicalCue,
      targetWeightKg: tokens.targetWeightKg,
      extractedSets: tokens.sets,
      extractedReps: tokens.repsNum,
      extractedRepRangeLabel: tokens.repRangeLabel,
      extractedRir: tokens.rir,
      leakedNextSection: tokens.leakedNextSection,
    };
  }

  // 3. Fallback: Strip equipment modifiers ONLY to find parent muscle group and biomechanical cues
  // NEVER overwrite user's clean equipment variant with opposite equipment
  let strippedCore = clean;
  for (const em of EQUIPMENT_MODIFIERS) {
    strippedCore = strippedCore.replace(em, ' ');
  }
  strippedCore = strippedCore.replace(/\s{2,}/g, ' ').trim();

  if (strippedCore.length >= 4 && strippedCore !== clean) {
    for (const m of Array.from(new Set(allModes))) {
      const hits = smartSearchExercises(catalogPool, m, strippedCore);
      if (hits.length > 0 && hits[0].score >= 86) {
        const item = hits[0].item;
        const formattedUserClean = formatCapitalizedExercise(clean);

        return {
          rawInput,
          cleanName: clean,
          canonicalCatalogId: item.id,
          // Preserve user's equipment specification in canonical name if it differs
          canonicalName: hasConflictingEquipment(clean, item.name)
            ? formattedUserClean
            : item.name,
          isCanonicalMatch: true,
          confidence: Math.min(95, hits[0].score),
          muscleGroup: item.muscleGroup,
          mode: item.mode,
          defaultRestSeconds: item.defaultRestSeconds,
          matchedAlias: hits[0].matchedAlias || strippedCore,
          biomechanicalCue: item.biomechanicalCue,
          targetWeightKg: tokens.targetWeightKg,
          extractedSets: tokens.sets,
          extractedReps: tokens.repsNum,
          extractedRepRangeLabel: tokens.repRangeLabel,
          extractedRir: tokens.rir,
          leakedNextSection: tokens.leakedNextSection,
        };
      }
    }
  }

  // 4. Moderate match: keep user's exact wording but bind canonicalId for tracking
  if (bestMatch && bestMatch.score >= 75) {
    const item = bestMatch.item;
    const formattedUserClean = formatCapitalizedExercise(clean);
    return {
      rawInput,
      cleanName: clean,
      canonicalCatalogId: item.id,
      canonicalName: hasConflictingEquipment(clean, item.name)
        ? formattedUserClean
        : item.name,
      isCanonicalMatch: false,
      confidence: bestMatch.score,
      muscleGroup: item.muscleGroup,
      mode: item.mode,
      defaultRestSeconds: item.defaultRestSeconds,
      matchedAlias: bestMatch.matchedAlias,
      biomechanicalCue: item.biomechanicalCue,
      targetWeightKg: tokens.targetWeightKg,
      extractedSets: tokens.sets,
      extractedReps: tokens.repsNum,
      extractedRepRangeLabel: tokens.repRangeLabel,
      extractedRir: tokens.rir,
      leakedNextSection: tokens.leakedNextSection,
    };
  }

  // 5. True Custom Exercise: Infer anatomical muscle group and movement pattern
  let inferredMuscle = 'Músculo Principal';
  let inferredPattern: ExerciseClassificationResult['movementPattern'] = undefined;

  for (const mk of MUSCLE_KEYWORDS) {
    if (mk.regex.test(clean) || mk.regex.test(rawInput)) {
      inferredMuscle = mk.muscleGroup;
      inferredPattern = mk.pattern;
      break;
    }
  }

  // Determine mode
  let inferredMode: TrainingMode = targetMode ?? 'hypertrophy';
  if (/\b(?:skierg|sled|burpees?|wall\s*balls?|farmers|hyrox)\b/i.test(clean)) {
    inferredMode = 'hyrox';
  } else if (/\b(?:cuerda|running|correr|nataci[oó]n|ciclismo|bici|km|ritmo)\b/i.test(clean)) {
    inferredMode = 'cardio';
  } else if (/\b(?:front\s*lever|back\s*lever|planche|handstand|pino|muscle\s*up|l-sit|dominadas?\s*estrictas)\b/i.test(clean)) {
    inferredMode = 'calisthenics';
  } else if (/\b(?:1rm|rpe\s*[89]|fuerza\s*m[aá]xima)\b/i.test(clean)) {
    inferredMode = 'strength';
  }

  // Deterministic slug so same custom exercise tracks progression across workouts
  const cleanSlug = normClean.replace(/[^a-z0-9]+/g, '_').slice(0, 32);
  const customId = `custom_cx_${cleanSlug || Math.random().toString(36).slice(2, 8)}`;
  const displayName = formatCapitalizedExercise(clean);

  return {
    rawInput,
    cleanName: displayName || clean,
    canonicalCatalogId: customId,
    canonicalName: displayName || clean,
    isCanonicalMatch: false,
    confidence: 50,
    muscleGroup: inferredMuscle,
    mode: inferredMode,
    defaultRestSeconds: inferredMode === 'strength' ? 150 : inferredMode === 'cardio' ? 45 : 90,
    movementPattern: inferredPattern,
    targetWeightKg: tokens.targetWeightKg,
    extractedSets: tokens.sets,
    extractedReps: tokens.repsNum,
    extractedRepRangeLabel: tokens.repRangeLabel,
    extractedRir: tokens.rir,
    leakedNextSection: tokens.leakedNextSection,
  };
}

function formatCapitalizedExercise(str: string): string {
  const lowercaseWords = new Set(['con', 'en', 'de', 'del', 'para', 'y', 'o', 'a', 'al']);
  return str
    .split(' ')
    .filter(Boolean)
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && lowercaseWords.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}
