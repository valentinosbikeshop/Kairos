import { TrainingMode } from '@/types/kairos';

export interface ScienceTip {
  id: string;
  mode: TrainingMode;
  topic: 'Hipertrofia' | 'Fuerza' | 'Calistenia' | 'Hyrox & Cardio' | 'Recuperación';
  title: string;
  shortPreview: string;
  plainExplanation: string;
  practicalAction: string;
  citation: string;
  year: number;
}

export interface KairosQuote {
  id: string;
  text: string;
  principle: string;
}

export const SCIENCE_TIPS: ScienceTip[] = [
  {
    id: 'sci_1',
    mode: 'hypertrophy',
    topic: 'Hipertrofia',
    title: 'La parte donde el músculo se estira produce más crecimiento',
    shortPreview: 'No recortes la bajada: la mitad estirada del movimiento genera más músculo.',
    plainExplanation:
      'Investigaciones recientes compararon hacer repeticiones completas frente a trabajar la zona donde el músculo está más estirado (abajo en press de pecho, sentadilla, curl predicador o tríceps tras nuca). El músculo creció igual o incluso más enfatizando esa posición estirada.',
    practicalAction:
      'Controla la bajada 2 segundos y jamás recortes la parte baja del ejercicio por mover más kilos.',
    citation: 'Wolf et al. · Sports Medicine',
    year: 2023,
  },
  {
    id: 'sci_2',
    mode: 'hypertrophy',
    topic: 'Hipertrofia',
    title: '¿Hace falta llegar al fallo total en todas las series?',
    shortPreview: 'Quedarte a 1–2 repeticiones del fallo da casi el mismo músculo con menos fatiga.',
    plainExplanation:
      'Un gran análisis demostró que terminar la serie guardando 1 o 2 repeticiones en el tanque (RIR 1–2) estimula prácticamente la misma hipertrofia que fallar por completo, pero reduce drásticamente el daño muscular y te permite rendir mejor en las siguientes series.',
    practicalAction:
      'Trabaja la mayoría de tus series en RIR 1–2 y reserva el fallo total (RIR 0) solo para la última serie en máquinas o poleas seguras.',
    citation: 'Robinson et al. · Sports Medicine',
    year: 2024,
  },
  {
    id: 'sci_3',
    mode: 'hypertrophy',
    topic: 'Hipertrofia',
    title: 'Descansar menos de 90 segundos frena tus ganancias',
    shortPreview: 'Descansos de 2 minutos o más superan a los descansos cortos de 60s.',
    plainExplanation:
      'Aunque descansar 45–60s "quema" más, esa quemazón es fatiga local que te obliga a bajar peso o repeticiones en la siguiente serie. Descansar al menos 2 minutos permite recuperar fuerza real y acumular más volumen de calidad.',
    practicalAction:
      'Usa 120–150s de descanso en ejercicios compuestos y 75–90s únicamente en músculos pequeños aislados.',
    citation: 'Singer et al. · Frontiers in Sports',
    year: 2024,
  },
  {
    id: 'sci_4',
    mode: 'hypertrophy',
    topic: 'Hipertrofia',
    title: 'El límite inteligente de series por sesión',
    shortPreview: 'Más de 10–12 series duras de un mismo músculo en un día da cada vez menos retorno.',
    plainExplanation:
      'El mayor meta-análisis sobre volumen mostró que cada serie extra sí suma algo de estímulo, pero con rendimientos decrecientes: pasar de 10 a 16 series en una sola sesión dispara la fatiga articular con mínima ganancia extra. Es mejor repartir ese volumen en 2 días a la semana.',
    practicalAction:
      'Haz entre 6 y 10 series intensas por grupo muscular en el día y divídelo en frecuencia 2 semanal.',
    citation: 'Pelland et al. · Sports Medicine (Preprint/Meta-regresión)',
    year: 2024,
  },
  {
    id: 'sci_5',
    mode: 'hypertrophy',
    topic: 'Hipertrofia',
    title: 'Empieza la rutina por el músculo que más quieres mejorar',
    shortPreview: 'Lo que entrenas primero crece y gana más fuerza, sea básico o accesorio.',
    plainExplanation:
      'Tu sistema nervioso está al 100% en los primeros 20 minutos del entrenamiento. Los estudios confirman que los ejercicios colocados al inicio progresan significativamente más, sin importar si son grandes (banca) o pequeños (brazos o deltoides).',
    practicalAction:
      'Si tus hombros o brazos están rezagados, colócalos en el Bloque 1 al menos una vez por semana.',
    citation: 'Nunes et al. · European Journal of Sport Science',
    year: 2021,
  },
  {
    id: 'sci_6',
    mode: 'hypertrophy',
    topic: 'Hipertrofia',
    title: 'Pesos libres vs. Máquinas: empate técnico para ganar músculo',
    shortPreview: 'Las máquinas construyen tanto músculo como las barras si entrenas intenso.',
    plainExplanation:
      'Al comparar directamente entrenamientos con barras/mancuernas frente a máquinas llevados cerca del fallo, el crecimiento muscular fue idéntico. Las barras dan más transferencia a coordinación libre; las máquinas permiten exprimir el músculo sin que falle antes el equilibrio o la espalda baja.',
    practicalAction:
      'Combina ambos: usa peso libre al inicio con frescura y máquinas/poleas para apretar a RIR 0–1 con total seguridad.',
    citation: 'Haugen et al. · BMC Sports Science, Medicine & Rehabilitation',
    year: 2023,
  },
  {
    id: 'sci_7',
    mode: 'hypertrophy',
    topic: 'Hipertrofia',
    title: 'Tríceps con codos arriba y femoral sentado ganan por goleada',
    shortPreview: 'La posición de tu hombro o cadera cambia hasta un 40% cuánto crece el músculo.',
    plainExplanation:
      'Extender el tríceps por encima de la cabeza (Katana / Copa) produjo ~40% más crecimiento que hacerlo solo con codos pegados al cuerpo. De igual forma, el curl femoral sentado superó ampliamente al tumbado porque estira el isquio desde la cadera.',
    practicalAction:
      'Incluye siempre al menos una variante sobre la cabeza para tríceps y prioriza curl sentado o peso muerto rumano para isquios.',
    citation: 'Maeo et al. · European Journal of Sport Science',
    year: 2023,
  },
  {
    id: 'sci_8',
    mode: 'strength',
    topic: 'Fuerza',
    title: 'Para Fuerza Máxima, entrenar lejos del fallo es superior',
    shortPreview: 'Dejar 2 a 4 repeticiones en reserva (RPE 7–8.5) mejora más el 1RM que fallar.',
    plainExplanation:
      'La fuerza máxima depende de mover cargas altas a la máxima velocidad posible. Llegar al fallo en sentadilla o peso muerto fríe tu sistema nervioso central durante días sin aportar fuerza extra frente a series explosivas a RPE 7.5–8.5.',
    practicalAction:
      'En el modo Fuerza mantente entre RPE 7.5 y 8.5, enfocándote en empujar la barra con máxima intención explosiva.',
    citation: 'Refalo et al. · Sports Medicine',
    year: 2023,
  },
  {
    id: 'sci_9',
    mode: 'strength',
    topic: 'Fuerza',
    title: 'Por qué necesitas 3 a 5 minutos de reloj entre series pesadas',
    shortPreview: 'Tu combustible explosivo (fosfocreatina) tarda 3–5 min en recargarse al 95%.',
    plainExplanation:
      'En levantamientos pesados (>82% de tu 1RM), el músculo usa fosfocreatina pura. A los 90 segundos apenas has recuperado un ~70%; a los 3–4 minutos superas el 90%. Entrar antes a la barra te obliga a fallar por falta de combustible químico, no de fuerza.',
    practicalAction:
      'Configura tu auto-descanso en 180s–300s en bloques de Fuerza y respeta el timer aunque sientas que ya respiras normal.',
    citation: 'Grgic et al. · Sports Medicine',
    year: 2022,
  },
  {
    id: 'sci_10',
    mode: 'strength',
    topic: 'Recuperación',
    title: 'Dormir poco reduce tu fuerza hoy mismo (y cómo ajustarlo)',
    shortPreview: 'Menos de 6 horas de sueño reduce repeticiones logradas y sube el esfuerzo percibido.',
    plainExplanation:
      'La restricción aguda de sueño disminuye la potencia máxima y hace que el mismo peso se sienta hasta 1 punto de RPE más pesado, especialmente en ejercicios compuestos de tarde.',
    practicalAction:
      'Si dormiste mal, guíate por el RPE/RIR del día en lugar de forzar un récord fijo en kilos: quita un 5% de peso y cumple limpio.',
    citation: 'Craven et al. · Sports Medicine',
    year: 2022,
  },
  {
    id: 'sci_11',
    mode: 'calisthenics',
    topic: 'Calistenia',
    title: 'Cómo construir fuerza real en Planche y Front Lever',
    shortPreview: 'Los isométricos en ángulos exigentes fortalecen tendones y transfieren fuerza ±15°.',
    plainExplanation:
      'La evidencia en entrenamiento isométrico muestra que sostener entre 70–85% de tu tiempo máximo (sin temblar perdiendo la postura) en series acumuladas de 8 a 15 segundos genera la mayor adaptación neural y rigidez tendinosa saludable.',
    practicalAction:
      'Si tu máximo en una progresión es 15s, haz series de 10–12s impecables con codos bloqueados en vez de 1 serie desarmándote.',
    citation: 'Lum & Barbosa · International Journal of Sports Medicine',
    year: 2022,
  },
  {
    id: 'sci_12',
    mode: 'cardio',
    topic: 'Hyrox & Cardio',
    title: 'Hacer cardio NO destruye tu músculo si lo ordenas bien',
    shortPreview: 'El "efecto interferencia" casi desaparece si haces el cardio después de las pesas.',
    plainExplanation:
      'Un meta-análisis actualizado confirmó que combinar pesas y cardio en la misma etapa NO frena la hipertrofia. Lo único que puede restar fuerza explosiva es correr agotado justo ANTES de levantar pesado.',
    practicalAction:
      'Apila tu bloque de Fuerza o Hipertrofia primero, y coloca el bloque de Salto de Cuerda o Running al final de la sesión.',
    citation: 'Schumann et al. · Sports Medicine',
    year: 2022,
  },
  {
    id: 'sci_13',
    mode: 'cardio',
    topic: 'Hyrox & Cardio',
    title: '5–10 minutos de Salto de Cuerda mejoran tu velocidad al correr',
    shortPreview: 'Saltar cuerda vuelve tu tendón de Aquiles un resorte más rápido y económico.',
    plainExplanation:
      'Incluir bloques breves de salto de cuerda varias veces por semana aumentó la rigidez reactiva del tobillo y redujo el costo de oxígeno al correr, mejorando marcas en 3km y 5km sin añadir desgaste excesivo.',
    practicalAction:
      'Salta sobre el metatarso a baja altura girando desde las muñecas (140–170 RPM) durante 3 a 5 rondas de 60–90s.',
    citation: 'García-Pinillos et al. / Earp et al. · Journal of Strength & Conditioning Research',
    year: 2023,
  },
  {
    id: 'sci_14',
    mode: 'hyrox',
    topic: 'Hyrox & Cardio',
    title: 'Dónde se gana o se pierde realmente una prueba Hyrox',
    shortPreview: 'Más del 50% del tiempo total es carrera bajo fatiga: salir a tope en SkiErg te hunde.',
    plainExplanation:
      'El primer análisis fisiológico directo en atletas de Hyrox mostró que la competición ocurre cerca del 85–90% de la frecuencia cardíaca máxima durante más de una hora. Quienes cruzan su umbral de lactato en las primeras 2 estaciones pierden minutos enteros en las carreras 5 a 8.',
    practicalAction:
      'Usa el SkiErg y Rowing a un ritmo controlado que te permita salir corriendo de inmediato en menos de 20s de Roxzone.',
    citation: 'Villaroel et al. · Frontiers in Physiology',
    year: 2025,
  },
  {
    id: 'sci_15',
    mode: 'hypertrophy',
    topic: 'Recuperación',
    title: 'Pausa de 2 segundos abajo para destrabar el crecimiento de gemelos',
    shortPreview: 'Rebotar en pantorrillas usa el tendón como elástico y le roba trabajo al músculo.',
    plainExplanation:
      'El tendón de Aquiles está diseñado para devolver energía gratis cuando rebotas. Al pausar 2 segundos abajo en máximo estiramiento, esa energía elástica se disipa y las fibras del gemelo se ven obligadas a hacer todo el trabajo real.',
    practicalAction:
      'Baja todo lo que dé tu tobillo, cuenta "1, 2" inmóvil abajo en cada repetición y sube controlado.',
    citation: 'Kassiano et al. · Journal of Strength & Conditioning Research',
    year: 2023,
  },
];

