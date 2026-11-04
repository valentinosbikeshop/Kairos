'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTimerEngine } from '@/components/TimerEngine';
import { SoundSettingsButton } from '@/components/AudioMixerPanel';
import { getDailyMotivationalQuote } from '@/lib/knowledgeBase';
import { formatMmSs, formatTimerMs } from '@/lib/formatters';
import { TimerKind } from '@/types/kairos';
import { HeartRateMonitorWidget } from '@/components/HeartRateMonitorWidget';
import {
  AlertTriangle,
  Check,
  FastForward,
  Flame,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Sliders,
  Square,
  Timer,
  X,
  XCircle,
} from 'lucide-react';

interface IntervalPresetItem {
  id: string;
  name: string;
  prep: number;
  work: number;
  rest: number;
  rnd: number;
}

const DEFAULT_INTERVAL_PRESETS: IntervalPresetItem[] = [
  { id: 'tabata', name: 'Tabata', prep: 5, work: 20, rest: 10, rnd: 8 },
  { id: 'emom', name: 'EMOM 45/15', prep: 5, work: 45, rest: 15, rnd: 10 },
  { id: 'cuerda', name: 'Cuerda', prep: 5, work: 90, rest: 30, rnd: 6 },
  { id: 'rounds3m', name: 'Rounds 3m', prep: 5, work: 180, rest: 60, rnd: 4 },
];

