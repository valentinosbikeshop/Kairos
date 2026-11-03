import { BiologicalSex, UserProfile } from '@/types/kairos';
import { getProfileAge } from './formatters';

export type CardioZoneNumber = 1 | 2 | 3 | 4 | 5;

export interface CardioZone {
  zone: CardioZoneNumber;
  name: string;
  shortName: string;
  rangePct: string;
  minBpm: number;
  maxBpm: number;
  colorClass: string;
  borderClass: string;
  badgeBg: string;
  accentHex: string;
  metabolicTarget: string;
  perceivedEffort: string;
}

export interface CardioZonesProfile {
  maxHeartRate: number;
  restingHeartRate: number;
  method: 'tanaka' | 'karvonen';
  zones: Record<CardioZoneNumber, CardioZone>;
}

export interface HeartRateTelemetryReading {
  bpm: number;
  timestamp: number;
  zone: CardioZone;
  instantCaloriesPerMinute: number;
  sensorContact?: boolean;
  rrIntervalsMs?: number[];
  deviceName?: string;
}

export interface LiveWorkoutTelemetryState {
  currentBpm: number;
  currentZone: CardioZone | null;
  totalCaloriesBurned: number;
  elapsedSeconds: number;
  samplesCount: number;
  minBpm: number;
  maxBpm: number;
  avgBpm: number;
  secondsInZones: Record<CardioZoneNumber, number>;
}

/**
 * Fórmula de Tanaka et al. (2001) para Frecuencia Cardíaca Máxima (HRmax).
 * Validada clínicamente como superior a la tradicional "220 - edad".
 * HRmax = 208 - (0.7 * edad)
 */
export function calculateTanakaMaxHeartRate(age: number): number {
  const safeAge = Math.max(10, Math.min(100, age));
  return Math.round(208 - 0.7 * safeAge);
}

/**
 * Calcula las 5 fases cardiovasculares basadas en el método Tanaka o Karvonen (si se tiene FC reposo).
 */
export function calculateCardioZones(
  profileOrAge: UserProfile | number,
  restingHeartRate: number = 60
): CardioZonesProfile {
  const age =
    typeof profileOrAge === 'number'
      ? profileOrAge
      : (getProfileAge(profileOrAge) ?? 25);
  const maxHeartRate = calculateTanakaMaxHeartRate(age);
  const hrRest = Math.max(40, Math.min(100, restingHeartRate));

  // Umbrales porcentuales estándar ACSM / Inigo San Millán / Seiler:
  // Fase 1: 50% - 60%
  // Fase 2: 60% - 70%
  // Fase 3: 70% - 80%
  // Fase 4: 80% - 90%
  // Fase 5: 90% - 100%
  const getBpmForPct = (pct: number) => {
    // Si la FC en reposo es razonable, aplicamos la Reserva Cardíaca de Karvonen
    // HR = HRrest + pct * (HRmax - HRrest)
    const reserve = maxHeartRate - hrRest;
    if (reserve > 30) {
      return Math.round(hrRest + pct * reserve);
    }
    return Math.round(maxHeartRate * pct);
  };

  const zones: Record<CardioZoneNumber, CardioZone> = {
    1: {
      zone: 1,
      name: 'Fase 1 · Recuperación Activa',
      shortName: 'Fase 1',
      rangePct: '50% - 60%',
      minBpm: getBpmForPct(0.5),
      maxBpm: getBpmForPct(0.6) - 1,
      colorClass: 'text-sky-400',
      borderClass: 'border-sky-500/40',
      badgeBg: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
      accentHex: '#38bdf8',
      metabolicTarget: 'Regeneración tisular, circulación sanguínea y aclaramiento metabólico suave.',
      perceivedEffort: 'RPE 1-2 · Respiración nasal relajada, conversación sin interrupción.',
    },
    2: {
      zone: 2,
      name: 'Fase 2 · Base Aeróbica / Fat Burn',
      shortName: 'Fase 2',
      rangePct: '60% - 70%',
      minBpm: getBpmForPct(0.6),
      maxBpm: getBpmForPct(0.7) - 1,
      colorClass: 'text-emerald-400',
      borderClass: 'border-emerald-500/40',
      badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      accentHex: '#34d399',
      metabolicTarget: 'Máxima tasa de oxidación de ácidos grasos (FATmax) y biogénesis mitocondrial.',
      perceivedEffort: 'RPE 3-4 · Ritmo conversacional continuo; el estándar de oro para salud mitocondrial.',
    },
    3: {
      zone: 3,
      name: 'Fase 3 · Aeróbica / Tempo',
      shortName: 'Fase 3',
      rangePct: '70% - 80%',
      minBpm: getBpmForPct(0.7),
      maxBpm: getBpmForPct(0.8) - 1,
      colorClass: 'text-amber-400',
      borderClass: 'border-amber-500/40',
      badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      accentHex: '#fbbf24',
      metabolicTarget: 'Eficiencia cardiovascular, aumento del volumen sistólico y resistencia glucolítica.',
      perceivedEffort: 'RPE 5-6 · Conversación en frases cortas. Exige concentración mental sostenida.',
    },
    4: {
      zone: 4,
      name: 'Fase 4 · Umbral Anaeróbico / Lactato',
      shortName: 'Fase 4',
      rangePct: '80% - 90%',
      minBpm: getBpmForPct(0.8),
      maxBpm: getBpmForPct(0.9) - 1,
      colorClass: 'text-orange-400',
      borderClass: 'border-orange-500/40',
      badgeBg: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
      accentHex: '#fb923c',
      metabolicTarget: 'Tolerancia y reciclaje de iones de hidrógeno/lactato. Capacidad anaeróbica submáxima.',
      perceivedEffort: 'RPE 7-8 · Respiración forzada, solo monosílabos. Sostenible entre 10 y 30 min.',
    },
    5: {
      zone: 5,
      name: 'Fase 5 · Máximo Esfuerzo / VO2 Máx',
      shortName: 'Fase 5',
      rangePct: '90% - 100%',
      minBpm: getBpmForPct(0.9),
      maxBpm: maxHeartRate + 15,
      colorClass: 'text-rose-400',
      borderClass: 'border-rose-500/50',
      badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
      accentHex: '#f43f5e',
      metabolicTarget: 'Potencia neuromuscular máxima, saturación de VO2 máx y reclutamiento motor completo.',
      perceivedEffort: 'RPE 9-10 · Agotamiento rápido. Intervalos HIIT, sprints o rounds de máxima demanda.',
    },
  };

  return {
    maxHeartRate,
    restingHeartRate: hrRest,
    method: 'karvonen',
    zones,
  };
}

