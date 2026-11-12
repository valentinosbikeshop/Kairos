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
  };
}
