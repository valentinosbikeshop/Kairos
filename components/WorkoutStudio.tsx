'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CardioDiscipline, TrainingMode } from '@/types/kairos';
import { useKairos } from '@/lib/kairosContext';
import { PolymorphicExerciseCard } from '@/components/PolymorphicExerciseCard';
import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { SoundSettingsButton } from '@/components/AudioMixerPanel';
import { AppUpdateButton } from '@/components/AppUpdateManager';
import { resolveTodayRoutineStatus } from '@/lib/aiRoutineEngine';
import { getContextualTips, getDailyMotivationalQuote } from '@/lib/knowledgeBase';
import { formatMmSs, MODE_META } from '@/lib/formatters';
import {
  Activity,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Dumbbell,
  Flame,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Timer,
  Trash2,
  X,
  Zap,
} from 'lucide-react';

export function WorkoutStudio() {
  const {
    user,
    routine,
    sessions,
    loadRoutineDayIntoWorkout,
    addRoutineExerciseToWorkout,
    adaptRoutineOnSkippedDay,
    setOpenRoutineModal,
    setOpenRationaleModal,
    activeWorkout,
    titleRequiredError,
    updateWorkoutTitle,
    addBlockToWorkout,
    removeBlockFromWorkout,
    updateBlockTitle,
    removeTimerLog,
    finishAndAnalyzeWorkout,
    clearActiveWorkoutBlocks,
    setActiveTab,
  } = useKairos();

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [showAddModeSheet, setShowAddModeSheet] = useState(false);
  const [isTipExpanded, setIsTipExpanded] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [showTimerLogs, setShowTimerLogs] = useState(false);
  const [selectedSuggestionDayId, setSelectedSuggestionDayId] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<{
    blockId: string;
    mode: TrainingMode;
    cardioDiscipline?: CardioDiscipline;
  } | null>(null);

  const dailyQuote = useMemo(() => getDailyMotivationalQuote(), []);

  const todayRoutine = useMemo(
    () => resolveTodayRoutineStatus(routine, sessions),
    [routine, sessions]
  );

  // Active (non-rest) days in the user's routine that contain exercises
  const activeRoutineDays = useMemo(
    () => (routine?.days ?? []).filter((d) => !d.isRestDay),
    [routine]
  );

  // Default suggestion day = today's scheduled day (if active), else first active routine day
  useEffect(() => {
    if (!routine) {
      setSelectedSuggestionDayId(null);
      return;
    }
    if (todayRoutine.todayPlan && !todayRoutine.todayPlan.isRestDay) {
      setSelectedSuggestionDayId(todayRoutine.todayPlan.id);
    } else if (activeRoutineDays.length > 0) {
      setSelectedSuggestionDayId((prev) =>
        prev && activeRoutineDays.some((d) => d.id === prev) ? prev : activeRoutineDays[0].id
      );
    }
  }, [routine, todayRoutine.todayPlan, activeRoutineDays]);

  const activeSuggestionDay = useMemo(() => {
    if (!routine) return null;
    if (
      selectedSuggestionDayId &&
      todayRoutine.todayPlan &&
      todayRoutine.todayPlan.id === selectedSuggestionDayId
    ) {
      return todayRoutine.todayPlan;
    }
    return (
      activeRoutineDays.find((d) => d.id === selectedSuggestionDayId) ??
      (!todayRoutine.todayPlan?.isRestDay ? todayRoutine.todayPlan : activeRoutineDays[0] ?? null)
    );
  }, [activeRoutineDays, routine, selectedSuggestionDayId, todayRoutine.todayPlan]);

  // Track which exercises are already added in today's active workout
  const addedCatalogIdsAndNames = useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const blk of activeWorkout.blocks) {
      for (const ex of blk.exercises) {
        if (ex.catalogId) ids.add(ex.catalogId);
        names.add(ex.name.trim().toLowerCase());
      }
    }
    return { ids, names };
  }, [activeWorkout.blocks]);

  const activeModes = useMemo(
    () => Array.from(new Set(activeWorkout.blocks.map((b) => b.mode))),
    [activeWorkout.blocks]
  );

  const contextualTips = useMemo(() => getContextualTips(activeModes), [activeModes]);
  const currentTip = contextualTips[tipIndex % contextualTips.length] ?? contextualTips[0];

  const totalExercisesCount = useMemo(
    () => activeWorkout.blocks.reduce((acc, b) => acc + b.exercises.length, 0),
    [activeWorkout.blocks]
  );

  const dynamicExamplePlaceholder = useMemo(() => {
    if (activeWorkout.titlePlaceholder) return activeWorkout.titlePlaceholder;
    if (activeModes.length > 0) {
      const names = activeModes.map((m) => MODE_META[m].label).join(' + ');
      return `Ej: ${names}`;
    }
    if (todayRoutine.todayPlan && !todayRoutine.todayPlan.isRestDay) {
      return `Ej: ${todayRoutine.todayPlan.focusTitle}`;
    }
    return 'Ej: Torso Fuerza — Día 1';
  }, [activeModes, activeWorkout.titlePlaceholder, todayRoutine.todayPlan]);

  const handleFinishSession = () => {
    const res = finishAndAnalyzeWorkout();
    if (!res.ok && res.reason === 'missing_title') {
      titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 220);
    }
  };

  // Only show Intervals and Isometric timers (never Rest timers)
  const timerLogs = useMemo(
    () => (activeWorkout.timerLogs ?? []).filter((t) => t.kind !== 'rest'),
    [activeWorkout.timerLogs]
  );

  return (
    <div className="pb-36">
      {/* ================= SERENE GOTHIC TOP BAR (NO TOP-LEFT STOPWATCH) ================= */}
      <header className="sticky top-0 z-30 border-b border-stoneborder bg-background/95 px-5 pt-[max(0.85rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <span className="font-gothic text-base font-semibold tracking-[0.22em] text-brand">
            KAIROS
          </span>

          <div className="flex items-center gap-1.5">
            <AppUpdateButton compact />
            <SoundSettingsButton />

            <button
              type="button"
              onClick={() => setOpenRoutineModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stoneborder bg-surface px-3 py-1.5 text-xs font-medium text-brand-muted hover:border-gothic/50 hover:text-brand active:scale-95"
            >
              <CalendarCheck className="h-3.5 w-3.5 text-gothic" />
              <span>Mi Rutina</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN WORKSPACE ================= */}
      <div className="px-5 pt-4 space-y-5">
        {/* ================= DAILY QUOTE & TODAY'S ROUTINE + ORDERED EXERCISE SUGGESTIONS ================= */}
        <section className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-3.5">
          {/* Motivational Quote (No principle word like "Firmeza", no quotation marks) */}
          <div className="space-y-1">
            {user?.displayName && (
              <span className="text-[11px] text-gothic">❖ {user.displayName}</span>
            )}
            <p className="font-gothic text-xs text-brand leading-relaxed">
              {dailyQuote.text}
            </p>
          </div>

          <div className="gothic-divider" />

          {/* Routine Status & Ordered Quick-Add Suggestions for Today */}
          {routine && todayRoutine.todayPlan ? (
            <div className="space-y-3">
              {/* Missed Yesterday Recovery Suggestion */}
              {todayRoutine.missedPreviousDayPlan && !todayRoutine.isAdaptedToday && (
                <div className="rounded-xl border border-gothic/35 bg-background/80 p-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-brand-muted leading-snug">
                    Ayer quedó pendiente{' '}
                    <strong className="text-brand">
                      {todayRoutine.missedPreviousDayPlan.focusTitle}
                    </strong>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      adaptRoutineOnSkippedDay(
                        'recover_yesterday',
                        todayRoutine.missedPreviousDayPlan
                      )
                    }
                    className="shrink-0 rounded-lg border border-gothic/50 bg-gothic/15 px-2.5 py-1.5 text-[11px] font-semibold text-brand"
                  >
                    Retomar hoy
                  </button>
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] text-brand-muted">
                    {todayRoutine.completedToday
                      ? 'Entrenamiento de hoy cumplido'
                      : todayRoutine.todayPlan.isRestDay
                        ? 'Plan de hoy'
                        : 'Entrenamiento de hoy'}
                  </span>
                  <h2 className="text-sm font-semibold text-brand mt-0.5">
                    {todayRoutine.todayPlan.focusTitle}
                  </h2>
                  {todayRoutine.adaptationMessage && (
                    <p className="text-[11px] text-gothic mt-0.5 leading-snug">
                      {todayRoutine.adaptationMessage}
                    </p>
                  )}
                </div>

                {routine.rationale && (
                  <button
                    type="button"
                    onClick={() => setOpenRationaleModal(true)}
                    className="shrink-0 text-[11px] text-gothic hover:underline"
                  >
                    ¿Por qué esta rutina?
                  </button>
                )}
              </div>

              {/* Day switcher pills if user wants suggestions from today or another day of their routine */}
              {activeRoutineDays.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  {activeRoutineDays.map((d) => {
                    const isSelected = activeSuggestionDay?.id === d.id;
                    const isTodayPlan = todayRoutine.todayPlan?.id === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedSuggestionDayId(d.id)}
                        className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                          isSelected
                            ? 'border-gothic/60 bg-elevated text-brand font-medium'
                            : 'border-stoneborder bg-background/60 text-brand-muted hover:text-brand'
                        }`}
                      >
                        {d.label}
                        {isTodayPlan ? ' (Hoy)' : ''} · {d.focusTitle}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ORDERED QUICK-ADD SUGGESTION BUTTONS FROM USER'S ROUTINE */}
              {activeSuggestionDay && activeSuggestionDay.exercises.length > 0 && (
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between text-[11px] text-brand-muted">
                    <span>Sugerencias en tu orden ({activeSuggestionDay.focusTitle}):</span>
                    <span className="text-[10px] text-gothic">Toca para añadir</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {activeSuggestionDay.exercises.map((pres, index) => {
                      const alreadyAdded =
                        addedCatalogIdsAndNames.ids.has(pres.catalogId) ||
                        addedCatalogIdsAndNames.names.has(pres.name.trim().toLowerCase());

                      return (
                        <button
                          key={`${pres.catalogId}_${index}`}
                          type="button"
                          onClick={() =>
                            addRoutineExerciseToWorkout(pres, activeSuggestionDay.focusTitle)
                          }
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left text-xs transition-all active:scale-95 ${
                            alreadyAdded
                              ? 'border-gothic/45 bg-gothic/15 text-brand'
                              : 'border-stoneborder bg-background/90 text-brand hover:border-gothic/60'
                          }`}
                        >
                          <span className="font-mono text-[10px] text-gothic">{index + 1}.</span>
                          <span className="font-medium">{pres.name}</span>
                          <span className="text-[10px] text-brand-muted tabular-nums">
                            {pres.sets}×{pres.repRangeLabel.replace(/\s*reps?/i, '')}
                          </span>
                          {alreadyAdded ? (
                            <Check className="h-3.5 w-3.5 text-gothic shrink-0" />
                          ) : (
                            <Plus className="h-3.5 w-3.5 text-gothic shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!todayRoutine.todayPlan.isRestDay && !todayRoutine.completedToday && (
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      todayRoutine.todayPlan && loadRoutineDayIntoWorkout(todayRoutine.todayPlan)
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-elevated border border-gothic/40 py-2.5 px-3 text-xs font-semibold text-brand hover:border-gothic active:scale-[0.99]"
                  >
                    <Play className="h-3.5 w-3.5 fill-current text-gothic" />
                    Cargar día completo
                  </button>

                  <button
                    type="button"
                    onClick={() => adaptRoutineOnSkippedDay('skip_today')}
                    className="rounded-xl border border-stoneborder bg-background py-2.5 px-3 text-xs text-brand-muted hover:text-brand active:scale-95"
                  >
                    Saltar hoy
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-brand-muted">
                Sin rutina diaria configurada aún.
              </span>
              <button
                type="button"
                onClick={() => setOpenRoutineModal(true)}
                className="inline-flex items-center gap-1 rounded-xl border border-gothic/40 bg-gothic/10 px-3 py-1.5 text-xs font-medium text-brand"
              >
                <Sparkles className="h-3.5 w-3.5 text-gothic" />
                Crear o importar rutina
              </button>
            </div>
          )}
        </section>

        {/* ================= SESSION TITLE (GREY EXAMPLE PLACEHOLDER) ================= */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="workout-title-input" className="text-xs text-brand-muted">
              Título de la sesión de hoy
            </label>
            {activeWorkout.blocks.length > 0 && (
              <button
                type="button"
                onClick={clearActiveWorkoutBlocks}
                className="text-xs text-brand-subtle hover:text-brand"
              >
                Limpiar
              </button>
            )}
          </div>

          <input
            ref={titleInputRef}
            id="workout-title-input"
            type="text"
            value={activeWorkout.title}
            onChange={(e) => updateWorkoutTitle(e.target.value)}
            placeholder={dynamicExamplePlaceholder}
            className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-[16px] font-medium text-brand placeholder-brand-subtle transition-colors focus:outline-none ${
              titleRequiredError
                ? 'border-status-regress'
                : 'border-stoneborder focus:border-gothic'
            }`}
          />

          {titleRequiredError ? (
            <p className="text-xs text-status-regress">
              Escribe el nombre de tu sesión para poder guardarla.
            </p>
          ) : (
            !activeWorkout.title.trim() && (
              <p className="text-[11px] text-brand-subtle">
                Ejemplo en gris · Edítalo con tu propio título al guardar.
              </p>
            )
          )}
        </div>

        {/* ================= AUTO-RECORDED INTERVALS & ISOMETRICS ONLY ================= */}
        {timerLogs.length > 0 && (
          <div className="rounded-2xl border border-stoneborder bg-surface overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTimerLogs((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left"
            >
              <div className="flex items-center gap-2 text-xs text-brand-muted">
                <Timer className="h-3.5 w-3.5 text-gothic" />
                <span>Intervalos e isometrías hoy ({timerLogs.length})</span>
              </div>
              {showTimerLogs ? (
                <ChevronUp className="h-3.5 w-3.5 text-brand-subtle" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-brand-subtle" />
              )}
            </button>

            {showTimerLogs && (
              <div className="divide-y divide-stoneborder border-t border-stoneborder bg-background/50 px-4 py-1">
                {timerLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-2 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="truncate font-medium text-brand block">{log.label}</span>
                      <span className="text-[11px] text-brand-muted tabular-nums">
                        {formatMmSs(log.elapsedSeconds)} ·{' '}
                        {log.endedReason === 'completed' ? 'Completado' : 'Detenido'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTimerLog(log.id)}
                      className="p-1 text-brand-subtle hover:text-brand"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= WORKOUT BLOCKS ================= */}
        <div className="space-y-4">
          {activeWorkout.blocks.map((block) => {
            const meta = MODE_META[block.mode];

            return (
              <section
                key={block.id}
                className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-4"
              >
                {/* Clean Block Header */}
                <div className="flex items-center justify-between gap-2 border-b border-stoneborder pb-2.5">
                  <input
                    type="text"
                    value={block.title}
                    aria-label="Título del bloque"
                    onChange={(e) => updateBlockTitle(block.id, e.target.value)}
                    className="w-full truncate bg-transparent font-gothic text-[16px] font-semibold text-brand focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => removeBlockFromWorkout(block.id)}
                    aria-label="Eliminar bloque"
                    className="p-1 text-brand-subtle hover:text-status-regress"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Exercises */}
                <div className="space-y-4">
                  {block.exercises.map((ex) => (
                    <PolymorphicExerciseCard key={ex.id} blockId={block.id} exercise={ex} />
                  ))}
                </div>

                {/* Add Exercise Trigger */}
                <button
                  type="button"
                  onClick={() =>
                    setPickerTarget({
                      blockId: block.id,
                      mode: block.mode,
                      cardioDiscipline: block.cardioDiscipline,
                    })
                  }
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-stoneborder bg-background/70 py-2.5 text-xs font-medium text-brand-muted hover:border-gothic/50 hover:text-brand active:scale-[0.99]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir ejercicio ({meta.label})
                </button>
              </section>
            );
          })}
        </div>

        {/* ================= ADD MODE BUTTON ================= */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAddModeSheet((v) => !v)}
            className="w-full flex items-center justify-between rounded-2xl border border-stoneborder bg-surface px-4 py-3.5 text-left transition-colors hover:border-gothic/50"
          >
            <div className="flex items-center gap-2.5">
              <Plus className="h-4 w-4 text-gothic" />
              <span className="text-xs font-semibold text-brand">
                Añadir Bloque de Entrenamiento
              </span>
            </div>
            <ChevronRight
              className={`h-4 w-4 text-brand-subtle transition-transform ${
                showAddModeSheet ? 'rotate-90' : ''
              }`}
            />
          </button>

          {showAddModeSheet && (
            <div className="rounded-2xl border border-stoneborder bg-surface p-3 space-y-1.5 animate-fade-up">
              {(
                [
                  { mode: 'hypertrophy', icon: Dumbbell },
                  { mode: 'strength', icon: Zap },
                  { mode: 'calisthenics', icon: Activity },
                  { mode: 'hyrox', icon: Flame },
                ] as { mode: TrainingMode; icon: React.ComponentType<{ className?: string }> }[]
              ).map(({ mode, icon: Icon }) => {
                const m = MODE_META[mode];
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      addBlockToWorkout(mode);
                      setShowAddModeSheet(false);
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-stoneborder bg-background/70 px-3.5 py-2.5 text-left hover:border-gothic/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-gothic shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-brand block">{m.label}</span>
                        <span className="text-[11px] text-brand-muted">{m.description}</span>
                      </div>
                    </div>
                    <Plus className="h-3.5 w-3.5 text-brand-subtle" />
                  </button>
                );
              })}

              <div className="pt-2 border-t border-stoneborder">
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'jumprope', label: 'Cuerda' },
                      { id: 'running', label: 'Running' },
                      { id: 'swimming', label: 'Natación' },
                      { id: 'cycling', label: 'Bici / Remo' },
                    ] as { id: CardioDiscipline; label: string }[]
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        addBlockToWorkout('cardio', d.id);
                        setShowAddModeSheet(false);
                      }}
                      className="rounded-xl border border-stoneborder bg-background/70 px-3 py-2 text-left text-xs text-brand hover:border-gothic/50"
                    >
                      + {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= FINISH & SAVE SESSION CTA ================= */}
        {(totalExercisesCount > 0 || timerLogs.length > 0) && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleFinishSession}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 px-5 text-xs font-bold uppercase tracking-widest text-background shadow-lg active:scale-[0.99]"
            >
              <Check className="h-4 w-4" />
              Finalizar y Guardar Sesión
            </button>
          </div>
        )}

        {/* ================= COMPACT EXPANDABLE SCIENCE NOTE (AT END OF PAGE) ================= */}
        {currentTip && (
          <div className="rounded-2xl border border-stoneborder bg-surface overflow-hidden mt-2">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => setIsTipExpanded((v) => !v)}
                className="flex-1 min-w-0 text-left"
              >
                <span className="block text-[10.5px] text-gothic">
                  Nota científica · {currentTip.year}
                </span>
                <p className="text-xs font-medium text-brand leading-snug mt-0.5">
                  {currentTip.title}
                </p>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setTipIndex((prev) => prev + 1)}
                  aria-label="Siguiente consejo científico"
                  className="p-1.5 text-brand-subtle hover:text-brand"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsTipExpanded((v) => !v)}
                  aria-label={isTipExpanded ? 'Contraer' : 'Leer completo'}
                  className="p-1.5 text-brand-subtle hover:text-brand"
                >
                  {isTipExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {isTipExpanded && (
              <div className="border-t border-stoneborder bg-background/60 px-4 py-3.5 space-y-2.5 animate-fade-up">
                <p className="text-xs text-brand leading-relaxed">
                  {currentTip.plainExplanation}
                </p>
                <p className="border-l-2 border-gothic/60 pl-3 text-xs text-brand-muted leading-relaxed">
                  {currentTip.practicalAction}
                </p>
                <div className="flex items-center justify-between pt-1 text-[11px] text-brand-subtle">
                  <span>{currentTip.citation}</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('science')}
                    className="inline-flex items-center gap-1 text-gothic hover:underline"
                  >
                    <BookOpen className="h-3 w-3" />
                    Ver más ciencia
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {pickerTarget && (
        <ExercisePickerModal
          isOpen={true}
          onClose={() => setPickerTarget(null)}
          blockId={pickerTarget.blockId}
          mode={pickerTarget.mode}
          defaultCardioDiscipline={pickerTarget.cardioDiscipline}
        />
      )}
    </div>
  );
}
