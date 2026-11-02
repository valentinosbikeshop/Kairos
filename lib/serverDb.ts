import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AudioSettings,
  AuthenticatedUser,
  ExerciseCatalogItem,
  UserProfile,
  UserRoutine,
  WorkoutSession,
} from '@/types/kairos';
import { ActiveWorkoutDraft, createEmptyWorkoutDraft, defaultAudioSettings } from '@/lib/storage';

export interface StoredAccountRecord {
  id: string;
  username: string;
  displayName: string;
  passwordSalt: string;
  passwordHash: string;
  createdAtIso: string;
  onboardingCompleted: boolean;
  profile: UserProfile | null;
  routine: UserRoutine | null;
  sessions: WorkoutSession[];
  customExercises: ExerciseCatalogItem[];
  audioSettings: AudioSettings;
  activeWorkout: ActiveWorkoutDraft | null;
}

interface DatabaseFileSchema {
  version: 2;
  hmacSecret: string;
  users: StoredAccountRecord[];
}

export const SESSION_COOKIE_NAME = 'kairos_session_v2';

// Resolve writable database directory: on Vercel serverless /tmp is writable, locally process.cwd()/data
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV);
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'kairos-accounts.json');

// In-process async mutex for atomic file writes
let writeChain: Promise<void> = Promise.resolve();

// Cached Supabase client singleton
let supabaseClientInstance: SupabaseClient | null = null;
let supabaseChecked = false;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseChecked) return supabaseClientInstance;
  supabaseChecked = true;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key && url.startsWith('http')) {
    try {
      supabaseClientInstance = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return supabaseClientInstance;
    } catch {
      supabaseClientInstance = null;
    }
  }
  return null;
}

function getMasterSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  return 'kairos_prod_session_secret_high_security_2026_k9';
}

/**
 * Compacts sessions to occupy minimal storage footprint (strips verbose metadata,
 * removes intra-workout rest timers, and clamps decimals).
 */
export function compactSessionForStorage(session: WorkoutSession): WorkoutSession {
  return {
    id: session.id,
    title: (session.title || '').trim().slice(0, 100),
    dateIso: session.dateIso,
    startedAtMs: session.startedAtMs || Date.now(),
    durationSeconds: Math.round(session.durationSeconds || 0),
    notes: session.notes ? session.notes.trim().slice(0, 300) : undefined,
    blocks: (session.blocks || []).map((b) => ({
      id: b.id,
      title: (b.title || '').trim().slice(0, 60),
      mode: b.mode,
      cardioDiscipline: b.cardioDiscipline,
      exercises: (b.exercises || []).map((ex) => ({
        id: ex.id,
        catalogId: ex.catalogId,
        name: (ex.name || '').trim().slice(0, 80),
        mode: ex.mode,
        muscleGroup: ex.muscleGroup || 'General',
        defaultRestSeconds: ex.defaultRestSeconds ?? 90,
        cardioDiscipline: ex.cardioDiscipline,
        calisthenicsSubType: ex.calisthenicsSubType,
        notes: ex.notes ? ex.notes.trim().slice(0, 200) : undefined,
        referenceOneRmKg: ex.referenceOneRmKg ? Math.round(ex.referenceOneRmKg * 10) / 10 : undefined,
        hypertrophySets: ex.hypertrophySets?.map((s) => ({
          id: s.id,
          weightKg: Math.round(s.weightKg * 100) / 100,
          reps: s.reps,
          rir: s.rir,
          setType: s.setType,
          restSeconds: s.restSeconds,
          completed: s.completed,
        })),
        strengthSets: ex.strengthSets?.map((s) => ({
          id: s.id,
          weightKg: Math.round(s.weightKg * 100) / 100,
          reps: s.reps,
          rpe: s.rpe,
          restSeconds: s.restSeconds,
          completed: s.completed,
        })),
        calisthenicsDynamicSets: ex.calisthenicsDynamicSets?.map((s) => ({
          id: s.id,
          variation: s.variation,
          addedWeightKg: Math.round(s.addedWeightKg * 100) / 100,
          reps: s.reps,
          rir: s.rir,
          restSeconds: s.restSeconds,
          completed: s.completed,
        })),
        calisthenicsIsometricSets: ex.calisthenicsIsometricSets?.map((s) => ({
          id: s.id,
          progression: s.progression,
          targetSeconds: s.targetSeconds,
          actualSeconds: s.actualSeconds,
          addedWeightKg: Math.round(s.addedWeightKg * 100) / 100,
          restSeconds: s.restSeconds,
          completed: s.completed,
        })),
        hyroxSets: ex.hyroxSets?.map((s) => ({
          id: s.id,
          station: s.station,
          distanceMeters: s.distanceMeters,
          reps: s.reps,
          implementWeightKg: s.implementWeightKg,
          splitSeconds: s.splitSeconds,
          roxzoneSeconds: s.roxzoneSeconds,
          completed: s.completed,
        })),
        jumpRopeSets: ex.jumpRopeSets?.map((s) => ({
          id: s.id,
          durationSeconds: s.durationSeconds,
          jumps: s.jumps,
          misses: s.misses,
          style: s.style,
          restSeconds: s.restSeconds,
          completed: s.completed,
        })),
        runningSets: ex.runningSets?.map((s) => ({
          id: s.id,
          durationSeconds: s.durationSeconds,
          distanceMeters: s.distanceMeters,
          inclinePercent: s.inclinePercent,
          runType: s.runType,
          restSeconds: s.restSeconds,
          completed: s.completed,
        })),
        swimmingSets: ex.swimmingSets?.map((s) => ({
          id: s.id,
          poolLengthMeters: s.poolLengthMeters,
          laps: s.laps,
          stroke: s.stroke,
          durationSeconds: s.durationSeconds,
          restSeconds: s.restSeconds,
          completed: s.completed,
        })),
        cyclingSets: ex.cyclingSets?.map((s) => ({
          id: s.id,
          durationSeconds: s.durationSeconds,
          distanceMeters: s.distanceMeters,
          avgWatts: s.avgWatts,
          cadenceRpm: s.cadenceRpm,
          restSeconds: s.restSeconds,
          completed: s.completed,
        })),
      })),
    })),
    timerLogs: (session.timerLogs || [])
      .filter((t) => t.kind !== 'rest')
      .map((t) => ({
        id: t.id,
        kind: t.kind,
        label: t.label,
        recordedAtIso: t.recordedAtIso || new Date().toISOString(),
        plannedSeconds: t.plannedSeconds,
        elapsedSeconds: t.elapsedSeconds,
        workSecondsCompleted: t.workSecondsCompleted,
        roundsCompleted: t.roundsCompleted,
        totalRounds: t.totalRounds,
        endedReason: t.endedReason,
      })),
  };
}

