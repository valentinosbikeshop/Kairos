import {
  ExerciseCatalogItem,
  RirValue,
  RoutineDayPlan,
  RoutineExercisePrescription,
  RoutineRationale,
  RoutineScheduleType,
  TrainingMode,
  UserProfile,
  UserRoutine,
  WorkoutBlock,
  WorkoutExercise,
  WorkoutSession,
} from '@/types/kairos';
import { BUILTIN_EXERCISES, cloneSetsFromGhost, getLastExerciseGhost, normalizeSearchText } from '@/lib/exerciseDatabase';
import { MODE_META, toLocalDateKey, uid } from '@/lib/formatters';

export const WEEKDAY_NAMES_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

// Ordered Lunes (1) -> Domingo (0) for UI display
export const ORDERED_WEEKDAYS: { index: number; label: string; short: string }[] = [
  { index: 1, label: 'Lunes', short: 'Lun' },
  { index: 2, label: 'Martes', short: 'Mar' },
  { index: 3, label: 'Miércoles', short: 'Mié' },
  { index: 4, label: 'Jueves', short: 'Jue' },
  { index: 5, label: 'Viernes', short: 'Vie' },
  { index: 6, label: 'Sábado', short: 'Sáb' },
  { index: 0, label: 'Domingo', short: 'Dom' },
];

export interface AIRoutineInput {
  userPrompt: string;
  daysPerWeek: number;
  minutesPerSession: number;
  equipment: 'gym' | 'dumbbells_home' | 'calisthenics';
  scheduleType: RoutineScheduleType;
  profile: UserProfile | null;
}

function pickEx(
  catalogId: string,
  sets: number,
  repsNum: number,
  repRangeLabel: string,
  rir: RirValue,
  restSeconds: number,
  note?: string
): RoutineExercisePrescription {
  const found = BUILTIN_EXERCISES.find((e) => e.id === catalogId);
  return {
    catalogId,
    name: found ? found.name : catalogId,
    mode: found ? found.mode : 'hypertrophy',
    sets,
    repsNum,
    repRangeLabel,
    rir,
    restSeconds,
    note,
  };
}

function detectExplicitWeekdays(normPrompt: string): number[] {
  const map: { token: string; idx: number }[] = [
    { token: 'lunes', idx: 1 },
    { token: 'martes', idx: 2 },
    { token: 'miercoles', idx: 3 },
    { token: 'jueves', idx: 4 },
    { token: 'viernes', idx: 5 },
    { token: 'sabado', idx: 6 },
    { token: 'domingo', idx: 0 },
  ];
  const detected: number[] = [];
  for (const m of map) {
    if (normPrompt.includes(m.token)) {
      detected.push(m.idx);
    }
  }
  return detected;
}

function defaultWeekdaysForCount(count: number): number[] {
  if (count <= 2) return [1, 4]; // Lun, Jue
  if (count === 3) return [1, 3, 5]; // Lun, Mié, Vie
  if (count === 4) return [1, 2, 4, 5]; // Lun, Mar, Jue, Vie
  if (count === 5) return [1, 2, 3, 5, 6]; // Lun, Mar, Mié, Vie, Sáb
  return [1, 2, 3, 4, 5, 6]; // Lun - Sáb
}

