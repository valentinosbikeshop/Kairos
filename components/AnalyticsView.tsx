'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useKairos } from '@/lib/kairosContext';
import { computeExecutiveStats } from '@/lib/analyticsEngine';
import { normalizeSearchText } from '@/lib/exerciseDatabase';
import {
  getAgeFromBirthDate,
  getProfileAge,
  getResolvedWorkoutDefaults,
} from '@/lib/formatters';
import { RirValue } from '@/types/kairos';
import { VectorEvolutionChart } from '@/components/VectorEvolutionChart';
import { AppUpdateButton } from '@/components/AppUpdateManager';
import { Check, Search, SlidersHorizontal, X } from 'lucide-react';

export function AnalyticsView() {
  const { sessions, evaluations, catalog, profile, saveUserProfile } = useKairos();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [editingBody, setEditingBody] = useState(false);
  const [editingDefaults, setEditingDefaults] = useState(false);

  const resolvedDefaults = useMemo(() => getResolvedWorkoutDefaults(profile), [profile]);

  const [defRestInput, setDefRestInput] = useState<number>(resolvedDefaults.defaultRestSeconds);
  const [defRepsInput, setDefRepsInput] = useState<number>(resolvedDefaults.defaultReps);
  const [defEffectiveSetsInput, setDefEffectiveSetsInput] = useState<number>(
    resolvedDefaults.defaultEffectiveSets
  );
  const [defWarmupSetsInput, setDefWarmupSetsInput] = useState<number>(
    resolvedDefaults.defaultWarmupSets
  );
  const [defRirInput, setDefRirInput] = useState<RirValue>(resolvedDefaults.defaultRir);
  const [defRpeInput, setDefRpeInput] = useState<number>(resolvedDefaults.defaultRpe);
  const [defIsoSecInput, setDefIsoSecInput] = useState<number>(
    resolvedDefaults.defaultIsometricSeconds
  );
  const [defAutoRestInput, setDefAutoRestInput] = useState<boolean>(
    resolvedDefaults.autoStartRestTimer
  );

  // Quick body metrics edit state
  const [weightInput, setWeightInput] = useState(
    profile?.weightKg ? String(profile.weightKg) : ''
  );
  const [heightInput, setHeightInput] = useState(
    profile?.heightCm ? String(profile.heightCm) : ''
  );
  const [fatInput, setFatInput] = useState(
    profile?.bodyFatPercent !== undefined ? String(profile.bodyFatPercent) : ''
  );
  const [birthDateInput, setBirthDateInput] = useState(profile?.birthDate ?? '');

  useEffect(() => {
    if (profile) {
      setWeightInput(String(profile.weightKg));
      setHeightInput(String(profile.heightCm));
      setFatInput(profile.bodyFatPercent !== undefined ? String(profile.bodyFatPercent) : '');
      setBirthDateInput(profile.birthDate ?? '');
      const d = getResolvedWorkoutDefaults(profile);
      setDefRestInput(d.defaultRestSeconds);
      setDefRepsInput(d.defaultReps);
      setDefEffectiveSetsInput(d.defaultEffectiveSets);
      setDefWarmupSetsInput(d.defaultWarmupSets);
      setDefRirInput(d.defaultRir);
      setDefRpeInput(d.defaultRpe);
      setDefIsoSecInput(d.defaultIsometricSeconds);
      setDefAutoRestInput(d.autoStartRestTimer);
    }
  }, [profile]);

  const execStats = useMemo(
    () => computeExecutiveStats(sessions, evaluations),
    [sessions, evaluations]
  );

  // Somatic composition calculations personalized to user's profile
  const somaticInsights = useMemo(() => {
    if (!profile) return null;
    const heightM = profile.heightCm / 100;
    const bmi = heightM > 0 ? Math.round((profile.weightKg / (heightM * heightM)) * 10) / 10 : 0;
    const leanMassKg =
      profile.bodyFatPercent !== undefined
        ? Math.round(profile.weightKg * (1 - profile.bodyFatPercent / 100) * 10) / 10
        : null;
    return { bmi, leanMassKg };
  }, [profile]);

  const searchableIndexByCatalogId = useMemo(() => {
    const map = new Map<string, string[]>();
    catalog.forEach((item) => {
      const terms = [item.name, item.muscleGroup, ...(item.aliases ?? [])].map((t) =>
        normalizeSearchText(t)
      );
      map.set(item.id, terms);
    });
    return map;
  }, [catalog]);

  const filteredEvaluations = useMemo(() => {
    const qNorm = normalizeSearchText(searchQuery);
    const qCompact = qNorm.replace(/\s+/g, '');
    const tokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];

    return evaluations.filter((ev) => {
      if (!qNorm) return true;
      const candidateNorms = [
        normalizeSearchText(ev.exerciseName),
        ...(searchableIndexByCatalogId.get(ev.catalogId) ?? []),
      ];
      for (const cand of candidateNorms) {
        const candCompact = cand.replace(/\s+/g, '');
        if (cand.includes(qNorm) || (qCompact.length >= 3 && candCompact.includes(qCompact))) {
          return true;
        }
      }
      const combinedPool = candidateNorms.join(' ');
      return tokens.length > 0 && tokens.every((tk) => combinedPool.includes(tk));
    });
  }, [evaluations, searchQuery, searchableIndexByCatalogId]);

  useEffect(() => {
    if (!filteredEvaluations.length) return;
    const stillValid = filteredEvaluations.some((e) => e.catalogId === selectedCatalogId);
    if (!stillValid) {
      setSelectedCatalogId(filteredEvaluations[0].catalogId);
    }
  }, [filteredEvaluations, selectedCatalogId]);

  const activeEvaluation = useMemo(
    () =>
      filteredEvaluations.find((e) => e.catalogId === selectedCatalogId) ??
      filteredEvaluations[0] ??
      null,
    [filteredEvaluations, selectedCatalogId]
  );

  const fatigueNotes = useMemo(
    () => evaluations.filter((e) => e.status === 'regress'),
    [evaluations]
  );

  const handleSaveBodyUpdate = async () => {
    if (!profile) return;
    const w = parseFloat(weightInput) || profile.weightKg;
    const h = parseFloat(heightInput) || profile.heightCm;
    const bf = fatInput.trim() ? parseFloat(fatInput) : undefined;
    const nextAge = getAgeFromBirthDate(birthDateInput) ?? profile.age;
    await saveUserProfile({
      ...profile,
      birthDate: birthDateInput.trim() || profile.birthDate,
      age: nextAge,
      weightKg: Math.round(w * 10) / 10,
      heightCm: Math.round(h * 10) / 10,
      bodyFatPercent:
        bf !== undefined && bf >= 3 && bf <= 60 ? Math.round(bf * 10) / 10 : undefined,
      updatedAtIso: new Date().toISOString(),
    });
    setEditingBody(false);
  };

  const handleSaveWorkoutDefaults = async () => {
    if (!profile) return;
    await saveUserProfile({
      ...profile,
      workoutDefaults: {
        defaultRestSeconds: Math.max(15, Math.min(600, Math.round(defRestInput || 120))),
        defaultReps: Math.max(1, Math.min(100, Math.round(defRepsInput || 10))),
        defaultEffectiveSets: Math.max(1, Math.min(12, Math.round(defEffectiveSetsInput || 3))),
        defaultWarmupSets: Math.max(0, Math.min(8, Math.round(defWarmupSetsInput || 0))),
        defaultRir: defRirInput,
        defaultRpe: Math.max(5, Math.min(10, Math.round((defRpeInput || 8) * 2) / 2)),
        defaultIsometricSeconds: Math.max(5, Math.min(300, Math.round(defIsoSecInput || 15))),
        autoStartRestTimer: defAutoRestInput,
      },
      updatedAtIso: new Date().toISOString(),
    });
    setEditingDefaults(false);
  };

  return (
    <div className="px-5 ios-page-safe-pt pb-28 space-y-6">
      {/* Calm Gothic Title + Direct Update Button */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="font-gothic text-xl font-semibold tracking-wide text-brand">
            Tu Evolución Física
          </h1>
          <p className="text-xs text-brand-muted">
            Seguimiento personal adaptado a tu composición corporal.
          </p>
        </div>
        <AppUpdateButton />
      </div>

      {/* ================= PERSONAL BODY COMPOSITION CARD ================= */}
      {profile && (
        <section className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-gothic text-xs font-semibold uppercase tracking-widest text-gothic">
              Perfil Corporal
            </h2>
            <button
              type="button"
              onClick={() => setEditingBody((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-brand-muted hover:text-brand"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{editingBody ? 'Cancelar' : 'Actualizar'}</span>
            </button>
          </div>

          {!editingBody ? (
            <div className="grid grid-cols-4 gap-2 pt-0.5">
              <div>
                <span className="block text-[11px] text-brand-muted">Peso</span>
                <span className="text-sm font-semibold tabular-nums text-brand">
                  {profile.weightKg} kg
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-brand-muted">Altura</span>
                <span className="text-sm font-semibold tabular-nums text-brand">
                  {profile.heightCm} cm
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-brand-muted">
                  {somaticInsights?.leanMassKg ? 'Masa magra' : '% Grasa'}
                </span>
                <span className="text-sm font-semibold tabular-nums text-brand">
                  {somaticInsights?.leanMassKg
                    ? `${somaticInsights.leanMassKg} kg`
                    : profile.bodyFatPercent
                      ? `${profile.bodyFatPercent}%`
                      : '—'}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-brand-muted">Edad</span>
                <span className="text-sm font-semibold tabular-nums text-brand">
                  {getProfileAge(profile) ? `${getProfileAge(profile)} a.` : '—'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1 animate-fade-up">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] text-brand-muted mb-1">Peso (kg)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-[16px] tabular-nums text-brand"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-brand-muted mb-1">Altura (cm)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    className="w-full rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-[16px] tabular-nums text-brand"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-brand-muted mb-1">% Grasa</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={fatInput}
                    onChange={(e) => setFatInput(e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-[16px] tabular-nums text-brand"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-brand-muted mb-1">Nacimiento</label>
                  <input
                    type="date"
                    value={birthDateInput}
                    onChange={(e) => setBirthDateInput(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-xl border border-stoneborder bg-background px-2 py-1.5 text-[14px] tabular-nums text-brand"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveBodyUpdate}
                className="w-full rounded-xl bg-brand py-2 text-xs font-bold uppercase tracking-wider text-background"
              >
                Guardar Medidas
              </button>
            </div>
          )}

          {profile.bodyFatPercent !== undefined && !editingBody && (
            <p className="border-t border-stoneborder/70 pt-2 text-[11px] text-brand-muted">
              Grasa estimada: {profile.bodyFatPercent}% · IMC referencial: {somaticInsights?.bmi}
            </p>
          )}
        </section>
      )}

      {/* ================= PREFERENCIAS DE ENTRENAMIENTO (POR DEFECTO) ================= */}
      {profile && (
        <section className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-gothic text-xs font-semibold uppercase tracking-widest text-gothic">
                Preferencias de Entrenamiento
              </h2>
              <p className="text-[11px] text-brand-muted mt-0.5">
                Valores iniciales al agregar un nuevo ejercicio a tu rutina o entrenamiento del día.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingDefaults((v) => !v)}
              className="shrink-0 inline-flex items-center gap-1 text-xs text-brand-muted hover:text-brand"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{editingDefaults ? 'Cancelar' : 'Personalizar'}</span>
            </button>
          </div>

          {!editingDefaults ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-0.5">
              <div className="rounded-xl border border-stoneborder/70 bg-background p-2.5">
                <span className="block text-[10px] text-brand-muted">Descanso/serie</span>
                <span className="text-xs font-semibold tabular-nums text-brand">
                  {resolvedDefaults.defaultRestSeconds}s
                </span>
              </div>
              <div className="rounded-xl border border-stoneborder/70 bg-background p-2.5">
                <span className="block text-[10px] text-brand-muted">Reps/serie</span>
                <span className="text-xs font-semibold tabular-nums text-brand">
                  {resolvedDefaults.defaultReps} reps
                </span>
              </div>
              <div className="rounded-xl border border-stoneborder/70 bg-background p-2.5">
                <span className="block text-[10px] text-brand-muted">Series efectivas</span>
                <span className="text-xs font-semibold tabular-nums text-brand">
                  {resolvedDefaults.defaultEffectiveSets} series
                </span>
              </div>
              <div className="rounded-xl border border-stoneborder/70 bg-background p-2.5">
                <span className="block text-[10px] text-brand-muted">Calentamiento</span>
                <span className="text-xs font-semibold tabular-nums text-brand">
                  {resolvedDefaults.defaultWarmupSets} series
                </span>
              </div>
              <div className="rounded-xl border border-stoneborder/70 bg-background p-2.5">
                <span className="block text-[10px] text-brand-muted">RIR / RPE</span>
                <span className="text-xs font-semibold tabular-nums text-brand">
                  RIR {resolvedDefaults.defaultRir} · @{resolvedDefaults.defaultRpe}
                </span>
              </div>
              <div className="rounded-xl border border-stoneborder/70 bg-background p-2.5">
                <span className="block text-[10px] text-brand-muted">Auto-Timer</span>
                <span className="text-xs font-semibold text-brand">
                  {resolvedDefaults.autoStartRestTimer ? 'Activo' : 'Manual'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1 animate-fade-up">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-brand-muted mb-1">
                    Descanso habitual (s)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={15}
                    max={600}
                    step={15}
                    value={defRestInput}
                    onChange={(e) => setDefRestInput(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-[16px] tabular-nums text-brand"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-brand-muted mb-1">
                    Repeticiones por serie
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    value={defRepsInput}
                    onChange={(e) => setDefRepsInput(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-[16px] tabular-nums text-brand"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-brand-muted mb-1">
                    Series efectivas / ej.
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={12}
                    value={defEffectiveSetsInput}
                    onChange={(e) => setDefEffectiveSetsInput(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-[16px] tabular-nums text-brand"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-brand-muted mb-1">
                    Series calentamiento / ej.
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={8}
                    value={defWarmupSetsInput}
                    onChange={(e) =>
                      setDefWarmupSetsInput(Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="w-full rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-[16px] tabular-nums text-brand"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-brand-muted mb-1">
                    RIR habitual (Hipertrofia)
                  </label>
                  <select
                    value={defRirInput}
                    onChange={(e) => setDefRirInput(e.target.value as RirValue)}
                    className="w-full rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-[15px] text-brand"
                  >
                    {(['0', '1', '2', '3', '4+'] as RirValue[]).map((r) => (
                      <option key={r} value={r}>
                        RIR {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-brand-muted mb-1">
                    Isométricos (s por serie)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={300}
                    step={5}
                    value={defIsoSecInput}
                    onChange={(e) => setDefIsoSecInput(parseInt(e.target.value, 10) || 15)}
                    className="w-full rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-[16px] tabular-nums text-brand"
                  />
                </div>
              </div>

              {/* Quick rest presets */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] text-brand-muted">Descanso rápido:</span>
                <div className="flex items-center gap-1.5">
                  {[60, 90, 120, 150, 180].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDefRestInput(sec)}
                      className={`rounded-lg border px-2 py-1 text-[11px] tabular-nums ${
                        defRestInput === sec
                          ? 'border-gothic bg-gothic/20 text-brand font-semibold'
                          : 'border-stoneborder bg-background text-brand-muted hover:text-brand'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-start rest timer toggle */}
              <button
                type="button"
                onClick={() => setDefAutoRestInput((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl border border-stoneborder bg-background px-3 py-2 text-xs"
              >
                <span className="text-brand-muted">
                  Iniciar temporizador de descanso al marcar serie (✓)
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                    defAutoRestInput
                      ? 'bg-gothic/20 text-brand border border-gothic/50'
                      : 'bg-surface text-brand-muted border border-stoneborder'
                  }`}
                >
                  {defAutoRestInput && <Check className="h-3 w-3 text-gothic" />}
                  {defAutoRestInput ? 'Activado' : 'Desactivado'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleSaveWorkoutDefaults}
                className="w-full rounded-xl bg-brand py-2 text-xs font-bold uppercase tracking-wider text-background"
              >
                Guardar Preferencias Predeterminadas
              </button>
            </div>
          )}
        </section>
      )}

      {/* ================= EMPTY STATE WHEN USER STARTS AT 0 SESSIONS ================= */}
      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-stoneborder bg-surface px-6 py-10 text-center space-y-3">
          <div className="text-xs text-gothic">❖</div>
          <h2 className="font-gothic text-base font-semibold text-brand">
            Tu Crónica Inicia en Blanco
          </h2>
          <p className="text-xs text-brand-muted leading-relaxed max-w-[260px] mx-auto">
            Aún no tienes entrenamientos guardados. Completa tu primera sesión en{' '}
            <strong className="text-brand font-medium">Entrenar</strong> para observar aquí la
            evolución de tus marcas.
          </p>
        </div>
      ) : (
        <>
          {/* Calm Consistency Summary (Just 2 clear metrics, zero clutter) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-stoneborder bg-surface p-4">
              <span className="block text-xs text-brand-muted">Sesiones cumplidas</span>
              <span className="mt-1 block font-gothic text-2xl font-semibold tabular-nums text-brand">
                {sessions.length}
              </span>
            </div>
            <div className="rounded-2xl border border-stoneborder bg-surface p-4">
              <span className="block text-xs text-brand-muted">Racha de disciplina</span>
              <span className="mt-1 block font-gothic text-2xl font-semibold tabular-nums text-gothic">
                {execStats.disciplineStreakDays}{' '}
                <span className="text-xs font-sans font-normal text-brand-muted">días</span>
              </span>
            </div>
          </div>

          {/* Exercise Progression Explorer */}
          <section className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-3.5">
            <h2 className="font-gothic text-xs font-semibold uppercase tracking-widest text-brand">
              Progreso por Ejercicio
            </h2>

            {/* Smart Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ejercicio (ej: press militar, sentadilla...)"
                className="w-full rounded-xl border border-stoneborder bg-background py-2 pl-9 pr-8 text-[16px] text-brand placeholder-brand-subtle focus:border-gothic focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Exercise Selector Chips */}
            {filteredEvaluations.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {filteredEvaluations.map((ev) => {
                  const selected = activeEvaluation?.catalogId === ev.catalogId;
                  return (
                    <button
                      key={ev.catalogId}
                      type="button"
                      onClick={() => setSelectedCatalogId(ev.catalogId)}
                      className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-gothic bg-gothic/15 text-brand'
                          : 'border-stoneborder bg-background text-brand-muted'
                      }`}
                    >
                      {ev.exerciseName}
                    </button>
                  );
                })}
              </div>
            )}

            {activeEvaluation ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-brand">
                  {activeEvaluation.exerciseName}
                </h3>
                <VectorEvolutionChart
                  evaluation={activeEvaluation}
                  userWeightKg={profile?.weightKg}
                />
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-brand-muted">
                Sin registros para esa búsqueda.
              </p>
            )}
          </section>

          {/* Calm Recovery Advice (only shown if fatigue is detected, without stock-alarm styling) */}
          {fatigueNotes.length > 0 && (
            <section className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-2.5">
              <h2 className="font-gothic text-xs font-semibold uppercase tracking-widest text-gothic">
                Sugerencias de Recuperación
              </h2>
              {fatigueNotes.slice(0, 3).map((ev) => (
                <div
                  key={ev.catalogId}
                  className="border-l-2 border-status-regress/60 pl-3 py-0.5 space-y-1"
                >
                  <span className="block text-xs font-semibold text-brand">
                    {ev.exerciseName}
                  </span>
                  <p className="text-xs text-brand-muted leading-relaxed">
                    {ev.recommendation ||
                      'Tu marca bajó ligeramente frente a tus sesiones previas; prioriza buen sueño y recuperación.'}
                  </p>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