/**
 * Determina en qué fase cardiovascular se encuentra un pulso determinado.
 */
export function getZoneForHeartRate(bpm: number, zonesProfile: CardioZonesProfile): CardioZone {
  const { zones } = zonesProfile;
  if (bpm < zones[1].minBpm) {
    // Si está por debajo de la zona 1, cuenta como descanso/recuperación pasiva (asociado a Fase 1 con atenuación)
    return {
      ...zones[1],
      name: 'Bajo Umbral · Reposo / Recuperación',
      shortName: 'Reposo',
      rangePct: '< 50%',
      colorClass: 'text-zinc-400',
      borderClass: 'border-zinc-700',
      badgeBg: 'bg-zinc-800 text-zinc-300 border-zinc-700',
      accentHex: '#a1a1aa',
    };
  }
  if (bpm <= zones[1].maxBpm) return zones[1];
  if (bpm <= zones[2].maxBpm) return zones[2];
  if (bpm <= zones[3].maxBpm) return zones[3];
  if (bpm <= zones[4].maxBpm) return zones[4];
  return zones[5];
}

/**
 * Ecuación de Keytel et al. (2005) para estimación del gasto calórico (kJ/min -> kcal/min).
 * Validada por el Journal of Sports Sciences.
 *
 * Hombres:
 * EE = (-55.0969 + (0.6309 x HR) + (0.1988 x Peso) + (0.2017 x Edad)) / 4.184
 *
 * Mujeres:
 * EE = (-20.4022 + (0.4472 x HR) - (0.1263 x Peso) + (0.074 x Edad)) / 4.184
 */
export function calculateKeytelCaloriesPerMinute(params: {
  heartRate: number;
  weightKg: number;
  age: number;
  sex: BiologicalSex;
}): number {
  const { heartRate, weightKg, age, sex } = params;

  // Si el pulso está en reposo absoluto, aplicamos una tasa metabólica basal proporcional
  if (heartRate < 55) {
    // Tasa basal aproximada por minuto
    return (1.0 * weightKg) / 60;
  }

  let kcalPerMin = 0;
  if (sex === 'male') {
    const kjPerMin = -55.0969 + 0.6309 * heartRate + 0.1988 * weightKg + 0.2017 * age;
    kcalPerMin = kjPerMin / 4.184;
  } else {
    const kjPerMin = -20.4022 + 0.4472 * heartRate - 0.1263 * weightKg + 0.074 * age;
    kcalPerMin = kjPerMin / 4.184;
  }

  // Prevenir valores negativos o anómalos si la frecuencia es baja
  const restingMetFloor = (1.2 * weightKg) / 60;
  return Math.max(restingMetFloor, Math.max(0, kcalPerMin));
}

/**
 * Decodificador de paquete estándar Bluetooth SIG Heart Rate Measurement (GATT 0x2A37).
 * Soporta formato de 8 bits o 16 bits, estado de contacto de sensor y RR-Intervals.
 */
export function parseBluetoothHeartRatePacket(dataView: DataView): {
  bpm: number;
  sensorContact?: boolean;
  energyExpendedKcal?: number;
  rrIntervalsMs?: number[];
} {
  const flags = dataView.getUint8(0);
  const is16Bit = (flags & 0x01) !== 0;
  const contactDetected = (flags & 0x06) === 0x06;
  const energyExpendedPresent = (flags & 0x08) !== 0;
  const rrIntervalPresent = (flags & 0x10) !== 0;

  let offset = 1;
  let bpm: number;

  if (is16Bit) {
    bpm = dataView.getUint16(offset, true);
    offset += 2;
  } else {
    bpm = dataView.getUint8(offset);
    offset += 1;
  }

  let energyExpendedKcal: number | undefined;
  if (energyExpendedPresent && offset + 2 <= dataView.byteLength) {
    energyExpendedKcal = dataView.getUint16(offset, true);
    offset += 2;
  }

  const rrIntervalsMs: number[] = [];
  if (rrIntervalPresent) {
    while (offset + 2 <= dataView.byteLength) {
      const rrRaw = dataView.getUint16(offset, true);
      // El estándar BLE expresa RR-interval en 1/1024 segundos
      const rrMs = Math.round((rrRaw / 1024) * 1000);
      rrIntervalsMs.push(rrMs);
      offset += 2;
    }
  }

  return {
    bpm,
    sensorContact: contactDetected,
    energyExpendedKcal,
    rrIntervalsMs: rrIntervalsMs.length > 0 ? rrIntervalsMs : undefined,
  };
}