export function generateScientificRoutine(input: AIRoutineInput): UserRoutine {
  const norm = normalizeSearchText(input.userPrompt || '');
  const profile = input.profile;
  const exp = profile?.experienceLevel ?? 'beginner';

  // Detect explicit weekdays if user wrote them in text
  const explicitWeekdays = detectExplicitWeekdays(norm);
  const clampedDays =
    explicitWeekdays.length >= 2 && explicitWeekdays.length <= 6
      ? explicitWeekdays.length
      : Math.max(2, Math.min(6, input.daysPerWeek || 3));

  const activeWeekdays =
    explicitWeekdays.length === clampedDays
      ? explicitWeekdays
      : defaultWeekdaysForCount(clampedDays);

  // Detect anatomical & goal priorities from natural language
  const wantsShoulders = /hombro|deltoide|militar|anchura|v-taper/.test(norm);
  const wantsChest = /pecho|pectoral|banca/.test(norm);
  const wantsArms = /brazo|bicep|tricep|manga/.test(norm);
  const wantsBack = /espalda|dorsal|dominada|traccion/.test(norm);
  const wantsGlutesLegs = /gluteo|cadera|pierna|cuadricep|femoral|isquio|tren inferior/.test(norm) || profile?.sex === 'female';
  const wantsFatLoss =
    /grasa|bajar|definir|definicion|recomposicion|perder peso|abdomen|marcar|secar/.test(norm) ||
    profile?.primaryGoal === 'recomp' ||
    (profile?.bodyFatPercent !== undefined &&
      ((profile.sex === 'male' && profile.bodyFatPercent >= 21) ||
        (profile.sex === 'female' && profile.bodyFatPercent >= 29)));
  const wantsStrength =
    /fuerza|pesado|powerlifting|1rm|fuerte/.test(norm) || profile?.primaryGoal === 'strength';
  const wantsCalisthenics =
    input.equipment === 'calisthenics' || /calistenia|peso corporal|barra|fondos|parque/.test(norm);
  const isHomeDumbbells =
    input.equipment === 'dumbbells_home' || /casa|mancuerna/.test(norm);

  // Detect joint sensitivities to adapt exercises safely
  const cautionLowerBack = /lumbar|espalda baja|hernia|ciatica/.test(norm);
  const cautionShoulder = /dolor de hombro|molestia hombro|manguito/.test(norm);
  const cautionKnee = /rodilla|menisco/.test(norm);

  // Calibrate volume per exercise based on experience & session minutes (Pelland et al., 2024)
  const baseSets = exp === 'beginner' ? 3 : input.minutesPerSession >= 70 ? 4 : 3;
  const accessorySets = exp === 'beginner' ? 2 : 3;
  const targetRir: RirValue = exp === 'beginner' ? '2' : '1';
  const maxExercisesPerDay =
    input.minutesPerSession <= 45 ? 4 : input.minutesPerSession <= 60 ? 5 : 6;

  // Build tailored templates depending on equipment & daysPerWeek
  type TemplateWorkout = {
    focusTitle: string;
    primaryMode: TrainingMode;
    exercises: RoutineExercisePrescription[];
  };

  const buildTemplates = (): TemplateWorkout[] => {
    if (wantsCalisthenics) {
      const upperA: RoutineExercisePrescription[] = [
        pickEx('cal_strict_pullups', baseSets, 8, '6–10 reps', targetRir, 135, 'Rango completo desde colgado'),
        pickEx('cal_parallel_dips', baseSets, 10, '8–12 reps', targetRir, 120, 'Controla 2s la bajada'),
        pickEx('cal_chin_ups', accessorySets, 8, '6–10 reps', targetRir, 120, 'Énfasis bíceps y dorsal bajo'),
        pickEx('cal_pseudo_planche_pushup', accessorySets, 10, '8–12 reps', targetRir, 105, 'Hombros adelantados'),
        pickEx('cal_lsit_iso', accessorySets, 15, '12–20s sostén', '2', 90, 'Abdomen comprimido'),
      ];
      const lowerCore: RoutineExercisePrescription[] = [
        pickEx('cal_pistol_squat', baseSets, 6, '5–8 por pierna', targetRir, 120, 'Asistida o libre con bajada de 3s'),
        pickEx('hyp_bulgarian_split_squat', baseSets, 10, '8–12 reps', targetRir, 120, 'Unilateral profunda'),
        pickEx('hyp_standing_calf_raise', accessorySets, 15, '12–15 reps', '1', 75, 'Pausa 2s abajo'),
        pickEx('cal_dragon_flag_dyn', accessorySets, 6, '5–8 reps', '2', 120, 'Control excéntrico'),
      ];
      if (clampedDays <= 3) {
        const calTemplates: TemplateWorkout[] = [
          { focusTitle: 'Dominio Corporal A · Tracción y Empuje', primaryMode: 'calisthenics', exercises: upperA.slice(0, maxExercisesPerDay) },
          { focusTitle: 'Pierna Unilateral & Core Estático', primaryMode: 'calisthenics', exercises: lowerCore.slice(0, maxExercisesPerDay) },
          { focusTitle: 'Dominio Corporal B · Fuerza e Isometría', primaryMode: 'calisthenics', exercises: [
            pickEx('cal_front_lever_iso', 3, 12, '10–15s', '2', 150),
            pickEx('cal_ring_dips', baseSets, 8, '6–10 reps', targetRir, 135),
            pickEx('cal_strict_pullups', baseSets, 8, '6–10 reps', targetRir, 135),
            pickEx('cal_handstand_iso', 3, 20, '15–25s', '2', 90),
          ].slice(0, maxExercisesPerDay) },
        ];
        return calTemplates.slice(0, clampedDays);
      }
    }

    // Safe biomechanical exercise choices respecting equipment & joint cautions
    const chestMain = isHomeDumbbells
      ? 'hyp_incline_db_press'
      : cautionShoulder
        ? 'hyp_chest_press_machine'
        : wantsStrength
          ? 'str_comp_bench_press'
          : 'hyp_incline_db_press';

    const shoulderMain = cautionShoulder
      ? 'hyp_db_lateral_raise'
      : isHomeDumbbells
        ? 'hyp_db_shoulder_press'
        : 'hyp_barbell_military_press';

    const lateralRaise = isHomeDumbbells ? 'hyp_db_lateral_raise' : 'hyp_cable_lateral_raise';
    const rowMain = isHomeDumbbells
      ? 'hyp_one_arm_db_row'
      : cautionLowerBack
        ? 'hyp_chest_supported_row'
        : 'hyp_chest_supported_row';
    const verticalPull = isHomeDumbbells ? 'cal_strict_pullups' : 'hyp_neutral_lat_pulldown';

    const quadMain = isHomeDumbbells
      ? 'hyp_bulgarian_split_squat'
      : cautionKnee
        ? 'hyp_leg_press_45'
        : cautionLowerBack
          ? 'hyp_hack_squat'
          : wantsStrength
            ? 'str_high_bar_squat'
            : 'hyp_hack_squat';

    const posteriorMain = cautionLowerBack
      ? 'hyp_seated_leg_curl'
      : isHomeDumbbells
        ? 'hyp_walking_lunges'
        : wantsGlutesLegs
          ? 'hyp_hip_thrust'
          : 'hyp_rdl';

    const hamstringIso = isHomeDumbbells ? 'hyp_rdl' : 'hyp_seated_leg_curl';
    const tricepsLongHead = isHomeDumbbells ? 'hyp_overhead_db_copa' : 'hyp_katana_triceps_ext';
    const bicepsStretch = isHomeDumbbells ? 'hyp_incline_db_curl' : 'hyp_bayesian_curl';

    const finisherOrCore = wantsFatLoss
      ? pickEx('crd_jr_boxer_step', 3, 90, '3×90s ritmo continuo', '2', 30, 'Gasto calórico final sin interferir en tu fuerza')
      : pickEx('hyp_cable_crunch', accessorySets, 12, '10–15 reps', '1', 75, 'Control abdominal');

    // 2 or 3 Days: Full Body Científico Alta Frecuencia (Frecuencia 2-3)
    if (clampedDays <= 3) {
      const dayAEx: RoutineExercisePrescription[] = [
        wantsShoulders
          ? pickEx(shoulderMain, baseSets, 8, '6–10 reps', targetRir, 120, 'Prioridad al inicio con SNC fresco')
          : pickEx(chestMain, baseSets, 8, '6–10 reps', targetRir, 135, 'Máximo estiramiento pectoral'),
        pickEx(quadMain, baseSets, 8, '6–10 reps', targetRir, 150, 'Profundidad controlada'),
        pickEx(verticalPull, baseSets, 10, '8–12 reps', targetRir, 120, 'Tracción vertical controlada'),
        pickEx(hamstringIso, accessorySets, 12, '10–12 reps', targetRir, 90, 'Estiramiento de isquios'),
        wantsArms
          ? pickEx(tricepsLongHead, accessorySets, 12, '10–14 reps', '1', 90, 'Cabeza larga en estiramiento')
          : pickEx(lateralRaise, accessorySets, 14, '12–15 reps', '1', 75, 'Anchura de deltoide lateral'),
        finisherOrCore,
      ];

      const dayBEx: RoutineExercisePrescription[] = [
        pickEx(posteriorMain, baseSets, 8, '8–10 reps', targetRir, 150, 'Cadena posterior y glúteo'),
        wantsShoulders
          ? pickEx(chestMain, baseSets, 10, '8–10 reps', targetRir, 120)
          : pickEx(shoulderMain, baseSets, 10, '8–10 reps', targetRir, 120),
        pickEx(rowMain, baseSets, 10, '8–12 reps', targetRir, 120, 'Densidad de espalda sin fatiga lumbar'),
        pickEx('hyp_bulgarian_split_squat', accessorySets, 10, '8–10 por pierna', targetRir, 120),
        pickEx(bicepsStretch, accessorySets, 12, '10–14 reps', '1', 90, 'Bíceps en máximo estiramiento'),
        pickEx('hyp_standing_calf_raise', accessorySets, 14, '12–15 reps', '1', 75, 'Pausa 2s abajo'),
      ];

      const dayCEx: RoutineExercisePrescription[] = [
        wantsArms
          ? pickEx('hyp_ez_skullcrusher', baseSets, 10, '8–12 reps', targetRir, 90, 'Prioridad brazos')
          : pickEx('hyp_flat_db_press', baseSets, 10, '8–12 reps', targetRir, 120),
        pickEx('hyp_one_arm_db_row', baseSets, 10, '8–12 reps', targetRir, 105),
        pickEx(isHomeDumbbells ? 'hyp_walking_lunges' : 'hyp_leg_press_45', baseSets, 12, '10–12 reps', targetRir, 135),
        pickEx(lateralRaise, accessorySets, 14, '12–15 reps', '1', 75),
        pickEx('hyp_preacher_curl', accessorySets, 12, '10–12 reps', '1', 90),
        finisherOrCore,
      ];

      const fbTemplates: TemplateWorkout[] = [
        {
          focusTitle: 'Cuerpo Completo A · Base y Empuje',
          primaryMode: wantsStrength ? 'strength' : 'hypertrophy',
          exercises: dayAEx.slice(0, maxExercisesPerDay),
        },
        {
          focusTitle: 'Cuerpo Completo B · Cadena Posterior y Tracción',
          primaryMode: 'hypertrophy',
          exercises: dayBEx.slice(0, maxExercisesPerDay),
        },
        {
          focusTitle: 'Cuerpo Completo C · Estética y Detalle',
          primaryMode: 'hypertrophy',
          exercises: dayCEx.slice(0, maxExercisesPerDay),
        },
      ];
      return fbTemplates.slice(0, clampedDays);
    }

    // 4 Days: Torso / Pierna (Upper / Lower Frecuencia 2)
    const upper1: TemplateWorkout = {
      focusTitle: wantsShoulders
        ? 'Torso A · Énfasis Hombros y Pectoral'
        : 'Torso A · Fuerza e Hipertrofia Superior',
      primaryMode: wantsStrength ? 'strength' : 'hypertrophy',
      exercises: [
        pickEx(wantsShoulders ? shoulderMain : chestMain, baseSets, 8, '6–10 reps', targetRir, 135),
        pickEx(rowMain, baseSets, 10, '8–10 reps', targetRir, 120),
        pickEx(wantsShoulders ? chestMain : shoulderMain, baseSets, 10, '8–12 reps', targetRir, 120),
        pickEx(verticalPull, accessorySets, 10, '8–12 reps', targetRir, 105),
        pickEx(lateralRaise, accessorySets, 14, '12–15 reps', '1', 75),
        pickEx(tricepsLongHead, accessorySets, 12, '10–14 reps', '1', 90),
      ].slice(0, maxExercisesPerDay),
    };

    const lower1: TemplateWorkout = {
      focusTitle: wantsGlutesLegs
        ? 'Pierna A · Cuádriceps y Glúteo'
        : 'Pierna A · Dominante de Rodilla',
      primaryMode: wantsStrength ? 'strength' : 'hypertrophy',
      exercises: [
        pickEx(quadMain, baseSets, 8, '6–10 reps', targetRir, 150),
        pickEx('hyp_rdl', baseSets, 9, '8–10 reps', targetRir, 150),
        pickEx('hyp_bulgarian_split_squat', accessorySets, 10, '8–10 reps', targetRir, 120),
        pickEx(hamstringIso, accessorySets, 12, '10–14 reps', '1', 90),
        pickEx('hyp_standing_calf_raise', accessorySets, 14, '12–15 reps', '1', 75),
        finisherOrCore,
      ].slice(0, maxExercisesPerDay),
    };

    const upper2: TemplateWorkout = {
      focusTitle: wantsArms
        ? 'Torso B · Espalda y Prioridad Brazos'
        : wantsBack
          ? 'Torso B · Densidad de Espalda y Deltoides'
          : 'Torso B · Tracción y Detalle Muscular',
      primaryMode: 'hypertrophy',
      exercises: [
        ...(wantsArms
          ? [
              pickEx(bicepsStretch, baseSets, 10, '8–12 reps', targetRir, 90, 'Prioridad al inicio de la sesión'),
              pickEx('hyp_ez_skullcrusher', baseSets, 10, '8–12 reps', targetRir, 90),
            ]
          : []),
        pickEx(verticalPull, baseSets, 10, '8–12 reps', targetRir, 120),
        pickEx('hyp_flat_db_press', baseSets, 10, '8–12 reps', targetRir, 120),
        pickEx('hyp_one_arm_db_row', accessorySets, 10, '8–12 reps', targetRir, 105),
        pickEx('hyp_reverse_pec_deck', accessorySets, 14, '12–15 reps', '1', 75),
        ...(!wantsArms ? [pickEx(bicepsStretch, accessorySets, 12, '10–14 reps', '1', 90)] : []),
      ].slice(0, maxExercisesPerDay),
    };

    const lower2: TemplateWorkout = {
      focusTitle: 'Pierna B · Cadena Posterior, Glúteo y Core',
      primaryMode: 'hypertrophy',
      exercises: [
        pickEx('hyp_hip_thrust', baseSets, 10, '8–12 reps', targetRir, 135),
        pickEx(isHomeDumbbells ? 'hyp_walking_lunges' : 'hyp_leg_press_45', baseSets, 10, '10–12 reps', targetRir, 135),
        pickEx(hamstringIso, baseSets, 12, '10–14 reps', targetRir, 90),
        pickEx(isHomeDumbbells ? 'hyp_bulgarian_split_squat' : 'hyp_leg_extension_stretch', accessorySets, 12, '12–15 reps', '1', 90),
        pickEx('hyp_seated_calf_raise', accessorySets, 15, '12–15 reps', '1', 75),
        finisherOrCore,
      ].slice(0, maxExercisesPerDay),
    };

    if (clampedDays === 4) {
      return [upper1, lower1, upper2, lower2];
    }

    // 5 or 6 Days: Push / Pull / Legs / Upper / Lower (or PPL x2)
    const pushDay: TemplateWorkout = {
      focusTitle: 'Empuje · Pectoral, Hombros y Tríceps',
      primaryMode: 'hypertrophy',
      exercises: [
        pickEx(chestMain, baseSets, 8, '6–10 reps', targetRir, 135),
        pickEx(shoulderMain, baseSets, 9, '8–10 reps', targetRir, 120),
        pickEx(isHomeDumbbells ? 'hyp_flat_db_press' : 'hyp_pec_deck', accessorySets, 12, '10–14 reps', '1', 90),
        pickEx(lateralRaise, baseSets, 14, '12–15 reps', '1', 75),
        pickEx(tricepsLongHead, accessorySets, 12, '10–14 reps', '1', 90),
      ].slice(0, maxExercisesPerDay),
    };

    const pullDay: TemplateWorkout = {
      focusTitle: 'Tirón · Espalda Completa y Bíceps',
      primaryMode: 'hypertrophy',
      exercises: [
        pickEx(verticalPull, baseSets, 9, '8–10 reps', targetRir, 120),
        pickEx(rowMain, baseSets, 9, '8–10 reps', targetRir, 120),
        pickEx('hyp_face_pull', accessorySets, 14, '12–15 reps', '1', 75),
        pickEx(bicepsStretch, baseSets, 11, '10–12 reps', '1', 90),
        pickEx('hyp_hammer_curl', accessorySets, 12, '10–14 reps', '1', 75),
      ].slice(0, maxExercisesPerDay),
    };

    if (clampedDays === 5) {
      return [upper1, lower1, pushDay, pullDay, lower2];
    }

    return [
      pushDay,
      pullDay,
      lower1,
      { ...pushDay, focusTitle: 'Empuje B · Hombro Lateral y Pectoral' },
      { ...pullDay, focusTitle: 'Tirón B · Densidad Dorsal y Brazos' },
      lower2,
    ];
  };

  const templates = buildTemplates();
  const days: RoutineDayPlan[] = [];

  if (input.scheduleType === 'weekday') {
    let workoutCursor = 0;
    for (const wd of ORDERED_WEEKDAYS) {
      const isTraining = activeWeekdays.includes(wd.index);
      if (isTraining && workoutCursor < templates.length) {
        const tpl = templates[workoutCursor++];
        days.push({
          id: uid('rday'),
          label: wd.label,
          weekdayIndex: wd.index,
          isRestDay: false,
          focusTitle: tpl.focusTitle,
          primaryMode: tpl.primaryMode,
          estimatedMinutes: input.minutesPerSession,
          exercises: tpl.exercises,
        });
      } else {
        days.push({
          id: uid('rday'),
          label: wd.label,
          weekdayIndex: wd.index,
          isRestDay: true,
          focusTitle: 'Descanso y Recuperación',
          primaryMode: 'hypertrophy',
          estimatedMinutes: 0,
          exercises: [],
        });
      }
    }
  } else {
    // Cyclic structure inserting strategic recovery days
    let dayCounter = 1;
    templates.forEach((tpl, idx) => {
      days.push({
        id: uid('rday'),
        label: `Día ${dayCounter++}`,
        isRestDay: false,
        focusTitle: tpl.focusTitle,
        primaryMode: tpl.primaryMode,
        estimatedMinutes: input.minutesPerSession,
        exercises: tpl.exercises,
      });
      // Add rest day every 2 workouts (or after each workout on <=3d/wk)
      const insertRest =
        clampedDays <= 3 || (idx + 1) % 2 === 0 || idx === templates.length - 1;
      if (insertRest) {
        days.push({
          id: uid('rday'),
          label: `Día ${dayCounter++}`,
          isRestDay: true,
          focusTitle: 'Descanso y Supercompensación',
          primaryMode: 'hypertrophy',
          estimatedMinutes: 0,
          exercises: [],
        });
      }
    });
  }

  // Construct personalized, plain-language Scientific Rationale ("¿Por qué esta es la mejor rutina para ti?")
  const splitName =
    clampedDays <= 3
      ? `Cuerpo Completo (${clampedDays} días/semana)`
      : clampedDays === 4
        ? 'Torso / Pierna (4 días/semana)'
        : clampedDays === 5
          ? 'Híbrida Torso-Pierna + Empuje-Tirón (5 días)'
          : 'Empuje / Tirón / Pierna Frecuencia 2 (6 días)';

  const bodyContext = profile
    ? `Con ${profile.heightCm} cm, ${profile.weightKg} kg${
        profile.bodyFatPercent ? ` y ~${profile.bodyFatPercent}% de grasa corporal` : ''
      }`
    : 'Según tu perfil actual';

  const detectedPriorities: string[] = [];
  if (wantsShoulders) detectedPriorities.push('hombros');
  if (wantsChest) detectedPriorities.push('pectoral');
  if (wantsArms) detectedPriorities.push('brazos');
  if (wantsBack) detectedPriorities.push('espalda');
  if (wantsGlutesLegs) detectedPriorities.push('piernas y glúteo');
  if (wantsFatLoss) detectedPriorities.push('recomposición / reducción de grasa');
  if (wantsStrength) detectedPriorities.push('fuerza sólida');

  const priorityText =
    detectedPriorities.length > 0
      ? `dando prioridad específica a ${detectedPriorities.join(', ')}`
      : 'buscando un desarrollo físico equilibrado y estético';

  const rationale: RoutineRationale = {
    headline: `Por qué "${splitName}" es la configuración óptima para ti`,
    summary: `${bodyContext}, esta estructura entrena cada grupo muscular al menos 2 veces por semana dentro de tus ${input.minutesPerSession} minutos por sesión, ${priorityText}, sin acumular fatiga basura.`,
    userPromptSummary: input.userPrompt.trim() || undefined,
    pillars: [
      {
        title: `1. Frecuencia 2 en ${clampedDays} días: máximo estímulo sin agotarte`,
        plainExplanation: `En vez de castigar un músculo una sola vez a la semana con 18 series agotadoras, dividimos el trabajo en ${clampedDays} sesiones dinámicas. Así cada músculo recibe señal de crecimiento dos veces por semana estando fresco y recuperado.`,
        scienceReference: 'Pelland et al., Sports Medicine (2024)',
      },
      {
        title: '2. Ejercicios que trabajan el músculo estirado',
        plainExplanation:
          'Seleccionamos variantes como press inclinado, extensiones sobre la cabeza, curls en estiramiento y flexión profunda de pierna porque la ciencia reciente demostró que el músculo crece notablemente más cuando hace fuerza en su posición alargada.',
        scienceReference: 'Wolf et al. (2023) & Maeo et al. (2023)',
      },
      {
        title:
          detectedPriorities.length > 0
            ? `3. Tus prioridades (${detectedPriorities.slice(0, 2).join(' y ')}) van primero`
            : '3. Orden inteligente según energía nerviosa',
        plainExplanation:
          'Los primeros 20 minutos de tu sesión son los de mayor capacidad neuromuscular. Colocamos tus objetivos principales al inicio del día para que progreses más rápido en ellos, antes de que aparezca el cansancio general.',
        scienceReference: 'Nunes et al., Eur. J. Sport Science (2021)',
      },
      {
        title: `4. Intensidad calibrada a tu nivel (RIR ${targetRir}) y descansos reales`,
        plainExplanation:
          exp === 'beginner'
            ? 'Como estás construyendo tu base, quedarte a 2 repeticiones del fallo (RIR 2) te da casi el 100% de ganancia muscular evitando agujetas extremas y cuidando tus articulaciones.'
            : 'Trabajar a 1–2 repeticiones del fallo (RIR 1–2) con descansos de 90 a 150 segundos te permite mover más peso en cada serie sin quemar tu sistema nervioso.',
        scienceReference: 'Robinson et al. (2024) & Singer et al. (2024)',
      },
      ...(wantsFatLoss
        ? [
            {
              title: '5. Recomposición corporal sin perder músculo',
              plainExplanation:
                'Para reducir tu % de grasa mientras ganas tono firme, las pesas mantienen tu masa magra elevada y el bloque breve metabólico va siempre al final de la sesión para no restarte fuerza.',
              scienceReference: 'Schumann et al., Sports Medicine (2022)',
            },
          ]
        : []),
    ],
  };

  return {
    id: uid('rtn'),
    name: splitName,
    scheduleType: input.scheduleType,
    source: 'ai_science',
    createdAtIso: new Date().toISOString(),
    cycleAnchorDateKey: toLocalDateKey(),
    cycleOffsetDays: 0,
    adaptedOverride: null,
    days,
    rationale,
  };
}

