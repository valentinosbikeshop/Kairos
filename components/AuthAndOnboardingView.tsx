'use client';

import React, { useState } from 'react';
import { useKairos } from '@/lib/kairosContext';
import {
  BiologicalSex,
  ExperienceLevel,
  PrimaryGoalType,
  UserProfile,
} from '@/types/kairos';
import { RoutineSetupConfigurator } from '@/components/RoutineBuilderAndRationale';
import { ArrowRight, Lock, ShieldCheck, User } from 'lucide-react';

export function AuthAndOnboardingView() {
  const {
    user,
    profile,
    registerUser,
    loginUser,
    saveUserProfile,
    saveUserRoutine,
    completeOnboarding,
  } = useKairos();

  // Auth Gate State
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Onboarding Step State (Step 1: Body Data -> Step 2: Routine Setup)
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(() => (profile ? 2 : 1));
  const [sex, setSex] = useState<BiologicalSex>(profile?.sex ?? 'male');
  const [age, setAge] = useState<string>(profile?.age ? String(profile.age) : '24');
  const [heightCm, setHeightCm] = useState<string>(
    profile?.heightCm ? String(profile.heightCm) : '175'
  );
  const [weightKg, setWeightKg] = useState<string>(
    profile?.weightKg ? String(profile.weightKg) : '74'
  );
  const [bodyFat, setBodyFat] = useState<string>(
    profile?.bodyFatPercent !== undefined ? String(profile.bodyFatPercent) : ''
  );
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    profile?.experienceLevel ?? 'beginner'
  );
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoalType>(
    profile?.primaryGoal ?? 'hypertrophy'
  );
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmittingAuth(true);

    if (authMode === 'register') {
      const res = await registerUser({
        username,
        displayName: displayName.trim() || username.trim(),
        password,
      });
      if (!res.ok) {
        setAuthError(res.error || 'No se pudo crear la cuenta.');
      } else {
        setOnboardingStep(1);
      }
    } else {
      const res = await loginUser({ username, password });
      if (!res.ok) {
        setAuthError(res.error || 'Credenciales incorrectas.');
      }
    }
    setSubmittingAuth(false);
  };

  const handleSaveProfileStep = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    const a = parseInt(age, 10) || 25;
    const bf = bodyFat.trim() ? parseFloat(bodyFat) : undefined;

    if (!h || h < 110 || h > 240 || !w || w < 30 || w > 260) {
      setProfileError('Ingresa una altura (cm) y un peso (kg) válidos.');
      return;
    }

    setProfileError(null);
    const nextProfile: UserProfile = {
      sex,
      age: Math.max(13, Math.min(95, a)),
      heightCm: Math.round(h * 10) / 10,
      weightKg: Math.round(w * 10) / 10,
      bodyFatPercent:
        bf !== undefined && bf >= 3 && bf <= 60 ? Math.round(bf * 10) / 10 : undefined,
      experienceLevel,
      primaryGoal,
      updatedAtIso: new Date().toISOString(),
    };

    await saveUserProfile(nextProfile);
    setOnboardingStep(2);
  };

  // ==================== SCREEN 1: ACCOUNT CREATION / LOGIN ====================
  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col justify-center px-6 py-10 gothic-sanctuary-bg">
        {/* Gothic Emblem Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="text-xs tracking-[0.35em] text-gothic">❖</div>
          <h1 className="font-gothic text-3xl font-semibold tracking-[0.22em] text-brand">
            KAIROS
          </h1>
          <p className="text-xs text-brand-muted max-w-[270px] mx-auto leading-relaxed">
            Disciplina física y ciencia aplicada. Crea tu cuenta para resguardar tu progreso sin
            riesgo de perderlo.
          </p>
          <div className="gothic-divider w-36 mx-auto mt-3" />
        </div>

        {/* Auth Switcher */}
        <div className="rounded-2xl border border-stoneborder bg-surface p-5 space-y-4">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-background p-1 border border-stoneborder">
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setAuthError(null);
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                authMode === 'register'
                  ? 'bg-elevated text-brand border border-stoneborder'
                  : 'text-brand-muted'
              }`}
            >
              Crear Cuenta
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                authMode === 'login'
                  ? 'bg-elevated text-brand border border-stoneborder'
                  : 'text-brand-muted'
              }`}
            >
              Iniciar Sesión
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-3.5">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs text-brand-muted mb-1">Tu nombre</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej: Isaías"
                  className="w-full rounded-xl border border-stoneborder bg-background px-3.5 py-2.5 text-[16px] text-brand placeholder-brand-subtle focus:border-gothic focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-brand-muted mb-1">Usuario o correo</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-subtle" />
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="usuario o email"
                  className="w-full rounded-xl border border-stoneborder bg-background py-2.5 pl-10 pr-3.5 text-[16px] text-brand placeholder-brand-subtle focus:border-gothic focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-brand-muted mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-subtle" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full rounded-xl border border-stoneborder bg-background py-2.5 pl-10 pr-3.5 text-[16px] text-brand placeholder-brand-subtle focus:border-gothic focus:outline-none"
                />
              </div>
            </div>

            {authError && (
              <p className="rounded-xl border border-status-regress/40 bg-status-regress/10 px-3 py-2 text-xs text-brand">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={submittingAuth}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-xs font-bold uppercase tracking-widest text-background transition-opacity disabled:opacity-60 active:scale-[0.99]"
            >
              <span>
                {submittingAuth
                  ? 'Verificando...'
                  : authMode === 'register'
                    ? 'Crear Cuenta desde Cero'
                    : 'Entrar a mi Cuenta'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-brand-subtle text-center">
          <ShieldCheck className="h-3.5 w-3.5 text-gothic shrink-0" />
          <span>Datos respaldados en servidor: seguros aunque borres caché.</span>
        </div>
      </div>
    );
  }

  // ==================== SCREEN 2: POST-REGISTRATION ONBOARDING ====================
  return (
    <div className="min-h-[100dvh] px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-12 gothic-sanctuary-bg space-y-6">
      {/* Progress Indicator */}
      <div className="text-center space-y-1.5">
        <span className="font-gothic text-[11px] uppercase tracking-[0.22em] text-gothic">
          Paso {onboardingStep} de 2
        </span>
        <div className="flex items-center justify-center gap-2">
          <span
            className={`h-1 w-12 rounded-full ${
              onboardingStep >= 1 ? 'bg-gothic' : 'bg-stoneborder'
            }`}
          />
          <span
            className={`h-1 w-12 rounded-full ${
              onboardingStep >= 2 ? 'bg-gothic' : 'bg-stoneborder'
            }`}
          />
        </div>
      </div>

      {onboardingStep === 1 ? (
        <form onSubmit={handleSaveProfileStep} className="space-y-5 animate-fade-up">
          <div className="text-center space-y-1">
            <h1 className="font-gothic text-xl font-semibold tracking-wide text-brand">
              Bienvenido, {user.displayName}
            </h1>
            <p className="text-xs text-brand-muted leading-relaxed">
              Tu cuenta inicia limpia desde cero. Añade tus medidas actuales para personalizar tus
              análisis y cargas.
            </p>
          </div>

          <div className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-4">
            {/* Sex & Age */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-brand-muted mb-1.5">Perfil físico</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSex('male')}
                    className={`rounded-xl border py-2 text-xs font-medium ${
                      sex === 'male'
                        ? 'border-gothic bg-gothic/15 text-brand'
                        : 'border-stoneborder bg-background text-brand-muted'
                    }`}
                  >
                    Hombre
                  </button>
                  <button
                    type="button"
                    onClick={() => setSex('female')}
                    className={`rounded-xl border py-2 text-xs font-medium ${
                      sex === 'female'
                        ? 'border-gothic bg-gothic/15 text-brand'
                        : 'border-stoneborder bg-background text-brand-muted'
                    }`}
                  >
                    Mujer
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-brand-muted mb-1.5">Edad (años)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] tabular-nums text-brand focus:border-gothic focus:outline-none"
                />
              </div>
            </div>

            {/* Height & Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-brand-muted mb-1.5">Altura (cm)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="175"
                  className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] tabular-nums text-brand focus:border-gothic focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-brand-muted mb-1.5">Peso actual (kg)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  required
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="74"
                  className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] tabular-nums text-brand focus:border-gothic focus:outline-none"
                />
              </div>
            </div>

            {/* % Body Fat (Direct or Simple Visual Estimate Chips) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-brand-muted">% de Grasa Corporal (aprox.)</label>
                <span className="text-[11px] text-brand-subtle">Opcional</span>
              </div>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                placeholder={sex === 'male' ? 'Ej: 16' : 'Ej: 24'}
                className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] tabular-nums text-brand placeholder-brand-subtle focus:border-gothic focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(sex === 'male'
                  ? [
                      { label: 'Definido ~12%', val: '12' },
                      { label: 'Atlético ~16%', val: '16' },
                      { label: 'Promedio ~20%', val: '20' },
                      { label: '+25%', val: '25' },
                    ]
                  : [
                      { label: 'Definida ~19%', val: '19' },
                      { label: 'Atlética ~23%', val: '23' },
                      { label: 'Promedio ~27%', val: '27' },
                      { label: '+32%', val: '32' },
                    ]
                ).map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setBodyFat(preset.val)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                      bodyFat === preset.val
                        ? 'border-gothic bg-gothic/15 text-brand'
                        : 'border-stoneborder bg-background text-brand-muted'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div>
              <label className="block text-xs text-brand-muted mb-1.5">Nivel de experiencia</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'beginner', label: 'Principiante' },
                    { id: 'intermediate', label: 'Intermedio' },
                    { id: 'advanced', label: 'Avanzado' },
                  ] as { id: ExperienceLevel; label: string }[]
                ).map((lv) => (
                  <button
                    key={lv.id}
                    type="button"
                    onClick={() => setExperienceLevel(lv.id)}
                    className={`rounded-xl border py-2 text-xs font-medium ${
                      experienceLevel === lv.id
                        ? 'border-gothic bg-gothic/15 text-brand'
                        : 'border-stoneborder bg-background text-brand-muted'
                    }`}
                  >
                    {lv.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Goal */}
            <div>
              <label className="block text-xs text-brand-muted mb-1.5">Enfoque principal</label>
              <select
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value as PrimaryGoalType)}
                className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2.5 text-[16px] text-brand focus:border-gothic focus:outline-none"
              >
                <option value="hypertrophy">Ganar masa muscular y estética</option>
                <option value="recomp">Recomposición (ganar músculo y bajar grasa)</option>
                <option value="strength">Aumentar fuerza máxima</option>
                <option value="hybrid">Rendimiento híbrido y resistencia</option>
              </select>
            </div>
          </div>

          {profileError && (
            <p className="text-xs text-status-regress text-center">{profileError}</p>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-xs font-bold uppercase tracking-widest text-background active:scale-[0.99]"
          >
            <span>Guardar y Continuar</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <RoutineSetupConfigurator
            profile={profile}
            onSaveRoutine={async (createdRoutine) => {
              await saveUserRoutine(createdRoutine, true);
            }}
            onSkipOptional={() => {
              void completeOnboarding();
            }}
          />
        </div>
      )}
    </div>
  );
}
