'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  Check,
  Clock,
  Cpu,
  Dumbbell,
  Flame,
  Info,
  Layers,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react';
import {
  ExerciseDeepProfile,
  OutOfContextWordAnalysis,
  TrainingMode,
} from '@/types/kairos';
import { synthesizeExerciseDeepProfile } from '@/lib/exerciseClassifierEngine';

interface ExerciseOutOfContextPromptModalProps {
  isOpen: boolean;
  analysis: OutOfContextWordAnalysis | null;
  onConfirmClean: (cleanedName: string) => void;
  onConfirmIntentional: (originalName: string) => void;
  onCancel: () => void;
}

export function ExerciseOutOfContextPromptModal({
  isOpen,
  analysis,
  onConfirmClean,
  onConfirmIntentional,
  onCancel,
}: ExerciseOutOfContextPromptModalProps) {
  const [editableCleanName, setEditableCleanName] = useState('');

  useEffect(() => {
    if (analysis) {
      setEditableCleanName(analysis.suggestedCleanName || analysis.originalInput);
    }
  }, [analysis]);

  if (!isOpen || !analysis) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-500/40 bg-[#141218] shadow-[0_25px_70px_rgba(0,0,0,0.9)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stoneborder/70 bg-amber-500/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                Filtro Contextual KAIROS IA
              </span>
              <h3 className="font-display text-base font-bold text-brand">
                ¿Palabras fuera del ejercicio?
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-brand"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          <p className="text-xs leading-relaxed text-brand/90">
            Al analizar <span className="font-semibold text-white">«{analysis.originalInput}»</span>,
            la IA detectó {analysis.suspiciousWords.length === 1 ? 'una palabra que parece no pertenecer' : 'palabras que parecen no pertenecer'} al contexto biomecánico del ejercicio:
          </p>

          {/* Suspicious words pills */}
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
              {analysis.suspiciousWords.length === 1
                ? 'Palabra detectada fuera de contexto:'
                : 'Palabras detectadas fuera de contexto:'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.suspiciousWords.map((word, idx) => (
                <span
                  key={`${word}_${idx}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/50 bg-rose-500/20 px-2.5 py-1 font-mono text-xs font-bold text-rose-200"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                  {word}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            ¿Incluiste {analysis.suspiciousWords.length === 1 ? 'esta palabra' : 'estas palabras'} <strong className="text-brand">con querer</strong> o fue un <strong className="text-brand">error</strong>? Puedes corregir el nombre abajo o proceder directamente con la investigación biomecánica:
          </p>

          {/* Editable Clean Name */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Nombre limpio sugerido por la IA (editable)
            </label>
            <input
              type="text"
              value={editableCleanName}
              onChange={(e) => setEditableCleanName(e.target.value)}
              className="w-full rounded-xl border border-emerald-500/40 bg-[#0E0D10] px-3.5 py-2.5 text-sm font-semibold text-brand focus:border-emerald-400 focus:outline-none"
              placeholder="Nombre correcto del ejercicio..."
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              onClick={() =>
                onConfirmClean(editableCleanName.trim() || analysis.suggestedCleanName || analysis.originalInput)
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition hover:bg-emerald-500"
            >
              <Check className="h-4 w-4" />
              Fue un error · Corregir e Investigar «{editableCleanName.trim() || analysis.suggestedCleanName}»
            </button>

            <button
              type="button"
              onClick={() => onConfirmIntentional(analysis.originalInput)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-stoneborder bg-[#1C1A22] px-4 py-2.5 text-xs font-semibold text-brand/90 transition hover:border-amber-500/40 hover:bg-[#24212C]"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Fue con querer · Mantener «{analysis.originalInput}» e Investigar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ExerciseDeepProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  mode?: TrainingMode;
  catalogId?: string;
  deepProfile?: ExerciseDeepProfile;
  isResearching?: boolean;
  onTriggerResearch?: () => void;
}

export function ExerciseDeepProfileModal({
  isOpen,
  onClose,
  exerciseName,
  mode = 'hypertrophy',
  catalogId,
  deepProfile,
  isResearching = false,
  onTriggerResearch,
}: ExerciseDeepProfileModalProps) {
  if (!isOpen) return null;

  const profile: ExerciseDeepProfile =
    deepProfile ?? synthesizeExerciseDeepProfile(exerciseName, mode, catalogId);

  const stressColor =
    profile.jointStress.level === 'Alto'
      ? 'text-rose-300 border-rose-500/40 bg-rose-500/15'
      : profile.jointStress.level === 'Moderado'
      ? 'text-amber-300 border-amber-500/40 bg-amber-500/15'
      : 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-fadeIn">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-stoneborder bg-[#131117] shadow-[0_25px_80px_rgba(0,0,0,0.95)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stoneborder/80 bg-[#18161E] px-5 py-4">
          <div className="min-w-0 pr-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-gothic/40 bg-gothic/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand">
                <Brain className="h-3 w-3 text-gothic" />
                 Inteligencia Biomecánica KAIROS
              </span>
              {profile.isAiResearched && (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  Investigado a Profundidad
                </span>
              )}
            </div>
            <h3 className="mt-1.5 truncate font-display text-lg font-bold text-brand">
              {exerciseName}
            </h3>
            <p className="text-[11px] text-muted">
              Patrón: <span className="text-brand/90">{profile.movementPattern}</span> · Mecánica:{' '}
              <span className="text-brand/90">{profile.mechanicType}</span> · Implemento:{' '}
              <span className="text-brand/90">{profile.equipmentType}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stoneborder/60 bg-[#1F1C26] p-2 text-muted transition hover:text-brand"
            aria-label="Cerrar ficha biomecánica"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {isResearching && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
              <div>
                <p className="font-bold">Investigación IA en curso...</p>
                <p className="text-[11px] text-amber-200/80">
                  Analizando reclutamiento motor, músculos sinergistas necesarios, perfil de resistencia y curva de fatiga.
                </p>
              </div>
            </div>
          )}

          {/* 1. Mapa Anatómico de Reclutamiento Muscular */}
          {profile.variantAnalysisNote && (
            <div className="rounded-xl border border-gothic/40 bg-gothic/15 p-3.5 text-xs text-brand">
              <div className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider text-gothic text-[10px]">
                <Sparkles className="h-3.5 w-3.5" />
                Análisis de Variante / Agarre Activo
              </div>
              <p className="leading-relaxed text-brand/95">{profile.variantAnalysisNote}</p>
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-stoneborder/80 bg-[#0E0D10] p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
              <Target className="h-4 w-4 text-gothic" />
              Anatomía Funcional y Reclutamiento Motor
            </div>

            {/* Primary Agonists */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-rose-300">
                  Músculos Principales (Agonistas · 100% Estímulo Directo)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.primaryMuscles.map((m) => (
                  <span
                    key={m}
                    className="rounded-lg border border-gothic/50 bg-gothic/20 px-2.5 py-1 text-xs font-bold text-brand"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Secondary Necessary Synergists */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-amber-300">
                  Músculos Necesarios (Sinergistas · ~50% Carga y Fatiga Asociada)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.secondaryMuscles.map((m) => (
                  <span
                    key={m}
                    className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Stabilizers */}
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-sky-300">
                Músculos Estabilizadores y Fijadores Articulares
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.stabilizerMuscles.map((m) => (
                  <span
                    key={m}
                    className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Índices de Fatiga, SNC y SFR */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* SFR */}
            <div className="rounded-xl border border-stoneborder/80 bg-[#0E0D10] p-3.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <span>Ratio Estímulo/Fatiga</span>
                <Zap className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold text-brand">{profile.sfrScore}</span>
                <span className="text-xs text-muted">/ 10</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${profile.sfrScore * 10}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-muted">
                {profile.sfrScore >= 9
                  ? 'Altísima eficiencia hipertrófica con bajo costo sistémico.'
                  : profile.sfrScore >= 7
                  ? 'Excelente balance entre tensión mecánica y fatiga.'
                  : 'Alta demanda sistémica; dosificar volumen con precisión.'}
              </p>
            </div>

            {/* CNS Fatigue */}
            <div className="rounded-xl border border-stoneborder/80 bg-[#0E0D10] p-3.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-300">
                <span>Fatiga SNC (Neural)</span>
                <Cpu className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold text-brand">
                  {profile.cnsFatigueIndex}
                </span>
                <span className="text-xs text-muted">/ 10</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${profile.cnsFatigueIndex * 10}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-muted">
                Coeficiente de fatiga por serie:{' '}
                <strong className="text-brand">{profile.fatigueCoefficient.toFixed(2)}x</strong>
              </p>
            </div>

            {/* Local Muscular Fatigue */}
            <div className="rounded-xl border border-stoneborder/80 bg-[#0E0D10] p-3.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-rose-300">
                <span>Fatiga Muscular Local</span>
                <Flame className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold text-brand">
                  {profile.localFatigueIndex}
                </span>
                <span className="text-xs text-muted">/ 10</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: `${profile.localFatigueIndex * 10}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-muted">
                Daño miofibrilar y agotamiento de glucógeno local.
              </p>
            </div>
          </div>

          {/* 3. Variables Biomecánicas & Recuperación */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-stoneborder/80 bg-[#0E0D10] p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                <Layers className="h-3.5 w-3.5 text-gothic" />
                Perfil de Resistencia y Rango Óptimo
              </div>
              <p className="mt-1.5 text-xs font-bold text-brand">{profile.resistanceProfile}</p>
              <p className="mt-1 text-[11px] text-muted">
                Zona óptima de programación:{' '}
                <span className="font-mono font-semibold text-brand">
                  {profile.optimalRepRange}
                </span>
              </p>
            </div>

            <div className="rounded-xl border border-stoneborder/80 bg-[#0E0D10] p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                <Clock className="h-3.5 w-3.5 text-gothic" />
                Estrés Articular y Recuperación
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${stressColor}`}>
                  Estrés {profile.jointStress.level}
                </span>
                <span className="rounded-md border border-stoneborder bg-[#18161E] px-2 py-0.5 font-mono text-[10px] font-semibold text-brand">
                  Recuperación: ~{profile.recoveryHours}h
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Articulaciones: {profile.jointStress.joints.join(', ')}
              </p>
            </div>
          </div>

          {/* 4. Directiva Biomecánica */}
          <div className="rounded-xl border border-gothic/35 bg-gothic/10 p-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand">
              <Info className="h-3.5 w-3.5 text-gothic" />
              Directiva Técnica y Biomecánica
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-brand/90">
              {profile.biomechanicalCue}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stoneborder/80 bg-[#18161E] px-5 py-3">
          {onTriggerResearch ? (
            <button
              type="button"
              disabled={isResearching}
              onClick={onTriggerResearch}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stoneborder bg-[#211E29] px-3 py-2 text-[11px] font-semibold text-brand transition hover:border-gothic/60 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isResearching ? 'animate-spin' : ''}`} />
              {isResearching ? 'Investigando con IA...' : 'Profundizar / Recalibrar con IA'}
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gothic px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-gothic/90"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
