import {
  AudioSettings,
  AuthenticatedUser,
  ExerciseCatalogItem,
  SessionTimerLog,
  UserProfile,
  UserRoutine,
  WorkoutBlock,
  WorkoutSession,
} from '@/types/kairos';

const AUTH_TOKEN_KEY = 'kairos_auth_token_v2';
const CACHED_USER_KEY = 'kairos_cached_user_v2';

export interface ActiveWorkoutDraft {
  title: string;
  titlePlaceholder?: string;
  customDateYmd?: string;
  startedAtMs: number;
  notes: string;
  blocks: WorkoutBlock[];
  timerLogs: SessionTimerLog[];
  firstExerciseAddedAtMs?: number;
  reminder105mSent?: boolean;
}

export interface PersistedUserDataSnapshot {
  user: AuthenticatedUser;
  profile: UserProfile | null;
  routine: UserRoutine | null;
  sessions: WorkoutSession[];
  customExercises: ExerciseCatalogItem[];
  audioSettings: AudioSettings;
  activeWorkout: ActiveWorkoutDraft | null;
}

export interface KairosBackupPayload {
  version: 2;
  exportedAtIso: string;
  profile?: UserProfile | null;
  routine?: UserRoutine | null;
  sessions: WorkoutSession[];
  customExercises: ExerciseCatalogItem[];
  audioSettings: AudioSettings;
}

function userKey(userId: string, suffix: string): string {
  return `kairos_u_${userId}_${suffix}`;
}

export function requestPersistentBrowserStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      void navigator.storage.persist();
    }
  } catch {
    // Ignore
  }
}

export function saveAuthTokenToStorage(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!token) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
  } catch {
    // Ignore
  }
}

export function loadAuthTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveCachedUserSnapshot(snapshot: PersistedUserDataSnapshot | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!snapshot) {
      window.localStorage.removeItem(CACHED_USER_KEY);
      return;
    }
    window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(snapshot.user));
    window.localStorage.setItem(
      userKey(snapshot.user.id, 'data'),
      JSON.stringify(snapshot)
    );
  } catch {
    // Ignore quota issues
  }
}

export function loadCachedUserSnapshot(): PersistedUserDataSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawUser = window.localStorage.getItem(CACHED_USER_KEY);
    if (!rawUser) return null;
    const user = JSON.parse(rawUser) as AuthenticatedUser;
    if (!user?.id) return null;
    const rawData = window.localStorage.getItem(userKey(user.id, 'data'));
    if (!rawData) return null;
    return JSON.parse(rawData) as PersistedUserDataSnapshot;
  } catch {
    return null;
  }
}

export const SESSION_REMINDER_THRESHOLD_MS = 105 * 60 * 1000; // 1 hr 45 min = 6,300,000 ms
export const SESSION_AUTOSAVE_THRESHOLD_MS = 135 * 60 * 1000; // 2 hr 15 min = 8,100,000 ms

/**
 * Calcula con precisión el momento en que se añade el primer ejercicio de la sesión.
 * Si no hay ejercicios resultantes, retorna undefined.
 * Si ya estaba fijado y se agregan más, conserva el timestamp original.
 */
export function computeFirstExerciseTimestamp(
  prevFirstAddedAtMs: number | undefined,
  currentTotalExercises: number,
  nextTotalExercises: number
): number | undefined {
  if (nextTotalExercises === 0) return undefined;
  if (currentTotalExercises === 0 && nextTotalExercises > 0) return Date.now();
  return prevFirstAddedAtMs || Date.now();
}

export function defaultAudioSettings(): AudioSettings {
  return {
    gainPercent: 110,
    profile: 'minimal',
    vibrationEnabled: true,
  };
}

export function createEmptyWorkoutDraft(placeholder?: string): ActiveWorkoutDraft {
  return {
    title: '',
    titlePlaceholder: placeholder || 'Ej: Torso Pesado — Semana 1',
    startedAtMs: Date.now(),
    notes: '',
    blocks: [],
    timerLogs: [],
    firstExerciseAddedAtMs: undefined,
    reminder105mSent: false,
  };
}
