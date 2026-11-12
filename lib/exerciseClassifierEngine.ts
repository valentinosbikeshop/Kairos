import {
  ExerciseCatalogItem,
  ExerciseDeepProfile,
  ExerciseGripVariant,
  MovementPatternType,
  OutOfContextWordAnalysis,
  RirValue,
  RoutineDayPlan,
  TrainingMode,
} from '@/types/kairos';
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
  movementPattern?: MovementPatternType;
  deepProfile: ExerciseDeepProfile;
  outOfContextAnalysis: OutOfContextWordAnalysis;
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

// Explicit out-of-context words that users might accidentally type or paste in an exercise name
const EXPLICIT_OUT_OF_CONTEXT_WORDS = new Set([
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
  'hoy', 'ayer', 'manana', 'semana', 'mes', 'enero', 'febrero', 'marzo', 'abril',
  'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  'ojo', 'nota', 'notas', 'recordar', 'acordarse', 'cuidado', 'dolor', 'duele',
  'molestia', 'lesion', 'cansado', 'suave', 'tranquilo', 'rapido', 'lento',
  'casa', 'gimnasio', 'gym', 'parque', 'amigo', 'coach', 'entrenador', 'profe',
  'prueba', 'test', 'error', 'equivocado', 'borrar', 'cambiar', 'opcional',
  'siempre', 'nunca', 'quizas', 'talvez', 'creo', 'mejor', 'peor', 'bueno', 'malo',
  'hola', 'gracias', 'porfa', 'plis', 'xd', 'jaja', 'jeje', 'wtf', 'bro', 'tio', 'che',
  'comentario', 'extra', 'duda', 'pregunta', 'revisar', 'pendiente', 'falta',
]);

// Comprehensive valid fitness, anatomical, biomechanical, equipment, and movement lexicon
const BASE_FITNESS_LEXICON = new Set([
  // Connectives & prepositions
  'de', 'del', 'la', 'las', 'el', 'los', 'en', 'con', 'sin', 'por', 'para', 'a', 'al', 'y', 'e', 'o', 'u', 'un', 'una', 'uno', 'dos', 'tres',
  'c', 'm', 'b', 'x', 'z', 'w', 'v', 't', 'l',
  // Movements & actions
  'press', 'empuje', 'remo', 'row', 'rows', 'jalon', 'jalones', 'pull', 'pulldown', 'pullup', 'pullups', 'pullover',
  'chin', 'chinup', 'chinups', 'dominada', 'dominadas', 'sentadilla', 'sentadillas', 'squat', 'squats',
  'peso', 'muerto', 'deadlift', 'hip', 'thrust', 'puente', 'bridge', 'curl', 'curls',
  'extension', 'extensiones', 'flexion', 'flexiones', 'pushup', 'pushups', 'dip', 'dips', 'fondo', 'fondos',
  'apertura', 'aperturas', 'fly', 'flies', 'cruce', 'cruces', 'crossover', 'vuelo', 'vuelos',
  'elevacion', 'elevaciones', 'raise', 'raises', 'lateral', 'laterales', 'frontal', 'frontales', 'posterior', 'posteriores',
  'pajaro', 'pajaros', 'encogimiento', 'encogimientos', 'shrug', 'shrugs', 'zancada', 'zancadas', 'estocada', 'estocadas',
  'lunge', 'lunges', 'prensa', 'leg', 'hack', 'hacka', 'sissy', 'pendulo', 'pendulum', 'patada', 'patadas', 'kickback',
  'abduccion', 'abducciones', 'aduccion', 'aducciones', 'abductor', 'abductores', 'aductor', 'aductores',
  'crunch', 'crunches', 'plancha', 'plank', 'twist', 'giro', 'rotacion', 'woodchopper', 'pallof',
  'swing', 'snatch', 'clean', 'jerk', 'thruster', 'thrusters', 'burpee', 'burpees', 'salto', 'saltos', 'jump', 'jumps',
  'box', 'step', 'stepup', 'sprint', 'sprints', 'carrera', 'correr', 'running', 'run', 'trote', 'caminata', 'paseo',
  'carry', 'farmer', 'farmers', 'granjero', 'trineo', 'sled', 'push', 'arrastre', 'skierg', 'rower', 'ergometro',
  'assault', 'bike', 'bici', 'bicicleta', 'ciclismo', 'natacion', 'nado', 'cuerda', 'comba', 'battle', 'rope', 'ropes',
  'wall', 'ball', 'balls', 'lanzamiento', 'lanzamientos', 'slam', 'medball', 'muscle', 'up', 'ups', 'lever', 'front', 'back',
  'planche', 'handstand', 'pino', 'hspu', 'pistol', 'dragon', 'flag', 'lsit', 'vsit', 'hollow', 'arch', 'skin', 'cat',
  'tuck', 'straddle', 'full', 'negativa', 'negativas', 'isometrico', 'isometrica', 'pausa', 'tempo', 'explosivo', 'pliometrico',
  'good', 'morning', 'buenos', 'dias', 'nordic', 'nordico', 'glute', 'ham', 'ghd', 'reverse', 'hyper', 'hyperextension',
  'hiperextension', 'hiperextensiones', 'seal', 'pendlay', 'meadows', 'yates', 'kroc', 'helms', 'arnold', 'zottman',
  'drag', 'spider', 'arana', 'bayesian', 'bayesiano', 'predicador', 'scott', 'concentrado', 'martillo', 'hammer',
  'inverso', 'inversa', 'frances', 'rompecraneos', 'rompecabezas', 'skull', 'crusher', 'jm', 'tate', 'katana', 'copa',
  'overhead', 'militar', 'military', 'pushpress', 'landmine', 'viking', 'vikingo', 'guillotina', 'spoto', 'larsen',
  'floor', 'board', 'pin', 'rack', 'block', 'deficit', 'sumo', 'convencional', 'rumano', 'rdl', 'stiff', 'rigidas',
  'zercher', 'goblet', 'jefferson', 'anderson', 'belt', 'bulgara', 'bulgaras', 'bulgarian', 'split', 'cossack', 'curtsy',
  'kas', 'frog', 'donkey', 'burro', 'standing', 'seated', 'lying', 'incline', 'decline', 'flat', 'high', 'low',
  'wide', 'narrow', 'close', 'open', 'single', 'double', 'one', 'two', 'arm', 'arms', 'hand', 'hands',
  'cristos', 'serrucho', 'trasnuca', 'costurera', 'estricta', 'estrictas', 'estricto', 'bloqueo',
  // Anatomy
  'pecho', 'pectoral', 'pectorales', 'chest', 'pec', 'deck', 'espalda', 'dorsal', 'dorsales', 'lat', 'lats',
  'trapecio', 'trapecios', 'traps', 'romboides', 'lumbar', 'lumbares', 'erectores', 'hombro', 'hombros',
  'deltoide', 'deltoides', 'shoulder', 'shoulders', 'delt', 'delts', 'manguito', 'rotador', 'rotadores',
  'biceps', 'braquial', 'braquiorradial', 'antebrazo', 'antebrazos', 'forearm', 'muneca', 'munecas',
  'triceps', 'brazo', 'brazos', 'pierna', 'piernas', 'cuadriceps', 'quad', 'quads', 'femoral', 'femorales',
  'isquio', 'isquios', 'isquiotibiales', 'isquiosurales', 'hamstring', 'hamstrings', 'gluteo', 'gluteos', 'glutes',
  'cadera', 'hips', 'gemelo', 'gemelos', 'pantorrilla', 'pantorrillas', 'calf', 'calves', 'soleo', 'tibial',
  'tobillo', 'rodilla', 'codo', 'cuello', 'abdomen', 'abdominal', 'abdominales', 'abs', 'core', 'oblicuo', 'oblicuos',
  'serrato', 'transverso', 'cuerpo', 'body', 'upper', 'lower', 'tren', 'superior', 'inferior',
  'cabeza', 'larga', 'corta', 'medial', 'anterior', 'clavicular', 'esternal', 'costal', 'mayor', 'menor', 'medio', 'media',
  // Equipment & Modifiers
  'barra', 'barbell', 'mancuerna', 'mancuernas', 'manc', 'dumbbell', 'dumbbells', 'polea', 'poleas', 'cable', 'cables',
  'maquina', 'maquinas', 'machine', 'multipower', 'smith', 'kettlebell', 'kettlebells', 'pesa', 'rusa',
  'banda', 'bandas', 'elastica', 'goma', 'disco', 'discos', 'plate', 'banco', 'bancos', 'bench',
  'plano', 'plana', 'inclinado', 'inclinada', 'declinado', 'declinada', 'alta', 'alto', 'baja', 'bajo',
  'soga', 'ez', 'recta', 'hexagonal', 'trap', 'bar', 'suiza', 'swiss', 'cambered', 'safety', 'ssb',
  'paralelas', 'anillas', 'rings', 'trx', 'suspension', 'cajon', 'bosu', 'fitball', 'rueda', 'abwheel', 'rodillo',
  'saco', 'sandbag', 'chaleco', 'lastre', 'lastrado', 'lastrada', 'cinturon', 'cadena', 'cadenas',
  'agarre', 'grip', 'prono', 'pronado', 'supino', 'supinado', 'neutro', 'mixto', 'ancho', 'abierto', 'cerrado', 'estrecho',
  'gironda', 'triangulo', 'angulo', 'unilateral', 'bilateral', 'alterno', 'alternado', 'simultaneo',
  'sentado', 'sentada', 'parado', 'pie', 'acostado', 'acostada', 'tumbado', 'tumbada', 'arrodillado', 'colgado',
  'apoyo', 'libre', 'guiado', 'guiada', 'asistido', 'asistida', 'convergente', 'divergente', 'isolateral',
  'sillon', 'camilla', 'contractora', 'multipresa', 'concept2', 'erg', 'stairmaster', 'remo',
  'mano', 'manos', 'lado', 'lados', 'grados', 'zona', 'hiit', 'tabata', 'emom', 'amrap', 'vo2', 'max', 'umbral', 'ritmo',
  'enfasis', 'foco', 'fuerza', 'hipertrofia', 'calistenia', 'hyrox', 'cardio',
]);

let cachedFitnessVocabulary: Set<string> | null = null;

function getValidFitnessVocabulary(): Set<string> {
  if (cachedFitnessVocabulary) return cachedFitnessVocabulary;
  const vocab = new Set<string>(BASE_FITNESS_LEXICON);
  for (const item of BUILTIN_EXERCISES) {
    const sources = [item.name, item.muscleGroup, ...(item.aliases || []), item.biomechanicalCue || ''];
    for (const src of sources) {
      const words = normalizeSearchText(src).split(/[^a-z0-9]+/).filter(Boolean);
      for (const w of words) {
        vocab.add(w);
      }
    }
  }
  cachedFitnessVocabulary = vocab;
  return vocab;
}

