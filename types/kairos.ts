export type TrainingMode =
  | 'hypertrophy'
  | 'strength'
  | 'calisthenics'
  | 'hyrox'
  | 'cardio';

export type CardioDiscipline = 'jumprope' | 'running' | 'swimming' | 'cycling';

export type CalisthenicsSubType = 'dynamic' | 'isometric';

export type CalisthenicsProgression =
  | 'Tuck'
  | 'Advanced Tuck'
  | 'One Leg'
  | 'Straddle'
  | 'Half Lay'
  | 'Full';

export type HypertrophySetType =
  | 'Calentamiento'
  | 'Efectiva'
  | 'Drop Set'
  | 'Rest-Pause'
  | 'Myo-Reps';

export type RirValue = '0' | '1' | '2' | '3' | '4+';

export type JumpRopeStyle =
  | 'Básico'
  | 'Boxer Step'
  | 'Dobles / Double Unders'
  | 'Cruzados'
  | 'High Knees';

export type RunningType =
  | 'Zona 2 Continua'
  | 'Series de Velocidad / Fartlek'
  | 'Tempo Run';

export type SwimmingStroke =
  | 'Crol/Libre'
  | 'Espalda'
  | 'Pecho/Braza'
  | 'Mariposa';

export type HyroxStationName =
  | '1000m Run'
  | 'SkiErg'
  | 'Sled Push'
  | 'Sled Pull'
  | 'Burpee Broad Jumps'
  | 'Rowing'
  | 'Farmers Carry'
  | 'Sandbag Lunges'
  | 'Wall Balls';

export type SoundProfile = 'minimal' | 'boxing' | 'tactical';

export type AppTab = 'workout' | 'timer' | 'science' | 'analytics' | 'history';

export interface AudioSettings {
  gainPercent: number;
  profile: SoundProfile;
  vibrationEnabled: boolean;
}

export interface HypertrophySet {
  id: string;
  weightKg: number;
  reps: number;
  rir: RirValue;
  setType: HypertrophySetType;
  restSeconds: number;
  completed: boolean;
}

export interface StrengthSet {
  id: string;
  weightKg: number;
  reps: number;
  rpe: number;
  restSeconds: number;
  completed: boolean;
}

export interface CalisthenicsDynamicSet {
  id: string;
  variation: string;
  addedWeightKg: number;
  assistanceNote?: string;
  reps: number;
  rir: RirValue;
  restSeconds: number;
  completed: boolean;
}

export interface CalisthenicsIsometricSet {
  id: string;
  progression: CalisthenicsProgression;
  targetSeconds: number;
  actualSeconds: number;
  addedWeightKg: number;
  restSeconds: number;
  completed: boolean;
}

export interface HyroxSet {
  id: string;
  station: HyroxStationName;
  distanceMeters: number;
  reps: number;
  implementWeightKg: number;
  splitSeconds: number;
  roxzoneSeconds: number;
  completed: boolean;
}

export interface JumpRopeSet {
  id: string;
  jumps: number;
  durationSeconds: number;
  style: JumpRopeStyle;
  misses: number;
  restSeconds: number;
  completed: boolean;
}

export interface RunningSet {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  inclinePercent: number;
  runType: RunningType;
  restSeconds: number;
  completed: boolean;
}

export interface SwimmingSet {
  id: string;
  poolLengthMeters: 25 | 50;
  laps: number;
  stroke: SwimmingStroke;
  durationSeconds: number;
  restSeconds: number;
  completed: boolean;
}

export interface CyclingSet {
  id: string;
  durationSeconds: number;
  distanceMeters: number;
  avgWatts: number;
  cadenceRpm: number;
  restSeconds: number;
  completed: boolean;
}

export type MovementPatternType =
  | 'Empuje Horizontal'
  | 'Empuje Vertical'
  | 'Tracción Horizontal'
  | 'Tracción Vertical'
  | 'Dominante de Rodilla'
  | 'Dominante de Cadera'
  | 'Aislamiento'
  | 'Core'
  | 'Cardio'
  | 'Híbrido / Funcional'
  | 'Isométrico de Palanca';

