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
  {
    id: 'sci_16',
    mode: 'hypertrophy',
    topic: 'Hipertrofia',
    title: 'El umbral de leucina: cuánta proteína por comida dispara el crecimiento',
    shortPreview: 'Repartir la proteína en 3 a 4 tomas de ~0.4g/kg supera a comerla toda junta.',
    plainExplanation:
      'Para activar al 100% el complejo celular mTORC1 responsable de sintetizar nueva proteína muscular, cada comida necesita alcanzar el "gatillo de leucina" (alrededor de 2.7 a 3g de leucina pura, equivalente a 30-40g de proteína de alta calidad). Ingerir menos no enciende el interruptor a máxima potencia, mientras que dividirlo uniformemente en el día mantiene la síntesis elevada.',
    practicalAction:
      'Divide tu ingesta diaria en 3–4 comidas principales con al menos 30–40g de proteína de alto valor biológico cada una.',
    citation: 'Morton et al. · British Journal of Sports Medicine / Phillips et al.',
    year: 2024,
  },
  {
    id: 'sci_17',
    mode: 'hypertrophy',
    topic: 'Hipertrofia',
    title: 'Rango de 6 a 30 repeticiones: idéntico músculo si el RIR es 1–2',
    shortPreview: 'Series pesadas de 8 reps o ligeras de 25 reps construyen el mismo tejido.',
    plainExplanation:
      'Un hito en la fisiología del ejercicio demostró que series de 6, 12, 20 o hasta 30 repeticiones producen exactamente el mismo crecimiento muscular, siempre que la serie se lleve a 1 o 2 repeticiones del fallo (RIR 1–2). Las repeticiones pesadas fatigan más las articulaciones; las de más de 20 reps fatigan más el sistema cardiovascular.',
    practicalAction:
      'Usa 6–10 reps en ejercicios compuestos pesados (sentadilla, press) y 12–20 reps en aislamiento (elevaciones laterales, extensiones de tríceps).',
    citation: 'Schoenfeld, Grgic et al. · Journal of Strength and Conditioning Research',
    year: 2021,
  },
  {
    id: 'sci_18',
    mode: 'strength',
    topic: 'Fuerza',
    title: 'Pérdida de velocidad en la barra: parar al 20% supera al 40%',
    shortPreview: 'Detener la serie cuando la barra se frena un 20% duplica tus ganancias de fuerza real.',
    plainExplanation:
      'Los estudios de entrenamiento basado en velocidad (VBT) compararon frenar la serie cuando la velocidad decae un 20% (RIR 2–3) vs un 40% (llegar casi al fallo). El grupo del 20% ganó sustancialmente más fuerza máxima y potencia con la mitad de repeticiones totales y recuperándose 48 horas antes.',
    practicalAction:
      'En tus levantamientos principales de fuerza, detén la serie en cuanto sientas una pérdida visible de velocidad concéntrica.',
    citation: 'Pareja-Blanco et al. · Medicine & Science in Sports & Exercise',
    year: 2020,
  },
  {
    id: 'sci_19',
    mode: 'strength',
    topic: 'Fuerza',
    title: 'Maniobra de Valsalva y presión intra-abdominal 360°',
    shortPreview: 'Comprimir el core como un cilindro reduce hasta un 40% el estrés cortante en la columna.',
    plainExplanation:
      'El Dr. Stuart McGill demostró que respirar diafragmáticamente e inflar el abdomen 360° contra la pared abdominal (no solo empujando hacia adelante) crea una cámara hidráulica de presión intra-abdominal (IAP) que solidifica la columna lumbar y transfiere fuerza instantánea a las extremidades.',
    practicalAction:
      'Toma aire al diafragma antes de bajar la barra, contrae abdomen, oblicuos y espalda baja como si fueras a recibir un impacto, y exhala solo tras pasar el punto de estancamiento.',
    citation: 'McGill et al. · Spine & Clinical Biomechanics',
    year: 2022,
  },
  {
    id: 'sci_20',
    mode: 'calisthenics',
    topic: 'Calistenia',
    title: 'Tendones vs. Músculos: por qué la palanca recta exige 6 a 12 semanas',
    shortPreview: 'Los tendones se adaptan 3 veces más lento que el músculo: no aceleres la Planche.',
    plainExplanation:
      'En ejercicios gimnásticos con brazos rectos (Planche, Front Lever, Iron Cross), la fuerza de palanca recae directamente sobre el tendón del bíceps distal y los ligamentos del codo. Mientras el músculo se fortalece en 2 a 4 semanas, el colágeno del tendón requiere 6 a 12 semanas de remodelación biológica.',
    practicalAction:
      'No pases a una progresión más larga (ej. de Tuck a Advanced Tuck) hasta dominar 5 series limpias de 10-12s con codos bloqueados sin dolor articular.',
    citation: 'Low, Steven · Overcoming Gravity 2nd Edition / Couppé et al.',
    year: 2023,
  },
  {
    id: 'sci_21',
    mode: 'calisthenics',
    topic: 'Calistenia',
    title: 'Biomecánica escapular: protracción en Planche vs. retracción en Front Lever',
    shortPreview: 'La posición de tus escápulas determina si el ejercicio es estable o lesivo.',
    plainExplanation:
      'En Planche, la protracción máxima y depresión escapular activan el serrato anterior y protegen la articulación glenohumeral. Por el contrario, en Front Lever, la retracción activa y depresión escapular enganchan los romboides, trapecio inferior y dorsal ancho, evitando el colapso en cifosis torácica.',
    practicalAction:
      'En Planche empuja el suelo hacia abajo separando escápulas al máximo; en Front Lever junta las escápulas y saca pecho hacia la barra.',
    citation: 'Contreras, Schoenfeld & Suchomel · Sports Biomechanics',
    year: 2022,
  },
  {
    id: 'sci_22',
    mode: 'cardio',
    topic: 'Hyrox & Cardio',
    title: 'Entrenamiento Polarizado 80/20: por qué el 80% debe ser suave',
    shortPreview: 'Los atletas olímpicos de resistencia entrenan el 80% en Zona 2 y solo el 20% a tope.',
    plainExplanation:
      'El fisiólogo Stephen Seiler descubrió que acumular kilómetros a ritmo moderado o "medio duro" (Zona 3) crea fatiga nerviosa crónica sin aportar adaptaciones de élite. La distribución óptima es 80% del tiempo en Zona 2 regenerativa (conversacional) y 20% en intervalos de alta intensidad (Zona 4–5).',
    practicalAction:
      'Dedica 4 de cada 5 sesiones de carrera o cardio a un trote conversacional suave (RPE 3–4, respiración nasal) y reserva 1 sesión para series intensas.',
    citation: 'Seiler, S. · International Journal of Sports Physiology and Performance',
    year: 2023,
  },
  {
    id: 'sci_23',
    mode: 'cardio',
    topic: 'Hyrox & Cardio',
    title: 'Biogénesis mitocondrial y reciclaje de lactato en Zona 2',
    shortPreview: 'La Zona 2 enseña a tus fibras lentas a quemar grasa y devorar el lactato.',
    plainExplanation:
      'Las investigaciones del Dr. Iñigo San Millán evidencian que el ejercicio en Zona 2 estimula la producción de transportadores MCT-1 en las mitocondrias de fibras lentas. Esto no solo maximiza la oxidación de ácidos grasos (FATmax), sino que permite al cuerpo limpiar el lactato acumulado a ritmos más altos.',
    practicalAction:
      'Mantén entre 120 y 180 minutos acumulados a la semana en Zona 2 (60–70% de tu frecuencia cardíaca máxima).',
    citation: 'San Millán & Brooks · Sports Medicine',
    year: 2024,
  },
  {
    id: 'sci_24',
    mode: 'hyrox',
    topic: 'Hyrox & Cardio',
    title: 'La "Roxzone" en Hyrox: dónde se ganan 4 a 8 minutos sin quemar piernas',
    shortPreview: 'Caminar lento en la zona de transición cuesta más tiempo que ir 10s más rápido en carrera.',
    plainExplanation:
      'El análisis de telemetría de campeonatos mundiales de Hyrox indica que los competidores aficionados pierden entre 4 y 9 minutos exclusivamente dentro de la Roxzone (el área de paso entre estaciones), hidratándose o caminando sin rumbo. Los atletas de élite reducen su tiempo de transición a menos de 30 segundos por estación.',
    practicalAction:
      'Planifica tu entrada y salida de cada estación: memoriza tu calle, bebe agua en movimiento y no te detengas a descansar dentro de la Roxzone.',
    citation: 'McIntyre, H. / Hyrox Analytics World Championships',
    year: 2025,
  },
  {
    id: 'sci_25',
    mode: 'strength',
    topic: 'Recuperación',
    title: 'Sueño de Ondas Lentas (Fase NREM 3) y la Hormona de Crecimiento',
    shortPreview: 'El 95% de la hormona de crecimiento diaria se libera durante el sueño profundo.',
    plainExplanation:
      'Durante las primeras 3 a 4 horas de sueño, el cerebro entra en sueño no-REM profundo (ondas delta). Es en esta ventana donde la glándula pituitaria secreta los pulsos principales de hormona de crecimiento (GH) e IGF-1, reparando micro-desgarros musculares y reforzando la matriz de colágeno.',
    practicalAction:
      'Duerme en una habitación fresca (18–20°C) y a oscuras, evitando pantallas 45 minutos antes para no suprimir la melatonina.',
    citation: 'Walker, Matthew · Why We Sleep / Leproult & Cauter · JAMA',
    year: 2022,
  },
  {
    id: 'sci_26',
    mode: 'hypertrophy',
    topic: 'Recuperación',
    title: 'Variabilidad de la Frecuencia Cardíaca (HRV): tu brújula del sistema nervioso',
    shortPreview: 'El valor RMSSD te dice con precisión matemática si hoy debes apretar o autorregular.',
    plainExplanation:
      'El parámetro RMSSD de la HRV mide la actividad del nervio vago (sistema parasimpático). Un RMSSD por debajo de tu promedio semanal de 7 días, acompañado de pulsaciones en reposo elevadas, es síntoma inequívoco de sobrecarga del SNC, falta de descanso o estrés sistémico.',
    practicalAction:
      'Si tu RMSSD cae notablemente fuera de tu banda normal matutina, baja 1 serie por ejercicio o quédate en RIR 3 en lugar de forzar récords.',
    citation: 'Altini, M. & Plews, D. · Sensors / Sports Medicine Open',
    year: 2024,
  },
  {
    id: 'sci_27',
    mode: 'cardio',
    topic: 'Recuperación',
    title: 'Sodio y osmolaridad: por qué el agua sola agota en entrenamientos largos',
    shortPreview: 'Perder sodio reduce el volumen plasmático y dispara tus pulsaciones cardíacas.',
    plainExplanation:
      'El sudor no es solo agua: contiene entre 500 y 1500mg de sodio por litro. Beber agua desmineralizada pura durante sesiones intensas diluye la sangre (hiponatremia relativa), haciendo que el corazón deba latir más rápido para bombear la misma cantidad de oxígeno (deriva cardíaca).',
    practicalAction:
      'En entrenamientos de más de 60 minutos o en clima caluroso, añade 500–800mg de sodio elemental por litro de líquido ingerido.',
    citation: 'Galpin, Andy · Human Performance Lab / Baker, L. B. · Sports Medicine',
    year: 2024,
  },
  {
    id: 'sci_28',
    mode: 'hypertrophy',
    topic: 'Hipertrofia',
    title: 'Ratio Estímulo/Fatiga (SFR): entrena el músculo, no la espalda baja',
    shortPreview: 'Ejercicios con apoyo pectoral construyen la misma espalda con la mitad de fatiga axial.',
    plainExplanation:
      'El concepto de SFR (Stimulus to Fatigue Ratio) acuñado por el Dr. Mike Israetel evalúa cuánto crecimiento genera un ejercicio comparado con la fatiga del sistema nervioso central y articular que produce. Un remo con apoyo en banco estimula el dorsal y trapecio al 100% sin agotar los erectores espinales, permitiendo rendir mejor en sentadilla al día siguiente.',
    practicalAction:
      'Reemplaza remos pesados libres por variantes con soporte en pecho (T-Bar row apoyado o seal row) si tu fatiga lumbar frena tu progreso.',
    citation: 'Israetel, M. & Helms, E. · Scientific Principles of Hypertrophy',
    year: 2024,
  },
  {
    id: 'sci_29',
    mode: 'calisthenics',
    topic: 'Calistenia',
    title: 'Regla del 70–80% en isométricos para construir fuerza sin romper técnica',
    shortPreview: 'Hacer series al 80% de tu aguante máximo acumula más volumen de alta calidad.',
    plainExplanation:
      'Llevar un sostenimiento isométrico (como Front Lever o L-Sit) al colapso total provoca que los últimos 2–3 segundos se ejecuten con pérdida de alineación escapular y compensación lumbar. Trabajar al 70–80% del tiempo máximo permite realizar 4 a 6 series técnicamente perfectas.',
    practicalAction:
      'Si tu máximo es 10 segundos, realiza 4 series de 7 a 8 segundos con escápulas de acero y descansos de 2 minutos.',
    citation: 'Lum & Barbosa · International Journal of Sports Medicine',
    year: 2022,
  },
  {
    id: 'sci_30',
    mode: 'strength',
    topic: 'Fuerza',
    title: 'Periodización DUP (Ondulante Diaria) para romper estancamientos',
    shortPreview: 'Variar la carga y repeticiones en la misma semana supera a los esquemas lineales fijos.',
    plainExplanation:
      'En levantadores intermedios y avanzados, cambiar el estímulo dentro de la misma semana (ej. Lunes hipertrofia a 8 reps, Miércoles potencia a 3 reps veloces, Viernes fuerza pesada a 4 reps) estimula diferentes adaptaciones neuromusculares sin saturar el sistema nervioso con la misma intensidad monotemática.',
    practicalAction:
      'Estructura tus días de un mismo básico en: Día A (Volumen moderado), Día B (Velocidad explosiva al 70%) y Día C (Carga máxima al 85%+).',
    citation: 'Zourdos, Nuckols et al. · Journal of Strength and Conditioning Research',
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
