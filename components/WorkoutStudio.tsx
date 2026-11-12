'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CardioDiscipline, TrainingMode } from '@/types/kairos';
import { useKairos } from '@/lib/kairosContext';
import { PolymorphicExerciseCard } from '@/components/PolymorphicExerciseCard';
import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { SoundSettingsButton } from '@/components/AudioMixerPanel';
import { AppUpdateButton } from '@/components/AppUpdateManager';
import {
  PostWorkoutAiCalibrationModal,
  CalibratedExerciseUpdate,
} from '@/components/PostWorkoutAiCalibrationModal';
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
  Heart,
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
    setActiveRoutineDayForToday,
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
    batchCalibrateExercises,
    finishAndAnalyzeWorkout,
    clearActiveWorkoutBlocks,
    setActiveTab,
  } = useKairos();

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [showAddModeSheet, setShowAddModeSheet] = useState(false);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [uncalibratedExercises, setUncalibratedExercises] = useState<any[]>([]);
  const [isTipExpanded, setIsTipExpanded] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [showTimerLogs, setShowTimerLogs] = useState(false);
  const [showExerciseSuggestions, setShowExerciseSuggestions] = useState(false);
  const [hasManuallyEditedTitle, setHasManuallyEditedTitle] = useState(false);
  const [selectedSuggestionDayId, setSelectedSuggestionDayId] = useState<string | null>(null);
  const [loadedDayFeedback, setLoadedDayFeedback] = useState<string | null>(null);
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

  // Active (non-rest) days in the user's routine
  const activeRoutineDays = useMemo(
    () => (routine?.days ?? []).filter((d) => !d.isRestDay),
    [routine]
  );

  // Default suggestion day = today's scheduled day (if active & populated), else first populated active routine day
  useEffect(() => {
    if (!routine) {
      setSelectedSuggestionDayId(null);
      return;
    }
    setSelectedSuggestionDayId((prev) => {
      if (prev && routine.days.some((d) => d.id === prev && !d.isRestDay)) {
        return prev;
      }
      if (
        todayRoutine.todayPlan &&
        !todayRoutine.todayPlan.isRestDay &&
        todayRoutine.todayPlan.exercises.length > 0
      ) {
        return todayRoutine.todayPlan.id;
      }
      const firstPopulated = activeRoutineDays.find((d) => d.exercises.length > 0);
      if (firstPopulated) return firstPopulated.id;
      if (todayRoutine.todayPlan && !todayRoutine.todayPlan.isRestDay) {
        return todayRoutine.todayPlan.id;
      }
      return activeRoutineDays[0]?.id ?? null;
    });
  }, [routine, todayRoutine.todayPlan, activeRoutineDays]);

  const activeSuggestionDay = useMemo(() => {
    if (!routine) return null;
    if (selectedSuggestionDayId) {
      const found = routine.days.find((d) => d.id === selectedSuggestionDayId);
      if (found) return found;
    }
    if (
      todayRoutine.todayPlan &&
      !todayRoutine.todayPlan.isRestDay &&
      todayRoutine.todayPlan.exercises.length > 0
    ) {
      return todayRoutine.todayPlan;
    }
    return (
      activeRoutineDays.find((d) => d.exercises.length > 0) ??
      (!todayRoutine.todayPlan?.isRestDay ? todayRoutine.todayPlan : activeRoutineDays[0] ?? null)
    );
  }, [activeRoutineDays, routine, selectedSuggestionDayId, todayRoutine.todayPlan]);

  const handleLoadFullRoutineDay = (dayToLoad: NonNullable<typeof activeSuggestionDay>) => {
    setSelectedSuggestionDayId(dayToLoad.id);
    setHasManuallyEditedTitle(false);
    loadRoutineDayIntoWorkout(dayToLoad);
    const countLabel =
      dayToLoad.exercises.length > 0 ? `${dayToLoad.exercises.length} ejercicios` : 'ejercicios IA';
    setLoadedDayFeedback(
      `✓ ${dayToLoad.label} · ${dayToLoad.focusTitle} (${countLabel}) cargado en tu entrenamiento de hoy.`
    );
    setTimeout(() => setLoadedDayFeedback(null), 4000);
  };

  // Synchronize session title to active day focusTitle automatically unless user manually typed a custom title
  useEffect(() => {
    if (!hasManuallyEditedTitle && activeSuggestionDay?.focusTitle) {
      if (
        !activeWorkout.title ||
        activeWorkout.title === activeWorkout.titlePlaceholder?.replace(/^Ej:\s*/i, '').trim()
      ) {
        updateWorkoutTitle(activeSuggestionDay.focusTitle);
      }
    }
  }, [
    activeSuggestionDay?.focusTitle,
    activeWorkout.title,
    activeWorkout.titlePlaceholder,
    hasManuallyEditedTitle,
    updateWorkoutTitle,
  ]);

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

  // Weekly consistency strip (L M X J V S D) & live session progress
  const weeklyActivity = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);

    const trainedDaysSet = new Set<string>();
    for (const s of sessions) {
      if (s.dateIso) {
        trainedDaysSet.add(s.dateIso.slice(0, 10));
      }
    }

    const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const days = labels.map((lbl, idx) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const isToday = d.toDateString() === now.toDateString();
      const trained = trainedDaysSet.has(iso);
      return { lbl, iso, isToday, trained };
    });

    const weekCount = days.filter((d) => d.trained).length;
    return { days, weekCount };
  }, [sessions]);

  const liveWorkoutStats = useMemo(() => {
    let totalSets = 0;
    let completedSets = 0;
    let tonnageKg = 0;

    for (const b of activeWorkout.blocks) {
      for (const ex of b.exercises) {
        for (const s of ex.hypertrophySets ?? []) {
          totalSets++;
          if (s.completed) {
            completedSets++;
            tonnageKg += (s.weightKg || 0) * (s.reps || 0);
          }
        }
        for (const s of ex.strengthSets ?? []) {
          totalSets++;
          if (s.completed) {
            completedSets++;
            tonnageKg += (s.weightKg || 0) * (s.reps || 0);
          }
        }
        for (const s of ex.calisthenicsDynamicSets ?? []) {
          totalSets++;
          if (s.completed) {
            completedSets++;
            tonnageKg += Math.max(0, s.addedWeightKg || 0) * (s.reps || 0);
          }
        }
        for (const s of ex.calisthenicsIsometricSets ?? []) {
          totalSets++;
          if (s.completed) completedSets++;
        }
        for (const s of ex.hyroxSets ?? []) {
          totalSets++;
          if (s.completed) completedSets++;
        }
        for (const s of ex.jumpRopeSets ?? []) {
          totalSets++;
          if (s.completed) completedSets++;
        }
        for (const s of ex.runningSets ?? []) {
          totalSets++;
          if (s.completed) completedSets++;
        }
        for (const s of ex.swimmingSets ?? []) {
          totalSets++;
          if (s.completed) completedSets++;
        }
        for (const s of ex.cyclingSets ?? []) {
          totalSets++;
          if (s.completed) completedSets++;
        }
      }
    }

    const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
    return { totalSets, completedSets, pct, tonnageKg: Math.round(tonnageKg) };
  }, [activeWorkout.blocks]);

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
    const fallbackTitle =
      activeWorkout.title.trim() ||
      activeSuggestionDay?.focusTitle ||
      todayRoutine.todayPlan?.focusTitle ||
      activeWorkout.titlePlaceholder?.replace(/^Ej:\s*/i, '').trim() ||
      'Entrenamiento del día';

    if (!activeWorkout.title.trim()) {
      updateWorkoutTitle(fallbackTitle);
    }

    const allExercises = activeWorkout.blocks.flatMap((b) => b.exercises);
    const uncalibrated = allExercises.filter(
      (ex) =>
        ex.catalogId.startsWith('custom') ||
        ex.muscleGroup === 'Personalizado' ||
        ex.muscleGroup === 'Músculo Principal'
    );

    if (uncalibrated.length > 0) {
      setUncalibratedExercises(uncalibrated);
      setShowCalibrationModal(true);
      return;
    }

    finishAndAnalyzeWorkout();
  };

  const handleConfirmCalibration = (calibrations: CalibratedExerciseUpdate[]) => {
    batchCalibrateExercises(calibrations);
    setShowCalibrationModal(false);
    setTimeout(() => {
      finishAndAnalyzeWorkout();
    }, 60);
  };

  // Only show Intervals and Isometric timers (never Rest timers)
  const timerLogs = useMemo(
    () => (activeWorkout.timerLogs ?? []).filter((t) => t.kind !== 'rest'),
    [activeWorkout.timerLogs]
  );

  return (
    <div className="pb-36">
      {/* ================= SERENE GOTHIC TOP BAR (NO TOP-LEFT STOPWATCH) ================= */}
      <header className="sticky top-0 z-30 border-b border-stoneborder bg-[#0E0D10] px-5 ios-header-safe-pt pb-3 transition-colors duration-200">
        <div className="flex items-center justify-between gap-2">
          <span className="font-gothic text-base font-bold tracking-[0.24em] text-[#EDE8DF] drop-shadow-sm select-none">
            KAIROS
          </span>

          <div className="flex items-center gap-1.5">
            <AppUpdateButton compact />
            <SoundSettingsButton />

            <button
              type="button"
              onClick={() => setActiveTab('timer')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stoneborder bg-surface px-2.5 py-1.5 text-xs font-medium text-brand-muted hover:border-gothic/50 hover:text-brand active:scale-95 transition-all duration-150"
              title="Abrir Pulsómetro y Telemetría Cardíaca Live"
            >
              <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500/20" />
              <span className="hidden sm:inline">Pulsómetro</span>
            </button>

            <button
              type="button"
              onClick={() => setOpenRoutineModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stoneborder bg-surface px-3 py-1.5 text-xs font-medium text-brand-muted hover:border-gothic/50 hover:text-brand active:scale-95 transition-all duration-150"
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
        <section className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-3.5 kairos-card-alive">
          {/* Motivational Quote + Weekly Consistency Strip */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              {user?.displayName ? (
                <span className="text-[11px] font-semibold tracking-wide text-gothic">
                  ❖ {user.displayName}
                </span>
              ) : (
                <span className="text-[11px] font-semibold tracking-wide text-gothic">
                  ❖ Atleta KAIROS
                </span>
              )}

              {/* Weekly Consistency Dots (L M X J V S D) */}
              <div className="flex items-center gap-1" title="Constancia semanal (Lunes a Domingo)">
                {weeklyActivity.days.map((d) => (
                  <div
                    key={d.iso}
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-mono font-bold transition-all ${
                      d.trained
                        ? 'bg-emerald-500/25 border border-emerald-400/70 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                        : d.isToday
                          ? 'border border-gothic/80 bg-gothic/15 text-gothic'
                          : 'border border-stoneborder bg-background/60 text-brand-subtle'
                    }`}
                  >
                    {d.trained ? '✓' : d.lbl}
                  </div>
                ))}
              </div>
            </div>

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
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md border border-gothic/40 bg-gothic/10 px-2 py-0.5 text-[10px] font-mono text-gothic">
                      📅 Hoy: {todayRoutine.todayDateLabelEs}
                    </span>
                    <span className="inline-flex items-center rounded-md border border-stoneborder bg-background/80 px-2 py-0.5 text-[10px] text-brand-muted">
                      {todayRoutine.scheduleModeLabelEs}
                    </span>
                    {todayRoutine.todayPlan.isRestDay && (
                      <span className="inline-flex items-center rounded-md border border-stoneborder bg-background px-2 py-0.5 text-[10px] text-brand-muted">
                        Día programado: Descanso
                      </span>
                    )}
                  </div>

                  <span className="block text-[11px] text-brand-muted pt-0.5">
                    {todayRoutine.completedToday
                      ? 'Entrenamiento de hoy cumplido'
                      : activeSuggestionDay
                        ? `Entrenamiento seleccionado · ${activeSuggestionDay.label}`
                        : todayRoutine.todayPlan.isRestDay
                          ? 'Plan de hoy'
                          : 'Entrenamiento de hoy'}
                  </span>
                  <h2 className="text-sm font-semibold text-brand">
                    {activeSuggestionDay?.focusTitle ?? todayRoutine.todayPlan.focusTitle}
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

              {loadedDayFeedback && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 text-xs font-medium text-emerald-200 flex items-center gap-2 animate-fade-up">
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>{loadedDayFeedback}</span>
                </div>
              )}

              {/* Day switcher pills so user can see and select any active day of their routine */}
              {activeRoutineDays.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  {activeRoutineDays.map((d) => {
                    const isSelected = activeSuggestionDay?.id === d.id;
                    const isTodayPlan = todayRoutine.todayPlan?.id === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedSuggestionDayId(d.id);
                          setActiveRoutineDayForToday(d.id);
                          if (!hasManuallyEditedTitle) {
                            updateWorkoutTitle(d.focusTitle);
                          }
                        }}
                        className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                          isSelected
                            ? 'border-gothic/70 bg-elevated text-brand font-semibold shadow-sm'
                            : 'border-stoneborder bg-background/60 text-brand-muted hover:text-brand'
                        }`}
                      >
                        {d.label}
                        {isTodayPlan ? ' (Hoy)' : ''} · {d.focusTitle}{' '}
                        <span className="font-mono text-[10px] text-gothic">
                          ({d.exercises.length})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* OPTIONAL COLLAPSIBLE SUGGESTIONS SECTION */}
              {activeSuggestionDay && activeSuggestionDay.exercises.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-stoneborder/50">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowExerciseSuggestions((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand-muted hover:text-brand transition-colors py-0.5"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-gothic" />
                      <span>
                        Ejercicios de {activeSuggestionDay.label} ({activeSuggestionDay.focusTitle})
                      </span>
                      <span className="rounded-full bg-surface border border-stoneborder px-1.5 py-0.2 text-[10px] font-mono text-gothic">
                        {activeSuggestionDay.exercises.length}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-brand-muted transition-transform duration-200 ${
                          showExerciseSuggestions ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowExerciseSuggestions((v) => !v)}
                      className="text-[11px] text-gothic hover:underline"
                    >
                      {showExerciseSuggestions ? 'Ocultar' : 'Ver ejercicios'}
                    </button>
                  </div>

                  {showExerciseSuggestions && (
                    <div className="flex flex-col gap-1.5 pt-1 animate-fade-up">
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
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-all active:scale-95 ${
                              alreadyAdded
                                ? 'border-gothic/45 bg-gothic/15 text-brand'
                                : 'border-stoneborder bg-background/90 text-brand hover:border-gothic/60'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-mono text-[10px] text-gothic shrink-0">
                                {index + 1}.
                              </span>
                              <span className="truncate font-medium">{pres.name}</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[10px] text-brand-muted tabular-nums">
                                {pres.sets}×{pres.repRangeLabel.replace(/\s*reps?/i, '')}
                              </span>
                              {pres.targetWeightKg !== undefined && pres.targetWeightKg > 0 && (
                                <span className="font-mono text-[10px] text-gothic">
                                  {pres.targetWeightKg}kg
                                </span>
                              )}
                              {alreadyAdded ? (
                                <Check className="h-3.5 w-3.5 text-gothic shrink-0" />
                              ) : (
                                <Plus className="h-3.5 w-3.5 text-brand-muted shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Empty day guard if user clicks a day pill that has 0 exercises */}
              {activeSuggestionDay &&
                !activeSuggestionDay.isRestDay &&
                activeSuggestionDay.exercises.length === 0 && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 space-y-2">
                    <p className="text-xs text-amber-200/90 leading-snug">
                      El <strong>{activeSuggestionDay.label}</strong> (
                      <strong>{activeSuggestionDay.focusTitle}</strong>) aún no tiene ejercicios
                      asignados en tu rutina.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadFullRoutineDay(activeSuggestionDay)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-elevated border border-gothic/50 py-2 px-3 text-xs font-semibold text-brand hover:border-gothic"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-gothic" />
                        Completar {activeSuggestionDay.focusTitle} con IA y Cargar
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenRoutineModal(true)}
                        className="rounded-xl border border-stoneborder bg-background py-2 px-3 text-xs text-brand-muted hover:text-brand"
                      >
                        Editar rutina
                      </button>
                    </div>
                  </div>
                )}

              {activeSuggestionDay && activeSuggestionDay.exercises.length > 0 && (
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleLoadFullRoutineDay(activeSuggestionDay)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#DEB868]/25 via-[#DEB868]/15 to-[#DEB868]/25 border border-gothic/60 py-2.5 px-3 text-xs font-semibold text-brand shadow-[0_0_20px_rgba(222,184,104,0.12)] hover:border-gothic hover:bg-gothic/25 active:scale-[0.99] transition-all"
                  >
                    <Play className="h-3.5 w-3.5 fill-current text-gothic" />
                    <span>
                      Cargar día completo ({activeSuggestionDay.label} ·{' '}
                      {activeSuggestionDay.focusTitle})
                    </span>
                  </button>

                  {!todayRoutine.todayPlan.isRestDay && !todayRoutine.completedToday && (
                    <button
                      type="button"
                      onClick={() => adaptRoutineOnSkippedDay('skip_today')}
                      className="rounded-xl border border-stoneborder bg-background py-2.5 px-3 text-xs text-brand-muted hover:text-brand active:scale-95"
                    >
                      Saltar hoy
                    </button>
                  )}
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
            onChange={(e) => {
              setHasManuallyEditedTitle(true);
              updateWorkoutTitle(e.target.value);
            }}
            placeholder={dynamicExamplePlaceholder}
            className="w-full rounded-xl border border-stoneborder bg-surface px-3.5 py-2.5 text-[16px] font-medium text-brand placeholder-brand-subtle transition-colors focus:border-gothic focus:outline-none"
          />

          <p className="text-[11px] text-brand-subtle">
            {activeWorkout.title.trim()
              ? 'Puedes editar este título si lo deseas antes de guardar tu sesión.'
              : `Opcional · Se guardará automáticamente como "${
                  activeSuggestionDay?.focusTitle || 'Entrenamiento del día'
                }".`}
          </p>
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

        {/* ================= LIVE SESSION PROGRESS BAR & TONNAGE HUD ================= */}
        {liveWorkoutStats.totalSets > 0 && (
          <div className="rounded-2xl border border-stoneborder bg-surface p-3.5 space-y-2 kairos-card-alive">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${
                    liveWorkoutStats.pct === 100
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                      : 'bg-gothic animate-pulse'
                  }`}
                />
                <span className="font-semibold text-brand">
                  {liveWorkoutStats.pct === 100
                    ? '¡Sesión 100% completada!'
                    : `Progreso en vivo: ${liveWorkoutStats.completedSets}/${liveWorkoutStats.totalSets} series`}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                {liveWorkoutStats.tonnageKg > 0 && (
                  <span className="rounded-md border border-stoneborder bg-background/80 px-2 py-0.5 text-brand-muted">
                    {liveWorkoutStats.tonnageKg.toLocaleString('es-ES')} kg
                  </span>
                )}
                <span
                  className={`font-bold ${
                    liveWorkoutStats.pct === 100 ? 'text-emerald-400' : 'text-gothic'
                  }`}
                >
                  {liveWorkoutStats.pct}%
                </span>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-background border border-stoneborder/70">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  liveWorkoutStats.pct === 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                    : 'bg-gradient-to-r from-[#A88948] via-[#DEB868] to-emerald-400'
                }`}
                style={{ width: `${Math.max(4, liveWorkoutStats.pct)}%` }}
              />
            </div>
          </div>
        )}

        {/* ================= WORKOUT BLOCKS ================= */}
        <div className="space-y-4">
          {activeWorkout.blocks.map((block) => {
            const meta = MODE_META[block.mode];

            return (
              <section
                key={block.id}
                className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-4 kairos-card-alive"
              >
                {/* Clean Block Header with vibrant discipline accent dot */}
                <div className="flex items-center justify-between gap-2 border-b border-stoneborder pb-2.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: meta.accentHex }}
                    />
                    <input
                      type="text"
                      value={block.title}
                      aria-label="Título del bloque"
                      onChange={(e) => updateBlockTitle(block.id, e.target.value)}
                      className="w-full truncate bg-transparent font-gothic text-[16px] font-semibold text-brand focus:outline-none"
                    />
                  </div>

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
                  <Plus className="h-3.5 w-3.5 text-gothic" />
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
            className="w-full flex items-center justify-between rounded-2xl border border-stoneborder bg-surface px-4 py-3.5 text-left transition-colors hover:border-gothic/50 kairos-card-alive"
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
                      <span className="shrink-0" style={{ color: m.accentHex }}>
                        <Icon className="h-4 w-4 shrink-0" />
                      </span>
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
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DEB868] via-[#E8C87A] to-[#C89D48] py-3.5 px-5 text-xs font-bold uppercase tracking-widest text-[#0B0A0E] shadow-[0_6px_28px_rgba(222,184,104,0.3)] hover:brightness-105 active:scale-[0.99] transition-all"
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
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

      <PostWorkoutAiCalibrationModal
        isOpen={showCalibrationModal}
        uncalibratedExercises={uncalibratedExercises}
        onConfirm={handleConfirmCalibration}
        onCancel={() => {
          setShowCalibrationModal(false);
          finishAndAnalyzeWorkout();
        }}
      />
    </div>
  );
}