export interface ExerciseDeepProfile {
  /** Músculos principales / agonistas primarios con detalle anatómico */
  primaryMuscles: string[];
  /** Músculos sinergistas / secundarios necesarios para completar el movimiento */
  secondaryMuscles: string[];
  /** Músculos estabilizadores necesarios para fijación articular y postura */
  stabilizerMuscles: string[];
  /** Patrón biomecánico fundamental */
  movementPattern: MovementPatternType;
  /** Clasificación mecánica articular */
  mechanicType:
    | 'Compuesto'
    | 'Aislamiento'
    | 'Isométrico'
    | 'Compuesto Multiarticular'
    | 'Aislamiento Monoarticular'
    | 'Isométrico Estático'
    | 'Metabólico / Cíclico';
  /** Perfil de resistencia (zona de la curva donde ocurre el pico de tensión) */
  resistanceProfile:
    | 'Pico en Estiramiento (Lengthened)'
    | 'Pico en Contracción (Shortened)'
    | 'Rango Medio (Mid-Range)'
    | 'Estiramiento (Posición Elongada)'
    | 'Acortamiento (Contracción Pico)'
    | 'Rango Medio'
    | 'Constante / Lineal';
  /** Implemento o equipo biomecánico identificado */
  equipmentType: string;
  /** Ratio Estímulo-Fatiga (1 a 10, mayor = más estímulo hipertrófico por unidad de fatiga) */
  sfrScore: number;
  /** Índice de Fatiga Neural / SNC por serie efectiva (1 a 10) */
  cnsFatigueIndex: number;
  /** Índice de Fatiga Muscular Local y daño miofibrilar por serie efectiva (1 a 10) */
  localFatigueIndex: number;
  /** Estrés articular y articulaciones involucradas */
  jointStress: {
    level: 'Bajo' | 'Moderado' | 'Alto';
    joints: string[];
  };
  /** Horas estimadas de recuperación fisiológica post-sesión (24, 36, 48, 72) */
  recoveryHours: 24 | 36 | 48 | 72 | number;
  /** Rango óptimo de repeticiones o tiempo bajo tensión */
  optimalRepRange: string;
  /** Clave técnica y biomecánica de ejecución */
  biomechanicalCue: string;
  /** Coeficiente de fatiga acumulada por serie para cálculos analíticos (0.5 a 2.5) */
  fatigueCoefficient: number;
  /** Indica si fue enriquecido por el motor de investigación profunda de IA */
  isAiResearched?: boolean;
  /** Fecha ISO en que fue investigado/enriquecido por el motor de IA */
  researchedAt?: string;
  researchedAtIso?: string;
  /** Origen del perfil profundo */
  researchSource?: 'catalog_scientific' | 'ai_deep_research';
}

export interface OutOfContextWordAnalysis {
  hasSuspiciousWords: boolean;
  suspiciousWords: string[];
  suggestedCleanName: string;
  originalInput: string;
  explanation: string;
}

export interface WorkoutExercise {
  id: string;
  catalogId: string;
  name: string;
  mode: TrainingMode;
  muscleGroup: string;
  defaultRestSeconds: number;
  targetWeightKg?: number;
  notes?: string;
  calisthenicsSubType?: CalisthenicsSubType;
  cardioDiscipline?: CardioDiscipline;
  referenceOneRmKg?: number;
  deepProfile?: ExerciseDeepProfile;
  hypertrophySets?: HypertrophySet[];
  strengthSets?: StrengthSet[];
  calisthenicsDynamicSets?: CalisthenicsDynamicSet[];
  calisthenicsIsometricSets?: CalisthenicsIsometricSet[];
  hyroxSets?: HyroxSet[];
  jumpRopeSets?: JumpRopeSet[];
  runningSets?: RunningSet[];
  swimmingSets?: SwimmingSet[];
  cyclingSets?: CyclingSet[];
}

export interface WorkoutBlock {
  id: string;
  mode: TrainingMode;
  cardioDiscipline?: CardioDiscipline;
  title: string;
  exercises: WorkoutExercise[];
}

export type TimerKind = 'rest' | 'isometric' | 'intervals';

export type IntervalPhase = 'prep' | 'work' | 'rest' | 'finished';