// ==============================================================================
// LOCAL JSON FILE ADAPTER (Resilient fallback for local dev / zero-config offline)
// ==============================================================================

async function ensureLocalDbLoaded(): Promise<DatabaseFileSchema> {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DatabaseFileSchema>;
    if (parsed && Array.isArray(parsed.users)) {
      return {
        version: 2,
        hmacSecret: parsed.hmacSecret || getMasterSecret(),
        users: parsed.users,
      };
    }
  } catch {
    // Fresh DB creation
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const fresh: DatabaseFileSchema = {
      version: 2,
      hmacSecret: getMasterSecret(),
      users: [],
    };
    await fs.writeFile(DB_FILE, JSON.stringify(fresh, null, 2), 'utf-8');
    return fresh;
  } catch {
    return {
      version: 2,
      hmacSecret: getMasterSecret(),
      users: [],
    };
  }
}

async function saveLocalDbAtomic(db: DatabaseFileSchema): Promise<void> {
  const nextWrite = writeChain.then(async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
      await fs.rename(tmpFile, DB_FILE);
    } catch {
      // Ignore in read-only environments
    }
  });
  writeChain = nextWrite.catch(() => {});
  await nextWrite;
}

// ==============================================================================
// PASSWORD SECURITY & TOKENS (Cryptographically secure scrypt + HMAC-SHA256)
// ==============================================================================

function hashPassword(password: string, saltHex: string): string {
  return crypto.scryptSync(password, saltHex, 64).toString('hex');
}

