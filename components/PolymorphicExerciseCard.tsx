'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CalisthenicsDynamicSet,
  CalisthenicsIsometricSet,
  CalisthenicsProgression,
  CalisthenicsSubType,
  CardioDiscipline,
  CyclingSet,
  HypertrophySet,
  HypertrophySetType,
  HyroxSet,
  HyroxStationName,
  JumpRopeSet,
  JumpRopeStyle,
  RirValue,
  RunningSet,
  RunningType,
  StrengthSet,
  SwimmingSet,
  SwimmingStroke,
  WorkoutExercise,
} from '@/types/kairos';
import { useKairos } from '@/lib/kairosContext';
import { useTimerEngine } from '@/components/TimerEngine';
import { kairosAudio } from '@/lib/audioEngine';
import { getLastExerciseGhost } from '@/lib/exerciseDatabase';
import {
  calculateE1RM,
  calculateJumpRopeRpm,
  calculatePercentOf1RM,
  calculateRunningPaceSecPerKm,
  calculateSwimPaceSecPer100m,
  formatMmSs,
  parseMmSsInput,
  uid,
} from '@/lib/formatters';
import {
  Check,
  Clock,
  Play,
  Plus,
  Square,
  Timer,
  Trash2,
} from 'lucide-react';

interface TimeMmSsInputProps {
  seconds: number;
  onChangeSeconds: (sec: number) => void;
  ariaLabel: string;
}

function TimeMmSsInput({ seconds, onChangeSeconds, ariaLabel }: TimeMmSsInputProps) {
  const [draft, setDraft] = useState(() => formatMmSs(seconds));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(formatMmSs(seconds));
    }
  }, [seconds, focused]);

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const parsed = parseMmSsInput(draft);
        onChangeSeconds(parsed);
        setDraft(formatMmSs(parsed));
      }}
      className="w-full rounded-xl border border-stoneborder bg-background px-2 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic/60 focus:outline-none"
    />
  );
}

interface InlineSplitStopwatchProps {
  currentSeconds: number;
  onStopWithSeconds: (sec: number) => void;
}

function InlineSplitStopwatch({
  currentSeconds,
  onStopWithSeconds,
}: InlineSplitStopwatchProps) {
  const [runningSinceMs, setRunningSinceMs] = useState<number | null>(null);
  const [liveSec, setLiveSec] = useState(0);

  useEffect(() => {
    if (!runningSinceMs) return;
    const id = setInterval(() => {
      setLiveSec(Math.floor((Date.now() - runningSinceMs) / 1000));
    }, 200);
    return () => clearInterval(id);
  }, [runningSinceMs]);

  if (runningSinceMs) {
    return (
      <button
        type="button"
        onClick={() => {
          const elapsed = Math.max(1, Math.round((Date.now() - runningSinceMs) / 1000));
          setRunningSinceMs(null);
          onStopWithSeconds(elapsed);
          kairosAudio.playSetCheckFeedback();
        }}
        className="inline-flex items-center gap-1 rounded-xl border border-gothic/50 bg-gothic/15 px-2.5 py-1.5 font-mono text-xs tabular-nums text-gothic animate-pulse active:scale-95"
      >
        <Square className="h-3 w-3 fill-current" />
        {formatMmSs(liveSec)}
      </button>
    );
  }

  return (
    <button
      type="button"
      title="Cronometrar tramo en vivo"
      onClick={() => {
        kairosAudio.unlock();
        setLiveSec(currentSeconds > 0 ? 0 : 0);
        setRunningSinceMs(Date.now());
      }}
      className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-[11px] font-medium text-brand-muted hover:border-gothic/40 hover:text-brand active:scale-95"
    >
      <Play className="h-3 w-3 fill-current" />
      Crono
    </button>
  );
}

interface PolymorphicExerciseCardProps {
  blockId: string;
  exercise: WorkoutExercise;
}

const HYPERTROPHY_TYPES: HypertrophySetType[] = [
  'Calentamiento',
  'Efectiva',
  'Drop Set',
  'Rest-Pause',
  'Myo-Reps',
];

const RIR_OPTIONS: RirValue[] = ['0', '1', '2', '3', '4+'];

const RPE_OPTIONS: number[] = [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0];

const PROGRESSIONS: CalisthenicsProgression[] = [
  'Tuck',
  'Advanced Tuck',
  'One Leg',
  'Straddle',
  'Half Lay',
  'Full',
];

const HYROX_STATIONS: HyroxStationName[] = [
  '1000m Run',
  'SkiErg',
  'Sled Push',
  'Sled Pull',
  'Burpee Broad Jumps',
  'Rowing',
  'Farmers Carry',
  'Sandbag Lunges',
  'Wall Balls',
];

const JUMPROPE_STYLES: JumpRopeStyle[] = [
  'Básico',
  'Boxer Step',
  'Dobles / Double Unders',
  'Cruzados',
  'High Knees',
];

const RUNNING_TYPES: RunningType[] = [
  'Zona 2 Continua',
  'Series de Velocidad / Fartlek',
  'Tempo Run',
];

const SWIM_STROKES: SwimmingStroke[] = ['Crol/Libre', 'Espalda', 'Pecho/Braza', 'Mariposa'];

const REST_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 300];