/**
 * Analyzes an exercise string entered by the user to detect out-of-context words
 * (e.g. conversational notes, schedule days, random typos, or leaked sections)
 * so the UI can ask the user if those words were intentional ("con querer") or an error.
 */
export function detectOutOfContextExerciseWords(rawInput: string): OutOfContextWordAnalysis {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      hasSuspiciousWords: false,
      suspiciousWords: [],
      suggestedCleanName: '',
      originalInput: rawInput,
      explanation: '',
    };
  }

  const vocab = getValidFitnessVocabulary();
  const tokens = extractStructuredExerciseTokens(trimmed);

  // Strip known performance metrics (sets x reps, weights, RIR, rest) from raw text before checking words
  let workingLine = trimmed
    .replace(/\b(\d{1,3}(?:[.,]\d+)?)\s*(kg|kilos?|lbs?|libras?)\b/gi, ' ')
    .replace(/\b([1-9]|10)\s*[x×X*]\s*(\d{1,3})(?:\s*[-/a]\s*(\d{1,3}))?\s*(?:reps?|repeticiones|seg(?:undos)?|s|min(?:utos)?)?\b/gi, ' ')
    .replace(/\bRIR\s*[:=]?\s*[0-4]\+?/gi, ' ')
    .replace(/\b(?:RPE|@)\s*[:=]?\s*(?:10|[6-9](?:[.,]5)?)\b/gi, ' ');

  if (tokens.leakedNextSection) {
    workingLine = workingLine.replace(tokens.leakedNextSection, ' ');
  }

  const rawWords = workingLine
    .replace(/[(),.;:[\]{}"!?¡¿*•]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const suspiciousWords: string[] = [];
  const keptWords: string[] = [];

  for (const word of rawWords) {
    const cleanWord = word.replace(/^[/\-–—]+|[/\-–—]+$/g, '');
    if (!cleanWord) continue;

    const norm = normalizeSearchText(cleanWord);
    if (!norm) continue;

    // Valid numbers (e.g. "30°", "45°", "1", "2", "1000m", "500m", "100m")
    if (/^\d+(?:°|m|km|cm)?$/i.test(cleanWord)) {
      keptWords.push(cleanWord);
      continue;
    }

    // Check explicit out-of-context words first
    if (EXPLICIT_OUT_OF_CONTEXT_WORDS.has(norm)) {
      suspiciousWords.push(cleanWord);
      continue;
    }

    // Check direct membership in fitness vocabulary
    if (vocab.has(norm)) {
      keptWords.push(cleanWord);
      continue;
    }

    // Check singular/plural or common Spanish gender/diminutive stem match (at least 4 chars)
    const stem = norm.replace(/(?:es|s|ado|ada|ados|adas|ito|ita)$/, '');
    let matchedByStem = false;
    if (stem.length >= 4) {
      for (const validWord of Array.from(vocab)) {
        if (validWord.length >= 4 && (validWord.startsWith(stem) || stem.startsWith(validWord))) {
          matchedByStem = true;
          break;
        }
      }
    }

    if (matchedByStem) {
      keptWords.push(cleanWord);
    } else {
      suspiciousWords.push(cleanWord);
    }
  }

  if (tokens.leakedNextSection) {
    suspiciousWords.push(tokens.leakedNextSection);
  }

  const hasSuspiciousWords = suspiciousWords.length > 0;
  const rawSuggested = keptWords.join(' ').trim();
  const suggestedCleanName = sanitizeExerciseName(rawSuggested || tokens.cleanName || trimmed);

  const quotedSuspicious = suspiciousWords.map((w) => `"${w}"`).join(', ');
  const explanation = hasSuspiciousWords
    ? `KAIROS detectó ${suspiciousWords.length === 1 ? 'la palabra' : 'las palabras'} ${quotedSuspicious} fuera del contexto biomecánico habitual de un ejercicio.`
    : 'Nombre de ejercicio biomecánicamente válido.';

  return {
    hasSuspiciousWords,
    suspiciousWords,
    suggestedCleanName: suggestedCleanName || formatCapitalizedExercise(trimmed),
    originalInput: trimmed,
    explanation,
  };
}

export const GRIP_VARIANT_OPTIONS: {
  id: ExerciseGripVariant;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'standard', label: 'Estándar (Natural del ejercicio)', shortLabel: 'Estándar' },
  { id: 'supino', label: 'Agarre Supino (Palmas arriba)', shortLabel: 'Supino' },
  { id: 'prono', label: 'Agarre Prono (Palmas abajo)', shortLabel: 'Prono' },
  { id: 'neutro', label: 'Agarre Neutro / Martillo', shortLabel: 'Neutro' },
  { id: 'cuerda', label: 'Con Cuerda / Soga (Polea)', shortLabel: 'Cuerda' },
  { id: 'barra_z', label: 'Barra Z / Angulada (EZ)', shortLabel: 'Barra Z' },
  { id: 'ancho', label: 'Agarre / Postura Ancha', shortLabel: 'Ancho' },
  { id: 'cerrado', label: 'Agarre / Postura Cerrada', shortLabel: 'Cerrado' },
  { id: 'unilateral', label: 'Unilateral (1 Brazo / Pierna)', shortLabel: 'Unilateral' },
];

export function detectGripVariantFromText(rawName: string): ExerciseGripVariant {
  const n = normalizeSearchText(rawName);
  if (/\b(?:cuerda|soga)\b/.test(n) && !/\bsaltar|comba|jump\b/.test(n)) return 'cuerda';
  if (/\b(?:barra\s*z|barra\s*ez|ez\s*bar|angulad[oa])\b/.test(n)) return 'barra_z';
  if (/\b(?:supin[oa]|palmas?\s*arriba|inverso|chin\s*up)\b/.test(n)) return 'supino';
  if (/\b(?:pron[oa]|palmas?\s*abajo)\b/.test(n)) return 'prono';
  if (/\b(?:neutr[oa]|martillo|hammer|gironda|triangulo|paralelo)\b/.test(n)) return 'neutro';
  if (/\b(?:unilateral|1\s*mano|una\s*mano|1\s*brazo|1\s*pierna|isolateral|serrucho)\b/.test(n))
    return 'unilateral';
  if (/\b(?:cerrad[oa]|estrech[oa]|close\s*grip)\b/.test(n)) return 'cerrado';
  if (/\b(?:anch[oa]|abiert[oa]|wide\s*grip|sumo)\b/.test(n)) return 'ancho';
  return 'standard';
}