export interface SessionTimerLog {
  id: string;
  kind: TimerKind;
  label: string;
  recordedAtIso: string;
  plannedSeconds: number;
  elapsedSeconds: number;
  workSecondsCompleted: number;
  roundsCompleted: number;
  totalRounds: number;
  endedReason: 'completed' | 'stopped_by_user';
}

export interface WorkoutSession {
  id: string;
  title: string;
  dateIso: string;
  startedAtMs: number;
  durationSeconds: number;
  notes?: string;
  blocks: WorkoutBlock[];
  timerLogs?: SessionTimerLog[];
}

export interface ExerciseCatalogItem {
  id: string;
  name: string;
  aliases?: string[];
  mode: TrainingMode;
  muscleGroup: string;
  defaultRestSeconds: number;
  calisthenicsSubType?: CalisthenicsSubType;
  cardioDiscipline?: CardioDiscipline;
  hyroxDefault?: {
    station: HyroxStationName;
    distanceMeters: number;
    reps: number;
    implementWeightKg: number;
  };
  biomechanicalCue?: string;
  isCustom?: boolean;
  deepProfile?: ExerciseDeepProfile;
}

export interface ActiveTimerConfig {
  kind: TimerKind;
  label: string;
  totalDurationMs: number;
  prepSeconds: number;
  holdSeconds: number;
  linkedIsometricTarget?: {
    blockId: string;
    exerciseId: string;
    setId: string;
  };
  workSeconds: number;
  restSeconds: number;
  totalRounds: number;
}

export interface TimerConclusionEvent {
  kind: TimerKind;
  label: string;
  plannedSeconds: number;
  elapsedSeconds: number;
  workSecondsCompleted: number;
  roundsCompleted: number;
  totalRounds: number;
  endedReason: 'completed' | 'stopped_by_user';
  linkedIsometricTarget?: ActiveTimerConfig['linkedIsometricTarget'];
}

export type ProgressStatus = 'advance' | 'maintain' | 'regress' | 'baseline';

export interface ExerciseHistoryPoint {
  sessionId: string;
  dateIso: string;
  dateLabel: string;
  primaryMetric: number;
  secondaryMetric: number;
  primaryUnit: string;
  secondaryUnit: string;
  summaryText: string;
  isLowerBetter?: boolean;
}

export interface ExerciseEvaluation {
  catalogId: string;
  exerciseName: string;
  mode: TrainingMode;
  cardioDiscipline?: CardioDiscipline;
  calisthenicsSubType?: CalisthenicsSubType;
  status: ProgressStatus;
  deltaPercent: number;
  isNewPr: boolean;
  latestValueFormatted: string;
  baselineValueFormatted: string;
  badgeText: string;
  diagnosisTitle?: string;
  diagnosisBody?: string;
  recommendation?: string;
  deepProfile?: ExerciseDeepProfile;
  history: ExerciseHistoryPoint[];
}

export interface MuscleFatigueReport {
  muscleGroup: string;
  /** Series efectivas directas como músculo principal (últimos 7 días) */
  directSets7d: number;
  /** Series efectivas indirectas como músculo sinergista necesario (0.5x por serie, últimos 7 días) */
  synergistSets7d: number;
  /** Volumen total ponderado (directas + 0.5 * sinergistas) */
  effectiveSets7d: number;
  /** Índice de fatiga acumulada actual (0 a 100%) considerando decaimiento por horas de recuperación */
  accumulatedFatiguePct: number;
  /** Contribución de carga al SNC */
  cnsLoadContribution: number;
  /** Estado fisiológico actual del grupo muscular */
  status:
    | 'Recuperado / Óptimo'
    | 'Carga Productiva'
    | 'Fatiga Alta'
    | 'Sobrecarga Crítica';
  /** Horas restantes estimadas para recuperación óptima */
  estimatedRecoveryHoursRemaining: number;
  /** Ejercicios principales que aportaron estímulo */
  contributingExercises: string[];
}

export interface SessionImpactReport {
  session: WorkoutSession;
  totalTonnageKg: number;
  totalEffectiveSets: number;
  totalJumps: number;
  totalCardioMeters: number;
  totalLoggedTimerSeconds: number;
  prCount: number;
  advances: ExerciseEvaluation[];
  maintenances: ExerciseEvaluation[];
  regressions: ExerciseEvaluation[];
}

