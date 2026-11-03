import { ExerciseCatalogItem, TrainingMode, UserProfile, UserRoutine, WorkoutSession } from '@/types/kairos';
import { BUILTIN_EXERCISES } from '@/lib/exerciseDatabase';
import { resolveExerciseIntelligently } from '@/lib/exerciseClassifierEngine';
import { getProfileAge } from '@/lib/formatters';

export interface AiChatContext {
  userName?: string;
  userAge?: number;
  userWeightKg?: number;
  userHeightCm?: number;
  userGoal?: string;
  experienceLevel?: string;
  routineName?: string;
  routineDaysCount?: number;
  activeWorkoutTitle?: string;
  activeWorkoutExerciseNames?: string[];
  recentSessionsCount?: number;
}

export interface AiActionSuggestion {
  id: string;
  label: string;
  type: 'add_to_active_workout' | 'add_to_routine' | 'start_rest_timer' | 'view_biomechanics';
  payload: {
    exerciseName?: string;
    catalogId?: string;
    mode?: TrainingMode;
    restSeconds?: number;
    muscleGroup?: string;
    sets?: number;
    reps?: number;
  };
}

export interface AiChatMessageResponse {
  content: string;
  suggestedActions: AiActionSuggestion[];
  confidence: number;
}

/**
 * Searches the query and response text for exercises mentioned in the catalog
 * and creates high-value actionable buttons.
 */
