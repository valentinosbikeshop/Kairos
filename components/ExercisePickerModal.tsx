'use client';

import React, { useMemo, useState } from 'react';
import {
  CalisthenicsSubType,
  CardioDiscipline,
  ExerciseCatalogItem,
  OutOfContextWordAnalysis,
  TrainingMode,
} from '@/types/kairos';
import { useKairos } from '@/lib/kairosContext';
import {
  getLastExerciseGhost,
  normalizeSearchText,
  smartSearchExercises,
} from '@/lib/exerciseDatabase';
import { MODE_META } from '@/lib/formatters';
import {
  detectOutOfContextExerciseWords,
  resolveExerciseIntelligently,
  synthesizeExerciseDeepProfile,
} from '@/lib/exerciseClassifierEngine';
import {
  ExerciseDeepProfileModal,
  ExerciseOutOfContextPromptModal,
} from '@/components/ExerciseIntelligenceModal';
import { AlertTriangle, Brain, Plus, Search, Sparkles, X } from 'lucide-react';

interface ExercisePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockId: string;
  mode: TrainingMode;
  defaultCardioDiscipline?: CardioDiscipline;
}

const CARDIO_LABELS: Record<CardioDiscipline, string> = {
  jumprope: 'Cuerda',
  running: 'Running',
  swimming: 'Natación',
  cycling: 'Bici / Remo',
};

