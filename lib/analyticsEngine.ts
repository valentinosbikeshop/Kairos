import {
  ExerciseEvaluation,
  ExerciseHistoryPoint,
  HyroxStationName,
  ProgressStatus,
  SessionImpactReport,
  WorkoutBlock,
  WorkoutExercise,
  WorkoutSession,
} from '@/types/kairos';
import {
  calculateE1RM,
  calculateIsometricScore,
  calculateJumpRopeRpm,
  calculateRunningPaceSecPerKm,
  calculateSwimPaceSecPer100m,
  formatMmSs,
  formatShortDateEs,
  isEffectiveRir,
} from '@/lib/formatters';

// Competitive Pro/Open hybrid reference split benchmarks (seconds) for bottleneck detection
const HYROX_REFERENCE_SPLITS_SEC: Record<HyroxStationName, number> = {
  '1000m Run': 245,
  SkiErg: 245,
  'Sled Push': 165,
  'Sled Pull': 210,
  'Burpee Broad Jumps': 230,
  Rowing: 245,
  'Farmers Carry': 125,
  'Sandbag Lunges': 235,
  'Wall Balls': 250,
};

interface ExtractedPoint extends ExerciseHistoryPoint {
  effortScore: number; // higher = harder effort (e.g., RPE 9.5 or 10 - RIR)
}