// ============================================================================
// USER ACCOUNT, SOMATIC PROFILE & ADAPTIVE ROUTINE TYPES
// ============================================================================

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type PrimaryGoalType = 'hypertrophy' | 'recomp' | 'strength' | 'hybrid';
export type BiologicalSex = 'male' | 'female';

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  createdAtIso: string;
  onboardingCompleted: boolean;
}

export interface UserWorkoutDefaults {
  /** Segundos de descanso por serie por defecto (ej. 120s) */
  defaultRestSeconds: number;
  /** Repeticiones objetivo por serie por defecto (ej. 10) */
  defaultReps: number;
  /** Cantidad de series efectivas al agregar un ejercicio (ej. 3) */
  defaultEffectiveSets: number;
  /** Cantidad de series de calentamiento al agregar un ejercicio (ej. 1) */
  defaultWarmupSets: number;
  /** RIR objetivo por defecto ('0' | '1' | '2' | '3' | '4+') */
  defaultRir: RirValue;
  /** RPE objetivo por defecto en fuerza (ej. 8) */
  defaultRpe: number;
  /** Segundos objetivo por defecto en isométricos (ej. 15s) */
  defaultIsometricSeconds: number;
  /** Iniciar automáticamente el temporizador de descanso al marcar una serie */
  autoStartRestTimer: boolean;
}

export interface UserProfile {
  sex: BiologicalSex;
  /** Fecha de nacimiento YYYY-MM-DD. La edad se calcula dinámicamente a partir de ella. */
  birthDate?: string;
  /** Edad registrada al guardar el perfil (respaldo para perfiles antiguos sin birthDate). */
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent?: number;
  experienceLevel: ExperienceLevel;
  primaryGoal: PrimaryGoalType;
  /** Preferencias predeterminadas de entrenamiento (series, repeticiones, descanso, RIR, etc.) */
  workoutDefaults?: UserWorkoutDefaults;
  updatedAtIso: string;
}

export interface IntervalPreset {
  id: string;
  name: string;
  prepSeconds: number;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
}

export interface UserPreferences {
  /** Bloques de intervalos personalizados por el usuario (sobrescriben los predeterminados por id). */
  intervalPresets?: IntervalPreset[];
}

export type RoutineScheduleType = 'weekday' | 'cyclic';

export interface RoutineExercisePrescription {
  catalogId: string;
  name: string;
  mode: TrainingMode;
  muscleGroup?: string;
  biomechanicalNote?: string;
  sets: number;
  repsNum: number;
  repRangeLabel: string;
  rir: RirValue;
  restSeconds: number;
  targetWeightKg?: number;
  note?: string;
  leakedNextSection?: string;
  deepProfile?: ExerciseDeepProfile;
}

export interface RoutineDayPlan {
  id: string;
  label: string;          // e.g. "Lunes" or "Día 1"
  weekdayIndex?: number;  // 0 = Domingo, 1 = Lunes ... 6 = Sábado (for 'weekday' schedules)
  isRestDay: boolean;
  focusTitle: string;     // e.g. "Torso · Énfasis Hombro y Pecho"
  primaryMode: TrainingMode;
  estimatedMinutes: number;
  exercises: RoutineExercisePrescription[];
}

export interface RoutineRationalePillar {
  title: string;
  plainExplanation: string;
  scienceReference: string;
}

export interface RoutineRationale {
  headline: string;
  summary: string;
  userPromptSummary?: string;
  pillars: RoutineRationalePillar[];
}

export interface RoutineAdaptationOverride {
  forDateKey: string;      // YYYY-MM-DD where the adapted workout will appear
  dayPlanId: string;       // The missed day plan moved forward
  skippedOnDateKey: string;
  explanation: string;
}

export interface UserRoutine {
  id: string;
  name: string;
  scheduleType: RoutineScheduleType;
  source: 'manual' | 'ai_science';
  createdAtIso: string;
  cycleAnchorDateKey: string; // YYYY-MM-DD
  cycleOffsetDays: number;
  lastSkippedDateKey?: string;
  adaptedOverride?: RoutineAdaptationOverride | null;
  days: RoutineDayPlan[];
  rationale?: RoutineRationale;
}
