import { NextRequest, NextResponse } from 'next/server';
import {
  AiChatContext,
  extractActionSuggestionsFromText,
  generateScientificAiResponse,
  parseAgenticUserCommand,
  stripActionTagsFromAiText,
} from '@/lib/aiChatEngine';
import { generateWithGeminiCascade } from '@/lib/geminiClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      messages?: { role: 'user' | 'assistant'; content: string }[];
      context?: AiChatContext;
    };

    const messages = body.messages || [];
    const context = body.context || {};
    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content?.trim() || '';

    if (!lastUserMessage) {
      return NextResponse.json(
        { ok: false, error: 'Mensaje de usuario vacío.' },
        { status: 400 }
      );
    }

    // 1. Direct Agentic Command Fast-Path (100% deterministic routine edits, day loading, profile updates)
    const directAgenticCommand = parseAgenticUserCommand(lastUserMessage, context);
    if (directAgenticCommand) {
      return NextResponse.json({
        ok: true,
        message: {
          role: 'assistant',
          content: directAgenticCommand.content,
        },
        suggestedActions: directAgenticCommand.suggestedActions,
        modelUsed: 'kairos-agentic-engine',
      });
    }

    const normQuery = lastUserMessage
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const isRoutineCleanupQuery =
      /\b(?:limpi(?:a|ar|ame)\s+(?:los\s+)?(?:nombres?|ejercicios?|mi\s+rutina)|quit(?:a|ar|ame)\s+(?:el\s+)?(?:texto\s+extra|ruido)|arregl(?:a|ar|ame)\s+(?:los\s+)?nombres?|nombre[s]?\s*de\s*ejercicio[s]?\s*sucio[s]?|texto\s*extra\s*en\s*mi\s*rutina)\b/i.test(
        normQuery
      );

    // 2. Routine Cleanup Fast-Path
    if (isRoutineCleanupQuery && context.routineDays && context.routineDays.length > 0) {
      const localCleanupResult = await generateScientificAiResponse(lastUserMessage, context);
      return NextResponse.json({
        ok: true,
        message: {
          role: 'assistant',
          content: localCleanupResult.content,
        },
        suggestedActions: localCleanupResult.suggestedActions,
        modelUsed: 'kairos-agentic-engine',
      });
    }

    // 3. High-Power Gemini AI Cascade with Anti-Saturation
    const recentHistoryText = messages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'Usuario' : 'Kairos Coach'}: ${m.content}`)
      .join('\n\n');

    const systemPrompt = `Eres KAIROS AI COACH, el consultor científico integral y agente interactivo de alto rendimiento integrado en la aplicación deportiva KAIROS.
Tienes dominio científico absoluto sobre:
1. Hipertrofia y Biomecánica Aplicada (Schoenfeld, Israetel, Helms, Beardsley, Wolf 2023, Robinson 2024: tensión mecánica en elongación, RIR 1–2 vs fallo, MEV/MAV/MRV de 10 a 20 series/semana, descansos de 2–3 min y ratio estímulo/fatiga SFR).
2. Fuerza Máxima y Powerlifting (Nuckols, Pareja-Blanco, McGill: pérdida de velocidad <20%, resíntesis de fosfocreatina de 3–5 min, RPE 7.5–8.5, periodización DUP y presión intra-abdominal Valsalva).
3. Calistenia y Gimnasia de Palanca (Steven Low, Lum & Barbosa: brazos de momento en Planche/Front Lever, remodelación tendinosa de 6–12 semanas, protracción/retracción escapular e isometría al 70–80% del tiempo máximo).
4. Deportes Híbridos, Hyrox y Resistencia (Seiler 80/20 polarizado, San Millán Zona 2 mitocondrial, Villaroel 2025 pacing en Hyrox y Roxzone, salto de cuerda pliométrico).
5. Recuperación, Sueño, HRV y Nutrición (Walker NREM 3 y REM, Altini RMSSD rolling baseline, Galpin hidratación con sodio, Morton 1.6–2.2g/kg de proteína y umbral de leucina).
6. Capacidad Agéntica Interactiva en KAIROS: puedes editar la rutina del usuario, añadir/eliminar/sustituir ejercicios, cargar días completos en el entrenamiento de hoy, actualizar el peso o parámetros del perfil e iniciar temporizadores.