export function ExercisePickerModal({
  isOpen,
  onClose,
  blockId,
  mode,
  defaultCardioDiscipline,
}: ExercisePickerModalProps) {
  const { catalog, sessions, addExerciseToBlock, createAndAddCustomExercise } = useKairos();

  const [query, setQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<CardioDiscipline | undefined>(
    defaultCardioDiscipline
  );
  const [customCalisthenicsType, setCustomCalisthenicsType] =
    useState<CalisthenicsSubType>('dynamic');
  const [pendingOutOfContext, setPendingOutOfContext] = useState<{
    analysis: OutOfContextWordAnalysis;
    muscleGroup?: string;
  } | null>(null);
  const [inspectedExercise, setInspectedExercise] = useState<{
    name: string;
    mode: TrainingMode;
    catalogId?: string;
  } | null>(null);

  const matches = useMemo(
    () =>
      smartSearchExercises(
        catalog,
        mode,
        query,
        mode === 'cardio' ? selectedDiscipline : undefined
      ),
    [catalog, mode, query, selectedDiscipline]
  );

  const trimmedQuery = query.trim();
  const aiResolved = useMemo(
    () => (trimmedQuery.length >= 2 ? resolveExerciseIntelligently(trimmedQuery, mode, catalog) : null),
    [trimmedQuery, mode, catalog]
  );

  if (!isOpen) return null;

  const meta = MODE_META[mode];
  const qNorm = normalizeSearchText(trimmedQuery);
  const exactExists = matches.some((m) => normalizeSearchText(m.item.name) === qNorm);

  const handleSelect = (item: ExerciseCatalogItem) => {
    addExerciseToBlock(blockId, item);
    setQuery('');
    onClose();
  };

  const executeCreateCustom = (finalName: string, customMuscle?: string) => {
    if (!finalName) return;
    const resolved = resolveExerciseIntelligently(finalName, mode, catalog);
    createAndAddCustomExercise(blockId, finalName, mode, {
      muscleGroup: customMuscle || resolved.muscleGroup,
      calisthenicsSubType: customCalisthenicsType,
      cardioDiscipline: selectedDiscipline ?? defaultCardioDiscipline ?? 'jumprope',
    });
    setPendingOutOfContext(null);
    setQuery('');
    onClose();
  };

  const handleCreateCustom = (customName?: string, customMuscle?: string) => {
    const finalName = (customName || trimmedQuery).trim();
    if (!finalName) return;
    const ooc = detectOutOfContextExerciseWords(finalName);
    if (ooc.hasSuspiciousWords) {
      setPendingOutOfContext({
        analysis: ooc,
        muscleGroup: customMuscle || aiResolved?.muscleGroup,
      });
      return;
    }
    executeCreateCustom(finalName, customMuscle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-[430px] h-[85dvh] max-h-[85dvh] flex flex-col rounded-t-3xl border-t border-x border-stoneborder bg-surface shadow-2xl animate-fade-up pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-stoneborder px-5 py-3.5">
          <div>
            <span className="text-[11px] text-gothic">{meta.label}</span>
            <h3 className="font-gothic text-sm font-semibold text-brand">Elegir Ejercicio</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar buscador"
            className="rounded-xl border border-stoneborder bg-background p-2 text-brand-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="shrink-0 p-4 space-y-2.5 border-b border-stoneborder">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: Press militar, rompecabezas, serrucho..."
              autoFocus
              className="w-full rounded-xl border border-stoneborder bg-background py-2.5 pl-10 pr-9 text-[16px] text-brand placeholder-brand-subtle focus:border-gothic focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {mode === 'cardio' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedDiscipline(undefined)}
                className={`shrink-0 rounded-xl border px-3 py-1 text-xs font-medium ${
                  !selectedDiscipline
                    ? 'border-gothic bg-gothic/15 text-brand'
                    : 'border-stoneborder bg-background text-brand-muted'
                }`}
              >
                Todos
              </button>
              {(['jumprope', 'running', 'swimming', 'cycling'] as CardioDiscipline[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDiscipline(d)}
                  className={`shrink-0 rounded-xl border px-3 py-1 text-xs font-medium ${
                    selectedDiscipline === d
                      ? 'border-gothic bg-gothic/15 text-brand'
                      : 'border-stoneborder bg-background text-brand-muted'
                  }`}
                >
                  {CARDIO_LABELS[d]}
                </button>
              ))}
            </div>
          )}

          {trimmedQuery.length >= 2 && !exactExists && aiResolved && (
            <div className="rounded-xl border border-stoneborder bg-background/90 p-2.5 space-y-2.5">
              {mode === 'calisthenics' && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setCustomCalisthenicsType('dynamic')}
                    className={`rounded-lg px-2.5 py-1 ${
                      customCalisthenicsType === 'dynamic'
                        ? 'bg-gothic/20 text-brand border border-gothic/40'
                        : 'text-brand-muted'
                    }`}
                  >
                    Dinámico
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomCalisthenicsType('isometric')}
                    className={`rounded-lg px-2.5 py-1 ${
                      customCalisthenicsType === 'isometric'
                        ? 'bg-gothic/20 text-brand border border-gothic/40'
                        : 'text-brand-muted'
                    }`}
                  >
                    Isométrico
                  </button>
                </div>
              )}

              {aiResolved.outOfContextAnalysis.hasSuspiciousWords && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold">Palabras extra detectadas: </span>
                    {aiResolved.outOfContextAnalysis.suspiciousWords.map((w) => `«${w}»`).join(', ')}. Al añadirlo te consultaremos si fue con querer o un error.
                  </div>
                </div>
              )}

              {aiResolved.isCanonicalMatch ? (
                <div className="rounded-xl border border-gothic/40 bg-gothic/10 p-2 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-gothic flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Detectado por IA: {aiResolved.canonicalName}
                    </span>
                    <span className="text-[10px] text-brand-muted">{aiResolved.confidence}% certeza</span>
                  </div>
                  <div className="space-y-1 text-[10px] text-brand-muted">
                    <p>
                      Principal: <strong className="text-brand">{aiResolved.deepProfile.primaryMuscles.join(', ')}</strong>
                    </p>
                    <p>
                      Sinergistas necesarios: <span className="text-brand/80">{aiResolved.deepProfile.secondaryMuscles.slice(0, 2).join(', ')}</span> · Fatiga SNC: <strong className="text-brand">{aiResolved.deepProfile.cnsFatigueIndex}/10</strong> · SFR: <strong className="text-emerald-300">{aiResolved.deepProfile.sfrScore}/10</strong>
                    </p>
                  </div>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const item = catalog.find((c) => c.id === aiResolved.canonicalCatalogId);
                        if (item) {
                          handleSelect(item);
                        } else {
                          handleCreateCustom(aiResolved.canonicalName, aiResolved.muscleGroup);
                        }
                      }}
                      className="flex-1 rounded-lg bg-gothic py-1.5 px-2 text-xs font-bold text-background uppercase tracking-wider hover:opacity-90 active:scale-95"
                    >
                      ✓ Usar Oficial
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCreateCustom(trimmedQuery, aiResolved.muscleGroup)}
                      className="flex-1 rounded-lg border border-stoneborder bg-background py-1.5 px-2 text-[11px] font-medium text-brand-muted hover:text-brand active:scale-95"
                    >
                      Crear &quot;{trimmedQuery}&quot;
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="space-y-0.5 text-[10px] text-brand-muted">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-gothic" />
                        Músculo principal: <strong className="text-brand">{aiResolved.deepProfile.primaryMuscles[0] || aiResolved.muscleGroup}</strong>
                      </span>
                    </div>
                    <p>
                      Sinergistas: <span className="text-brand/80">{aiResolved.deepProfile.secondaryMuscles.slice(0, 2).join(', ')}</span> · Fatiga SNC: <strong className="text-brand">{aiResolved.deepProfile.cnsFatigueIndex}/10</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCreateCustom(trimmedQuery, aiResolved.muscleGroup)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-gothic/40 bg-gothic/10 py-2 px-3 text-xs font-semibold text-brand active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {`Añadir e Investigar "${trimmedQuery}" con IA`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clean Results List */}
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y divide-y divide-stoneborder/60 px-4 py-1">
          {matches.map(({ item, matchedAlias }) => {
            const ghost = getLastExerciseGhost(sessions, item.id, item.name);
            const prof = item.deepProfile || synthesizeExerciseDeepProfile(item.name, item.mode, item.id);
            return (
              <div
                key={item.id}
                className="w-full py-2.5 flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="min-w-0 flex-1 text-left space-y-0.5 hover:opacity-90"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-brand">{item.name}</span>
                    {matchedAlias && (
                      <span className="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] text-gothic">
                        “{matchedAlias}”
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-muted">
                    {item.muscleGroup} · <span className="text-brand/75">{prof.mechanicType}</span> · SNC {prof.cnsFatigueIndex}/10 · SFR {prof.sfrScore}/10
                    {ghost ? ` · Última: ${ghost.summaryLine}` : ''}
                  </p>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setInspectedExercise({
                        name: item.name,
                        mode: item.mode,
                        catalogId: item.id,
                      })
                    }
                    title="Ver ficha biomecánica profunda"
                    className="rounded-lg border border-stoneborder bg-background p-1.5 text-brand-muted hover:border-gothic/50 hover:text-brand"
                  >
                    <Brain className="h-3.5 w-3.5 text-gothic" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    aria-label={`Añadir ${item.name}`}
                    className="rounded-lg border border-gothic/30 bg-gothic/10 p-1.5 text-gothic hover:bg-gothic/20"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {matches.length === 0 && (
            <div className="py-12 px-4 text-center space-y-2">
              <Search className="h-6 w-6 text-brand-subtle opacity-40 mx-auto" />
              <p className="text-xs font-semibold text-brand">
                {trimmedQuery
                  ? `Sin sugerencias directas para «${trimmedQuery}»`
                  : 'Escribe para buscar o añadir ejercicios'}
              </p>
              <p className="text-[11px] text-brand-muted max-w-xs mx-auto leading-relaxed">
                {trimmedQuery
                  ? 'Puedes añadirlo como ejercicio nuevo con el botón de IA superior para investigar su perfil muscular y fatiga.'
                  : 'Filtra por nombre o variante para ver la biblioteca completa.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Out-of-Context Verification Prompt Modal */}
      <ExerciseOutOfContextPromptModal
        isOpen={Boolean(pendingOutOfContext)}
        analysis={pendingOutOfContext?.analysis ?? null}
        onConfirmClean={(cleanedName) =>
          executeCreateCustom(cleanedName, pendingOutOfContext?.muscleGroup)
        }
        onConfirmIntentional={(originalName) =>
          executeCreateCustom(originalName, pendingOutOfContext?.muscleGroup)
        }
        onCancel={() => setPendingOutOfContext(null)}
      />

      {/* Deep Biomechanical Profile Inspection Modal */}
      <ExerciseDeepProfileModal
        isOpen={Boolean(inspectedExercise)}
        onClose={() => setInspectedExercise(null)}
        exerciseName={inspectedExercise?.name || ''}
        mode={inspectedExercise?.mode}
        catalogId={inspectedExercise?.catalogId}
      />
    </div>
  );
}