function verifyPassword(password: string, saltHex: string, expectedHashHex: string): boolean {
  try {
    const computed = Buffer.from(hashPassword(password, saltHex), 'hex');
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (computed.length !== expected.length) return false;
    return crypto.timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

export function sanitizePublicUser(record: StoredAccountRecord): AuthenticatedUser {
  return {
    id: record.id,
    username: record.username,
    displayName: record.displayName,
    createdAtIso: record.createdAtIso,
    onboardingCompleted: Boolean(record.onboardingCompleted),
  };
}

export function extractPublicSnapshot(record: StoredAccountRecord) {
  return {
    user: sanitizePublicUser(record),
    profile: record.profile ?? null,
    routine: record.routine ?? null,
    sessions: Array.isArray(record.sessions) ? record.sessions : [],
    customExercises: Array.isArray(record.customExercises) ? record.customExercises : [],
    audioSettings: record.audioSettings ?? defaultAudioSettings(),
    activeWorkout: record.activeWorkout ?? createEmptyWorkoutDraft(),
  };
}

export async function createSignedToken(userId: string): Promise<string> {
  const secret = getMasterSecret();
  const issuedAt = Date.now().toString(36);
  const payload = `${userId}.${issuedAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export async function verifySignedToken(token: string | null | undefined): Promise<string | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, issuedAt, providedSig] = parts;
  const secret = getMasterSecret();
  const payload = `${userId}.${issuedAt}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const user = await getUserRecordById(userId);
  return user ? user.id : null;
}

// ==============================================================================
// CORE MULTI-USER CRUD OPERATIONS (Supabase Cloud DB + Local Fallback)
// ==============================================================================

export async function registerAccount(input: {
  username: string;
  displayName: string;
  password: string;
}): Promise<{ ok: true; record: StoredAccountRecord } | { ok: false; error: string }> {
  const cleanUsername = input.username.trim().toLowerCase();
  const cleanName = input.displayName.trim() || input.username.trim();
  const password = input.password;

  if (cleanUsername.length < 3) {
    return { ok: false, error: 'El usuario o correo debe tener al menos 3 caracteres.' };
  }
  if (password.length < 4) {
    return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  const newRecord: StoredAccountRecord = {
    id: `usr_${crypto.randomBytes(8).toString('hex')}`,
    username: cleanUsername,
    displayName: cleanName,
    passwordSalt: salt,
    passwordHash: hash,
    createdAtIso: new Date().toISOString(),
    onboardingCompleted: false,
    profile: null,
    routine: null,
    sessions: [],
    customExercises: [],
    audioSettings: defaultAudioSettings(),
    activeWorkout: createEmptyWorkoutDraft(),
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // 1. Check if user already exists
      const { data: existing } = await supabase
        .from('kairos_users')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existing) {
        return { ok: false, error: 'Ese usuario ya existe. Inicia sesión con tu contraseña.' };
      }

      // 2. Insert into Supabase table
      const { error: insertError } = await supabase.from('kairos_users').insert({
        id: newRecord.id,
        username: newRecord.username,
        display_name: newRecord.displayName,
        password_salt: newRecord.passwordSalt,
        password_hash: newRecord.passwordHash,
        created_at: newRecord.createdAtIso,
        onboarding_completed: false,
        profile: null,
        routine: null,
        sessions: [],
        custom_exercises: [],
        audio_settings: newRecord.audioSettings,
        active_workout: newRecord.activeWorkout,
      });

      if (insertError) {
        console.error('[Supabase Register Error]:', insertError);
        return { ok: false, error: 'Error al registrar la cuenta en la nube. Intenta de nuevo.' };
      }

      return { ok: true, record: newRecord };
    } catch (err) {
      console.error('[Supabase Register Exception]:', err);
      // Fall through to local fallback below
    }
  }

  // Local JSON File fallback
  const db = await ensureLocalDbLoaded();
  if (db.users.some((u) => u.username === cleanUsername)) {
    return { ok: false, error: 'Ese usuario ya existe. Inicia sesión con tu contraseña.' };
  }

  db.users.push(newRecord);
  await saveLocalDbAtomic(db);
  return { ok: true, record: newRecord };
}

export async function authenticateAccount(input: {
  username: string;
  password: string;
}): Promise<{ ok: true; record: StoredAccountRecord } | { ok: false; error: string }> {
  const cleanUsername = input.username.trim().toLowerCase();

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('kairos_users')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (!error && data) {
        const record: StoredAccountRecord = {
          id: data.id,
          username: data.username,
          displayName: data.display_name,
          passwordSalt: data.password_salt,
          passwordHash: data.password_hash,
          createdAtIso: data.created_at,
          onboardingCompleted: Boolean(data.onboarding_completed),
          profile: data.profile ?? null,
          routine: data.routine ?? null,
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          customExercises: Array.isArray(data.custom_exercises) ? data.custom_exercises : [],
          audioSettings: data.audio_settings ?? defaultAudioSettings(),
          activeWorkout: data.active_workout ?? createEmptyWorkoutDraft(),
        };

        if (verifyPassword(input.password, record.passwordSalt, record.passwordHash)) {
          return { ok: true, record };
        }
        return { ok: false, error: 'Usuario o contraseña incorrectos.' };
      }
    } catch (err) {
      console.error('[Supabase Auth Exception]:', err);
    }
  }

  // Local JSON fallback
  const db = await ensureLocalDbLoaded();
  const record = db.users.find((u) => u.username === cleanUsername);
  if (!record || !verifyPassword(input.password, record.passwordSalt, record.passwordHash)) {
    return { ok: false, error: 'Usuario o contraseña incorrectos.' };
  }
  return { ok: true, record };
}

