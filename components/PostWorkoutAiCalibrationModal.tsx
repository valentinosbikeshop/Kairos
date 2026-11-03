'use client';

import React, { useState } from 'react';
import { WorkoutExercise } from '@/types/kairos';
import {
  ExerciseClassificationResult,
  resolveExerciseIntelligently,
} from '@/lib/exerciseClassifierEngine';
import { BUILTIN_EXERCISES } from '@/lib/exerciseDatabase';
import { Check, Dumbbell, HelpCircle, Sparkles, X } from 'lucide-react';

export interface CalibratedExerciseUpdate {
  exerciseId: string;
  catalogId: string;
  name: string;
  muscleGroup: string;
}

interface PostWorkoutAiCalibrationModalProps {
  isOpen: boolean;
  uncalibratedExercises: WorkoutExercise[];
  onConfirm: (calibrations: CalibratedExerciseUpdate[]) => void;
  onCancel: () => void;
}

const MUSCLE_GROUP_OPTIONS = [
  'Pectoral',
  'Espalda / Dorsal',
  'Deltoides',
  'Tríceps',
  'Bíceps',
  'Cuádriceps',
  'Isquiosurales',
  'Glúteos',
  'Pantorrillas',
  'Abdomen / Core',
  'Cardiovascular / Full Body',
];

export function PostWorkoutAiCalibrationModal({
  isOpen,
  uncalibratedExercises,
  onConfirm,
  onCancel,
}: PostWorkoutAiCalibrationModalProps) {
  // Map of exerciseId -> { catalogId, name, muscleGroup, isLinkedToCanonical }
  const [decisions, setDecisions] = useState<
    Record<
      string,
      {
        catalogId: string;
        name: string;
        muscleGroup: string;
        isLinkedToCanonical: boolean;
      }
    >
  >(() => {
    const init: Record<
      string,
      {
        catalogId: string;
        name: string;
        muscleGroup: string;
        isLinkedToCanonical: boolean;
      }
    > = {};

    for (const ex of uncalibratedExercises) {
      const resolved = resolveExerciseIntelligently(ex.name, ex.mode);
      init[ex.id] = {
        catalogId: resolved.canonicalCatalogId,
        name: resolved.isCanonicalMatch ? resolved.canonicalName : ex.name,
        muscleGroup: resolved.muscleGroup,
        isLinkedToCanonical: resolved.isCanonicalMatch,
      };
    }
    return init;
  });

  if (!isOpen || uncalibratedExercises.length === 0) return null;

  const handleApply = () => {
    const updates: CalibratedExerciseUpdate[] = uncalibratedExercises.map((ex) => {
      const dec = decisions[ex.id];
      if (dec) {
        return {
          exerciseId: ex.id,
          catalogId: dec.catalogId,
          name: dec.name,
          muscleGroup: dec.muscleGroup,
        };
      }
      return {
        exerciseId: ex.id,
        catalogId: ex.catalogId,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
      };
    });

    onConfirm(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-md">
      <div className="relative flex max-h-[90dvh] w-full max-w-[430px] flex-col rounded-t-3xl border-t border-x border-stoneborder bg-[#0C0A10] p-5 shadow-2xl text-brand animate-fade-up pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stoneborder/70 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-gothic">
              <Sparkles className="h-4 w-4" />
              <span className="font-gothic text-xs font-bold tracking-widest uppercase">
                Calibración de Ejercicios por IA
              </span>
            </div>
            <h3 className="text-base font-semibold text-brand">
              Confirma los nuevos ejercicios
            </h3>
            <p className="text-[11px] text-brand-muted">
              Para que tu análisis de progreso, 1RM y volumen por grupo muscular sea 100% exacto.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-stoneborder bg-background p-1.5 text-brand-muted hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List of exercises to calibrate */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {uncalibratedExercises.map((ex) => {
            const resolved = resolveExerciseIntelligently(ex.name, ex.mode);
            const currentDec = decisions[ex.id];

            return (
              <div
                key={ex.id}
                className="rounded-2xl border border-stoneborder bg-[#13101A] p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-brand-subtle uppercase tracking-wider">
                      Ejercicio ingresado:
                    </span>
                    <h4 className="text-sm font-bold text-brand">{ex.name}</h4>
                  </div>
                  <span className="rounded-lg bg-gothic/20 border border-gothic/40 px-2 py-0.5 text-[10px] font-mono text-gothic">
                    {resolved.confidence}% confianza
                  </span>
                </div>

                {/* AI Recommendation Banner */}
                {resolved.isCanonicalMatch && (
                  <div className="rounded-xl border border-gothic/40 bg-gothic/10 p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-medium text-brand">
                        Coincidencia con catálogo oficial:
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gothic">
                      {resolved.canonicalName}
                    </p>
                    <p className="text-[10px] text-brand-muted">
                      Grupo muscular: <strong>{resolved.muscleGroup}</strong>
                    </p>

                    <div className="pt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [ex.id]: {
                              catalogId: resolved.canonicalCatalogId,
                              name: resolved.canonicalName,
                              muscleGroup: resolved.muscleGroup,
                              isLinkedToCanonical: true,
                            },
                          }))
                        }
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                          currentDec?.isLinkedToCanonical
                            ? 'bg-gothic text-background'
                            : 'border border-stoneborder bg-background text-brand-muted hover:text-brand'
                        }`}
                      >
                        ✓ Vincular a catálogo
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [ex.id]: {
                              ...prev[ex.id],
                              name: ex.name,
                              isLinkedToCanonical: false,
                            },
                          }))
                        }
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                          !currentDec?.isLinkedToCanonical
                            ? 'bg-brand text-background'
                            : 'border border-stoneborder bg-background text-brand-muted hover:text-brand'
                        }`}
                      >
                        Mantener nombre exacto
                      </button>
                    </div>
                  </div>
                )}

                {/* Muscle Group Selection / Confirmation */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] text-brand-muted">
                    Grupo muscular objetivo para análisis de fatiga:
                  </label>
                  <select
                    value={currentDec?.muscleGroup || resolved.muscleGroup}
                    onChange={(e) =>
                      setDecisions((prev) => ({
                        ...prev,
                        [ex.id]: {
                          ...prev[ex.id],
                          muscleGroup: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-xs text-brand focus:border-gothic focus:outline-none"
                  >
                    {MUSCLE_GROUP_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-stoneborder/70 space-y-2">
          <button
            type="button"
            onClick={handleApply}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-xs font-bold text-background uppercase tracking-wider hover:opacity-95 active:scale-95 transition-all"
          >
            <Check className="h-4 w-4" />
            <span>Confirmar y Ver Reporte de Impacto</span>
          </button>
        </div>
      </div>
    </div>
  );
}
