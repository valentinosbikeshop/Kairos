'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  RoutineDayPlan,
  RoutineExercisePrescription,
  RoutineRationale,
  RoutineScheduleType,
  TrainingMode,
  UserProfile,
  UserRoutine,
} from '@/types/kairos';
import {
  generateScientificRoutine,
  ORDERED_WEEKDAYS,
} from '@/lib/aiRoutineEngine';
import { BUILTIN_EXERCISES, smartSearchExercises } from '@/lib/exerciseDatabase';
import { resolveExerciseIntelligently } from '@/lib/exerciseClassifierEngine';
import { getResolvedWorkoutDefaults, MODE_META, toLocalDateKey, uid } from '@/lib/formatters';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

interface RoutineSetupConfiguratorProps {
  profile: UserProfile | null;
  existingRoutine?: UserRoutine | null;
  onSaveRoutine: (routine: UserRoutine) => Promise<void> | void;
  onSkipOptional?: () => void;
}

/**
 * Downscales and normalizes browser/iOS images (including large photos or Safari-decoded HEIC)
 * onto a clean PNG canvas before sending to OCR for speed and clarity.
 */
async function normalizeImageFileForOcr(file: File): Promise<File> {
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|heic)$/i.test(file.name)) {
    return file;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      try {
        const maxDim = 1800;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        // Fill white background (in case of transparent PNG screenshots) and draw crisp image
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanBase = file.name.replace(/\.[^.]+$/, '') || 'rutina';
            resolve(new File([blob], `${cleanBase}.png`, { type: 'image/png' }));
          },
          'image/png',
          0.95
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

export function RoutineSetupConfigurator({
  profile,
  existingRoutine,
  onSaveRoutine,
  onSkipOptional,
}: RoutineSetupConfiguratorProps) {
  const [pathMode, setPathMode] = useState<'choice' | 'ai' | 'manual'>(
    existingRoutine ? (existingRoutine.source === 'manual' ? 'manual' : 'ai') : 'choice'
  );

  // AI Generator State
  const [daysPerWeek, setDaysPerWeek] = useState(
    profile?.experienceLevel === 'beginner' ? 3 : 4
  );
  const [minutesPerSession, setMinutesPerSession] = useState(60);
  const [equipment, setEquipment] = useState<'gym' | 'dumbbells_home' | 'calisthenics'>('gym');
  const [aiScheduleType, setAiScheduleType] = useState<RoutineScheduleType>('weekday');
  const [userPrompt, setUserPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedRoutine, setGeneratedRoutine] = useState<UserRoutine | null>(
    existingRoutine?.source === 'ai_science' ? existingRoutine : null
  );
  const [showWhyExplanation, setShowWhyExplanation] = useState(false);

  // Manual Routine Builder State
  const [manualName, setManualName] = useState(
    existingRoutine?.source === 'manual' ? existingRoutine.name : 'Mi Rutina Personal'
  );
  const [manualType, setManualType] = useState<RoutineScheduleType>(
    existingRoutine?.scheduleType ?? 'weekday'
  );
  const [weekdayPlans, setWeekdayPlans] = useState<RoutineDayPlan[]>(() => {
    if (existingRoutine?.scheduleType === 'weekday' && existingRoutine.days.length === 7) {
      return existingRoutine.days;
    }
    return ORDERED_WEEKDAYS.map((wd) => ({
      id: uid('rday'),
      label: wd.label,
      weekdayIndex: wd.index,
      isRestDay: ![1, 3, 5].includes(wd.index),
      focusTitle:
        wd.index === 1
          ? 'Empuje'
          : wd.index === 3
            ? 'Tirón'
            : wd.index === 5
              ? 'Pierna'
              : 'Descanso',
      primaryMode: 'hypertrophy',
      estimatedMinutes: 60,
      exercises: [],
    }));
  });

  const [cyclicPlans, setCyclicPlans] = useState<RoutineDayPlan[]>(() => {
    if (existingRoutine?.scheduleType === 'cyclic' && existingRoutine.days.length > 0) {
      return existingRoutine.days;
    }
    return [
      {
        id: uid('rday'),
        label: 'Día 1',
        isRestDay: false,
        focusTitle: 'Torso',
        primaryMode: 'hypertrophy',
        estimatedMinutes: 60,
        exercises: [],
      },
      {
        id: uid('rday'),
        label: 'Día 2',
        isRestDay: false,
        focusTitle: 'Pierna',
        primaryMode: 'hypertrophy',
        estimatedMinutes: 60,
        exercises: [],
      },
      {
        id: uid('rday'),
        label: 'Día 3',
        isRestDay: true,
        focusTitle: 'Descanso',
        primaryMode: 'hypertrophy',
        estimatedMinutes: 0,
        exercises: [],
      },
    ];
  });

  // File / Image / PDF AI Extraction State
  const routineFileInputRef = useRef<HTMLInputElement | null>(null);
  const [showImporter, setShowImporter] = useState<boolean>(
    () => !existingRoutine || existingRoutine.days.every((d) => d.exercises.length === 0)
  );
  const [extractingFile, setExtractingFile] = useState(false);
  const [extractionFeedback, setExtractionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [extractedRawText, setExtractedRawText] = useState('');
  const [showExtractedTextEditor, setShowExtractedTextEditor] = useState(false);

  // Mini inline exercise search for manual routine day
  const [addingExForDayId, setAddingExForDayId] = useState<string | null>(null);
  const [exSearch, setExSearch] = useState('');

  const matchedExercises = useMemo(() => {
    if (!addingExForDayId) return [];
    const targetDay = [...weekdayPlans, ...cyclicPlans].find((d) => d.id === addingExForDayId);
    const targetMode: TrainingMode = targetDay?.primaryMode ?? 'hypertrophy';
    return smartSearchExercises(BUILTIN_EXERCISES, targetMode, exSearch).slice(0, 8);
  }, [addingExForDayId, cyclicPlans, exSearch, weekdayPlans]);

  const applyImportedRoutineToEditor = (
    imported: UserRoutine,
    activeDaysCount: number,
    totalExercisesCount: number
  ) => {
    if (imported.name) {
      setManualName(imported.name);
    }
    if (imported.scheduleType === 'weekday' && imported.days.length === 7) {
      setManualType('weekday');
      setWeekdayPlans(imported.days);
    } else if (imported.days.length > 0) {
      setManualType('cyclic');
      setCyclicPlans(imported.days);
    }

    if (totalExercisesCount > 0) {
      setExtractionFeedback({
        type: 'success',
        message: `IA extrajo ${activeDaysCount} ${
          activeDaysCount === 1 ? 'día activo' : 'días activos'
        } y ${totalExercisesCount} ejercicios en orden. Revísalos abajo y guarda tu rutina.`,
      });
    } else {
      setExtractionFeedback({
        type: 'error',
        message:
          'Leímos el archivo pero no distinguimos líneas claras de ejercicios. Puedes corregir el texto detectado abajo o agregarlos manualmente.',
      });
      setShowExtractedTextEditor(true);
    }
  };

  const handleRoutineFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;

    setExtractingFile(true);
    setExtractionFeedback(null);

    try {
      const formData = new FormData();
      for (const file of selected) {
        const prepared = await normalizeImageFileForOcr(file);
        formData.append('files', prepared);
      }

      const res = await fetch('/api/routine/extract-file', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        extractedText?: string;
        routine?: UserRoutine;
        activeDaysCount?: number;
        totalExercisesCount?: number;
      };

      if (!res.ok || !data.ok || !data.routine) {
        setExtractionFeedback({
          type: 'error',
          message:
            data.error ||
            'No se pudo extraer la rutina del archivo. Intenta con una imagen más nítida o PDF con texto.',
        });
        return;
      }

      if (data.extractedText) {
        setExtractedRawText(data.extractedText);
      }

      applyImportedRoutineToEditor(
        data.routine,
        data.activeDaysCount ?? 0,
        data.totalExercisesCount ?? 0
      );
    } catch {
      setExtractionFeedback({
        type: 'error',
        message: 'Error al analizar el archivo. Comprueba tu conexión local e inténtalo de nuevo.',
      });
    } finally {
      setExtractingFile(false);
    }
  };

  const handleReparseEditedText = async () => {
    if (!extractedRawText.trim()) return;
    setExtractingFile(true);
    setExtractionFeedback(null);

    try {
      const res = await fetch('/api/routine/extract-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: extractedRawText,
          fileName: manualName,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        routine?: UserRoutine;
        activeDaysCount?: number;
        totalExercisesCount?: number;
      };
      if (data.ok && data.routine) {
        applyImportedRoutineToEditor(
          data.routine,
          data.activeDaysCount ?? 0,
          data.totalExercisesCount ?? 0
        );
        setShowExtractedTextEditor(false);
      } else {
        setExtractionFeedback({
          type: 'error',
          message: data.error || 'No se pudieron detectar ejercicios en el texto.',
        });
      }
    } catch {
      setExtractionFeedback({
        type: 'error',
        message: 'No se pudo re-analizar el texto.',
      });
    } finally {
      setExtractingFile(false);
    }
  };

  const handleGenerateWithAI = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/routine/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt,
          daysPerWeek,
          minutesPerSession,
          equipment,
          scheduleType: aiScheduleType,
          profile,
        }),
      });
      const data = (await res.json()) as { ok: boolean; routine?: UserRoutine };
      if (data.ok && data.routine) {
        setGeneratedRoutine(data.routine);
      } else {
        setGeneratedRoutine(
          generateScientificRoutine({
            userPrompt,
            daysPerWeek,
            minutesPerSession,
            equipment,
            scheduleType: aiScheduleType,
            profile,
          })
        );
      }
    } catch {
      setGeneratedRoutine(
        generateScientificRoutine({
          userPrompt,
          daysPerWeek,
          minutesPerSession,
          equipment,
          scheduleType: aiScheduleType,
          profile,
        })
      );
    } finally {
      setGenerating(false);
    }
  };

  const activeManualList = manualType === 'weekday' ? weekdayPlans : cyclicPlans;
  const setActiveManualList = (updater: (prev: RoutineDayPlan[]) => RoutineDayPlan[]) => {
    if (manualType === 'weekday') {
      setWeekdayPlans(updater);
    } else {
      setCyclicPlans((prev) =>
        updater(prev).map((d, idx) => ({ ...d, label: `Día ${idx + 1}` }))
      );
    }
  };

  const moveExerciseInDay = (dayId: string, index: number, direction: -1 | 1) => {
    setActiveManualList((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const targetIdx = index + direction;
        if (targetIdx < 0 || targetIdx >= d.exercises.length) return d;
        const nextEx = [...d.exercises];
        const [moved] = nextEx.splice(index, 1);
        nextEx.splice(targetIdx, 0, moved);
        return { ...d, exercises: nextEx };
      })
    );
  };

  const moveDay = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= activeManualList.length) return;
    setActiveManualList((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
  };

  const insertDayAt = (index: number, kind: 'rest' | 'cardio' | 'workout') => {
    const newDay: RoutineDayPlan = {
      id: uid('rday'),
      label: `Día ${index + 1}`,
      isRestDay: kind === 'rest',
      focusTitle:
        kind === 'rest'
          ? 'Descanso y Recuperación'
          : kind === 'cardio'
            ? 'Cardio y Resistencia'
            : 'Nueva Sesión',
      primaryMode: kind === 'cardio' ? 'cardio' : 'hypertrophy',
      estimatedMinutes: kind === 'rest' ? 0 : 60,
      exercises: [],
    };
    setActiveManualList((prev) => {
      const copy = [...prev];
      copy.splice(index, 0, newDay);
      return copy;
    });
  };

  const handleSaveManual = async () => {
    const routineObj: UserRoutine = {
      id: existingRoutine?.id ?? uid('rtn'),
      name: manualName.trim() || 'Mi Rutina Personal',
      scheduleType: manualType,
      source: 'manual',
      createdAtIso: new Date().toISOString(),
      cycleAnchorDateKey: toLocalDateKey(),
      cycleOffsetDays: 0,
      adaptedOverride: null,
      days: activeManualList.map((d) => ({
        ...d,
        exercises: d.exercises.map((ex) => ({
          ...ex,
          sets: Math.max(1, ex.sets || 3),
          repsNum: Math.max(1, ex.repsNum || 10),
          repRangeLabel: `${Math.max(1, ex.repsNum || 10)} reps`,
        })),
      })),
    };
    await onSaveRoutine(routineObj);
  };

  if (pathMode === 'choice') {
    return (
      <div className="space-y-4 animate-fade-up">
        <div className="space-y-1.5 text-center">
          <h2 className="font-gothic text-lg font-semibold tracking-wide text-brand">
            Tu Estructura de Entrenamiento
          </h2>
          <p className="text-xs text-brand-muted leading-relaxed">
            Define tu rutina para ver tus sugerencias de ejercicios en orden cada día y adaptarla si
            algún día debes descansar.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={() => setPathMode('ai')}
            className="w-full rounded-2xl border border-gothic/35 bg-surface p-4 text-left transition-colors hover:border-gothic/70 active:scale-[0.99]"
          >
            <div className="flex items-center gap-2 text-gothic">
              <Sparkles className="h-4 w-4" />
              <span className="font-gothic text-xs font-semibold uppercase tracking-widest">
                Crear mi rutina ideal con IA
              </span>
            </div>
            <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">
              Ideal si eres principiante o quieres una rutina optimizada con ciencia según tus
              objetivos, tiempo disponible y físico.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPathMode('manual')}
            className="w-full rounded-2xl border border-stoneborder bg-surface p-4 text-left transition-colors hover:border-gothic/50 active:scale-[0.99]"
          >
            <div className="flex items-center gap-2 text-brand">
              <Calendar className="h-4 w-4 text-gothic" />
              <span className="font-gothic text-xs font-semibold uppercase tracking-widest">
                Ya tengo mi propia rutina
              </span>
            </div>
            <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">
              Adjunta una imagen o PDF enviado por tu entrenador para extraerla con IA, o ármala
              manualmente por días o ciclo.
            </p>
          </button>
        </div>

        {onSkipOptional && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onSkipOptional}
              className="text-xs text-brand-muted hover:text-brand underline underline-offset-4"
            >
              Omitir por ahora y entrenar libre
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==================== PATH A: AI SCIENTIFIC ROUTINE GENERATOR ====================
  if (pathMode === 'ai') {
    return (
      <div className="space-y-4 animate-fade-up">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPathMode('choice')}
            className="text-xs text-brand-muted hover:text-brand"
          >
            ← Cambiar opción
          </button>
          <span className="font-gothic text-[11px] uppercase tracking-widest text-gothic">
            Diseño con IA Científica
          </span>
        </div>

        {!generatedRoutine ? (
          <div className="space-y-4 rounded-2xl border border-stoneborder bg-surface p-4">
            {/* Days per week */}
            <div>
              <label className="block text-xs text-brand-muted mb-2">
                Días disponibles por semana
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[2, 3, 4, 5, 6].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysPerWeek(d)}
                    className={`rounded-xl border py-2 text-xs font-semibold transition-colors ${
                      daysPerWeek === d
                        ? 'border-gothic bg-gothic/15 text-brand'
                        : 'border-stoneborder bg-background text-brand-muted'
                    }`}
                  >
                    {d} días
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes & Schedule Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-brand-muted mb-1.5">Tiempo por sesión</label>
                <select
                  value={minutesPerSession}
                  onChange={(e) => setMinutesPerSession(Number(e.target.value))}
                  className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] text-brand focus:border-gothic focus:outline-none"
                >
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={75}>75 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-brand-muted mb-1.5">Lugar / Equipo</label>
                <select
                  value={equipment}
                  onChange={(e) =>
                    setEquipment(e.target.value as 'gym' | 'dumbbells_home' | 'calisthenics')
                  }
                  className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] text-brand focus:border-gothic focus:outline-none"
                >
                  <option value="gym">Gimnasio</option>
                  <option value="dumbbells_home">Casa / Mancuernas</option>
                  <option value="calisthenics">Calistenia</option>
                </select>
              </div>
            </div>

            {/* Format: Weekday vs Cyclic */}
            <div>
              <label className="block text-xs text-brand-muted mb-1.5">
                Formato del calendario
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiScheduleType('weekday')}
                  className={`rounded-xl border py-2 px-3 text-xs font-medium ${
                    aiScheduleType === 'weekday'
                      ? 'border-gothic bg-gothic/15 text-brand'
                      : 'border-stoneborder bg-background text-brand-muted'
                  }`}
                >
                  Días de semana
                </button>
                <button
                  type="button"
                  onClick={() => setAiScheduleType('cyclic')}
                  className={`rounded-xl border py-2 px-3 text-xs font-medium ${
                    aiScheduleType === 'cyclic'
                      ? 'border-gothic bg-gothic/15 text-brand'
                      : 'border-stoneborder bg-background text-brand-muted'
                  }`}
                >
                  Cíclica continua
                </button>
              </div>
            </div>

            {/* Free-text objectives prompt */}
            <div>
              <label className="block text-xs text-brand-muted mb-1.5">
                Tus objetivos, enfoque principal o detalles personales
              </label>
              <textarea
                rows={4}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Ej: Soy principiante, quiero ganar masa muscular enfocándome en hombros, pecho y brazos, y bajar grasa. Puedo lunes, miércoles y viernes..."
                className="w-full rounded-xl border border-stoneborder bg-background p-3 text-[16px] text-brand placeholder-brand-subtle focus:border-gothic focus:outline-none leading-relaxed"
              />
            </div>

            <button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-xs font-bold uppercase tracking-widest text-background transition-opacity disabled:opacity-60 active:scale-[0.99]"
            >
              <Sparkles className="h-4 w-4" />
              {generating ? 'Diseñando tu rutina...' : 'Crear Rutina Optimizada'}
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-up">
            {/* Generated Routine Summary Card */}
            <div className="rounded-2xl border border-gothic/35 bg-surface p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-gothic">
                    Rutina Personalizada Lista
                  </span>
                  <h3 className="font-gothic text-base font-semibold text-brand mt-0.5">
                    {generatedRoutine.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedRoutine(null);
                    setShowWhyExplanation(false);
                  }}
                  className="text-xs text-brand-muted hover:text-brand underline"
                >
                  Ajustar
                </button>
              </div>

              {/* Prominent "¿Por qué es la mejor rutina para ti?" button */}
              {generatedRoutine.rationale && (
                <button
                  type="button"
                  onClick={() => setShowWhyExplanation((v) => !v)}
                  className="w-full flex items-center justify-between rounded-xl border border-gothic/40 bg-elevated px-3.5 py-2.5 text-left transition-colors hover:border-gothic"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-gothic shrink-0" />
                    <span className="text-xs font-semibold text-brand">
                      ¿Por qué esta es la mejor rutina para ti?
                    </span>
                  </div>
                  {showWhyExplanation ? (
                    <ChevronUp className="h-4 w-4 text-gothic" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gothic" />
                  )}
                </button>
              )}

              {/* Plain-language scientific breakdown */}
              {showWhyExplanation && generatedRoutine.rationale && (
                <RationaleInlineContent rationale={generatedRoutine.rationale} />
              )}

              {/* Clean Day-by-Day Preview */}
              <div className="space-y-2 pt-1">
                {generatedRoutine.days.map((day) => (
                  <div
                    key={day.id}
                    className={`rounded-xl border px-3.5 py-2.5 ${
                      day.isRestDay
                        ? 'border-stoneborder/60 bg-background/40 opacity-70'
                        : 'border-stoneborder bg-background/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand">{day.label}</span>
                      <span className="text-xs text-gothic">{day.focusTitle}</span>
                    </div>
                    {!day.isRestDay && day.exercises.length > 0 && (
                      <ul className="mt-1.5 space-y-1 border-t border-stoneborder/60 pt-1.5">
                        {day.exercises.map((ex, i) => (
                          <li
                            key={`${ex.catalogId}_${i}`}
                            className="flex items-center justify-between text-[11px] text-brand-muted"
                          >
                            <span className="truncate pr-2">
                              {i + 1}. {ex.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-brand/80">
                              {ex.sets} × {ex.repRangeLabel}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSaveRoutine(generatedRoutine)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-xs font-bold uppercase tracking-widest text-background active:scale-[0.99]"
            >
              <Check className="h-4 w-4" />
              Activar esta Rutina
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==================== PATH B: MANUAL ROUTINE BUILDER + AI IMAGE/PDF IMPORT ====================
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPathMode('choice')}
          className="text-xs text-brand-muted hover:text-brand"
        >
          ← Cambiar opción
        </button>
        <span className="font-gothic text-[11px] uppercase tracking-widest text-gothic">
          Mi Propia Rutina
        </span>
      </div>

      {/* ================= AI IMAGE / PDF ROUTINE IMPORTER (COMPACT & COLLAPSIBLE) ================= */}
      <div className="rounded-xl border border-stoneborder bg-surface/80 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Upload className="h-4 w-4 text-gothic shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-brand truncate">
                Importar rutina de entrenador con IA
              </h3>
              <p className="text-[10px] text-brand-muted truncate">
                Extrae días, ejercicios y series desde capturas o PDF
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowImporter((v) => !v)}
            className="shrink-0 rounded-lg border border-stoneborder bg-background px-2.5 py-1 text-[11px] font-medium text-gothic hover:text-brand"
          >
            {showImporter ? 'Cerrar' : 'Adjuntar'}
          </button>
        </div>

        {showImporter && (
          <div className="space-y-2.5 pt-1 border-t border-stoneborder/60 animate-fade-up">
            <input
              ref={routineFileInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              multiple
              onChange={handleRoutineFilesSelected}
              className="hidden"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={extractingFile}
                onClick={() => routineFileInputRef.current?.click()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gothic/50 bg-gothic/15 py-2 px-3 text-xs font-semibold text-brand hover:border-gothic active:scale-[0.99] disabled:opacity-60"
              >
                {extractingFile ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gothic" />
                    <span>Analizando con IA...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 text-gothic" />
                    <span>Adjuntar Imagen o PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowExtractedTextEditor((v) => !v)}
                className="rounded-xl border border-stoneborder bg-background py-2 px-3 text-[11px] text-brand-muted hover:text-brand"
              >
                {showExtractedTextEditor ? 'Ocultar' : 'Pegar texto'}
              </button>
            </div>

            {extractionFeedback && (
              <div
                className={`rounded-lg border px-2.5 py-1.5 text-xs leading-snug ${
                  extractionFeedback.type === 'success'
                    ? 'border-gothic/45 bg-gothic/10 text-brand'
                    : 'border-status-regress/45 bg-status-regress/10 text-brand'
                }`}
              >
                {extractionFeedback.message}
              </div>
            )}

            {showExtractedTextEditor && (
              <div className="space-y-2 pt-1 animate-fade-up">
                <label className="block text-[11px] text-brand-muted">
                  Texto leído o pegado de tu entrenador (puedes editarlo y volver a extraer):
                </label>
                <textarea
                  rows={4}
                  value={extractedRawText}
                  onChange={(e) => setExtractedRawText(e.target.value)}
                  placeholder={`Ejemplo:\nLunes - Pecho y Hombro\n1. Press Banca 4x8-10\n2. Press Militar 3x10\n3. Rompecabezas 3x12`}
                  className="w-full rounded-xl border border-stoneborder bg-background p-2.5 text-[16px] text-brand placeholder-brand-subtle focus:border-gothic focus:outline-none leading-relaxed"
                />
                <button
                  type="button"
                  disabled={extractingFile || !extractedRawText.trim()}
                  onClick={handleReparseEditedText}
                  className="w-full rounded-xl border border-gothic/50 bg-elevated py-1.5 text-xs font-semibold text-brand disabled:opacity-50"
                >
                  Extraer rutina desde este texto
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= MANUAL / EXTRACTED ROUTINE EDITOR ================= */}
      <div className="rounded-xl border border-stoneborder bg-surface p-3.5 space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Nombre de tu rutina"
            className="flex-1 rounded-xl border border-stoneborder bg-background px-3 py-1.5 text-[16px] text-brand focus:border-gothic focus:outline-none"
          />

          <div className="flex items-center rounded-xl border border-stoneborder bg-background p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setManualType('weekday')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                manualType === 'weekday'
                  ? 'bg-gothic/20 text-brand font-semibold'
                  : 'text-brand-muted hover:text-brand'
              }`}
            >
              Semanal
            </button>
            <button
              type="button"
              onClick={() => setManualType('cyclic')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                manualType === 'cyclic'
                  ? 'bg-gothic/20 text-brand font-semibold'
                  : 'text-brand-muted hover:text-brand'
              }`}
            >
              Cíclica
            </button>
          </div>
        </div>

        {/* Days list */}
        <div className="space-y-2 pt-0.5">
          {activeManualList.map((day, dayIndex) => {
            const reorderControls = (
              <div className="flex items-center gap-0.5 mr-1">
                <button
                  type="button"
                  disabled={dayIndex === 0}
                  onClick={() => moveDay(dayIndex, -1)}
                  title="Mover día hacia arriba"
                  className="p-1 rounded text-brand-subtle hover:text-brand disabled:opacity-20 active:scale-95 transition-colors"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={dayIndex === activeManualList.length - 1}
                  onClick={() => moveDay(dayIndex, 1)}
                  title="Mover día hacia abajo"
                  className="p-1 rounded text-brand-subtle hover:text-brand disabled:opacity-20 active:scale-95 transition-colors"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            );

            const intercalarControls = (
              <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-brand-subtle">
                <span className="h-[1px] flex-1 bg-stoneborder/40" />
                <span className="text-[10px] text-brand-muted">Intercalar:</span>
                <button
                  type="button"
                  onClick={() => insertDayAt(dayIndex + 1, 'rest')}
                  className="rounded-lg border border-stoneborder/70 bg-background/80 px-2 py-0.5 text-[10px] text-brand-muted hover:text-brand hover:border-gothic/50 active:scale-95 transition-colors"
                >
                  + Descanso
                </button>
                <button
                  type="button"
                  onClick={() => insertDayAt(dayIndex + 1, 'cardio')}
                  className="rounded-lg border border-stoneborder/70 bg-background/80 px-2 py-0.5 text-[10px] text-brand-muted hover:text-brand hover:border-gothic/50 active:scale-95 transition-colors"
                >
                  + Cardio
                </button>
                <button
                  type="button"
                  onClick={() => insertDayAt(dayIndex + 1, 'workout')}
                  className="rounded-lg border border-stoneborder/70 bg-background/80 px-2 py-0.5 text-[10px] text-brand-muted hover:text-brand hover:border-gothic/50 active:scale-95 transition-colors"
                >
                  + Sesión
                </button>
                <span className="h-[1px] flex-1 bg-stoneborder/40" />
              </div>
            );

            if (day.isRestDay) {
              return (
                <React.Fragment key={day.id}>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-stoneborder/60 bg-background/50 px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {reorderControls}
                      <span className="font-medium text-brand-muted truncate">
                        {day.label} · Descanso
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveManualList((prev) =>
                            prev.map((d) =>
                              d.id === day.id
                                ? { ...d, isRestDay: false, focusTitle: 'Entrenamiento' }
                                : d
                            )
                          )
                        }
                        className="rounded-lg border border-stoneborder bg-surface px-2.5 py-1 text-[11px] text-brand-muted hover:text-brand"
                      >
                        Activar día
                      </button>
                      {manualType === 'cyclic' && activeManualList.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveManualList((prev) => prev.filter((d) => d.id !== day.id))
                          }
                          className="p-1 text-brand-subtle hover:text-status-regress"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {intercalarControls}
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={day.id}>
                <div className="rounded-xl border border-stoneborder bg-background/80 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {reorderControls}
                      <span className="text-xs font-semibold text-brand">{day.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveManualList((prev) =>
                            prev.map((d) =>
                              d.id === day.id
                                ? {
                                    ...d,
                                    isRestDay: true,
                                    focusTitle: 'Descanso',
                                  }
                                : d
                            )
                          )
                        }
                        className="rounded-lg border border-stoneborder px-2 py-0.5 text-[11px] text-brand-muted hover:text-brand"
                      >
                        Pausar a descanso
                      </button>

                      {manualType === 'cyclic' && activeManualList.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveManualList((prev) => prev.filter((d) => d.id !== day.id))
                          }
                          className="p-1 text-brand-subtle hover:text-status-regress"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                <div className="grid grid-cols-[1fr_112px] gap-2">
                  <input
                    type="text"
                    value={day.focusTitle}
                    onChange={(e) =>
                      setActiveManualList((prev) =>
                        prev.map((d) =>
                          d.id === day.id ? { ...d, focusTitle: e.target.value } : d
                        )
                      )
                    }
                    placeholder="Ej: Pecho y Espalda"
                    className="w-full rounded-lg border border-stoneborder bg-surface px-2.5 py-1.5 text-[16px] text-brand focus:border-gothic focus:outline-none"
                  />
                  <select
                    value={day.primaryMode}
                    onChange={(e) =>
                      setActiveManualList((prev) =>
                        prev.map((d) =>
                          d.id === day.id
                            ? { ...d, primaryMode: e.target.value as TrainingMode }
                            : d
                        )
                      )
                    }
                    className="rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-[16px] text-brand-muted focus:outline-none"
                  >
                    {(
                      [
                        'hypertrophy',
                        'strength',
                        'calisthenics',
                        'hyrox',
                        'cardio',
                      ] as TrainingMode[]
                    ).map((m) => (
                      <option key={m} value={m}>
                        {MODE_META[m].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ordered exercises inside this day */}
                {day.exercises.length > 0 && (
                  <div className="space-y-1.5">
                    {day.exercises.map((ex, idx) => (
                      <div
                        key={`${ex.catalogId}_${idx}`}
                        className="flex items-center justify-between gap-1.5 rounded-lg border border-stoneborder/70 bg-surface px-2.5 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="font-mono text-[11px] text-gothic shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="truncate text-brand font-medium">{ex.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            inputMode="numeric"
                            aria-label="Series"
                            value={ex.sets === 0 ? '' : ex.sets}
                            placeholder="3"
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              const parsed = raw === '' ? 0 : parseInt(raw, 10);
                              const nextSets = isNaN(parsed) ? 0 : Math.max(0, Math.min(20, parsed));
                              setActiveManualList((prev) =>
                                prev.map((d) =>
                                  d.id === day.id
                                    ? {
                                        ...d,
                                        exercises: d.exercises.map((item, i) =>
                                          i === idx ? { ...item, sets: nextSets } : item
                                        ),
                                      }
                                    : d
                                )
                              );
                            }}
                            onBlur={() => {
                              if (!ex.sets || ex.sets < 1) {
                                setActiveManualList((prev) =>
                                  prev.map((d) =>
                                    d.id === day.id
                                      ? {
                                          ...d,
                                          exercises: d.exercises.map((item, i) =>
                                            i === idx ? { ...item, sets: 1 } : item
                                          ),
                                        }
                                      : d
                                  )
                                );
                              }
                            }}
                            className="w-9 rounded border border-stoneborder bg-background py-0.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic focus:outline-none"
                          />
                          <span className="text-[10px] text-brand-muted">×</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            aria-label="Repeticiones"
                            value={ex.repsNum === 0 ? '' : ex.repsNum}
                            placeholder="10"
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              const parsed = raw === '' ? 0 : parseInt(raw, 10);
                              const nextReps = isNaN(parsed) ? 0 : Math.max(0, Math.min(200, parsed));
                              setActiveManualList((prev) =>
                                prev.map((d) =>
                                  d.id === day.id
                                    ? {
                                        ...d,
                                        exercises: d.exercises.map((item, i) =>
                                          i === idx
                                            ? {
                                                ...item,
                                                repsNum: nextReps,
                                                repRangeLabel: `${nextReps || 1} reps`,
                                              }
                                            : item
                                        ),
                                      }
                                    : d
                                )
                              );
                            }}
                            onBlur={() => {
                              if (!ex.repsNum || ex.repsNum < 1) {
                                setActiveManualList((prev) =>
                                  prev.map((d) =>
                                    d.id === day.id
                                      ? {
                                          ...d,
                                          exercises: d.exercises.map((item, i) =>
                                            i === idx
                                              ? {
                                                  ...item,
                                                  repsNum: 10,
                                                  repRangeLabel: '10 reps',
                                                }
                                              : item
                                          ),
                                        }
                                      : d
                                  )
                                );
                              }
                            }}
                            className="w-11 rounded border border-stoneborder bg-background py-0.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic focus:outline-none"
                          />

                          {day.exercises.length > 1 && (
                            <div className="flex items-center">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveExerciseInDay(day.id, idx, -1)}
                                aria-label="Subir ejercicio"
                                className="p-0.5 text-brand-subtle hover:text-brand disabled:opacity-25"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === day.exercises.length - 1}
                                onClick={() => moveExerciseInDay(day.id, idx, 1)}
                                aria-label="Bajar ejercicio"
                                className="p-0.5 text-brand-subtle hover:text-brand disabled:opacity-25"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setActiveManualList((prev) =>
                                prev.map((d) =>
                                  d.id === day.id
                                    ? {
                                        ...d,
                                        exercises: d.exercises.filter((_, i) => i !== idx),
                                      }
                                    : d
                                )
                              )
                            }
                            className="text-brand-subtle hover:text-status-regress p-0.5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {addingExForDayId === day.id ? (
                    <div className="rounded-xl border border-stoneborder bg-surface p-2.5 space-y-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-subtle" />
                        <input
                          type="text"
                          autoFocus
                          value={exSearch}
                          onChange={(e) => setExSearch(e.target.value)}
                          placeholder="Buscar o escribir ejercicio (ej: press militar...)"
                          className="w-full rounded-lg border border-stoneborder bg-background py-1.5 pl-8 pr-7 text-[16px] text-brand focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setAddingExForDayId(null);
                            setExSearch('');
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-muted"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="max-h-44 overflow-y-auto space-y-1">
                        {exSearch.trim().length >= 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const cleanCustom = exSearch.trim();
                              const resolved = resolveExerciseIntelligently(cleanCustom, day.primaryMode);
                              const defs = getResolvedWorkoutDefaults(profile);
                              const hasCustomRest = Boolean(
                                profile?.workoutDefaults?.defaultRestSeconds
                              );
                              const customPres: RoutineExercisePrescription = {
                                catalogId: resolved.canonicalCatalogId,
                                name: resolved.canonicalName,
                                mode: resolved.mode,
                                sets: defs.defaultEffectiveSets,
                                repsNum: defs.defaultReps,
                                repRangeLabel: `${defs.defaultReps} reps`,
                                rir: defs.defaultRir,
                                restSeconds: hasCustomRest
                                  ? defs.defaultRestSeconds
                                  : resolved.defaultRestSeconds || MODE_META[day.primaryMode].defaultRest,
                              };
                              setActiveManualList((prev) =>
                                prev.map((d) =>
                                  d.id === day.id
                                    ? { ...d, exercises: [...d.exercises, customPres] }
                                    : d
                                )
                              );
                              setExSearch('');
                            }}
                            className="w-full flex items-center justify-between rounded-lg border border-gothic/35 bg-gothic/10 px-2.5 py-1.5 text-left text-xs text-brand"
                          >
                            <span className="truncate">
                              Añadir &ldquo;{exSearch.trim()}&rdquo; tal cual
                            </span>
                            <Plus className="h-3.5 w-3.5 shrink-0 text-gothic" />
                          </button>
                        )}

                        {matchedExercises.map(({ item }) => {
                          const defs = getResolvedWorkoutDefaults(profile);
                          const hasCustomRest = Boolean(
                            profile?.workoutDefaults?.defaultRestSeconds
                          );
                          const newPres: RoutineExercisePrescription = {
                            catalogId: item.id,
                            name: item.name,
                            mode: item.mode,
                            sets: defs.defaultEffectiveSets,
                            repsNum: defs.defaultReps,
                            repRangeLabel: `${defs.defaultReps} reps`,
                            rir: defs.defaultRir,
                            restSeconds: hasCustomRest
                              ? defs.defaultRestSeconds
                              : item.defaultRestSeconds,
                          };
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setActiveManualList((prev) =>
                                  prev.map((d) =>
                                    d.id === day.id
                                      ? { ...d, exercises: [...d.exercises, newPres] }
                                      : d
                                  )
                                );
                                setExSearch('');
                              }}
                              className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs text-brand hover:bg-elevated"
                            >
                              <span className="truncate">{item.name}</span>
                              <Plus className="h-3.5 w-3.5 shrink-0 text-gothic" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingExForDayId(day.id);
                        setExSearch('');
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-gothic hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      Añadir ejercicio en orden a este día
                    </button>
                  )}
                </div>
                {intercalarControls}
              </React.Fragment>
            );
          })}
        </div>

        {manualType === 'cyclic' && (
          <button
            type="button"
            onClick={() =>
              setCyclicPlans((prev) => [
                ...prev,
                {
                  id: uid('rday'),
                  label: `Día ${prev.length + 1}`,
                  isRestDay: false,
                  focusTitle: 'Nuevo Día',
                  primaryMode: 'hypertrophy',
                  estimatedMinutes: 60,
                  exercises: [],
                },
              ])
            }
            className="w-full rounded-xl border border-dashed border-stoneborder py-2 text-xs text-brand-muted hover:text-brand"
          >
            + Añadir día al ciclo
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleSaveManual}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-xs font-bold uppercase tracking-widest text-background active:scale-[0.99]"
      >
        <Check className="h-4 w-4" />
        Guardar Mi Rutina
      </button>
    </div>
  );
}

export function RationaleInlineContent({ rationale }: { rationale: RoutineRationale }) {
  return (
    <div className="rounded-xl border border-stoneborder bg-background/90 p-3.5 space-y-3 animate-fade-up">
      <p className="text-xs text-brand leading-relaxed">{rationale.summary}</p>
      <div className="space-y-2.5">
        {rationale.pillars.map((pillar, idx) => (
          <div key={idx} className="border-l-2 border-gothic/60 pl-3 space-y-0.5">
            <h4 className="text-xs font-semibold text-brand">{pillar.title}</h4>
            <p className="text-xs text-brand-muted leading-relaxed">
              {pillar.plainExplanation}
            </p>
            <span className="block text-[10px] text-gothic/90 pt-0.5">
              Base: {pillar.scienceReference}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoutineModalsHost({
  isRoutineOpen,
  onCloseRoutine,
  isRationaleOpen,
  onCloseRationale,
  routine,
  profile,
  onSaveRoutine,
}: {
  isRoutineOpen: boolean;
  onCloseRoutine: () => void;
  isRationaleOpen: boolean;
  onCloseRationale: () => void;
  routine: UserRoutine | null;
  profile: UserProfile | null;
  onSaveRoutine: (r: UserRoutine) => Promise<void> | void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isOpen = isRationaleOpen || isRoutineOpen;

  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  if (isRationaleOpen && routine?.rationale) {
    return createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
        onClick={onCloseRationale}
      >
        <div
          className="w-full max-w-[430px] max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-stoneborder bg-surface shadow-2xl animate-fade-up pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-stoneborder p-4">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-gothic">
                Fundamento en Lenguaje Sencillo
              </span>
              <h3 className="font-gothic text-sm font-semibold text-brand mt-0.5">
                {routine.rationale.headline}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCloseRationale}
              aria-label="Cerrar fundamento"
              className="rounded-xl border border-stoneborder bg-background p-2 text-brand-muted hover:text-brand"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <RationaleInlineContent rationale={routine.rationale} />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (isRoutineOpen) {
    return createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
        onClick={onCloseRoutine}
      >
        <div
          className="w-full max-w-[430px] max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-stoneborder bg-background shadow-2xl animate-fade-up pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-stoneborder p-4">
            <h3 className="font-gothic text-sm font-semibold tracking-wide text-brand">
              Gestionar Mi Rutina
            </h3>
            <button
              type="button"
              onClick={onCloseRoutine}
              aria-label="Cerrar rutina"
              className="rounded-xl border border-stoneborder bg-surface p-2 text-brand-muted hover:text-brand"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <RoutineSetupConfigurator
              profile={profile}
              existingRoutine={routine}
              onSaveRoutine={async (r) => {
                await onSaveRoutine(r);
                onCloseRoutine();
              }}
            />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return null;
}