// ============================================================================
// DAILY SCHEDULE RESOLUTION & MISSED-WORKOUT SMART ADAPTATION
// ============================================================================

export interface TodayRoutineResolution {
  todayPlan: RoutineDayPlan | null;
  isAdaptedToday: boolean;
  adaptationMessage?: string;
  completedToday: boolean;
  missedPreviousDayPlan: RoutineDayPlan | null;
}

function diffCalendarDays(anchorKey: string, targetKey: string): number {
  const [ay, am, ad] = anchorKey.split('-').map(Number);
  const [ty, tm, td] = targetKey.split('-').map(Number);
  const utcA = Date.UTC(ay, (am || 1) - 1, ad || 1);
  const utcT = Date.UTC(ty, (tm || 1) - 1, td || 1);
  return Math.round((utcT - utcA) / (1000 * 60 * 60 * 24));
}

export function resolveTodayRoutineStatus(
  routine: UserRoutine | null,
  sessions: WorkoutSession[],
  now = new Date()
): TodayRoutineResolution {
  if (!routine || !routine.days.length) {
    return {
      todayPlan: null,
      isAdaptedToday: false,
      completedToday: false,
      missedPreviousDayPlan: null,
    };
  }

  const todayKey = toLocalDateKey(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  const completedToday = sessions.some(
    (s) => toLocalDateKey(new Date(s.dateIso)) === todayKey
  );
  const trainedYesterday = sessions.some(
    (s) => toLocalDateKey(new Date(s.dateIso)) === yesterdayKey
  );

  // Check if today was explicitly skipped
  if (routine.lastSkippedDateKey === todayKey) {
    return {
      todayPlan: {
        id: 'skipped_today',
        label: 'Hoy (Reprogramado)',
        isRestDay: true,
        focusTitle: 'Descanso · Sesión movida automáticamente',
        primaryMode: 'hypertrophy',
        estimatedMinutes: 0,
        exercises: [],
      },
      isAdaptedToday: true,
      adaptationMessage:
        routine.adaptedOverride?.explanation ||
        'Tu rutina fue adaptada para que retomes en tu próxima sesión sin perder el orden.',
      completedToday,
      missedPreviousDayPlan: null,
    };
  }

  // Check if an adapted override is scheduled specifically for today
  if (routine.adaptedOverride && routine.adaptedOverride.forDateKey === todayKey) {
    const overridePlan = routine.days.find((d) => d.id === routine.adaptedOverride?.dayPlanId);
    if (overridePlan) {
      return {
        todayPlan: overridePlan,
        isAdaptedToday: true,
        adaptationMessage: routine.adaptedOverride.explanation,
        completedToday,
        missedPreviousDayPlan: null,
      };
    }
  }

  let todayPlan: RoutineDayPlan | null = null;
  let yesterdayScheduledPlan: RoutineDayPlan | null = null;

  if (routine.scheduleType === 'weekday') {
    const todayWd = now.getDay();
    const yestWd = yesterday.getDay();
    todayPlan = routine.days.find((d) => d.weekdayIndex === todayWd) ?? routine.days[0];
    yesterdayScheduledPlan = routine.days.find((d) => d.weekdayIndex === yestWd) ?? null;
  } else {
    const len = routine.days.length;
    const elapsed = diffCalendarDays(routine.cycleAnchorDateKey, todayKey);
    const idx = (((elapsed - routine.cycleOffsetDays) % len) + len) % len;
    const yestIdx = (((elapsed - 1 - routine.cycleOffsetDays) % len) + len) % len;
    todayPlan = routine.days[idx];
    yesterdayScheduledPlan = routine.days[yestIdx];
  }

  // Detect if yesterday had a scheduled workout that wasn't logged (and account existed before today)
  const routineCreatedKey = toLocalDateKey(new Date(routine.createdAtIso));
  const existedYesterday = diffCalendarDays(routineCreatedKey, todayKey) >= 1;
  const missedPreviousDayPlan =
    existedYesterday &&
    !trainedYesterday &&
    routine.lastSkippedDateKey !== yesterdayKey &&
    yesterdayScheduledPlan &&
    !yesterdayScheduledPlan.isRestDay
      ? yesterdayScheduledPlan
      : null;

  return {
    todayPlan,
    isAdaptedToday: false,
    completedToday,
    missedPreviousDayPlan,
  };
}

/**
 * Adapts the user's routine cleanly when they need to skip today (or missed yesterday).
 */
export function adaptRoutineForSkippedDay(
  routine: UserRoutine,
  mode: 'skip_today' | 'recover_yesterday',
  missedPlan?: RoutineDayPlan | null,
  now = new Date()
): UserRoutine {
  const todayKey = toLocalDateKey(now);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowKey = toLocalDateKey(tomorrow);

  if (routine.scheduleType === 'cyclic') {
    // Shifting cycleOffsetDays by +1 slides the entire training cycle forward by 1 day seamlessly!
    return {
      ...routine,
      cycleOffsetDays: (routine.cycleOffsetDays || 0) + 1,
      lastSkippedDateKey: mode === 'skip_today' ? todayKey : routine.lastSkippedDateKey,
      adaptedOverride: {
        forDateKey: mode === 'skip_today' ? tomorrowKey : todayKey,
        dayPlanId: missedPlan?.id ?? routine.days[0].id,
        skippedOnDateKey: todayKey,
        explanation:
          mode === 'skip_today'
            ? 'Ciclo desplazado un día: descansa hoy tranquilo, mañana retomas exactamente donde ibas.'
            : `Adaptamos tu ciclo para recuperar "${missedPlan?.focusTitle ?? 'tu sesión pendiente'}" hoy.`,
      },
    };
  }

  // Weekday routine adaptation
  if (mode === 'recover_yesterday' && missedPlan) {
    return {
      ...routine,
      adaptedOverride: {
        forDateKey: todayKey,
        dayPlanId: missedPlan.id,
        skippedOnDateKey: todayKey,
        explanation: `Recuperando hoy la sesión pendiente ("${missedPlan.focusTitle}") para mantener tu semana equilibrada.`,
      },
    };
  }

  const todayWd = now.getDay();
  const todayPlan = routine.days.find((d) => d.weekdayIndex === todayWd);
  if (!todayPlan || todayPlan.isRestDay) {
    return routine;
  }

  // Look ahead over the next 3 days for a rest day to place today's workout, otherwise place tomorrow
  let targetDateKey = tomorrowKey;
  let targetDayLabel = 'mañana';
  for (let offset = 1; offset <= 3; offset++) {
    const candidateDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const candPlan = routine.days.find((d) => d.weekdayIndex === candidateDate.getDay());
    if (candPlan && candPlan.isRestDay) {
      targetDateKey = toLocalDateKey(candidateDate);
      targetDayLabel = offset === 1 ? 'mañana' : `el ${WEEKDAY_NAMES_ES[candidateDate.getDay()]}`;
      break;
    }
  }

  return {
    ...routine,
    lastSkippedDateKey: todayKey,
    adaptedOverride: {
      forDateKey: targetDateKey,
      dayPlanId: todayPlan.id,
      skippedOnDateKey: todayKey,
      explanation: `Movimos "${todayPlan.focusTitle}" para ${targetDayLabel} así no pierdes tu estímulo semanal.`,
    },
  };
}

/**
 * Builds a single polymorphic WorkoutExercise from a RoutineExercisePrescription,
 * pre-filling prescribed sets, reps, RIR, rest, or historical ghost loads.
 */
export function buildWorkoutExerciseFromPrescription(
  pres: RoutineExercisePrescription,
  catalog: ExerciseCatalogItem[] = BUILTIN_EXERCISES,
  sessions: WorkoutSession[] = [],
  profile: UserProfile | null = null
): WorkoutExercise {
  const bw = profile?.weightKg ?? 72;
  const loadScale = profile?.sex === 'female' ? 0.65 : 1.0;

  const catItem =
    catalog.find((c) => c.id === pres.catalogId) ??
    BUILTIN_EXERCISES.find((c) => c.id === pres.catalogId);

  const ghost = getLastExerciseGhost(sessions, pres.catalogId, pres.name);
  const ghostSets = cloneSetsFromGhost(ghost?.lastExercise, () => uid('set'), pres.mode);

  const base: WorkoutExercise = {
    id: uid('ex'),
    catalogId: pres.catalogId,
    name: catItem?.name ?? pres.name,
    mode: pres.mode,
    muscleGroup: catItem?.muscleGroup ?? MODE_META[pres.mode].label,
    defaultRestSeconds: pres.restSeconds || catItem?.defaultRestSeconds || 120,
    notes: pres.note,
    calisthenicsSubType: catItem?.calisthenicsSubType ?? 'dynamic',
    cardioDiscipline: catItem?.cardioDiscipline ?? 'jumprope',
  };

  if (Object.keys(ghostSets).length > 0) {
    return { ...base, ...ghostSets };
  }

  const count = Math.max(1, pres.sets || 3);

  if (pres.mode === 'hypertrophy') {
    const isLower = /squat|hack|leg|rdl|hip_thrust|lunge|sentadilla|prensa|peso muerto/i.test(
      `${pres.catalogId} ${pres.name}`
    );
    const isIso = /raise|curl|tricep|skull|copa|crunch|calf|pec_deck|face_pull|vuelos|laterales|gemelo/i.test(
      `${pres.catalogId} ${pres.name}`
    );
    const startKg = Math.max(
      5,
      Math.round(((isLower ? bw * 0.7 : isIso ? bw * 0.22 : bw * 0.48) * loadScale) / 2.5) * 2.5
    );
    return {
      ...base,
      hypertrophySets: Array.from({ length: count }, () => ({
        id: uid('hy'),
        weightKg: startKg,
        reps: pres.repsNum || 10,
        rir: pres.rir || '2',
        setType: 'Efectiva' as const,
        restSeconds: base.defaultRestSeconds,
        completed: false,
      })),
    };
  }

  if (pres.mode === 'strength') {
    const startKg = Math.max(20, Math.round((bw * 0.8 * loadScale) / 2.5) * 2.5);
    return {
      ...base,
      referenceOneRmKg: Math.round(startKg * 1.2),
      strengthSets: Array.from({ length: count }, () => ({
        id: uid('st'),
        weightKg: startKg,
        reps: pres.repsNum || 5,
        rpe: 8.0,
        restSeconds: base.defaultRestSeconds,
        completed: false,
      })),
    };
  }

  if (pres.mode === 'calisthenics') {
    const isIso =
      catItem?.calisthenicsSubType === 'isometric' ||
      /plancha|lever|handstand|pino|l-sit|lsit|isometr|hold|sosten/i.test(pres.name);
    if (isIso) {
      return {
        ...base,
        calisthenicsSubType: 'isometric',
        calisthenicsIsometricSets: Array.from({ length: count }, () => ({
          id: uid('ci'),
          progression: 'Tuck' as const,
          targetSeconds: pres.repsNum || 15,
          actualSeconds: pres.repsNum || 15,
          addedWeightKg: 0,
          restSeconds: base.defaultRestSeconds,
          completed: false,
        })),
      };
    }
    return {
      ...base,
      calisthenicsSubType: 'dynamic',
      calisthenicsDynamicSets: Array.from({ length: count }, () => ({
        id: uid('cd'),
        variation: 'Controlado',
        addedWeightKg: 0,
        reps: pres.repsNum || 8,
        rir: pres.rir || '2',
        restSeconds: base.defaultRestSeconds,
        completed: false,
      })),
    };
  }

  if (pres.mode === 'hyrox') {
    const def = catItem?.hyroxDefault ?? {
      station: '1000m Run' as const,
      distanceMeters: 1000,
      reps: 0,
      implementWeightKg: 0,
    };
    return {
      ...base,
      hyroxSets: Array.from({ length: count }, () => ({
        id: uid('hx'),
        station: def.station,
        distanceMeters: def.distanceMeters,
        reps: def.reps || pres.repsNum || 0,
        implementWeightKg: def.implementWeightKg,
        splitSeconds: 240,
        roxzoneSeconds: 25,
        completed: false,
      })),
    };
  }

  const disc = catItem?.cardioDiscipline ?? 'jumprope';
  if (disc === 'running') {
    return {
      ...base,
      cardioDiscipline: 'running',
      runningSets: Array.from({ length: count }, () => ({
        id: uid('rn'),
        distanceMeters: 1000,
        durationSeconds: 270,
        inclinePercent: 0,
        runType: 'Zona 2 Continua' as const,
        restSeconds: base.defaultRestSeconds,
        completed: false,
      })),
    };
  }
  if (disc === 'swimming') {
    return {
      ...base,
      cardioDiscipline: 'swimming',
      swimmingSets: Array.from({ length: count }, () => ({
        id: uid('sw'),
        poolLengthMeters: 25,
        laps: 4,
        stroke: 'Crol/Libre' as const,
        durationSeconds: 110,
        restSeconds: base.defaultRestSeconds,
        completed: false,
      })),
    };
  }
  if (disc === 'cycling') {
    return {
      ...base,
      cardioDiscipline: 'cycling',
      cyclingSets: Array.from({ length: count }, () => ({
        id: uid('cy'),
        durationSeconds: pres.repsNum && pres.repsNum >= 30 ? pres.repsNum : 300,
        distanceMeters: 2200,
        avgWatts: 200,
        cadenceRpm: 88,
        restSeconds: base.defaultRestSeconds,
        completed: false,
      })),
    };
  }

  return {
    ...base,
    cardioDiscipline: 'jumprope',
    jumpRopeSets: Array.from({ length: count }, () => ({
      id: uid('jr'),
      jumps: 160,
      durationSeconds: pres.repsNum || 90,
      style: 'Boxer Step' as const,
      misses: 0,
      restSeconds: base.defaultRestSeconds,
      completed: false,
    })),
  };
}

/**
 * Converts a RoutineDayPlan into active WorkoutBlocks pre-filled with prescribed sets, reps, RIR, and rest.
 */
export function buildWorkoutBlocksFromRoutineDay(
  dayPlan: RoutineDayPlan,
  catalog: ExerciseCatalogItem[] = BUILTIN_EXERCISES,
  sessions: WorkoutSession[] = [],
  profile: UserProfile | null = null
): WorkoutBlock[] {
  if (dayPlan.isRestDay || !dayPlan.exercises.length) return [];

  const grouped: { mode: TrainingMode; items: RoutineExercisePrescription[] }[] = [];
  for (const ex of dayPlan.exercises) {
    const last = grouped[grouped.length - 1];
    if (last && last.mode === ex.mode) {
      last.items.push(ex);
    } else {
      grouped.push({ mode: ex.mode, items: [ex] });
    }
  }

  return grouped.map((grp, idx) => {
    const exercises = grp.items.map((pres) =>
      buildWorkoutExerciseFromPrescription(pres, catalog, sessions, profile)
    );

    return {
      id: uid('blk'),
      mode: grp.mode,
      cardioDiscipline:
        grp.mode === 'cardio' ? exercises[0]?.cardioDiscipline ?? 'jumprope' : undefined,
      title: idx === 0 ? dayPlan.focusTitle : MODE_META[grp.mode].label,
      exercises,
    };
  });
}