export function applyGripAndVariantModifiers(
  baseProfile: ExerciseDeepProfile,
  rawName: string,
  mode: TrainingMode,
  explicitGrip?: ExerciseGripVariant
): ExerciseDeepProfile {
  const effectiveGrip =
    explicitGrip && explicitGrip !== 'standard'
      ? explicitGrip
      : detectGripVariantFromText(rawName);

  const prof: ExerciseDeepProfile = {
    ...baseProfile,
    primaryMuscles: [...baseProfile.primaryMuscles],
    secondaryMuscles: [...baseProfile.secondaryMuscles],
    stabilizerMuscles: [...baseProfile.stabilizerMuscles],
    jointStress: {
      level: baseProfile.jointStress.level,
      joints: [...baseProfile.jointStress.joints],
    },
    gripVariant: effectiveGrip,
  };

  if (effectiveGrip === 'standard') {
    return prof;
  }

  const normName = normalizeSearchText(rawName);
  const isPull =
    prof.movementPattern === 'Tracción Vertical' ||
    prof.movementPattern === 'Tracción Horizontal' ||
    /\b(?:jalon|dominada|remo|row|pull)\b/.test(normName);
  const isPush =
    prof.movementPattern === 'Empuje Horizontal' ||
    prof.movementPattern === 'Empuje Vertical' ||
    /\b(?:press|banca|fondo|flexion|push)\b/.test(normName);
  const isCurl = /\b(?:curl|biceps)\b/.test(normName) && !/\b(?:femoral|isquio|leg)\b/.test(normName);
  const isTriceps =
    /\b(?:triceps|frances|rompecraneos|pushdown|extension.*codo|copa|katana|patada.*triceps)\b/.test(
      normName
    );
  const isLowerBody =
    prof.movementPattern === 'Dominante de Rodilla' ||
    prof.movementPattern === 'Dominante de Cadera';

  if (effectiveGrip === 'supino') {
    if (isPull) {
      prof.primaryMuscles = [
        'Dorsal Ancho (Fibras Iliocostales / Inferiores en Elongación)',
        'Bíceps Braquial (Cabeza Larga y Corta)',
      ];
      prof.secondaryMuscles = ['Redondo Mayor', 'Braquial Anterior', 'Trapecio Inferior'];
      prof.jointStress.level = 'Bajo';
      prof.variantAnalysisNote =
        'Agarre Supino en Tracción: Alinea los codos en el plano sagital maximizando la extensión humeral del Dorsal Inferior e incrementa un ~25% el reclutamiento directo del Bíceps Braquial.';
      prof.biomechanicalCue =
        'Con agarre supino, lleva los codos pegados al torso hacia las caderas evitando encoger los hombros.';
    } else if (isCurl) {
      prof.primaryMuscles = ['Bíceps Braquial (Cabeza Corta y Larga - Máxima Supinación)'];
      prof.secondaryMuscles = ['Braquial Anterior', 'Supinador Corto y Braquiorradial'];
      prof.variantAnalysisNote =
        'Agarre Supino en Curl: Combina flexión de codo y supinación radiocubital para máxima activación electromiográfica del Bíceps Braquial.';
    } else if (isTriceps) {
      prof.primaryMuscles = ['Tríceps Braquial (Énfasis Cabeza Medial)'];
      prof.secondaryMuscles = ['Tríceps Braquial (Cabeza Lateral)', 'Ancóneo'];
      prof.stabilizerMuscles = ['Supinadores y Flexores del Antebrazo', ...prof.stabilizerMuscles];
      prof.variantAnalysisNote =
        'Agarre Supino en Tríceps: Desplaza el énfasis hacia la cabeza medial del tríceps y exige alta estabilización isométrica de muñeca.';
    } else if (isPush) {
      prof.primaryMuscles = ['Pectoral Mayor (Haz Clavicular / Superior)', 'Tríceps Braquial'];
      prof.secondaryMuscles = ['Deltoides Anterior', 'Bíceps Braquial (Cabeza Larga - Estabilizador)'];
      prof.jointStress.level = 'Bajo';
      prof.variantAnalysisNote =
        'Agarre Supino en Empuje: Incrementa la flexión sagital del hombro (+25% activación del Pectoral Clavicular) y reduce el pinzamiento subacromial.';
    } else {
      prof.variantAnalysisNote =
        'Agarre Supino: Incrementa la participación de flexores supinadores (Bíceps Braquial) y alinea el codo en plano sagital.';
    }
  } else if (effectiveGrip === 'prono') {
    if (isPull) {
      prof.primaryMuscles = [
        'Dorsal Ancho (Anchura Torácica Superior)',
        'Redondo Mayor',
        'Trapecio Medio e Inferior',
      ];
      prof.secondaryMuscles = ['Deltoides Posterior', 'Braquiorradial (Antebrazo)', 'Braquial Anterior'];
      prof.variantAnalysisNote =
        'Agarre Prono en Tracción: Abduce ligeramente el húmero enfatizando Redondo Mayor, Espalda Alta y Deltoides Posterior; en el codo reduce la ventaja del bíceps y transfiere carga al Braquiorradial.';
    } else if (isCurl) {
      prof.primaryMuscles = [
        'Braquiorradial (Antebrazo)',
        'Braquial Anterior',
        'Extensores Radiales del Carpo',
      ];
      prof.secondaryMuscles = ['Bíceps Braquial (En Desventaja Mecánica por Pronación)'];
      prof.variantAnalysisNote =
        'Agarre Prono (Curl Inverso): La pronación radiocubital inhibe la línea de tracción del bíceps braquial, convirtiendo al Braquiorradial y Braquial Anterior en los agonistas primarios.';
    } else if (isTriceps) {
      prof.primaryMuscles = ['Tríceps Braquial (Cabeza Lateral y Medial)'];
      prof.secondaryMuscles = ['Tríceps Braquial (Cabeza Larga)', 'Ancóneo'];
      prof.variantAnalysisNote =
        'Agarre Prono en Tríceps: Estabiliza la muñeca en pronación para aplicar máxima fuerza de bloqueo sobre la cabeza lateral y medial del tríceps.';
    } else {
      prof.variantAnalysisNote =
        'Agarre Prono: Incrementa la demanda sobre extensores del antebrazo, Braquiorradial y cadena posterior escapular.';
    }
  } else if (effectiveGrip === 'neutro') {
    prof.jointStress.level = 'Bajo';
    prof.sfrScore = Math.min(10, prof.sfrScore + 1);
    if (isPull) {
      prof.primaryMuscles = [
        'Dorsal Ancho (Fibras Medias e Inferiores)',
        'Redondo Mayor',
      ];
      prof.secondaryMuscles = ['Braquiorradial', 'Braquial Anterior', 'Bíceps Braquial', 'Romboides'];
      prof.variantAnalysisNote =
        'Agarre Neutro en Tracción: Coloca el antebrazo en su ventaja mecánica óptima (palmas enfrentadas), potenciando el Dorsal Ancho y el Braquiorradial con mínimo estrés en hombro y codo.';
    } else if (isCurl) {
      prof.primaryMuscles = [
        'Braquiorradial',
        'Braquial Anterior',
        'Bíceps Braquial (Cabeza Larga)',
      ];
      prof.secondaryMuscles = ['Extensores y Flexores del Carpo (Estabilidad Radial)'];
      prof.variantAnalysisNote =
        'Agarre Neutro (Martillo): Enfatiza el Braquiorradial, el Braquial Anterior (que empuja al bíceps hacia afuera dando grosor al brazo) y la cabeza larga del bíceps sin estrés valgo en muñeca.';
    } else if (isPush || isTriceps) {
      prof.primaryMuscles = isTriceps
        ? ['Tríceps Braquial (Cabeza Lateral, Larga y Medial)']
        : ['Pectoral Mayor (Porción Esternal y Clavicular)', 'Tríceps Braquial'];
      prof.variantAnalysisNote =
        'Agarre Neutro en Empuje/Tríceps: Alinea el húmero en el plano escapular (~30–45°), protegiendo el manguito rotador y maximizando la transferencia de fuerza al Tríceps y Pectoral.';
    } else {
      prof.variantAnalysisNote =
        'Agarre Neutro: Alinea radio y cúbito reduciendo el estrés articular en muñeca, codo y hombro (+SFR).';
    }
  } else if (effectiveGrip === 'cuerda') {
    prof.equipmentType = 'Polea con Cuerda';
    prof.jointStress.level = 'Bajo';
    prof.sfrScore = Math.min(10, prof.sfrScore + 1);
    prof.cnsFatigueIndex = Math.max(2, prof.cnsFatigueIndex - 1);
    prof.fatigueCoefficient = Math.max(0.65, Math.round((prof.fatigueCoefficient - 0.1) * 100) / 100);
    if (isTriceps) {
      prof.primaryMuscles = [
        'Tríceps Braquial (Cabeza Lateral y Cabeza Larga en Acortamiento Pico)',
        'Tríceps Braquial (Cabeza Medial)',
      ];
      prof.resistanceProfile = 'Pico en Contracción (Shortened)';
      prof.variantAnalysisNote =
        'Variante con Cuerda en Tríceps: Permite separar las manos y pronar al final de la extensión con ligera extensión humeral, logrando acortamiento máximo de la cabeza lateral y larga del tríceps sin forzar muñecas ni codos (SFR 10/10).';
      prof.biomechanicalCue =
        'Al extender los codos, separa las puntas de la cuerda hacia afuera manteniendo los brazos fijos a los costados.';
    } else if (isCurl) {
      prof.primaryMuscles = [
        'Bíceps Braquial (Supinación Progresiva)',
        'Braquiorradial y Braquial Anterior',
      ];
      prof.variantAnalysisNote =
        'Variante con Cuerda en Bíceps: Permite iniciar el movimiento en agarre neutro (fuerte para el braquiorradial) y supinar libremente en la cima para máxima contracción del bíceps.';
    } else if (isPull) {
      prof.variantAnalysisNote =
        'Variante con Cuerda en Tracción/Pullover: Elimina el tope de una barra rígida contra el cuerpo, aumentando el rango de recorrido final en Dorsal Ancho, Deltoides Posterior y Trapecio Medio.';
    } else {
      prof.variantAnalysisNote =
        'Variante con Cuerda: Libertad rotacional completa en muñecas y codos, mayor rango de contracción y menor estrés articular.';
    }
  } else if (effectiveGrip === 'barra_z') {
    prof.equipmentType = 'Barra Z (Angulada)';
    prof.jointStress.level = 'Bajo';
    prof.sfrScore = Math.min(10, prof.sfrScore + 1);
    if (isCurl) {
      prof.primaryMuscles = [
        'Bíceps Braquial (Énfasis Cabeza Larga)',
        'Braquial Anterior',
      ];
      prof.secondaryMuscles = ['Braquiorradial', 'Flexores del Antebrazo'];
      prof.variantAnalysisNote =
        'Variante en Barra Z (Curl): El ángulo semi-supinado (~25°) elimina la torsión forzada en muñecas y epitróclea del codo, repartiendo la tensión entre el Bíceps Braquial y el Braquial Anterior.';
    } else if (isTriceps) {
      prof.primaryMuscles = [
        'Tríceps Braquial (Cabeza Larga y Lateral)',
        'Tríceps Braquial (Cabeza Medial)',
      ];
      prof.variantAnalysisNote =
        'Variante en Barra Z (Tríceps): Alinea los codos evitando que se abran excesivamente y reduce la tensión sobre el tendón distal del tríceps y las muñecas.';
    } else {
      prof.variantAnalysisNote =
        'Variante en Barra Z: Angulación ergonómica que reduce el estrés radiocubital en muñecas y codos.';
    }
  } else if (effectiveGrip === 'ancho') {
    if (isPull) {
      prof.primaryMuscles = [
        'Redondo Mayor',
        'Dorsal Ancho (Fibras Superiores - Anchura Torácica)',
        'Trapecio Medio',
      ];
      prof.variantAnalysisNote =
        'Agarre Ancho en Tracción: Incrementa la abducción frontal del hombro enfatizando el Redondo Mayor y las fibras superiores del Dorsal Ancho con un recorrido de codo más corto.';
    } else if (isPush) {
      prof.primaryMuscles = ['Pectoral Mayor (Porción Esternocostal Externa)'];
      prof.secondaryMuscles = ['Deltoides Anterior', 'Tríceps Braquial (Menor Recorrido)'];
      prof.jointStress.level = 'Moderado';
      prof.variantAnalysisNote =
        'Agarre Ancho en Empuje: Maximiza el brazo de momento sobre el Pectoral Mayor y reduce los grados de extensión del codo (menor participación de tríceps, mayor carga en hombro/pectoral).';
    } else if (isLowerBody) {
      prof.primaryMuscles = ['Glúteo Mayor', 'Aductor Mayor', 'Cuádriceps'];
      prof.variantAnalysisNote =
        'Postura Ancha / Sumo: Incrementa la abducción de cadera reclutando con mayor intensidad el Aductor Mayor y el Glúteo Mayor, y acortando el brazo de momento lumbar.';
    } else {
      prof.variantAnalysisNote =
        'Agarre Ancho: Aumenta el brazo de momento externo enfatizando las fibras externas del grupo muscular principal.';
    }
  } else if (effectiveGrip === 'cerrado') {
    if (isPush) {
      prof.primaryMuscles = [
        'Tríceps Braquial (Cabeza Lateral y Medial)',
        'Pectoral Mayor (Porción Clavicular e Interna)',
      ];
      prof.secondaryMuscles = ['Deltoides Anterior'];
      prof.variantAnalysisNote =
        'Agarre Cerrado en Empuje: Maximiza el rango de flexo-extensión de los codos, convirtiendo al Tríceps Braquial y al Pectoral Superior/Interno en los motores principales.';
    } else if (isPull) {
      prof.primaryMuscles = ['Dorsal Ancho (Fibras Inferiores - Mayor Rango)', 'Bíceps y Braquial'];
      prof.variantAnalysisNote =
        'Agarre Cerrado en Tracción: Permite el mayor rango de recorrido desde el estiramiento completo hasta la extensión sagital del hombro, enfatizando el Dorsal Inferior.';
    } else if (isLowerBody) {
      prof.primaryMuscles = ['Cuádriceps (Vasto Lateral y Recto Femoral)'];
      prof.secondaryMuscles = ['Glúteo Mayor'];
      prof.variantAnalysisNote =
        'Postura Cerrada / Estrecha: Incrementa el desplazamiento anterior de la rodilla (dorsiflexión), concentrando la tensión mecánica sobre los Cuádriceps.';
    } else {
      prof.variantAnalysisNote =
        'Agarre Cerrado: Amplía el rango de recorrido articular y enfatiza los extensores/flexores de codo.';
    }
  } else if (effectiveGrip === 'unilateral') {
    prof.sfrScore = Math.min(10, prof.sfrScore + 1);
    prof.cnsFatigueIndex = Math.max(2, prof.cnsFatigueIndex - 1);
    prof.fatigueCoefficient = Math.max(0.65, Math.round((prof.fatigueCoefficient - 0.1) * 100) / 100);
    if (!prof.stabilizerMuscles.some((m) => /oblicuo|antirrotacional/i.test(m))) {
      prof.stabilizerMuscles = ['Oblicuos y Core Antirrotacional', ...prof.stabilizerMuscles];
    }
    prof.variantAnalysisNote =
      'Ejecución Unilateral (1 extremidad): Elimina el déficit bilateral permitiendo mayor reclutamiento de unidades motoras por lado, corrige asimetrías, reduce la fatiga sistémica del SNC (-1 pt) y exige estabilización de Oblicuos y Core Antirrotacional.';
  }

  return prof;
}

