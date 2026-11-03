import { ExerciseCatalogItem, TrainingMode } from '@/types/kairos';
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
  movementPattern?: 'Empuje Horizontal' | 'Empuje Vertical' | 'Tracción Horizontal' | 'Tracción Vertical' | 'Dominante de Rodilla' | 'Dominante de Cadera' | 'Aislamiento' | 'Core' | 'Cardio';
}

// Common fitness equipment / posture phrases to strip when normalizing
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
  /\bseries?\b/gi,
  /\breps?\b/gi,
  /\brepeticiones\b/gi,
  /\bdescanso\b/gi,
  /\bpausa\b/gi,
  /\brir\s*[0-4]\b/gi,
  /\brpe\s*(?:10|[6-9](?:\.5)?)\b/gi,
  /\bcalentamiento\b/gi,
  /\baprox\b/gi,
  /\baproximacion\b/gi,
  /\bfallo\b/gi,
  /\bal\s+fallo\b/gi,
  /\bpesado\b/gi,
  /\bliviano\b/gi,
];

// Anatomical keyword inference for novel custom exercises
const MUSCLE_KEYWORDS: { regex: RegExp; muscleGroup: string; pattern?: ExerciseClassificationResult['movementPattern'] }[] = [
  // Pectoral / Pecho
  { regex: /\b(?:pecho|pectoral|banca|aperturas?|cruces?|pec\s*deck|press\s*plano|inclinado|declinado|guillotina|chest)\b/i, muscleGroup: 'Pectoral', pattern: 'Empuje Horizontal' },
  // Espalda / Dorsal
  { regex: /\b(?:espalda|dorsal|remo|jal[oó]n|dominada|pull\s*ups?|chin\s*ups?|pull\s*down|pull\s*over|lat\b|back|trapecio|encogimientos?|t-bar|landmine\s*row)\b/i, muscleGroup: 'Espalda / Dorsal', pattern: 'Tracción Vertical' },
  // Hombros / Deltoides
  { regex: /\b(?:hombro[s]?|deltoide[s]?|militar|overhead|ohp|arnold|laterales|vuelos|p[aá]jaros|face\s*pull|frontales|shoulder)\b/i, muscleGroup: 'Deltoides', pattern: 'Empuje Vertical' },
  // Tríceps
  { regex: /\b(?:tr[ií]ceps?|franc[eé]s|rompecr[aá]neos|rompecabezas|skull\s*crusher|pushdown|copa\s*tr[ií]ceps|patada\s*tr[ií]ceps|fondos?\s*en\s*paralelas|fondos?\s*entre\s*bancos)\b/i, muscleGroup: 'Tríceps', pattern: 'Aislamiento' },
  // Bíceps
  { regex: /\b(?:b[ií]ceps?|curl|martillo|hammer|predicador|scott|bayesian|spider|ara[ñn]a|concentrado|biceps)\b/i, muscleGroup: 'Bíceps', pattern: 'Aislamiento' },
  // Cuádriceps
  { regex: /\b(?:cu[aá]driceps?|sentadilla|squat|prensa|leg\s*press|hack|hacka|sill[oó]n|sissy|extension(?:es)?\s*de\s*pierna|b[uú]lgara|estocada|zancada|lunge)\b/i, muscleGroup: 'Cuádriceps', pattern: 'Dominante de Rodilla' },
  // Isquios / Femoral
  { regex: /\b(?:femoral|isquios?|isquiotibiales?|leg\s*curl|camilla|nordic|curl\s*femoral|stiff|piernas\s*r[ií]gidas)\b/i, muscleGroup: 'Isquiosurales', pattern: 'Dominante de Cadera' },
  // Glúteos
  { regex: /\b(?:gl[uú]teo[s]?|hip\s*thrust|puente|patada\s*gl[uú]teo|abductor|abducci[oó]n|kas\s*glute)\b/i, muscleGroup: 'Glúteos', pattern: 'Dominante de Cadera' },
  // Gemelos / Pantorrillas
  { regex: /\b(?:gemelos?|pantorrilla[s]?|calf|elevacion\s*talones|soleo|tibial)\b/i, muscleGroup: 'Pantorrillas', pattern: 'Aislamiento' },
  // Core / Abdomen
  { regex: /\b(?:abdominal(?:es)?|abdomen|core|crunch|plancha|plank|rueda|ab\s*wheel|l-sit|leg\s*raise|elevacion\s*de\s*piernas|hollow|pallof)\b/i, muscleGroup: 'Abdomen / Core', pattern: 'Core' },
  // Calistenia estáticos
  { regex: /\b(?:front\s*lever|back\s*lever|planche|handstand|pino|muscle\s*up|dragon\s*flag)\b/i, muscleGroup: 'Espalda / Core / Hombros', pattern: 'Core' },
  // Cardio / Hyrox
  { regex: /\b(?:cuerda|comba|running|correr|trote|sprint|nataci[oó]n|ciclismo|bici|skierg|sled|burpees?|wall\s*balls?|farmers)\b/i, muscleGroup: 'Cardiovascular / Full Body', pattern: 'Cardio' },
];

