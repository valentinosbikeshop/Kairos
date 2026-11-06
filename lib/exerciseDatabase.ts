import {
  CalisthenicsDynamicSet,
  CalisthenicsIsometricSet,
  CardioDiscipline,
  CyclingSet,
  ExerciseCatalogItem,
  HypertrophySet,
  HyroxSet,
  JumpRopeSet,
  RunningSet,
  StrengthSet,
  SwimmingSet,
  TrainingMode,
  WorkoutExercise,
  WorkoutSession,
} from '@/types/kairos';
import {
  calculateJumpRopeRpm,
  calculateRunningPaceSecPerKm,
  calculateSwimPaceSecPer100m,
  formatMmSs,
} from '@/lib/formatters';

export const BUILTIN_EXERCISES: ExerciseCatalogItem[] = [
  // ===================== HIPERTROFIA — HOMBROS =====================
  {
    id: 'hyp_barbell_military_press',
    name: 'Press Militar con Barra',
    aliases: ['press militar', 'militar barra', 'ohp', 'overhead press', 'press hombro barra', 'press frontal'],
    mode: 'hypertrophy',
    muscleGroup: 'Deltoide Anterior / Medio',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Antebrazos verticales vistos de frente y abdomen firme sin arquear en exceso.',
  },
  {
    id: 'hyp_db_shoulder_press',
    name: 'Press Militar con Mancuernas',
    aliases: ['press militar mancuernas', 'press de hombros', 'shoulder press', 'press hombro sentado', 'press arnold', 'press militar con mancuernas (sentado)', 'press militar con mancuernas sentado', 'press militar sentado'],
    mode: 'hypertrophy',
    muscleGroup: 'Deltoide Anterior',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Empuja en el plano escapular (codos 30° adelante) cuidando la articulación.',
  },
  {
    id: 'hyp_smith_military_press',
    name: 'Press Militar en Multipower',
    aliases: ['press militar smith', 'press hombro multipower', 'militar guiado', 'press militar en multipower (smith)'],
    mode: 'hypertrophy',
    muscleGroup: 'Deltoide Anterior',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Banco a 75-80° para alinear fibras del deltoide anterior con máxima estabilidad.',
  },
  {
    id: 'hyp_cable_lateral_raise',
    name: 'Elevaciones Laterales en Polea',
    aliases: ['vuelos laterales', 'laterales polea', 'hombro lateral', 'lateral raise'],
    mode: 'hypertrophy',
    muscleGroup: 'Deltoide Lateral',
    defaultRestSeconds: 75,
    biomechanicalCue: 'Polea a la altura de la muñeca para máxima tensión desde el inicio del movimiento.',
  },
  {
    id: 'hyp_db_lateral_raise',
    name: 'Elevaciones Laterales con Mancuernas',
    aliases: ['vuelos laterales mancuernas', 'apertura hombro', 'laterales hombro'],
    mode: 'hypertrophy',
    muscleGroup: 'Deltoide Lateral',
    defaultRestSeconds: 75,
    biomechanicalCue: 'Piensa en lanzar las mancuernas lejos hacia las paredes, no en encoger trapecios.',
  },
  {
    id: 'hyp_reverse_pec_deck',
    name: 'Pájaros en Máquina',
    aliases: ['pajaros', 'vuelos posteriores', 'rear delt', 'pec deck inverso', 'hombro posterior', 'pájaros en máquina / deltoide posterior', 'deltoide posterior maquina'],
    mode: 'hypertrophy',
    muscleGroup: 'Deltoide Posterior',
    defaultRestSeconds: 75,
    biomechanicalCue: 'Aleja las manos en arco amplio sin juntar las escápulas al principio.',
  },
  {
    id: 'hyp_face_pull',
    name: 'Face Pull en Polea Alta',
    aliases: ['facepull', 'tiron a la cara', 'rotacion externa hombro', 'deltoide posterior cuerda', 'face pull en polea alta (cuerda)', 'face pull con cuerda'],
    mode: 'hypertrophy',
    muscleGroup: 'Deltoide Posterior / Manguito Rotador',
    defaultRestSeconds: 75,
    biomechanicalCue: 'Lleva los pulgares hacia las orejas terminando en rotación externa.',
  },

  // ===================== HIPERTROFIA — TRÍCEPS =====================
  {
    id: 'hyp_ez_skullcrusher',
    name: 'Press Francés con Barra EZ',
    aliases: ['rompecabezas', 'rompe cabezas', 'rompecraneos', 'rompe craneos', 'press frances', 'skullcrusher', 'skull crusher', 'press francés con barra ez (rompecráneos)'],
    mode: 'hypertrophy',
    muscleGroup: 'Tríceps (Cabeza Larga y Medial)',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Inclina los brazos ligeramente hacia atrás de la cabeza para mantener tensión constante.',
  },
  {
    id: 'hyp_db_skullcrusher',
    name: 'Press Francés con Mancuernas',
    aliases: ['rompecabezas mancuernas', 'rompe cabezas mancuernas', 'rompecraneos mancuernas', 'press frances mancuernas', 'press francés con mancuernas (rompecabezas neutro)', 'rompecabezas neutro'],
    mode: 'hypertrophy',
    muscleGroup: 'Tríceps',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Agarre neutro amigable con codos y muñecas bajando a los lados de las sienes.',
  },
  {
    id: 'hyp_katana_triceps_ext',
    name: 'Extensión Katana en Polea',
    aliases: ['triceps tras nuca polea', 'extension overhead', 'katana triceps', 'rompecabezas polea', 'copa polea', 'press francés en polea / extensión katana', 'extension katana'],
    mode: 'hypertrophy',
    muscleGroup: 'Tríceps (Cabeza Larga)',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Codos arriba estirando la cabeza larga del tríceps; +40% hipertrofia según estudios.',
  },
  {
    id: 'hyp_overhead_db_copa',
    name: 'Extensión de Tríceps Tras Nuca',
    aliases: ['copa a dos manos', 'copa triceps', 'copa mancuerna', 'trasnuca triceps', 'extensión de tríceps tras nuca (copa)', 'copa con mancuerna'],
    mode: 'hypertrophy',
    muscleGroup: 'Tríceps (Cabeza Larga)',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Baja profundo detrás de la nuca manteniendo costillas cerradas.',
  },
  {
    id: 'hyp_triceps_pushdown',
    name: 'Extensión de Tríceps en Polea Alta',
    aliases: ['triceps polea', 'jalon triceps', 'cuerda triceps', 'mecate triceps', 'pushdown', 'extensión de tríceps en polea alta (barra o cuerda)', 'pushdown triceps'],
    mode: 'hypertrophy',
    muscleGroup: 'Tríceps Lateral y Medial',
    defaultRestSeconds: 75,
    biomechanicalCue: 'Codos fijos al costado y bloqueo completo abajo.',
  },
  {
    id: 'hyp_jm_press_smith',
    name: 'JM Press en Multipower',
    aliases: ['jm press', 'fondos maquina', 'press cerrado triceps', 'jm press en multipower / fondos en máquina', 'fondos en maquina'],
    mode: 'hypertrophy',
    muscleGroup: 'Tríceps',
    defaultRestSeconds: 105,
    biomechanicalCue: 'Híbrido entre press cerrado y rompecráneos con gran carga mecánica.',
  },

  // ===================== HIPERTROFIA — PECTORAL =====================
  {
    id: 'hyp_incline_db_press',
    name: 'Press Inclinado con Mancuernas',
    aliases: ['pecho inclinado', 'banca inclinada mancuernas', 'incline press', 'press superior', 'press inclinado con mancuernas (30°)', 'press inclinado 30'],
    mode: 'hypertrophy',
    muscleGroup: 'Pectoral Superior',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Baja profundo estirando fibras claviculares con codos a 45-60°.',
  },
  {
    id: 'hyp_incline_barbell_press',
    name: 'Press Banca Inclinado con Barra',
    aliases: ['banca inclinada barra', 'press inclinado multipower', 'pecho superior barra', 'press banca inclinado con barra / smith'],
    mode: 'hypertrophy',
    muscleGroup: 'Pectoral Superior',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Toca la parte alta del pecho justo bajo las clavículas con control.',
  },
  {
    id: 'hyp_flat_bench_press',
    name: 'Press de Banca Plano',
    aliases: ['press de banca', 'bench press', 'pecho plano', 'banca plana', 'press banca plano con barra', 'press banca plano', 'press de banca plano'],
    mode: 'hypertrophy',
    muscleGroup: 'Pectoral Medio',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Escápulas retraídas contra el banco y excéntrica controlada de 2s.',
  },
  {
    id: 'hyp_flat_db_press',
    name: 'Press Plano con Mancuernas',
    aliases: ['pecho mancuernas', 'banca mancuernas', 'flat dumbbell press'],
    mode: 'hypertrophy',
    muscleGroup: 'Pectoral Medio',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Aprovecha el rango extra de estiramiento abajo frente a la barra.',
  },
  {
    id: 'hyp_chest_press_machine',
    name: 'Press de Pecho Convergente en Máquina',
    aliases: [
      'maquina pecho',
      'chest press',
      'hammer pecho',
      'press plano maquina',
      'press plano en maquina',
      'press pecho maquina',
      'press en maquina',
      'press horizontal maquina',
    ],
    mode: 'hypertrophy',
    muscleGroup: 'Pectoral',
    defaultRestSeconds: 105,
    biomechanicalCue: 'Estabilidad ideal para llegar a RIR 0-1 sin riesgo.',
  },
  {
    id: 'hyp_cable_crossover',
    name: 'Cruce de Poleas para Pectoral',
    aliases: ['cruces polea', 'cristos polea', 'cable fly', 'aperturas polea'],
    mode: 'hypertrophy',
    muscleGroup: 'Pectoral',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Abraza un árbol amplio y pausa 1s juntando los brazos frente al esternón.',
  },
  {
    id: 'hyp_pec_deck',
    name: 'Aperturas en Pec Deck',
    aliases: ['mariposa pecho', 'contractora pecho', 'cristos', 'aperturas pecho', 'flyes', 'aperturas en pec deck / cristos', 'pec deck'],
    mode: 'hypertrophy',
    muscleGroup: 'Pectoral',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Pecho alto sin despegar la espalda al abrir.',
  },
  {
    id: 'hyp_chest_dips',
    name: 'Fondos en Paralelas',
    aliases: ['fondos pecho', 'paralelas pecho', 'dips pecho', 'fondos en paralelas (énfasis pectoral)', 'fondos enfasis pectoral'],
    mode: 'hypertrophy',
    muscleGroup: 'Pectoral Inferior',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Inclina el torso 30° hacia adelante bajando a máximo estiramiento cómodo.',
  },

  // ===================== HIPERTROFIA — ESPALDA =====================
  {
    id: 'hyp_neutral_lat_pulldown',
    name: 'Jalón al Pecho Agarre Neutro',
    aliases: ['jalon pecho', 'polea al pecho', 'lat pulldown', 'jalon cerrado', 'jalon triangulo', 'jalón al pecho agarre neutro / cerrado', 'jalon neutro'],
    mode: 'hypertrophy',
    muscleGroup: 'Dorsal Ancho',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Lleva los codos pegados hacia la cadera.',
  },
  {
    id: 'hyp_wide_lat_pulldown',
    name: 'Jalón al Pecho Prono Ancho',
    aliases: ['jalon abierto', 'jalon dorsal', 'polea alta espalda', 'dominada polea'],
    mode: 'hypertrophy',
    muscleGroup: 'Espalda Alta / Dorsal',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Baja los hombros lejos de las orejas antes de tirar.',
  },
  {
    id: 'hyp_one_arm_db_row',
    name: 'Remo con Mancuerna a Una Mano',
    aliases: ['serrucho', 'remo serrucho', 'remo mancuerna', 'remo unilateral', 'remo con mancuerna a una mano (serrucho)'],
    mode: 'hypertrophy',
    muscleGroup: 'Dorsal Ancho',
    defaultRestSeconds: 105,
    biomechanicalCue: 'Traza un arco llevando la mancuerna hacia el bolsillo de la cadera.',
  },
  {
    id: 'hyp_pendlay_row',
    name: 'Remo Pendlay con Barra',
    aliases: ['remo barra', 'barbell row', 'remo 90 grados', 'remo inclinado', 'remo con barra ( inclinado / pendlay )', 'remo pendlay'],
    mode: 'hypertrophy',
    muscleGroup: 'Espalda Media / Dorsal',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Torso firme sin balancear la zona lumbar.',
  },
  {
    id: 'hyp_low_cable_row',
    name: 'Remo en Polea Baja',
    aliases: ['remo sentado', 'remo gironda', 'polea baja espalda', 'seated row', 'remo en polea baja (gironda)', 'gironda'],
    mode: 'hypertrophy',
    muscleGroup: 'Dorsal / Romboides',
    defaultRestSeconds: 105,
    biomechanicalCue: 'Deja estirar escápulas adelante con torso firme y retrae completo atrás.',
  },
  {
    id: 'hyp_chest_supported_row',
    name: 'Remo con Pecho Apoyado',
    aliases: ['remo t', 'remo en punta', 'remo pecho apoyado', 't bar row', 'hammer espalda', 'remo con pecho apoyado (t-bar / máquina)', 'remo t-bar', 'remo maquina apoyado'],
    mode: 'hypertrophy',
    muscleGroup: 'Espalda Alta / Trapecio Medio',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Codos abiertos a 60° para máxima densidad de espalda alta sin fatiga lumbar.',
  },
  {
    id: 'hyp_cable_pullover',
    name: 'Pullover en Polea Alta',
    aliases: ['pullover espalda', 'jalon brazos rectos', 'pull over'],
    mode: 'hypertrophy',
    muscleGroup: 'Dorsal Ancho',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Codos semirrígidos empujando la barra hacia los muslos.',
  },

  // ===================== HIPERTROFIA — BÍCEPS =====================
  {
    id: 'hyp_barbell_curl',
    name: 'Curl de Bíceps con Barra',
    aliases: ['curl barra', 'biceps barra', 'curl barra z', 'barbell curl', 'curl de bíceps con barra (recta o ez)', 'curl barra recta', 'curl barra ez'],
    mode: 'hypertrophy',
    muscleGroup: 'Bíceps Braquial',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Codos debajo de los hombros sin columpiar la cadera.',
  },
  {
    id: 'hyp_preacher_curl',
    name: 'Curl Predicador en Banco Scott',
    aliases: ['banco scott', 'predicador', 'scott curl', 'biceps predicador'],
    mode: 'hypertrophy',
    muscleGroup: 'Bíceps / Braquial',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Máxima tensión abajo: baja controlado hasta casi extender completo.',
  },
  {
    id: 'hyp_bayesian_curl',
    name: 'Curl Bayesiano en Polea',
    aliases: ['curl polea espalda', 'biceps estiramiento', 'bayesian', 'curl polea baja', 'curl bayesiano en polea baja', 'curl bayesiano'],
    mode: 'hypertrophy',
    muscleGroup: 'Bíceps (Cabeza Larga)',
    defaultRestSeconds: 90,
    biomechanicalCue: 'De espaldas a la polea con el codo detrás del torso.',
  },
  {
    id: 'hyp_incline_db_curl',
    name: 'Curl Inclinado con Mancuernas',
    aliases: ['biceps banco inclinado', 'curl mancuernas sentado', 'curl alterno'],
    mode: 'hypertrophy',
    muscleGroup: 'Bíceps',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Gira el meñique hacia afuera al subir.',
  },
  {
    id: 'hyp_hammer_curl',
    name: 'Curl Martillo con Mancuernas',
    aliases: ['martillo biceps', 'hammer curl', 'antebrazo biceps', 'curl martillo (mancuernas o cuerda)', 'curl martillo', 'martillo mancuernas'],
    mode: 'hypertrophy',
    muscleGroup: 'Braquiorradial / Braquial',
    defaultRestSeconds: 75,
    biomechanicalCue: 'Agarre neutro estricto para grosor de brazo y antebrazo.',
  },

  // ===================== HIPERTROFIA — PIERNA Y CORE =====================
  {
    id: 'hyp_hack_squat',
    name: 'Sentadilla Hack Profunda',
    aliases: ['jaca', 'sentadilla jaca', 'hack squat', 'maquina hack'],
    mode: 'hypertrophy',
    muscleGroup: 'Cuádriceps',
    defaultRestSeconds: 150,
    biomechanicalCue: 'Baja profundo hasta tocar gemelo con isquio sin despegar cadera del respaldo.',
  },
  {
    id: 'hyp_leg_press_45',
    name: 'Prensa de Piernas 45°',
    aliases: ['prensa', 'leg press', 'prensa inclinada'],
    mode: 'hypertrophy',
    muscleGroup: 'Cuádriceps / Glúteo',
    defaultRestSeconds: 150,
    biomechanicalCue: 'No bloquees rodillas de golpe arriba y baja profundo con sacro pegado.',
  },
  {
    id: 'hyp_leg_extension_stretch',
    name: 'Extensión de Cuádriceps en Máquina',
    aliases: ['sillon cuadriceps', 'camilla cuadriceps', 'leg extension', 'extensiones pierna'],
    mode: 'hypertrophy',
    muscleGroup: 'Cuádriceps (Recto Femoral)',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Inclina el respaldo ligeramente atrás para estirar más el recto femoral.',
  },
  {
    id: 'hyp_bulgarian_split_squat',
    name: 'Sentadilla Búlgara',
    aliases: ['bulgaras', 'estocada bulgara', 'split squat'],
    mode: 'hypertrophy',
    muscleGroup: 'Cuádriceps / Glúteo',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Baja vertical para cuádriceps o inclina levemente el torso para glúteo.',
  },
  {
    id: 'hyp_walking_lunges',
    name: 'Zancadas con Mancuernas',
    aliases: ['estocadas', 'zancadas', 'desplantes', 'lunges', 'zancadas / estocadas con mancuernas', 'estocadas con mancuernas', 'walking lunges'],
    mode: 'hypertrophy',
    muscleGroup: 'Glúteo / Cuádriceps',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Paso controlado empujando fuerte con toda la planta del pie delantero.',
  },
  {
    id: 'hyp_seated_leg_curl',
    name: 'Curl Femoral Sentado',
    aliases: ['isquios sentado', 'camilla sentado', 'femoral sentado', 'leg curl sentado'],
    mode: 'hypertrophy',
    muscleGroup: 'Isquiosurales',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Genera ~50% más crecimiento que el tumbado gracias al estiramiento de cadera.',
  },
  {
    id: 'hyp_lying_leg_curl',
    name: 'Curl Femoral Tumbado',
    aliases: ['camilla femoral', 'isquios acostado', 'femoral acostado'],
    mode: 'hypertrophy',
    muscleGroup: 'Isquiosurales',
    defaultRestSeconds: 90,
    biomechanicalCue: 'Mantén la cadera pegada al acolchado durante toda la subida.',
  },
  {
    id: 'hyp_rdl',
    name: 'Peso Muerto Rumano',
    aliases: ['rumano', 'pmr', 'peso muerto piernas semirrigidas', 'isquios barra', 'peso muerto rumano (rdl)', 'rdl'],
    mode: 'hypertrophy',
    muscleGroup: 'Isquiosurales / Glúteo',
    defaultRestSeconds: 150,
    biomechanicalCue: 'Empuja la cadera hacia atrás rozando los muslos con la barra.',
  },
  {
    id: 'hyp_hip_thrust',
    name: 'Hip Thrust con Barra',
    aliases: ['puente gluteo', 'empuje cadera', 'gluteo barra', 'hip thrust / empuje de cadera', 'empuje de cadera', 'hip thrust'],
    mode: 'hypertrophy',
    muscleGroup: 'Glúteo Mayor',
    defaultRestSeconds: 120,
    biomechanicalCue: 'Tibia vertical arriba y pausa 1s apretando glúteos sin arquear espalda baja.',
  },
  {
    id: 'hyp_standing_calf_raise',
    name: 'Elevación de Talones de Pie',
    aliases: ['gemelos', 'pantorrilla de pie', 'pantorrillas', 'calf raise', 'elevación de talones de pie (gemelos)', 'gemelos de pie'],
    mode: 'hypertrophy',
    muscleGroup: 'Gastrocnemio / Pantorrilla',
    defaultRestSeconds: 75,
    biomechanicalCue: 'Pausa 2s abajo en máximo estiramiento; ahí ocurre la mayor hipertrofia de gemelo.',
  },
  {
    id: 'hyp_seated_calf_raise',
    name: 'Elevación de Talones Sentado',
    aliases: ['costurera', 'soleo', 'pantorrilla sentado', 'gemelo sentado', 'elevación de talones sentado (sóleo / costurera)'],
    mode: 'hypertrophy',
    muscleGroup: 'Sóleo',
    defaultRestSeconds: 75,
    biomechanicalCue: 'Rango completo sin rebotar.',
  },
  {
    id: 'hyp_cable_crunch',
    name: 'Crunch Abdominal en Polea Alta',
    aliases: ['abdominales polea', 'abs con peso', 'crunch arrodillado'],
    mode: 'hypertrophy',
    muscleGroup: 'Recto Abdominal',
    defaultRestSeconds: 75,
    biomechanicalCue: 'Enrolla la columna acercando costillas a la pelvis.',
  },

  // ===================== FUERZA (POWERLIFTING / STRENGTH) =====================
  {
    id: 'str_low_bar_squat',
    name: 'Sentadilla Barra Baja',
    aliases: ['sentadilla libre', 'back squat', 'sentadilla pesada', 'squat', 'sentadilla barra baja (low bar squat)', 'low bar squat'],
    mode: 'strength',
    muscleGroup: 'Pierna / Cadena Posterior',
    defaultRestSeconds: 240,
    biomechanicalCue: 'Presión abdominal 360° antes de bajar y empuje decidido al salir del hoyo.',
  },
  {
    id: 'str_high_bar_squat',
    name: 'Sentadilla Barra Alta',
    aliases: ['sentadilla olimpica', 'sentadilla barra alta', 'sentadilla barra alta (high bar squat)', 'high bar squat'],
    mode: 'strength',
    muscleGroup: 'Cuádriceps / Core',
    defaultRestSeconds: 210,
    biomechanicalCue: 'Torso erguido y rodillas pasando la punta del pie.',
  },
  {
    id: 'str_front_squat',
    name: 'Sentadilla Frontal con Barra',
    aliases: ['front squat', 'sentadilla delantera'],
    mode: 'strength',
    muscleGroup: 'Cuádriceps / Espalda Alta',
    defaultRestSeconds: 210,
    biomechanicalCue: 'Codos altos apuntando al frente durante todo el recorrido.',
  },
  {
    id: 'str_comp_bench_press',
    name: 'Press de Banca Competición',
    aliases: ['press banca fuerza', 'banca pausa', 'bench press powerlifting', 'press de banca competición (pausa 1s)', 'pausa 1s', 'banca competicion'],
    mode: 'strength',
    muscleGroup: 'Pectoral / Tríceps / Deltoide',
    defaultRestSeconds: 240,
    biomechanicalCue: 'Pausa inmóvil en el pecho y empuje explosivo con pies firmes en el suelo.',
  },
  {
    id: 'str_close_grip_bench',
    name: 'Press de Banca Agarre Cerrado',
    aliases: ['banca cerrada', 'close grip bench', 'press cerrado barra'],
    mode: 'strength',
    muscleGroup: 'Tríceps / Pectoral',
    defaultRestSeconds: 180,
    biomechanicalCue: 'Manos al ancho de los hombros para potenciar el bloqueo.',
  },
  {
    id: 'str_spoto_press',
    name: 'Spoto Press',
    aliases: ['banca spoto', 'press pausa aire', 'spoto press (pausa a 2cm del pecho)'],
    mode: 'strength',
    muscleGroup: 'Pectoral / Control',
    defaultRestSeconds: 210,
    biomechanicalCue: 'Frena a 2cm del esternón manteniendo tensión total 1.5s.',
  },
  {
    id: 'str_conv_deadlift',
    name: 'Peso Muerto Convencional',
    aliases: ['deadlift', 'peso muerto', 'pm convencional'],
    mode: 'strength',
    muscleGroup: 'Cadena Posterior Completa',
    defaultRestSeconds: 270,
    biomechanicalCue: 'Tensa la barra antes de despegar ("saca el slack") y empuja el piso.',
  },
  {
    id: 'str_sumo_deadlift',
    name: 'Peso Muerto Sumo',
    aliases: ['sumo deadlift', 'pm sumo'],
    mode: 'strength',
    muscleGroup: 'Aductores / Glúteo / Cuádriceps',
    defaultRestSeconds: 270,
    biomechanicalCue: 'Abre rodillas hacia afuera acercando la cadera a la barra.',
  },
  {
    id: 'str_paused_deadlift',
    name: 'Peso Muerto con Pausa',
    aliases: ['paused deadlift', 'peso muerto pausa rodilla'],
    mode: 'strength',
    muscleGroup: 'Cadena Posterior',
    defaultRestSeconds: 240,
    biomechanicalCue: 'Pausa 2s a mitad de tibia manteniendo la espalda neutra.',
  },
  {
    id: 'str_strict_ohp',
    name: 'Press Militar Estricto de Pie',
    aliases: ['press militar', 'ohp estricto', 'overhead press fuerza', 'militar pesado', 'press militar estricto de pie (ohp fuerza)'],
    mode: 'strength',
    muscleGroup: 'Hombros / Tríceps / Core',
    defaultRestSeconds: 210,
    biomechanicalCue: 'Glúteos apretados y mete la cabeza bajo la barra al pasar la frente.',
  },
  {
    id: 'str_push_press',
    name: 'Push Press Olímpico',
    aliases: ['press con impulso', 'empuje de fuerza'],
    mode: 'strength',
    muscleGroup: 'Potencia Hombros / Piernas',
    defaultRestSeconds: 180,
    biomechanicalCue: 'Flexión corta de rodillas y extensión explosiva.',
  },
  {
    id: 'str_weighted_pullup_heavy',
    name: 'Dominadas Lastradas Pesadas',
    aliases: ['dominadas con peso', 'weighted pullups', 'dominada fuerza', 'dominadas lastradas pesadas (1-5rm)'],
    mode: 'strength',
    muscleGroup: 'Dorsal / Bíceps',
    defaultRestSeconds: 210,
    biomechanicalCue: 'Desde brazos estirados hasta pasar la barbilla con limpieza.',
  },
  {
    id: 'str_weighted_dip_heavy',
    name: 'Fondos Lastrados Pesados',
    aliases: ['fondos con lastre', 'weighted dips', 'paralelas pesadas', 'fondos lastrados pesados (1-5rm)'],
    mode: 'strength',
    muscleGroup: 'Pectoral / Tríceps',
    defaultRestSeconds: 210,
    biomechanicalCue: 'Baja rompiendo los 90° en el codo y bloquea firme arriba.',
  },
  {
    id: 'str_rack_pulls',
    name: 'Rack Pulls',
    aliases: ['peso muerto parcial', 'jalon desde pines', 'rack pulls (bloqueo pesado)', 'bloqueo pesado'],
    mode: 'strength',
    muscleGroup: 'Trapecio / Erectores / Agarre',
    defaultRestSeconds: 210,
    biomechanicalCue: 'Barra bajo la rodilla; bloquea cadera sin echar la espalda atrás.',
  },
  {
    id: 'str_pause_squat',
    name: 'Sentadilla con Pausa',
    aliases: ['paused squat', 'sentadilla pausada', 'sentadilla con pausa (2s abajo)', 'pause squat'],
    mode: 'strength',
    muscleGroup: 'Cuádriceps / Core',
    defaultRestSeconds: 240,
    biomechanicalCue: 'Mantén el abdomen duro sin relajarte en el fondo.',
  },
  {
    id: 'str_barbell_row_heavy',
    name: 'Remo con Barra Pesado',
    aliases: ['remo fuerza', 'heavy row'],
    mode: 'strength',
    muscleGroup: 'Espalda Alta',
    defaultRestSeconds: 180,
    biomechanicalCue: 'Tracción explosiva hacia el abdomen.',
  },

  // ===================== CALISTENIA =====================
  {
    id: 'cal_bar_muscle_up',
    name: 'Muscle-Up en Barra',
    aliases: ['muscle up', 'subida a barra', 'mu barra'],
    mode: 'calisthenics',
    muscleGroup: 'Potencia Tracción + Empuje',
    defaultRestSeconds: 180,
    calisthenicsSubType: 'dynamic',
    biomechanicalCue: 'Tracciona en curva rodeando la barra hacia la cadera.',
  },
  {
    id: 'cal_ring_muscle_up',
    name: 'Muscle-Up en Anillas',
    aliases: ['ring muscle up', 'mu anillas'],
    mode: 'calisthenics',
    muscleGroup: 'Anillas / Transición',
    defaultRestSeconds: 180,
    calisthenicsSubType: 'dynamic',
    biomechanicalCue: 'Agarre falso firme desde el inicio.',
  },
  {
    id: 'cal_strict_pullups',
    name: 'Dominadas Pronas Estrictas',
    aliases: ['dominadas', 'pull ups', 'pullups', 'barra fija'],
    mode: 'calisthenics',
    muscleGroup: 'Dorsal / Escápulas',
    defaultRestSeconds: 135,
    calisthenicsSubType: 'dynamic',
    biomechanicalCue: 'Cuerpo en línea firme llevando el pecho a la barra.',
  },
  {
    id: 'cal_chin_ups',
    name: 'Dominadas Supinas',
    aliases: ['dominadas biceps', 'chinups', 'chin ups', 'supinas', 'dominadas supinas (chin-ups)', 'chin-ups'],
    mode: 'calisthenics',
    muscleGroup: 'Bíceps / Dorsal',
    defaultRestSeconds: 135,
    calisthenicsSubType: 'dynamic',
    biomechanicalCue: 'Palmas hacia ti; rango completo desde abajo.',
  },
  {
    id: 'cal_parallel_dips',
    name: 'Fondos en Paralelas',
    aliases: ['fondos', 'dips', 'paralelas', 'fondos en paralelas (dips)'],
    mode: 'calisthenics',
    muscleGroup: 'Pectoral / Tríceps',
    defaultRestSeconds: 120,
    calisthenicsSubType: 'dynamic',
    biomechanicalCue: 'Bloquea codos arriba deprimiendo hombros.',
  },
  {
    id: 'cal_ring_dips',
    name: 'Fondos en Anillas',
    aliases: ['ring dips', 'anillas fondos', 'fondos en anillas (rto)', 'rto'],
    mode: 'calisthenics',
    muscleGroup: 'Pectoral / Estabilizadores',
    defaultRestSeconds: 150,
    calisthenicsSubType: 'dynamic',
    biomechanicalCue: 'Rota las anillas 45° hacia afuera al terminar cada subida.',
  },
  {
    id: 'cal_hspu',
    name: 'Handstand Push-Ups',
    aliases: ['hspu', 'flexiones vertical', 'flexiones parado de manos', 'handstand push-ups (flexiones en pino)', 'flexiones en pino'],
    mode: 'calisthenics',
    muscleGroup: 'Hombros / Equilibrio',
    defaultRestSeconds: 150,
    calisthenicsSubType: 'dynamic',
    biomechanicalCue: 'La cabeza baja adelante de las manos formando un triángulo.',
  },
  {
    id: 'cal_pseudo_planche_pushup',
    name: 'Pseudo Planche Push-Ups',
    aliases: ['flexiones plancha', 'pppu', 'lagartijas planche'],
    mode: 'calisthenics',
    muscleGroup: 'Deltoide Anterior',
    defaultRestSeconds: 135,
    calisthenicsSubType: 'dynamic',
    biomechanicalCue: 'Adelanta hombros respecto a muñecas y empuja escápulas al techo.',
  },
  {
    id: 'cal_pistol_squat',
    name: 'Pistol Squat',
    aliases: ['sentadilla una pierna', 'pistol', 'pistol squat (sentadilla a 1 pierna)', 'sentadilla a 1 pierna'],
    mode: 'calisthenics',
    muscleGroup: 'Pierna Unilateral',
    defaultRestSeconds: 120,
    calisthenicsSubType: 'dynamic',
    biomechanicalCue: 'Baja en 3 segundos controlando la rodilla.',
  },
  {
    id: 'cal_dragon_flag_dyn',
    name: 'Dragon Flag',
    aliases: ['bandera dragon', 'abdomen bruce lee'],
    mode: 'calisthenics',
    muscleGroup: 'Core Completo',
    defaultRestSeconds: 135,
    calisthenicsSubType: 'dynamic',
    biomechanicalCue: 'Cuerpo recto desde hombros hasta pies sin doblar la cadera.',
  },
  {
    id: 'cal_front_lever_iso',
    name: 'Front Lever',
    aliases: ['front lever', 'plancha frontal dorsal', 'front lever (isométrico)', 'front lever isometrico'],
    mode: 'calisthenics',
    muscleGroup: 'Dorsal / Core',
    defaultRestSeconds: 180,
    calisthenicsSubType: 'isometric',
    biomechanicalCue: 'Codos bloqueados y depresión escapular máxima.',
  },
  {
    id: 'cal_planche_iso',
    name: 'Planche',
    aliases: ['full planche', 'straddle planche', 'tuck planche', 'plancha calistenia', 'planche (plancha isométrica)', 'plancha isometrica'],
    mode: 'calisthenics',
    muscleGroup: 'Deltoide Anterior / Serrato',
    defaultRestSeconds: 180,
    calisthenicsSubType: 'isometric',
    biomechanicalCue: 'Codos rectos al 100% y máxima protracción escapular.',
  },
  {
    id: 'cal_back_lever_iso',
    name: 'Back Lever',
    aliases: ['back lever', 'back lever (isométrico)', 'back lever isometrico'],
    mode: 'calisthenics',
    muscleGroup: 'Deltoide / Bíceps / Core',
    defaultRestSeconds: 150,
    calisthenicsSubType: 'isometric',
    biomechanicalCue: 'Glúteos apretados manteniendo línea horizontal.',
  },
  {
    id: 'cal_lsit_iso',
    name: 'L-Sit',
    aliases: ['escuadra', 'l sit', 'abdomen paralelas', 'l-sit / v-sit (isométrico)', 'v-sit', 'l-sit'],
    mode: 'calisthenics',
    muscleGroup: 'Core / Tríceps / Psoas',
    defaultRestSeconds: 120,
    calisthenicsSubType: 'isometric',
    biomechanicalCue: 'Aleja los hombros de las orejas empujando fuerte hacia abajo.',
  },
  {
    id: 'cal_handstand_iso',
    name: 'Handstand Libre',
    aliases: ['pino', 'parado de manos', 'vertical', 'handstand libre (pino / parada de manos)', 'parada de manos'],
    mode: 'calisthenics',
    muscleGroup: 'Equilibrio / Hombros',
    defaultRestSeconds: 90,
    calisthenicsSubType: 'isometric',
    biomechanicalCue: 'Equilibra presionando el suelo con las yemas de los dedos.',
  },
  {
    id: 'cal_human_flag_iso',
    name: 'Bandera Humana',
    aliases: ['bandera', 'human flag', 'bandera humana / human flag'],
    mode: 'calisthenics',
    muscleGroup: 'Oblicuos / Hombros',
    defaultRestSeconds: 150,
    calisthenicsSubType: 'isometric',
    biomechanicalCue: 'El brazo de abajo empuja recto y el de arriba tracciona.',
  },

  // ===================== HYROX =====================
  {
    id: 'hyx_1000m_run',
    name: '1000m Run',
    aliases: ['1km hyrox', 'carrera hyrox', 'run 1000', '1000m run (carrera comprometida)', 'carrera comprometida'],
    mode: 'hyrox',
    muscleGroup: 'Aeróbico Híbrido',
    defaultRestSeconds: 30,
    hyroxDefault: { station: '1000m Run', distanceMeters: 1000, reps: 0, implementWeightKg: 0 },
  },
  {
    id: 'hyx_skierg_1000',
    name: 'SkiErg 1000m',
    aliases: ['ski erg', 'esqui 1000m'],
    mode: 'hyrox',
    muscleGroup: 'Dorsal / Core / Aeróbico',
    defaultRestSeconds: 45,
    hyroxDefault: { station: 'SkiErg', distanceMeters: 1000, reps: 0, implementWeightKg: 0 },
  },
  {
    id: 'hyx_sled_push_50',
    name: 'Sled Push 50m',
    aliases: ['trineo empuje', 'empuje trineo', 'sled push', 'sled push 50m (empuje de trineo)', 'empuje de trineo'],
    mode: 'hyrox',
    muscleGroup: 'Cuádriceps / Potencia',
    defaultRestSeconds: 60,
    hyroxDefault: { station: 'Sled Push', distanceMeters: 50, reps: 0, implementWeightKg: 152 },
  },
  {
    id: 'hyx_sled_pull_50',
    name: 'Sled Pull 50m',
    aliases: ['trineo tiron', 'jalar trineo', 'sled pull', 'sled pull 50m (arrastre de trineo)', 'arrastre de trineo'],
    mode: 'hyrox',
    muscleGroup: 'Cadena Posterior / Agarre',
    defaultRestSeconds: 60,
    hyroxDefault: { station: 'Sled Pull', distanceMeters: 50, reps: 0, implementWeightKg: 103 },
  },
  {
    id: 'hyx_burpee_broad_jumps_80',
    name: 'Burpee Broad Jumps 80m',
    aliases: ['burpees salto largo', 'burpees hyrox'],
    mode: 'hyrox',
    muscleGroup: 'Capacidad Anaeróbica',
    defaultRestSeconds: 60,
    hyroxDefault: { station: 'Burpee Broad Jumps', distanceMeters: 80, reps: 0, implementWeightKg: 0 },
  },
  {
    id: 'hyx_row_1000',
    name: 'Row 1000m',
    aliases: ['remo 1000m', 'rowing hyrox', 'concept 2', 'row 1000m (remo concept2)', 'remo concept2'],
    mode: 'hyrox',
    muscleGroup: 'Cadena Posterior / Aeróbico',
    defaultRestSeconds: 45,
    hyroxDefault: { station: 'Rowing', distanceMeters: 1000, reps: 0, implementWeightKg: 0 },
  },
  {
    id: 'hyx_farmers_carry_200',
    name: 'Farmers Carry 200m',
    aliases: ['paseo granjero', 'caminata pesas', 'farmers walk', 'farmers carry 200m (paseo del granjero)', 'paseo del granjero'],
    mode: 'hyrox',
    muscleGroup: 'Agarre / Trapecio / Core',
    defaultRestSeconds: 45,
    hyroxDefault: { station: 'Farmers Carry', distanceMeters: 200, reps: 0, implementWeightKg: 48 },
  },
  {
    id: 'hyx_sandbag_lunges_100',
    name: 'Sandbag Lunges 100m',
    aliases: ['estocadas saco', 'lunges hyrox', 'sandbag lunges 100m (zancadas con saco)', 'zancadas con saco'],
    mode: 'hyrox',
    muscleGroup: 'Glúteo / Cuádriceps',
    defaultRestSeconds: 60,
    hyroxDefault: { station: 'Sandbag Lunges', distanceMeters: 100, reps: 0, implementWeightKg: 20 },
  },
  {
    id: 'hyx_wall_balls_100',
    name: 'Wall Balls 100',
    aliases: ['balon pared', 'lanzamiento balon', 'wallballs', 'wall balls (100 lanzamientos)', '100 lanzamientos'],
    mode: 'hyrox',
    muscleGroup: 'Piernas / Hombros',
    defaultRestSeconds: 60,
    hyroxDefault: { station: 'Wall Balls', distanceMeters: 0, reps: 100, implementWeightKg: 6 },
  },

  // ===================== CARDIO POLIMÓRFICO =====================
  {
    id: 'crd_jr_freestyle',
    name: 'Salto de Cuerda Libre',
    aliases: ['comba', 'saltar la cuerda', 'cuerda basico', 'jump rope', 'soga', 'salto de cuerda (velocidad / libre)', 'cuerda velocidad'],
    mode: 'cardio',
    cardioDiscipline: 'jumprope',
    muscleGroup: 'Pantorrilla / Reactividad',
    defaultRestSeconds: 45,
  },
  {
    id: 'crd_jr_double_unders',
    name: 'Salto de Cuerda Double Unders',
    aliases: ['saltos dobles', 'du', 'comba doble', 'salto de cuerda (double unders / dobles)', 'dobles cuerda'],
    mode: 'cardio',
    cardioDiscipline: 'jumprope',
    muscleGroup: 'Potencia Elástica Aquiles',
    defaultRestSeconds: 60,
  },
  {
    id: 'crd_jr_boxer_step',
    name: 'Salto de Cuerda Boxer Step',
    aliases: ['paso boxeador', 'cuerda boxeo', 'salto de cuerda (boxer step)', 'boxer step'],
    mode: 'cardio',
    cardioDiscipline: 'jumprope',
    muscleGroup: 'Resistencia Aeróbica',
    defaultRestSeconds: 45,
  },
  {
    id: 'crd_jr_tabata_hiit',
    name: 'Salto de Cuerda Tabata',
    aliases: ['cuerda intervalos', 'hiit comba', 'salto de cuerda (tabata hiit)', 'tabata hiit cuerda'],
    mode: 'cardio',
    cardioDiscipline: 'jumprope',
    muscleGroup: 'VO2 Max',
    defaultRestSeconds: 30,
  },
  {
    id: 'crd_run_zone2',
    name: 'Trote Continuo Zona 2',
    aliases: ['correr', 'running suave', 'trotar', 'fondo aerobico'],
    mode: 'cardio',
    cardioDiscipline: 'running',
    muscleGroup: 'Base Aeróbica Mitocondrial',
    defaultRestSeconds: 0,
  },
  {
    id: 'crd_run_intervals_400',
    name: 'Running Series de 400m',
    aliases: ['sprints 400', 'pasadas pista', 'series velocidad', 'running series de 400m (vo2 max)', 'vo2 max series'],
    mode: 'cardio',
    cardioDiscipline: 'running',
    muscleGroup: 'Potencia Aeróbica',
    defaultRestSeconds: 90,
  },
  {
    id: 'crd_run_tempo',
    name: 'Tempo Run',
    aliases: ['carrera umbral', 'ritmo controlado', 'tempo run (ritmo de umbral)', 'ritmo de umbral'],
    mode: 'cardio',
    cardioDiscipline: 'running',
    muscleGroup: 'Umbral de Lactato',
    defaultRestSeconds: 60,
  },
  {
    id: 'crd_run_incline_treadmill',
    name: 'Caminadora con Inclinación',
    aliases: ['cinta correr', 'caminata inclinada', 'treadmill', 'caminadora / cinta con inclinación', 'cinta con inclinacion'],
    mode: 'cardio',
    cardioDiscipline: 'running',
    muscleGroup: 'Cardio Bajo Impacto',
    defaultRestSeconds: 60,
  },
  {
    id: 'crd_swim_100_free',
    name: 'Natación Series 100m Crol',
    aliases: ['nadar crol', 'piscina libre', 'swimming'],
    mode: 'cardio',
    cardioDiscipline: 'swimming',
    muscleGroup: 'Capacidad Pulmonar / Dorsal',
    defaultRestSeconds: 30,
  },
  {
    id: 'crd_swim_continuous_free',
    name: 'Natación Continua Libre',
    aliases: ['nado continuo', 'pileta'],
    mode: 'cardio',
    cardioDiscipline: 'swimming',
    muscleGroup: 'Aeróbico Sin Impacto',
    defaultRestSeconds: 45,
  },
  {
    id: 'crd_swim_breaststroke',
    name: 'Natación Pecho',
    aliases: ['nado pecho', 'braza', 'natación pecho / braza', 'natacion braza'],
    mode: 'cardio',
    cardioDiscipline: 'swimming',
    muscleGroup: 'Pectoral / Aductores',
    defaultRestSeconds: 30,
  },
  {
    id: 'crd_cyc_zone2_erg',
    name: 'Bicicleta Estática Zona 2',
    aliases: ['bici fija', 'spinning', 'ciclo indoor', 'bicicleta estática / ciclismo zona 2', 'ciclismo zona 2'],
    mode: 'cardio',
    cardioDiscipline: 'cycling',
    muscleGroup: 'Cuádriceps / Base Aeróbica',
    defaultRestSeconds: 0,
  },
  {
    id: 'crd_cyc_watt_sprints',
    name: 'Sprints en AirBike',
    aliases: ['airbike', 'assault bike', 'echo bike', 'bici sprints', 'sprints en airbike / assault bike'],
    mode: 'cardio',
    cardioDiscipline: 'cycling',
    muscleGroup: 'Potencia Anaeróbica',
    defaultRestSeconds: 90,
  },
  {
    id: 'crd_cyc_stairmaster',
    name: 'Escaladora StairMaster',
    aliases: ['escalera infinita', 'stairmaster', 'escaladora / stairmaster'],
    mode: 'cardio',
    cardioDiscipline: 'cycling',
    muscleGroup: 'Glúteo / Cardio',
    defaultRestSeconds: 0,
  },
];

