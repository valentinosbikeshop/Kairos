'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RoutineDayPlan } from '@/types/kairos';
import { useKairos } from '@/lib/kairosContext';
import { useTimerEngine } from '@/components/TimerEngine';
import {
  AiActionSuggestion,
  generateScientificAiResponse,
} from '@/lib/aiChatEngine';
import { getResolvedWorkoutDefaults, uid } from '@/lib/formatters';
import { BUILTIN_EXERCISES } from '@/lib/exerciseDatabase';
import {
  Check,
  Plus,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

export type AiCoachContextHint = 'general' | 'routine_manager' | 'workout' | 'history' | 'timer';

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
  contextHint?: AiCoachContextHint;
  routineDays?: RoutineDayPlan[];
  onApplyRoutineDays?: (updatedDays: RoutineDayPlan[]) => void;
}

/**
 * Parses inline formatting like **bold** and *italic* without leaving raw symbols.
 */
function parseInlineFormatting(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      const inner = token.slice(2, -2);
      parts.push(
        <strong key={`b_${match.index}`} className="font-semibold text-brand">
          {inner}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const inner = token.slice(1, -1);
      parts.push(
        <em key={`i_${match.index}`} className="text-brand/90 italic">
          {inner}
        </em>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
}

/**
 * Renders structured markdown without raw ### or ***, transforming headings,
 * bullet lists, numbered steps, and paragraphs into clean Gothic UI components.
 */
function FormattedChatMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      elements.push(<div key={`spacer_${i}`} className="h-1.5" />);
      continue;
    }

    // Markdown Headings (###, ##, #)
    if (trimmed.startsWith('#')) {
      const headingClean = trimmed
        .replace(/^#+\s*/, '')
        .replace(/^[❖*]+\s*/, '')
        .replace(/\*\*+/g, '');
      elements.push(
        <div
          key={`h_${i}`}
          className="font-semibold text-brand text-xs uppercase tracking-wider mt-2 mb-1 flex items-center gap-1.5"
        >
          <span className="text-gothic">❖</span>
          <span>{parseInlineFormatting(headingClean)}</span>
        </div>
      );
      continue;
    }

    // Bullet points (-, *, •)
    if (/^[-*•]\s+/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-*•]\s+/, '');
      elements.push(
        <div
          key={`li_${i}`}
          className="flex items-start gap-1.5 text-xs text-brand-muted my-0.5 pl-1"
        >
          <span className="text-gothic mt-1 shrink-0 text-[8px]">◆</span>
          <div className="flex-1 leading-relaxed">
            {parseInlineFormatting(bulletText)}
          </div>
        </div>
      );
      continue;
    }

    // Numbered list items (1. 2. 3.)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div
          key={`num_${i}`}
          className="flex items-start gap-1.5 text-xs text-brand-muted my-0.5 pl-1"
        >
          <span className="font-mono text-gothic font-semibold text-[11px] shrink-0">
            {numMatch[1]}.
          </span>
          <div className="flex-1 leading-relaxed">
            {parseInlineFormatting(numMatch[2])}
          </div>
        </div>
      );
      continue;
    }

    // Standard body paragraph
    elements.push(
      <p
        key={`p_${i}`}
        className="text-xs leading-relaxed text-brand-muted mb-1 last:mb-0"
      >
        {parseInlineFormatting(trimmed)}
      </p>
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

const CONTEXT_CONFIGS: Record<
  AiCoachContextHint,
  {
    badge: string;
    subtitle: string;
    getGreeting: (name?: string) => string;
    suggestions: string[];
  }
> = {
  routine_manager: {
    badge: 'ARQUITECTURA DE RUTINA',
    subtitle: 'Agente Interactivo de Edición, Volumen y Programación Base',
    getGreeting: (name?: string) =>
      `### ❖ KAIROS AI COACH\n**Agente Interactivo de Rutina Base**\n\nHola${
        name ? ` ${name}` : ''
      }. Tengo acceso directo para analizar y **editar tu rutina base** en tiempo real.\n\nPuedes pedirme que ejecute acciones directas como:\n- **Auditoría y autocompletado**: *"Analiza mi rutina"* o *"Completa mi día de Pierna con ejercicios"*.\n- **Añadir o sustituir ejercicios**: *"Agrega Elevaciones Laterales en Polea 3x15 al Día 1"* o *"Cambia Press de Banca por Press Inclinado con Mancuernas"*.\n- **Ajustar series, reps o cargas**: *"Cambia Remo en Polea Baja a 3 series de 10 reps con 45kg"*.\n- **Cargar día para entrenar hoy**: *"Cárgame el Día 1 completo en mi entrenamiento de hoy"*.\n\n¿Qué ajuste deseas que realice en tu rutina?`,
    suggestions: [
      'Analiza mi rutina actual y revisa si falta algún ejercicio',
      'Agrega Elevaciones Laterales en Polea 3x15 al Día 1',
      'Cárgame el Día 1 completo en mi entrenamiento de hoy',
      'Completa mi día de Pierna con ejercicios científicos',
      '¿Cuántas series efectivas por grupo muscular debo hacer a la semana?',
    ],
  },
  workout: {
    badge: 'SESIÓN EN VIVO',
    subtitle: 'Agente Táctico de Entrenamiento en Tiempo Real',
    getGreeting: (name?: string) =>
      `### ❖ KAIROS AI COACH\n**Agente Táctico en Vivo**\n\nHola${
        name ? ` ${name}` : ''
      }. Estoy sincronizado con tu entrenamiento de hoy y puedo modificarlo en tiempo real:\n- **Cargar cualquier día de tu rutina**: *"Cárgame el Día 1 de Torso"* o *"Carga el Día 2 de Pierna"*.\n- **Biomecánica profunda y SFR** de cada ejercicio.\n- **Sustitutos inmediatos** si una máquina está ocupada.\n- **Iniciar temporizadores de descanso** automáticos.\n\n¿Qué necesitas que cargue o ajuste en tu sesión de hoy?`,
    suggestions: [
      'Cárgame el Día 1 completo en mi entrenamiento de hoy',
      'Cárgame el Día 2 de Pierna para entrenar hoy',
      '¿Cuánto tiempo debería descansar exactamente en este ejercicio?',
      'Sustituto rápido si la máquina que necesito está ocupada',
    ],
  },
  general: {
    badge: 'ALTO RENDIMIENTO',
    subtitle: 'Agente Científico Integral de Ciencias del Ejercicio, Rutinas y Perfil',
    getGreeting: (name?: string) =>
      `### ❖ KAIROS AI COACH\n**Agente Científico Interactivo de Alto Rendimiento**\n\nHola${
        name ? ` ${name}` : ''
      }. Como tu agente de inteligencia artificial en KAIROS, no solo respondo consultas científicas sino que **interactúo directamente con tu información y tu cuenta**:\n\n- **Edición directa de tu rutina**: *"Agrega Elevaciones Laterales 3x15 al Día 1"*, *"Cambia Press de Banca por Press Inclinado con Mancuernas"* o *"Elimina Fondos de mi rutina"*.\n- **Carga de entrenamientos**: *"Cárgame el Día 1 de Torso para entrenar hoy"*.\n- **Actualización de tu perfil**: *"Actualiza mi peso a 78 kg"* o *"Pon mi descanso por defecto en 120s"*.\n- **Biomecánica y Nutrición**: cálculo exacto de macros, SFR, fatiga acumulada y músculos sinergistas.\n\n¿Qué acción o análisis deseas que realice hoy?`,
    suggestions: [
      'Analiza mi rutina actual y dime qué puedo mejorar',
      'Cárgame el Día 1 en mi entrenamiento de hoy',
      'Agrega Elevaciones Laterales en Polea 3x15 al Día 1',
      '¿Cuánta proteína y agua necesito según mi peso corporal?',
      'Biomecánica y músculos trabajados en Sentadilla Hack',
    ],
  },
  history: {
    badge: 'ANÁLISIS HISTÓRICO',
    subtitle: 'Consultor de Progresión y Cargas Acumuladas',
    getGreeting: (name?: string) =>
      `### ❖ KAIROS AI COACH\n**Análisis de Progresión y Cargas Históricas**\n\nHola${
        name ? ` ${name}` : ''
      }. Estoy listo para revisar tu historial de entrenamientos, 1RM estimadas y volumen acumulado para detectar estancamientos o fatiga excesiva. ¿Qué análisis deseas realizar?`,
    suggestions: [
      '¿Cómo interpretar mi progresión de 1RM estimada?',
      '¿Cuándo es momento oportuno para una semana de descarga (deload)?',
    ],
  },
  timer: {
    badge: 'TEMPORIZADORES Y FISIOLOGÍA',
    subtitle: 'Consultor de Densidad, Intervalos y Recuperación',
    getGreeting: (name?: string) =>
      `### ❖ KAIROS AI COACH\n**Fisiología del Descanso y Temporizadores**\n\nHola${
        name ? ` ${name}` : ''
      }. Puedo ayudarte a calibrar los tiempos de descanso ideales según el sistema energético (fosfágenos, glucolítico o aeróbico) o estructurar protocolos de intervalos (HIIT, Tabata, EMOM). ¿En qué puedo asesorarte?`,
    suggestions: [
      '¿Cuánto descansar entre series de hipertrofia vs fuerza máxima?',
      'Protocolo HIIT óptimo para quemar grasa sin perder masa muscular',
    ],
  },
};

export function AiCoachModal({
  isOpen,
  onClose,
  contextHint = 'general',
  routineDays,
  onApplyRoutineDays,
}: AiCoachModalProps) {
  const {
    user,
    profile,
    routine,
    saveUserProfile,
    saveUserRoutine,
    loadRoutineDayIntoWorkout,
    activeWorkout,
    updateWorkoutTitle,
    clearActiveWorkoutBlocks,
    addBlockToWorkout,
    addExerciseToBlock,
    createAndAddCustomExercise,
  } = useKairos();

  const { startRestTimer } = useTimerEngine();

  const activeConfig = CONTEXT_CONFIGS[contextHint] || CONTEXT_CONFIGS.general;

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init_msg',
      role: 'assistant',
      content: activeConfig.getGreeting(user?.displayName || user?.username),
      timestamp: Date.now(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [executedActionIds, setExecutedActionIds] = useState<Set<string>>(() => new Set());

  // Selector for adding to routine day
  const [routineDayTarget, setRoutineDayTarget] = useState<{
    action: AiActionSuggestion;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Re-synchronize initial message if opening fresh on a new context
  useEffect(() => {
    if (isOpen) {
      setMessages((prev) => {
        if (prev.length <= 1) {
          return [
            {
              id: 'init_msg',
              role: 'assistant',
              content: activeConfig.getGreeting(user?.displayName || user?.username),
              timestamp: Date.now(),
            },
          ];
        }
        return prev;
      });

      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, [isOpen, contextHint, user, activeConfig]);

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

    const activeExNames = activeWorkout.blocks.flatMap((b) =>
      b.exercises.map((e) => e.name)
    );

    const chatContext = {
      userName: user?.displayName || user?.username,
      userWeightKg: profile?.weightKg,
      userHeightCm: profile?.heightCm,
      userGoal: profile?.primaryGoal,
      experienceLevel: profile?.experienceLevel,
      routineName: routine?.name,
      routineDaysCount: (routineDays || routine?.days)?.filter((d) => !d.isRestDay).length,
      routineDays: routineDays || routine?.days,
      activeWorkoutTitle: activeWorkout.title,
      activeWorkoutExerciseNames: activeExNames,
      currentScreen: contextHint,
    };

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: chatContext,
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        message?: { role: 'assistant'; content: string };
        suggestedActions?: AiActionSuggestion[];
        error?: string;
      };

      if (data.ok && data.message) {
        const incomingActions = data.suggestedActions || [];
        setMessages((prev) => [
          ...prev,
          {
            id: uid('msg'),
            role: 'assistant',
            content: data.message!.content,
            suggestedActions: incomingActions,
            timestamp: Date.now(),
          },
        ]);

        // Auto-execute direct imperative agentic actions immediately
        for (const act of incomingActions) {
          if (act.autoExecute) {
            handleExecuteAction(act);
          }
        }
      } else {
        // Zero-error guarantee: fall back to built-in scientific AI engine immediately
        const fallback = await generateScientificAiResponse(query, chatContext);
        setMessages((prev) => [
          ...prev,
          {
            id: uid('msg'),
            role: 'assistant',
            content: fallback.content,
            suggestedActions: fallback.suggestedActions || [],
            timestamp: Date.now(),
          },
        ]);
        for (const act of fallback.suggestedActions || []) {
          if (act.autoExecute) handleExecuteAction(act);
        }
      }
    } catch {
      // Zero-error guarantee: even completely offline or under network drop, answer instantly
      const fallback = await generateScientificAiResponse(query, chatContext);
      setMessages((prev) => [
        ...prev,
        {
          id: uid('msg'),
          role: 'assistant',
          content: fallback.content,
          suggestedActions: fallback.suggestedActions || [],
          timestamp: Date.now(),
        },
      ]);
      for (const act of fallback.suggestedActions || []) {
        if (act.autoExecute) handleExecuteAction(act);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const markActionExecuted = (actionId: string, feedbackMsg: string) => {
    setExecutedActionIds((prev) => {
      const next = new Set(prev);
      next.add(actionId);
      return next;
    });
    setActionFeedback(feedbackMsg);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleExecuteAction = (action: AiActionSuggestion) => {
    if (action.type === 'start_rest_timer') {
      const sec = action.payload.restSeconds || 90;
      startRestTimer(sec);
      markActionExecuted(action.id, `⏱️ Timer de descanso iniciado (${sec}s)`);
      return;
    }

    if (action.type === 'load_routine_day_to_workout') {
      const availableDays = routineDays || routine?.days || [];
      const targetDay =
        availableDays.find((d) => d.id === action.payload.targetDayId) ||
        availableDays.find((d) => !d.isRestDay && d.exercises.length > 0) ||
        availableDays[0];
      if (!targetDay) return;

      loadRoutineDayIntoWorkout(targetDay);
      markActionExecuted(
        action.id,
        `⚡ ${targetDay.label} (${targetDay.focusTitle}) cargado en tu entrenamiento de hoy`
      );
      return;
    }

    if (action.type === 'update_routine_days' && action.payload.updatedDays) {
      const updated = action.payload.updatedDays;
      if (onApplyRoutineDays) {
        onApplyRoutineDays(updated);
      }
      if (routine) {
        void saveUserRoutine({ ...routine, days: updated }, false);
      }
      markActionExecuted(action.id, '✓ Tu rutina base fue actualizada y guardada con éxito');
      return;
    }

    if (action.type === 'generate_and_save_routine' && action.payload.generatedRoutine) {
      const newRtn = action.payload.generatedRoutine;
      if (onApplyRoutineDays) {
        onApplyRoutineDays(newRtn.days);
      }
      void saveUserRoutine(newRtn, false);
      markActionExecuted(action.id, `✓ Nueva rutina "${newRtn.name}" activada en tu cuenta`);
      return;
    }

    if (action.type === 'update_user_profile' && action.payload.profilePatch && profile) {
      const patch = action.payload.profilePatch;
      const nextProfile = {
        ...profile,
        ...(patch.weightKg !== undefined ? { weightKg: patch.weightKg } : {}),
        ...(patch.heightCm !== undefined ? { heightCm: patch.heightCm } : {}),
        ...(patch.bodyFatPercent !== undefined ? { bodyFatPercent: patch.bodyFatPercent } : {}),
        ...(patch.primaryGoal !== undefined ? { primaryGoal: patch.primaryGoal } : {}),
        workoutDefaults: {
          ...getResolvedWorkoutDefaults(profile),
          ...(patch.defaultRestSeconds !== undefined
            ? { defaultRestSeconds: patch.defaultRestSeconds }
            : {}),
          ...(patch.defaultEffectiveSets !== undefined
            ? { defaultEffectiveSets: patch.defaultEffectiveSets }
            : {}),
          ...(patch.defaultReps !== undefined ? { defaultReps: patch.defaultReps } : {}),
        },
        updatedAtIso: new Date().toISOString(),
      };
      void saveUserProfile(nextProfile);
      markActionExecuted(action.id, '✓ Parámetros de tu perfil actualizados y guardados');
      return;
    }

    if (action.type === 'modify_active_workout' && action.payload.workoutModification) {
      const mod = action.payload.workoutModification;
      if (mod.op === 'clear') {
        clearActiveWorkoutBlocks();
        markActionExecuted(action.id, '✓ Entrenamiento activo vaciado');
      } else if (mod.op === 'update_title' && mod.newTitle) {
        updateWorkoutTitle(mod.newTitle);
        markActionExecuted(action.id, `✓ Título actualizado a "${mod.newTitle}"`);
      }
      return;
    }

    if (action.type === 'add_to_active_workout') {
      const exName = action.payload.exerciseName;
      if (!exName) return;

      const targetMode = action.payload.mode || 'hypertrophy';
      const existingBlock =
        activeWorkout.blocks.find((b) => b.mode === targetMode) || activeWorkout.blocks[0];

      let blockId = existingBlock?.id;
      if (!blockId) {
        addBlockToWorkout(targetMode);
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

      markActionExecuted(action.id, `✓ "${exName}" añadido a tu entrenamiento activo`);
      return;
    }

    if (action.type === 'apply_routine_cleanup' && action.payload.cleanedDays) {
      const cleaned = action.payload.cleanedDays;
      if (onApplyRoutineDays) {
        onApplyRoutineDays(cleaned);
      }
      if (routine) {
        void saveUserRoutine({ ...routine, days: cleaned }, false);
      }
      markActionExecuted(
        action.id,
        '✓ Nombres limpios y cargas asignadas con éxito a tu rutina'
      );
      return;
    }

    if (action.type === 'add_to_routine') {
      if (action.payload.targetDayId && routine) {
        handleConfirmAddToRoutineDay(action.payload.targetDayId, action);
        markActionExecuted(
          action.id,
          `📋 "${action.payload.exerciseName}" añadido a tu rutina`
        );
        return;
      }
      setRoutineDayTarget({ action });
    }
  };

  const handleConfirmAddToRoutineDay = (dayId: string, directAction?: AiActionSuggestion) => {
    const action = directAction || routineDayTarget?.action;
    if (!routine || !action) return;

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
        ...(action.payload.targetWeightKg
          ? { targetWeightKg: action.payload.targetWeightKg }
          : {}),
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

    if (onApplyRoutineDays) {
      onApplyRoutineDays(updatedDays);
    }
    void saveUserRoutine(updatedRoutine, false);
    setRoutineDayTarget(null);
    markActionExecuted(action.id, `📋 "${exName}" añadido a tu rutina`);
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
                <span className="rounded-full bg-gothic/25 border border-gothic/40 px-1.5 py-0.2 text-[9px] font-mono text-gothic font-semibold">
                  {activeConfig.badge}
                </span>
              </div>
              <p className="text-[10px] text-brand-muted">
                {activeConfig.subtitle}
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
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 scroll-smooth overscroll-contain touch-pan-y"
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
                className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'bg-gothic/25 text-brand border border-gothic/40'
                    : 'bg-[#14111C] text-brand-muted border border-stoneborder/80'
                }`}
              >
                {m.role === 'assistant' ? (
                  <FormattedChatMessage content={m.content} />
                ) : (
                  <span className="whitespace-pre-line">{m.content}</span>
                )}
              </div>

              {/* Action Suggestion Pills from AI */}
              {m.suggestedActions && m.suggestedActions.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5 w-full max-w-[92%]">
                  <span className="text-[10px] font-semibold text-gothic uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Acciones directas en tu cuenta:
                  </span>
                  {m.suggestedActions.map((action) => {
                    const isDone = executedActionIds.has(action.id);
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => handleExecuteAction(action)}
                        className={`inline-flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all shadow-sm active:scale-95 ${
                          isDone
                            ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-200'
                            : 'border-gothic/40 bg-surface text-brand hover:border-gothic hover:bg-gothic/15'
                        }`}
                      >
                        <span className="truncate pr-2">
                          {isDone ? `✓ Aplicado: ${action.label.replace(/^[✓⚡📋✨▶️]+\s*/, '')}` : action.label}
                        </span>
                        {isDone ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 shrink-0 text-gothic" />
                        )}
                      </button>
                    );
                  })}
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
              {activeConfig.suggestions.map((sug, i) => (
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
              placeholder="Haz tu pregunta a la IA (ej: '¿Cómo optimizar mi rutina?')"
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
