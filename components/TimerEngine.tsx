'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActiveTimerConfig,
  IntervalPhase,
  TimerConclusionEvent,
  TimerKind,
} from '@/types/kairos';
import { kairosAudio } from '@/lib/audioEngine';
import { formatTimerMs } from '@/lib/formatters';
import {
  startBackgroundWorkerClock,
  stopBackgroundWorkerClock,
  startSilentBackgroundAudio,
  stopSilentBackgroundAudio,
  playLockScreenAlarmAudio,
  updateLockScreenMediaSession,
  clearLockScreenMediaSession,
  emitLockScreenTimerNotification,
  clearLockScreenTimerNotification,
  requestLockNotificationPermission,
  getNotificationPermissionStatus,
  LockNotificationStatus,
} from '@/lib/lockScreenTimerManager';
import {
  ChevronDown,
  ChevronUp,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  Square,
  Timer,
  XCircle,
} from 'lucide-react';

interface TimelineSegment {
  phase: Exclude<IntervalPhase, 'finished'>;
  round: number;
  durationMs: number;
}

export interface TimerRuntimeSnapshot {
  isActive: boolean;
  isRunning: boolean;
  kind: TimerKind;
  label: string;
  phase: IntervalPhase;
  currentRound: number;
  totalRounds: number;
  phaseRemainingMs: number;
  phaseDurationMs: number;
  phaseElapsedMs: number;
  progressFraction: number;
  wakeLockActive: boolean;
  lastAutoSavedNotice: string | null;
  linkedIsometricTarget?: ActiveTimerConfig['linkedIsometricTarget'];
}

interface TimerContextValue {
  snapshot: TimerRuntimeSnapshot;
  isDrawerExpanded: boolean;
  setDrawerExpanded: (expanded: boolean) => void;
  startRestTimer: (seconds: number, label?: string) => void;
  startIsometricTimer: (params: {
    prepSeconds: number;
    holdSeconds: number;
    label?: string;
    linkedTarget?: ActiveTimerConfig['linkedIsometricTarget'];
  }) => void;
  startIntervalTimer: (params: {
    prepSeconds: number;
    workSeconds: number;
    restSeconds: number;
    rounds: number;
    label?: string;
  }) => void;
  togglePauseResume: () => void;
  adjustCurrentPhaseSeconds: (deltaSeconds: number) => void;
  skipCurrentPhase: () => void;
  stopTimer: () => void;
  cancelTimer: () => void;
  resetTimer: () => void;
  registerTimerConclusionHandler: (fn: (event: TimerConclusionEvent) => void) => void;
  notificationPermission: LockNotificationStatus;
  requestNotificationPermission: () => Promise<boolean>;
}

const DEFAULT_SNAPSHOT: TimerRuntimeSnapshot = {
  isActive: false,
  isRunning: false,
  kind: 'rest',
  label: 'Descanso',
  phase: 'rest',
  currentRound: 1,
  totalRounds: 1,
  phaseRemainingMs: 0,
  phaseDurationMs: 90000,
  phaseElapsedMs: 0,
  progressFraction: 0,
  wakeLockActive: false,
  lastAutoSavedNotice: null,
};

const TimerContext = createContext<TimerContextValue | null>(null);

function buildTimeline(cfg: ActiveTimerConfig): TimelineSegment[] {
  if (cfg.kind === 'rest') {
    return [
      {
        phase: 'rest',
        round: 1,
        durationMs: Math.max(1000, cfg.totalDurationMs),
      },
    ];
  }

  if (cfg.kind === 'isometric') {
    const segs: TimelineSegment[] = [];
    if (cfg.prepSeconds > 0) {
      segs.push({ phase: 'prep', round: 1, durationMs: cfg.prepSeconds * 1000 });
    }
    segs.push({
      phase: 'work',
      round: 1,
      durationMs: Math.max(1000, cfg.holdSeconds * 1000),
    });
    return segs;
  }

  const segs: TimelineSegment[] = [];
  if (cfg.prepSeconds > 0) {
    segs.push({ phase: 'prep', round: 1, durationMs: cfg.prepSeconds * 1000 });
  }
  const rounds = Math.max(1, cfg.totalRounds);
  for (let r = 1; r <= rounds; r++) {
    segs.push({
      phase: 'work',
      round: r,
      durationMs: Math.max(1000, cfg.workSeconds * 1000),
    });
    if (cfg.restSeconds > 0 && r < rounds) {
      segs.push({
        phase: 'rest',
        round: r,
        durationMs: cfg.restSeconds * 1000,
      });
    }
  }
  return segs;
}