function extractExerciseMetricPoint(
  session: WorkoutSession,
  ex: WorkoutExercise
): ExtractedPoint | null {
  const dateLabel = formatShortDateEs(session.dateIso);

  if (ex.mode === 'hypertrophy' && ex.hypertrophySets?.length) {
    const workingSets = ex.hypertrophySets.filter((s) => s.setType !== 'Calentamiento' && s.reps > 0);
    const pool = workingSets.length ? workingSets : ex.hypertrophySets.filter((s) => s.reps > 0);
    if (!pool.length) return null;

    let bestE1rm = 0;
    let bestSummary = '';
    let effectiveVolume = 0;
    let effortAcc = 0;

    pool.forEach((s) => {
      const e1rm = calculateE1RM(s.weightKg, s.reps);
      if (e1rm > bestE1rm) {
        bestE1rm = e1rm;
        bestSummary = `${s.weightKg}kg × ${s.reps} @ RIR ${s.rir}`;
      }
      if (isEffectiveRir(s.rir)) {
        effectiveVolume += s.weightKg * s.reps;
      }
      const numericRir = s.rir === '4+' ? 4 : parseInt(s.rir, 10);
      effortAcc += 10 - numericRir;
    });

    return {
      sessionId: session.id,
      dateIso: session.dateIso,
      dateLabel,
      primaryMetric: Math.round(bestE1rm * 10) / 10,
      secondaryMetric: Math.round(effectiveVolume),
      primaryUnit: 'kg E1RM',
      secondaryUnit: 'kg Vol',
      summaryText: bestSummary,
      effortScore: effortAcc / pool.length,
    };
  }

  if (ex.mode === 'strength' && ex.strengthSets?.length) {
    const valid = ex.strengthSets.filter((s) => s.reps > 0 && s.weightKg > 0);
    if (!valid.length) return null;

    let bestE1rm = 0;
    let bestSummary = '';
    let tonnage = 0;
    let rpeSum = 0;

    valid.forEach((s) => {
      const e1rm = calculateE1RM(s.weightKg, s.reps);
      if (e1rm > bestE1rm) {
        bestE1rm = e1rm;
        bestSummary = `${s.weightKg}kg × ${s.reps} @ RPE ${s.rpe}`;
      }
      if (s.rpe >= 7) {
        tonnage += s.weightKg * s.reps;
      }
      rpeSum += s.rpe;
    });

    return {
      sessionId: session.id,
      dateIso: session.dateIso,
      dateLabel,
      primaryMetric: Math.round(bestE1rm * 10) / 10,
      secondaryMetric: Math.round(tonnage),
      primaryUnit: 'kg E1RM',
      secondaryUnit: 'kg Ton',
      summaryText: bestSummary,
      effortScore: rpeSum / valid.length,
    };
  }

  if (ex.mode === 'calisthenics') {
    if (ex.calisthenicsSubType === 'isometric' && ex.calisthenicsIsometricSets?.length) {
      const valid = ex.calisthenicsIsometricSets.filter((s) => s.actualSeconds > 0);
      if (!valid.length) return null;

      let totalWeightedScore = 0;
      let totalHoldSec = 0;
      let bestSet = valid[0];

      valid.forEach((s) => {
        const score = calculateIsometricScore(s.actualSeconds, s.progression, s.addedWeightKg);
        totalWeightedScore += score;
        totalHoldSec += s.actualSeconds;
        if (
          calculateIsometricScore(s.actualSeconds, s.progression, s.addedWeightKg) >
          calculateIsometricScore(bestSet.actualSeconds, bestSet.progression, bestSet.addedWeightKg)
        ) {
          bestSet = s;
        }
      });

      return {
        sessionId: session.id,
        dateIso: session.dateIso,
        dateLabel,
        primaryMetric: Math.round(totalWeightedScore * 10) / 10,
        secondaryMetric: totalHoldSec,
        primaryUnit: 'pts TUT',
        secondaryUnit: 's totales',
        summaryText: `${bestSet.progression} · ${bestSet.actualSeconds}s${bestSet.addedWeightKg ? ` (+${bestSet.addedWeightKg}kg)` : ''}`,
        effortScore: 8.5,
      };
    }

    if (ex.calisthenicsDynamicSets?.length) {
      const valid = ex.calisthenicsDynamicSets.filter((s) => s.reps > 0);
      if (!valid.length) return null;

      let bestRelE1rm = 0;
      let totalReps = 0;
      let bestSummary = '';

      valid.forEach((s) => {
        const effectiveLoad = Math.max(30, 75 + s.addedWeightKg);
        const e1rm = calculateE1RM(effectiveLoad, s.reps);
        totalReps += s.reps;
        if (e1rm > bestRelE1rm) {
          bestRelE1rm = e1rm;
          bestSummary = `${s.variation} ${s.addedWeightKg > 0 ? `+${s.addedWeightKg}kg ` : ''}× ${s.reps}`;
        }
      });

      return {
        sessionId: session.id,
        dateIso: session.dateIso,
        dateLabel,
        primaryMetric: Math.round(bestRelE1rm * 10) / 10,
        secondaryMetric: totalReps,
        primaryUnit: 'kg E1RM Rel',
        secondaryUnit: 'reps',
        summaryText: bestSummary,
        effortScore: 8.5,
      };
    }
  }

  if (ex.mode === 'hyrox' && ex.hyroxSets?.length) {
    const valid = ex.hyroxSets.filter((s) => s.splitSeconds > 0);
    if (!valid.length) return null;

    const avgSplit =
      valid.reduce((acc, s) => acc + s.splitSeconds, 0) / valid.length;
    const totalRoxzone = valid.reduce((acc, s) => acc + s.roxzoneSeconds, 0);
    const first = valid[0];

    return {
      sessionId: session.id,
      dateIso: session.dateIso,
      dateLabel,
      primaryMetric: Math.round(avgSplit),
      secondaryMetric: Math.round(totalRoxzone),
      primaryUnit: 'seg Split',
      secondaryUnit: 's Roxzone',
      summaryText: `${first.station}: ${formatMmSs(avgSplit)}`,
      isLowerBetter: true,
      effortScore: 9.0,
    };
  }

  if (ex.mode === 'cardio') {
    if (ex.cardioDiscipline === 'jumprope' && ex.jumpRopeSets?.length) {
      const valid = ex.jumpRopeSets.filter((s) => s.jumps > 0 && s.durationSeconds > 0);
      if (!valid.length) return null;

      const totalJumps = valid.reduce((acc, s) => acc + s.jumps, 0);
      const totalSeconds = valid.reduce((acc, s) => acc + s.durationSeconds, 0);
      const meanRpm = calculateJumpRopeRpm(totalJumps, totalSeconds);

      return {
        sessionId: session.id,
        dateIso: session.dateIso,
        dateLabel,
        primaryMetric: meanRpm,
        secondaryMetric: totalJumps,
        primaryUnit: 'RPM',
        secondaryUnit: 'saltos',
        summaryText: `${totalJumps} saltos @ ${meanRpm} RPM`,
        effortScore: 8.0,
      };
    }

    if (ex.cardioDiscipline === 'running' && ex.runningSets?.length) {
      const valid = ex.runningSets.filter((s) => s.distanceMeters > 0 && s.durationSeconds > 0);
      if (!valid.length) return null;

      const totalDist = valid.reduce((acc, s) => acc + s.distanceMeters, 0);
      const totalSec = valid.reduce((acc, s) => acc + s.durationSeconds, 0);
      const paceSecKm = Math.round(calculateRunningPaceSecPerKm(totalDist, totalSec));

      return {
        sessionId: session.id,
        dateIso: session.dateIso,
        dateLabel,
        primaryMetric: paceSecKm,
        secondaryMetric: totalDist,
        primaryUnit: 's/km',
        secondaryUnit: 'm',
        summaryText: `${(totalDist / 1000).toFixed(2)}km @ ${formatMmSs(paceSecKm)}/km`,
        isLowerBetter: true,
        effortScore: 8.0,
      };
    }

    if (ex.cardioDiscipline === 'swimming' && ex.swimmingSets?.length) {
      const valid = ex.swimmingSets.filter((s) => s.laps > 0 && s.durationSeconds > 0);
      if (!valid.length) return null;

      const totalMeters = valid.reduce((acc, s) => acc + s.poolLengthMeters * s.laps, 0);
      const totalSec = valid.reduce((acc, s) => acc + s.durationSeconds, 0);
      const pace100 = Math.round(calculateSwimPaceSecPer100m(totalMeters, totalSec));

      return {
        sessionId: session.id,
        dateIso: session.dateIso,
        dateLabel,
        primaryMetric: pace100,
        secondaryMetric: totalMeters,
        primaryUnit: 's/100m',
        secondaryUnit: 'm',
        summaryText: `${totalMeters}m @ ${formatMmSs(pace100)}/100m`,
        isLowerBetter: true,
        effortScore: 8.0,
      };
    }

    if (ex.cardioDiscipline === 'cycling' && ex.cyclingSets?.length) {
      const valid = ex.cyclingSets.filter((s) => s.durationSeconds > 0);
      if (!valid.length) return null;

      const meanWatts = Math.round(
        valid.reduce((acc, s) => acc + s.avgWatts, 0) / valid.length
      );
      const totalMeters = valid.reduce((acc, s) => acc + s.distanceMeters, 0);

      return {
        sessionId: session.id,
        dateIso: session.dateIso,
        dateLabel,
        primaryMetric: meanWatts,
        secondaryMetric: totalMeters,
        primaryUnit: 'Watts',
        secondaryUnit: 'm',
        summaryText: `${meanWatts}W medios · ${(totalMeters / 1000).toFixed(1)}km`,
        effortScore: 8.0,
      };
    }
  }

  return null;
}