export function extractActionSuggestionsFromText(
  aiText: string,
  userQuery: string
): AiActionSuggestion[] {
  const suggestions: AiActionSuggestion[] = [];
  const textToScan = `${userQuery} \n ${aiText}`;

  // Find mentioned exercises
  const foundExercises = new Map<string, ExerciseCatalogItem>();

  for (const ex of BUILTIN_EXERCISES) {
    // Check main name
    const nameRegex = new RegExp(`\\b${escapeRegExp(ex.name)}\\b`, 'i');
    if (nameRegex.test(textToScan)) {
      foundExercises.set(ex.id, ex);
      continue;
    }

    // Check key aliases
    if (ex.aliases?.length) {
      for (const alias of ex.aliases) {
        if (alias.length >= 4) {
          const aliasRegex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i');
          if (aliasRegex.test(textToScan)) {
            foundExercises.set(ex.id, ex);
            break;
          }
        }
      }
    }
  }

  // Create action buttons for up to 3 detected exercises
  let count = 0;
  for (const ex of foundExercises.values()) {
    if (count >= 3) break;

    suggestions.push({
      id: `act_add_workout_${ex.id}`,
      label: `⚡ Añadir "${ex.name}" a mi entrenamiento de hoy`,
      type: 'add_to_active_workout',
      payload: {
        exerciseName: ex.name,
        catalogId: ex.id,
        mode: ex.mode,
        muscleGroup: ex.muscleGroup,
        restSeconds: ex.defaultRestSeconds,
        sets: 3,
        reps: 10,
      },
    });

    suggestions.push({
      id: `act_add_routine_${ex.id}`,
      label: `📋 Añadir "${ex.name}" a mi rutina base`,
      type: 'add_to_routine',
      payload: {
        exerciseName: ex.name,
        catalogId: ex.id,
        mode: ex.mode,
        muscleGroup: ex.muscleGroup,
        restSeconds: ex.defaultRestSeconds,
        sets: 3,
        reps: 10,
      },
    });

    count++;
  }

  // Check if a rest period was mentioned (e.g. "descanso de 2 minutos", "descansa 90 segundos", "120s")
  const restSecMatch = textToScan.match(/\b(?:descans[oa](?:r)?\s+(?:de\s+)?)(\d{2,3})\s*(?:s|seg(?:undos)?)\b/i);
  const restMinMatch = textToScan.match(/\b(?:descans[oa](?:r)?\s+(?:de\s+)?)(\d(?:\.5)?)\s*min(?:utos)?\b/i);

  if (restSecMatch) {
    const sec = parseInt(restSecMatch[1], 10);
    if (sec >= 30 && sec <= 300) {
      suggestions.push({
        id: `act_rest_${sec}`,
        label: `⏱️ Iniciar descanso de ${sec} segundos`,
        type: 'start_rest_timer',
        payload: { restSeconds: sec },
      });
    }
  } else if (restMinMatch) {
    const mins = parseFloat(restMinMatch[1]);
    const sec = Math.round(mins * 60);
    if (sec >= 30 && sec <= 300) {
      suggestions.push({
        id: `act_rest_${sec}`,
        label: `⏱️ Iniciar descanso de ${mins} min (${sec}s)`,
        type: 'start_rest_timer',
        payload: { restSeconds: sec },
      });
    }
  }

  return suggestions;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Built-in peer-reviewed scientific response engine.
 * Used when offline or when GEMINI_API_KEY is not configured.
 * Covers Hypertrophy Biomechanics, Progressive Overload, Nutrition, Calisthenics, and Hyrox.
 */
export async function generateScientificAiResponse(
  query: string,
  context: AiChatContext
): Promise<AiChatMessageResponse> {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const weightKg = context.userWeightKg || 75;
  const proteinMin = Math.round(weightKg * 1.6);
  const proteinMax = Math.round(weightKg * 2.2);
  const creatineGrams = 5;
  const waterLiters = (weightKg * 0.04).toFixed(1);

  // 1. PROTEÍNA Y NUTRICIÓN
  if (/\b(?:proteina|cuanta proteina|macros|gramos de proteina|nutricion|dieta|calorias|superavit|deficit)\b/i.test(q)) {
    let content = `### Prescripción Nutricional Basada en Evidencia\n\n`;

    if (/\b(?:proteina|cuanta proteina)\b/i.test(q)) {
      content += `Para maximizar la síntesis proteica muscular (MPS) y la hipertrofia según tu peso actual (**${weightKg} kg**), la evidencia científica (*Morton et al., 2018; ISSN Position Stand*) recomienda:\n\n` +
        `- **Rango Óptimo:** **${proteinMin}g a ${proteinMax}g de proteína al día** (1.6 a 2.2 g por kg de peso corporal).\n` +
        `- **Distribución:** Dividida en 3 a 5 tomas de entre **${Math.round(weightKg * 0.4)}g y ${Math.round(weightKg * 0.55)}g** cada 3–4 horas para saturar el umbral de leucina (~3g).\n` +
        `- **Fuentes de Alto Valor Biológico (DIAAS):** Pollo, huevos enteros, pescado azul, carne magra, aislado de suero (whey), requesón o combinación de legumbres con cereales si eres vegano.\n\n` +
        `**Hidratación celular:** Se recomienda un consumo base de **${waterLiters} litros de agua diarios** para mantener la volumización celular muscular.`;
    } else if (/\b(?:creatina)\b/i.test(q)) {
      content += `### Suplementación con Creatina Monohidrato (*Kreider et al., ISSN*)\n\n` +
        `- **Dosis Diaria:** **${creatineGrams}g al día** (o 0.07g/kg), todos los días sin necesidad de descansos ni fases de carga.\n` +
        `- **Mecanismo:** Incrementa los depósitos de fosfocreatina intramuscular en un 15–25%, mejorando la resíntesis de ATP en series de alta intensidad (RIR 0–2).\n` +
        `- **Momento de ingesta:** Es de efecto acumulativo, pero consumirla post-entreno con carbohidratos o proteínas optimiza ligeramente su absorción mediada por insulina.`;
    } else {
      content += `Para optimizar tu composición corporal (*Helms et al., 2014*):\n\n` +
        `- **Volumen / Superávit Limpio:** +250 a +350 kcal sobre tu mantenimiento (ganancia de 0.25–0.5% del peso corporal semanal) para minimizar adiposidad.\n` +
        `- **Definición / Déficit:** -300 a -500 kcal (pérdida de 0.5–1% semanal), elevando la proteína a **${Math.round(weightKg * 2.2)}g/día** para preservar tejido magro.\n` +
        `- **Grasas esenciales:** Mínimo 0.7–1.0 g/kg para mantener niveles óptimos de testosterona y salud hormonal.`;
    }

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query),
      confidence: 96,
    };
  }

  // 2. SOBRECARGA PROGRESIVA Y RIR/RPE
  if (/\b(?:sobrecarga progresiva|rir|rpe|al fallo|fallo muscular|progresar|estancado|estancamiento)\b/i.test(q)) {
    const content = `### Principio de Sobrecarga Progresiva & Proximidad al Fallo (*Beardsley, 2020; Robinson et al., 2024*)\n\n` +
      `Para generar tensión mecánica máxima (el motor primario del crecimiento muscular), debes aplicar estas reglas en **KAIROS**:\n\n` +
      `1. **Proximidad al Fallo (RIR 1–2):** Las repeticiones verdaderamente estimulantes son las últimas 4–5 previas al fallo concéntrico (cuando la velocidad de la barra desciende involuntariamente a pesar del máximo esfuerzo).\n` +
      `2. **Doble Progresión:** En vez de subir peso a ciegas, define una ventana de repeticiones (ej. 8–12 reps). Mantén el peso constante hasta lograr 12 reps en todas las series efectivas con buena técnica; solo entonces sube la carga un 2.5–5%.\n` +
      `3. **Estandarización del Tempo:** Haz una fase excéntrica controlada de 2 a 3 segundos con pausa en máxima elongación. Si cambias el rango de movimiento para meter más peso, no hay sobrecarga real, solo trampa mecánica.\n\n` +
      `*Recomendación KAIROS:* Revisa tu gráfica de 1RM estimada y volumen semanal en la pestaña **Análisis** para asegurar que la curva sea ascendente.`;

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query),
      confidence: 95,
    };
  }

  // 3. CONSULTA ESPECÍFICA DE EJERCICIOS Y BIOMECÁNICA
  const candidateResolved = resolveExerciseIntelligently(query);
  if (candidateResolved.isCanonicalMatch || candidateResolved.confidence >= 65) {
    const exName = candidateResolved.canonicalName;
    const muscle = candidateResolved.muscleGroup;
    const rest = candidateResolved.defaultRestSeconds;

    const content = `### Biomecánica y Ejecución: **${exName}**\n\n` +
      `- **Grupo Muscular Principal:** ${muscle}\n` +
      `- **Patrón de Movimiento:** ${candidateResolved.movementPattern || 'Compuesto / Aislamiento de Alta Tensión'}\n` +
      `- **Descanso Fisiológico Recomendado:** **${rest} segundos** para resíntesis completa de ATP/fosfocreatina.\n` +
      `- **Clave Biomecánica (*Cue*):** ${candidateResolved.biomechanicalCue || 'Mantén la escápula estable y controla la fase excéntrica enfatizando el estiramiento muscular bajo carga.'}\n\n` +
      `**Recomendación de Programación en KAIROS:**\n` +
      `- **Series efectivas:** 3–4 series a **RIR 1–2**.\n` +
      `- **Tempo:** 3 segundos de bajada controlada, 1 segundo en estiramiento máximo, 1 segundo de empuje concéntrico explosivo.\n\n` +
      `*¿Quieres integrar este ejercicio a tu entrenamiento actual o a tu rutina base? Usa los botones a continuación:*`;

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query),
      confidence: 94,
    };
  }

  // 4. CALISTENIA / ISOMÉTRICOS
  if (/\b(?:calistenia|isometrico|front lever|planche|handstand|dominadas|fondos|l-sit)\b/i.test(q)) {
    const content = `### Ciencia de la Calistenia e Isométricos de Palanca (*Suchomel et al., 2018*)\n\n` +
      `- **Tensión Isométrica Superada:** Los isométricos en posiciones estiradas (como el soporte en fondos o la fase baja de dominadas) aumentan la rigidez del tendón y la hipertrofia sarcomérica en serie.\n` +
      `- **Tiempo Bajo Tensión (TUT):** Para ganar fuerza máxima de palanca (Front Lever, Planche), los bloques de sostén óptimos son de **6 a 12 segundos** por serie al 85–95% de esfuerzo percibido.\n` +
      `- **Descanso Nervioso:** Al involucrar gran estabilización neural y core, el descanso entre series de isométricos debe ser de **120 a 180 segundos**.\n\n` +
      `*En KAIROS:* Puedes utilizar el **Temporizador de Isométricos** en la sección *Timer* para cronometrar cada progresión con cuenta regresiva sonora sin perder el foco.`;

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query),
      confidence: 92,
    };
  }

  // 5. RESPUESTA CIENTÍFICA GENERAL Y HOLÍSTICA
  const content = `### Dictamen KAIROS · Fisiología del Ejercicio & Alto Rendimiento\n\n` +
    `Como asistente de inteligencia artificial científica de **KAIROS**, analizo tu consulta bajo los principios de la biomecánica aplicada, nutrición basada en evidencia y fisiología del esfuerzo:\n\n` +
    `1. **Estímulo Mecánico Óptimo:** Todo progreso hipertrófico y de fuerza requiere entrenar a menos de 3 repeticiones del fallo concéntrico (RIR 1–3), priorizando ejercicios con alta relación estímulo-fatiga (SFR).\n` +
    `2. **Volumen Semanal:** El rango fisiológico comprobado para la mayoría de grupos musculares se sitúa entre **10 y 20 series efectivas semanales** (*Schoenfeld et al., 2017*).\n` +
    `3. **Recuperación & Adaptación:** El músculo no crece durante el entrenamiento, sino durante el descanso profundo (7–9h de sueño) y con la disponibilidad de aminoácidos esenciales (**${proteinMin}–${proteinMax}g de proteína/día** para tus ${weightKg}kg).\n\n` +
    `*Puedes preguntarme sobre la técnica de cualquier ejercicio específico, cálculo exacto de tus macros, estructuración de tu rutina o mejoras para tu entrenamiento de hoy.*`;

  return {
    content,
    suggestedActions: extractActionSuggestionsFromText(content, query),
    confidence: 88,
  };
}