export async function getUserRecordById(userId: string): Promise<StoredAccountRecord | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('kairos_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          username: data.username,
          displayName: data.display_name,
          passwordSalt: data.password_salt,
          passwordHash: data.password_hash,
          createdAtIso: data.created_at,
          onboardingCompleted: Boolean(data.onboarding_completed),
          profile: data.profile ?? null,
          routine: data.routine ?? null,
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          customExercises: Array.isArray(data.custom_exercises) ? data.custom_exercises : [],
          audioSettings: data.audio_settings ?? defaultAudioSettings(),
          activeWorkout: data.active_workout ?? createEmptyWorkoutDraft(),
        };
      }
    } catch {
      // Fall through to local
    }
  }

  const db = await ensureLocalDbLoaded();
  return db.users.find((u) => u.id === userId) ?? null;
}

export async function updateUserStateById(
  userId: string,
  patch: Partial<{
    displayName: string;
    onboardingCompleted: boolean;
    profile: UserProfile | null;
    routine: UserRoutine | null;
    sessions: WorkoutSession[];
    customExercises: ExerciseCatalogItem[];
    audioSettings: AudioSettings;
    activeWorkout: ActiveWorkoutDraft | null;
  }>
): Promise<StoredAccountRecord | null> {
  // Compact sessions to minimize database storage consumption
  const compactedSessions = Array.isArray(patch.sessions)
    ? patch.sessions.map(compactSessionForStorage)
    : undefined;

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const updatePayload: Record<string, unknown> = {};
      if (typeof patch.displayName === 'string' && patch.displayName.trim()) {
        updatePayload.display_name = patch.displayName.trim();
      }
      if (typeof patch.onboardingCompleted === 'boolean') {
        updatePayload.onboarding_completed = patch.onboardingCompleted;
      }
      if (patch.profile !== undefined) updatePayload.profile = patch.profile;
      if (patch.routine !== undefined) updatePayload.routine = patch.routine;
      if (compactedSessions !== undefined) updatePayload.sessions = compactedSessions;
      if (patch.customExercises !== undefined) updatePayload.custom_exercises = patch.customExercises;
      if (patch.audioSettings !== undefined) updatePayload.audio_settings = patch.audioSettings;
      if (patch.activeWorkout !== undefined) updatePayload.active_workout = patch.activeWorkout;

      const { data, error } = await supabase
        .from('kairos_users')
        .update(updatePayload)
        .eq('id', userId)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          username: data.username,
          displayName: data.display_name,
          passwordSalt: data.password_salt,
          passwordHash: data.password_hash,
          createdAtIso: data.created_at,
          onboardingCompleted: Boolean(data.onboarding_completed),
          profile: data.profile ?? null,
          routine: data.routine ?? null,
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          customExercises: Array.isArray(data.custom_exercises) ? data.custom_exercises : [],
          audioSettings: data.audio_settings ?? defaultAudioSettings(),
          activeWorkout: data.active_workout ?? createEmptyWorkoutDraft(),
        };
      }
    } catch (err) {
      console.error('[Supabase Update Exception]:', err);
    }
  }

  // Local JSON fallback
  const db = await ensureLocalDbLoaded();
  const idx = db.users.findIndex((u) => u.id === userId);
  if (idx < 0) return null;

  const current = db.users[idx];
  const updated: StoredAccountRecord = {
    ...current,
    displayName:
      typeof patch.displayName === 'string' && patch.displayName.trim()
        ? patch.displayName.trim()
        : current.displayName,
    onboardingCompleted:
      typeof patch.onboardingCompleted === 'boolean'
        ? patch.onboardingCompleted
        : current.onboardingCompleted,
    profile: patch.profile !== undefined ? patch.profile : current.profile,
    routine: patch.routine !== undefined ? patch.routine : current.routine,
    sessions: compactedSessions !== undefined ? compactedSessions : current.sessions,
    customExercises: Array.isArray(patch.customExercises)
      ? patch.customExercises
      : current.customExercises,
    audioSettings: patch.audioSettings !== undefined ? patch.audioSettings : current.audioSettings,
    activeWorkout: patch.activeWorkout !== undefined ? patch.activeWorkout : current.activeWorkout,
  };

  db.users[idx] = updated;
  await saveLocalDbAtomic(db);
  return updated;
}
