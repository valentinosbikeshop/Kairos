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
  AppTab,
  AudioSettings,
  AuthenticatedUser,
  CalisthenicsSubType,
  CardioDiscipline,
  ExerciseCatalogItem,
  ExerciseDeepProfile,
  ExerciseEvaluation,
  HyroxStationName,
  RoutineDayPlan,
  RoutineExercisePrescription,
  SessionImpactReport,
  SessionTimerLog,
  TrainingMode,
  UserProfile,
  UserRoutine,
  WorkoutBlock,
  WorkoutExercise,
  WorkoutSession,
} from '@/types/kairos';
import {
  BUILTIN_EXERCISES,
  cloneSetsFromGhost,
  getLastExerciseGhost,
} from '@/lib/exerciseDatabase';
import {
  cleanActiveWorkoutExercises,
  cleanAllRoutineExercises,
  cleanWorkoutSessionExercises,
  resolveExerciseIntelligently,
  sanitizeExerciseName,
  synthesizeExerciseDeepProfile,
} from '@/lib/exerciseClassifierEngine';
import {
  ActiveWorkoutDraft,
  createEmptyWorkoutDraft,
  defaultAudioSettings,
  KairosBackupPayload,
  loadAuthTokenFromStorage,
  loadCachedUserSnapshot,
  PersistedUserDataSnapshot,
  requestPersistentBrowserStorage,
  saveAuthTokenToStorage,
  saveCachedUserSnapshot,
} from '@/lib/storage';
import {
  adaptRoutineForSkippedDay,
  anchorRoutineToDayForToday,
  buildWorkoutBlocksFromRoutineDay,
  buildWorkoutExerciseFromPrescription,
  populateRoutineDayByFocus,
} from '@/lib/aiRoutineEngine';
import { kairosAudio } from '@/lib/audioEngine';
import { buildSessionImpactReport, evaluateAllExercises } from '@/lib/analyticsEngine';
import { getResolvedWorkoutDefaults, MODE_META, uid } from '@/lib/formatters';
import { useTimerEngine } from '@/components/TimerEngine';

interface KairosContextValue {
  hydrated: boolean;
  user: AuthenticatedUser | null;
  profile: UserProfile | null;
  routine: UserRoutine | null;

