import { CalisthenicsProgression, RirValue, TrainingMode } from '@/types/kairos';

export const MODE_META: Record<
  TrainingMode,
  {
    label: string;
    shortLabel: string;
    colorHex: string;
    badgeClass: string;
    borderClass: string;
    accentBarClass: string;
    textClass: string;
    bgSoftClass: string;
    description: string;
    defaultRest: number;
  }
> = {
  hypertrophy: {
    label: 'Hipertrofia',
    shortLabel: 'Hipertrofia',
    colorHex: '#959FA8',
    badgeClass: 'bg-elevated text-brand border-stoneborder',
    borderClass: 'border-stoneborder',
    accentBarClass: 'bg-mode-hypertrophy',
    textClass: 'text-mode-hypertrophy',
    bgSoftClass: 'bg-elevated/60',
    description: 'Desarrollo muscular y control técnico',
    defaultRest: 120,
  },
  strength: {
    label: 'Fuerza',
    shortLabel: 'Fuerza',
    colorHex: '#B5A082',
    badgeClass: 'bg-elevated text-mode-strength border-stoneborder',
    borderClass: 'border-stoneborder',
    accentBarClass: 'bg-mode-strength',
    textClass: 'text-mode-strength',
    bgSoftClass: 'bg-elevated/60',
    description: 'Cargas pesadas y bajas repeticiones',
    defaultRest: 210,
  },
  calisthenics: {
    label: 'Calistenia',
    shortLabel: 'Calistenia',
    colorHex: '#789483',
    badgeClass: 'bg-elevated text-mode-calisthenics border-stoneborder',
    borderClass: 'border-stoneborder',
    accentBarClass: 'bg-mode-calisthenics',
    textClass: 'text-mode-calisthenics',
    bgSoftClass: 'bg-elevated/60',
    description: 'Dominio corporal, lastre e isometría',
    defaultRest: 150,
  },
  hyrox: {
    label: 'Hyrox',
    shortLabel: 'Hyrox',
    colorHex: '#A67B60',
    badgeClass: 'bg-elevated text-mode-hyrox border-stoneborder',
    borderClass: 'border-stoneborder',
    accentBarClass: 'bg-mode-hyrox',
    textClass: 'text-mode-hyrox',
    bgSoftClass: 'bg-elevated/60',
    description: 'Estaciones híbridas y carrera',
    defaultRest: 60,
  },
  cardio: {
    label: 'Cardio',
    shortLabel: 'Cardio',
    colorHex: '#7B93A1',
    badgeClass: 'bg-elevated text-mode-cardio border-stoneborder',
    borderClass: 'border-stoneborder',
    accentBarClass: 'bg-mode-cardio',
    textClass: 'text-mode-cardio',
    bgSoftClass: 'bg-elevated/60',
    description: 'Cuerda, carrera, natación o bici',
    defaultRest: 60,
  },
};

export const LEVERAGE_FACTORS: Record<CalisthenicsProgression, number> = {
  Tuck: 1.0,
  'Advanced Tuck': 1.4,
  'One Leg': 1.7,
  Straddle: 2.0,
  'Half Lay': 2.5,
  Full: 3.0,
};

export function calculateE1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function calculatePercentOf1RM(weightKg: number, reference1RmKg: number): number {
  if (weightKg <= 0 || reference1RmKg <= 0) return 0;
  return Math.min(120, Math.round((weightKg / reference1RmKg) * 1000) / 10);
}

export function calculateJumpRopeRpm(jumps: number, durationSeconds: number): number {
  if (jumps <= 0 || durationSeconds <= 0) return 0;
  return Math.round((jumps / durationSeconds) * 60);
}

export function estimateJumpRopeKcal(jumps: number, durationSeconds: number): number {
  if (durationSeconds <= 0 || jumps <= 0) return 0;
  const rpm = calculateJumpRopeRpm(jumps, durationSeconds);
  const met = rpm >= 150 ? 12.3 : rpm >= 120 ? 11.0 : 9.2;
  const hours = durationSeconds / 3600;
  return Math.round(met * 75 * hours);
}

export function calculateRunningPaceSecPerKm(distanceMeters: number, durationSeconds: number): number {
  if (distanceMeters <= 0 || durationSeconds <= 0) return 0;
  return (durationSeconds / distanceMeters) * 1000;
}

export function calculateSpeedKmh(distanceMeters: number, durationSeconds: number): number {
  if (distanceMeters <= 0 || durationSeconds <= 0) return 0;
  const km = distanceMeters / 1000;
  const hours = durationSeconds / 3600;
  return Math.round((km / hours) * 10) / 10;
}

export function calculateSwimPaceSecPer100m(totalMeters: number, durationSeconds: number): number {
  if (totalMeters <= 0 || durationSeconds <= 0) return 0;
  return (durationSeconds / totalMeters) * 100;
}

export function calculateIsometricScore(
  seconds: number,
  progression: CalisthenicsProgression,
  addedWeightKg: number
): number {
  if (seconds <= 0) return 0;
  const factor = LEVERAGE_FACTORS[progression] ?? 1.0;
  const loadMultiplier = Math.max(0.5, 1 + addedWeightKg / 40);
  return Math.round(seconds * factor * loadMultiplier * 10) / 10;
}

export function isEffectiveRir(rir: RirValue): boolean {
  return rir === '0' || rir === '1' || rir === '2' || rir === '3';
}

export function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatHhMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatTimerMs(ms: number, showTenths = true): string {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const tenths = Math.floor((safeMs % 1000) / 100);
  const base = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return showTenths ? `${base}.${tenths}` : base;
}

export function parseMmSsInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const mins = parseInt(parts[0] || '0', 10) || 0;
    const secs = parseInt(parts[1] || '0', 10) || 0;
    return Math.max(0, mins * 60 + secs);
  }
  const num = parseFloat(trimmed);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}

export function formatShortDateEs(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

export function formatFullDateEs(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Calcula la edad exacta en años cumplidos a partir de una fecha YYYY-MM-DD.
 * Devuelve null si la fecha es inválida o futura.
 */
export function getAgeFromBirthDate(birthDate: string | undefined | null, now = new Date()): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split('-').map((v) => parseInt(v, 10));
  const birth = new Date(y, m - 1, d);
  if (
    Number.isNaN(birth.getTime()) ||
    birth.getFullYear() !== y ||
    birth.getMonth() !== m - 1 ||
    birth.getDate() !== d ||
    birth.getTime() > now.getTime()
  ) {
    return null;
  }
  let age = now.getFullYear() - y;
  const hadBirthdayThisYear =
    now.getMonth() > m - 1 || (now.getMonth() === m - 1 && now.getDate() >= d);
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

/** Edad vigente del perfil: usa la fecha de nacimiento si existe (se actualiza sola cada cumpleaños). */
export function getProfileAge(profile: { birthDate?: string; age?: number } | null | undefined): number | null {
  if (!profile) return null;
  const fromBirth = getAgeFromBirthDate(profile.birthDate);
  if (fromBirth !== null) return fromBirth;
  return typeof profile.age === 'number' && profile.age > 0 ? profile.age : null;
}

export function toLocalDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function uid(prefix = 'k'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}