function summarizeElapsedTimeline(
  segments: TimelineSegment[],
  totalElapsedMs: number
): {
  plannedSeconds: number;
  elapsedSeconds: number;
  workSecondsCompleted: number;
  roundsCompleted: number;
} {
  const totalPlannedMs = segments.reduce((acc, s) => acc + s.durationMs, 0);
  const clampedElapsedMs = Math.min(totalPlannedMs, Math.max(0, totalElapsedMs));

  let remainingToAccount = clampedElapsedMs;
  let workMs = 0;
  let maxWorkRoundReached = 0;

  for (const seg of segments) {
    if (remainingToAccount <= 0) break;
    const spentInSeg = Math.min(seg.durationMs, remainingToAccount);
    if (seg.phase === 'work' && spentInSeg >= 500) {
      workMs += spentInSeg;
      maxWorkRoundReached = Math.max(maxWorkRoundReached, seg.round);
    }
    remainingToAccount -= spentInSeg;
  }

  return {
    plannedSeconds: Math.max(1, Math.round(totalPlannedMs / 1000)),
    elapsedSeconds: Math.max(1, Math.round(clampedElapsedMs / 1000)),
    workSecondsCompleted: Math.round(workMs / 1000),
    roundsCompleted: Math.max(1, maxWorkRoundReached || 1),
  };
}

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