export function TimerProView() {
  const {
    snapshot,
    startRestTimer,
    startIntervalTimer,
    startIsometricTimer,
    togglePauseResume,
    adjustCurrentPhaseSeconds,
    skipCurrentPhase,
    stopTimer,
    cancelTimer,
    resetTimer,
    notificationPermission,
    requestNotificationPermission,
  } = useTimerEngine();

  const [labTab, setLabTab] = useState<TimerKind>('intervals');
  const [customRestSec, setCustomRestSec] = useState(90);

  // Intervals
  const [intervalPresets, setIntervalPresets] = useState<IntervalPresetItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('kairos_interval_presets_v1');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_INTERVAL_PRESETS;
  });

  const [editingPreset, setEditingPreset] = useState<IntervalPresetItem | null>(null);

  const [prepSec, setPrepSec] = useState(5);
  const [workSec, setWorkSec] = useState(45);
  const [intervalRestSec, setIntervalRestSec] = useState(15);
  const [rounds, setRounds] = useState(8);
  const [confirmCancelInterval, setConfirmCancelInterval] = useState(false);
  const [confirmCancelIsometric, setConfirmCancelIsometric] = useState(false);

  // Isometric
  const [isoPrepSec, setIsoPrepSec] = useState(5);
  const [isoHoldSec, setIsoHoldSec] = useState(15);

  const dailyQuote = useMemo(() => getDailyMotivationalQuote(), []);

  // Reset cancellation confirmation when timer stops or naturally completes
  useEffect(() => {
    if (!snapshot.isActive) {
      setConfirmCancelInterval(false);
      setConfirmCancelIsometric(false);
    }
  }, [snapshot.isActive]);

  const handleSaveEditedPreset = (updated: IntervalPresetItem) => {
    setIntervalPresets((prev) => {
      const next = prev.map((p) => (p.id === updated.id ? updated : p));
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('kairos_interval_presets_v1', JSON.stringify(next));
        } catch {}
      }
      return next;
    });
    setPrepSec(updated.prep);
    setWorkSec(updated.work);
    setIntervalRestSec(updated.rest);
    setRounds(updated.rnd);
    setEditingPreset(null);
  };

  const ringRadius = 110;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const activeFraction = snapshot.isActive ? snapshot.progressFraction : 1;
  const strokeDashoffset = ringCircumference * (1 - activeFraction);

  const ringStrokeHex = !snapshot.isActive
    ? '#27242E'
    : snapshot.phase === 'prep'
      ? '#8A7960'
      : snapshot.phase === 'finished'
        ? '#6F917C'
        : '#B5A082';

  const statusHeadline = !snapshot.isActive
    ? 'En calma'
    : snapshot.phase === 'prep'
      ? 'Prepárate'
      : snapshot.phase === 'work'
        ? snapshot.kind === 'isometric'
          ? 'Mantén posición'
          : 'Trabajo activo'
        : snapshot.phase === 'finished'
          ? 'Completado'
          : 'Recuperación';

  const handlePrimaryPlay = () => {
    if (snapshot.isActive) {
      togglePauseResume();
      return;
    }
    if (labTab === 'rest') {
      startRestTimer(customRestSec, `Descanso ${customRestSec}s`);
    } else if (labTab === 'intervals') {
      startIntervalTimer({
        prepSeconds: prepSec,
        workSeconds: workSec,
        restSeconds: intervalRestSec,
        rounds,
        label: `Intervalos ${workSec}s/${intervalRestSec}s`,
      });
    } else {
      startIsometricTimer({
        prepSeconds: isoPrepSec,
        holdSeconds: isoHoldSec,
        label: `Isometría ${isoHoldSec}s`,
      });
    }
  };

  const previewIdleMs =
    labTab === 'rest'
      ? customRestSec * 1000
      : labTab === 'intervals'
        ? workSec * 1000
        : isoHoldSec * 1000;

  return (
    <div className="px-5 ios-page-safe-pt pb-36 space-y-5">
      {/* Clean Header with Full Sound Settings Modal Trigger */}
      <div className="flex items-center justify-between">
        <h1 className="font-gothic text-xl font-semibold tracking-wide text-brand">
          Temporizador
        </h1>

        <SoundSettingsButton />
      </div>

      {/* Lock Screen Notification & Background Audio Permission Banner */}
      {notificationPermission === 'default' && (
        <button
          type="button"
          onClick={() => void requestNotificationPermission()}
          className="w-full flex items-center justify-between rounded-2xl border border-gothic/40 bg-gothic/10 px-3.5 py-2.5 text-xs text-brand hover:bg-gothic/15 transition-colors animate-fade-up"
        >
          <div className="flex items-center gap-2.5 text-left">
            <span className="text-base">🔔</span>
            <div>
              <p className="font-semibold text-gothic text-[11px]">
                Activar avisos en Pantalla de Bloqueo
              </p>
              <p className="text-[10px] text-brand-muted">
                Controla el timer y recibe avisos sonoros urgentes al bloquear la pantalla
              </p>
            </div>
          </div>
          <span className="rounded-lg bg-gothic px-2.5 py-1 text-[10px] font-bold text-background uppercase tracking-wider shrink-0">
            Activar
          </span>
        </button>
      )}

      {/* Mode Switcher */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-stoneborder bg-surface p-1">
        {(
          [
            { id: 'rest', label: 'Descanso', icon: Timer },
            { id: 'intervals', label: 'Intervalos', icon: Repeat },
            { id: 'isometric', label: 'Isometría', icon: Flame },
          ] as { id: TimerKind; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setLabTab(id)}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-colors ${
              labTab === id
                ? 'bg-elevated text-brand border border-stoneborder'
                : 'text-brand-muted hover:text-brand'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Serene Circular Clock */}
      <div className="rounded-3xl border border-stoneborder bg-surface p-5 flex flex-col items-center space-y-5">
        <div className="relative flex items-center justify-center">
          <svg className="h-56 w-56 -rotate-90 transform" viewBox="0 0 250 250">
            <circle
              cx="125"
              cy="125"
              r={ringRadius}
              fill="none"
              stroke="#1E1C23"
              strokeWidth="5"
            />
            <circle
              cx="125"
              cy="125"
              r={ringRadius}
              fill="none"
              stroke={ringStrokeHex}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset,stroke] duration-150"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <span className="font-gothic text-[11px] uppercase tracking-[0.18em] text-gothic">
              {statusHeadline}
            </span>

            <div className="mt-1.5 font-mono text-4xl font-semibold tabular-nums tracking-tight text-brand">
              {snapshot.isActive
                ? snapshot.phase === 'finished'
                  ? '00:00.0'
                  : formatTimerMs(snapshot.phaseRemainingMs, true)
                : formatTimerMs(previewIdleMs, false)}
            </div>

            {snapshot.isActive && snapshot.kind === 'intervals' && (
              <span className="mt-2 text-xs text-brand-muted tabular-nums">
                Ronda {snapshot.currentRound} de {snapshot.totalRounds}
              </span>
            )}
          </div>
        </div>

        {/* Transport Controls */}
        <div className="w-full grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => adjustCurrentPhaseSeconds(-15)}
            disabled={!snapshot.isActive}
            className="rounded-xl border border-stoneborder bg-background py-3 text-xs font-medium tabular-nums text-brand-muted disabled:opacity-35 active:scale-95"
          >
            -15s
          </button>

          <button
            type="button"
            onClick={handlePrimaryPlay}
            className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-xs font-bold uppercase tracking-widest text-background active:scale-[0.98]"
          >
            {snapshot.isActive && snapshot.isRunning ? (
              <>
                <Pause className="h-4 w-4 fill-current" />
                Pausar
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                {snapshot.isActive ? 'Reanudar' : 'Iniciar'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => adjustCurrentPhaseSeconds(15)}
            disabled={!snapshot.isActive}
            className="rounded-xl border border-stoneborder bg-background py-3 text-xs font-medium tabular-nums text-brand-muted disabled:opacity-35 active:scale-95"
          >
            +15s
          </button>
        </div>

        {snapshot.isActive && (
          <div className="w-full space-y-2">
            <div className="w-full grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={resetTimer}
                className="flex items-center justify-center gap-1 rounded-xl border border-stoneborder bg-background py-2.5 text-xs text-brand-muted active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reiniciar
              </button>
              <button
                type="button"
                onClick={skipCurrentPhase}
                className="flex items-center justify-center gap-1 rounded-xl border border-stoneborder bg-elevated py-2.5 text-xs text-brand active:scale-95"
              >
                <FastForward className="h-3.5 w-3.5" />
                Saltar
              </button>
              <button
                type="button"
                onClick={stopTimer}
                className="flex items-center justify-center gap-1 rounded-xl border border-stoneborder bg-background py-2.5 text-xs text-brand-muted hover:text-brand active:scale-95"
              >
                <Square className="h-3 w-3 fill-current text-gothic" />
                Guardar
              </button>
            </div>

            {/* Cancel Running Interval with Double Confirmation */}
            {snapshot.kind === 'intervals' && (
              <div className="pt-1">
                {confirmCancelInterval ? (
                  <div className="rounded-xl border border-status-regress/50 bg-status-regress/15 p-3 space-y-2 animate-fade-up">
                    <div className="flex items-center gap-2 text-status-regress">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-semibold text-brand">
                        ¿Seguro que deseas cancelar este intervalo?
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-muted leading-tight">
                      El temporizador se detendrá y este intervalo no se registrará en la sesión del día.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setConfirmCancelInterval(false)}
                        className="rounded-lg border border-stoneborder bg-background py-1.5 text-xs font-medium text-brand-muted hover:text-brand"
                      >
                        Continuar intervalo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          cancelTimer();
                          setConfirmCancelInterval(false);
                        }}
                        className="rounded-lg bg-status-regress py-1.5 text-xs font-bold text-white shadow active:scale-95"
                      >
                        Sí, cancelar ahora
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCancelInterval(true)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-status-regress/35 bg-status-regress/10 py-2.5 text-xs font-medium text-brand hover:border-status-regress/60 hover:bg-status-regress/15 active:scale-98 transition-colors"
                  >
                    <XCircle className="h-4 w-4 text-status-regress" />
                    <span>Cancelar intervalo en curso</span>
                  </button>
                )}
              </div>
            )}
            {/* Cancel Running Isometric with Double Confirmation */}
            {snapshot.kind === 'isometric' && (
              <div className="pt-1">
                {confirmCancelIsometric ? (
                  <div className="rounded-xl border border-status-regress/50 bg-status-regress/15 p-3 space-y-2 animate-fade-up">
                    <div className="flex items-center gap-2 text-status-regress">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-semibold text-brand">
                        ¿Seguro que deseas cancelar esta isometría?
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-muted leading-tight">
                      El temporizador se detendrá y esta isometría no se registrará en la sesión del día.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setConfirmCancelIsometric(false)}
                        className="rounded-lg border border-stoneborder bg-background py-1.5 text-xs font-medium text-brand-muted hover:text-brand"
                      >
                        Continuar isometría
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          cancelTimer();
                          setConfirmCancelIsometric(false);
                        }}
                        className="rounded-lg bg-status-regress py-1.5 text-xs font-bold text-white shadow active:scale-95"
                      >
                        Sí, cancelar ahora
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCancelIsometric(true)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-status-regress/35 bg-status-regress/10 py-2.5 text-xs font-medium text-brand hover:border-status-regress/60 hover:bg-status-regress/15 active:scale-98 transition-colors"
                  >
                    <XCircle className="h-4 w-4 text-status-regress" />
                    <span>Cancelar isometría en curso</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Simple Mode Presets */}
      {labTab === 'rest' && (
        <div className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '60s', sec: 60 },
              { label: '90s', sec: 90 },
              { label: '2 min', sec: 120 },
              { label: '2:30', sec: 150 },
              { label: '3 min', sec: 180 },
              { label: '4 min', sec: 240 },
            ].map((p) => (
              <button
                key={p.sec}
                type="button"
                onClick={() => {
                  setCustomRestSec(p.sec);
                  startRestTimer(p.sec, `Descanso ${p.label}`);
                }}
                className="rounded-xl border border-stoneborder bg-background py-2.5 text-xs font-medium tabular-nums text-brand hover:border-gothic/60 active:scale-95"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="number"
              inputMode="numeric"
              aria-label="Segundos personalizados"
              value={customRestSec || ''}
              onChange={(e) => setCustomRestSec(Math.max(5, parseInt(e.target.value, 10) || 0))}
              className="flex-1 rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] tabular-nums text-brand focus:border-gothic focus:outline-none"
            />
            <button
              type="button"
              onClick={() => startRestTimer(customRestSec, `Descanso ${customRestSec}s`)}
              className="rounded-xl border border-gothic/50 bg-gothic/15 px-4 py-2.5 text-xs font-semibold text-brand active:scale-95"
            >
              Iniciar {formatMmSs(customRestSec)}
            </button>
          </div>
        </div>
      )}

      {labTab === 'intervals' && (
        <div className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {intervalPresets.map((pr) => (
              <div key={pr.id} className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setPrepSec(pr.prep);
                    setWorkSec(pr.work);
                    setIntervalRestSec(pr.rest);
                    setRounds(pr.rnd);
                    startIntervalTimer({
                      prepSeconds: pr.prep,
                      workSeconds: pr.work,
                      restSeconds: pr.rest,
                      rounds: pr.rnd,
                      label: pr.name,
                    });
                  }}
                  className="w-full rounded-xl border border-stoneborder bg-background p-2.5 text-left hover:border-gothic/60 active:scale-95 transition-colors pr-7"
                >
                  <div className="text-xs font-semibold text-brand truncate">{pr.name}</div>
                  <div className="text-[11px] text-brand-muted tabular-nums">
                    {pr.work}s / {pr.rest}s × {pr.rnd}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPreset(pr);
                  }}
                  title="Editar y guardar como predeterminado"
                  aria-label={`Editar preset ${pr.name}`}
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg text-brand-subtle hover:text-brand hover:bg-surface border border-transparent hover:border-stoneborder transition-colors active:scale-95"
                >
                  <Sliders className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[11px] text-brand-muted mb-1 text-center">Prep (s)</label>
              <input
                type="number"
                inputMode="numeric"
                aria-label="Segundos de preparación"
                value={prepSec === 0 ? '' : prepSec}
                placeholder="0"
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setPrepSec(val === '' ? 0 : Math.max(0, Math.min(120, parseInt(val, 10) || 0)));
                }}
                className="w-full rounded-xl border border-stoneborder bg-background px-1 py-2 text-center text-[16px] tabular-nums text-brand focus:border-gothic focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-brand-muted mb-1 text-center">Trabajo (s)</label>
              <input
                type="number"
                inputMode="numeric"
                aria-label="Segundos de trabajo"
                value={workSec === 0 ? '' : workSec}
                placeholder="45"
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setWorkSec(val === '' ? 0 : Math.max(3, Math.min(600, parseInt(val, 10) || 3)));
                }}
                onBlur={() => {
                  if (!workSec || workSec < 3) setWorkSec(45);
                }}
                className="w-full rounded-xl border border-stoneborder bg-background px-1 py-2 text-center text-[16px] tabular-nums text-brand focus:border-gothic focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-brand-muted mb-1 text-center">Descanso (s)</label>
              <input
                type="number"
                inputMode="numeric"
                aria-label="Segundos de descanso"
                value={intervalRestSec === 0 ? '' : intervalRestSec}
                placeholder="15"
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setIntervalRestSec(val === '' ? 0 : Math.max(0, Math.min(600, parseInt(val, 10) || 0)));
                }}
                className="w-full rounded-xl border border-stoneborder bg-background px-1 py-2 text-center text-[16px] tabular-nums text-brand focus:border-gothic focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-brand-muted mb-1 text-center">Rondas</label>
              <input
                type="number"
                inputMode="numeric"
                aria-label="Número de rondas"
                value={rounds === 0 ? '' : rounds}
                placeholder="8"
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setRounds(val === '' ? 0 : Math.max(1, Math.min(50, parseInt(val, 10) || 1)));
                }}
                onBlur={() => {
                  if (!rounds || rounds < 1) setRounds(8);
                }}
                className="w-full rounded-xl border border-stoneborder bg-background px-1 py-2 text-center text-[16px] tabular-nums text-brand focus:border-gothic focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-0.5 text-brand-muted">
            <span>Preparación rápida:</span>
            <div className="flex items-center gap-1.5">
              {[0, 3, 5, 10, 15].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrepSec(s)}
                  className={`rounded-lg border px-2 py-0.5 tabular-nums transition-colors ${
                    prepSec === s
                      ? 'border-gothic/60 bg-gothic/20 text-brand font-medium'
                      : 'border-stoneborder bg-background text-brand-muted hover:text-brand'
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {labTab === 'isometric' && (
        <div className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-brand-muted mb-1">Preparación (s)</label>
              <input
                type="number"
                inputMode="numeric"
                value={isoPrepSec}
                onChange={(e) => setIsoPrepSec(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-center text-[16px] tabular-nums text-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] text-brand-muted mb-1">Sostén (s)</label>
              <input
                type="number"
                inputMode="numeric"
                value={isoHoldSec}
                onChange={(e) => setIsoHoldSec(Math.max(3, parseInt(e.target.value, 10) || 3))}
                className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-center text-[16px] tabular-nums text-brand"
              />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {[10, 15, 20, 30, 45].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  setIsoHoldSec(sec);
                  startIsometricTimer({
                    prepSeconds: isoPrepSec,
                    holdSeconds: sec,
                    label: `Isometría ${sec}s`,
                  });
                }}
                className="rounded-xl border border-stoneborder bg-background py-2 text-xs tabular-nums text-brand hover:border-gothic/60 active:scale-95"
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ================= TELEMETRÍA CARDÍACA EN VIVO & GASTO CALÓRICO ================= */}
      <HeartRateMonitorWidget />

      {/* ================= FRASE MOTIVADORA DEL DÍA ================= */}
      <div className="rounded-2xl border border-stoneborder bg-surface px-5 py-5 text-center space-y-2.5">
        <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.25em] text-gothic">
          <span>❖</span>
          <span className="font-gothic">Frase del Día</span>
          <span>❖</span>
        </div>
        <p className="font-gothic text-sm text-brand leading-relaxed">
          {dailyQuote.text}
        </p>
      </div>

      {editingPreset && (
        <EditIntervalPresetModal
          preset={editingPreset}
          onClose={() => setEditingPreset(null)}
          onSave={handleSaveEditedPreset}
        />
      )}
    </div>
  );
}

function EditIntervalPresetModal({
  preset,
  onClose,
  onSave,
}: {
  preset: IntervalPresetItem;
  onClose: () => void;
  onSave: (updated: IntervalPresetItem) => void;
}) {
  const [name, setName] = useState(preset.name);
  const [prep, setPrep] = useState(preset.prep);
  const [work, setWork] = useState(preset.work);
  const [rest, setRest] = useState(preset.rest);
  const [rnd, setRnd] = useState(preset.rnd);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl border border-stoneborder bg-surface p-5 space-y-4 animate-fade-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gothic">
            <Sliders className="h-4 w-4" />
            <h3 className="font-gothic text-sm font-semibold text-brand">
              Editar Bloque Predeterminado
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stoneborder bg-background p-1.5 text-brand-muted hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-brand-muted mb-1">Nombre del bloque</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] text-brand focus:border-gothic focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[11px] text-brand-muted mb-1 text-center">Prep (s)</label>
              <input
                type="number"
                inputMode="numeric"
                value={prep}
                onChange={(e) =>
                  setPrep(Math.max(0, Math.min(120, parseInt(e.target.value, 10) || 0)))
                }
                className="w-full rounded-xl border border-stoneborder bg-background px-1 py-2 text-center text-[16px] tabular-nums text-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] text-brand-muted mb-1 text-center">Trabajo (s)</label>
              <input
                type="number"
                inputMode="numeric"
                value={work}
                onChange={(e) =>
                  setWork(Math.max(3, Math.min(600, parseInt(e.target.value, 10) || 3)))
                }
                className="w-full rounded-xl border border-stoneborder bg-background px-1 py-2 text-center text-[16px] tabular-nums text-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] text-brand-muted mb-1 text-center">Descanso (s)</label>
              <input
                type="number"
                inputMode="numeric"
                value={rest}
                onChange={(e) =>
                  setRest(Math.max(0, Math.min(600, parseInt(e.target.value, 10) || 0)))
                }
                className="w-full rounded-xl border border-stoneborder bg-background px-1 py-2 text-center text-[16px] tabular-nums text-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] text-brand-muted mb-1 text-center">Rondas</label>
              <input
                type="number"
                inputMode="numeric"
                value={rnd}
                onChange={(e) =>
                  setRnd(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))
                }
                className="w-full rounded-xl border border-stoneborder bg-background px-1 py-2 text-center text-[16px] tabular-nums text-brand"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            onSave({
              ...preset,
              name: name.trim() || preset.name,
              prep,
              work,
              rest,
              rnd,
            })
          }
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-xs font-bold uppercase tracking-wider text-background active:scale-[0.99]"
        >
          <Check className="h-4 w-4" />
          Guardar como Predeterminado
        </button>
      </div>
    </div>
  );
}