/**
 * Synthesizes a complete, scientific biomechanical and physiological profile (ExerciseDeepProfile)
 * for any canonical or user-created exercise, dynamically applying grip/variant modifiers.
 */
export function synthesizeExerciseDeepProfile(
  rawName: string,
  targetMode?: TrainingMode,
  catalogId?: string,
  gripVariant?: ExerciseGripVariant
): ExerciseDeepProfile {
  // Gracefully handle if caller passed a grip variant directly in 3rd parameter position
  let effectiveCatalogId = catalogId;
  let effectiveGrip = gripVariant;
  if (
    catalogId &&
    ['standard', 'supino', 'prono', 'neutro', 'cuerda', 'barra_z', 'ancho', 'cerrado', 'unilateral'].includes(
      catalogId
    ) &&
    !gripVariant
  ) {
    effectiveGrip = catalogId as ExerciseGripVariant;
    effectiveCatalogId = undefined;
  }

  const clean = sanitizeExerciseName(rawName) || rawName.trim();
  const norm = normalizeSearchText(clean);

  const catalogItem =
    (effectiveCatalogId ? BUILTIN_EXERCISES.find((b) => b.id === effectiveCatalogId) : undefined) ||
    BUILTIN_EXERCISES.find(
      (b) =>
        normalizeSearchText(b.name) === norm ||
        b.aliases?.some((a) => normalizeSearchText(a) === norm)
    );

  const mode: TrainingMode = catalogItem?.mode || targetMode || 'hypertrophy';

  if (catalogItem?.deepProfile) {
    return applyGripAndVariantModifiers(catalogItem.deepProfile, rawName, mode, effectiveGrip);
  }

  // 1. Determine Equipment Type
  let equipmentType: ExerciseDeepProfile['equipmentType'] = 'Barra';
  if (/\b(?:poleas?|cables?|cruces?|bayesian[oa]?|katana|face\s*pull|jal[oó]n|pushdown)\b/i.test(clean)) {
    equipmentType = 'Polea / Cable';
  } else if (/\b(?:multipower|smith)\b/i.test(clean)) {
    equipmentType = 'Multipower / Smith';
  } else if (/\b(?:m[aá]quinas?|pec\s*deck|contractora|prensa|hack|hacka|sill[oó]n|camilla|p[eé]ndulo|abductor|aductor)\b/i.test(clean)) {
    equipmentType = 'Máquina';
  } else if (/\b(?:mancuernas?|c\/manc|arnold|martillo|hammer|concentrado|p[aá]jaros|serrucho|goblet|zottman)\b/i.test(clean)) {
    equipmentType = 'Mancuernas';
  } else if (/\b(?:kettlebells?|pesa\s*rusa|saco|sandbag|trineo|sled|wall\s*balls?|farmers|granjero)\b/i.test(clean)) {
    equipmentType = 'Kettlebell / Libre';
  } else if (/\b(?:cuerda|comba|running|correr|sprint|nataci[oó]n|ciclismo|bici|skierg|erg[oó]metro|stairmaster|assault)\b/i.test(clean)) {
    equipmentType = 'Ergo / Cardio';
  } else if (
    mode === 'calisthenics' ||
    /\b(?:dominadas?|fondos?|flexiones|push\s*ups?|front\s*lever|back\s*lever|planche|handstand|pino|muscle\s*up|pistol|l-sit|dragon\s*flag|plancha|plank|n[oó]rdic[oa]?|burpees?)\b/i.test(clean)
  ) {
    equipmentType = 'Peso Corporal';
  }

  // 2. Default Biomechanical Variables
  let primaryMuscles: string[] = ['Grupo Muscular Principal'];
  let secondaryMuscles: string[] = ['Sinergistas Articulares'];
  let stabilizerMuscles: string[] = ['Core Antirrotacional', 'Estabilizadores Escapulares'];
  let movementPattern: MovementPatternType = 'Aislamiento';
  let mechanicType: ExerciseDeepProfile['mechanicType'] = 'Compuesto';
  let resistanceProfile: ExerciseDeepProfile['resistanceProfile'] = 'Rango Medio (Mid-Range)';
  let sfrScore = 8;
  let cnsFatigueIndex = 6;
  let localFatigueIndex = 7;
  let jointStress: ExerciseDeepProfile['jointStress'] = {
    level: 'Moderado',
    joints: ['Articulación Principal'],
  };
  let recoveryHours: ExerciseDeepProfile['recoveryHours'] = 48;
  let optimalRepRange = '8–12 reps';
  let biomechanicalCue =
    catalogItem?.biomechanicalCue ||
    'Controla la fase excéntrica durante 2–3 segundos manteniendo estabilidad axial y máxima tensión en el músculo objetivo.';
  let fatigueCoefficient = 1.0;

  // 3. Deep Anatomical & Physiological Rules Engine
  if (/\b(?:aperturas?|pec\s*deck|cruces?|crossover|fly)\b/i.test(clean)) {
    // Pectoral Isolation
    primaryMuscles = ['Pectoral Mayor (Porción Esternocostal y Clavicular)'];
    secondaryMuscles = ['Deltoides Anterior', 'Bíceps Braquial (Cabeza Corta - Fijador)'];
    stabilizerMuscles = ['Manguito Rotador', 'Serrato Anterior', 'Trapecio Inferior'];
    movementPattern = 'Aislamiento';
    mechanicType = 'Aislamiento';
    resistanceProfile =
      equipmentType === 'Polea / Cable' || equipmentType === 'Máquina'
        ? 'Constante / Lineal'
        : 'Pico en Estiramiento (Lengthened)';
    sfrScore = 9;
    cnsFatigueIndex = 3;
    localFatigueIndex = 8;
    jointStress = { level: 'Bajo', joints: ['Hombro (Glenohumeral)'] };
    recoveryHours = 36;
    optimalRepRange = '10–15 reps';
    fatigueCoefficient = 0.85;
  } else if (/\b(?:banca|press\s*plano|press\s*inclinado|press\s*declinado|press\s*de\s*pecho|flexiones|fondos?\s*en\s*paralelas|guillotina)\b/i.test(clean)) {
    // Horizontal Push / Chest Compound
    const isIncline = /\b(?:inclinad[oa]|clavicular|superior)\b/i.test(clean);
    const isDeclineOrDips = /\b(?:declinad[oa]|fondos?|inferior)\b/i.test(clean);
    primaryMuscles = isIncline
      ? ['Pectoral Mayor (Haz Clavicular / Superior)']
      : isDeclineOrDips
      ? ['Pectoral Mayor (Haz Costal / Inferior)', 'Tríceps Braquial']
      : ['Pectoral Mayor (Porción Esternocostal)'];
    secondaryMuscles = ['Deltoides Anterior', 'Tríceps Braquial (Cabeza Lateral y Medial)'];
    stabilizerMuscles = ['Manguito Rotador (Infraespinoso)', 'Serrato Anterior', 'Dorsal Ancho (Retracción Escapular)'];
    movementPattern = 'Empuje Horizontal';
    mechanicType = 'Compuesto';
    resistanceProfile = 'Pico en Estiramiento (Lengthened)';
    const isMachineOrSmith = equipmentType === 'Máquina' || equipmentType === 'Multipower / Smith';
    sfrScore = isMachineOrSmith ? 9 : 8;
    cnsFatigueIndex = isMachineOrSmith ? 5 : 7;
    localFatigueIndex = 8;
    jointStress = {
      level: isDeclineOrDips || equipmentType === 'Barra' ? 'Moderado' : 'Bajo',
      joints: ['Hombro (Glenohumeral y Acromioclavicular)', 'Codo'],
    };
    recoveryHours = 48;
    optimalRepRange = mode === 'strength' ? '3–6 reps' : '6–10 reps';
    fatigueCoefficient = isMachineOrSmith ? 1.15 : 1.35;
  } else if (/\b(?:pull\s*over|pullover)\b/i.test(clean)) {
    // Pullover
    primaryMuscles = ['Dorsal Ancho (Fibras Externas en Estiramiento)', 'Redondo Mayor'];
    secondaryMuscles = ['Tríceps Braquial (Cabeza Larga)', 'Pectoral Mayor (Porción Esternal)'];
    stabilizerMuscles = ['Serrato Anterior', 'Recto Abdominal', 'Manguito Rotador'];
    movementPattern = 'Tracción Vertical';
    mechanicType = 'Aislamiento';
    resistanceProfile = equipmentType === 'Polea / Cable' ? 'Constante / Lineal' : 'Pico en Estiramiento (Lengthened)';
    sfrScore = 9;
    cnsFatigueIndex = 3;
    localFatigueIndex = 7;
    jointStress = { level: 'Bajo', joints: ['Hombro (Glenohumeral)'] };
    recoveryHours = 36;
    optimalRepRange = '10–15 reps';
    fatigueCoefficient = 0.85;
  } else if (/\b(?:jal[oó]n|dominadas?|pull\s*ups?|chin\s*ups?|pulldown|muscle\s*up)\b/i.test(clean)) {
    // Vertical Pull
    const isNeutralOrSupine = /\b(?:neutro|supin[oa]|cerrado|chin)\b/i.test(clean);
    primaryMuscles = isNeutralOrSupine
      ? ['Dorsal Ancho (Fibras Iliocostales / Inferiores)', 'Redondo Mayor']
      : ['Dorsal Ancho (Anchura Torácica)', 'Redondo Mayor', 'Trapecio Inferior'];
    secondaryMuscles = ['Bíceps Braquial', 'Braquial Anterior', 'Braquiorradial', 'Deltoides Posterior'];
    stabilizerMuscles = ['Cabeza Larga del Tríceps', 'Romboides', 'Core Antihiperextensión'];
    movementPattern = 'Tracción Vertical';
    mechanicType = 'Compuesto';
    resistanceProfile = 'Pico en Contracción (Shortened)';
    sfrScore = 9;
    cnsFatigueIndex = equipmentType === 'Peso Corporal' ? 7 : 5;
    localFatigueIndex = 8;
    jointStress = { level: 'Bajo', joints: ['Hombro', 'Codo'] };
    recoveryHours = 48;
    optimalRepRange = '6–12 reps';
    fatigueCoefficient = equipmentType === 'Peso Corporal' ? 1.25 : 1.1;
  } else if (/\b(?:remo|row|t-bar|pendlay|seal|meadows|serrucho)\b/i.test(clean) && mode !== 'cardio' && mode !== 'hyrox') {
    // Horizontal Pull / Row
    const isChestSupportedOrCable =
      /\b(?:pecho\s*apoyado|seal|m[aá]quina|polea|gironda|sentado)\b/i.test(clean);
    primaryMuscles = ['Dorsal Ancho', 'Trapecio Medio e Inferior', 'Romboides Mayor y Menor'];
    secondaryMuscles = ['Deltoides Posterior', 'Bíceps Braquial', 'Braquiorradial'];
    stabilizerMuscles = isChestSupportedOrCable
      ? ['Manguito Rotador', 'Core Antirrotacional']
      : ['Erectores Espinales Lumbares', 'Isquiosurales (Isométrico)', 'Transverso Abdominal'];
    movementPattern = 'Tracción Horizontal';
    mechanicType = 'Compuesto';
    resistanceProfile = 'Pico en Contracción (Shortened)';
    sfrScore = isChestSupportedOrCable ? 9 : 7;
    cnsFatigueIndex = isChestSupportedOrCable ? 5 : 8;
    localFatigueIndex = 8;
    jointStress = {
      level: isChestSupportedOrCable ? 'Bajo' : 'Moderado',
      joints: isChestSupportedOrCable ? ['Hombro', 'Codo'] : ['Columna Lumbar', 'Hombro', 'Codo'],
    };
    recoveryHours = isChestSupportedOrCable ? 36 : 48;
    optimalRepRange = '8–12 reps';
    fatigueCoefficient = isChestSupportedOrCable ? 1.1 : 1.4;
  } else if (/\b(?:encogimientos?|shrugs?)\b/i.test(clean)) {
    // Traps
    primaryMuscles = ['Trapecio Superior (Fibras Descendentes)'];
    secondaryMuscles = ['Elevador de la Escápula', 'Trapecio Medio'];
    stabilizerMuscles = ['Flexores del Antebrazo (Agarre)', 'Core y Erectores Espinales'];
    movementPattern = 'Aislamiento';
    mechanicType = 'Aislamiento';
    resistanceProfile = 'Pico en Contracción (Shortened)';
    sfrScore = 8;
    cnsFatigueIndex = 4;
    localFatigueIndex = 7;
    jointStress = { level: 'Bajo', joints: ['Acromioclavicular', 'Columna Cervical'] };
    recoveryHours = 36;
    optimalRepRange = '10–15 reps';
    fatigueCoefficient = 0.8;
  } else if (/\b(?:p[aá]jaros|face\s*pull|deltoide\s*posterior|cruces?\s*inversos?)\b/i.test(clean)) {
    // Rear Delts
    primaryMuscles = ['Deltoides Posterior', 'Infraespinoso y Redondo Menor'];
    secondaryMuscles = ['Trapecio Medio e Inferior', 'Romboides'];
    stabilizerMuscles = ['Erectores Torácicos', 'Core'];
    movementPattern = 'Tracción Horizontal';
    mechanicType = 'Aislamiento';
    resistanceProfile = 'Pico en Contracción (Shortened)';
    sfrScore = 9;
    cnsFatigueIndex = 2;
    localFatigueIndex = 7;
    jointStress = { level: 'Bajo', joints: ['Hombro (Glenohumeral)'] };
    recoveryHours = 24;
    optimalRepRange = '12–20 reps';
    fatigueCoefficient = 0.7;
  } else if (/\b(?:elevaciones?\s*laterales|laterales|vuelos?\s*laterales|elevaciones?\s*frontales)\b/i.test(clean)) {
    // Lateral / Front Delt Isolation
    const isFront = /\bfrontal/i.test(clean);
    primaryMuscles = isFront ? ['Deltoides Anterior'] : ['Deltoides Lateral (Porción Acromial Media)'];
    secondaryMuscles = ['Supraespinoso', 'Trapecio Superior', 'Serrato Anterior'];
    stabilizerMuscles = ['Manguito Rotador', 'Extensores de Muñeca', 'Core'];
    movementPattern = 'Aislamiento';
    mechanicType = 'Aislamiento';
    resistanceProfile =
      equipmentType === 'Polea / Cable'
        ? 'Pico en Estiramiento (Lengthened)'
        : 'Pico en Contracción (Shortened)';
    sfrScore = equipmentType === 'Polea / Cable' || equipmentType === 'Máquina' ? 10 : 9;
    cnsFatigueIndex = 2;
    localFatigueIndex = 8;
    jointStress = { level: 'Bajo', joints: ['Hombro (Subacromial)'] };
    recoveryHours = 24;
    optimalRepRange = '12–20 reps';
    fatigueCoefficient = 0.75;
  } else if (/\b(?:press\s*militar|press\s*de\s*hombros?|arnold|overhead|ohp|hspu|flexiones\s*en\s*pino)\b/i.test(clean)) {
    // Vertical Push
    primaryMuscles = ['Deltoides Anterior', 'Deltoides Lateral'];
    secondaryMuscles = ['Tríceps Braquial', 'Pectoral Mayor (Haz Clavicular)', 'Serrato Anterior'];
    stabilizerMuscles = ['Trapecio Superior e Inferior', 'Manguito Rotador', 'Core y Erectores Espinales'];
    movementPattern = 'Empuje Vertical';
    mechanicType = 'Compuesto';
    resistanceProfile = 'Pico en Estiramiento (Lengthened)';
    sfrScore = 8;
    cnsFatigueIndex = equipmentType === 'Barra' || equipmentType === 'Peso Corporal' ? 7 : 5;
    localFatigueIndex = 8;
    jointStress = { level: 'Moderado', joints: ['Hombro (Glenohumeral)', 'Codo', 'Columna Lumbar'] };
    recoveryHours = 48;
    optimalRepRange = mode === 'strength' ? '4–6 reps' : '6–10 reps';
    fatigueCoefficient = 1.25;
  } else if (/\b(?:curl)\b/i.test(clean) && !/\b(?:femoral|pierna|isquio|leg|nordic)\b/i.test(clean)) {
    // Biceps Curls
    const isLengthened = /\b(?:bayesian[oa]?|inclinad[oa])\b/i.test(clean);
    const isShortened = /\b(?:predicador|scott|spider|ara[ñn]a|concentrado)\b/i.test(clean);
    const isHammerOrReverse = /\b(?:martillo|hammer|inverso|zottman)\b/i.test(clean);

    primaryMuscles = isHammerOrReverse
      ? ['Braquiorradial', 'Braquial Anterior', 'Bíceps Braquial']
      : isLengthened
      ? ['Bíceps Braquial (Énfasis Cabeza Larga)']
      : isShortened
      ? ['Bíceps Braquial (Énfasis Cabeza Corta)', 'Braquial Anterior']
      : ['Bíceps Braquial (Cabeza Larga y Corta)'];
    secondaryMuscles = isHammerOrReverse
      ? ['Extensores Radiales del Carpo', 'Pronador Redondo']
      : ['Braquial Anterior', 'Braquiorradial'];
    stabilizerMuscles = ['Deltoides Anterior (Fijador Humeral)', 'Flexores de Muñeca', 'Estabilizadores Escapulares'];
    movementPattern = 'Aislamiento';
    mechanicType = 'Aislamiento';
    resistanceProfile = isLengthened
      ? 'Pico en Estiramiento (Lengthened)'
      : isShortened
      ? 'Pico en Contracción (Shortened)'
      : equipmentType === 'Polea / Cable'
      ? 'Constante / Lineal'
      : 'Rango Medio (Mid-Range)';
    sfrScore = isLengthened || equipmentType === 'Polea / Cable' ? 10 : 9;
    cnsFatigueIndex = 2;
    localFatigueIndex = 8;
    jointStress = { level: 'Bajo', joints: ['Codo (Humerocubital)', 'Muñeca'] };
    recoveryHours = 24;
    optimalRepRange = '8–15 reps';
    fatigueCoefficient = 0.75;
  } else if (/\b(?:tr[ií]ceps|franc[eé]s|rompecr[aá]neos|rompecabezas|katana|copa|pushdown|patada\s*de\s*tr[ií]ceps|jm\s*press|banca\s*agarre\s*cerrado)\b/i.test(clean)) {
    // Triceps
    const isOverheadOrLengthened = /\b(?:franc[eé]s|rompecr[aá]neos|rompecabezas|katana|copa|overhead|trasnuca)\b/i.test(clean);
    const isCompoundTriceps = /\b(?:cerrado|jm\s*press)\b/i.test(clean);
    primaryMuscles = isOverheadOrLengthened
      ? ['Tríceps Braquial (Énfasis Cabeza Larga en Estiramiento)']
      : ['Tríceps Braquial (Cabeza Lateral y Medial)'];
    secondaryMuscles = isCompoundTriceps
      ? ['Pectoral Mayor', 'Deltoides Anterior', 'Ancóneo']
      : ['Tríceps Braquial (Cabeza Larga)', 'Ancóneo'];
    stabilizerMuscles = ['Manguito Rotador', 'Dorsal Ancho (Estabilizador Humeral)', 'Core'];
    movementPattern = isCompoundTriceps ? 'Empuje Horizontal' : 'Aislamiento';
    mechanicType = isCompoundTriceps ? 'Compuesto' : 'Aislamiento';
    resistanceProfile = isOverheadOrLengthened
      ? 'Pico en Estiramiento (Lengthened)'
      : 'Pico en Contracción (Shortened)';
    sfrScore = 9;
    cnsFatigueIndex = isCompoundTriceps ? 5 : 3;
    localFatigueIndex = 8;
    jointStress = {
      level: /\b(?:franc[eé]s|rompecr[aá]neos|jm\s*press)\b/i.test(clean) ? 'Moderado' : 'Bajo',
      joints: ['Codo (Tendón del Tríceps)'],
    };
    recoveryHours = isCompoundTriceps ? 36 : 24;
    optimalRepRange = isCompoundTriceps ? '6–10 reps' : '10–15 reps';
    fatigueCoefficient = isCompoundTriceps ? 1.05 : 0.8;
  } else if (/\b(?:extensi[oó]n(?:es)?\s*de\s*cu[aá]driceps|sill[oó]n\s*de\s*cu[aá]driceps|sissy)\b/i.test(clean)) {
    // Quad Isolation
    primaryMuscles = ['Cuádriceps (Recto Femoral, Vasto Lateral, Medial e Intermedio)'];
    secondaryMuscles = ['Tensor de la Fascia Lata'];
    stabilizerMuscles = ['Core Abdominal', 'Isquiosurales (Co-contracción Articular)'];
    movementPattern = 'Dominante de Rodilla';
    mechanicType = 'Aislamiento';
    resistanceProfile = /\bsissy\b/i.test(clean)
      ? 'Pico en Estiramiento (Lengthened)'
      : 'Pico en Contracción (Shortened)';
    sfrScore = 9;
    cnsFatigueIndex = 3;
    localFatigueIndex = 9;
    jointStress = { level: 'Moderado', joints: ['Rodilla (Patelofemoral)'] };
    recoveryHours = 36;
    optimalRepRange = '10–15 reps';
    fatigueCoefficient = 0.9;
  } else if (/\b(?:sentadilla|squat|prensa|hack|hacka|p[eé]ndulo|b[uú]lgara|zancadas?|estocadas?|lunge|pistol)\b/i.test(clean)) {
    // Knee Dominant Compound
    const isMachineLeg = /\b(?:prensa|hack|hacka|p[eé]ndulo|smith|multipower)\b/i.test(clean);
    const isUnilateral = /\b(?:b[uú]lgara|zancadas?|estocadas?|lunge|pistol)\b/i.test(clean);
    primaryMuscles = isUnilateral
      ? ['Cuádriceps (Vasto Lateral y Medial)', 'Glúteo Mayor (En Estiramiento)']
      : ['Cuádriceps (Vasto Lateral, Medial e Intermedio)', 'Glúteo Mayor'];
    secondaryMuscles = ['Aductor Mayor', 'Erectores Espinales', 'Isquiosurales (Estabilización Dinámica)'];
    stabilizerMuscles = isUnilateral
      ? ['Glúteo Medio y Menor (Estabilidad Pélvica)', 'Core Antirrotacional', ' Estabilizadores de Tobillo']
      : ['Transverso Abdominal y Oblicuos (Presión Intraabdominal)', 'Erectores Torácicos', 'Gastrocnemio / Sóleo'];
    movementPattern = 'Dominante de Rodilla';
    mechanicType = 'Compuesto';
    resistanceProfile = 'Pico en Estiramiento (Lengthened)';
    sfrScore = isMachineLeg ? 9 : 8;
    cnsFatigueIndex = isMachineLeg ? 7 : 9;
    localFatigueIndex = 9;
    jointStress = {
      level: equipmentType === 'Barra' ? 'Alto' : 'Moderado',
      joints: ['Rodilla', 'Cadera', 'Columna Lumbar'],
    };
    recoveryHours = isMachineLeg ? 48 : 72;
    optimalRepRange = mode === 'strength' ? '3–6 reps' : '6–12 reps';
    fatigueCoefficient = isMachineLeg ? 1.45 : 1.75;
  } else if (/\b(?:curl\s*femoral|camilla|leg\s*curl|n[oó]rdic[oa]?)\b/i.test(clean)) {
    // Hamstring Knee Flexion
    const isSeatedOrNordic = /\b(?:sentado|n[oó]rdic[oa]?)\b/i.test(clean);
    primaryMuscles = ['Isquiosurales (Bíceps Femoral, Semitendinoso y Semimembranoso)'];
    secondaryMuscles = ['Gastrocnemio (Gemelos)', 'Grácil y Sartorio'];
    stabilizerMuscles = ['Core Abdominal y Glúteos (Control Pélvico)', 'Tibial Anterior'];
    movementPattern = 'Dominante de Cadera';
    mechanicType = 'Aislamiento';
    resistanceProfile = isSeatedOrNordic
      ? 'Pico en Estiramiento (Lengthened)'
      : 'Pico en Contracción (Shortened)';
    sfrScore = 9;
    cnsFatigueIndex = /\bn[oó]rdic/i.test(clean) ? 6 : 3;
    localFatigueIndex = 8;
    jointStress = { level: 'Bajo', joints: ['Rodilla'] };
    recoveryHours = 36;
    optimalRepRange = '8–15 reps';
    fatigueCoefficient = 0.9;
  } else if (/\b(?:peso\s*muerto|rumano|rdl|deadlift|stiff|piernas\s*r[ií]gidas|buenos\s*d[ií]as|good\s*morning)\b/i.test(clean)) {
    // Hip Hinge Compound
    const isRdl = /\b(?:rumano|rdl|stiff|r[ií]gidas|buenos\s*d[ií]as|good\s*morning)\b/i.test(clean);
    primaryMuscles = isRdl
      ? ['Isquiosurales (Semitendinoso, Semimembranoso y Bíceps Femoral)', 'Glúteo Mayor']
      : ['Glúteo Mayor', 'Isquiosurales', 'Erectores Espinales'];
    secondaryMuscles = ['Aductor Mayor', 'Dorsal Ancho y Trapecio Medio', 'Cuádriceps (En Despegue)'];
    stabilizerMuscles = ['Flexores del Antebrazo (Agarre)', 'Transverso Abdominal y Oblicuos', 'Multífidos Lumbares'];
    movementPattern = 'Dominante de Cadera';
    mechanicType = 'Compuesto';
    resistanceProfile = 'Pico en Estiramiento (Lengthened)';
    sfrScore = isRdl ? 8 : 6;
    cnsFatigueIndex = isRdl ? 8 : 10;
    localFatigueIndex = 9;
    jointStress = {
      level: 'Alto',
      joints: ['Columna Lumbosacra', 'Cadera'],
    };
    recoveryHours = 72;
    optimalRepRange = mode === 'strength' ? '2–5 reps' : '6–10 reps';
    fatigueCoefficient = isRdl ? 1.65 : 2.0;
  } else if (/\b(?:hip\s*thrust|puente\s*de\s*gl[uú]teo|glute\s*bridge|patada\s*de\s*gl[uú]teo|abducci[oó]n|abductor|kas)\b/i.test(clean)) {
    // Glutes
    const isIsolationGlute = /\b(?:patada|abducci[oó]n|abductor)\b/i.test(clean);
    primaryMuscles = isIsolationGlute
      ? ['Glúteo Medio y Menor', 'Glúteo Mayor (Fibras Superiores)']
      : ['Glúteo Mayor (Máximo Reclutamiento en Acortamiento)'];
    secondaryMuscles = isIsolationGlute
      ? ['Tensor de la Fascia Lata']
      : ['Isquiosurales', 'Aductor Mayor', 'Cuádriceps'];
    stabilizerMuscles = ['Recto Abdominal y Oblicuos (Retroversión Pélvica)', 'Erectores Espinales'];
    movementPattern = 'Dominante de Cadera';
    mechanicType = isIsolationGlute ? 'Aislamiento' : 'Compuesto';
    resistanceProfile = 'Pico en Contracción (Shortened)';
    sfrScore = 9;
    cnsFatigueIndex = isIsolationGlute ? 2 : 5;
    localFatigueIndex = 8;
    jointStress = { level: 'Bajo', joints: ['Cadera'] };
    recoveryHours = isIsolationGlute ? 24 : 36;
    optimalRepRange = isIsolationGlute ? '12–20 reps' : '8–12 reps';
    fatigueCoefficient = isIsolationGlute ? 0.75 : 1.15;
  } else if (/\b(?:gemelos?|pantorrillas?|talones|s[oó]leo|calf)\b/i.test(clean)) {
    // Calves
    const isSeated = /\b(?:sentado|s[oó]leo)\b/i.test(clean);
    primaryMuscles = isSeated
      ? ['Sóleo (Flexión Plantar con Rodilla Flexionada)']
      : ['Gastrocnemio (Gemelo Medial y Lateral)'];
    secondaryMuscles = isSeated ? ['Gastrocnemio'] : ['Sóleo'];
    stabilizerMuscles = ['Tibial Posterior', 'Peroneo Largo y Corto'];
    movementPattern = 'Aislamiento';
    mechanicType = 'Aislamiento';
    resistanceProfile = 'Pico en Estiramiento (Lengthened)';
    sfrScore = 9;
    cnsFatigueIndex = 2;
    localFatigueIndex = 7;
    jointStress = { level: 'Bajo', joints: ['Tobillo (Tendón de Aquiles)'] };
    recoveryHours = 24;
    optimalRepRange = '10–20 reps';
    fatigueCoefficient = 0.65;
  } else if (/\b(?:front\s*lever|back\s*lever|planche|handstand|pino|human\s*flag|dragon\s*flag|l-sit)\b/i.test(clean)) {
    // Calisthenics Statics
    primaryMuscles = ['Core Abdominal Profundo (Recto y Transverso)', 'Dorsal Ancho / Deltoides Anterior'];
    secondaryMuscles = ['Serrato Anterior', 'Tríceps Braquial (Bloqueo Articular)', 'Glúteo Mayor y Psoas Ilíaco'];
    stabilizerMuscles = ['Manguito Rotador', 'Flexores y Extensores de Muñeca', 'Romboides'];
    movementPattern = 'Core';
    mechanicType = 'Isométrico';
    resistanceProfile = 'Constante / Lineal';
    sfrScore = 8;
    cnsFatigueIndex = 8;
    localFatigueIndex = 8;
    jointStress = { level: 'Alto', joints: ['Muñeca', 'Codo (Bíceps Distal)', 'Hombro'] };
    recoveryHours = 48;
    optimalRepRange = '8–20 seg isométricos';
    fatigueCoefficient = 1.4;
  } else if (/\b(?:crunch|abdomen|abdominal(?:es)?|plancha|plank|rueda|ab\s*wheel|elevaci[oó]n\s*de\s*piernas|pallof)\b/i.test(clean)) {
    // Core & Abs
    primaryMuscles = ['Recto Abdominal', 'Oblicuos Externos e Internos'];
    secondaryMuscles = ['Transverso del Abdomen', 'Psoas Ilíaco / Flexores de Cadera'];
    stabilizerMuscles = ['Serrato Anterior', 'Glúteo Mayor', 'Multífidos'];
    movementPattern = 'Core';
    mechanicType = /\b(?:plancha|plank|pallof)\b/i.test(clean) ? 'Isométrico' : 'Aislamiento';
    resistanceProfile = 'Rango Medio (Mid-Range)';
    sfrScore = 9;
    cnsFatigueIndex = 2;
    localFatigueIndex = 7;
    jointStress = { level: 'Bajo', joints: ['Columna Lumbar'] };
    recoveryHours = 24;
    optimalRepRange = '12–20 reps / 45s';
    fatigueCoefficient = 0.65;
  } else if (/\b(?:aducci[oó]n|aductor(?:es)?)\b/i.test(clean)) {
    // Hip Adductors
    primaryMuscles = ['Aductor Mayor, Largo y Corto (Glúteos y Cadera)'];
    secondaryMuscles = ['Grácil y Pectíneo', 'Glúteo Mayor (Fibras Inferiores)'];
    stabilizerMuscles = ['Core y Suelo Pélvico'];
    movementPattern = 'Dominante de Cadera';
    mechanicType = 'Aislamiento';
    resistanceProfile = 'Pico en Estiramiento (Lengthened)';
    sfrScore = 9;
    cnsFatigueIndex = 2;
    localFatigueIndex = 7;
    jointStress = { level: 'Bajo', joints: ['Cadera ( Pubis / Inguinal)'] };
    recoveryHours = 24;
    optimalRepRange = '12–20 reps';
    fatigueCoefficient = 0.7;
  } else if (/\b(?:antebrazo[s]?|mu[ñn]eca[s]?|wrist|farmer|granjero|paseo)\b/i.test(clean) && mode !== 'hyrox') {
    // Forearms / Grip / Carries
    primaryMuscles = ['Bíceps y Antebrazo (Flexores y Extensores del Carpo / Braquiorradial)'];
    secondaryMuscles = ['Trapecio Superior y Medio', 'Core Antilateral'];
    stabilizerMuscles = ['Manguito Rotador', 'Glúteo Medio'];
    movementPattern = 'Aislamiento';
    mechanicType = 'Aislamiento';
    resistanceProfile = 'Constante / Lineal';
    sfrScore = 9;
    cnsFatigueIndex = 3;
    localFatigueIndex = 7;
    jointStress = { level: 'Bajo', joints: ['Muñeca', 'Codo'] };
    recoveryHours = 24;
    optimalRepRange = '12–20 reps / 45s';
    fatigueCoefficient = 0.7;
  } else if (/\b(?:clean|snatch|jerk|cargada|arrancada|envi[oó]n|thruster|swing|kettlebell\s*swing|salto\s*al\s*caj[oó]n|box\s*jump)\b/i.test(clean)) {
    // Olympic / Explosive Power / Kettlebell Ballistic
    primaryMuscles = ['Glúteos y Cadera (Triple Extensión)', 'Cuádriceps', 'Trapecio y Deltoides'];
    secondaryMuscles = ['Isquiosurales', 'Core y Erectores Espinales', 'Pantorrillas (Gemelos / Sóleo)'];
    stabilizerMuscles = ['Manguito Rotador', 'Flexores del Antebrazo', 'Transverso Abdominal'];
    movementPattern = 'Híbrido / Funcional';
    mechanicType = 'Compuesto Multiarticular';
    resistanceProfile = 'Pico en Estiramiento (Lengthened)';
    sfrScore = 7;
    cnsFatigueIndex = 9;
    localFatigueIndex = 8;
    jointStress = { level: 'Moderado', joints: ['Cadera', 'Rodilla', 'Hombro', 'Columna Lumbar'] };
    recoveryHours = 48;
    optimalRepRange = '3–8 reps explosivas';
    fatigueCoefficient = 1.5;
  } else if (
    mode === 'hyrox' ||
    mode === 'cardio' ||
    /\b(?:skierg|sled|trineo|burpees?|wall\s*balls?|farmers|granjero|sandbag|cuerda|comba|running|correr|sprint|nataci[oó]n|ciclismo|bici|stairmaster|el[ií]ptica)\b/i.test(clean)
  ) {
    // Hyrox & Cardio with station-specific and discipline-specific muscle mapping
    const isSkiOrRow = /\b(?:skierg|row|remo)\b/i.test(clean);
    const isSledPushOrWallBall = /\b(?:sled\s*push|empuje\s*trineo|wall\s*balls?|sandbag|lunge)\b/i.test(clean);
    const isSledPullOrFarmers = /\b(?:sled\s*pull|arrastre|farmers|granjero)\b/i.test(clean);
    const isSwimming = /\b(?:nataci[oó]n|nado|crol|mariposa|braza)\b/i.test(clean);
    const isJumpRope = /\b(?:cuerda|comba|jump\s*rope|saltos?\s*dobles?)\b/i.test(clean);
    const isHyroxStation =
      mode === 'hyrox' || /\b(?:skierg|sled|trineo|burpees?|wall\s*balls?|farmers|granjero|sandbag)\b/i.test(clean);

    if (isSkiOrRow) {
      primaryMuscles = ['Dorsal / Espalda', 'Sistema Cardiorrespiratorio (Umbral de Lactato)'];
      secondaryMuscles = ['Tríceps Braquial', 'Core y Erectores Espinales', 'Cuádriceps'];
    } else if (isSledPushOrWallBall) {
      primaryMuscles = ['Cuádriceps', 'Glúteos y Cadera', 'Sistema Cardiorrespiratorio'];
      secondaryMuscles = ['Deltoides (Anterior / Lateral)', 'Pantorrillas (Gemelos / Sóleo)', 'Core y Erectores Espinales'];
    } else if (isSledPullOrFarmers) {
      primaryMuscles = ['Trapecio / Romboides', 'Dorsal / Espalda', 'Glúteos y Cadera'];
      secondaryMuscles = ['Bíceps y Antebrazo', 'Isquiosurales', 'Core y Erectores Espinales'];
    } else if (isSwimming) {
      primaryMuscles = ['Dorsal / Espalda', 'Deltoides (Anterior / Lateral)', 'Sistema Cardiorrespiratorio'];
      secondaryMuscles = ['Tríceps Braquial', 'Core y Erectores Espinales', 'Cuádriceps'];
    } else if (isJumpRope) {
      primaryMuscles = ['Pantorrillas (Gemelos / Sóleo)', 'Sistema Cardiorrespiratorio'];
      secondaryMuscles = ['Deltoides (Anterior / Lateral)', 'Bíceps y Antebrazo', 'Core y Erectores Espinales'];
    } else {
      primaryMuscles = isHyroxStation
        ? ['Cuádriceps', 'Glúteos y Cadera', 'Sistema Cardiorrespiratorio (Umbral de Lactato)']
        : ['Sistema Cardiorrespiratorio (Oxidativo / VO2 Máx)', 'Cuádriceps', 'Pantorrillas (Gemelos / Sóleo)'];
      secondaryMuscles = isHyroxStation
        ? ['Dorsal / Espalda', 'Deltoides (Anterior / Lateral)', 'Core y Erectores Espinales']
        : ['Isquiosurales', 'Glúteos y Cadera', 'Core y Erectores Espinales'];
    }

    stabilizerMuscles = ['Complejo Articular de Tobillo, Rodilla y Cadera', 'Core Antirrotacional'];
    movementPattern = isHyroxStation ? 'Híbrido / Funcional' : 'Cardio';
    mechanicType = 'Metabólico / Cíclico';
    resistanceProfile = 'Constante / Lineal';
    sfrScore = 8;
    cnsFatigueIndex = isHyroxStation ? 7 : 5;
    localFatigueIndex = isHyroxStation ? 8 : 6;
    jointStress = {
      level: /\b(?:running|correr|sprint|burpees?|sled)\b/i.test(clean) ? 'Moderado' : 'Bajo',
      joints: ['Tobillo', 'Rodilla', 'Cadera'],
    };
    recoveryHours = isHyroxStation ? 48 : 24;
    optimalRepRange = isHyroxStation ? 'bloques de distancia / tiempo' : 'ritmo continuo o intervalos';
    fatigueCoefficient = isHyroxStation ? 1.3 : 0.9;
  } else {
    // Universal fallback for any novel custom exercise not caught above:
    // Infer anatomical group from keywords or training mode so it NEVER uses generic placeholders
    if (/\b(?:pecho|pectoral|empuje|push)\b/i.test(clean)) {
      primaryMuscles = ['Pectoral Mayor'];
      secondaryMuscles = ['Deltoides Anterior', 'Tríceps Braquial'];
      movementPattern = 'Empuje Horizontal';
      jointStress = { level: 'Moderado', joints: ['Hombro', 'Codo'] };
    } else if (/\b(?:espalda|dorsal|tiron|traccion|pull)\b/i.test(clean)) {
      primaryMuscles = ['Dorsal / Espalda', 'Trapecio / Romboides'];
      secondaryMuscles = ['Bíceps y Antebrazo', 'Deltoides Posterior'];
      movementPattern = 'Tracción Horizontal';
      jointStress = { level: 'Bajo', joints: ['Hombro', 'Codo'] };
    } else if (/\b(?:hombro|deltoides)\b/i.test(clean)) {
      primaryMuscles = ['Deltoides (Anterior / Lateral)'];
      secondaryMuscles = ['Deltoides Posterior', 'Trapecio / Romboides'];
      movementPattern = 'Empuje Vertical';
      jointStress = { level: 'Bajo', joints: ['Hombro'] };
    } else if (/\b(?:brazo)\b/i.test(clean)) {
      primaryMuscles = ['Bíceps y Antebrazo', 'Tríceps Braquial'];
      secondaryMuscles = ['Deltoides (Anterior / Lateral)'];
      movementPattern = 'Aislamiento';
      jointStress = { level: 'Bajo', joints: ['Codo', 'Muñeca'] };
    } else if (/\b(?:pierna|tren\s*inferior|lower)\b/i.test(clean)) {
      primaryMuscles = ['Cuádriceps', 'Glúteos y Cadera'];
      secondaryMuscles = ['Isquiosurales', 'Pantorrillas (Gemelos / Sóleo)'];
      movementPattern = 'Dominante de Rodilla';
      jointStress = { level: 'Moderado', joints: ['Rodilla', 'Cadera'] };
    } else if (mode === 'calisthenics') {
      primaryMuscles = ['Dorsal / Espalda', 'Core y Erectores Espinales'];
      secondaryMuscles = ['Deltoides (Anterior / Lateral)', 'Tríceps Braquial', 'Bíceps y Antebrazo'];
      movementPattern = 'Isométrico de Palanca';
      jointStress = { level: 'Moderado', joints: ['Hombro', 'Codo', 'Muñeca'] };
    } else {
      primaryMuscles = ['Pectoral', 'Dorsal / Espalda', 'Cuádriceps'];
      secondaryMuscles = ['Deltoides (Anterior / Lateral)', 'Core y Erectores Espinales'];
      movementPattern = 'Híbrido / Funcional';
      jointStress = { level: 'Moderado', joints: ['Hombro', 'Cadera', 'Rodilla'] };
    }
  }

  const baseSynthesized: ExerciseDeepProfile = {
    primaryMuscles,
    secondaryMuscles,
    stabilizerMuscles,
    movementPattern,
    mechanicType,
    resistanceProfile,
    equipmentType,
    sfrScore,
    cnsFatigueIndex,
    localFatigueIndex,
    jointStress,
    recoveryHours,
    optimalRepRange,
    biomechanicalCue,
    fatigueCoefficient,
    isAiResearched: false,
  };

  return applyGripAndVariantModifiers(baseSynthesized, rawName, mode, effectiveGrip);
}

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
  const rawCleanName = line
    .replace(/\(\s*\)/g, ' ')
    .replace(/^[\s:\-–—•*.,/]+|[\s:\-–—•*.,/]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const cleanName = sanitizeExerciseName(rawCleanName);

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
  const outOfContextAnalysis = detectOutOfContextExerciseWords(rawInput);

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
    const deepProfile =
      item.deepProfile || synthesizeExerciseDeepProfile(finalCanonicalName, item.mode, item.id);

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
      biomechanicalCue: item.biomechanicalCue || deepProfile.biomechanicalCue,
      movementPattern: deepProfile.movementPattern,
      deepProfile,
      outOfContextAnalysis,
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
        const finalName = hasConflictingEquipment(clean, item.name)
          ? formattedUserClean
          : item.name;
        const deepProfile =
          item.deepProfile || synthesizeExerciseDeepProfile(finalName, item.mode, item.id);

        return {
          rawInput,
          cleanName: clean,
          canonicalCatalogId: item.id,
          // Preserve user's equipment specification in canonical name if it differs
          canonicalName: finalName,
          isCanonicalMatch: true,
          confidence: Math.min(95, hits[0].score),
          muscleGroup: item.muscleGroup,
          mode: item.mode,
          defaultRestSeconds: item.defaultRestSeconds,
          matchedAlias: hits[0].matchedAlias || strippedCore,
          biomechanicalCue: item.biomechanicalCue || deepProfile.biomechanicalCue,
          movementPattern: deepProfile.movementPattern,
          deepProfile,
          outOfContextAnalysis,
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
    const finalName = hasConflictingEquipment(clean, item.name)
      ? formattedUserClean
      : item.name;
    const deepProfile =
      item.deepProfile || synthesizeExerciseDeepProfile(finalName, item.mode, item.id);

    return {
      rawInput,
      cleanName: clean,
      canonicalCatalogId: item.id,
      canonicalName: finalName,
      isCanonicalMatch: false,
      confidence: bestMatch.score,
      muscleGroup: item.muscleGroup,
      mode: item.mode,
      defaultRestSeconds: item.defaultRestSeconds,
      matchedAlias: bestMatch.matchedAlias,
      biomechanicalCue: item.biomechanicalCue || deepProfile.biomechanicalCue,
      movementPattern: deepProfile.movementPattern,
      deepProfile,
      outOfContextAnalysis,
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
  const deepProfile = synthesizeExerciseDeepProfile(displayName || clean, inferredMode, customId);

  return {
    rawInput,
    cleanName: displayName || clean,
    canonicalCatalogId: customId,
    canonicalName: displayName || clean,
    isCanonicalMatch: false,
    confidence: 50,
    muscleGroup:
      inferredMuscle !== 'Músculo Principal'
        ? inferredMuscle
        : deepProfile.primaryMuscles[0]?.split('(')[0]?.trim() || inferredMuscle,
    mode: inferredMode,
    defaultRestSeconds: inferredMode === 'strength' ? 150 : inferredMode === 'cardio' ? 45 : 90,
    biomechanicalCue: deepProfile.biomechanicalCue,
    movementPattern: inferredPattern || deepProfile.movementPattern,
    deepProfile,
    outOfContextAnalysis,
    targetWeightKg: tokens.targetWeightKg,
    extractedSets: tokens.sets,
    extractedReps: tokens.repsNum,
    extractedRepRangeLabel: tokens.repRangeLabel,
    extractedRir: tokens.rir,
    leakedNextSection: tokens.leakedNextSection,
  };
}

export function formatCapitalizedExercise(str: string): string {
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

/**
 * Strips noisy parenthetical suffixes (e.g. "(Gironda)", "(Énfasis Pectoral)"),
 * slash synonyms (e.g. "/ Cristos", "/ Cerrado"), and harmonizes with the catalog.
 */
export function sanitizeExerciseName(rawName: string): string {
  if (!rawName) return '';
  let str = rawName
    // 1. Remove parenthetical descriptions, notes, and synonyms
    .replace(
      /\s*\((?:gironda|énfasis\s+[^)]+|cristos?|rompecr[aá]neos?|rompecabezas?[^)]*|copa|serrucho|rdl|gemelos?|s[oó]leo[^)]*|chin-?ups?|dips?|rto|flexiones\s+en\s+pino|sentadilla\s+a\s+1\s+pierna|isom[eé]trico|pino[^)]*|human\s*flag|carrera[^)]*|empuje\s+de\s+trineo|arrastre\s+de\s+trineo|remo\s+concept2|paseo\s+del\s+granjero|zancadas\s+con\s+saco|100\s*lanzamientos|dobles|velocidad[^)]*|boxer[^)]*|tabata[^)]*|pausa[^)]*|sentado|smith|30°|barra\s+o\s+cuerda|mancuernas?\s+o\s+cuerda|recta\s+o\s+ez|inclinado\s*\/\s*pendlay|t-bar\s*\/\s*m[aá]quina|low\s*bar\s*squat|high\s*bar\s*squat|ohp\s*fuerza|1-5rm|bloqueo\s*pesado|vo2\s*max|ritmo\s*de\s*umbral|cuerda|dobles\s*\/\s*double\s*unders)\)/gi,
      ''
    )
    // 2. Remove trailing / or standalone slash synonyms
    .replace(
      /\s*\/\s*(?:cristos?|deltoide\s+posterior|extensi[oó]n\s+katana|fondos\s+en\s+m[aá]quina|cerrado|pendlay|m[aá]quina|cuerda|smith|estocadas|empuje\s+de\s+cadera|costurera|v-sit|parada\s+de\s+manos|human\s+flag|braza|ciclismo\s+zona\s*2|assault\s+bike|stairmaster|dobles)\b/gi,
      ''
    )
    // 3. Remove standalone parentheticals that are empty
    .replace(/\(\s*\)/g, ' ')
    // 4. Clean extra spaces & punctuation
    .replace(/\s{2,}/g, ' ')
    .trim();

  // If matches a canonical catalog exercise cleanly, return official catalog name
  const cleanNorm = normalizeSearchText(str);
  const canonical = BUILTIN_EXERCISES.find(
    (b) =>
      normalizeSearchText(b.name) === cleanNorm ||
      b.aliases?.some((a) => normalizeSearchText(a) === cleanNorm)
  );
  if (canonical) {
    return canonical.name;
  }

  return formatCapitalizedExercise(str);
}