/**
 * Normalizes an exercise string by stripping punctuation, extra spaces,
 * sets/reps artifacts, and common noise.
 */
export function cleanRawExerciseString(raw: string): string {
  let cleaned = raw
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[|¦]/g, ' ')
    .replace(/\t+/g, ' ')
    .trim();

  // Strip leading numbers/bullets (e.g. "1. ", "• ", "A) ")
  cleaned = cleaned.replace(/^(?:[a-d]?\d{1,2}[.):\-]\s+|[•\-*▪◦►▸]\s+)/i, '');

  // Strip sets/reps patterns like "4x10", "3 x 8-12", "4*10"
  cleaned = cleaned.replace(/\b\d{1,2}\s*[x×X*]\s*\d{1,3}(?:\s*[-/a]\s*\d{1,3})?\b/g, ' ');
  cleaned = cleaned.replace(/\b\d{1,2}\s*(?:series|reps|repeticiones)\b/gi, ' ');

  // Strip noise words
  for (const nw of NOISE_WORDS) {
    cleaned = cleaned.replace(nw, ' ');
  }

  // Strip trailing or leading punctuation
  cleaned = cleaned
    .replace(/\(\s*\)/g, ' ')
    .replace(/^[\s:\-–—•*.,/]+|[\s:\-–—•*.,/]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Intelligently classifies any exercise string (from routine import, manual input, or live workout)
 * into a canonical catalog match or a high-precision enriched custom definition.
 */
export function resolveExerciseIntelligently(
  rawInput: string,
  targetMode?: TrainingMode,
  catalogPool: ExerciseCatalogItem[] = BUILTIN_EXERCISES
): ExerciseClassificationResult {
  const clean = cleanRawExerciseString(rawInput);
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
    return {
      rawInput,
      cleanName: clean,
      canonicalCatalogId: item.id,
      canonicalName: item.name,
      isCanonicalMatch: true,
      confidence: Math.min(100, bestMatch.score),
      muscleGroup: item.muscleGroup,
      mode: item.mode,
      defaultRestSeconds: item.defaultRestSeconds,
      matchedAlias: bestMatch.matchedAlias,
      biomechanicalCue: item.biomechanicalCue,
    };
  }

  // 3. Strip equipment modifiers and re-test core exercise
  // e.g. "Press militar con mancuernas muy pesadas" -> "Press militar"
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
        return {
          rawInput,
          cleanName: clean,
          canonicalCatalogId: item.id,
          canonicalName: item.name,
          isCanonicalMatch: true,
          confidence: Math.min(95, hits[0].score),
          muscleGroup: item.muscleGroup,
          mode: item.mode,
          defaultRestSeconds: item.defaultRestSeconds,
          matchedAlias: hits[0].matchedAlias || strippedCore,
          biomechanicalCue: item.biomechanicalCue,
        };
      }
    }
  }

  // 4. Moderate match: keep the coach's exact wording but bind canonicalId for tracking
  if (bestMatch && bestMatch.score >= 75) {
    const item = bestMatch.item;
    return {
      rawInput,
      cleanName: clean,
      canonicalCatalogId: item.id,
      canonicalName: item.name,
      isCanonicalMatch: false, // Flag for user confirmation if in post-workout review
      confidence: bestMatch.score,
      muscleGroup: item.muscleGroup,
      mode: item.mode,
      defaultRestSeconds: item.defaultRestSeconds,
      matchedAlias: bestMatch.matchedAlias,
      biomechanicalCue: item.biomechanicalCue,
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

  const displayName = clean
    .split(' ')
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(' ');

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
  };
}