export function TimerEngineProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<TimerRuntimeSnapshot>(DEFAULT_SNAPSHOT);
  const [isDrawerExpanded, setDrawerExpanded] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [lastAutoSavedNotice, setLastAutoSavedNotice] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<LockNotificationStatus>(() =>
    getNotificationPermissionStatus()
  );

  const handleRequestPermission = useCallback(async () => {
    const granted = await requestLockNotificationPermission();
    setNotificationPermission(getNotificationPermissionStatus());
    return granted;
  }, []);

  const lastReportedSecRef = useRef<number>(-1);
  const actionsRef = useRef<{
    togglePlay: () => void;
    skip: () => void;
    addSec: (delta: number) => void;
  }>({
    togglePlay: () => undefined,
    skip: () => undefined,
    addSec: () => undefined,
  });

  const configRef = useRef<ActiveTimerConfig | null>(null);
  const segmentsRef = useRef<TimelineSegment[]>([]);
  const sequenceStartMsRef = useRef<number>(0);
  const pausedElapsedMsRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(false);
  const hasConcludedCurrentRunRef = useRef<boolean>(false);

  const lastSegmentIdxRef = useRef<number>(0);
  const firedPipsRef = useRef<Set<string>>(new Set());
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const conclusionCallbackRef = useRef<((event: TimerConclusionEvent) => void) | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerTimerConclusionHandler = useCallback(
    (fn: (event: TimerConclusionEvent) => void) => {
      conclusionCallbackRef.current = fn;
    },
    []
  );

  const emitTimerConclusion = useCallback(
    (endedReason: 'completed' | 'stopped_by_user', totalElapsedMs: number) => {
      if (hasConcludedCurrentRunRef.current) return;
      const cfg = configRef.current;
      const segments = segmentsRef.current;
      if (!cfg || !segments.length) return;

      // Only log timers that actually ran for at least 1 second
      if (totalElapsedMs < 1000) return;

      hasConcludedCurrentRunRef.current = true;

      // Rest timers are purely intra-workout recovery helpers and MUST NOT bloat the session summary
      if (cfg.kind === 'rest') {
        return;
      }

      const summary = summarizeElapsedTimeline(segments, totalElapsedMs);

      const event: TimerConclusionEvent = {
        kind: cfg.kind,
        label: cfg.label,
        plannedSeconds: summary.plannedSeconds,
        elapsedSeconds: summary.elapsedSeconds,
        workSecondsCompleted: summary.workSecondsCompleted,
        roundsCompleted: summary.roundsCompleted,
        totalRounds: Math.max(1, cfg.totalRounds),
        endedReason,
        linkedIsometricTarget: cfg.linkedIsometricTarget,
      };

      conclusionCallbackRef.current?.(event);

      const notice = `Registrado en sesión: ${cfg.label} (${summary.elapsedSeconds}s)`;
      setLastAutoSavedNotice(notice);
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = setTimeout(() => {
        setLastAutoSavedNotice(null);
      }, 3800);
    },
    []
  );

  const acquireWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        setWakeLockActive(true);
        return;
      }
      const navWithWake = navigator as Navigator & {
        wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
      };
      const sentinel = await navWithWake.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener?.('release', () => {
        setWakeLockActive(false);
      });
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  useEffect(() => {
    void acquireWakeLock();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        void wakeLockRef.current.release();
      }
    };
  }, [acquireWakeLock]);

  // Keep the iOS audio session alive while any timer is running so cues are never swallowed
  useEffect(() => {
    kairosAudio.setKeepAlive(snapshot.isActive && snapshot.isRunning);
  }, [snapshot.isActive, snapshot.isRunning]);

  useEffect(() => {
    return () => kairosAudio.setKeepAlive(false);
  }, []);

  const computeAndSyncState = useCallback(() => {
    const cfg = configRef.current;
    const segments = segmentsRef.current;
    if (!cfg || !isActiveRef.current || segments.length === 0) return;

    const now = Date.now();
    const totalElapsedMs = isRunningRef.current
      ? Math.max(0, now - sequenceStartMsRef.current)
      : pausedElapsedMsRef.current;

    let accMs = 0;
    let foundIdx = -1;
    let segStartMs = 0;

    for (let i = 0; i < segments.length; i++) {
      const segEnd = accMs + segments[i].durationMs;
      if (totalElapsedMs < segEnd) {
        foundIdx = i;
        segStartMs = accMs;
        break;
      }
      accMs = segEnd;
    }

    // Timer completed naturally (00:00)!
    if (foundIdx === -1) {
      isRunningRef.current = false;
      isActiveRef.current = false;

      // 1. Alarma nativa de alta prioridad vía HTML5 Audio (suena con pantalla bloqueada y fuera de la app)
      playLockScreenAlarmAudio();

      // 2. Síntesis Web Audio enriquecida
      kairosAudio.playCompletionCue('finish');

      emitTimerConclusion('completed', accMs);

      // Lock Screen urgent notification on finish!
      void emitLockScreenTimerNotification({
        title: cfg.label,
        body: '¡Tu tiempo ha terminado! Es hora de tu siguiente serie.',
        isFinished: true,
      });
      clearLockScreenMediaSession();
      stopSilentBackgroundAudio();
      stopBackgroundWorkerClock();

      const lastSeg = segments[segments.length - 1];
      setSnapshot((prev) => ({
        ...prev,
        isActive: false,
        isRunning: false,
        kind: cfg.kind,
        label: cfg.label,
        phase: 'finished',
        currentRound: cfg.totalRounds || 1,
        totalRounds: cfg.totalRounds || 1,
        phaseRemainingMs: 0,
        phaseDurationMs: lastSeg.durationMs,
        phaseElapsedMs: lastSeg.durationMs,
        progressFraction: 0,
        wakeLockActive,
        linkedIsometricTarget: cfg.linkedIsometricTarget,
      }));
      return;
    }

    const activeSeg = segments[foundIdx];
    const phaseElapsedMs = totalElapsedMs - segStartMs;
    const phaseRemainingMs = Math.max(0, activeSeg.durationMs - phaseElapsedMs);

    if (isRunningRef.current && foundIdx > lastSegmentIdxRef.current) {
      lastSegmentIdxRef.current = foundIdx;
      if (activeSeg.phase === 'work') {
        kairosAudio.playCompletionCue('work');
      } else if (activeSeg.phase === 'rest') {
        kairosAudio.playCompletionCue('rest');
      }
    }

    if (isRunningRef.current && phaseRemainingMs <= 3050 && phaseRemainingMs > 80) {
      const ceilSec = Math.ceil(phaseRemainingMs / 1000);
      if (ceilSec === 3 || ceilSec === 2 || ceilSec === 1) {
        const pipKey = `${foundIdx}_${ceilSec}`;
        if (!firedPipsRef.current.has(pipKey)) {
          firedPipsRef.current.add(pipKey);
          kairosAudio.playCountdownPip(ceilSec);
        }
      }
    }

    const wholeSec = Math.round(phaseRemainingMs / 1000);
    if (wholeSec !== lastReportedSecRef.current) {
      lastReportedSecRef.current = wholeSec;
      updateLockScreenMediaSession({
        title: cfg.label,
        subtitle: `${
          activeSeg.phase === 'work'
            ? 'TRABAJO'
            : activeSeg.phase === 'prep'
              ? 'PREPARACIÓN'
              : 'DESCANSO'
        } · Ronda ${activeSeg.round}/${Math.max(1, cfg.totalRounds)}`,
        durationSeconds: Math.round(activeSeg.durationMs / 1000),
        remainingSeconds: wholeSec,
        isRunning: isRunningRef.current,
        onTogglePlayPause: () => actionsRef.current.togglePlay(),
        onSkip: () => actionsRef.current.skip(),
        onAddSeconds: (d) => actionsRef.current.addSec(d),
      });
    }

    setSnapshot((prev) => ({
      ...prev,
      isActive: true,
      isRunning: isRunningRef.current,
      kind: cfg.kind,
      label: cfg.label,
      phase: activeSeg.phase,
      currentRound: activeSeg.round,
      totalRounds: Math.max(1, cfg.totalRounds),
      phaseRemainingMs,
      phaseDurationMs: activeSeg.durationMs,
      phaseElapsedMs,
      progressFraction:
        activeSeg.durationMs > 0 ? Math.min(1, phaseRemainingMs / activeSeg.durationMs) : 0,
      wakeLockActive,
      linkedIsometricTarget: cfg.linkedIsometricTarget,
    }));
  }, [emitTimerConclusion, wakeLockActive]);

  useEffect(() => {
    let stopWorker: (() => void) | null = null;
    let rafId = 0;

    if (snapshot.isActive && snapshot.isRunning) {
      const targetEndTime = Date.now() + snapshot.phaseRemainingMs;
      stopWorker = startBackgroundWorkerClock(() => {
        computeAndSyncState();
      }, targetEndTime);
      startSilentBackgroundAudio();
    } else {
      stopSilentBackgroundAudio();
      if (!snapshot.isActive) {
        clearLockScreenMediaSession();
        void clearLockScreenTimerNotification();
      }
    }

    const loop = () => {
      if (isActiveRef.current && isRunningRef.current) {
        computeAndSyncState();
      }
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && isActiveRef.current && isRunningRef.current) {
        const cfg = configRef.current;
        if (cfg) {
          const remSec = Math.max(0, Math.round(snapshot.phaseRemainingMs / 1000));
          void emitLockScreenTimerNotification({
            title: cfg.label,
            body: `${snapshot.phase === 'rest' ? 'Descanso' : 'Trabajo'}: ${remSec}s restante`,
            isFinished: false,
          });
        }
      } else if (document.visibilityState === 'visible' && isActiveRef.current) {
        computeAndSyncState();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onVisibility);

    return () => {
      stopWorker?.();
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onVisibility);
    };
  }, [computeAndSyncState, snapshot.isActive, snapshot.isRunning, snapshot.phase, snapshot.phaseRemainingMs]);

  const launchConfig = useCallback(
    (cfg: ActiveTimerConfig) => {
      // If another timer was actively running when launching a new one, auto-record the previous one first!
      if (isActiveRef.current && !hasConcludedCurrentRunRef.current) {
        const prevElapsed = isRunningRef.current
          ? Math.max(0, Date.now() - sequenceStartMsRef.current)
          : pausedElapsedMsRef.current;
        emitTimerConclusion('stopped_by_user', prevElapsed);
      }

      kairosAudio.unlock(true);
      void acquireWakeLock();
      startSilentBackgroundAudio();

      if (getNotificationPermissionStatus() === 'default') {
        void requestLockNotificationPermission().then(() => {
          setNotificationPermission(getNotificationPermissionStatus());
        });
      }

      configRef.current = cfg;
      segmentsRef.current = buildTimeline(cfg);
      sequenceStartMsRef.current = Date.now();
      pausedElapsedMsRef.current = 0;
      lastSegmentIdxRef.current = 0;
      firedPipsRef.current.clear();
      hasConcludedCurrentRunRef.current = false;
      isActiveRef.current = true;
      isRunningRef.current = true;
      computeAndSyncState();
    },
    [acquireWakeLock, computeAndSyncState, emitTimerConclusion]
  );

  const startRestTimer = useCallback(
    (seconds: number, label = 'Descanso') => {
      const safeSec = Math.max(5, Math.round(seconds));
      launchConfig({
        kind: 'rest',
        label,
        totalDurationMs: safeSec * 1000,
        prepSeconds: 0,
        holdSeconds: 0,
        workSeconds: 0,
        restSeconds: safeSec,
        totalRounds: 1,
      });
    },
    [launchConfig]
  );

  const startIsometricTimer = useCallback(
    ({
      prepSeconds,
      holdSeconds,
      label = 'Isometría',
      linkedTarget,
    }: {
      prepSeconds: number;
      holdSeconds: number;
      label?: string;
      linkedTarget?: ActiveTimerConfig['linkedIsometricTarget'];
    }) => {
      launchConfig({
        kind: 'isometric',
        label,
        totalDurationMs: (prepSeconds + holdSeconds) * 1000,
        prepSeconds: Math.max(0, Math.round(prepSeconds)),
        holdSeconds: Math.max(3, Math.round(holdSeconds)),
        linkedIsometricTarget: linkedTarget,
        workSeconds: holdSeconds,
        restSeconds: 0,
        totalRounds: 1,
      });
    },
    [launchConfig]
  );

  const startIntervalTimer = useCallback(
    ({
      prepSeconds,
      workSeconds,
      restSeconds,
      rounds,
      label = 'Intervalos',
    }: {
      prepSeconds: number;
      workSeconds: number;
      restSeconds: number;
      rounds: number;
      label?: string;
    }) => {
      launchConfig({
        kind: 'intervals',
        label,
        totalDurationMs: 0,
        prepSeconds: Math.max(0, Math.round(prepSeconds)),
        holdSeconds: 0,
        workSeconds: Math.max(3, Math.round(workSeconds)),
        restSeconds: Math.max(0, Math.round(restSeconds)),
        totalRounds: Math.max(1, Math.round(rounds)),
      });
    },
    [launchConfig]
  );

  const togglePauseResume = useCallback(() => {
    kairosAudio.unlock(true);
    if (!configRef.current) return;

    if (!isActiveRef.current && snapshot.phase === 'finished') {
      launchConfig(configRef.current);
      return;
    }

    if (isRunningRef.current) {
      pausedElapsedMsRef.current = Math.max(0, Date.now() - sequenceStartMsRef.current);
      isRunningRef.current = false;
      stopSilentBackgroundAudio();
    } else {
      sequenceStartMsRef.current = Date.now() - pausedElapsedMsRef.current;
      isRunningRef.current = true;
      startSilentBackgroundAudio();
    }
    computeAndSyncState();
  }, [computeAndSyncState, launchConfig, snapshot.phase]);

  const adjustCurrentPhaseSeconds = useCallback(
    (deltaSeconds: number) => {
      const segments = segmentsRef.current;
      if (!isActiveRef.current || !segments.length) return;

      const now = Date.now();
      const totalElapsed = isRunningRef.current
        ? Math.max(0, now - sequenceStartMsRef.current)
        : pausedElapsedMsRef.current;

      let acc = 0;
      for (let i = 0; i < segments.length; i++) {
        if (totalElapsed < acc + segments[i].durationMs) {
          const currentElapsedInSeg = totalElapsed - acc;
          const nextDuration = Math.max(
            currentElapsedInSeg + 1000,
            segments[i].durationMs + deltaSeconds * 1000
          );
          segments[i] = { ...segments[i], durationMs: nextDuration };
          firedPipsRef.current.delete(`${i}_3`);
          firedPipsRef.current.delete(`${i}_2`);
          firedPipsRef.current.delete(`${i}_1`);
          break;
        }
        acc += segments[i].durationMs;
      }
      computeAndSyncState();
    },
    [computeAndSyncState]
  );

  const stopTimer = useCallback(() => {
    if (isActiveRef.current) {
      const totalElapsed = isRunningRef.current
        ? Math.max(0, Date.now() - sequenceStartMsRef.current)
        : pausedElapsedMsRef.current;
      emitTimerConclusion('stopped_by_user', totalElapsed);
    }
    isActiveRef.current = false;
    isRunningRef.current = false;
    setDrawerExpanded(false);
    clearLockScreenMediaSession();
    void clearLockScreenTimerNotification();
    stopSilentBackgroundAudio();
    stopBackgroundWorkerClock();
    setSnapshot((prev) => ({
      ...prev,
      isActive: false,
      isRunning: false,
      phaseRemainingMs: 0,
    }));
  }, [emitTimerConclusion]);

  const cancelTimer = useCallback(() => {
    hasConcludedCurrentRunRef.current = true;
    isActiveRef.current = false;
    isRunningRef.current = false;
    setDrawerExpanded(false);
    clearLockScreenMediaSession();
    void clearLockScreenTimerNotification();
    stopSilentBackgroundAudio();
    stopBackgroundWorkerClock();
    setSnapshot((prev) => ({
      ...prev,
      isActive: false,
      isRunning: false,
      phaseRemainingMs: 0,
      phase: 'rest',
      lastAutoSavedNotice: null,
    }));
  }, []);

  const skipCurrentPhase = useCallback(() => {
    const cfg = configRef.current;
    const segments = segmentsRef.current;
    if (!cfg || !isActiveRef.current || !segments.length) {
      stopTimer();
      return;
    }

    const totalElapsed = isRunningRef.current
      ? Math.max(0, Date.now() - sequenceStartMsRef.current)
      : pausedElapsedMsRef.current;

    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      const segEnd = acc + segments[i].durationMs;
      if (totalElapsed < segEnd) {
        // Last phase -> conclude & auto-save!
        if (i === segments.length - 1) {
          stopTimer();
          return;
        }

        const newElapsed = segEnd + 5;
        pausedElapsedMsRef.current = newElapsed;
        sequenceStartMsRef.current = Date.now() - newElapsed;
        lastSegmentIdxRef.current = i + 1;
        if (segments[i + 1].phase === 'work') {
          kairosAudio.playCompletionCue('work');
        } else {
          kairosAudio.playCompletionCue('rest');
        }
        computeAndSyncState();
        return;
      }
      acc = segEnd;
    }
  }, [computeAndSyncState, stopTimer]);

  useEffect(() => {
    actionsRef.current.togglePlay = togglePauseResume;
    actionsRef.current.skip = skipCurrentPhase;
    actionsRef.current.addSec = adjustCurrentPhaseSeconds;
  }, [togglePauseResume, skipCurrentPhase, adjustCurrentPhaseSeconds]);

  const resetTimer = useCallback(() => {
    if (!configRef.current) return;
    launchConfig(configRef.current);
  }, [launchConfig]);

  const value = useMemo<TimerContextValue>(
    () => ({
      snapshot: { ...snapshot, wakeLockActive, lastAutoSavedNotice },
      isDrawerExpanded,
      setDrawerExpanded,
      startRestTimer,
      startIsometricTimer,
      startIntervalTimer,
      togglePauseResume,
      adjustCurrentPhaseSeconds,
      skipCurrentPhase,
      stopTimer,
      cancelTimer,
      resetTimer,
      registerTimerConclusionHandler,
      notificationPermission,
      requestNotificationPermission: handleRequestPermission,
    }),
    [
      snapshot,
      wakeLockActive,
      lastAutoSavedNotice,
      isDrawerExpanded,
      startRestTimer,
      startIsometricTimer,
      startIntervalTimer,
      togglePauseResume,
      adjustCurrentPhaseSeconds,
      skipCurrentPhase,
      stopTimer,
      cancelTimer,
      resetTimer,
      registerTimerConclusionHandler,
      notificationPermission,
      handleRequestPermission,
    ]
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimerEngine(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error('useTimerEngine debe usarse dentro de TimerEngineProvider');
  }
  return ctx;
}