export const KAIROS_QUOTES: KairosQuote[] = [
  {
    id: 'q1',
    text: 'El hierro no escucha excusas ni promesas; solo responde a la constancia en silencio.',
    principle: 'Constancia',
  },
  {
    id: 'q2',
    text: 'La disciplina comienza justo en el instante en que desaparecen las ganas.',
    principle: 'Templanza',
  },
  {
    id: 'q3',
    text: 'Forja tu cuerpo con la paciencia de quien talla piedra: sin prisa y sin pausa.',
    principle: 'Paciencia',
  },
  {
    id: 'q4',
    text: 'Cada serie ejecutada con rigor hoy es una deuda menos con quien quieres llegar a ser.',
    principle: 'Propósito',
  },
  {
    id: 'q5',
    text: 'No entrenes para impresionar la mirada ajena; entrena para sostener tu propia palabra.',
    principle: 'Integridad',
  },
  {
    id: 'q6',
    text: 'El cansancio pasa en horas; el orgullo de haber cumplido permanece.',
    principle: 'Firmeza',
  },
  {
    id: 'q7',
    text: 'Domina el descanso con la misma seriedad con la que dominas el esfuerzo.',
    principle: 'Equilibrio',
  },
  {
    id: 'q8',
    text: 'Un día ordinario cumplido con excelencia vale más que diez planes perfectos sin empezar.',
    principle: 'Ejecución',
  },
  {
    id: 'q9',
    text: 'La verdadera fuerza nace en la calma antes de levantar la carga.',
    principle: 'Serenidad',
  },
  {
    id: 'q10',
    text: 'Tu único rival real es la versión de ayer que intentó conformarse.',
    principle: 'Superación',
  },
];

export function getDailyMotivationalQuote(date = new Date()): KairosQuote {
  const daySeed =
    date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate();
  return KAIROS_QUOTES[daySeed % KAIROS_QUOTES.length];
}

export function getContextualTips(activeModes: TrainingMode[]): ScienceTip[] {
  if (!activeModes.length) return SCIENCE_TIPS;
  const matching = SCIENCE_TIPS.filter((t) => activeModes.includes(t.mode));
  return matching.length ? matching : SCIENCE_TIPS;
}
