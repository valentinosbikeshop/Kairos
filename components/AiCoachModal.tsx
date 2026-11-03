'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useKairos } from '@/lib/kairosContext';
import { useTimerEngine } from '@/components/TimerEngine';
import { AiActionSuggestion } from '@/lib/aiChatEngine';
import { getResolvedWorkoutDefaults, uid } from '@/lib/formatters';
import { BUILTIN_EXERCISES } from '@/lib/exerciseDatabase';
import {
  Bot,
  Check,
  ChevronDown,
  Dumbbell,
  Flame,
  Plus,
  Send,
  Sparkles,
  Timer,
  X,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestedActions?: AiActionSuggestion[];
}

interface AiCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_SUGGESTIONS = [
  '¿Cuánta proteína y agua necesito según mi peso?',
  '¿Cómo aplicar sobrecarga progresiva sin lesionarme?',
  'Recomiéndame el mejor ejercicio para deltoide lateral',
  '¿Cómo estructurar descansos para hipertrofia máxima?',
  'Biomecánica y ejecución de la Sentadilla Búlgara',
];

export function AiCoachModal({ isOpen, onClose }: AiCoachModalProps) {
  const {
    user,
    profile,
    routine,
    saveUserRoutine,
    activeWorkout,
    addBlockToWorkout,
    addExerciseToBlock,
    createAndAddCustomExercise,
  } = useKairos();

  const { startRestTimer } = useTimerEngine();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init_msg',
      role: 'assistant',
      content: `### ❖ KAIROS AI COACH\n**Consultor Científico de Alto Rendimiento**\n\nHola${
        user?.displayName ? ` ${user.displayName}` : ''
      }. Estoy integrado para responder tus dudas sobre **biomecánica de ejercicios, hipertrofia muscular, nutrición basada en evidencia, calistenia y optimización de tu rutina**.\n\nSi te recomiendo ejercicios, podrás **añadirlos con 1 toque a tu entrenamiento o rutina base**. ¿En qué puedo asesorarte hoy?`,
      timestamp: Date.now(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Selector for adding to routine day
  const [routineDayTarget, setRoutineDayTarget] = useState<{
    action: AiActionSuggestion;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    setInput('');
    const userMsg: ChatMessage = {
      id: uid('msg'),
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const activeExNames = activeWorkout.blocks.flatMap((b) =>
        b.exercises.map((e) => e.name)
      );

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            userName: user?.displayName || user?.username,
            userWeightKg: profile?.weightKg,
            userHeightCm: profile?.heightCm,
            userGoal: profile?.primaryGoal,
            experienceLevel: profile?.experienceLevel,
            routineName: routine?.name,
            routineDaysCount: routine?.days?.filter((d) => !d.isRestDay).length,
            activeWorkoutTitle: activeWorkout.title,
            activeWorkoutExerciseNames: activeExNames,
          },
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        message?: { role: 'assistant'; content: string };
        suggestedActions?: AiActionSuggestion[];
        error?: string;
      };

      if (data.ok && data.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid('msg'),
            role: 'assistant',
            content: data.message!.content,
            suggestedActions: data.suggestedActions || [],
            timestamp: Date.now(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: uid('msg'),
            role: 'assistant',
            content:
              'No se pudo conectar con el motor de IA en este momento. Inténtalo nuevamente.',
            timestamp: Date.now(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid('msg'),
          role: 'assistant',
          content:
            'Hubo un problema de conexión. Comprueba tu red local o vuelve a formular tu pregunta.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = (action: AiActionSuggestion) => {
    if (action.type === 'start_rest_timer') {
      const sec = action.payload.restSeconds || 90;
      startRestTimer(sec);
      setActionFeedback(`⏱️ Timer de descanso iniciado (${sec}s)`);
      setTimeout(() => setActionFeedback(null), 3500);
      return;
    }

    if (action.type === 'add_to_active_workout') {
      const exName = action.payload.exerciseName;
      if (!exName) return;

      const targetMode = action.payload.mode || 'hypertrophy';
      const existingBlock = activeWorkout.blocks.find((b) => b.mode === targetMode) || activeWorkout.blocks[0];

      let blockId = existingBlock?.id;
      if (!blockId) {
        addBlockToWorkout(targetMode);
        // Fallback to activeWorkout's block next frame
        setTimeout(() => {
          const freshCatalog = BUILTIN_EXERCISES.find(
            (c) => c.id === action.payload.catalogId
          );
          if (freshCatalog && activeWorkout.blocks[0]) {
            addExerciseToBlock(activeWorkout.blocks[0].id, freshCatalog);
          }
        }, 150);
      } else {
        const catalogItem = BUILTIN_EXERCISES.find(
          (c) => c.id === action.payload.catalogId
        );
        if (catalogItem) {
          addExerciseToBlock(blockId, catalogItem);
        } else {
          createAndAddCustomExercise(blockId, exName, targetMode, {
            muscleGroup: action.payload.muscleGroup,
          });
        }
      }

      setActionFeedback(`✓ "${exName}" añadido a tu entrenamiento activo`);
      setTimeout(() => setActionFeedback(null), 3500);
      return;
    }

    if (action.type === 'add_to_routine') {
      // Show routine day selector
      setRoutineDayTarget({ action });
    }
  };

  const handleConfirmAddToRoutineDay = (dayId: string) => {
    if (!routine || !routineDayTarget) return;

    const action = routineDayTarget.action;
    const exName = action.payload.exerciseName || 'Ejercicio';
    const targetMode = action.payload.mode || 'hypertrophy';
    const defs = getResolvedWorkoutDefaults(profile);

    const updatedDays = routine.days.map((day) => {
      if (day.id !== dayId) return day;

      const newPrescription = {
        catalogId: action.payload.catalogId || `custom_${uid('cx')}`,
        name: exName,
        mode: targetMode,
        sets: action.payload.sets || defs.defaultEffectiveSets,
        repsNum: action.payload.reps || defs.defaultReps,
        repRangeLabel: `${action.payload.reps || defs.defaultReps} reps`,
        rir: defs.defaultRir,
        restSeconds: action.payload.restSeconds || defs.defaultRestSeconds,
      };

      return {
        ...day,
        isRestDay: false,
        exercises: [...day.exercises, newPrescription],
      };
    });

    const updatedRoutine = {
      ...routine,
      days: updatedDays,
      updatedAtIso: new Date().toISOString(),
    };

    saveUserRoutine(updatedRoutine, false);
    setRoutineDayTarget(null);
    setActionFeedback(`📋 "${exName}" añadido a tu rutina`);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 backdrop-blur-md">
      <div className="relative flex h-[92dvh] w-full max-w-[430px] flex-col rounded-t-3xl border-t border-x border-stoneborder bg-[#0B090F] shadow-2xl text-brand animate-fade-up pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stoneborder/70 px-4 py-3 bg-[#110E17]/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-gothic/40 bg-gothic/20 text-gothic shadow-[0_0_12px_rgba(157,78,221,0.2)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-gothic text-xs font-bold tracking-[0.18em] text-brand">
                  KAIROS AI
                </span>
                <span className="rounded-full bg-gothic/25 border border-gothic/40 px-1.5 py-0.2 text-[9px] font-mono text-gothic">
                  CIENCIA
                </span>
              </div>
              <p className="text-[10px] text-brand-muted">
                Consultor Científico de Entrenamiento y Nutrición
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stoneborder bg-background p-1.5 text-brand-muted hover:text-brand"
            aria-label="Cerrar chat de IA"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Global Action Feedback Notification */}
        {actionFeedback && (
          <div className="mx-4 mt-2 rounded-xl border border-emerald-500/40 bg-emerald-950/80 px-3 py-2 text-xs font-semibold text-emerald-200 shadow-lg animate-fade-up flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Chat Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 scroll-smooth"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              {m.role === 'assistant' && (
                <div className="mb-1 flex items-center gap-1.5 text-[10px] text-gothic font-semibold uppercase tracking-wider">
                  <span>❖</span>
                  <span>Kairos Coach</span>
                </div>
              )}

              <div
                className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-gothic/25 text-brand border border-gothic/40'
                    : 'bg-[#14111C] text-brand-muted border border-stoneborder/80'
                }`}
              >
                {m.content}
              </div>

              {/* Action Suggestion Pills from AI */}
              {m.suggestedActions && m.suggestedActions.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5 w-full max-w-[92%]">
                  <span className="text-[10px] font-semibold text-gothic uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Acciones directas disponibles:
                  </span>
                  {m.suggestedActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleExecuteAction(action)}
                      className="inline-flex items-center justify-between rounded-xl border border-gothic/40 bg-surface px-3 py-2 text-left text-xs font-medium text-brand hover:border-gothic hover:bg-gothic/15 active:scale-95 transition-all shadow-sm"
                    >
                      <span className="truncate pr-2">{action.label}</span>
                      <Plus className="h-3.5 w-3.5 shrink-0 text-gothic" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gothic animate-pulse py-2">
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
              <span>Analizando literatura científica y biomecánica...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips (when 1-2 messages) */}
        {messages.length <= 2 && !isLoading && (
          <div className="px-4 py-1">
            <span className="text-[10px] font-semibold text-brand-subtle uppercase tracking-wider">
              Preguntas sugeridas:
            </span>
            <div className="mt-1.5 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {QUICK_SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void handleSend(sug)}
                  className="shrink-0 rounded-xl border border-stoneborder/70 bg-[#161220] px-2.5 py-1 text-[11px] text-brand-muted hover:border-gothic/50 hover:text-brand"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="border-t border-stoneborder/70 bg-[#100D16] p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Haz tu pregunta a la IA (ej: '¿Cómo hacer sentadilla búlgara?')"
              className="flex-1 rounded-xl border border-stoneborder bg-background px-3.5 py-2.5 text-xs text-brand placeholder-brand-subtle focus:border-gothic focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="rounded-xl bg-brand px-3 py-2.5 text-xs font-bold text-background uppercase tracking-wider disabled:opacity-40 active:scale-95 transition-opacity"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {/* Modal Sheet for selecting which routine day to inject an exercise into */}
        {routineDayTarget && routine && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-gothic/50 bg-surface p-4 space-y-3 animate-fade-up">
              <div className="flex items-center justify-between">
                <h4 className="font-gothic text-sm font-semibold text-brand">
                  Seleccionar Día de tu Rutina
                </h4>
                <button
                  type="button"
                  onClick={() => setRoutineDayTarget(null)}
                  className="rounded-lg p-1 text-brand-muted hover:text-brand"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-brand-muted">
                ¿A qué día deseas añadir{' '}
                <strong>
                  {routineDayTarget.action.payload.exerciseName}
                </strong>
                ?
              </p>

              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {routine.days.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleConfirmAddToRoutineDay(day.id)}
                    className="w-full flex items-center justify-between rounded-xl border border-stoneborder bg-background p-2.5 text-left text-xs hover:border-gothic/60 hover:text-brand"
                  >
                    <div>
                      <span className="font-semibold text-brand">
                        {day.label}
                      </span>
                      <span className="text-[11px] text-brand-muted ml-2">
                        {day.focusTitle || (day.isRestDay ? 'Descanso' : 'Entrenamiento')}
                      </span>
                    </div>
                    <Plus className="h-3.5 w-3.5 text-gothic" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