export function PolymorphicExerciseCard({
  blockId,
  exercise,
}: PolymorphicExerciseCardProps) {
  const { sessions, mutateExercise, removeExerciseFromBlock } = useKairos();
  const { startRestTimer, startIsometricTimer } = useTimerEngine();

  const ghost = useMemo(
    () => getLastExerciseGhost(sessions, exercise.catalogId, exercise.name),
    [sessions, exercise.catalogId, exercise.name]
  );

  const triggerCheckAndAutoRest = (nextCompleted: boolean, restSec: number) => {
    if (nextCompleted) {
      kairosAudio.playSetCheckFeedback();
      if (restSec > 0) {
        startRestTimer(restSec, `${exercise.name} (${restSec}s)`);
      }
    }
  };

  const handleSwitchCalisthenicsType = (nextType: CalisthenicsSubType) => {
    mutateExercise(blockId, exercise.id, (ex) => {
      if (nextType === 'isometric') {
        return {
          ...ex,
          calisthenicsSubType: 'isometric',
          calisthenicsIsometricSets: ex.calisthenicsIsometricSets?.length
            ? ex.calisthenicsIsometricSets
            : [
                {
                  id: uid('ci'),
                  progression: 'Advanced Tuck',
                  targetSeconds: 12,
                  actualSeconds: 12,
                  addedWeightKg: 0,
                  restSeconds: ex.defaultRestSeconds,
                  completed: false,
                },
              ],
        };
      }
      return {
        ...ex,
        calisthenicsSubType: 'dynamic',
        calisthenicsDynamicSets: ex.calisthenicsDynamicSets?.length
          ? ex.calisthenicsDynamicSets
          : [
              {
                id: uid('cd'),
                variation: 'Estándar',
                addedWeightKg: 0,
                reps: 8,
                rir: '1',
                restSeconds: ex.defaultRestSeconds,
                completed: false,
              },
            ],
      };
    });
  };

  const handleSwitchCardioDiscipline = (nextDisc: CardioDiscipline) => {
    mutateExercise(blockId, exercise.id, (ex) => {
      const updated: WorkoutExercise = { ...ex, cardioDiscipline: nextDisc };
      if (nextDisc === 'jumprope' && !updated.jumpRopeSets?.length) {
        updated.jumpRopeSets = [
          {
            id: uid('jr'),
            jumps: 150,
            durationSeconds: 60,
            style: 'Boxer Step',
            misses: 0,
            restSeconds: ex.defaultRestSeconds,
            completed: false,
          },
        ];
      } else if (nextDisc === 'running' && !updated.runningSets?.length) {
        updated.runningSets = [
          {
            id: uid('rn'),
            distanceMeters: 1000,
            durationSeconds: 255,
            inclinePercent: 0,
            runType: 'Zona 2 Continua',
            restSeconds: ex.defaultRestSeconds,
            completed: false,
          },
        ];
      } else if (nextDisc === 'swimming' && !updated.swimmingSets?.length) {
        updated.swimmingSets = [
          {
            id: uid('sw'),
            poolLengthMeters: 25,
            laps: 4,
            stroke: 'Crol/Libre',
            durationSeconds: 100,
            restSeconds: ex.defaultRestSeconds,
            completed: false,
          },
        ];
      } else if (nextDisc === 'cycling' && !updated.cyclingSets?.length) {
        updated.cyclingSets = [
          {
            id: uid('cy'),
            durationSeconds: 300,
            distanceMeters: 2500,
            avgWatts: 240,
            cadenceRpm: 90,
            restSeconds: ex.defaultRestSeconds,
            completed: false,
          },
        ];
      }
      return updated;
    });
  };

  return (
    <div className="border-t border-stoneborder/70 pt-4 first:border-t-0 first:pt-0 space-y-3">
      {/* Exercise Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-brand leading-snug">{exercise.name}</h4>
          <div className="flex items-center gap-2 text-[11px] text-brand-muted mt-0.5 flex-wrap">
            <span>{exercise.muscleGroup}</span>
            {ghost && (
              <>
                <span>·</span>
                <span className="text-brand-muted">Anterior: {ghost.summaryLine}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Auto-Rest Duration Selector */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-2 py-1">
            <Clock className="h-3 w-3 text-brand-muted" />
            <select
              aria-label="Descanso automático en segundos"
              value={exercise.defaultRestSeconds}
              onChange={(e) => {
                const sec = Number(e.target.value);
                mutateExercise(blockId, exercise.id, (ex) => ({
                  ...ex,
                  defaultRestSeconds: sec,
                  hypertrophySets: ex.hypertrophySets?.map((s) => ({ ...s, restSeconds: sec })),
                  strengthSets: ex.strengthSets?.map((s) => ({ ...s, restSeconds: sec })),
                  calisthenicsDynamicSets: ex.calisthenicsDynamicSets?.map((s) => ({
                    ...s,
                    restSeconds: sec,
                  })),
                  calisthenicsIsometricSets: ex.calisthenicsIsometricSets?.map((s) => ({
                    ...s,
                    restSeconds: sec,
                  })),
                  jumpRopeSets: ex.jumpRopeSets?.map((s) => ({ ...s, restSeconds: sec })),
                  runningSets: ex.runningSets?.map((s) => ({ ...s, restSeconds: sec })),
                  swimmingSets: ex.swimmingSets?.map((s) => ({ ...s, restSeconds: sec })),
                  cyclingSets: ex.cyclingSets?.map((s) => ({ ...s, restSeconds: sec })),
                }));
              }}
              className="bg-transparent text-[16px] text-brand-muted focus:outline-none"
            >
              {REST_OPTIONS.map((r) => (
                <option key={r} value={r} className="bg-surface text-brand">
                  {r}s
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => removeExerciseFromBlock(blockId, exercise.id)}
            aria-label="Eliminar ejercicio"
            className="flex h-8 w-7 items-center justify-center text-brand-muted hover:text-status-regress active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ================= A. MODO HIPERTROFIA ================= */}
      {exercise.mode === 'hypertrophy' && (
        <HypertrophyRows
          sets={exercise.hypertrophySets ?? []}
          defaultRest={exercise.defaultRestSeconds}
          onChangeSets={(next) =>
            mutateExercise(blockId, exercise.id, (ex) => ({ ...ex, hypertrophySets: next }))
          }
          onToggleComplete={triggerCheckAndAutoRest}
        />
      )}

      {/* ================= B. MODO FUERZA ================= */}
      {exercise.mode === 'strength' && (
        <StrengthRows
          sets={exercise.strengthSets ?? []}
          referenceOneRmKg={exercise.referenceOneRmKg}
          defaultRest={exercise.defaultRestSeconds}
          onChangeRef1Rm={(val) =>
            mutateExercise(blockId, exercise.id, (ex) => ({ ...ex, referenceOneRmKg: val }))
          }
          onChangeSets={(next) =>
            mutateExercise(blockId, exercise.id, (ex) => ({ ...ex, strengthSets: next }))
          }
          onToggleComplete={triggerCheckAndAutoRest}
        />
      )}

      {/* ================= C. MODO CALISTENIA ================= */}
      {exercise.mode === 'calisthenics' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-background p-1 border border-stoneborder">
            <button
              type="button"
              onClick={() => handleSwitchCalisthenicsType('dynamic')}
              className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
                (exercise.calisthenicsSubType ?? 'dynamic') === 'dynamic'
                  ? 'bg-elevated text-brand border border-gothic/35'
                  : 'text-brand-muted'
              }`}
            >
              Dinámico
            </button>
            <button
              type="button"
              onClick={() => handleSwitchCalisthenicsType('isometric')}
              className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
                exercise.calisthenicsSubType === 'isometric'
                  ? 'bg-elevated text-brand border border-gothic/35'
                  : 'text-brand-muted'
              }`}
            >
              Isométrico
            </button>
          </div>

          {exercise.calisthenicsSubType === 'isometric' ? (
            <CalisthenicsIsometricRows
              sets={exercise.calisthenicsIsometricSets ?? []}
              defaultRest={exercise.defaultRestSeconds}
              onLaunchIsoTimer={(set) =>
                startIsometricTimer({
                  prepSeconds: 3,
                  holdSeconds: set.targetSeconds,
                  label: `${exercise.name} (${set.progression})`,
                  linkedTarget: {
                    blockId,
                    exerciseId: exercise.id,
                    setId: set.id,
                  },
                })
              }
              onChangeSets={(next) =>
                mutateExercise(blockId, exercise.id, (ex) => ({
                  ...ex,
                  calisthenicsIsometricSets: next,
                }))
              }
              onToggleComplete={triggerCheckAndAutoRest}
            />
          ) : (
            <CalisthenicsDynamicRows
              sets={exercise.calisthenicsDynamicSets ?? []}
              defaultRest={exercise.defaultRestSeconds}
              onChangeSets={(next) =>
                mutateExercise(blockId, exercise.id, (ex) => ({
                  ...ex,
                  calisthenicsDynamicSets: next,
                }))
              }
              onToggleComplete={triggerCheckAndAutoRest}
            />
          )}
        </div>
      )}

      {/* ================= D. MODO HYROX ================= */}
      {exercise.mode === 'hyrox' && (
        <HyroxRows
          sets={exercise.hyroxSets ?? []}
          defaultRest={exercise.defaultRestSeconds}
          onChangeSets={(next) =>
            mutateExercise(blockId, exercise.id, (ex) => ({ ...ex, hyroxSets: next }))
          }
          onToggleComplete={triggerCheckAndAutoRest}
        />
      )}

      {/* ================= E. MODO CARDIO POLIMÓRFICO ================= */}
      {exercise.mode === 'cardio' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-background p-1 border border-stoneborder">
            {(
              [
                { id: 'jumprope', label: 'Cuerda' },
                { id: 'running', label: 'Running' },
                { id: 'swimming', label: 'Natación' },
                { id: 'cycling', label: 'Ciclismo' },
              ] as { id: CardioDiscipline; label: string }[]
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleSwitchCardioDiscipline(d.id)}
                className={`rounded-lg py-1.5 text-[11px] font-medium transition-all ${
                  (exercise.cardioDiscipline ?? 'jumprope') === d.id
                    ? 'bg-elevated text-brand border border-gothic/35'
                    : 'text-brand-muted'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {(exercise.cardioDiscipline ?? 'jumprope') === 'jumprope' && (
            <JumpRopeRows
              sets={exercise.jumpRopeSets ?? []}
              defaultRest={exercise.defaultRestSeconds}
              onChangeSets={(next) =>
                mutateExercise(blockId, exercise.id, (ex) => ({ ...ex, jumpRopeSets: next }))
              }
              onToggleComplete={triggerCheckAndAutoRest}
            />
          )}

          {exercise.cardioDiscipline === 'running' && (
            <RunningRows
              sets={exercise.runningSets ?? []}
              defaultRest={exercise.defaultRestSeconds}
              onChangeSets={(next) =>
                mutateExercise(blockId, exercise.id, (ex) => ({ ...ex, runningSets: next }))
              }
              onToggleComplete={triggerCheckAndAutoRest}
            />
          )}

          {exercise.cardioDiscipline === 'swimming' && (
            <SwimmingRows
              sets={exercise.swimmingSets ?? []}
              defaultRest={exercise.defaultRestSeconds}
              onChangeSets={(next) =>
                mutateExercise(blockId, exercise.id, (ex) => ({ ...ex, swimmingSets: next }))
              }
              onToggleComplete={triggerCheckAndAutoRest}
            />
          )}

          {exercise.cardioDiscipline === 'cycling' && (
            <CyclingRows
              sets={exercise.cyclingSets ?? []}
              defaultRest={exercise.defaultRestSeconds}
              onChangeSets={(next) =>
                mutateExercise(blockId, exercise.id, (ex) => ({ ...ex, cyclingSets: next }))
              }
              onToggleComplete={triggerCheckAndAutoRest}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-TABLES FOR EACH POLYMORPHIC TRAINING MODE (UNCLUTTERED GOTHIC PALETTE)
// ============================================================================

function HypertrophyRows({
  sets,
  defaultRest,
  onChangeSets,
  onToggleComplete,
}: {
  sets: HypertrophySet[];
  defaultRest: number;
  onChangeSets: (next: HypertrophySet[]) => void;
  onToggleComplete: (completed: boolean, restSec: number) => void;
}) {
  const addSet = () => {
    const last = sets[sets.length - 1];
    onChangeSets([
      ...sets,
      {
        id: uid('hy'),
        weightKg: last ? last.weightKg : 40,
        reps: last ? last.reps : 10,
        rir: last ? last.rir : '1',
        setType: last && last.setType !== 'Calentamiento' ? last.setType : 'Efectiva',
        restSeconds: last ? last.restSeconds : defaultRest,
        completed: false,
      },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[24px_1.15fr_1fr_0.85fr_0.75fr_38px] gap-1.5 px-1 text-[10px] uppercase tracking-wider text-brand-muted">
        <span>#</span>
        <span>Serie</span>
        <span className="text-center">Kg</span>
        <span className="text-center">Reps</span>
        <span className="text-center">RIR</span>
        <span className="text-center">✓</span>
      </div>

      {sets.map((s, idx) => (
        <div
          key={s.id}
          className={`grid grid-cols-[24px_1.15fr_1fr_0.85fr_0.75fr_38px] items-center gap-1.5 rounded-xl border p-1.5 transition-colors ${
            s.completed
              ? 'border-gothic/40 bg-gothic/10'
              : 'border-stoneborder bg-background/60'
          }`}
        >
          <button
            type="button"
            title="Eliminar serie"
            onClick={() => sets.length > 1 && onChangeSets(sets.filter((x) => x.id !== s.id))}
            className="text-xs text-brand-muted hover:text-status-regress text-center"
          >
            {idx + 1}
          </button>

          <select
            aria-label="Tipo de serie"
            value={s.setType}
            onChange={(e) =>
              onChangeSets(
                sets.map((x) =>
                  x.id === s.id ? { ...x, setType: e.target.value as HypertrophySetType } : x
                )
              )
            }
            className="w-full truncate rounded-lg border border-stoneborder bg-surface px-1.5 py-1.5 text-[16px] text-brand focus:border-gothic/60 focus:outline-none"
          >
            {HYPERTROPHY_TYPES.map((t) => (
              <option key={t} value={t} className="bg-surface">
                {t}
              </option>
            ))}
          </select>

          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={s.weightKg || ''}
            onChange={(e) =>
              onChangeSets(
                sets.map((x) =>
                  x.id === s.id ? { ...x, weightKg: parseFloat(e.target.value) || 0 } : x
                )
              )
            }
            className="w-full rounded-lg border border-stoneborder bg-surface px-1.5 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic/60 focus:outline-none"
          />

          <input
            type="number"
            inputMode="numeric"
            value={s.reps || ''}
            onChange={(e) =>
              onChangeSets(
                sets.map((x) =>
                  x.id === s.id ? { ...x, reps: parseInt(e.target.value, 10) || 0 } : x
                )
              )
            }
            className="w-full rounded-lg border border-stoneborder bg-surface px-1 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic/60 focus:outline-none"
          />

          <select
            aria-label="RIR repeticiones en reserva"
            value={s.rir}
            onChange={(e) =>
              onChangeSets(
                sets.map((x) => (x.id === s.id ? { ...x, rir: e.target.value as RirValue } : x))
              )
            }
            className="w-full rounded-lg border border-stoneborder bg-surface px-1 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic/60 focus:outline-none"
          >
            {RIR_OPTIONS.map((r) => (
              <option key={r} value={r} className="bg-surface">
                {r}
              </option>
            ))}
          </select>

          <button
            type="button"
            aria-label="Completar serie"
            onClick={() => {
              const next = !s.completed;
              onChangeSets(sets.map((x) => (x.id === s.id ? { ...x, completed: next } : x)));
              onToggleComplete(next, s.restSeconds || defaultRest);
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 ${
              s.completed
                ? 'border-gothic bg-gothic/25 text-brand'
                : 'border-stoneborder bg-surface text-brand-muted'
            }`}
          >
            <Check className="h-4 w-4 stroke-[2.2]" />
          </button>
        </div>
      ))}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={addSet}
          className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 text-gothic" />
          Serie
        </button>
      </div>
    </div>
  );
}

