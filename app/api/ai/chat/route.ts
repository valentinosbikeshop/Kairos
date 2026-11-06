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
      /\b(?:limpi(?:a|ar|ame)?|quit(?:a|ar|ame)?|corregi(?:r|me)?|elimin(?:a|ar)?|arregl(?:a|ar)?|borr(?:a|ar)?|nombre[s]?\s*(?:de\s*)?ejercicio|texto\s*extra|ruido|45\s*kg|120\s*kg|kilos?\s*(?:en|del|al)|rescat[oó]|adjunt[oó])\b/i.test(
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

    // 3. High-Power Gemini AI Cascade (gemini-2.5-pro -> gemini-2.5-flash -> gemini-2.0-flash) with Anti-Saturation
    const recentHistoryText = messages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'Usuario' : 'Kairos Coach'}: ${m.content}`)
      .join('\n\n');

    const systemPrompt = `Eres KAIROS AI COACH, el consultor científico integral y agente interactivo de alto rendimiento integrado en la aplicación deportiva KAIROS.
Tienes dominio científico absoluto sobre:
1. Arquitectura de programación y periodización deportiva (división de días, frecuencia de entrenamiento, volumen semanal por grupo muscular de 10 a 20 series efectivas según Schoenfeld e Israetel, gestión de la fatiga del SNC y volumen de recuperación).
2. Biomecánica aplicada del ejercicio (perfiles de resistencia, brazos de momento, curvas de longitud-tensión, planos escapulares, músculos agonistas, sinergistas necesarios, estabilizadores y ratio estímulo/fatiga SFR).
3. Sobrecarga progresiva y autorregulación (RIR/RPE, tempo excéntrico controlado, doble progresión y resolución de estancamientos).
4. Nutrición deportiva basada en evidencia (gramos exactos de proteína por peso corporal, umbral de leucina, hidratación celular, superávit o déficit calórico).
5. Capacidad Agéntica Interactiva en KAIROS: puedes editar la rutina del usuario, añadir/eliminar/sustituir ejercicios, cargar días completos en el entrenamiento de hoy, actualizar el peso o parámetros del perfil e iniciar temporizadores.

Contexto actual del usuario en tiempo real:
- Nombre: ${context.userName || 'Atleta'}
- Peso corporal: ${context.userWeightKg ? `${context.userWeightKg} kg` : 'Desconocido'}
- Altura: ${context.userHeightCm ? `${context.userHeightCm} cm` : 'Desconocida'}
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
1. Responde SIEMPRE en español con tono de científico deportivo de élite: claro, asertivo, riguroso y respaldado en evidencia (Schoenfeld, Israetel, Helms, Beardsley, Morton, ISSN).
2. Si recomiendas ejercicios específicos, usa sus nombres canónicos en español (ej. "Press de Banca Plano", "Press Inclinado con Mancuernas", "Elevaciones Laterales en Polea", "Sentadilla Hack", "Peso Muerto Rumano con Barra", "Jalón al Pecho Agarre Neutro", "Remo en Polea Baja", "Curl Bayesiano en Polea") y precisa series, repeticiones y descanso en segundos, para que el sistema genere botones interactivos de 1 toque.
3. Si la consulta es de nutrición, calcula números exactos según su peso corporal (${context.userWeightKg || 75} kg).
4. Mantén la respuesta con subtítulos y viñetas estructuradas.

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