function formatMetricDisplay(point: ExerciseHistoryPoint): string {
  if (point.primaryUnit === 's/km') {
    return `${formatMmSs(point.primaryMetric)}/km`;
  }
  if (point.primaryUnit === 's/100m') {
    return `${formatMmSs(point.primaryMetric)}/100m`;
  }
  if (point.primaryUnit === 'seg Split') {
    return formatMmSs(point.primaryMetric);
  }
  return `${point.primaryMetric} ${point.primaryUnit}`;
}

function buildRegressionDiagnosis(
  ex: WorkoutExercise,
  deltaPercent: number
): { title: string; body: string; recommendation: string } {
  const absDrop = Math.abs(deltaPercent).toFixed(1);

  if (ex.mode === 'strength' || ex.mode === 'hypertrophy') {
    return {
      title: `Caída aguda de rendimiento (-${absDrop}%) a alto esfuerzo percibido`,
      body: 'Caída de fuerza detectada a alto esfuerzo percibido (RPE ≥ 9 / RIR 0). Posible fatiga acumulada del Sistema Nervioso Central (SNC), descanso insuficiente entre series (<120s) o déficit de glucógeno intramuscular e hidratación.',
      recommendation:
        'Añade +60s a tu timer de descanso para completar la resíntesis de ATP-PCr o aplica una serie de descarga (Back-off set al -15% de carga manteniendo RIR 2).',
    };
  }

  if (ex.mode === 'calisthenics') {
    return {
      title: `Pérdida de tiempo bajo tensión / palanca (-${absDrop}%)`,
      body: 'Fatiga neuromuscular en estabilizadores escapulares (serrato/trapecio inferior) o saturación de tejidos conectivos en codo y flexores de muñeca.',
      recommendation:
        'Regresa un escalón en la progresión (ej. Straddle -> Adv. Tuck) buscando bloqueo articular limpio con descansos de 180s.',
    };
  }

  if (ex.mode === 'hyrox') {
    return {
      title: `Degradación de Split Híbrido (-${absDrop}%)`,
      body: 'Acumulación prematura de lactato sobre el umbral LT2 o pérdida de economía mecánica en transición Roxzone.',
      recommendation:
        'Regula el primer tercio de la estación al 88% de esfuerzo y estandariza respiraciones rítmicas antes de retomar la carrera.',
    };
  }

  return {
    title: `Descenso de eficiencia cardiovascular / cadencia (-${absDrop}%)`,
    body: 'Pérdida de reactividad elástica en el complejo aquileo-plantar o deriva cardiovascular por deshidratación/fatiga residual de tren inferior.',
    recommendation:
      'Prioriza técnica de muñeca/cadencia limpia reduciendo la duración del intervalo un 20% o programa una sesión regenerativa en Zona 2.',
  };
}