function StrengthRows({
  sets,
  referenceOneRmKg,
  defaultRest,
  onChangeRef1Rm,
  onChangeSets,
  onToggleComplete,
}: {
  sets: StrengthSet[];
  referenceOneRmKg?: number;
  defaultRest: number;
  onChangeRef1Rm: (val: number) => void;
  onChangeSets: (next: StrengthSet[]) => void;
  onToggleComplete: (completed: boolean, restSec: number) => void;
}) {
  const bestLiveE1rm = useMemo(() => {
    let best = 0;
    sets.forEach((s) => {
      const e1 = calculateE1RM(s.weightKg, s.reps);
      if (e1 > best) best = e1;
    });
    return best;
  }, [sets]);

  const effectiveRef1Rm =
    referenceOneRmKg && referenceOneRmKg > 0 ? referenceOneRmKg : bestLiveE1rm || 100;

  const addSet = () => {
    const last = sets[sets.length - 1];
    onChangeSets([
      ...sets,
      {
        id: uid('st'),
        weightKg: last ? last.weightKg : 100,
        reps: last ? last.reps : 3,
        rpe: last ? last.rpe : 8.5,
        restSeconds: last ? last.restSeconds : defaultRest,
        completed: false,
      },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl border border-stoneborder bg-background/60 px-3 py-1.5 text-xs">
        <span className="text-brand-muted">1RM de referencia</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            aria-label="1RM de referencia en kg"
            value={effectiveRef1Rm}
            onChange={(e) => onChangeRef1Rm(parseFloat(e.target.value) || 0)}
            className="w-20 rounded-lg border border-stoneborder bg-surface px-2 py-0.5 text-right font-mono text-[16px] tabular-nums text-gothic focus:outline-none"
          />
          <span className="text-xs text-brand-muted">kg</span>
        </div>
      </div>

      <div className="grid grid-cols-[24px_1.1fr_0.8fr_0.85fr_0.8fr_38px] gap-1.5 px-1 text-[10px] uppercase tracking-wider text-brand-muted">
        <span>#</span>
        <span className="text-center">Kg</span>
        <span className="text-center">Reps</span>
        <span className="text-center">RPE</span>
        <span className="text-center">%1RM</span>
        <span className="text-center">✓</span>
      </div>

      {sets.map((s, idx) => {
        const pct = calculatePercentOf1RM(s.weightKg, effectiveRef1Rm);
        return (
          <div
            key={s.id}
            className={`grid grid-cols-[24px_1.1fr_0.8fr_0.85fr_0.8fr_38px] items-center gap-1.5 rounded-xl border p-1.5 transition-colors ${
              s.completed
                ? 'border-gothic/40 bg-gothic/10'
                : 'border-stoneborder bg-background/60'
            }`}
          >
            <button
              type="button"
              onClick={() => sets.length > 1 && onChangeSets(sets.filter((x) => x.id !== s.id))}
              className="text-xs text-brand-muted hover:text-status-regress text-center"
            >
              {idx + 1}
            </button>

            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={s.weightKg || ''}
              onChange={(e) =>
                onChangeSets(
                  sets.map((x) =>
                    x.id === s.id ? { ...x, weightKg: parseFloat(e.target.value) || 0 } : x
                  )
                )
              }
              className="w-full rounded-lg border border-stoneborder bg-surface px-1.5 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic/60 focus:outline-none"
            />

            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={15}
              value={s.reps || ''}
              onChange={(e) =>
                onChangeSets(
                  sets.map((x) =>
                    x.id === s.id ? { ...x, reps: parseInt(e.target.value, 10) || 0 } : x
                  )
                )
              }
              className="w-full rounded-lg border border-stoneborder bg-surface px-1 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic/60 focus:outline-none"
            />

            <select
              aria-label="RPE Esfuerzo Percibido"
              value={s.rpe}
              onChange={(e) =>
                onChangeSets(
                  sets.map((x) =>
                    x.id === s.id ? { ...x, rpe: parseFloat(e.target.value) } : x
                  )
                )
              }
              className="w-full rounded-lg border border-stoneborder bg-surface px-1 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic/60 focus:outline-none"
            >
              {RPE_OPTIONS.map((r) => (
                <option key={r} value={r} className="bg-surface">
                  {r.toFixed(1)}
                </option>
              ))}
            </select>

            <div className="text-center font-mono text-xs tabular-nums text-brand-muted">
              {pct}%
            </div>

            <button
              type="button"
              aria-label="Completar serie de fuerza"
              onClick={() => {
                const next = !s.completed;
                onChangeSets(sets.map((x) => (x.id === s.id ? { ...x, completed: next } : x)));
                onToggleComplete(next, s.restSeconds || defaultRest);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 ${
                s.completed
                  ? 'border-gothic bg-gothic/25 text-brand'
                  : 'border-stoneborder bg-surface text-brand-muted'
              }`}
            >
              <Check className="h-4 w-4 stroke-[2.2]" />
            </button>
          </div>
        );
      })}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={addSet}
          className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 text-gothic" />
          Serie
        </button>
      </div>
    </div>
  );
}

function CalisthenicsDynamicRows({
  sets,
  defaultRest,
  onChangeSets,
  onToggleComplete,
}: {
  sets: CalisthenicsDynamicSet[];
  defaultRest: number;
  onChangeSets: (next: CalisthenicsDynamicSet[]) => void;
  onToggleComplete: (completed: boolean, restSec: number) => void;
}) {
  const addSet = () => {
    const last = sets[sets.length - 1];
    onChangeSets([
      ...sets,
      {
        id: uid('cd'),
        variation: last ? last.variation : 'Estricto',
        addedWeightKg: last ? last.addedWeightKg : 0,
        reps: last ? last.reps : 8,
        rir: last ? last.rir : '1',
        restSeconds: last ? last.restSeconds : defaultRest,
        completed: false,
      },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[22px_1.3fr_0.95fr_0.75fr_0.75fr_38px] gap-1.5 px-1 text-[10px] uppercase tracking-wider text-brand-muted">
        <span>#</span>
        <span>Variación</span>
        <span className="text-center">+Kg</span>
        <span className="text-center">Reps</span>
        <span className="text-center">RIR</span>
        <span className="text-center">✓</span>
      </div>

      {sets.map((s, idx) => (
        <div
          key={s.id}
          className={`grid grid-cols-[22px_1.3fr_0.95fr_0.75fr_0.75fr_38px] items-center gap-1.5 rounded-xl border p-1.5 ${
            s.completed
              ? 'border-gothic/40 bg-gothic/10'
              : 'border-stoneborder bg-background/60'
          }`}
        >
          <button
            type="button"
            onClick={() => sets.length > 1 && onChangeSets(sets.filter((x) => x.id !== s.id))}
            className="text-xs text-brand-muted hover:text-status-regress"
          >
            {idx + 1}
          </button>

          <input
            type="text"
            value={s.variation}
            placeholder="Variación"
            onChange={(e) =>
              onChangeSets(
                sets.map((x) => (x.id === s.id ? { ...x, variation: e.target.value } : x))
              )
            }
            className="w-full rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-[16px] text-brand focus:border-gothic/60 focus:outline-none"
          />

          <input
            type="number"
            inputMode="decimal"
            step="1.25"
            value={s.addedWeightKg}
            onChange={(e) =>
              onChangeSets(
                sets.map((x) =>
                  x.id === s.id ? { ...x, addedWeightKg: parseFloat(e.target.value) || 0 } : x
                )
              )
            }
            className="w-full rounded-lg border border-stoneborder bg-surface px-1 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic/60 focus:outline-none"
          />

          <input
            type="number"
            inputMode="numeric"
            value={s.reps || ''}
            onChange={(e) =>
              onChangeSets(
                sets.map((x) =>
                  x.id === s.id ? { ...x, reps: parseInt(e.target.value, 10) || 0 } : x
                )
              )
            }
            className="w-full rounded-lg border border-stoneborder bg-surface px-1 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand focus:border-gothic/60 focus:outline-none"
          />

          <select
            aria-label="RIR"
            value={s.rir}
            onChange={(e) =>
              onChangeSets(
                sets.map((x) => (x.id === s.id ? { ...x, rir: e.target.value as RirValue } : x))
              )
            }
            className="w-full rounded-lg border border-stoneborder bg-surface px-1 py-1.5 text-center font-mono text-[16px] text-brand"
          >
            {RIR_OPTIONS.map((r) => (
              <option key={r} value={r} className="bg-surface">
                {r}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              const next = !s.completed;
              onChangeSets(sets.map((x) => (x.id === s.id ? { ...x, completed: next } : x)));
              onToggleComplete(next, s.restSeconds || defaultRest);
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 ${
              s.completed
                ? 'border-gothic bg-gothic/25 text-brand'
                : 'border-stoneborder bg-surface text-brand-muted'
            }`}
          >
            <Check className="h-4 w-4 stroke-[2.2]" />
          </button>
        </div>
      ))}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={addSet}
          className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 text-gothic" />
          Serie
        </button>
      </div>
    </div>
  );
}

function CalisthenicsIsometricRows({
  sets,
  defaultRest,
  onLaunchIsoTimer,
  onChangeSets,
  onToggleComplete,
}: {
  sets: CalisthenicsIsometricSet[];
  defaultRest: number;
  onLaunchIsoTimer: (set: CalisthenicsIsometricSet) => void;
  onChangeSets: (next: CalisthenicsIsometricSet[]) => void;
  onToggleComplete: (completed: boolean, restSec: number) => void;
}) {
  const addSet = () => {
    const last = sets[sets.length - 1];
    onChangeSets([
      ...sets,
      {
        id: uid('ci'),
        progression: last ? last.progression : 'Straddle',
        targetSeconds: last ? last.targetSeconds : 12,
        actualSeconds: last ? last.actualSeconds : 12,
        addedWeightKg: last ? last.addedWeightKg : 0,
        restSeconds: last ? last.restSeconds : defaultRest,
        completed: false,
      },
    ]);
  };

  return (
    <div className="space-y-2">
      {sets.map((s, idx) => (
        <div
          key={s.id}
          className={`rounded-xl border p-2.5 space-y-2 ${
            s.completed
              ? 'border-gothic/40 bg-gothic/10'
              : 'border-stoneborder bg-background/60'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <button
                type="button"
                onClick={() => sets.length > 1 && onChangeSets(sets.filter((x) => x.id !== s.id))}
                className="text-xs text-brand-muted hover:text-status-regress"
              >
                #{idx + 1}
              </button>
              <select
                aria-label="Progresión isométrica"
                value={s.progression}
                onChange={(e) =>
                  onChangeSets(
                    sets.map((x) =>
                      x.id === s.id
                        ? { ...x, progression: e.target.value as CalisthenicsProgression }
                        : x
                    )
                  )
                }
                className="flex-1 rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-[16px] text-brand focus:border-gothic/60 focus:outline-none"
              >
                {PROGRESSIONS.map((p) => (
                  <option key={p} value={p} className="bg-surface">
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => onLaunchIsoTimer(s)}
              className="inline-flex items-center gap-1 rounded-xl border border-gothic/40 bg-gothic/15 px-2.5 py-1.5 text-xs font-medium text-brand active:scale-95"
            >
              <Timer className="h-3.5 w-3.5 text-gothic" />
              {s.targetSeconds}s
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !s.completed;
                onChangeSets(sets.map((x) => (x.id === s.id ? { ...x, completed: next } : x)));
                onToggleComplete(next, s.restSeconds || defaultRest);
              }}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-90 ${
                s.completed
                  ? 'border-gothic bg-gothic/25 text-brand'
                  : 'border-stoneborder bg-surface text-brand-muted'
              }`}
            >
              <Check className="h-4 w-4 stroke-[2.2]" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-brand-muted mb-0.5">Meta (s)</label>
              <input
                type="number"
                inputMode="numeric"
                value={s.targetSeconds || ''}
                onChange={(e) =>
                  onChangeSets(
                    sets.map((x) =>
                      x.id === s.id
                        ? { ...x, targetSeconds: parseInt(e.target.value, 10) || 0 }
                        : x
                    )
                  )
                }
                className="w-full rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gothic mb-0.5">Logrado (s)</label>
              <input
                type="number"
                inputMode="numeric"
                value={s.actualSeconds || ''}
                onChange={(e) =>
                  onChangeSets(
                    sets.map((x) =>
                      x.id === s.id
                        ? { ...x, actualSeconds: parseInt(e.target.value, 10) || 0 }
                        : x
                    )
                  )
                }
                className="w-full rounded-lg border border-gothic/40 bg-surface px-2 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
              />
            </div>

            <div>
              <label className="block text-[10px] text-brand-muted mb-0.5">Lastre (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                step="1.25"
                value={s.addedWeightKg}
                onChange={(e) =>
                  onChangeSets(
                    sets.map((x) =>
                      x.id === s.id
                        ? { ...x, addedWeightKg: parseFloat(e.target.value) || 0 }
                        : x
                    )
                  )
                }
                className="w-full rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={addSet}
          className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 text-gothic" />
          Sostén
        </button>
      </div>
    </div>
  );
}

function HyroxRows({
  sets,
  defaultRest,
  onChangeSets,
  onToggleComplete,
}: {
  sets: HyroxSet[];
  defaultRest: number;
  onChangeSets: (next: HyroxSet[]) => void;
  onToggleComplete: (completed: boolean, restSec: number) => void;
}) {
  const addStationRow = (presetStation?: HyroxStationName) => {
    const last = sets[sets.length - 1];
    const station = presetStation ?? (last?.station === '1000m Run' ? 'SkiErg' : '1000m Run');
    const isWallBalls = station === 'Wall Balls';
    const defaultDist =
      station === '1000m Run' || station === 'SkiErg' || station === 'Rowing'
        ? 1000
        : station === 'Farmers Carry'
          ? 200
          : station === 'Sandbag Lunges'
            ? 100
            : station === 'Burpee Broad Jumps'
              ? 80
              : isWallBalls
                ? 0
                : 50;

    onChangeSets([
      ...sets,
      {
        id: uid('hx'),
        station,
        distanceMeters: defaultDist,
        reps: isWallBalls ? 100 : 0,
        implementWeightKg:
          station === 'Sled Push'
            ? 152
            : station === 'Sled Pull'
              ? 103
              : station === 'Farmers Carry'
                ? 48
                : station === 'Sandbag Lunges'
                  ? 20
                  : isWallBalls
                    ? 6
                    : 0,
        splitSeconds: 240,
        roxzoneSeconds: 25,
        completed: false,
      },
    ]);
  };

  return (
    <div className="space-y-2.5">
      {sets.map((s, idx) => {
        const isRepStation = s.station === 'Wall Balls';
        return (
          <div
            key={s.id}
            className={`rounded-xl border p-2.5 space-y-2 ${
              s.completed
                ? 'border-gothic/40 bg-gothic/10'
                : 'border-stoneborder bg-background/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => sets.length > 1 && onChangeSets(sets.filter((x) => x.id !== s.id))}
                  className="text-xs text-brand-muted hover:text-status-regress"
                >
                  #{idx + 1}
                </button>
                <select
                  aria-label="Estación Oficial Hyrox"
                  value={s.station}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id
                          ? { ...x, station: e.target.value as HyroxStationName }
                          : x
                      )
                    )
                  }
                  className="flex-1 truncate rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-[16px] text-brand focus:border-gothic/60 focus:outline-none"
                >
                  {HYROX_STATIONS.map((st) => (
                    <option key={st} value={st} className="bg-surface">
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <InlineSplitStopwatch
                currentSeconds={s.splitSeconds}
                onStopWithSeconds={(elapsed) =>
                  onChangeSets(
                    sets.map((x) => (x.id === s.id ? { ...x, splitSeconds: elapsed } : x))
                  )
                }
              />

              <button
                type="button"
                onClick={() => {
                  const next = !s.completed;
                  onChangeSets(sets.map((x) => (x.id === s.id ? { ...x, completed: next } : x)));
                  onToggleComplete(next, defaultRest);
                }}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-90 ${
                  s.completed
                    ? 'border-gothic bg-gothic/25 text-brand'
                    : 'border-stoneborder bg-surface text-brand-muted'
                }`}
              >
                <Check className="h-4 w-4 stroke-[2.2]" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">
                  {isRepStation ? 'Reps' : 'Metros'}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={isRepStation ? s.reps || '' : s.distanceMeters || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id
                          ? isRepStation
                            ? { ...x, reps: val, distanceMeters: 0 }
                            : { ...x, distanceMeters: val }
                          : x
                      )
                    );
                  }}
                  className="w-full rounded-lg border border-stoneborder bg-surface px-1.5 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Kg</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={s.implementWeightKg}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id
                          ? { ...x, implementWeightKg: parseFloat(e.target.value) || 0 }
                          : x
                      )
                    )
                  }
                  className="w-full rounded-lg border border-stoneborder bg-surface px-1.5 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gothic mb-0.5">Split</label>
                <TimeMmSsInput
                  seconds={s.splitSeconds}
                  ariaLabel="Tiempo del Split mm:ss"
                  onChangeSeconds={(sec) =>
                    onChangeSets(
                      sets.map((x) => (x.id === s.id ? { ...x, splitSeconds: sec } : x))
                    )
                  }
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Roxzone</label>
                <TimeMmSsInput
                  seconds={s.roxzoneSeconds}
                  ariaLabel="Tiempo de Transición Roxzone mm:ss"
                  onChangeSeconds={(sec) =>
                    onChangeSets(
                      sets.map((x) => (x.id === s.id ? { ...x, roxzoneSeconds: sec } : x))
                    )
                  }
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => addStationRow('1000m Run')}
          className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-xs font-medium text-brand-muted hover:text-brand active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 text-gothic" />
          Carrera
        </button>
        <button
          type="button"
          onClick={() => addStationRow('Sled Push')}
          className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-xs font-medium text-brand-muted hover:text-brand active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 text-gothic" />
          Estación
        </button>
      </div>
    </div>
  );
}

function JumpRopeRows({
  sets,
  defaultRest,
  onChangeSets,
  onToggleComplete,
}: {
  sets: JumpRopeSet[];
  defaultRest: number;
  onChangeSets: (next: JumpRopeSet[]) => void;
  onToggleComplete: (completed: boolean, restSec: number) => void;
}) {
  const addRound = () => {
    const last = sets[sets.length - 1];
    onChangeSets([
      ...sets,
      {
        id: uid('jr'),
        jumps: last ? last.jumps : 150,
        durationSeconds: last ? last.durationSeconds : 60,
        style: last ? last.style : 'Boxer Step',
        misses: 0,
        restSeconds: last ? last.restSeconds : defaultRest,
        completed: false,
      },
    ]);
  };

  return (
    <div className="space-y-2.5">
      {sets.map((s, idx) => {
        const rpm = calculateJumpRopeRpm(s.jumps, s.durationSeconds);
        return (
          <div
            key={s.id}
            className={`rounded-xl border p-2.5 space-y-2 ${
              s.completed
                ? 'border-gothic/40 bg-gothic/10'
                : 'border-stoneborder bg-background/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => sets.length > 1 && onChangeSets(sets.filter((x) => x.id !== s.id))}
                  className="text-xs text-brand-muted hover:text-status-regress"
                >
                  R{idx + 1}
                </button>
                <select
                  aria-label="Estilo de salto de cuerda"
                  value={s.style}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id ? { ...x, style: e.target.value as JumpRopeStyle } : x
                      )
                    )
                  }
                  className="flex-1 rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-[16px] text-brand"
                >
                  {JUMPROPE_STYLES.map((st) => (
                    <option key={st} value={st} className="bg-surface">
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <span className="font-mono text-xs tabular-nums text-brand-muted">{rpm} RPM</span>

              <button
                type="button"
                onClick={() => {
                  const next = !s.completed;
                  onChangeSets(sets.map((x) => (x.id === s.id ? { ...x, completed: next } : x)));
                  onToggleComplete(next, s.restSeconds || defaultRest);
                }}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-90 ${
                  s.completed
                    ? 'border-gothic bg-gothic/25 text-brand'
                    : 'border-stoneborder bg-surface text-brand-muted'
                }`}
              >
                <Check className="h-4 w-4 stroke-[2.2]" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Saltos</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.jumps || ''}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id ? { ...x, jumps: parseInt(e.target.value, 10) || 0 } : x
                      )
                    )
                  }
                  className="w-full rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Tiempo</label>
                <TimeMmSsInput
                  seconds={s.durationSeconds}
                  ariaLabel="Duración de ronda de cuerda"
                  onChangeSeconds={(sec) =>
                    onChangeSets(
                      sets.map((x) => (x.id === s.id ? { ...x, durationSeconds: sec } : x))
                    )
                  }
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Fallos</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.misses}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id ? { ...x, misses: parseInt(e.target.value, 10) || 0 } : x
                      )
                    )
                  }
                  className="w-full rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {[50, 100, 250].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() =>
                    onChangeSets(
                      sets.map((x) => (x.id === s.id ? { ...x, jumps: x.jumps + inc } : x))
                    )
                  }
                  className="flex-1 rounded-lg border border-stoneborder bg-surface py-1 font-mono text-xs text-brand-muted hover:text-brand active:scale-95"
                >
                  +{inc}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={addRound}
          className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 text-gothic" />
          Ronda
        </button>
      </div>
    </div>
  );
}