/**
 * Calm Gothic Floating Timer Bar
 */
export function FloatingWorkoutTimerHUD() {
  const {
    snapshot,
    isDrawerExpanded,
    setDrawerExpanded,
    startRestTimer,
    togglePauseResume,
    adjustCurrentPhaseSeconds,
    skipCurrentPhase,
    stopTimer,
    cancelTimer,
    resetTimer,
  } = useTimerEngine();
  const [hudConfirmCancel, setHudConfirmCancel] = useState(false);

  useEffect(() => {
    if (!snapshot.isActive) {
      setHudConfirmCancel(false);
    }
  }, [snapshot.isActive]);

  if (!snapshot.isActive && !isDrawerExpanded && !snapshot.lastAutoSavedNotice) {
    return null;
  }

  // Subtle auto-saved confirmation toast when timer finishes or is stopped
  if (!snapshot.isActive && !isDrawerExpanded && snapshot.lastAutoSavedNotice) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[430px] px-4 pointer-events-none">
        <div className="rounded-xl border border-stoneborder bg-surface/95 px-3 py-2 text-center text-xs text-brand-muted shadow-xl backdrop-blur-md animate-fade-up">
          ✓ {snapshot.lastAutoSavedNotice}
        </div>
      </div>
    );
  }

  const phaseTag =
    snapshot.phase === 'prep'
      ? 'Prep'
      : snapshot.phase === 'work'
        ? snapshot.kind === 'isometric'
          ? 'Sostén'
          : `R${snapshot.currentRound}/${snapshot.totalRounds}`
        : 'Descanso';

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[430px] px-3 pointer-events-none">
      <div className="pointer-events-auto rounded-2xl border border-stoneborder bg-surface/95 shadow-2xl backdrop-blur-xl overflow-hidden">
        {snapshot.isActive && (
          <div className="h-[2px] w-full bg-background">
            <div
              className="h-full bg-gothic transition-[width] duration-100"
              style={{ width: `${Math.round(snapshot.progressFraction * 100)}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between px-3.5 py-2.5">
          <button
            type="button"
            onClick={() => setDrawerExpanded(!isDrawerExpanded)}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
          >
            <Timer className="h-3.5 w-3.5 shrink-0 text-gothic" />
            <span className="text-[11px] font-medium text-gothic">
              {phaseTag}
            </span>
            <span className="truncate text-xs text-brand-muted">{snapshot.label}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="font-mono text-lg font-medium tabular-nums text-brand mr-1">
              {formatTimerMs(snapshot.phaseRemainingMs, true)}
            </span>

            {snapshot.isActive && (
              <>
                <button
                  type="button"
                  onClick={() => adjustCurrentPhaseSeconds(15)}
                  className="rounded-lg border border-stoneborder bg-background px-2 py-1 text-[11px] text-brand-muted hover:text-brand active:scale-95"
                >
                  +15
                </button>
                <button
                  type="button"
                  onClick={togglePauseResume}
                  aria-label="Pausar o reanudar"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gothic/50 bg-gothic/20 text-brand active:scale-95"
                >
                  {snapshot.isRunning ? (
                    <Pause className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={stopTimer}
                  title="Detener y registrar en la sesión"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-stoneborder bg-background text-brand-muted active:scale-95"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setDrawerExpanded(!isDrawerExpanded)}
              className="flex h-7 w-6 items-center justify-center text-brand-muted"
            >
              {isDrawerExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {isDrawerExpanded && (
          <div className="border-t border-stoneborder p-3 space-y-2.5 bg-background/80">
            {snapshot.isActive && (
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustCurrentPhaseSeconds(-15)}
                  className="rounded-xl border border-stoneborder bg-surface py-2 text-xs text-brand-muted"
                >
                  -15s
                </button>
                <button
                  type="button"
                  onClick={() => adjustCurrentPhaseSeconds(15)}
                  className="rounded-xl border border-stoneborder bg-surface py-2 text-xs text-brand-muted"
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={resetTimer}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-stoneborder bg-surface py-2 text-xs text-brand-muted"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reiniciar
                </button>
                <button
                  type="button"
                  onClick={skipCurrentPhase}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-gothic/40 bg-gothic/15 py-2 text-xs font-medium text-brand"
                >
                  <FastForward className="h-3 w-3" />
                  Fin
                </button>
              </div>
            )}

            {/* Cancel Interval / Isometric Double Confirmation in Floating HUD */}
            {snapshot.isActive && (snapshot.kind === 'intervals' || snapshot.kind === 'isometric') && (
              <div className="pt-0.5">
                {hudConfirmCancel ? (
                  <div className="rounded-xl border border-status-regress/50 bg-status-regress/15 p-2 flex items-center justify-between gap-2 animate-fade-up">
                    <span className="text-[11px] font-medium text-brand">
                      {snapshot.kind === 'isometric'
                        ? '¿Descartar isometría actual?'
                        : '¿Descartar intervalo actual?'}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          cancelTimer();
                          setHudConfirmCancel(false);
                        }}
                        className="rounded-lg bg-status-regress px-2 py-0.5 text-[10px] font-bold text-white shadow active:scale-95"
                      >
                        Sí, cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => setHudConfirmCancel(false)}
                        className="rounded-lg border border-stoneborder bg-background px-2 py-0.5 text-[10px] text-brand-muted hover:text-brand"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setHudConfirmCancel(true)}
                    className="w-full flex items-center justify-center gap-1 rounded-xl border border-status-regress/35 bg-status-regress/10 py-1.5 text-[11px] font-medium text-brand hover:bg-status-regress/20 active:scale-98"
                  >
                    <XCircle className="h-3.5 w-3.5 text-status-regress" />
                    <span>
                      {snapshot.kind === 'isometric'
                        ? 'Cancelar isometría en curso'
                        : 'Cancelar intervalo en curso'}
                    </span>
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-6 gap-1">
              {[45, 60, 90, 120, 180, 240].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => startRestTimer(sec, `Descanso ${sec}s`)}
                  className="rounded-xl border border-stoneborder bg-surface py-1.5 font-mono text-[11px] text-brand-muted hover:text-brand active:scale-95"
                >
                  {sec >= 180 && sec % 60 === 0 ? `${sec / 60}m` : `${sec}s`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
