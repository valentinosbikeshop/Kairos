'use client';

import React, { useMemo, useState } from 'react';
import {
  CalisthenicsSubType,
  CardioDiscipline,
  ExerciseCatalogItem,
  TrainingMode,
} from '@/types/kairos';
import { useKairos } from '@/lib/kairosContext';
import {
  getLastExerciseGhost,
  normalizeSearchText,
  smartSearchExercises,
} from '@/lib/exerciseDatabase';
import { MODE_META } from '@/lib/formatters';
import { resolveExerciseIntelligently } from '@/lib/exerciseClassifierEngine';
import { Plus, Search, Sparkles, X } from 'lucide-react';

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

  if (!isOpen) return null;

  const meta = MODE_META[mode];
  const trimmedQuery = query.trim();
  const qNorm = normalizeSearchText(trimmedQuery);
  const exactExists = matches.some((m) => normalizeSearchText(m.item.name) === qNorm);

  const aiResolved = useMemo(
    () => (trimmedQuery.length >= 2 ? resolveExerciseIntelligently(trimmedQuery, mode, catalog) : null),
    [trimmedQuery, mode, catalog]
  );

  const handleSelect = (item: ExerciseCatalogItem) => {
    addExerciseToBlock(blockId, item);
    setQuery('');
    onClose();
  };

  const handleCreateCustom = (customName?: string, customMuscle?: string) => {
    const finalName = customName || trimmedQuery;
    if (!finalName) return;
    createAndAddCustomExercise(blockId, finalName, mode, {
      muscleGroup: customMuscle || aiResolved?.muscleGroup,
      calisthenicsSubType: customCalisthenicsType,
      cardioDiscipline: selectedDiscipline ?? defaultCardioDiscipline ?? 'jumprope',
    });
    setQuery('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-[430px] max-h-[85dvh] flex flex-col rounded-t-3xl border-t border-x border-stoneborder bg-surface shadow-2xl animate-fade-up pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stoneborder px-5 py-3.5">
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
        <div className="p-4 space-y-2.5 border-b border-stoneborder">
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

              {aiResolved.isCanonicalMatch ? (
                <div className="rounded-xl border border-gothic/40 bg-gothic/10 p-2 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-gothic flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Detectado por IA: {aiResolved.canonicalName}
                    </span>
                    <span className="text-[10px] text-brand-muted">{aiResolved.confidence}% certeza</span>
                  </div>
                  <p className="text-[10px] text-brand-muted">
                    Grupo: <strong>{aiResolved.muscleGroup}</strong>
                  </p>
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
                      Crear "{trimmedQuery}"
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-brand-muted">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-gothic" />
                      Grupo muscular sugerido: <strong className="text-brand">{aiResolved.muscleGroup}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCreateCustom(trimmedQuery, aiResolved.muscleGroup)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-gothic/40 bg-gothic/10 py-2 px-3 text-xs font-semibold text-brand active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {`Crear "${trimmedQuery}"`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clean Results List */}
        <div className="flex-1 overflow-y-auto divide-y divide-stoneborder/60 px-4 py-1">
          {matches.map(({ item, matchedAlias }) => {
            const ghost = getLastExerciseGhost(sessions, item.id, item.name);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full py-3 text-left flex items-center justify-between gap-3 hover:opacity-90"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-brand">{item.name}</span>
                    {matchedAlias && (
                      <span className="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] text-gothic">
                        “{matchedAlias}”
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-brand-muted">
                    {item.muscleGroup}
                    {ghost ? ` · Última: ${ghost.summaryLine}` : ''}
                  </p>
                </div>

                <Plus className="h-4 w-4 shrink-0 text-gothic" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