  // Auth & Onboarding
  registerUser: (input: {
    username: string;
    displayName: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  loginUser: (input: {
    username: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  recoverUserPassword: (input: {
    username: string;
    newPassword: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logoutUser: () => Promise<void>;
  saveUserProfile: (nextProfile: UserProfile) => Promise<void>;
  saveUserRoutine: (nextRoutine: UserRoutine | null, finishOnboarding?: boolean) => Promise<void>;
  completeOnboarding: () => Promise<void>;

  // Routine Daily Actions
  loadRoutineDayIntoWorkout: (dayPlan: RoutineDayPlan) => void;
  setActiveRoutineDayForToday: (dayPlanId: string) => void;
  populateEmptyRoutineDay: (dayPlanId: string) => RoutineDayPlan | null;
  addRoutineExerciseToWorkout: (
    prescription: RoutineExercisePrescription,
    dayFocusTitle?: string
  ) => void;
  adaptRoutineOnSkippedDay: (
    mode: 'skip_today' | 'recover_yesterday',
    missedPlan?: RoutineDayPlan | null
  ) => void;
  openRoutineModal: boolean;
  setOpenRoutineModal: (open: boolean) => void;
  openRationaleModal: boolean;
  setOpenRationaleModal: (open: boolean) => void;

  // Navigation & Core State
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  sessions: WorkoutSession[];
  evaluations: ExerciseEvaluation[];
  catalog: ExerciseCatalogItem[];
  audioSettings: AudioSettings;
  updateAudioSettings: (patch: Partial<AudioSettings>) => void;

  // Active Workout Studio
  activeWorkout: ActiveWorkoutDraft;
  titleRequiredError: boolean;
  clearTitleError: () => void;
  sessionElapsedSeconds: number;
  resetSessionClock: () => void;
  updateWorkoutTitle: (title: string) => void;
  updateWorkoutNotes: (notes: string) => void;
  addBlockToWorkout: (mode: TrainingMode, cardioDiscipline?: CardioDiscipline) => void;
  removeBlockFromWorkout: (blockId: string) => void;
  updateBlockTitle: (blockId: string, title: string) => void;
  updateBlockCardioDiscipline: (blockId: string, discipline: CardioDiscipline) => void;
  addExerciseToBlock: (blockId: string, item: ExerciseCatalogItem) => void;
  createAndAddCustomExercise: (
    blockId: string,
    name: string,
    mode: TrainingMode,
    options?: {
      muscleGroup?: string;
      calisthenicsSubType?: CalisthenicsSubType;
      cardioDiscipline?: CardioDiscipline;
    }
  ) => void;
  removeExerciseFromBlock: (blockId: string, exerciseId: string) => void;
  mutateExercise: (
    blockId: string,
    exerciseId: string,
    updater: (ex: WorkoutExercise) => WorkoutExercise
  ) => void;
  batchCalibrateExercises: (
    calibrations: {
      exerciseId: string;
      catalogId: string;
      name: string;
      muscleGroup: string;
    }[]
  ) => void;
  removeTimerLog: (logId: string) => void;
  finishAndAnalyzeWorkout: () => { ok: boolean; reason?: 'missing_title' | 'empty_blocks' };
  clearActiveWorkoutBlocks: () => void;

  // Impact Report Modal
  latestImpactReport: SessionImpactReport | null;
  dismissImpactReport: () => void;

  // History & Backup Actions
  deleteSession: (sessionId: string) => void;
  updateHistoricalSession: (updated: WorkoutSession) => void;
  repeatSessionAsTemplate: (session: WorkoutSession) => void;
  exportBackupJson: () => string;
  importBackupJson: (jsonText: string) => { ok: boolean; message: string };

  // Deep Exercise Intelligence & Research Pipeline
  researchingExercises: Record<string, boolean>;
  researchCustomExercise: (
    name: string,
    mode?: TrainingMode,
    catalogId?: string
  ) => Promise<ExerciseDeepProfile>;
}

const KairosContext = createContext<KairosContextValue | null>(null);

function createDefaultExerciseEntry(
  item: ExerciseCatalogItem,
  targetMode: TrainingMode,
  sessions: WorkoutSession[],
  overrideCardioDiscipline?: CardioDiscipline,
  profile?: UserProfile | null
): WorkoutExercise {
  const ghost = getLastExerciseGhost(sessions, item.id, item.name);
  const ghostSets = cloneSetsFromGhost(ghost?.lastExercise, () => uid('set'), targetMode);
  const defs = getResolvedWorkoutDefaults(profile);
  const hasCustomRest = Boolean(profile?.workoutDefaults?.defaultRestSeconds);
  const defaultRest = MODE_META[targetMode].defaultRest;
  const deepProfile =
    item.deepProfile ?? synthesizeExerciseDeepProfile(item.name, targetMode, item.id);

  const base: WorkoutExercise = {
    id: uid('ex'),
    catalogId: item.id,
    name: item.name,
    mode: targetMode,
    muscleGroup: item.muscleGroup,
    deepProfile,
    defaultRestSeconds: hasCustomRest
      ? defs.defaultRestSeconds
      : item.mode === targetMode
        ? item.defaultRestSeconds
        : defaultRest,
    calisthenicsSubType: item.calisthenicsSubType ?? 'dynamic',
    cardioDiscipline: overrideCardioDiscipline ?? item.cardioDiscipline ?? 'jumprope',
  };

  if (Object.keys(ghostSets).length > 0) {
    return { ...base, ...ghostSets };
  }

  const effectiveCount = Math.max(1, defs.defaultEffectiveSets);
  const warmupCount = Math.max(0, defs.defaultWarmupSets);

  if (targetMode === 'hypertrophy') {
    const warmupSets = Array.from({ length: warmupCount }, () => ({
      id: uid('hy'),
      weightKg: 20,
      reps: defs.defaultReps,
      rir: '4+' as const,
      setType: 'Calentamiento' as const,
      restSeconds: base.defaultRestSeconds,
      completed: false,
    }));
    const effectiveSets = Array.from({ length: effectiveCount }, () => ({
      id: uid('hy'),
      weightKg: 30,
      reps: defs.defaultReps,
      rir: defs.defaultRir,
      setType: 'Efectiva' as const,
      restSeconds: base.defaultRestSeconds,
      completed: false,
    }));
    return {
      ...base,
      hypertrophySets: [...warmupSets, ...effectiveSets],
    };
  }

  if (targetMode === 'strength') {
    const totalStrengthSets = Math.max(1, warmupCount + effectiveCount);
    return {
      ...base,
      referenceOneRmKg: 90,
      strengthSets: Array.from({ length: totalStrengthSets }, (_, idx) => ({
        id: uid('st'),
        weightKg: idx < warmupCount ? 50 : 70,
        reps: profile?.workoutDefaults?.defaultReps ? defs.defaultReps : 5,
        rpe: idx < warmupCount ? 6.5 : defs.defaultRpe,
        restSeconds: base.defaultRestSeconds,
        completed: false,
      })),
    };
  }

  if (targetMode === 'calisthenics') {
    if (item.calisthenicsSubType === 'isometric') {
      return {
        ...base,
        calisthenicsSubType: 'isometric',
        calisthenicsIsometricSets: Array.from({ length: effectiveCount }, () => ({
          id: uid('ci'),
          progression: 'Tuck' as const,
          targetSeconds: defs.defaultIsometricSeconds,
          actualSeconds: defs.defaultIsometricSeconds,
          addedWeightKg: 0,
          restSeconds: base.defaultRestSeconds,
          completed: false,
        })),
      };
    }
    return {
      ...base,
      calisthenicsSubType: 'dynamic',
      calisthenicsDynamicSets: Array.from({ length: effectiveCount }, () => ({
        id: uid('cd'),
        variation: 'Estricto',
        addedWeightKg: 0,
        reps: profile?.workoutDefaults?.defaultReps ? defs.defaultReps : 8,
        rir: defs.defaultRir,
        restSeconds: base.defaultRestSeconds,
        completed: false,
      })),
    };
  }

  if (targetMode === 'hyrox') {
    const def = item.hyroxDefault ?? {
      station: '1000m Run' as HyroxStationName,
      distanceMeters: 1000,
      reps: 0,
      implementWeightKg: 0,
    };
    return {
      ...base,
      hyroxSets: [
        {
          id: uid('hx'),
          station: def.station,
          distanceMeters: def.distanceMeters,
          reps: def.reps,
          implementWeightKg: def.implementWeightKg,
          splitSeconds: 240,
          roxzoneSeconds: 25,
          completed: false,
        },
      ],
    };
  }

  const discipline = overrideCardioDiscipline ?? item.cardioDiscipline ?? 'jumprope';
  if (discipline === 'jumprope') {
    return {
      ...base,
      cardioDiscipline: 'jumprope',
      jumpRopeSets: [
        {
          id: uid('jr'),
          jumps: 140,
          durationSeconds: 60,
          style: item.id.includes('double') ? 'Dobles / Double Unders' : 'Boxer Step',
          misses: 0,
          restSeconds: base.defaultRestSeconds,
          completed: false,
        },
      ],
    };
  }

  if (discipline === 'running') {
    return {
      ...base,
      cardioDiscipline: 'running',
      runningSets: [
        {
          id: uid('rn'),
          distanceMeters: 1000,
          durationSeconds: 270,
          inclinePercent: 0,
          runType: 'Zona 2 Continua',
          restSeconds: base.defaultRestSeconds,
          completed: false,
        },
      ],
    };
  }

  if (discipline === 'swimming') {
    return {
      ...base,
      cardioDiscipline: 'swimming',
      swimmingSets: [
        {
          id: uid('sw'),
          poolLengthMeters: 25,
          laps: 4,
          stroke: 'Crol/Libre',
          durationSeconds: 110,
          restSeconds: base.defaultRestSeconds,
          completed: false,
        },
      ],
    };
  }

  return {
    ...base,
    cardioDiscipline: 'cycling',
    cyclingSets: [
      {
        id: uid('cy'),
        durationSeconds: 300,
        distanceMeters: 2200,
        avgWatts: 200,
        cadenceRpm: 88,
        restSeconds: base.defaultRestSeconds,
        completed: false,
      },
    ],
  };
}

export function KairosProvider({ children }: { children: React.ReactNode }) {
  const { registerTimerConclusionHandler, startRestTimer } = useTimerEngine();

  const [hydrated, setHydrated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [routine, setRoutine] = useState<UserRoutine | null>(null);

  const [openRoutineModal, setOpenRoutineModal] = useState(false);
  const [openRationaleModal, setOpenRationaleModal] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>('workout');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [customExercises, setCustomExercises] = useState<ExerciseCatalogItem[]>([]);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(defaultAudioSettings());
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutDraft>(
    createEmptyWorkoutDraft()
  );

  const [titleRequiredError, setTitleRequiredError] = useState(false);
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0);
  const [latestImpactReport, setLatestImpactReport] = useState<SessionImpactReport | null>(null);
  const [researchingExercises, setResearchingExercises] = useState<Record<string, boolean>>({});

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySnapshot = useCallback((snap: PersistedUserDataSnapshot) => {
    // 1. Sanitize routine exercises (remove extracted noise words & parentheticals)
    const cleanRoutine = snap.routine
      ? {
          ...snap.routine,
          days: cleanAllRoutineExercises(snap.routine.days).cleanedDays,
        }
      : null;

    // 2. Sanitize historical sessions
    const cleanSessions = Array.isArray(snap.sessions)
      ? snap.sessions.map((s) => cleanWorkoutSessionExercises(s).session)
      : [];

    // 3. Sanitize active workout draft blocks
    const cleanActiveWorkout = snap.activeWorkout
      ? cleanActiveWorkoutExercises(snap.activeWorkout).activeWorkout
      : createEmptyWorkoutDraft();

    setUser(snap.user);
    setProfile(snap.profile ?? null);
    setRoutine(cleanRoutine);
    setSessions(cleanSessions);
    setCustomExercises(Array.isArray(snap.customExercises) ? snap.customExercises : []);
    const audio = snap.audioSettings ?? defaultAudioSettings();
    setAudioSettings(audio);
    kairosAudio.updateSettings(audio);
    setActiveWorkout(cleanActiveWorkout);
    saveCachedUserSnapshot({
      ...snap,
      routine: cleanRoutine,
      sessions: cleanSessions,
      activeWorkout: cleanActiveWorkout,
    });
  }, []);

  const pushStateToServer = useCallback(
    async (
      patch: Record<string, unknown>,
      overrideToken?: string | null
    ): Promise<void> => {
      const tokenToUse = overrideToken !== undefined ? overrideToken : authToken;
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (tokenToUse) {
          headers.Authorization = `Bearer ${tokenToUse}`;
        }
        await fetch('/api/user/state', {
          method: 'PUT',
          headers,
          body: JSON.stringify(patch),
        });
      } catch {
        // Offline fallback: local cache already updated
      }
    },
    [authToken]
  );

  // Initial Hydration from Server Session (with Offline Local Cache fallback)
  useEffect(() => {
    requestPersistentBrowserStorage();
    const storedToken = loadAuthTokenFromStorage();
    if (storedToken) {
      setAuthToken(storedToken);
    }

    const restore = async () => {
      try {
        const headers: Record<string, string> = {};
        if (storedToken) {
          headers.Authorization = `Bearer ${storedToken}`;
        }
        const res = await fetch('/api/user/state', { headers, cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as {
            ok: boolean;
            snapshot?: PersistedUserDataSnapshot;
          };
          if (data.ok && data.snapshot) {
            applySnapshot(data.snapshot);
            setHydrated(true);
            return;
          }
        } else if (res.status === 401) {
          // Session invalid or cleared
          saveAuthTokenToStorage(null);
          saveCachedUserSnapshot(null);
          setUser(null);
          setHydrated(true);
          return;
        }
      } catch {
        // Network offline -> load local cached account snapshot
        const cached = loadCachedUserSnapshot();
        if (cached) {
          applySnapshot(cached);
        }
      }
      setHydrated(true);
    };

    void restore();
  }, [applySnapshot]);

  // Continuous Local Cache + Debounced Server Sync while logged in
  useEffect(() => {
    if (!hydrated || !user) return;

    const currentSnapshot: PersistedUserDataSnapshot = {
      user,
      profile,
      routine,
      sessions,
      customExercises,
      audioSettings,
      activeWorkout,
    };
    saveCachedUserSnapshot(currentSnapshot);

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(() => {
      void pushStateToServer({
        onboardingCompleted: user.onboardingCompleted,
        profile,
        routine,
        sessions,
        customExercises,
        audioSettings,
        activeWorkout,
      });
    }, 450);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [
    hydrated,
    user,
    profile,
    routine,
    sessions,
    customExercises,
    audioSettings,
    activeWorkout,
    pushStateToServer,
  ]);

  // Live session elapsed clock
  useEffect(() => {
    if (!hydrated || !user) return;
    const updateClock = () => {
      const sec = Math.max(0, Math.floor((Date.now() - activeWorkout.startedAtMs) / 1000));
      setSessionElapsedSeconds(sec);
    };
    updateClock();
    const id = setInterval(updateClock, 1000);
    return () => clearInterval(id);
  }, [activeWorkout.startedAtMs, hydrated, user]);

  // Automatic recording of Intervals & Isometric timers ONLY (Rest timers are intra-workout helpers only)
  useEffect(() => {
    registerTimerConclusionHandler((event) => {
      if (!user || event.kind === 'rest') return;
      const newLog: SessionTimerLog = {
        id: uid('tlog'),
        kind: event.kind,
        label: event.label,
        recordedAtIso: new Date().toISOString(),
        plannedSeconds: event.plannedSeconds,
        elapsedSeconds: event.elapsedSeconds,
        workSecondsCompleted: event.workSecondsCompleted,
        roundsCompleted: event.roundsCompleted,
        totalRounds: event.totalRounds,
        endedReason: event.endedReason,
      };

      let autoRestAfterIso = 0;
      let autoRestLabel = 'Descanso';

      setActiveWorkout((prev) => {
        let nextBlocks = [...prev.blocks];

        if (event.kind === 'isometric') {
          const heldSec = Math.max(1, event.workSecondsCompleted || event.elapsedSeconds);
          if (event.linkedIsometricTarget) {
            const target = event.linkedIsometricTarget;
            nextBlocks = nextBlocks.map((blk) => {
              if (blk.id !== target.blockId) return blk;
              return {
                ...blk,
                exercises: blk.exercises.map((ex) => {
                  if (ex.id !== target.exerciseId || !ex.calisthenicsIsometricSets) return ex;
                  autoRestLabel = `Descanso · ${ex.name}`;
                  return {
                    ...ex,
                    calisthenicsIsometricSets: ex.calisthenicsIsometricSets.map((s) => {
                      if (s.id !== target.setId) return s;
                      if (event.endedReason === 'completed') {
                        autoRestAfterIso = s.restSeconds || ex.defaultRestSeconds;
                      }
                      return { ...s, actualSeconds: heldSec, completed: true };
                    }),
                  };
                }),
              };
            });
          } else if (heldSec >= 2) {
            const newIsoSet = {
              id: uid('ci'),
              progression: 'Tuck' as const,
              targetSeconds: event.plannedSeconds,
              actualSeconds: heldSec,
              addedWeightKg: 0,
              restSeconds: 120,
              completed: true,
            };
            nextBlocks = [
              ...nextBlocks,
              {
                id: uid('blk'),
                mode: 'calisthenics',
                title: 'Isometría',
                exercises: [
                  {
                    id: uid('ex'),
                    catalogId: 'timer_auto_iso',
                    name: event.label || 'Sostén Isométrico',
                    mode: 'calisthenics',
                    calisthenicsSubType: 'isometric',
                    muscleGroup: 'Isometría',
                    defaultRestSeconds: 120,
                    calisthenicsIsometricSets: [newIsoSet],
                  },
                ],
              },
            ];
          }
        }

        if (event.kind === 'intervals' && event.elapsedSeconds >= 3) {
          const workSec = Math.max(1, event.workSecondsCompleted || event.elapsedSeconds);
          const isJumpRope = /cuerda|comba|jump/i.test(event.label);
          if (isJumpRope) {
            const estJumps = Math.round((workSec / 60) * 135);
            nextBlocks = [
              ...nextBlocks,
              {
                id: uid('blk'),
                mode: 'cardio',
                cardioDiscipline: 'jumprope',
                title: 'Salto de Cuerda',
                exercises: [
                  {
                    id: uid('ex'),
                    catalogId: 'crd_jr_tabata_hiit',
                    name: `${event.label} (${event.roundsCompleted}/${event.totalRounds})`,
                    mode: 'cardio',
                    cardioDiscipline: 'jumprope',
                    muscleGroup: 'Cardio',
                    defaultRestSeconds: 30,
                    jumpRopeSets: [
                      {
                        id: uid('jr'),
                        jumps: Math.max(10, estJumps),
                        durationSeconds: workSec,
                        style: 'Boxer Step',
                        misses: 0,
                        restSeconds: 30,
                        completed: true,
                      },
                    ],
                  },
                ],
              },
            ];
          } else {
            nextBlocks = [
              ...nextBlocks,
              {
                id: uid('blk'),
                mode: 'cardio',
                cardioDiscipline: 'cycling',
                title: 'Intervalos',
                exercises: [
                  {
                    id: uid('ex'),
                    catalogId: 'timer_auto_intervals',
                    name: `${event.label} (${event.roundsCompleted}/${event.totalRounds})`,
                    mode: 'cardio',
                    cardioDiscipline: 'cycling',
                    muscleGroup: 'Intervalos',
                    defaultRestSeconds: 30,
                    cyclingSets: [
                      {
                        id: uid('cy'),
                        durationSeconds: workSec,
                        distanceMeters: 0,
                        avgWatts: 0,
                        cadenceRpm: 0,
                        restSeconds: 30,
                        completed: true,
                      },
                    ],
                  },
                ],
              },
            ];
          }
        }

        return {
          ...prev,
          blocks: nextBlocks,
          timerLogs: [newLog, ...(prev.timerLogs ?? [])],
        };
      });

      if (autoRestAfterIso > 0) {
        setTimeout(() => {
          startRestTimer(autoRestAfterIso, autoRestLabel);
        }, 450);
      }
    });
  }, [registerTimerConclusionHandler, startRestTimer, user]);

  // ============================================================================
  // AUTH & ONBOARDING ACTIONS
  // ============================================================================

  const registerUser = useCallback(
    async (input: { username: string; displayName: string; password: string }) => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          token?: string;
          snapshot?: PersistedUserDataSnapshot;
        };
        if (!res.ok || !data.ok || !data.snapshot) {
          return { ok: false, error: data.error || 'No se pudo crear la cuenta.' };
        }
        if (data.token) {
          setAuthToken(data.token);
          saveAuthTokenToStorage(data.token);
        }
        applySnapshot(data.snapshot);
        setActiveTab('workout');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Sin conexión con el servidor. Verifica tu red.' };
      }
    },
    [applySnapshot]
  );

  const loginUser = useCallback(
    async (input: { username: string; password: string }) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          token?: string;
          snapshot?: PersistedUserDataSnapshot;
        };
        if (!res.ok || !data.ok || !data.snapshot) {
          return { ok: false, error: data.error || 'Credenciales incorrectas.' };
        }
        if (data.token) {
          setAuthToken(data.token);
          saveAuthTokenToStorage(data.token);
        }
        applySnapshot(data.snapshot);
        setActiveTab('workout');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Sin conexión con el servidor.' };
      }
    },
    [applySnapshot]
  );

  const recoverUserPassword = useCallback(
    async (input: { username: string; newPassword: string }) => {
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          token?: string;
          snapshot?: PersistedUserDataSnapshot;
        };
        if (!res.ok || !data.ok || !data.snapshot) {
          return { ok: false, error: data.error || 'No se pudo recuperar la cuenta.' };
        }
        if (data.token) {
          setAuthToken(data.token);
          saveAuthTokenToStorage(data.token);
        }
        applySnapshot(data.snapshot);
        setActiveTab('workout');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Sin conexión con el servidor.' };
      }
    },
    [applySnapshot]
  );

  const logoutUser = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    setAuthToken(null);
    saveAuthTokenToStorage(null);
    saveCachedUserSnapshot(null);
    setUser(null);
    setProfile(null);
    setRoutine(null);
    setSessions([]);
    setCustomExercises([]);
    setActiveWorkout(createEmptyWorkoutDraft());
    setLatestImpactReport(null);
  }, []);

  const saveUserProfile = useCallback(
    async (nextProfile: UserProfile) => {
      setProfile(nextProfile);
      await pushStateToServer({ profile: nextProfile });
    },
    [pushStateToServer]
  );

  const saveUserRoutine = useCallback(
    async (nextRoutine: UserRoutine | null, finishOnboarding = false) => {
      setRoutine(nextRoutine);
      if (finishOnboarding) {
        setUser((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
      }
      await pushStateToServer({
        routine: nextRoutine,
        ...(finishOnboarding ? { onboardingCompleted: true } : {}),
      });
    },
    [pushStateToServer]
  );

  const completeOnboarding = useCallback(async () => {
    setUser((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
    await pushStateToServer({ onboardingCompleted: true });
  }, [pushStateToServer]);

  // ============================================================================
  // DAILY ROUTINE LOADING & SKIPPED-DAY ADAPTATION
  // ============================================================================

  const catalog = useMemo(
    () => [...customExercises, ...BUILTIN_EXERCISES],
    [customExercises]
  );

  const setActiveRoutineDayForToday = useCallback(
    (dayPlanId: string) => {
      setRoutine((prev) => {
        if (!prev) return prev;
        const anchored = anchorRoutineToDayForToday(prev, dayPlanId);
        void pushStateToServer({ routine: anchored });
        return anchored;
      });
    },
    [pushStateToServer]
  );

  const populateEmptyRoutineDay = useCallback(
    (dayPlanId: string): RoutineDayPlan | null => {
      let populatedResult: RoutineDayPlan | null = null;
      setRoutine((prev) => {
        if (!prev) return prev;
        const target = prev.days.find((d) => d.id === dayPlanId);
        if (!target) return prev;
        const populated = populateRoutineDayByFocus(target);
        populatedResult = populated;
        const nextRoutine: UserRoutine = {
          ...prev,
          days: prev.days.map((d) => (d.id === dayPlanId ? populated : d)),
        };
        void pushStateToServer({ routine: nextRoutine });
        return nextRoutine;
      });
      return populatedResult;
    },
    [pushStateToServer]
  );

  const loadRoutineDayIntoWorkout = useCallback(
    (dayPlan: RoutineDayPlan) => {
      let effectiveDayPlan = dayPlan;

      // Guard: if a non-rest day has 0 exercises configured, auto-populate it scientifically so it never loads blank
      if (!effectiveDayPlan.isRestDay && effectiveDayPlan.exercises.length === 0) {
        effectiveDayPlan = populateRoutineDayByFocus(effectiveDayPlan);
        setRoutine((prev) => {
          if (!prev) return prev;
          const updated: UserRoutine = {
            ...prev,
            days: prev.days.map((d) => (d.id === effectiveDayPlan.id ? effectiveDayPlan : d)),
          };
          const anchored = anchorRoutineToDayForToday(updated, effectiveDayPlan.id);
          void pushStateToServer({ routine: anchored });
          return anchored;
        });
      } else {
        // Synchronize the routine chronology so today is anchored to the loaded day
        setRoutine((prev) => {
          if (!prev) return prev;
          const anchored = anchorRoutineToDayForToday(prev, effectiveDayPlan.id);
          void pushStateToServer({ routine: anchored });
          return anchored;
        });
      }

      const blocks = buildWorkoutBlocksFromRoutineDay(
        effectiveDayPlan,
        catalog,
        sessions,
        profile
      );
      kairosAudio.playSetCheckFeedback();
      setTitleRequiredError(false);

      const nextWorkout: ActiveWorkoutDraft = {
        title: effectiveDayPlan.focusTitle || '',
        titlePlaceholder: `Ej: ${effectiveDayPlan.focusTitle}`,
        startedAtMs: Date.now(),
        notes: '',
        blocks,
        timerLogs: [],
      };
      setActiveWorkout(nextWorkout);
      void pushStateToServer({ activeWorkout: nextWorkout });
      setActiveTab('workout');
    },
    [catalog, profile, pushStateToServer, sessions]
  );

  const addRoutineExerciseToWorkout = useCallback(
    (prescription: RoutineExercisePrescription, dayFocusTitle?: string) => {
      const builtExercise = buildWorkoutExerciseFromPrescription(
        prescription,
        catalog,
        sessions,
        profile
      );
      kairosAudio.playSetCheckFeedback();

      setActiveWorkout((prev) => {
        const nextBlocks = [...prev.blocks];
        // Append to last block if same mode, or find existing block with same mode, or create one
        let targetIdx = -1;
        if (nextBlocks.length > 0 && nextBlocks[nextBlocks.length - 1].mode === prescription.mode) {
          targetIdx = nextBlocks.length - 1;
        } else {
          targetIdx = nextBlocks.findIndex((b) => b.mode === prescription.mode);
        }

        if (targetIdx >= 0) {
          const blk = nextBlocks[targetIdx];
          nextBlocks[targetIdx] = {
            ...blk,
            exercises: [...blk.exercises, builtExercise],
          };
        } else {
          nextBlocks.push({
            id: uid('blk'),
            mode: prescription.mode,
            cardioDiscipline:
              prescription.mode === 'cardio'
                ? builtExercise.cardioDiscipline ?? 'jumprope'
                : undefined,
            title:
              nextBlocks.length === 0 && dayFocusTitle
                ? dayFocusTitle
                : MODE_META[prescription.mode].label,
            exercises: [builtExercise],
          });
        }

        return {
          ...prev,
          titlePlaceholder:
            prev.titlePlaceholder || (dayFocusTitle ? `Ej: ${dayFocusTitle}` : prev.titlePlaceholder),
          blocks: nextBlocks,
        };
      });
    },
    [catalog, profile, sessions]
  );

  const adaptRoutineOnSkippedDay = useCallback(
    (mode: 'skip_today' | 'recover_yesterday', missedPlan?: RoutineDayPlan | null) => {
      setRoutine((prev) => {
        if (!prev) return prev;
        const adapted = adaptRoutineForSkippedDay(prev, mode, missedPlan);
        void pushStateToServer({ routine: adapted });
        return adapted;
      });
    },
    [pushStateToServer]
  );

  // ============================================================================
  // WORKOUT & ANALYTICS ACTIONS
  // ============================================================================

  const updateAudioSettings = useCallback((patch: Partial<AudioSettings>) => {
    setAudioSettings((prev) => {
      const next = { ...prev, ...patch };
      kairosAudio.updateSettings(next);
      return next;
    });
  }, []);

  const evaluations = useMemo(() => evaluateAllExercises(sessions), [sessions]);

  const resetSessionClock = useCallback(() => {
    setActiveWorkout((prev) => ({ ...prev, startedAtMs: Date.now() }));
  }, []);

  const clearTitleError = useCallback(() => {
    setTitleRequiredError(false);
  }, []);

  const updateWorkoutTitle = useCallback((title: string) => {
    if (title.trim().length > 0) {
      setTitleRequiredError(false);
    }
    setActiveWorkout((prev) => ({ ...prev, title }));
  }, []);

  const updateWorkoutNotes = useCallback((notes: string) => {
    setActiveWorkout((prev) => ({ ...prev, notes }));
  }, []);

  const addBlockToWorkout = useCallback(
    (mode: TrainingMode, cardioDiscipline: CardioDiscipline = 'jumprope') => {
      const disciplineLabel: Record<CardioDiscipline, string> = {
        jumprope: 'Cuerda',
        running: 'Running',
        swimming: 'Natación',
        cycling: 'Bici / Remo',
      };
      setActiveWorkout((prev) => {
        const suffix =
          mode === 'cardio' ? disciplineLabel[cardioDiscipline] : MODE_META[mode].label;
        const newBlock: WorkoutBlock = {
          id: uid('blk'),
          mode,
          cardioDiscipline: mode === 'cardio' ? cardioDiscipline : undefined,
          title: suffix,
          exercises: [],
        };
        return {
          ...prev,
          blocks: [...prev.blocks, newBlock],
        };
      });
    },
    []
  );

  const removeBlockFromWorkout = useCallback((blockId: string) => {
    setActiveWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== blockId),
    }));
  }, []);

  const updateBlockTitle = useCallback((blockId: string, title: string) => {
    setActiveWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, title } : b)),
    }));
  }, []);

  const updateBlockCardioDiscipline = useCallback(
    (blockId: string, discipline: CardioDiscipline) => {
      setActiveWorkout((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) =>
          b.id === blockId ? { ...b, cardioDiscipline: discipline } : b
        ),
      }));
    },
    []
  );

  const addExerciseToBlock = useCallback(
    (blockId: string, item: ExerciseCatalogItem) => {
      setActiveWorkout((prev) => ({
        ...prev,
        blocks: prev.blocks.map((blk) => {
          if (blk.id !== blockId) return blk;
          const entry = createDefaultExerciseEntry(
            item,
            blk.mode,
            sessions,
            blk.mode === 'cardio' ? item.cardioDiscipline ?? blk.cardioDiscipline : undefined,
            profile
          );
          return {
            ...blk,
            exercises: [...blk.exercises, entry],
          };
        }),
      }));
    },
    [profile, sessions]
  );

  const researchCustomExercise = useCallback(
    async (
      name: string,
      mode: TrainingMode = 'hypertrophy',
      catalogId?: string
    ): Promise<ExerciseDeepProfile> => {
      const cleanName = name.trim();
      const resolved = resolveExerciseIntelligently(cleanName, mode);
      const targetCatalogId = catalogId || resolved.canonicalCatalogId;
      const trackKey = targetCatalogId || cleanName.toLowerCase();

      setResearchingExercises((prev) => ({
        ...prev,
        [trackKey]: true,
        [cleanName.toLowerCase()]: true,
      }));

      let finalDeepProfile: ExerciseDeepProfile = {
        ...resolved.deepProfile,
        isAiResearched: true,
        researchedAt: new Date().toISOString(),
      };
      let finalMuscleGroup = resolved.muscleGroup;

      try {
        const resp = await fetch('/api/ai/research-exercise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exerciseName: cleanName, mode }),
        });
        if (resp.ok) {
          const json = (await resp.json()) as {
            ok?: boolean;
            deepProfile?: ExerciseDeepProfile;
            classification?: { muscleGroup?: string };
          };
          if (json.ok && json.deepProfile) {
            finalDeepProfile = json.deepProfile;
            if (json.classification?.muscleGroup) {
              finalMuscleGroup = json.classification.muscleGroup;
            }
          }
        }
      } catch {
        // Fallback to local scientific synthesis
      }

      // 1. Update customExercises catalog
      setCustomExercises((prev) =>
        prev.map((item) =>
          item.id === targetCatalogId || item.name.toLowerCase() === cleanName.toLowerCase()
            ? {
                ...item,
                muscleGroup: finalMuscleGroup || item.muscleGroup,
                biomechanicalCue: finalDeepProfile.biomechanicalCue,
                deepProfile: finalDeepProfile,
              }
            : item
        )
      );

      // 2. Update activeWorkout exercises
      setActiveWorkout((prev) => ({
        ...prev,
        blocks: prev.blocks.map((blk) => ({
          ...blk,
          exercises: blk.exercises.map((ex) =>
            ex.catalogId === targetCatalogId || ex.name.toLowerCase() === cleanName.toLowerCase()
              ? {
                  ...ex,
                  muscleGroup: finalMuscleGroup || ex.muscleGroup,
                  deepProfile: finalDeepProfile,
                }
              : ex
          ),
        })),
      }));

      // 3. Update routine exercises if present
      setRoutine((prev) => {
        if (!prev) return prev;
        let changed = false;
        const nextDays = prev.days.map((d) => ({
          ...d,
          exercises: d.exercises.map((rx) => {
            if (
              rx.catalogId === targetCatalogId ||
              rx.name.toLowerCase() === cleanName.toLowerCase()
            ) {
              changed = true;
              return {
                ...rx,
                muscleGroup: finalMuscleGroup || rx.muscleGroup,
                biomechanicalNote: finalDeepProfile.biomechanicalCue || rx.biomechanicalNote,
                deepProfile: finalDeepProfile,
              };
            }
            return rx;
          }),
        }));
        if (!changed) return prev;
        const updatedRoutine = { ...prev, days: nextDays };
        void pushStateToServer({ routine: updatedRoutine });
        return updatedRoutine;
      });

      setResearchingExercises((prev) => {
        const next = { ...prev };
        delete next[trackKey];
        delete next[cleanName.toLowerCase()];
        return next;
      });

      return finalDeepProfile;
    },
    [pushStateToServer]
  );

  const createAndAddCustomExercise = useCallback(
    (
      blockId: string,
      name: string,
      mode: TrainingMode,
      options?: {
        muscleGroup?: string;
        calisthenicsSubType?: CalisthenicsSubType;
        cardioDiscipline?: CardioDiscipline;
      }
    ) => {
      const cleanName = name.trim();
      if (!cleanName) return;

      const resolved = resolveExerciseIntelligently(cleanName, mode);

      const customItem: ExerciseCatalogItem = {
        id: resolved.canonicalCatalogId,
        name: resolved.canonicalName,
        mode: resolved.mode || mode,
        muscleGroup: options?.muscleGroup || resolved.muscleGroup,
        defaultRestSeconds: resolved.defaultRestSeconds || MODE_META[mode].defaultRest,
        biomechanicalCue: resolved.biomechanicalCue,
        deepProfile: resolved.deepProfile,
        calisthenicsSubType:
          mode === 'calisthenics' ? options?.calisthenicsSubType ?? 'dynamic' : undefined,
        cardioDiscipline:
          mode === 'cardio' ? options?.cardioDiscipline ?? 'jumprope' : undefined,
        isCustom: !resolved.isCanonicalMatch,
      };

      setCustomExercises((prev) => [
        customItem,
        ...prev.filter((p) => p.id !== customItem.id),
      ]);
      addExerciseToBlock(blockId, customItem);

      // If not in BUILTIN_EXERCISES, automatically launch deep recognition & research pipeline
      if (!resolved.isCanonicalMatch) {
        void researchCustomExercise(
          resolved.canonicalName,
          resolved.mode || mode,
          resolved.canonicalCatalogId
        );
      }
    },
    [addExerciseToBlock, researchCustomExercise]
  );

  const batchCalibrateExercises = useCallback(
    (
      calibrations: {
        exerciseId: string;
        catalogId: string;
        name: string;
        muscleGroup: string;
      }[]
    ) => {
      const map = new Map(calibrations.map((c) => [c.exerciseId, c]));
      setActiveWorkout((prev) => ({
        ...prev,
        blocks: prev.blocks.map((blk) => ({
          ...blk,
          exercises: blk.exercises.map((ex) => {
            const match = map.get(ex.id);
            if (!match) return ex;
            return {
              ...ex,
              catalogId: match.catalogId,
              name: match.name,
              muscleGroup: match.muscleGroup,
            };
          }),
        })),
      }));
    },
    []
  );

  const removeExerciseFromBlock = useCallback((blockId: string, exerciseId: string) => {
    setActiveWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((blk) =>
        blk.id === blockId
          ? { ...blk, exercises: blk.exercises.filter((e) => e.id !== exerciseId) }
          : blk
      ),
    }));
  }, []);

  const mutateExercise = useCallback(
    (
      blockId: string,
      exerciseId: string,
      updater: (ex: WorkoutExercise) => WorkoutExercise
    ) => {
      setActiveWorkout((prev) => ({
        ...prev,
        blocks: prev.blocks.map((blk) => {
          if (blk.id !== blockId) return blk;
          return {
            ...blk,
            exercises: blk.exercises.map((ex) => (ex.id === exerciseId ? updater(ex) : ex)),
          };
        }),
      }));
    },
    []
  );

  const removeTimerLog = useCallback((logId: string) => {
    setActiveWorkout((prev) => ({
      ...prev,
      timerLogs: (prev.timerLogs ?? []).filter((t) => t.id !== logId),
    }));
  }, []);

  const clearActiveWorkoutBlocks = useCallback(() => {
    setTitleRequiredError(false);
    setActiveWorkout(createEmptyWorkoutDraft());
  }, []);

  const finishAndAnalyzeWorkout = useCallback((): {
    ok: boolean;
    reason?: 'missing_title' | 'empty_blocks';
  } => {
    const cleanTitle =
      activeWorkout.title.trim() ||
      activeWorkout.titlePlaceholder?.replace(/^Ej:\s*/i, '').trim() ||
      'Entrenamiento del día';

    const validTimerLogs = (activeWorkout.timerLogs ?? []).filter((t) => t.kind !== 'rest');
    const nonEmptyBlocks = activeWorkout.blocks.filter((b) => b.exercises.length > 0);
    if (nonEmptyBlocks.length === 0 && validTimerLogs.length === 0) {
      return { ok: false, reason: 'empty_blocks' };
    }

    const now = Date.now();
    const durationSec = Math.max(60, Math.floor((now - activeWorkout.startedAtMs) / 1000));

    const finalizedBlocks: WorkoutBlock[] = nonEmptyBlocks.map((b) => ({
      ...b,
      exercises: b.exercises.map((ex) => ({
        ...ex,
        name: sanitizeExerciseName(ex.name),
        hypertrophySets: ex.hypertrophySets?.map((s) => ({ ...s, completed: true })),
        strengthSets: ex.strengthSets?.map((s) => ({ ...s, completed: true })),
        calisthenicsDynamicSets: ex.calisthenicsDynamicSets?.map((s) => ({
          ...s,
          completed: true,
        })),
        calisthenicsIsometricSets: ex.calisthenicsIsometricSets?.map((s) => ({
          ...s,
          completed: true,
        })),
        hyroxSets: ex.hyroxSets?.map((s) => ({ ...s, completed: true })),
        jumpRopeSets: ex.jumpRopeSets?.map((s) => ({ ...s, completed: true })),
        runningSets: ex.runningSets?.map((s) => ({ ...s, completed: true })),
        swimmingSets: ex.swimmingSets?.map((s) => ({ ...s, completed: true })),
        cyclingSets: ex.cyclingSets?.map((s) => ({ ...s, completed: true })),
      })),
    }));

    const completedSession: WorkoutSession = {
      id: uid('sess'),
      title: cleanTitle,
      dateIso: new Date(now).toISOString(),
      startedAtMs: activeWorkout.startedAtMs,
      durationSeconds: durationSec,
      notes: activeWorkout.notes.trim() || undefined,
      blocks: finalizedBlocks,
      timerLogs: validTimerLogs,
    };

    const nextSessions = [completedSession, ...sessions];
    setSessions(nextSessions);

    const report = buildSessionImpactReport(completedSession, nextSessions);
    setLatestImpactReport(report);
    setTitleRequiredError(false);
    kairosAudio.playCompletionCue('finish');

    const freshDraft = createEmptyWorkoutDraft(`Ej: ${cleanTitle}`);
    setActiveWorkout(freshDraft);

    void pushStateToServer({
      sessions: nextSessions,
      activeWorkout: freshDraft,
    });

    return { ok: true };
  }, [activeWorkout, pushStateToServer, sessions]);

  const dismissImpactReport = useCallback(() => {
    setLatestImpactReport(null);
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  const updateHistoricalSession = useCallback((updated: WorkoutSession) => {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const repeatSessionAsTemplate = useCallback((session: WorkoutSession) => {
    const clonedBlocks: WorkoutBlock[] = session.blocks.map((blk) => ({
      ...blk,
      id: uid('blk'),
      exercises: blk.exercises.map((ex) => ({
        ...ex,
        id: uid('ex'),
        hypertrophySets: ex.hypertrophySets?.map((s) => ({
          ...s,
          id: uid('hy'),
          completed: false,
        })),
        strengthSets: ex.strengthSets?.map((s) => ({
          ...s,
          id: uid('st'),
          completed: false,
        })),
        calisthenicsDynamicSets: ex.calisthenicsDynamicSets?.map((s) => ({
          ...s,
          id: uid('cd'),
          completed: false,
        })),
        calisthenicsIsometricSets: ex.calisthenicsIsometricSets?.map((s) => ({
          ...s,
          id: uid('ci'),
          completed: false,
        })),
        hyroxSets: ex.hyroxSets?.map((s) => ({
          ...s,
          id: uid('hx'),
          completed: false,
        })),
        jumpRopeSets: ex.jumpRopeSets?.map((s) => ({
          ...s,
          id: uid('jr'),
          completed: false,
        })),
        runningSets: ex.runningSets?.map((s) => ({
          ...s,
          id: uid('rn'),
          completed: false,
        })),
        swimmingSets: ex.swimmingSets?.map((s) => ({
          ...s,
          id: uid('sw'),
          completed: false,
        })),
        cyclingSets: ex.cyclingSets?.map((s) => ({
          ...s,
          id: uid('cy'),
          completed: false,
        })),
      })),
    }));

    setTitleRequiredError(false);
    setActiveWorkout({
      title: '',
      titlePlaceholder: `Ej: ${session.title}`,
      startedAtMs: Date.now(),
      notes: '',
      blocks: clonedBlocks,
      timerLogs: [],
    });
    setActiveTab('workout');
  }, []);

  const exportBackupJson = useCallback((): string => {
    const payload: KairosBackupPayload = {
      version: 2,
      exportedAtIso: new Date().toISOString(),
      profile,
      routine,
      sessions,
      customExercises,
      audioSettings,
    };
    return JSON.stringify(payload, null, 2);
  }, [audioSettings, customExercises, profile, routine, sessions]);

  const importBackupJson = useCallback(
    (jsonText: string): { ok: boolean; message: string } => {
      try {
        const parsed = JSON.parse(jsonText) as Partial<KairosBackupPayload>;
        if (!parsed || !Array.isArray(parsed.sessions)) {
          return { ok: false, message: 'Archivo JSON inválido.' };
        }
        setSessions(parsed.sessions);
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.routine) setRoutine(parsed.routine);
        if (Array.isArray(parsed.customExercises)) {
          setCustomExercises(parsed.customExercises);
        }
        if (parsed.audioSettings) {
          updateAudioSettings(parsed.audioSettings);
        }
        return {
          ok: true,
          message: `Respaldo restaurado (${parsed.sessions.length} sesiones).`,
        };
      } catch {
        return { ok: false, message: 'Error al leer el archivo.' };
      }
    },
    [updateAudioSettings]
  );

  const value = useMemo<KairosContextValue>(
    () => ({
      hydrated,
      user,
      profile,
      routine,
      registerUser,
      loginUser,
      recoverUserPassword,
      logoutUser,
      saveUserProfile,
      saveUserRoutine,
      completeOnboarding,
      loadRoutineDayIntoWorkout,
      setActiveRoutineDayForToday,
      populateEmptyRoutineDay,
      addRoutineExerciseToWorkout,
      adaptRoutineOnSkippedDay,
      openRoutineModal,
      setOpenRoutineModal,
      openRationaleModal,
      setOpenRationaleModal,
      activeTab,
      setActiveTab,
      sessions,
      evaluations,
      catalog,
      audioSettings,
      updateAudioSettings,
      activeWorkout,
      titleRequiredError,
      clearTitleError,
      sessionElapsedSeconds,
      resetSessionClock,
      updateWorkoutTitle,
      updateWorkoutNotes,
      addBlockToWorkout,
      removeBlockFromWorkout,
      updateBlockTitle,
      updateBlockCardioDiscipline,
      addExerciseToBlock,
      createAndAddCustomExercise,
      removeExerciseFromBlock,
      mutateExercise,
      batchCalibrateExercises,
      removeTimerLog,
      finishAndAnalyzeWorkout,
      clearActiveWorkoutBlocks,
      latestImpactReport,
      dismissImpactReport,
      deleteSession,
      updateHistoricalSession,
      repeatSessionAsTemplate,
      exportBackupJson,
      importBackupJson,
      researchingExercises,
      researchCustomExercise,
    }),
    [
      hydrated,
      user,
      profile,
      routine,
      registerUser,
      loginUser,
      recoverUserPassword,
      logoutUser,
      saveUserProfile,
      saveUserRoutine,
      completeOnboarding,
      loadRoutineDayIntoWorkout,
      setActiveRoutineDayForToday,
      populateEmptyRoutineDay,
      addRoutineExerciseToWorkout,
      adaptRoutineOnSkippedDay,
      openRoutineModal,
      openRationaleModal,
      activeTab,
      sessions,
      evaluations,
      catalog,
      audioSettings,
      updateAudioSettings,
      activeWorkout,
      titleRequiredError,
      clearTitleError,
      sessionElapsedSeconds,
      resetSessionClock,
      updateWorkoutTitle,
      updateWorkoutNotes,
      addBlockToWorkout,
      removeBlockFromWorkout,
      updateBlockTitle,
      updateBlockCardioDiscipline,
      addExerciseToBlock,
      createAndAddCustomExercise,
      removeExerciseFromBlock,
      mutateExercise,
      batchCalibrateExercises,
      removeTimerLog,
      finishAndAnalyzeWorkout,
      clearActiveWorkoutBlocks,
      latestImpactReport,
      dismissImpactReport,
      deleteSession,
      updateHistoricalSession,
      repeatSessionAsTemplate,
      exportBackupJson,
      importBackupJson,
      researchingExercises,
      researchCustomExercise,
    ]
  );

  return <KairosContext.Provider value={value}>{children}</KairosContext.Provider>;
}

export function useKairos(): KairosContextValue {
  const ctx = useContext(KairosContext);
  if (!ctx) {
    throw new Error('useKairos debe usarse dentro de KairosProvider');
  }
  return ctx;
}