function RunningRows({
  sets,
  defaultRest,
  onChangeSets,
  onToggleComplete,
}: {
  sets: RunningSet[];
  defaultRest: number;
  onChangeSets: (next: RunningSet[]) => void;
  onToggleComplete: (completed: boolean, restSec: number) => void;
}) {
  const addRunSet = () => {
    const last = sets[sets.length - 1];
    onChangeSets([
      ...sets,
      {
        id: uid('rn'),
        distanceMeters: last ? last.distanceMeters : 1000,
        durationSeconds: last ? last.durationSeconds : 255,
        inclinePercent: last ? last.inclinePercent : 0,
        runType: last ? last.runType : 'Zona 2 Continua',
        restSeconds: last ? last.restSeconds : defaultRest,
        completed: false,
      },
    ]);
  };

  return (
    <div className="space-y-2.5">
      {sets.map((s, idx) => {
        const paceSecKm = calculateRunningPaceSecPerKm(s.distanceMeters, s.durationSeconds);
        return (
          <div
            key={s.id}
            className={`rounded-xl border p-2.5 space-y-2 ${
              s.completed
                ? 'border-gothic/40 bg-gothic/10'
                : 'border-stoneborder bg-background/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => sets.length > 1 && onChangeSets(sets.filter((x) => x.id !== s.id))}
                  className="text-xs text-brand-muted hover:text-status-regress"
                >
                  #{idx + 1}
                </button>
                <select
                  aria-label="Tipo de carrera"
                  value={s.runType}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id ? { ...x, runType: e.target.value as RunningType } : x
                      )
                    )
                  }
                  className="flex-1 rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-[16px] text-brand"
                >
                  {RUNNING_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-surface">
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <span className="font-mono text-xs tabular-nums text-brand-muted">
                {paceSecKm > 0 ? `${formatMmSs(paceSecKm)}/km` : '--:--'}
              </span>

              <button
                type="button"
                onClick={() => {
                  const next = !s.completed;
                  onChangeSets(sets.map((x) => (x.id === s.id ? { ...x, completed: next } : x)));
                  onToggleComplete(next, s.restSeconds || defaultRest);
                }}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-90 ${
                  s.completed
                    ? 'border-gothic bg-gothic/25 text-brand'
                    : 'border-stoneborder bg-surface text-brand-muted'
                }`}
              >
                <Check className="h-4 w-4 stroke-[2.2]" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Metros</label>
                <input
                  type="number"
                  inputMode="numeric"
                  step="100"
                  value={s.distanceMeters || ''}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id
                          ? { ...x, distanceMeters: parseInt(e.target.value, 10) || 0 }
                          : x
                      )
                    )
                  }
                  className="w-full rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Tiempo</label>
                <TimeMmSsInput
                  seconds={s.durationSeconds}
                  ariaLabel="Tiempo de carrera mm:ss"
                  onChangeSeconds={(sec) =>
                    onChangeSets(
                      sets.map((x) => (x.id === s.id ? { ...x, durationSeconds: sec } : x))
                    )
                  }
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Inclinación %</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={s.inclinePercent}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id
                          ? { ...x, inclinePercent: parseFloat(e.target.value) || 0 }
                          : x
                      )
                    )
                  }
                  className="w-full rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={addRunSet}
          className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 text-gothic" />
          Tramo
        </button>
      </div>
    </div>
  );
}

