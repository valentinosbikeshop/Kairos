import {
  ExerciseCatalogItem,
  PrimaryGoalType,
  RirValue,
  RoutineDayPlan,
  RoutineExercisePrescription,
  TrainingMode,
  UserProfile,
  UserRoutine,
} from '@/types/kairos';
import { BUILTIN_EXERCISES, normalizeSearchText } from '@/lib/exerciseDatabase';
import {
  cleanAllRoutineExercises,
  resolveExerciseIntelligently,
} from '@/lib/exerciseClassifierEngine';
import {
  generateScientificRoutine,
  populateRoutineDayByFocus,
} from '@/lib/aiRoutineEngine';
import { uid } from '@/lib/formatters';

export interface AiChatContext {
  userName?: string;
  userAge?: number;
  userWeightKg?: number;
  userHeightCm?: number;
  userBodyFatPct?: number;
  userGoal?: string;
  experienceLevel?: string;
  routineName?: string;
  routineDaysCount?: number;
  routineDays?: RoutineDayPlan[];
  activeWorkoutTitle?: string;
  activeWorkoutExerciseNames?: string[];
  recentSessionsCount?: number;
  currentScreen?: 'general' | 'routine_manager' | 'workout' | 'history' | 'timer' | string;
}

export type AiActionType =
  | 'add_to_active_workout'
  | 'add_to_routine'
  | 'start_rest_timer'
  | 'view_biomechanics'
  | 'apply_routine_cleanup'
  | 'load_routine_day_to_workout'
  | 'update_routine_days'
  | 'generate_and_save_routine'
  | 'update_user_profile'
  | 'modify_active_workout';

export interface AiActionSuggestion {
  id: string;
  label: string;
  type: AiActionType;
  /** When true, AiCoachModal executes this mutation automatically upon receiving the AI message */
  autoExecute?: boolean;
  payload: {
    exerciseName?: string;
    catalogId?: string;
    mode?: TrainingMode;
    restSeconds?: number;
    muscleGroup?: string;
    sets?: number;
    reps?: number;
    targetWeightKg?: number;
    targetDayId?: string;
    targetDayLabel?: string;
    cleanedDays?: RoutineDayPlan[];
    updatedDays?: RoutineDayPlan[];
    generatedRoutine?: UserRoutine;
    profilePatch?: {
      weightKg?: number;
      heightCm?: number;
      bodyFatPercent?: number;
      primaryGoal?: PrimaryGoalType;
      defaultRestSeconds?: number;
      defaultEffectiveSets?: number;
      defaultReps?: number;
    };
    workoutModification?: {
      op: 'clear' | 'remove_exercise' | 'update_title';
      targetExerciseName?: string;
      newTitle?: string;
    };
  };
}