export interface RoutineExerciseCleanupResult {
  cleanedDays: RoutineDayPlan[];
  changes: {
    dayLabel: string;
    originalName: string;
    cleanedName: string;
    weightExtracted?: number;
    setsExtracted?: number;
    repsExtracted?: number;
  }[];
}

/**
 * Batch cleaner for all exercises in a routine.
 * Strips noise, embedded loads ("45kg", "120 kg"), sets notes (": 2. Espalda"),
 * parenthetical/slash noise, and sets/reps artifacts from exercise names.
 */
export function cleanAllRoutineExercises(days: RoutineDayPlan[]): RoutineExerciseCleanupResult {
  const changes: RoutineExerciseCleanupResult['changes'] = [];

  const cleanedDays = days.map((day) => ({
    ...day,
    exercises: day.exercises.map((ex) => {
      const tokens = extractStructuredExerciseTokens(ex.name);
      let cleanName = sanitizeExerciseName(tokens.cleanName || ex.name);
      let catalogId = ex.catalogId;

      if (catalogId) {
        const cat = BUILTIN_EXERCISES.find((b) => b.id === catalogId);
        if (cat) {
          cleanName = cat.name;
        }
      } else {
        const resolved = resolveExerciseIntelligently(cleanName, ex.mode);
        if (resolved.isCanonicalMatch) {
          cleanName = resolved.canonicalName;
          catalogId = resolved.canonicalCatalogId;
        }
      }

      const isNameDifferent = cleanName !== ex.name;
      const hasExtractedWeight =
        tokens.targetWeightKg !== undefined && (!ex.targetWeightKg || ex.targetWeightKg <= 0);
      const hasExtractedSets =
        tokens.sets !== undefined && (!ex.sets || ex.sets <= 1);
      const hasExtractedReps =
        tokens.repsNum !== undefined && (!ex.repsNum || ex.repsNum <= 1);

      if (isNameDifferent || hasExtractedWeight || hasExtractedSets || hasExtractedReps) {
        changes.push({
          dayLabel: day.label,
          originalName: ex.name,
          cleanedName: cleanName,
          weightExtracted: hasExtractedWeight ? tokens.targetWeightKg : undefined,
          setsExtracted: hasExtractedSets ? tokens.sets : undefined,
          repsExtracted: hasExtractedReps ? tokens.repsNum : undefined,
        });

        return {
          ...ex,
          name: cleanName,
          catalogId: catalogId || ex.catalogId,
          targetWeightKg: hasExtractedWeight ? tokens.targetWeightKg : ex.targetWeightKg,
          sets: hasExtractedSets ? tokens.sets! : ex.sets,
          repsNum: hasExtractedReps ? tokens.repsNum! : ex.repsNum,
          repRangeLabel: tokens.repRangeLabel || ex.repRangeLabel,
        };
      }

      return ex;
    }),
  }));

  return { cleanedDays, changes };
}