Contexto actual del usuario en tiempo real:
- Nombre: ${context.userName || 'Atleta'}
- Peso corporal: ${context.userWeightKg ? `${context.userWeightKg} kg` : '75 kg (referencia)'}
- Altura: ${context.userHeightCm ? `${context.userHeightCm} cm` : '175 cm (referencia)'}
- Objetivo primario: ${context.userGoal || 'Hipertrofia y rendimiento atlético'}
- Nivel de experiencia: ${context.experienceLevel || 'Intermedio'}
- Rutina base activa: ${context.routineName || 'No definida'} (Días activos: ${context.routineDaysCount || 'N/A'})
${
  context.routineDays?.length
    ? `- Estructura completa de su rutina: ${JSON.stringify(
        context.routineDays.map((d) => ({
          id: d.id,
          label: d.label,
          focusTitle: d.focusTitle,
          isRestDay: d.isRestDay,
          ejercicios: d.exercises.map((e) => ({
            name: e.name,
            sets: e.sets,
            reps: e.repRangeLabel,
            weightKg: e.targetWeightKg,
          })),
        }))
      )}`
    : ''
}
- Entrenamiento de hoy en curso: ${context.activeWorkoutTitle || 'Ninguno'} (${
      context.activeWorkoutExerciseNames?.length
        ? context.activeWorkoutExerciseNames.join(', ')
        : 'Sin ejercicios cargados'
    })
- Pantalla actual: ${context.currentScreen || 'General'}

DIRECTIVAS INMUTABLES:
1. Responde DIRECTA Y COHERENTEMENTE a lo que el usuario está preguntando en su último mensaje. Prohibido responder con textos genéricos que ignoren su pregunta.
2. Si el usuario pregunta algo ajeno al entrenamiento, salud, nutrición, fisiología o uso de KAIROS, redirige con cortesía profesional hacia su rendimiento físico y entrenamiento en KAIROS.
3. Si recomiendas ejercicios específicos, usa sus nombres canónicos en español (ej. "Press de Banca Plano", "Press Inclinado con Mancuernas", "Elevaciones Laterales en Polea", "Sentadilla Hack", "Peso Muerto Rumano con Barra", "Jalón al Pecho Agarre Neutro", "Remo en Polea Baja", "Curl Bayesiano en Polea") y precisa series, repeticiones y descanso en segundos, para que el sistema genere botones interactivos de 1 toque.
4. Si la consulta es de nutrición o hidratación, calcula números exactos según su peso corporal (${context.userWeightKg || 75} kg).
5. Mantén la respuesta concisa, estructurada con subtítulos y viñetas claras.

Historial reciente de conversación:
${recentHistoryText}

Último mensaje del usuario a responder:
${lastUserMessage}`;

    const aiRes = await generateWithGeminiCascade({
      prompt: systemPrompt,
      tier: 'pro',
      temperature: 0.3,
      maxOutputTokens: 1050,
      cacheTtlMs: 8 * 60_000,
    });

    if (aiRes.ok && aiRes.text) {
      const cleanContent = stripActionTagsFromAiText(aiRes.text);
      const suggestedActions = extractActionSuggestionsFromText(
        aiRes.text,
        lastUserMessage,
        context
      );
      return NextResponse.json({
        ok: true,
        message: {
          role: 'assistant',
          content: cleanContent,
        },
        suggestedActions,
        modelUsed: aiRes.modelUsed,
      });
    }

    // 4. Verified Scientific & Agentic Local Fallback (0-downtime guarantee if all external tiers were busy)
    const localResult = await generateScientificAiResponse(lastUserMessage, context);

    return NextResponse.json({
      ok: true,
      message: {
        role: 'assistant',
        content: localResult.content,
      },
      suggestedActions: localResult.suggestedActions,
      modelUsed: 'kairos-scientific-fallback',
    });
  } catch {
    // Zero-downtime safety net: even under unexpected runtime exceptions, answer with local scientific engine
    const fallbackResult = await generateScientificAiResponse(
      'Hola, ¿cómo puedo ayudarte hoy?',
      {}
    );
    return NextResponse.json({
      ok: true,
      message: {
        role: 'assistant',
        content: fallbackResult.content,
      },
      suggestedActions: fallbackResult.suggestedActions,
      modelUsed: 'kairos-zero-error-fallback',
    });
  }
}