/**
 * Strips accents/diacritics, punctuation and normalizes whitespace.
 */
export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Character bigram Dice similarity (0..1) so typos like "rompe cabesa" or "pres frances" still match accurately.
 */
function diceSimilarity(a: string, b: string): number {
  const s1 = a.replace(/\s+/g, '');
  const s2 = b.replace(/\s+/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bg = s1.slice(i, i + 2);
    bigrams1.set(bg, (bigrams1.get(bg) ?? 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.slice(i, i + 2);
    const count = bigrams1.get(bg) ?? 0;
    if (count > 0) {
      bigrams1.set(bg, count - 1);
      intersection += 1;
    }
  }

  return (2 * intersection) / (s1.length - 1 + (s2.length - 1));
}

export interface SmartSearchMatch {
  item: ExerciseCatalogItem;
  score: number;
  matchedAlias?: string;
  isCrossMode: boolean;
}

/**
 * Context-Aware + Synonym-Aware + Fuzzy Exercise Search Engine.
 * - Matches standard names, regional Spanish/English gym nicknames ("rompe cabezas" -> "Press Francés"),
 *   compound vs split words ("rompecabezas" == "rompe cabezas"), and typos.
 * - Prioritizes the active block's mode, while also surfacing strong matches from other modes so no exercise
 *   like "Press Militar" or "Dominadas" is ever hidden from the user.
 */
export function smartSearchExercises(
  catalog: ExerciseCatalogItem[],
  activeMode: TrainingMode,
  rawQuery: string,
  cardioDiscipline?: CardioDiscipline
): SmartSearchMatch[] {
  const qNorm = normalizeSearchText(rawQuery);
  const qCompact = qNorm.replace(/\s+/g, '');
  const qTokens = qNorm ? qNorm.split(' ').filter((t) => t.length >= 2) : [];

  // Default browsing when query is empty: show active mode exercises cleanly
  if (!qNorm) {
    return catalog
      .filter((item) => {
        if (item.mode !== activeMode) return false;
        if (activeMode === 'cardio' && cardioDiscipline && item.cardioDiscipline !== cardioDiscipline) {
          return false;
        }
        return true;
      })
      .slice(0, 30)
      .map((item) => ({ item, score: 100, isCrossMode: false }));
  }

  const scored: SmartSearchMatch[] = [];

  for (const item of catalog) {
    const isSameMode = item.mode === activeMode;
    const isSameDiscipline =
      activeMode !== 'cardio' || !cardioDiscipline || item.cardioDiscipline === cardioDiscipline;

    const nameNorm = normalizeSearchText(item.name);
    const nameCompact = nameNorm.replace(/\s+/g, '');
    const muscleNorm = normalizeSearchText(item.muscleGroup);

    let bestScore = 0;
    let matchedAlias: string | undefined;

    // 1. Direct name matching
    if (nameNorm === qNorm || nameCompact === qCompact) {
      bestScore = 120;
    } else if (nameNorm.startsWith(qNorm)) {
      bestScore = 105;
    } else if (nameNorm.includes(qNorm) || nameCompact.includes(qCompact)) {
      bestScore = 92;
    }

    // 2. Token coverage on name + muscle
    if (qTokens.length > 0) {
      const combined = `${nameNorm} ${muscleNorm}`;
      const matchedCount = qTokens.filter((tok) => combined.includes(tok)).length;
      if (matchedCount === qTokens.length) {
        bestScore = Math.max(bestScore, 86);
      } else if (matchedCount > 0) {
        bestScore = Math.max(bestScore, (matchedCount / qTokens.length) * 62);
      }
    }

    // 3. Alias / Synonym matching (e.g. "rompe cabezas" -> "rompecabezas" -> Press Francés)
    if (item.aliases?.length) {
      for (const alias of item.aliases) {
        const aNorm = normalizeSearchText(alias);
        const aCompact = aNorm.replace(/\s+/g, '');

        let aliasScore = 0;
        if (aNorm === qNorm || aCompact === qCompact) {
          aliasScore = 115;
        } else if (aNorm.includes(qNorm) || qNorm.includes(aNorm) || aCompact.includes(qCompact)) {
          aliasScore = 96;
        } else if (qTokens.length > 0 && qTokens.every((t) => aNorm.includes(t))) {
          aliasScore = 90;
        } else {
          const sim = diceSimilarity(qCompact, aCompact);
          if (sim >= 0.68) {
            aliasScore = Math.round(sim * 95);
          }
        }

        if (aliasScore > bestScore) {
          bestScore = aliasScore;
          if (!nameNorm.includes(qNorm)) {
            matchedAlias = alias;
          }
        }
      }
    }

    // 4. Fuzzy typo tolerance against exercise name
    if (bestScore < 70 && qCompact.length >= 4) {
      const nameSim = diceSimilarity(qCompact, nameCompact);
      if (nameSim >= 0.62) {
        bestScore = Math.max(bestScore, Math.round(nameSim * 88));
      }
      // Also check individual words in name for typo tolerance
      for (const word of nameNorm.split(' ')) {
        if (word.length >= 4) {
          const wSim = diceSimilarity(qCompact, word);
          if (wSim >= 0.74) {
            bestScore = Math.max(bestScore, Math.round(wSim * 85));
          }
        }
      }
    }

    // Mode relevance weighting
    if (bestScore >= 52) {
      let finalScore = bestScore;
      if (isSameMode && isSameDiscipline) {
        finalScore += 25;
      } else if (isSameMode) {
        finalScore += 12;
      } else if (bestScore < 78) {
        // Only surface cross-mode results when they are strong matches
        continue;
      }

      scored.push({
        item,
        score: finalScore,
        matchedAlias,
        isCrossMode: !isSameMode,
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 25);
}

export interface GhostPerformance {
  dateIso: string;
  summaryLine: string;
  lastExercise: WorkoutExercise;
}

export function getLastExerciseGhost(
  sessions: WorkoutSession[],
  catalogId: string,
  exerciseName: string
): GhostPerformance | null {
  const normalizedTarget = normalizeSearchText(exerciseName);
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime()
  );

  for (const session of sorted) {
    for (const block of session.blocks) {
      for (const ex of block.exercises) {
        const matchesId = ex.catalogId === catalogId;
        const matchesName = normalizeSearchText(ex.name) === normalizedTarget;
        if (!matchesId && !matchesName) continue;

        const summary = summarizeExerciseLastPerformance(ex);
        if (summary) {
          return {
            dateIso: session.dateIso,
            summaryLine: summary,
            lastExercise: ex,
          };
        }
      }
    }
  }
  return null;
}

export function summarizeExerciseLastPerformance(ex: WorkoutExercise): string | null {
  if (ex.mode === 'hypertrophy' && ex.hypertrophySets?.length) {
    const effective = ex.hypertrophySets.filter((s) => s.setType !== 'Calentamiento');
    const pool = effective.length ? effective : ex.hypertrophySets;
    const best = [...pool].sort(
      (a, b) => b.weightKg * (1 + b.reps / 30) - a.weightKg * (1 + a.reps / 30)
    )[0];
    if (!best) return null;
    return `${best.weightKg}kg × ${best.reps} reps @ RIR ${best.rir}`;
  }

  if (ex.mode === 'strength' && ex.strengthSets?.length) {
    const best = [...ex.strengthSets].sort(
      (a, b) => b.weightKg * (1 + b.reps / 30) - a.weightKg * (1 + a.reps / 30)
    )[0];
    if (!best) return null;
    return `${best.weightKg}kg × ${best.reps} reps @ RPE ${best.rpe}`;
  }

  if (ex.mode === 'calisthenics') {
    if (ex.calisthenicsSubType === 'isometric' && ex.calisthenicsIsometricSets?.length) {
      const best = [...ex.calisthenicsIsometricSets].sort(
        (a, b) => b.actualSeconds - a.actualSeconds
      )[0];
      if (!best) return null;
      const weightTag = best.addedWeightKg > 0 ? ` (+${best.addedWeightKg}kg)` : '';
      return `${best.progression} · ${best.actualSeconds}s${weightTag}`;
    }
    if (ex.calisthenicsDynamicSets?.length) {
      const best = [...ex.calisthenicsDynamicSets].sort((a, b) => b.reps - a.reps)[0];
      if (!best) return null;
      const weightTag =
        best.addedWeightKg > 0
          ? `+${best.addedWeightKg}kg × `
          : best.addedWeightKg < 0
            ? `${best.addedWeightKg}kg asist. × `
            : '';
      return `${best.variation}: ${weightTag}${best.reps} reps @ RIR ${best.rir}`;
    }
  }

  if (ex.mode === 'hyrox' && ex.hyroxSets?.length) {
    const best = ex.hyroxSets[0];
    if (!best) return null;
    const metric = best.distanceMeters > 0 ? `${best.distanceMeters}m` : `${best.reps} reps`;
    return `${best.station} (${metric}) · ${formatMmSs(best.splitSeconds)}`;
  }

  if (ex.mode === 'cardio') {
    if (ex.cardioDiscipline === 'jumprope' && ex.jumpRopeSets?.length) {
      const best = [...ex.jumpRopeSets].sort(
        (a, b) =>
          calculateJumpRopeRpm(b.jumps, b.durationSeconds) -
          calculateJumpRopeRpm(a.jumps, a.durationSeconds)
      )[0];
      if (!best) return null;
      const rpm = calculateJumpRopeRpm(best.jumps, best.durationSeconds);
      return `${best.jumps} saltos en ${formatMmSs(best.durationSeconds)} (${rpm} RPM)`;
    }
    if (ex.cardioDiscipline === 'running' && ex.runningSets?.length) {
      const best = ex.runningSets[0];
      if (!best) return null;
      const pace = calculateRunningPaceSecPerKm(best.distanceMeters, best.durationSeconds);
      return `${best.distanceMeters}m en ${formatMmSs(best.durationSeconds)} (${formatMmSs(pace)}/km)`;
    }
    if (ex.cardioDiscipline === 'swimming' && ex.swimmingSets?.length) {
      const best = ex.swimmingSets[0];
      if (!best) return null;
      const dist = best.poolLengthMeters * best.laps;
      const pace = calculateSwimPaceSecPer100m(dist, best.durationSeconds);
      return `${dist}m ${best.stroke} (${formatMmSs(pace)}/100m)`;
    }
    if (ex.cardioDiscipline === 'cycling' && ex.cyclingSets?.length) {
      const best = ex.cyclingSets[0];
      if (!best) return null;
      return `${formatMmSs(best.durationSeconds)} · ${best.avgWatts}W`;
    }
  }

  return null;
}

export function cloneSetsFromGhost(
  ghost: WorkoutExercise | undefined,
  makeId: () => string,
  targetMode?: TrainingMode
): Partial<WorkoutExercise> {
  if (!ghost) return {};
  if (targetMode && ghost.mode !== targetMode) return {};

  if (ghost.hypertrophySets?.length) {
    return {
      hypertrophySets: ghost.hypertrophySets.map(
        (s): HypertrophySet => ({ ...s, id: makeId(), completed: false })
      ),
    };
  }
  if (ghost.strengthSets?.length) {
    return {
      referenceOneRmKg: ghost.referenceOneRmKg,
      strengthSets: ghost.strengthSets.map(
        (s): StrengthSet => ({ ...s, id: makeId(), completed: false })
      ),
    };
  }
  if (ghost.calisthenicsIsometricSets?.length) {
    return {
      calisthenicsSubType: 'isometric',
      calisthenicsIsometricSets: ghost.calisthenicsIsometricSets.map(
        (s): CalisthenicsIsometricSet => ({ ...s, id: makeId(), completed: false })
      ),
    };
  }
  if (ghost.calisthenicsDynamicSets?.length) {
    return {
      calisthenicsSubType: 'dynamic',
      calisthenicsDynamicSets: ghost.calisthenicsDynamicSets.map(
        (s): CalisthenicsDynamicSet => ({ ...s, id: makeId(), completed: false })
      ),
    };
  }
  if (ghost.hyroxSets?.length) {
    return {
      hyroxSets: ghost.hyroxSets.map((s): HyroxSet => ({ ...s, id: makeId(), completed: false })),
    };
  }
  if (ghost.jumpRopeSets?.length) {
    return {
      cardioDiscipline: 'jumprope',
      jumpRopeSets: ghost.jumpRopeSets.map(
        (s): JumpRopeSet => ({ ...s, id: makeId(), completed: false })
      ),
    };
  }
  if (ghost.runningSets?.length) {
    return {
      cardioDiscipline: 'running',
      runningSets: ghost.runningSets.map(
        (s): RunningSet => ({ ...s, id: makeId(), completed: false })
      ),
    };
  }
  if (ghost.swimmingSets?.length) {
    return {
      cardioDiscipline: 'swimming',
      swimmingSets: ghost.swimmingSets.map(
        (s): SwimmingSet => ({ ...s, id: makeId(), completed: false })
      ),
    };
  }
  if (ghost.cyclingSets?.length) {
    return {
      cardioDiscipline: 'cycling',
      cyclingSets: ghost.cyclingSets.map(
        (s): CyclingSet => ({ ...s, id: makeId(), completed: false })
      ),
    };
  }

  return {};
}