/**
 * Cleans historical workout sessions by sanitizing exercise names across all blocks,
 * stripping noise words, and binding canonical catalog IDs so the AI recognizes them
 * for progressive overload tracking and analytics.
 */
export function cleanWorkoutSessionExercises(session: any): { session: any; modified: boolean } {
  let modified = false;
  const blocks = (session.blocks || []).map((block: any) => ({
    ...block,
    exercises: (block.exercises || []).map((ex: any) => {
      let cleanName = sanitizeExerciseName(ex.name);
      let catalogId = ex.catalogId;

      if (catalogId) {
        const cat = BUILTIN_EXERCISES.find((b) => b.id === catalogId);
        if (cat) {
          cleanName = cat.name;
        }
      } else {
        const resolved = resolveExerciseIntelligently(cleanName, ex.mode);
        if (resolved.isCanonicalMatch) {
          cleanName = resolved.canonicalName;
          catalogId = resolved.canonicalCatalogId;
        }
      }

      if (cleanName !== ex.name || (catalogId && catalogId !== ex.catalogId)) {
        modified = true;
        return {
          ...ex,
          name: cleanName,
          catalogId: catalogId || ex.catalogId,
        };
      }
      return ex;
    }),
  }));

  return {
    session: { ...session, blocks },
    modified,
  };
}

/**
 * Cleans active workout draft blocks so live training has crystal-clear exercise names.
 */
export function cleanActiveWorkoutExercises(activeWorkout: any): { activeWorkout: any; modified: boolean } {
  let modified = false;
  const blocks = (activeWorkout.blocks || []).map((block: any) => ({
    ...block,
    exercises: (block.exercises || []).map((ex: any) => {
      let cleanName = sanitizeExerciseName(ex.name);
      let catalogId = ex.catalogId;

      if (catalogId) {
        const cat = BUILTIN_EXERCISES.find((b) => b.id === catalogId);
        if (cat) {
          cleanName = cat.name;
        }
      } else {
        const resolved = resolveExerciseIntelligently(cleanName, ex.mode);
        if (resolved.isCanonicalMatch) {
          cleanName = resolved.canonicalName;
          catalogId = resolved.canonicalCatalogId;
        }
      }

      if (cleanName !== ex.name || (catalogId && catalogId !== ex.catalogId)) {
        modified = true;
        return {
          ...ex,
          name: cleanName,
          catalogId: catalogId || ex.catalogId,
        };
      }
      return ex;
    }),
  }));

  return {
    activeWorkout: { ...activeWorkout, blocks },
    modified,
  };
}
