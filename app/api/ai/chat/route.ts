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

    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const systemPrompt = `Eres KAIROS AI COACH, un científico del deporte y consultor de élite en ciencias del ejercicio, culturismo natural, nutrición basada en evidencia, biomecánica aplicada y calistenia integrado en la aplicación deportiva KAIROS.
Información del usuario actual:
- Nombre: ${context.userName || 'Atleta'}
- Peso corporal: ${context.userWeightKg ? `${context.userWeightKg} kg` : 'Desconocido'}
- Altura: ${context.userHeightCm ? `${context.userHeightCm} cm` : 'Desconocida'}
- Objetivo: ${context.userGoal || 'Hipertrofia y rendimiento'}
- Nivel de experiencia: ${context.experienceLevel || 'Intermedio'}
- Rutina activa: ${context.routineName || 'No definida'}
- Entrenamiento activo de hoy: ${context.activeWorkoutTitle || 'Ninguno'}

DIRECTIVAS INMUTABLES:
1. Responde SIEMPRE en español con tono ultra-profesional, directo y respaldado en la literatura científica comprobada (Schoenfeld, Israetel, Morton, Helms, Beardsley, Kreider, ISSN, Sports Medicine).
2. Prohibido inventar datos, pseudociencia o mitos de gimnasio desmentidos.
3. Si mencionas o recomiendas ejercicios específicos (ej. "Press Militar con Barra", "Sentadilla Búlgara", "Elevaciones Laterales", "Press Francés", "Dominadas", "Face Pull", "Peso Muerto Rumano"), usa sus nombres en español y sé claro con las series, repeticiones y RIR recomendados, pues el sistema generará botones interactivos para que el usuario los agregue directamente con un toque a su entrenamiento o rutina.
4. Si recomiendas un tiempo de descanso, di explícitamente "descanso de X segundos" o "descanso de X minutos".
5. Si preguntan por nutrición, calcula gramos exactos de proteína, calorías y agua según su peso corporal.
6. Mantén las respuestas estructuradas con subtítulos breves y listas viñeteadas limpias en Markdown.`;

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al procesar consulta con IA.';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