function SwimmingRows({
  sets,
  defaultRest,
  onChangeSets,
  onToggleComplete,
}: {
  sets: SwimmingSet[];
  defaultRest: number;
  onChangeSets: (next: SwimmingSet[]) => void;
  onToggleComplete: (completed: boolean, restSec: number) => void;
}) {
  const addSwimSet = () => {
    const last = sets[sets.length - 1];
    onChangeSets([
      ...sets,
      {
        id: uid('sw'),
        poolLengthMeters: last ? last.poolLengthMeters : 25,
        laps: last ? last.laps : 4,
        stroke: last ? last.stroke : 'Crol/Libre',
        durationSeconds: last ? last.durationSeconds : 100,
        restSeconds: last ? last.restSeconds : defaultRest,
        completed: false,
      },
    ]);
  };

  return (
    <div className="space-y-2.5">
      {sets.map((s, idx) => {
        const totalMeters = s.poolLengthMeters * s.laps;
        const pace100 = calculateSwimPaceSecPer100m(totalMeters, s.durationSeconds);
        return (
          <div
            key={s.id}
            className={`rounded-xl border p-2.5 space-y-2 ${
              s.completed
                ? 'border-gothic/40 bg-gothic/10'
                : 'border-stoneborder bg-background/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => sets.length > 1 && onChangeSets(sets.filter((x) => x.id !== s.id))}
                  className="text-xs text-brand-muted hover:text-status-regress"
                >
                  #{idx + 1}
                </button>
                <select
                  aria-label="Estilo de natación"
                  value={s.stroke}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id ? { ...x, stroke: e.target.value as SwimmingStroke } : x
                      )
                    )
                  }
                  className="flex-1 rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-[16px] text-brand"
                >
                  {SWIM_STROKES.map((st) => (
                    <option key={st} value={st} className="bg-surface">
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <span className="font-mono text-xs tabular-nums text-brand-muted">
                {pace100 > 0 ? `${formatMmSs(pace100)}/100m` : `${totalMeters}m`}
              </span>

              <button
                type="button"
                onClick={() => {
                  const next = !s.completed;
                  onChangeSets(sets.map((x) => (x.id === s.id ? { ...x, completed: next } : x)));
                  onToggleComplete(next, s.restSeconds || defaultRest);
                }}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-90 ${
                  s.completed
                    ? 'border-gothic bg-gothic/25 text-brand'
                    : 'border-stoneborder bg-surface text-brand-muted'
                }`}
              >
                <Check className="h-4 w-4 stroke-[2.2]" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Piscina</label>
                <select
                  aria-label="Largo de piscina"
                  value={s.poolLengthMeters}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id
                          ? { ...x, poolLengthMeters: Number(e.target.value) as 25 | 50 }
                          : x
                      )
                    )
                  }
                  className="w-full rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-center font-mono text-[16px] text-brand"
                >
                  <option value={25} className="bg-surface">
                    25m
                  </option>
                  <option value={50} className="bg-surface">
                    50m
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Largos</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.laps || ''}
                  onChange={(e) =>
                    onChangeSets(
                      sets.map((x) =>
                        x.id === s.id ? { ...x, laps: parseInt(e.target.value, 10) || 0 } : x
                      )
                    )
                  }
                  className="w-full rounded-lg border border-stoneborder bg-surface px-2 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
                />
              </div>

              <div>
                <label className="block text-[10px] text-brand-muted mb-0.5">Tiempo</label>
                <TimeMmSsInput
                  seconds={s.durationSeconds}
                  ariaLabel="Tiempo de serie de natación"
                  onChangeSeconds={(sec) =>
                    onChangeSets(
                      sets.map((x) => (x.id === s.id ? { ...x, durationSeconds: sec } : x))
                    )
                  }
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={addSwimSet}
          className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 text-gothic" />
          Serie
        </button>
      </div>
    </div>
  );
}