export interface AiChatMessageResponse {
  content: string;
  suggestedActions: AiActionSuggestion[];
  confidence: number;
  modelUsed?: string | null;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a routine day from natural language (e.g. "Día 1", "Día 2", "Torso", "Pierna", "Lunes").
 */
export function matchRoutineDayFromQuery(
  query: string,
  days: RoutineDayPlan[] = []
): RoutineDayPlan | null {
  if (!days.length) return null;
  const qNorm = normalizeSearchText(query);

  // 1. Explicit "dia X" match
  const dayNumMatch = qNorm.match(/\bdia\s*(\d+)\b/);
  if (dayNumMatch) {
    const num = parseInt(dayNumMatch[1], 10);
    const byLabel = days.find((d) => normalizeSearchText(d.label) === `dia ${num}`);
    if (byLabel) return byLabel;
    if (num >= 1 && num <= days.length) return days[num - 1];
  }

  // 2. Match by focusTitle or label keywords
  for (const d of days) {
    const focusNorm = normalizeSearchText(d.focusTitle || '');
    const labelNorm = normalizeSearchText(d.label || '');
    if (focusNorm.length >= 3 && qNorm.includes(focusNorm)) return d;
    if (labelNorm.length >= 4 && qNorm.includes(labelNorm)) return d;
  }

  // 3. Semantic muscle group match to day focusTitle
  if (/\b(?:pierna|legs|cuadriceps|femoral|gluteo|isquio)\b/.test(qNorm)) {
    const legDay = days.find((d) =>
      /pierna|legs|lower|cuadriceps|gluteo/i.test(`${d.focusTitle} ${d.label}`)
    );
    if (legDay) return legDay;
  }
  if (/\b(?:torso|pecho|espalda|upper|banca|remo|jalon)\b/.test(qNorm)) {
    const upperDay = days.find((d) =>
      /torso|upper|pecho|espalda|empuje|tiron/i.test(`${d.focusTitle} ${d.label}`)
    );
    if (upperDay) return upperDay;
  }

  return null;
}

/**
 * Parses direct imperative user commands to mutate routines, load days, update profile metrics,
 * or modify the active workout, returning an structured agentic response + auto-executable actions.
 */
export function parseAgenticUserCommand(
  userQuery: string,
  context: AiChatContext
): AiChatMessageResponse | null {
  const q = normalizeSearchText(userQuery);
  const days = context.routineDays ?? [];

  // -------------------------------------------------------------------------
  // 1. LOAD A ROUTINE DAY INTO TODAY'S ACTIVE WORKOUT
  // e.g. "carga el dia 1", "cargame el dia de torso", "entrenar pierna hoy", "cargar dia completo"
  // -------------------------------------------------------------------------
  if (
    /\b(?:carg(?:a|ar|ame)|pon(?:er|me)?\s+a\s+entrenar|activar?\s+(?:el\s+)?dia|entrenar\s+hoy|selecciona(?:r)?\s+(?:el\s+)?dia)\b/.test(
      q
    ) &&
    days.length > 0
  ) {
    const matchedDay =
      matchRoutineDayFromQuery(userQuery, days) ??
      days.find((d) => !d.isRestDay && d.exercises.length > 0) ??
      days[0];

    if (matchedDay) {
      const effectiveDay =
        !matchedDay.isRestDay && matchedDay.exercises.length === 0
          ? populateRoutineDayByFocus(matchedDay)
          : matchedDay;

      const exListMd = effectiveDay.exercises
        .map((e, i) => `${i + 1}. **${e.name}** — ${e.sets}×${e.repRangeLabel} (Descanso: ${e.restSeconds}s)`)
        .join('\n');

      return {
        content:
          `### ⚡ Día Cargado en tu Entrenamiento de Hoy\n\n` +
          `He sincronizado la cronología de tu rutina y cargado **${effectiveDay.label} (${effectiveDay.focusTitle})** directamente en tu sesión activa:\n\n` +
          `${exListMd}\n\n` +
          `*Tu entrenamiento de hoy ya está listo en la pantalla principal con todas sus series, cargas y perfiles biomecánicos.*`,
        suggestedActions: [
          {
            id: `act_load_day_${effectiveDay.id}`,
            label: `⚡ Cargar ${effectiveDay.label} · ${effectiveDay.focusTitle} (${effectiveDay.exercises.length} ejercicios)`,
            type: 'load_routine_day_to_workout',
            autoExecute: true,
            payload: {
              targetDayId: effectiveDay.id,
              targetDayLabel: `${effectiveDay.label} · ${effectiveDay.focusTitle}`,
            },
          },
        ],
        confidence: 99,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 2. COMPLETE / POPULATE AN EMPTY ROUTINE DAY (e.g. "completa mi dia de pierna", "rellena el dia 2")
  // -------------------------------------------------------------------------
  if (
    /\b(?:complet(?:a|ar|ame)|rellen(?:a|ar|ame)|pobla(?:r)?|arma(?:r|me)?\s+el\s+dia|agrega(?:r)?\s+ejercicios\s+a(?:l)?\s+dia)\b/.test(
      q
    ) &&
    days.length > 0
  ) {
    const targetDay =
      matchRoutineDayFromQuery(userQuery, days) ??
      days.find((d) => !d.isRestDay && d.exercises.length === 0) ??
      days.find((d) => !d.isRestDay);

    if (targetDay) {
      const populated = populateRoutineDayByFocus(targetDay);
      const updatedDays = days.map((d) => (d.id === targetDay.id ? populated : d));
      const exListMd = populated.exercises
        .map((e, i) => `${i + 1}. **${e.name}** — ${e.sets} series × ${e.repRangeLabel} (RIR ${e.rir} · ${e.restSeconds}s)`)
        .join('\n');

      return {
        content:
          `### ❖ Día de Rutina Completado Científicamente: **${populated.label} (${populated.focusTitle})**\n\n` +
          `He estructurado y guardado la selección óptima de ejercicios para **${populated.focusTitle}** priorizando alto ratio estímulo-fatiga (SFR) y cobertura anatómica completa:\n\n` +
          `${exListMd}\n\n` +
          `*Los cambios ya fueron aplicados directamente en tu rutina base.*`,
        suggestedActions: [
          {
            id: `act_populate_day_${populated.id}`,
            label: `✓ Guardar ${populated.label} (${populated.focusTitle}) en mi rutina`,
            type: 'update_routine_days',
            autoExecute: true,
            payload: {
              updatedDays,
              targetDayId: populated.id,
              targetDayLabel: `${populated.label} · ${populated.focusTitle}`,
            },
          },
          {
            id: `act_load_populated_${populated.id}`,
            label: `⚡ Cargar ${populated.label} (${populated.focusTitle}) para entrenar hoy`,
            type: 'load_routine_day_to_workout',
            payload: {
              targetDayId: populated.id,
              targetDayLabel: `${populated.label} · ${populated.focusTitle}`,
            },
          },
        ],
        confidence: 99,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 3. REPLACE / SUBSTITUTE AN EXERCISE IN ROUTINE ("cambia X por Y", "reemplaza X por Y", "sustituye X por Y")
  // -------------------------------------------------------------------------
  const replaceMatch = userQuery.match(
    /(?:cambi(?:a|ar|ame)|reemplaz(?:a|ar|ame)|sustituy(?:e|eme|ir))\s+(?:el\s+|la\s+|los\s+|las\s+)?(.+?)\s+por\s+(.+?)(?:\s+en\s+(?:mi\s+rutina|el\s+d[ií]a\s+\d+|torso|pierna).*)?$/i
  );
  if (replaceMatch && days.length > 0) {
    const oldRaw = replaceMatch[1].trim();
    const newRaw = replaceMatch[2].trim();
    const oldResolved = resolveExerciseIntelligently(oldRaw);
    const newResolved = resolveExerciseIntelligently(newRaw);

    let replacedCount = 0;
    let oldDisplayName = oldRaw;
    const updatedDays = days.map((d) => ({
      ...d,
      exercises: d.exercises.map((ex) => {
        const exNorm = normalizeSearchText(ex.name);
        const oldNorm = normalizeSearchText(oldRaw);
        if (
          ex.catalogId === oldResolved.canonicalCatalogId ||
          exNorm.includes(oldNorm) ||
          oldNorm.includes(exNorm)
        ) {
          replacedCount++;
          oldDisplayName = ex.name;
          return {
            ...ex,
            catalogId: newResolved.canonicalCatalogId,
            name: newResolved.canonicalName,
            mode: newResolved.mode,
            restSeconds: newResolved.defaultRestSeconds,
          };
        }
        return ex;
      }),
    }));

    if (replacedCount > 0) {
      return {
        content:
          `### ❖ Sustitución Biomecánica Aplicada en tu Rutina\n\n` +
          `He reemplazado **${oldDisplayName}** por **${newResolved.canonicalName}** en tu rutina base:\n\n` +
          `- **Músculos Principales:** ${newResolved.deepProfile.primaryMuscles.join(', ')}\n` +
          `- **Músculos Sinergistas:** ${newResolved.deepProfile.secondaryMuscles.join(', ')}\n` +
          `- **Perfil de Resistencia:** ${newResolved.deepProfile.resistanceProfile} (SFR: **${newResolved.deepProfile.sfrScore}/10**)\n` +
          `- **Descanso Fisiológico:** ${newResolved.defaultRestSeconds} segundos`,
        suggestedActions: [
          {
            id: `act_replace_ex_${uid('rep')}`,
            label: `✓ Reemplazar "${oldDisplayName}" ➔ "${newResolved.canonicalName}" en mi rutina`,
            type: 'update_routine_days',
            autoExecute: true,
            payload: {
              updatedDays,
            },
          },
        ],
        confidence: 99,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 4. REMOVE AN EXERCISE FROM ROUTINE ("elimina X de mi rutina", "quita X del dia 1", "borra X")
  // -------------------------------------------------------------------------
  const removeMatch = userQuery.match(
    /(?:elimin(?:a|ar|ame)|quit(?:a|ar|ame)|borr(?:a|ar|ame)|sac(?:a|ar|ame))\s+(?:el\s+|la\s+|los\s+|las\s+)?(.+?)\s+(?:de\s+(?:mi\s+rutina|la\s+rutina|el\s+d[ií]a\s*\d+|torso|pierna))/i
  );
  if (removeMatch && days.length > 0) {
    const targetRaw = removeMatch[1].trim();
    const targetResolved = resolveExerciseIntelligently(targetRaw);
    const targetNorm = normalizeSearchText(targetRaw);

    let removedName = '';
    let removedFromDay = '';
    const updatedDays = days.map((d) => {
      const filtered = d.exercises.filter((ex) => {
        const exNorm = normalizeSearchText(ex.name);
        const isMatch =
          ex.catalogId === targetResolved.canonicalCatalogId ||
          exNorm.includes(targetNorm) ||
          targetNorm.includes(exNorm);
        if (isMatch) {
          removedName = ex.name;
          removedFromDay = `${d.label} (${d.focusTitle})`;
        }
        return !isMatch;
      });
      return { ...d, exercises: filtered };
    });

    if (removedName) {
      return {
        content:
          `### ❖ Ejercicio Eliminado de tu Rutina\n\n` +
          `He eliminado **${removedName}** de **${removedFromDay}** y actualizado el volumen de tu rutina base.`,
        suggestedActions: [
          {
            id: `act_remove_ex_${uid('rm')}`,
            label: `✓ Eliminar "${removedName}" de ${removedFromDay}`,
            type: 'update_routine_days',
            autoExecute: true,
            payload: {
              updatedDays,
            },
          },
        ],
        confidence: 99,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 5. ADD AN EXERCISE TO A SPECIFIC ROUTINE DAY ("agrega X al dia 1", "añade X a pierna")
  // -------------------------------------------------------------------------
  const addExToRoutineMatch = userQuery.match(
    /(?:agreg(?:a|ar|ame)|a[ñn]ad(?:e|ir|eme)|met(?:e|er)|incluy(?:e|ir))\s+(.+?)\s+(?:a(?:l)?\s+|en\s+)(?:mi\s+)?(?:d[ií]a\s*\d+|rutina|torso|pierna|empuje|tir[oó]n|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(.*)$/i
  );
  if (addExToRoutineMatch && days.length > 0) {
    const rawExSegment = addExToRoutineMatch[1].trim();
    const targetDay =
      matchRoutineDayFromQuery(userQuery, days) ??
      days.find((d) => !d.isRestDay) ??
      days[0];

    // Check for sets x reps or weight in query (e.g. "3x12", "4 series de 10", "80kg")
    const setsRepsMatch = userQuery.match(/(\d+)\s*[x×]\s*(\d+)/i);
    const setsWordMatch = userQuery.match(/(\d+)\s*series?/i);
    const repsWordMatch = userQuery.match(/(\d+)\s*(?:reps?|repeticiones)/i);
    const weightMatch = userQuery.match(/(\d+(?:[.,]\d+)?)\s*kg/i);

    const resolved = resolveExerciseIntelligently(rawExSegment);
    const sets = setsRepsMatch
      ? parseInt(setsRepsMatch[1], 10)
      : setsWordMatch
        ? parseInt(setsWordMatch[1], 10)
        : 3;
    const reps = setsRepsMatch
      ? parseInt(setsRepsMatch[2], 10)
      : repsWordMatch
        ? parseInt(repsWordMatch[1], 10)
        : 10;
    const weightKg = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : undefined;

    const newPres: RoutineExercisePrescription = {
      catalogId: resolved.canonicalCatalogId,
      name: resolved.canonicalName,
      mode: resolved.mode,
      sets: Math.max(1, Math.min(10, sets)),
      repsNum: Math.max(1, Math.min(50, reps)),
      repRangeLabel: `${reps} reps`,
      rir: '2',
      restSeconds: resolved.defaultRestSeconds,
      ...(weightKg ? { targetWeightKg: weightKg } : {}),
    };

    const updatedDays = days.map((d) =>
      d.id === targetDay.id
        ? {
            ...d,
            isRestDay: false,
            exercises: [...d.exercises, newPres],
          }
        : d
    );

    return {
      content:
        `### ❖ Ejercicio Añadido a tu Rutina Base\n\n` +
        `He añadido **${resolved.canonicalName}** a **${targetDay.label} (${targetDay.focusTitle})**:\n\n` +
        `- **Prescripción:** ${newPres.sets} series × ${newPres.repRangeLabel}${weightKg ? ` · **${weightKg} kg**` : ''} (RIR 2 · Descanso: ${newPres.restSeconds}s)\n` +
        `- **Músculos Principales:** ${resolved.deepProfile.primaryMuscles.join(', ')}\n` +
        `- **Sinergistas:** ${resolved.deepProfile.secondaryMuscles.join(', ')}\n` +
        `- **Ratio Estímulo/Fatiga (SFR):** ${resolved.deepProfile.sfrScore}/10`,
      suggestedActions: [
        {
          id: `act_add_direct_rtn_${uid('ar')}`,
          label: `✓ Añadir "${resolved.canonicalName}" (${newPres.sets}×${reps}) a ${targetDay.label}`,
          type: 'update_routine_days',
          autoExecute: true,
          payload: {
            updatedDays,
            targetDayId: targetDay.id,
            exerciseName: resolved.canonicalName,
          },
        },
      ],
      confidence: 99,
    };
  }

  // -------------------------------------------------------------------------
  // 6. MODIFY SETS / REPS / WEIGHT OF AN EXISTING ROUTINE EXERCISE
  // e.g. "cambia press de banca a 3 series de 10 reps con 80kg", "pon 3 series en press de banca"
  // -------------------------------------------------------------------------
  if (
    /\b(?:cambi(?:a|ar)|pon(?:er|le)?|ajust(?:a|ar)|modific(?:a|ar)|sub(?:e|ir))\b/.test(q) &&
    /\b(?:series?|reps?|repeticiones|kg|kilos?|\d+\s*[x×]\s*\d+)\b/.test(q) &&
    days.length > 0
  ) {
    const setsRepsMatch = userQuery.match(/(\d+)\s*[x×]\s*(\d+)/i);
    const setsWordMatch = userQuery.match(/(\d+)\s*series?/i);
    const repsWordMatch = userQuery.match(/(\d+)\s*(?:reps?|repeticiones)/i);
    const weightMatch = userQuery.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?)/i);

    const newSets = setsRepsMatch
      ? parseInt(setsRepsMatch[1], 10)
      : setsWordMatch
        ? parseInt(setsWordMatch[1], 10)
        : undefined;
    const newReps = setsRepsMatch
      ? parseInt(setsRepsMatch[2], 10)
      : repsWordMatch
        ? parseInt(repsWordMatch[1], 10)
        : undefined;
    const newWeight = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : undefined;

    let modifiedExName = '';
    const updatedDays = days.map((d) => ({
      ...d,
      exercises: d.exercises.map((ex) => {
        const exNorm = normalizeSearchText(ex.name);
        // Check if query mentions this exercise
        const words = exNorm.split(' ').filter((w) => w.length >= 4);
        const matchedWords = words.filter((w) => q.includes(w));
        if (q.includes(exNorm) || (words.length > 0 && matchedWords.length >= Math.min(2, words.length))) {
          modifiedExName = ex.name;
          return {
            ...ex,
            sets: newSets ?? ex.sets,
            repsNum: newReps ?? ex.repsNum,
            repRangeLabel: newReps ? `${newReps} reps` : ex.repRangeLabel,
            targetWeightKg: newWeight ?? ex.targetWeightKg,
          };
        }
        return ex;
      }),
    }));

    if (modifiedExName && (newSets !== undefined || newReps !== undefined || newWeight !== undefined)) {
      const changesDesc: string[] = [];
      if (newSets !== undefined) changesDesc.push(`**${newSets} series**`);
      if (newReps !== undefined) changesDesc.push(`**${newReps} repeticiones**`);
      if (newWeight !== undefined) changesDesc.push(`**${newWeight} kg**`);

      return {
        content:
          `### ❖ Prescripción Actualizada en tu Rutina\n\n` +
          `He actualizado **${modifiedExName}** en tu rutina base con los nuevos parámetros: ${changesDesc.join(' · ')}.`,
        suggestedActions: [
          {
            id: `act_mod_ex_${uid('mod')}`,
            label: `✓ Guardar cambios en "${modifiedExName}"`,
            type: 'update_routine_days',
            autoExecute: true,
            payload: {
              updatedDays,
            },
          },
        ],
        confidence: 99,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 7. UPDATE USER PROFILE METRICS / WORKOUT DEFAULTS
  // e.g. "actualiza mi peso a 78.5 kg", "mi altura es 180 cm", "pon mi descanso por defecto en 120s"
  // -------------------------------------------------------------------------
  const weightUpdateMatch = userQuery.match(
    /(?:mi\s+peso\s+(?:es|actual\s+es)|peso\s+actual|actualiz(?:a|ar)\s+(?:mi\s+)?peso\s+a|cambi(?:a|ar)\s+(?:mi\s+)?peso\s+a|ahor[a]?\s+peso)\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kilos?)?/i
  );
  const heightUpdateMatch = userQuery.match(
    /(?:mi\s+altura\s+es|mido|actualiz(?:a|ar)\s+(?:mi\s+)?altura\s+a|cambi(?:a|ar)\s+(?:mi\s+)?altura\s+a)\s*(\d{3})\s*(?:cm)?/i
  );
  const bfUpdateMatch = userQuery.match(
    /(?:grasa\s+corporal|porcentaje\s+de\s+grasa|%?\s*grasa)\s*(?:es|a|en)?\s*(\d{1,2}(?:[.,]\d+)?)\s*%?/i
  );
  const defaultRestMatch = userQuery.match(
    /(?:descanso\s+por\s+defecto|descanso\s+predeterminado)\s*(?:a|en|de)?\s*(\d{2,3})\s*(?:s|seg)/i
  );

  if (weightUpdateMatch || heightUpdateMatch || bfUpdateMatch || defaultRestMatch) {
    const profilePatch: NonNullable<AiActionSuggestion['payload']['profilePatch']> = {};
    const updatesList: string[] = [];

    if (weightUpdateMatch) {
      const w = parseFloat(weightUpdateMatch[1].replace(',', '.'));
      if (w >= 35 && w <= 250) {
        profilePatch.weightKg = w;
        updatesList.push(`- **Peso Corporal:** **${w} kg** (Proteína óptima recalculada: ${Math.round(w * 1.6)}–${Math.round(w * 2.2)}g/día)`);
      }
    }
    if (heightUpdateMatch) {
      const h = parseInt(heightUpdateMatch[1], 10);
      if (h >= 120 && h <= 230) {
        profilePatch.heightCm = h;
        updatesList.push(`- **Altura:** **${h} cm**`);
      }
    }
    if (bfUpdateMatch) {
      const bf = parseFloat(bfUpdateMatch[1].replace(',', '.'));
      if (bf >= 3 && bf <= 55) {
        profilePatch.bodyFatPercent = bf;
        updatesList.push(`- **Grasa Corporal:** **${bf}%**`);
      }
    }
    if (defaultRestMatch) {
      const r = parseInt(defaultRestMatch[1], 10);
      if (r >= 30 && r <= 360) {
        profilePatch.defaultRestSeconds = r;
        updatesList.push(`- **Descanso por defecto:** **${r} segundos**`);
      }
    }

    if (updatesList.length > 0) {
      return {
        content:
          `### ❖ Perfil Biométrico y Parámetros Actualizados\n\n` +
          `He actualizado directamente la información de tu perfil en **KAIROS**:\n\n` +
          `${updatesList.join('\n')}`,
        suggestedActions: [
          {
            id: `act_prof_${uid('pf')}`,
            label: `✓ Guardar actualización en mi perfil KAIROS`,
            type: 'update_user_profile',
            autoExecute: true,
            payload: {
              profilePatch,
            },
          },
        ],
        confidence: 99,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 8. GENERATE & ACTIVATE A NEW FULL SCIENTIFIC ROUTINE FROM CHAT
  // e.g. "creame una rutina torso pierna de 4 dias", "armame una rutina ppl de 6 dias"
  // -------------------------------------------------------------------------
  if (
    /\b(?:cre(?:a|ar|ame)|arm(?:a|ar|ame)|gener(?:a|ar|ame)|dise[ñn](?:a|ar|ame))\s+(?:una\s+)?(?:nueva\s+)?rutina\b/.test(
      q
    )
  ) {
    const daysMatch = q.match(/(\d)\s*dias?/);
    const daysPerWeek = daysMatch ? Math.max(2, Math.min(6, parseInt(daysMatch[1], 10))) : 4;
    const isWeekday = /\b(?:semanal|lunes\s+a|dias\s+fijos)\b/.test(q);

    const newRoutine = generateScientificRoutine({
      userPrompt: userQuery,
      daysPerWeek,
      minutesPerSession: 60,
      equipment: 'gym',
      scheduleType: isWeekday ? 'weekday' : 'cyclic',
      profile: null,
    });

    const activeSummary = newRoutine.days
      .filter((d) => !d.isRestDay)
      .map((d) => `- **${d.label} (${d.focusTitle}):** ${d.exercises.map((e) => e.name).join(', ')}`)
      .join('\n');

    return {
      content:
        `### ❖ Nueva Rutina Científica Diseñada: **${newRoutine.name}**\n\n` +
        `He diseñado una estructura completa de **${daysPerWeek} días activos** optimizando frecuencia, volumen semanal efectivo y perfiles de resistencia:\n\n` +
        `${activeSummary}\n\n` +
        `*Puedes activarla ahora mismo con un toque abajo:*`,
      suggestedActions: [
        {
          id: `act_gen_rtn_${newRoutine.id}`,
          label: `⚡ Activar y Guardar "${newRoutine.name}" (${daysPerWeek} días)`,
          type: 'generate_and_save_routine',
          autoExecute: /\b(?:activala|guardala|aplicar|ahora)\b/.test(q),
          payload: {
            generatedRoutine: newRoutine,
          },
        },
      ],
      confidence: 98,
    };
  }

  return null;
}

/**
 * Searches the query and response text for exercises mentioned in the catalog
 * and creates high-value actionable buttons.
 */
export function extractActionSuggestionsFromText(
  aiText: string,
  userQuery: string,
  context?: AiChatContext
): AiActionSuggestion[] {
  const suggestions: AiActionSuggestion[] = [];
  const textToScan = `${userQuery} \n ${aiText}`;

  // 1. Parse optional structured <kairos_actions>[...]</kairos_actions> block from Gemini if present
  const actionTagMatch = aiText.match(/<kairos_actions>([\s\S]*?)<\/kairos_actions>/i);
  if (actionTagMatch) {
    try {
      const parsedActions = JSON.parse(actionTagMatch[1].trim());
      if (Array.isArray(parsedActions)) {
        for (const act of parsedActions) {
          if (act && act.type && act.label) {
            suggestions.push({
              id: act.id || uid('ai_act'),
              label: act.label,
              type: act.type,
              autoExecute: Boolean(act.autoExecute),
              payload: act.payload || {},
            });
          }
        }
      }
    } catch {
      // Ignore malformed tag and continue with deterministic extraction
    }
  }

  // 2. Check if user command matches a direct agentic operation
  if (context) {
    const directCommand = parseAgenticUserCommand(userQuery, context);
    if (directCommand && directCommand.suggestedActions.length > 0) {
      for (const act of directCommand.suggestedActions) {
        if (!suggestions.some((s) => s.type === act.type && s.label === act.label)) {
          suggestions.push(act);
        }
      }
    }
  }

  // 3. Find mentioned exercises in catalog
  const foundExercises = new Map<string, ExerciseCatalogItem>();

  for (const ex of BUILTIN_EXERCISES) {
    const nameRegex = new RegExp(`\\b${escapeRegExp(ex.name)}\\b`, 'i');
    if (nameRegex.test(textToScan)) {
      foundExercises.set(ex.id, ex);
      continue;
    }

    if (ex.aliases?.length) {
      for (const alias of ex.aliases) {
        if (alias.length >= 4) {
          const aliasRegex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i');
          if (aliasRegex.test(textToScan)) {
            foundExercises.set(ex.id, ex);
            break;
          }
        }
      }
    }
  }

  // Create action buttons for up to 3 detected exercises
  let count = 0;
  for (const ex of foundExercises.values()) {
    if (count >= 3) break;

    suggestions.push({
      id: `act_add_workout_${ex.id}`,
      label: `⚡ Añadir "${ex.name}" a mi entrenamiento de hoy`,
      type: 'add_to_active_workout',
      payload: {
        exerciseName: ex.name,
        catalogId: ex.id,
        mode: ex.mode,
        muscleGroup: ex.muscleGroup,
        restSeconds: ex.defaultRestSeconds,
        sets: 3,
        reps: 10,
      },
    });

    suggestions.push({
      id: `act_add_routine_${ex.id}`,
      label: `📋 Añadir "${ex.name}" a mi rutina base`,
      type: 'add_to_routine',
      payload: {
        exerciseName: ex.name,
        catalogId: ex.id,
        mode: ex.mode,
        muscleGroup: ex.muscleGroup,
        restSeconds: ex.defaultRestSeconds,
        sets: 3,
        reps: 10,
      },
    });

    count++;
  }

  // 4. Check if a rest period was mentioned (e.g. "descanso de 2 minutos", "descansa 90 segundos", "120s")
  const restSecMatch = textToScan.match(
    /\b(?:descans[oa](?:r)?\s+(?:de\s+)?)(\d{2,3})\s*(?:s|seg(?:undos)?)\b/i
  );
  const restMinMatch = textToScan.match(
    /\b(?:descans[oa](?:r)?\s+(?:de\s+)?)(\d(?:\.5)?)\s*min(?:utos)?\b/i
  );

  if (restSecMatch) {
    const sec = parseInt(restSecMatch[1], 10);
    if (sec >= 30 && sec <= 300) {
      suggestions.push({
        id: `act_rest_${sec}`,
        label: `⏱️ Iniciar descanso de ${sec} segundos`,
        type: 'start_rest_timer',
        payload: { restSeconds: sec },
      });
    }
  } else if (restMinMatch) {
    const mins = parseFloat(restMinMatch[1]);
    const sec = Math.round(mins * 60);
    if (sec >= 30 && sec <= 300) {
      suggestions.push({
        id: `act_rest_${sec}`,
        label: `⏱️ Iniciar descanso de ${mins} min (${sec}s)`,
        type: 'start_rest_timer',
        payload: { restSeconds: sec },
      });
    }
  }

  return suggestions;
}

/**
 * Strips internal `<kairos_actions>...</kairos_actions>` tags from display text.
 */
export function stripActionTagsFromAiText(rawText: string): string {
  return rawText.replace(/<kairos_actions>[\s\S]*?<\/kairos_actions>/gi, '').trim();
}

/**
 * Built-in peer-reviewed scientific & agentic response engine.
 * Used for instant agentic mutations and when offline or as fallback.
 */
export async function generateScientificAiResponse(
  query: string,
  context: AiChatContext
): Promise<AiChatMessageResponse> {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 0. CHECK DIRECT AGENTIC MUTATION COMMANDS FIRST (Load day, edit routine, update profile, generate routine)
  const agenticResult = parseAgenticUserCommand(query, context);
  if (agenticResult) {
    return agenticResult;
  }

  const weightKg = context.userWeightKg || 75;
  const proteinMin = Math.round(weightKg * 1.6);
  const proteinMax = Math.round(weightKg * 2.2);
  const creatineGrams = 5;
  const waterLiters = (weightKg * 0.04).toFixed(1);

  // 1. LIMPIEZA INTELIGENTE Y EXTRACCIÓN DE NOMBRES/CARGAS DE RUTINA
  const isRoutineCleanupQuery =
    /\b(?:limpi(?:a|ar|ame)\s+(?:los\s+)?(?:nombres?|ejercicios?|mi\s+rutina)|quit(?:a|ar|ame)\s+(?:el\s+)?(?:texto\s+extra|ruido)|arregl(?:a|ar|ame)\s+(?:los\s+)?nombres?|nombre[s]?\s*de\s*ejercicio[s]?\s*sucio[s]?|texto\s*extra\s*en\s*mi\s*rutina)\b/i.test(
      q
    );

  if (isRoutineCleanupQuery && context.routineDays && context.routineDays.length > 0) {
    const { cleanedDays, changes } = cleanAllRoutineExercises(context.routineDays);

    let content = `### Limpieza Inteligente de Ejercicios y Asignación de Cargas\n\n`;
    if (changes.length > 0) {
      content += `He analizado los ejercicios de tu rutina base y limpiado todo el ruido residual en los nombres (kilos pegados, notas de series y secciones filtradas al importar). Extraje las cargas y series a sus casillas individuales:\n\n`;
      changes.forEach((c) => {
        const extras: string[] = [];
        if (c.weightExtracted) extras.push(`Carga: ${c.weightExtracted} kg`);
        if (c.setsExtracted) extras.push(`Series: ${c.setsExtracted}`);
        if (c.repsExtracted) extras.push(`Reps: ${c.repsExtracted}`);
        const extraNote = extras.length > 0 ? ` *(${extras.join(' · ')})*` : '';
        content += `- **${c.originalName}** ➔ **${c.cleanedName}**${extraNote}\n`;
      });
      content += `\nHe aplicado automáticamente estos nombres limpios y cargas a tu rutina.`;
    } else {
      content += `Revisé minuciosamente todos los ejercicios de tu rutina base y todos los nombres están 100% limpios y canónicos. También puedes pedirme cosas como:\n- *"Agrega Elevaciones Laterales en Polea 3x15 al Día 1"*\n- *"Cárgame el Día 2 de Pierna para entrenar hoy"*\n- *"Cambia Press de Banca a 3 series de 10 reps"*`;
    }

    const suggestedActions: AiActionSuggestion[] = [];
    if (changes.length > 0) {
      suggestedActions.push({
        id: 'act_apply_clean_routine',
        label: `✨ Aplicar Nombres Limpios y Cargas a mi Rutina (${changes.length} cambios)`,
        type: 'apply_routine_cleanup',
        autoExecute: true,
        payload: {
          cleanedDays,
        },
      });
    }

    return {
      content,
      suggestedActions,
      confidence: 99,
    };
  }

  // 2. RESUMEN / AUDITORÍA DE LA RUTINA ACTUAL O "¿QUÉ ME TOCA ENTRENAR HOY?"
  if (
    /\b(?:analiza(?:r)?\s+mi\s+rutina|que\s+tengo\s+en\s+mi\s+rutina|revisa(?:r)?\s+mi\s+rutina|optimiza(?:r)?\s+mi\s+rutina|cual\s+es\s+mi\s+rutina|muestrame\s+mi\s+rutina|que\s+(?:me\s+toca\s+)?entrena(?:r|mos)\s+hoy|que\s+hago\s+hoy|plan\s+de\s+hoy)\b/i.test(
      q
    ) &&
    context.routineDays &&
    context.routineDays.length > 0
  ) {
    const activeDays = context.routineDays.filter((d) => !d.isRestDay);
    const emptyDays = activeDays.filter((d) => d.exercises.length === 0);

    let content = `### ❖ Auditoría Científica de tu Rutina Actual (**${context.routineName || 'Mi Rutina'}**)\n\n`;
    for (const d of context.routineDays) {
      if (d.isRestDay) {
        content += `- **${d.label} (${d.focusTitle}):** Día de recuperación fisiológica.\n`;
      } else if (d.exercises.length === 0) {
        content += `- **${d.label} (${d.focusTitle}):** ⚠️ *Sin ejercicios configurados aún (0 ejercicios).* Puedo completarlo automáticamente ahora mismo.\n`;
      } else {
        const totalSets = d.exercises.reduce((acc, e) => acc + (e.sets || 3), 0);
        content += `- **${d.label} (${d.focusTitle} · ${d.exercises.length} ejercicios · ${totalSets} series):** ${d.exercises.map((e) => `${e.name} (${e.sets}×${e.repRangeLabel})`).join(', ')}\n`;
      }
    }

    content += `\n**Acciones interactivas que puedo ejecutar por ti ahora mismo:**\n`;
    content += `- Toca cualquiera de los botones de abajo para **cargar un día completo en tu entrenamiento de hoy** o **completar días vacíos**. También puedes escribirme: *"Agrega Press Militar 3x10 al Día 1"* o *"Cambia Press de Banca por Press Inclinado con Mancuernas"*.`;

    const suggestedActions: AiActionSuggestion[] = [];

    for (const emptyDay of emptyDays) {
      const populated = populateRoutineDayByFocus(emptyDay);
      const updatedDays = context.routineDays.map((d) =>
        d.id === emptyDay.id ? populated : d
      );
      suggestedActions.push({
        id: `act_fill_empty_${emptyDay.id}`,
        label: `⚡ Completar ${emptyDay.label} (${emptyDay.focusTitle}) con 6 ejercicios científicos`,
        type: 'update_routine_days',
        payload: {
          updatedDays,
          targetDayId: emptyDay.id,
        },
      });
    }

    for (const d of activeDays.filter((day) => day.exercises.length > 0)) {
      suggestedActions.push({
        id: `act_load_audit_${d.id}`,
        label: `▶️ Cargar ${d.label} (${d.focusTitle}) en mi entrenamiento de hoy`,
        type: 'load_routine_day_to_workout',
        payload: {
          targetDayId: d.id,
          targetDayLabel: `${d.label} · ${d.focusTitle}`,
        },
      });
    }

    return {
      content,
      suggestedActions,
      confidence: 98,
    };
  }

  // 3. TIEMPOS DE DESCANSO ENTRE SERIES (HIPERTROFIA VS FUERZA VS AISLAMIENTO)
  if (
    /\b(?:cuanto\s+(?:tiempo\s+)?(?:debo|deberia)?\s*descansar|tiempo\s+de\s+descanso|descansar\s+entre\s+series|descanso\s+en\s+este\s+ejercicio|descansos?\s+cortos?\s+o\s+largos?)\b/i.test(
      q
    )
  ) {
    const content =
      `### Fisiología del Descanso entre Series (*Singer et al., 2024; Grgic et al., 2022*)\n\n` +
      `El tiempo de descanso determina cuánta **fosfocreatina (PCr)** resintetizas y cuánta fatiga central disipas antes de la siguiente serie:\n\n` +
      `1. **Fuerza Máxima (>82% 1RM · 1–5 reps):** **180 a 300 segundos (3–5 min)**. A los 90s solo has recuperado ~70% de tu fosfocreatina; a los 3–4 minutos superas el 95%.\n` +
      `2. **Hipertrofia en Compuestos Pesados (Sentadilla Hack, Press de Banca Plano, Peso Muerto Rumano):** **120 a 180 segundos (2–3 min)**. Descansar menos de 90s reduce el volumen total y frena la hipertrofia.\n` +
      `3. **Aislamiento y Poleas (Elevaciones Laterales en Polea, Curl Bayesiano, Extensiones):** **75 a 90 segundos**. Al involucrar menor masa muscular, la recuperación local y sistémica es más rápida.\n\n` +
      `*Activa tu temporizador de descanso con 1 toque abajo:*`;

    return {
      content,
      suggestedActions: [
        {
          id: 'act_rest_90',
          label: '⏱️ Iniciar descanso de 90s (Aislamiento)',
          type: 'start_rest_timer',
          payload: { restSeconds: 90 },
        },
        {
          id: 'act_rest_120',
          label: '⏱️ Iniciar descanso de 120s (Hipertrofia Base)',
          type: 'start_rest_timer',
          payload: { restSeconds: 120 },
        },
        {
          id: 'act_rest_180',
          label: '⏱️ Iniciar descanso de 180s (Compuestos / Fuerza)',
          type: 'start_rest_timer',
          payload: { restSeconds: 180 },
        },
      ],
      confidence: 98,
    };
  }

  // 4. SUSTITUTOS POR MÁQUINA OCUPADA O MOLESTIA / DOLOR ARTICULAR
  if (
    /\b(?:sustituto|alternativa|maquina\s+(?:que\s+necesito\s+)?(?:esta\s+)?ocupada|reemplazo|me\s+duele|dolor\s+de|molestia\s+en|lesion)\b/i.test(
      q
    )
  ) {
    let content = `### Matriz de Sustitución Biomecánica de Alto SFR (*Israetel & Beardsley*)\n\n`;
    if (/\b(?:hombro|manguito|pecho|banca)\b/i.test(q)) {
      content +=
        `Para proteger la cápsula glenohumeral manteniendo el **100% de estímulo en pectoral y deltoides**:\n\n` +
        `- **En lugar de Press de Banca con Barra:** Usa **Press Inclinado con Mancuernas** con agarre neutro/semiprono (30° de inclinación y plano escapular a 45°).\n` +
        `- **En lugar de Press Militar tras nuca o barra recta:** Usa **Elevaciones Laterales en Polea** a la altura de la muñeca para máxima tensión en elongación sin pinzamiento subacromial.\n` +
        `- **En lugar de Fondos profundos:** Usa **Cruces en Polea Alta** controlando 2 segundos la fase excéntrica.`;
    } else if (/\b(?:rodilla|sentadilla|lumbar|espalda\s+baja)\b/i.test(q)) {
      content +=
        `Para reducir el cizallamiento patelofemoral y la compresión axial lumbar sin perder hipertrofia de pierna:\n\n` +
        `- **En lugar de Sentadilla Libre con Barra:** Usa **Sentadilla Hack** o **Prensa de Piernas 45°** colocando los pies ligeramente más altos en la plataforma.\n` +
        `- **En lugar de Peso Muerto Convencional:** Usa **Curl Femoral Sentado** (que genera ~40% más hipertrofia en isquiotibiales según *Maeo et al., 2023* con cero carga axial lumbar).\n` +
        `- **En lugar de Remo con Barra Libre:** Usa **Remo en Polea Baja** o remo con soporte en pecho.`;
    } else {
      content +=
        `Si tu estación o máquina está ocupada, aplica estas **equivalencias biomecánicas directas** sin perder estímulo:\n\n` +
        `- **Pectoral (Empuje):** **Press de Banca Plano** ⇄ **Press Inclinado con Mancuernas** ⇄ **Cruces en Polea Alta**.\n` +
        `- **Espalda (Tracción):** **Jalón al Pecho Agarre Neutro** ⇄ **Dominadas** · **Remo en Polea Baja** ⇄ **Remo con Mancuerna a Una Mano**.\n` +
        `- **Cuádriceps e Isquios:** **Sentadilla Hack** ⇄ **Prensa de Piernas 45°** · **Peso Muerto Rumano con Barra** ⇄ **Curl Femoral Sentado**.\n` +
        `- **Hombros y Brazos:** **Elevaciones Laterales en Polea** ⇄ **Elevaciones Laterales con Mancuernas** · **Curl Bayesiano en Polea** ⇄ **Curl Inclinado con Mancuernas**.\n\n` +
        `*Toca cualquiera de las alternativas abajo para añadirla inmediatamente a tu sesión:*`;
    }

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query, context),
      confidence: 97,
    };
  }

  // 5. 1RM ESTIMADA (e1RM), FUERZA MÁXIMA Y SEMANA DE DESCARGA (DELOAD)
  if (
    /\b(?:1rm|e1rm|descarga|deload|fatiga\s+acumulada|interpretar\s+mi\s+progresion|fuerza\s+maxima|powerlifting|velocidad\s+de\s+la\s+barra)\b/i.test(
      q
    )
  ) {
    const content =
      `### Gestión de 1RM Estimada (e1RM) y Protocolo de Descarga (*Nuckols, 2023; Pareja-Blanco, 2020*)\n\n` +
      `1. **Cómo interpretar tu 1RM Estimada (Fórmula de Epley en KAIROS):**\n` +
      `   - Tu **e1RM** ($\\text{Peso} \\times (1 + \\text{Reps}/30)$) mide tu fuerza máxima teórica sin el riesgo articular de probar 1 repetición al límite.\n` +
      `   - Si tu e1RM sube un **1.5% a 3% mensual**, tu sobrecarga progresiva es óptima. En bloques de fuerza máxima, detén la serie cuando la velocidad de la barra caiga un **20%** (**RPE 7.5–8.5 / RIR 2–3**).\n\n` +
      `2. **¿Cuándo programar una Semana de Descarga (Deload)?**\n` +
      `   - Cada **4 a 6 semanas** de entrenamiento intenso, o si notas caída de rendimiento en 2 sesiones seguidas, pesadez articular y mal descanso.\n` +
      `   - **Protocolo exacto de Deload:** Reduce el número de series un **40–50%** (ej. de 4 series baja a 2 series), mantén el peso al **80–85%** de tus cargas habituales y termina cada serie en **RIR 3–4** durante 7 días para disipar la fatiga del SNC sin perder adaptaciones neurales.`;

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query, context),
      confidence: 97,
    };
  }

  // 6. CARDIO, HIIT, QUEMA DE GRASA, ZONA 2, SALTO DE CUERDA Y HYROX
  if (
    /\b(?:hiit|(?:quemar|perder|eliminar|elimino|bajar)\s+grasa|definicion|cardio|zona\s*2|hyrox|roxzone|skierg|sled|cuerda|saltar\s+la\s+cuerda|running|correr|resistencia)\b/i.test(
      q
    )
  ) {
    let content = `### Fisiología del Acondicionamiento Híbrido, Cardio y Oxidación de Grasa\n\n`;
    if (/\b(?:hyrox|roxzone|skierg|sled)\b/i.test(q)) {
      content +=
        `Basado en el análisis fisiológico de **Hyrox** (*Villaroel et al., 2025; Hunter McIntyre*):\n\n` +
        `- **Pacing en Ergómetros (SkiErg y Rowing):** Mantente al **80–83% de tu FCmáx** (debajo de tu umbral de lactato LT2). Forzar 10s más rápido en el SkiErg dispara el lactato y te hace perder más de 90s en los tramos de carrera.\n` +
        `- **Carrera Comprometida (8 × 1km):** Representa más del 50% del tiempo total. Entrénala realizando intervalos de 1000m inmediatamente después de **Sentadilla Hack** o zancadas.\n` +
        `- **Eficiencia en Roxzone:** Hidrátate en movimiento y limita tu paso por la zona de transición a menos de 25 segundos.`;
    } else {
      content +=
        `Para oxidar grasa preservando el **100% de tu masa muscular** (*Schumann et al., 2022; Seiler; San Millán*):\n\n` +
        `1. **Regla de Oro de No-Interferencia:** Realiza siempre tu sesión de **Pesas / Fuerza PRIMERO**, y coloca el Cardio o HIIT al final de la sesión o separado por 6 horas.\n` +
        `2. **Distribución Polarizada 80/20:**\n` +
        `   - **80% en Zona 2 (60–70% FCmáx · RPE 3–4):** Trote conversacional o bici de 30–45 min. Estimula la biogénesis mitocondrial y la máxima oxidación de ácidos grasos.\n` +
        `   - **20% en HIIT / Intervalos (Zona 4–5):** Ej. **Salto de Cuerda** (6 rondas de 90s trabajo / 30s descanso a 150 RPM) o Sprints (8 rondas de 20s a tope / 40s suaves).\n` +
        `3. **Balance Energético:** Acompaña con un déficit moderado (-350 a -450 kcal) y **${Math.round(weightKg * 2.1)}g de proteína/día** para blindar tu musculatura.`;
    }

    return {
      content,
      suggestedActions: [
        {
          id: 'act_rest_hiit',
          label: '⏱️ Iniciar Timer de Intervalos / Descanso (90s)',
          type: 'start_rest_timer',
          payload: { restSeconds: 90 },
        },
        ...extractActionSuggestionsFromText(content, query, context),
      ],
      confidence: 97,
    };
  }

  // 7. SUEÑO, RECUPERACIÓN, AGUJETA (DOMS) Y HRV
  if (
    /\b(?:sueno|dormi(?:r)?\s+mal|insomnio|recuperacion|cansado|fatigado|agujetas|doms|hrv|rmssd|descanso\s+nocturno)\b/i.test(
      q
    )
  ) {
    const content =
      `### Fisiología del Sueño, Recuperación y Autorregulación (*Walker, 2022; Altini, 2024; Craven et al.*)\n\n` +
      `1. **Si dormiste menos de 6 horas hoy:**\n` +
      `   - La restricción aguda de sueño eleva la percepción de esfuerzo (+1 punto de RPE) y reduce la potencia neural.\n` +
      `   - **Ajuste inteligente hoy:** No intentes récords de 1RM. Reduce un **5% el peso en la barra**, guíate por **RIR 2** estricto y prioriza máquinas o poleas seguras.\n\n` +
      `2. **Sueño Profundo (Fase NREM 3) y Agujetas (DOMS):**\n` +
      `   - El **95% de la Hormona de Crecimiento (GH)** diaria se libera en las primeras 3–4 horas de sueño profundo.\n` +
      `   - Las agujetas (DOMS) NO son indicador de mayor crecimiento muscular; si duran más de 72 horas, tu volumen en esa sesión superó tu Volumen Máximo Recuperable (MRV).\n\n` +
      `3. **Telemetría HRV (RMSSD):** Si tu variabilidad cardíaca matutina cae por debajo de tu media de 7 días junto con pulsaciones en reposo altas, recorta 1 serie por ejercicio hoy.`;

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query, context),
      confidence: 96,
    };
  }

  // 8. RECOMENDACIÓN DE EJERCICIOS POR GRUPO MUSCULAR (PECHO, ESPALDA, PIERNA, HOMBRO, BRAZOS, GLÚTEO, CORE)
  if (
    /\b(?:ejercicios?\s+(?:para|de)|mejores\s+ejercicios|como\s+entrenar|rutina\s+de|crecer|desarrollar)\b/i.test(
      q
    ) &&
    /\b(?:pecho|pectoral|espalda|dorsal|pierna|cuadriceps|femoral|isquio|gluteo|hombro|deltoides|biceps|triceps|brazo|abdomen|core|gemelo|pantorrilla)\b/i.test(
      q
    )
  ) {
    let muscleHeader = 'Selección Científica de Ejercicios de Alto SFR';
    let explanation = '';

    if (/\b(?:pecho|pectoral)\b/i.test(q)) {
      muscleHeader = 'Pectoral Mayor (Clavicular y Esternocostal)';
      explanation =
        `Para hipertrofia máxima del pectoral enfatizando la tensión en máximo estiramiento (*Wolf et al., 2023*):\n\n` +
        `1. **Press Inclinado con Mancuernas** — 3–4 series × 8–10 reps (RIR 1–2 · Descanso 150s). Maximiza el haz clavicular superior con rango profundo.\n` +
        `2. **Press de Banca Plano** — 3 series × 6–8 reps (RIR 2 · Descanso 180s). Constructor base de tensión mecánica total.\n` +
        `3. **Cruces en Polea Alta** — 3 series × 12–15 reps (RIR 0–1 · Descanso 90s). Tensión continua en aducción completa sin fatiga axial.`;
    } else if (/\b(?:espalda|dorsal)\b/i.test(q)) {
      muscleHeader = 'Espalda Completa (Dorsal Ancho y Espesor Escapular)';
      explanation =
        `Combina tracción vertical en plano frontal/sagital con tracción horizontal controlada:\n\n` +
        `1. **Jalón al Pecho Agarre Neutro** — 3–4 series × 8–12 reps (RIR 1–2 · Descanso 120s). Alinea las fibras del dorsal ancho con excelente estabilidad.\n` +
        `2. **Remo en Polea Baja** — 3–4 series × 10–12 reps (RIR 1–2 · Descanso 120s). Deja protraer las escápulas en la fase excéntrica para estirar trapecio y romboides.\n` +
        `3. **Dominadas** — 3 series × 6–10 reps (RIR 1–2 · Descanso 150s). Tracción vertical de máxima activación neuromuscular.`;
    } else if (/\b(?:pierna|cuadriceps|femoral|isquio|gluteo|gemelo|pantorrilla)\b/i.test(q)) {
      muscleHeader = 'Tren Inferior (Cuádriceps, Isquiosurales y Glúteos)';
      explanation =
        `La evidencia (*Maeo et al., 2023; Kassiano et al., 2023*) demuestra la superioridad del estiramiento bajo carga en cadera y rodilla:\n\n` +
        `1. **Sentadilla Hack** — 3–4 series × 8–10 reps (RIR 1–2 · Descanso 180s). SFR 9.5/10 para cuádriceps con espalda protegida.\n` +
        `2. **Peso Muerto Rumano con Barra** — 3 series × 8–10 reps (RIR 2 · Descanso 150s). Tensión mecánica masiva en isquios y glúteo mayor.\n` +
        `3. **Curl Femoral Sentado** — 3 series × 10–15 reps (RIR 0–1 · Descanso 90s). Estira el isquiotibial desde la cadera produciendo ~40% más crecimiento que tumbado.`;
    } else if (/\b(?:hombro|deltoides)\b/i.test(q)) {
      muscleHeader = 'Deltoides (Lateral, Anterior y Posterior)';
      explanation =
        `Para construir amplitud en V ("V-Taper") priorizando la cabeza lateral con tensión en elongación:\n\n` +
        `1. **Elevaciones Laterales en Polea** — 4 series × 12–15 reps (RIR 0–1 · Descanso 75s). Coloca la polea a la altura de la muñeca para máxima tensión desde el inicio.\n` +
        `2. **Press Militar con Mancuernas** — 3 series × 8–10 reps (RIR 1–2 · Descanso 120s). Fuerza e hipertrofia del deltoides anterior.\n` +
        `3. **Pájaros en Máquina Peck Deck (Deltoides Posterior)** — 3 series × 12–15 reps (RIR 0–1 · Descanso 75s).`;
    } else {
      muscleHeader = 'Brazos y Core (Bíceps, Tríceps y Abdomen)';
      explanation =
        `El secreto en brazos es entrenar la cabeza larga en máxima elongación de hombro (*Maeo et al., 2023*):\n\n` +
        `1. **Curl Bayesiano en Polea** — 3–4 series × 10–14 reps (RIR 0–1 · Descanso 75s). Estira el bíceps con el hombro en hiperextensión.\n` +
        `2. **Extensión de Tríceps Tras Nuca en Polea** — 3–4 series × 10–14 reps (RIR 0–1 · Descanso 75s). Produce ~40% más hipertrofia en la cabeza larga que las extensiones con codos pegados.`;
    }

    const content =
      `### ❖ Top Ejercicios Basados en Evidencia: **${muscleHeader}**\n\n` +
      `${explanation}\n\n` +
      `*Toca los botones interactivos de abajo para añadir cualquiera de estos ejercicios a tu entrenamiento de hoy o a tu rutina base:*`;

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query, context),
      confidence: 98,
    };
  }

  // 9. PROTEÍNA, NUTRICIÓN Y SUPLEMENTACIÓN
  if (
    /\b(?:proteina|cuanta proteina|macros|gramos de proteina|nutricion|dieta|calorias|superavit|deficit|creatina|agua|cafeina|pre\s*entreno|suplemento|whey|electrolitos|sodio)\b/i.test(
      q
    )
  ) {
    let content = `### Prescripción Nutricional Basada en Evidencia\n\n`;

    if (/\b(?:proteina|cuanta proteina|agua|whey)\b/i.test(q)) {
      content +=
        `Para maximizar la síntesis proteica muscular (MPS) y la hipertrofia según tu peso actual (**${weightKg} kg**), la evidencia científica (*Morton et al., 2018; ISSN Position Stand*) recomienda:\n\n` +
        `- **Rango Óptimo:** **${proteinMin}g a ${proteinMax}g de proteína al día** (1.6 a 2.2 g por kg de peso corporal).\n` +
        `- **Distribución y Umbral de Leucina:** Dividida en 3 a 4 tomas de entre **${Math.round(weightKg * 0.4)}g y ${Math.round(weightKg * 0.55)}g** cada 3–4 horas para superar los ~3g de leucina que activan mTORC1.\n` +
        `- **Fuentes de Alto Valor Biológico (DIAAS):** Pollo, huevos enteros, pescado, carne magra, aislado de suero (whey) o yogur griego.\n\n` +
        `**Hidratación celular:** Consume **${waterLiters} litros de agua diarios**, añadiendo 500–800mg de sodio por litro en entrenamientos intensos de más de 60 min (*Dr. Andy Galpin*).`;
    } else if (/\b(?:creatina|cafeina|pre\s*entreno|suplemento)\b/i.test(q)) {
      content +=
        `### Suplementación Ergogénica con Grado de Evidencia A (*ISSN*)\n\n` +
        `- **Creatina Monohidrato:** **${creatineGrams}g al día** todos los días sin fase de carga. Satura un 20% más los depósitos de fosfocreatina para sostener más repeticiones a RIR 1–2.\n` +
        `- **Cafeína Anhidra (Pre-entreno):** **${Math.round(weightKg * 3)}mg a ${Math.round(weightKg * 5)}mg** (3–5 mg/kg) 45 min antes de sesiones pesadas. Reduce el esfuerzo percibido y eleva la velocidad de barra (evítala 8h antes de dormir).\n` +
        `- **Electrolitos (Sodio/Potasio):** 500–800mg de sodio intra-entreno para mantener el volumen plasmático y prevenir la deriva cardíaca.`;
    } else {
      content +=
        `Para optimizar tu composición corporal según tus **${weightKg} kg** (*Helms et al., 2014*):\n\n` +
        `- **Volumen / Superávit Limpio:** +250 a +350 kcal sobre mantenimiento (ganancia de 0.25–0.5% de peso semanal) para construir músculo minimizando grasa.\n` +
        `- **Definición / Déficit:** -350 a -500 kcal (pérdida de 0.5–1% semanal), elevando la proteína a **${Math.round(weightKg * 2.2)}g/día** para blindar tu masa muscular.\n` +
        `- **Grasas esenciales:** Mínimo **${Math.round(weightKg * 0.8)}g/día** (0.8 g/kg) para sostener el entorno hormonal.`;
    }

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query, context),
      confidence: 97,
    };
  }

  // 10. ARQUITECTURA DE RUTINA, VOLUMEN Y PERIODIZACIÓN
  if (
    /\b(?:volumen semanal|orden de ejercicios|cuantas series|division|frecuencia|como armar|como organizar|como estructurar|split|torso\s*pierna|ppl|calentamiento|aproximacion)\b/i.test(
      q
    )
  ) {
    const content =
      `### Arquitectura de Rutina & Volumen Óptimo (*Schoenfeld; Israetel; Pelland et al., 2024*)\n\n` +
      `Para estructurar una rutina de máxima eficiencia en **KAIROS**:\n\n` +
      `1. **Volumen Semanal por Músculo (Series Efectivas a RIR 1–2):**\n` +
      `   - **Mantenimiento (MV):** 4–6 series semanales.\n` +
      `   - **Volumen Óptimo de Ganancias (MAV):** **10 a 20 series semanales** por grupo muscular, repartidas en Frecuencia 2 (nunca más de 8–10 series de un mismo músculo en un solo día).\n\n` +
      `2. **Protocolo de Calentamiento (Series de Aproximación):**\n` +
      `   - En el primer ejercicio compuesto del día realiza 3 series progresivas lejos del fallo: **50% × 8 reps** ➔ **70% × 4 reps** ➔ **85% × 1–2 reps**; descansa 2 min y entra a tu primera serie efectiva con el sistema nervioso potenciado.\n\n` +
      `3. **Edición Directa Conmigo:** Dime *"Agrega Elevaciones Laterales en Polea 3x15 al Día 1"* o *"Cárgame el Día 1 en mi entrenamiento de hoy"* y lo aplicaré al instante.`;

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query, context),
      confidence: 96,
    };
  }

  // 11. SOBRECARGA PROGRESIVA Y RIR/RPE
  if (
    /\b(?:sobrecarga progresiva|rir|rpe|al fallo|fallo muscular|progresar|estancado|estancamiento)\b/i.test(
      q
    )
  ) {
    const content =
      `### Principio de Sobrecarga Progresiva & Proximidad al Fallo (*Beardsley; Robinson et al., 2024*)\n\n` +
      `Para generar tensión mecánica máxima (el motor primario del crecimiento muscular), aplica estas reglas en **KAIROS**:\n\n` +
      `1. **Proximidad al Fallo (RIR 1–2):** Terminar tus series guardando 1 a 2 repeticiones en reserva produce el mismo crecimiento muscular que llegar al fallo total (RIR 0), pero reduce a la mitad la fatiga neuromuscular.\n` +
      `2. **Doble Progresión:** En un rango de 8–12 reps, mantén el peso fijo hasta lograr 12 reps en todas las series con técnica impecable; en la siguiente sesión sube 1.25–2.5 kg y vuelve a 8 reps.\n` +
      `3. **Tempo Estirado:** Controla la bajada 2 segundos y haz una micropausa en el punto de máximo estiramiento.`;

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query, context),
      confidence: 96,
    };
  }

  // 12. CALISTENIA / ISOMÉTRICOS DE PALANCA
  if (
    /\b(?:calistenia|isometrico|front lever|planche|handstand|pino|muscle up|dominadas|fondos|l-sit|palanca)\b/i.test(
      q
    )
  ) {
    const content =
      `### Biomecánica de Calistenia y Palancas Gimnásticas (*Steven Low; Lum & Barbosa, 2022*)\n\n` +
      `- **Regla del 70–80% en Isométricos:** En **Planche** o **Front Lever**, si tu aguante máximo es de 12s, entrena **4 a 5 series de 8–9 segundos** impecables (acumulando 35–45s de tiempo bajo tensión total) sin perder bloqueo de codos.\n` +
      `- **Posición Escapular:** En Planche aplica **protracción y depresión máxima** (serrato anterior); en Front Lever aplica **retracción activa y depresión**.\n` +
      `- **Remodelación Tendinosa:** Los tendones tardan de **6 a 12 semanas** en adaptar su colágeno a brazos rectos. No avances de progresión (Tuck ➔ Adv. Tuck ➔ Straddle ➔ Full) hasta dominar 5×12s sin molestia articular.\n` +
      `- **Descanso Neural:** Descansa **150 a 180 segundos** entre intentos isométricos.`;

    return {
      content,
      suggestedActions: [
        {
          id: 'act_rest_cali',
          label: '⏱️ Iniciar descanso neural de 150 segundos',
          type: 'start_rest_timer',
          payload: { restSeconds: 150 },
        },
        ...extractActionSuggestionsFromText(content, query, context),
      ],
      confidence: 96,
    };
  }

  // 13. GUARDRAIL FUERA DE CONTEXTO (OFF-TOPIC REDIRECT)
  if (
    /\b(?:politica|pelicula|pizza|pastel|futbol|presidente|clima|chiste|horoscopo|programar|python|historia|bitcoin|cripto|videojuego)\b/i.test(
      q
    )
  ) {
    return {
      content:
        `### ❖ Enfoque Exclusivo en Alto Rendimiento — KAIROS\n\n` +
        `Mi arquitectura está dedicada exclusivamente a **ciencias del deporte, biomecánica, hipertrofia, fuerza, acondicionamiento híbrido (Hyrox/Cardio), nutrición deportiva y gestión inteligente de tu entrenamiento en KAIROS**.\n\n` +
        `¿En qué área de tu preparación física deseas que trabajemos hoy? Puedo analizar tu rutina, recomendarte ejercicios de alto SFR, calcular tus macros para tus **${weightKg} kg** o cargar tu sesión del día.`,
      suggestedActions: [],
      confidence: 99,
    };
  }

  // 14. CONSULTA ESPECÍFICA DE EJERCICIOS Y BIOMECÁNICA PROFUNDA
  // Only match when query isn't a long unrelated question
  const candidateResolved = resolveExerciseIntelligently(query);
  if (
    (candidateResolved.isCanonicalMatch || candidateResolved.confidence >= 72) &&
    q.split(/\s+/).length <= 10
  ) {
    const exName = candidateResolved.canonicalName;
    const dp = candidateResolved.deepProfile;
    const rest = candidateResolved.defaultRestSeconds;

    const content =
      `### Dossier Biomecánico y Fisiológico: **${exName}**\n\n` +
      `- **Músculos Principales (Agonistas · 100% Estímulo):** ${dp.primaryMuscles.join(', ')}\n` +
      `- **Músculos Necesarios (Sinergistas · ~50% Carga Asociada):** ${dp.secondaryMuscles.join(', ')}\n` +
      `- **Músculos Estabilizadores:** ${dp.stabilizerMuscles.join(', ')}\n` +
      `- **Patrón y Mecánica:** ${dp.movementPattern} · ${dp.mechanicType} (${dp.equipmentType})\n` +
      `- **Perfil de Resistencia:** ${dp.resistanceProfile}\n` +
      `- **Variables de Fatiga y Estímulo:**\n` +
      `  - **Ratio Estímulo/Fatiga (SFR):** **${dp.sfrScore}/10**\n` +
      `  - **Fatiga del SNC (Neural):** **${dp.cnsFatigueIndex}/10** (Coeficiente: ${dp.fatigueCoefficient.toFixed(2)}x)\n` +
      `  - **Fatiga Muscular Local:** **${dp.localFatigueIndex}/10**\n` +
      `  - **Estrés Articular:** **${dp.jointStress.level}** (${dp.jointStress.joints.join(', ')})\n` +
      `  - **Ventana de Recuperación Fisiológica:** **~${dp.recoveryHours} horas**\n` +
      `- **Clave Biomecánica (*Cue*):** ${dp.biomechanicalCue}\n\n` +
      `**Recomendación de Programación en KAIROS:**\n` +
      `- **Series y Rango Óptimo:** 3–4 series efectivas de **${dp.optimalRepRange}** a **RIR 1–2**.\n` +
      `- **Descanso Fisiológico Recomendado:** **${rest} segundos** para resíntesis completa de ATP/fosfocreatina.\n\n` +
      `*Usa los botones interactivos a continuación para añadirlo con 1 toque a tu entrenamiento de hoy o a tu rutina base:*`;

    return {
      content,
      suggestedActions: extractActionSuggestionsFromText(content, query, context),
      confidence: 96,
    };
  }

  // 15. RESPUESTA CIENTÍFICA CONTEXTUALIZADA Y ACCIONES DIRECTAS
  const activeDayHint =
    context.routineDays?.find((d) => !d.isRestDay && d.exercises.length > 0) ?? null;

  const defaultActions: AiActionSuggestion[] = [];
  if (activeDayHint) {
    defaultActions.push({
      id: `act_quick_load_${activeDayHint.id}`,
      label: `▶️ Cargar ${activeDayHint.label} (${activeDayHint.focusTitle}) para entrenar hoy`,
      type: 'load_routine_day_to_workout',
      payload: {
        targetDayId: activeDayHint.id,
        targetDayLabel: `${activeDayHint.label} · ${activeDayHint.focusTitle}`,
      },
    });
  }

  const content =
    `### ❖ KAIROS AI Coach · Asesoría Científica & Control en Vivo\n\n` +
    `Estoy sincronizado con tu perfil (**${weightKg} kg** · meta de **${proteinMin}–${proteinMax}g de proteína/día**)${
      context.routineName ? ` y tu rutina **${context.routineName}**` : ''
    }.\n\n` +
    `**Puedes preguntarme o pedirme directamente:**\n` +
    `- **Consultas científicas específicas:** *"¿Qué ejercicios me recomiendas para pecho o espalda?"*, *"¿Cuánto descansar entre series?"*, *"Sustituto si la máquina está ocupada"*, *"¿Cuándo hacer descarga (deload)?"* o *"¿Cómo entrenar para Hyrox / Zona 2?"*\n` +
    `- **Biomecánica de cualquier ejercicio:** Escribe el nombre de un ejercicio (ej. *"Sentadilla Hack"*, *"Press Inclinado"*, *"Curl Bayesiano"*) para ver sus músculos agonistas, SFR y fatiga neural.\n` +
    `- **Edición en vivo de tu rutina:** *"Agrega Elevaciones Laterales en Polea 3x15 al Día 1"*, *"Cambia Press de Banca por Press Inclinado con Mancuernas"* o *"Cárgame el Día 1 para entrenar hoy"*.`;

  return {
    content,
    suggestedActions: [
      ...defaultActions,
      ...extractActionSuggestionsFromText(content, query, context),
    ],
    confidence: 92,
  };
}
