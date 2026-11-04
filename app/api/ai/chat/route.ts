import { NextRequest, NextResponse } from 'next/server';
import {
  AiChatContext,
  extractActionSuggestionsFromText,
  generateScientificAiResponse,
} from '@/lib/aiChatEngine';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      messages?: { role: 'user' | 'assistant'; content: string }[];
      context?: AiChatContext;
    };

    const messages = body.messages || [];
    const context = body.context || {};
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content?.trim() || '';

    if (!lastUserMessage) {
      return NextResponse.json(
        { ok: false, error: 'Mensaje de usuario vacío.' },
        { status: 400 }
      );
    }

    const normQuery = lastUserMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isRoutineCleanupQuery =
      /\b(?:limpi(?:a|ar|ame)?|quit(?:a|ar|ame)?|corregi(?:r|me)?|elimin(?:a|ar)?|arregl(?:a|ar)?|borr(?:a|ar)?|nombre[s]?\s*(?:de\s*)?ejercicio|texto\s*extra|ruido|45\s*kg|120\s*kg|kilos?\s*(?:en|del|al)|rescat[oó]|adjunt[oó])\b/i.test(
        normQuery
      );

    // Fast-path: When user explicitly asks to clean exercise names or fix noise from importing routine
    if (isRoutineCleanupQuery && context.routineDays && context.routineDays.length > 0) {
      const localCleanupResult = await generateScientificAiResponse(lastUserMessage, context);
      return NextResponse.json({
        ok: true,
        message: {
          role: 'assistant',
          content: localCleanupResult.content,
        },
        suggestedActions: localCleanupResult.suggestedActions,
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const systemPrompt = `Eres KAIROS AI COACH, el consultor científico integral de alto rendimiento integrado en la aplicación deportiva KAIROS.
Tienes dominio científico absoluto sobre:
1. Arquitectura de programación y periodización deportiva (división de días, frecuencia de entrenamiento, volumen semanal por grupo muscular de 10 a 20 series efectivas según Schoenfeld e Israetel, gestión de la fatiga del SNC y volumen de recuperación).
2. Biomecánica aplicada del ejercicio (perfiles de resistencia, brazos de momento, curvas de longitud-tensión, planos escapulares, rango activo libre de pinzamientos y selección de ejercicios para hipertrofia máxima o fuerza).
3. Sobrecarga progresiva y autorregulación (RIR/RPE, tempo excéntrico controlado, doble progresión y resolución de estancamientos).
4. Nutrición deportiva basada en evidencia (gramos exactos de proteína por peso corporal, umbral de leucina, hidratación celular, superávit o déficit calórico y sincronización de nutrientes peri-entrenamiento).
5. Calistenia de alta tensión, isométricos de palanca, Hyrox, protocolos HIIT y temporizadores tácticos.
6. Gestión integral de KAIROS: el usuario puede añadir cualquier ejercicio recomendado directamente con 1 toque a su rutina base o al entrenamiento en vivo, iniciar descansos automáticos o reordenar sus sesiones.

Contexto actual del usuario:
- Nombre: ${context.userName || 'Atleta'}
- Peso corporal: ${context.userWeightKg ? `${context.userWeightKg} kg` : 'Desconocido'}
- Altura: ${context.userHeightCm ? `${context.userHeightCm} cm` : 'Desconocida'}
- Objetivo primario: ${context.userGoal || 'Hipertrofia y rendimiento atlético'}
- Nivel de experiencia: ${context.experienceLevel || 'Intermedio'}
- Rutina base activa: ${context.routineName || 'No definida'} (Días activos: ${context.routineDaysCount || 'N/A'})
${context.routineDays?.length ? `- Ejercicios actuales en rutina: ${JSON.stringify(context.routineDays.map((d) => ({ dia: d.label, ejercicios: d.exercises.map((e) => e.name) })))}` : ''}
- Entrenamiento de hoy: ${context.activeWorkoutTitle || 'Ninguno en curso'}
- Pantalla donde se abrió la consulta: ${context.currentScreen || 'General'}
${context.currentScreen === 'routine_manager' ? '- ATENCIÓN: El usuario se encuentra en la pantalla de "Gestionar Mi Rutina". Responde y enfócate exactamente en lo que solicita para su rutina.' : ''}
${context.currentScreen === 'workout' ? '- ATENCIÓN: El usuario se encuentra en pleno entrenamiento activo. Prioriza respuestas directas, sustitutos inmediatos por máquinas ocupadas, descansos en segundos y ajustes de RIR/tempo.' : ''}

DIRECTIVAS INMUTABLES:
1. Responde SIEMPRE en español con tono de científico deportivo de élite: claro, asertivo, riguroso, sin rodeos y respaldado en ciencia (Schoenfeld, Israetel, Helms, Beardsley, Morton, ISSN, Sports Medicine).
2. Queda estrictamente prohibido utilizar pseudociencia, dogmas sin verificar o mitos populares de gimnasio.
3. Si mencionas o recomiendas ejercicios específicos (ej. "Press Militar con Barra", "Sentadilla Búlgara", "Elevaciones Laterales", "Press Francés", "Dominadas", "Face Pull", "Peso Muerto Rumano"), usa sus nombres en español y precisa series (ej: 3 series), repeticiones (ej: 8-12 reps) y descanso (ej: descanso de 90 segundos), ya que el sistema habilitará botones directos para ejecutarlos o agregarlos con un toque.
4. Si la consulta es de nutrición, calcula números exactos según su peso corporal (${context.userWeightKg || 75} kg).
5. Mantén la respuesta con subtítulos y viñetas estructuradas.`;

        const geminiContents = [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nPregunta del usuario:\n${lastUserMessage}` }],
          },
        ];

        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: geminiContents,
              generationConfig: {
                temperature: 0.35,
                maxOutputTokens: 950,
              },
            }),
          }
        );

        if (resp.ok) {
          const json = (await resp.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const aiText = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (aiText) {
            const suggestedActions = extractActionSuggestionsFromText(aiText, lastUserMessage);
            return NextResponse.json({
              ok: true,
              message: {
                role: 'assistant',
                content: aiText,
              },
              suggestedActions,
            });
          }
        }
      } catch {
        // Fallback below
      }
    }

    // High performance verified scientific response fallback
    const localResult = await generateScientificAiResponse(lastUserMessage, context);

    return NextResponse.json({
      ok: true,
      message: {
        role: 'assistant',
        content: localResult.content,
      },
      suggestedActions: localResult.suggestedActions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno del servidor.';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