/**
 * Evaluates all exercises across the entire session history chronologically.
 */
export function evaluateAllExercises(sessions: WorkoutSession[]): ExerciseEvaluation[] {
  const chronological = [...sessions].sort(
    (a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime()
  );

  const grouped = new Map<
    string,
    {
      sampleExercise: WorkoutExercise;
      points: ExtractedPoint[];
    }
  >();

  chronological.forEach((session) => {
    session.blocks.forEach((block) => {
      block.exercises.forEach((ex) => {
        const key = ex.catalogId || ex.name.trim().toLowerCase();
        const pt = extractExerciseMetricPoint(session, ex);
        if (!pt) return;

        const existing = grouped.get(key);
        if (!existing) {
          grouped.set(key, { sampleExercise: ex, points: [pt] });
        } else {
          // If executed twice in same session, keep best point
          const lastPt = existing.points[existing.points.length - 1];
          if (lastPt && lastPt.sessionId === session.id) {
            const isBetter = pt.isLowerBetter
              ? pt.primaryMetric < lastPt.primaryMetric
              : pt.primaryMetric > lastPt.primaryMetric;
            if (isBetter) {
              existing.points[existing.points.length - 1] = pt;
            }
          } else {
            existing.sampleExercise = ex;
            existing.points.push(pt);
          }
        }
      });
    });
  });

  const evaluations: ExerciseEvaluation[] = [];

  grouped.forEach(({ sampleExercise, points }, key) => {
    const latest = points[points.length - 1];
    if (!latest) return;

    if (points.length === 1) {
      evaluations.push({
        catalogId: key,
        exerciseName: sampleExercise.name,
        mode: sampleExercise.mode,
        cardioDiscipline: sampleExercise.cardioDiscipline,
        calisthenicsSubType: sampleExercise.calisthenicsSubType,
        status: 'baseline',
        deltaPercent: 0,
        isNewPr: true,
        latestValueFormatted: formatMetricDisplay(latest),
        baselineValueFormatted: 'Base inicial',
        badgeText: '● Registro Base | PR Inicial',
        history: points,
      });
      return;
    }

    const priorAll = points.slice(0, -1);
    const priorThree = priorAll.slice(-3);

    const avgPriorPrimary =
      priorThree.reduce((acc, p) => acc + p.primaryMetric, 0) / priorThree.length;
    const avgPriorSecondary =
      priorThree.reduce((acc, p) => acc + p.secondaryMetric, 0) / priorThree.length;

    // Positive deltaPercent ALWAYS means athletic improvement
    let rawDeltaPercent = 0;
    if (avgPriorPrimary > 0) {
      if (latest.isLowerBetter) {
        // Lower pace/split time = improvement
        rawDeltaPercent = ((avgPriorPrimary - latest.primaryMetric) / avgPriorPrimary) * 100;
      } else {
        rawDeltaPercent = ((latest.primaryMetric - avgPriorPrimary) / avgPriorPrimary) * 100;
      }
    }

    const deltaPercent = Math.round(rawDeltaPercent * 10) / 10;

    const bestHistorical = latest.isLowerBetter
      ? Math.min(...priorAll.map((p) => p.primaryMetric))
      : Math.max(...priorAll.map((p) => p.primaryMetric));

    const isNewPr = latest.isLowerBetter
      ? latest.primaryMetric < bestHistorical
      : latest.primaryMetric > bestHistorical;

    const secondaryVolumeGain =
      avgPriorSecondary > 0
        ? ((latest.secondaryMetric - avgPriorSecondary) / avgPriorSecondary) * 100
        : 0;

    let status: ProgressStatus = 'maintain';
    if (deltaPercent > 1.5 || (deltaPercent >= 0 && secondaryVolumeGain > 6)) {
      status = 'advance';
    } else if (
      deltaPercent < -3.0 ||
      (deltaPercent < -1.2 && secondaryVolumeGain < -20 && latest.effortScore >= 8.5)
    ) {
      status = 'regress';
    }

    const baselineFormatted = latest.isLowerBetter
      ? formatMmSs(Math.round(avgPriorPrimary)) +
        (latest.primaryUnit === 's/km' ? '/km' : latest.primaryUnit === 's/100m' ? '/100m' : '')
      : `${Math.round(avgPriorPrimary * 10) / 10} ${latest.primaryUnit}`;

    const metricShortLabel =
      sampleExercise.mode === 'hypertrophy' || sampleExercise.mode === 'strength'
        ? 'E1RM'
        : sampleExercise.mode === 'calisthenics'
          ? sampleExercise.calisthenicsSubType === 'isometric'
            ? 'TUT'
            : 'Fuerza Rel.'
          : sampleExercise.cardioDiscipline === 'jumprope'
            ? 'RPM'
            : sampleExercise.mode === 'hyrox'
              ? 'Split'
              : 'Pace';

    let badgeText = `● ${deltaPercent >= 0 ? '+' : ''}${deltaPercent}% Consolidación`;
    let diagnosisTitle: string | undefined;
    let diagnosisBody: string | undefined;
    let recommendation: string | undefined;

    if (status === 'advance') {
      const shownPct = deltaPercent > 0 ? deltaPercent : Math.round(secondaryVolumeGain * 10) / 10;
      badgeText = `▲ +${shownPct}% ${metricShortLabel}${isNewPr ? ' | Nuevo PR' : ' | Sobrecarga'}`;
    } else if (status === 'regress') {
      const shownDrop = deltaPercent < -0.5 ? deltaPercent : Math.round(secondaryVolumeGain * 10) / 10;
      badgeText = `▼ ${shownDrop}% Rendimiento`;
      const diag = buildRegressionDiagnosis(sampleExercise, shownDrop);
      diagnosisTitle = diag.title;
      diagnosisBody = diag.body;
      recommendation = diag.recommendation;
    }

    evaluations.push({
      catalogId: key,
      exerciseName: sampleExercise.name,
      mode: sampleExercise.mode,
      cardioDiscipline: sampleExercise.cardioDiscipline,
      calisthenicsSubType: sampleExercise.calisthenicsSubType,
      status,
      deltaPercent,
      isNewPr,
      latestValueFormatted: formatMetricDisplay(latest),
      baselineValueFormatted: baselineFormatted,
      badgeText,
      diagnosisTitle,
      diagnosisBody,
      recommendation,
      history: points,
    });
  });

  // Sort: advances & regressions with recent activity first
  return evaluations.sort((a, b) => {
    const aLast = new Date(a.history[a.history.length - 1]?.dateIso || 0).getTime();
    const bLast = new Date(b.history[b.history.length - 1]?.dateIso || 0).getTime();
    return bLast - aLast;
  });
}

/**
 * Generates an instant post-workout impact report when finishing an active workout.
 */
export function buildSessionImpactReport(
  completedSession: WorkoutSession,
  allSessionsIncludingCompleted: WorkoutSession[]
): SessionImpactReport {
  let totalTonnageKg = 0;
  let totalEffectiveSets = 0;
  let totalJumps = 0;
  let totalCardioMeters = 0;

  const sessionCatalogKeys = new Set<string>();

  completedSession.blocks.forEach((block) => {
    block.exercises.forEach((ex) => {
      sessionCatalogKeys.add(ex.catalogId || ex.name.trim().toLowerCase());

      ex.hypertrophySets?.forEach((s) => {
        if (s.reps > 0 && s.weightKg > 0) {
          totalTonnageKg += s.weightKg * s.reps;
          if (s.setType !== 'Calentamiento' && isEffectiveRir(s.rir)) {
            totalEffectiveSets += 1;
          }
        }
      });

      ex.strengthSets?.forEach((s) => {
        if (s.reps > 0 && s.weightKg > 0) {
          totalTonnageKg += s.weightKg * s.reps;
          totalEffectiveSets += 1;
        }
      });

      ex.calisthenicsDynamicSets?.forEach((s) => {
        if (s.reps > 0) {
          totalEffectiveSets += 1;
          if (s.addedWeightKg > 0) {
            totalTonnageKg += s.addedWeightKg * s.reps;
          }
        }
      });

      ex.calisthenicsIsometricSets?.forEach((s) => {
        if (s.actualSeconds > 0) totalEffectiveSets += 1;
      });

      ex.hyroxSets?.forEach((s) => {
        totalCardioMeters += s.distanceMeters;
        if (s.implementWeightKg > 0 && s.reps > 0) {
          totalTonnageKg += s.implementWeightKg * s.reps;
        }
        totalEffectiveSets += 1;
      });

      ex.jumpRopeSets?.forEach((s) => {
        totalJumps += s.jumps;
        totalEffectiveSets += 1;
      });

      ex.runningSets?.forEach((s) => {
        totalCardioMeters += s.distanceMeters;
        totalEffectiveSets += 1;
      });

      ex.swimmingSets?.forEach((s) => {
        totalCardioMeters += s.poolLengthMeters * s.laps;
        totalEffectiveSets += 1;
      });

      ex.cyclingSets?.forEach((s) => {
        totalCardioMeters += s.distanceMeters;
        totalEffectiveSets += 1;
      });
    });
  });

  const allEvaluations = evaluateAllExercises(allSessionsIncludingCompleted).filter((ev) =>
    sessionCatalogKeys.has(ev.catalogId)
  );

  const advances = allEvaluations.filter((e) => e.status === 'advance' || e.status === 'baseline');
  const maintenances = allEvaluations.filter((e) => e.status === 'maintain');
  const regressions = allEvaluations.filter((e) => e.status === 'regress');
  const prCount = allEvaluations.filter((e) => e.isNewPr).length;
  const totalLoggedTimerSeconds = (completedSession.timerLogs ?? [])
    .filter((t) => t.kind !== 'rest')
    .reduce((acc, t) => acc + t.elapsedSeconds, 0);

  return {
    session: completedSession,
    totalTonnageKg: Math.round(totalTonnageKg),
    totalEffectiveSets,
    totalJumps,
    totalCardioMeters: Math.round(totalCardioMeters),
    totalLoggedTimerSeconds,
    prCount,
    advances,
    maintenances,
    regressions,
  };
}

/**
 * Hyrox Block Real-Time Intelligence:
 * Total Time, Projected Full Race Time (8 runs + 8 stations), Mean Run Pace (/km), and Bottleneck Station.
 */
export function analyzeHyroxBlock(block: WorkoutBlock): {
  totalSplitSeconds: number;
  totalRoxzoneSeconds: number;
  totalElapsedSeconds: number;
  avgRunPaceSecPerKm: number;
  projectedFullHyroxSeconds: number;
  bottleneckStation: { station: string; splitSeconds: number; overPct: number } | null;
} {
  let totalSplitSeconds = 0;
  let totalRoxzoneSeconds = 0;
  let runMeters = 0;
  let runSeconds = 0;
  let stationCount = 0;
  let worstBottleneck: { station: string; splitSeconds: number; overPct: number } | null = null;

  block.exercises.forEach((ex) => {
    ex.hyroxSets?.forEach((s) => {
      if (s.splitSeconds <= 0) return;
      stationCount += 1;
      totalSplitSeconds += s.splitSeconds;
      totalRoxzoneSeconds += s.roxzoneSeconds;

      if (s.station === '1000m Run' && s.distanceMeters > 0) {
        runMeters += s.distanceMeters;
        runSeconds += s.splitSeconds;
      }

      const ref = HYROX_REFERENCE_SPLITS_SEC[s.station] || 220;
      // Scale ref proportionally if partial distance/reps
      let scale = 1;
      if (s.station === '1000m Run' && s.distanceMeters > 0) scale = s.distanceMeters / 1000;
      if (s.station === 'Wall Balls' && s.reps > 0) scale = s.reps / 100;
      const expectedRef = Math.max(30, ref * scale);

      const overPct = Math.round(((s.splitSeconds - expectedRef) / expectedRef) * 100);
      if (!worstBottleneck || overPct > worstBottleneck.overPct) {
        worstBottleneck = {
          station: s.station,
          splitSeconds: s.splitSeconds,
          overPct,
        };
      }
    });
  });

  const totalElapsedSeconds = totalSplitSeconds + totalRoxzoneSeconds;
  const avgRunPaceSecPerKm =
    runMeters > 0 ? Math.round((runSeconds / runMeters) * 1000) : 0;

  // Standard Hyrox has 16 segments (8 x 1km runs + 8 workout stations)
  const projectedFullHyroxSeconds =
    stationCount > 0 ? Math.round((totalElapsedSeconds / stationCount) * 16) : 0;

  return {
    totalSplitSeconds,
    totalRoxzoneSeconds,
    totalElapsedSeconds,
    avgRunPaceSecPerKm,
    projectedFullHyroxSeconds,
    bottleneckStation: worstBottleneck,
  };
}

export function computeExecutiveStats(sessions: WorkoutSession[], evaluations: ExerciseEvaluation[]) {
  const now = new Date();
  const thirtyDaysAgo = now.getTime() - 30 * 24 * 3600 * 1000;

  const sessionsThisMonth = sessions.filter(
    (s) => new Date(s.dateIso).getTime() >= thirtyDaysAgo
  ).length;

  // Calculate active training streak (allowing 1 rest day gap between sessions as physiological recovery!)
  const uniqueDaysDesc = Array.from(
    new Set(
      sessions.map((s) => {
        const d = new Date(s.dateIso);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      })
    )
  ).sort((a, b) => b - a);

  let disciplineStreakDays = 0;
  if (uniqueDaysDesc.length > 0) {
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffFromToday = Math.round((todayMidnight - uniqueDaysDesc[0]) / (24 * 3600 * 1000));
    if (diffFromToday <= 3) {
      disciplineStreakDays = 1;
      for (let i = 0; i < uniqueDaysDesc.length - 1; i++) {
        const gapDays = Math.round(
          (uniqueDaysDesc[i] - uniqueDaysDesc[i + 1]) / (24 * 3600 * 1000)
        );
        if (gapDays <= 3) {
          disciplineStreakDays += gapDays;
        } else {
          break;
        }
      }
    }
  }

  const comparable = evaluations.filter((e) => e.status !== 'baseline');
  const advanceCount = evaluations.filter((e) => e.status === 'advance').length;
  const regressCount = evaluations.filter((e) => e.status === 'regress').length;
  const maintainCount = evaluations.filter((e) => e.status === 'maintain').length;
  const totalEvaluated = Math.max(1, comparable.length);

  const advancePct = Math.round((advanceCount / totalEvaluated) * 100);
  const regressPct = Math.round((regressCount / totalEvaluated) * 100);
  const maintainPct = Math.max(0, 100 - advancePct - regressPct);

  const totalPrs = evaluations.filter((e) => e.isNewPr).length;

  return {
    sessionsThisMonth,
    disciplineStreakDays,
    advanceCount,
    regressCount,
    maintainCount,
    advancePct,
    regressPct,
    maintainPct,
    totalPrs,
  };
}