function CyclingRows({
  sets,
  defaultRest,
  onChangeSets,
  onToggleComplete,
}: {
  sets: CyclingSet[];
  defaultRest: number;
  onChangeSets: (next: CyclingSet[]) => void;
  onToggleComplete: (completed: boolean, restSec: number) => void;
}) {
  const addCycSet = () => {
    const last = sets[sets.length - 1];
    onChangeSets([
      ...sets,
      {
        id: uid('cy'),
        durationSeconds: last ? last.durationSeconds : 300,
        distanceMeters: last ? last.distanceMeters : 2500,
        avgWatts: last ? last.avgWatts : 240,
        cadenceRpm: last ? last.cadenceRpm : 90,
        restSeconds: last ? last.restSeconds : defaultRest,
        completed: false,
      },
    ]);
  };

  return (
    <div className="space-y-2.5">
      {sets.map((s, idx) => (
        <div
          key={s.id}
          className={`rounded-xl border p-2.5 space-y-2 ${
            s.completed
              ? 'border-gothic/40 bg-gothic/10'
              : 'border-stoneborder bg-background/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => sets.length > 1 && onChangeSets(sets.filter((x) => x.id !== s.id))}
              className="text-xs text-brand-muted hover:text-status-regress"
            >
              Intervalo #{idx + 1}
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !s.completed;
                onChangeSets(sets.map((x) => (x.id === s.id ? { ...x, completed: next } : x)));
                onToggleComplete(next, s.restSeconds || defaultRest);
              }}
              className={`flex h-8 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 ${
                s.completed
                  ? 'border-gothic bg-gothic/25 text-brand'
                  : 'border-stoneborder bg-surface text-brand-muted'
              }`}
            >
              <Check className="h-4 w-4 stroke-[2.2]" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <div>
              <label className="block text-[10px] text-brand-muted mb-0.5">Tiempo</label>
              <TimeMmSsInput
                seconds={s.durationSeconds}
                ariaLabel="Duración ergómetro"
                onChangeSeconds={(sec) =>
                  onChangeSets(
                    sets.map((x) => (x.id === s.id ? { ...x, durationSeconds: sec } : x))
                  )
                }
              />
            </div>

            <div>
              <label className="block text-[10px] text-brand-muted mb-0.5">Metros</label>
              <input
                type="number"
                inputMode="numeric"
                value={s.distanceMeters || ''}
                onChange={(e) =>
                  onChangeSets(
                    sets.map((x) =>
                      x.id === s.id
                        ? { ...x, distanceMeters: parseInt(e.target.value, 10) || 0 }
                        : x
                    )
                  )
                }
                className="w-full rounded-lg border border-stoneborder bg-surface px-1.5 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gothic mb-0.5">Watts</label>
              <input
                type="number"
                inputMode="numeric"
                value={s.avgWatts || ''}
                onChange={(e) =>
                  onChangeSets(
                    sets.map((x) =>
                      x.id === s.id ? { ...x, avgWatts: parseInt(e.target.value, 10) || 0 } : x
                    )
                  )
                }
                className="w-full rounded-lg border border-stoneborder bg-surface px-1.5 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
              />
            </div>

            <div>
              <label className="block text-[10px] text-brand-muted mb-0.5">RPM</label>
              <input
                type="number"
                inputMode="numeric"
                value={s.cadenceRpm || ''}
                onChange={(e) =>
                  onChangeSets(
                    sets.map((x) =>
                      x.id === s.id ? { ...x, cadenceRpm: parseInt(e.target.value, 10) || 0 } : x
                    )
                  )
                }
                className="w-full rounded-lg border border-stoneborder bg-surface px-1.5 py-1.5 text-center font-mono text-[16px] tabular-nums text-brand"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={addCycSet}
          className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 text-gothic" />
          Intervalo
        </button>
      </div>
    </div>
  );
}
