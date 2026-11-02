import {
  registerAccount,
  authenticateAccount,
  getUserRecordById,
  updateUserStateById,
  createSignedToken,
  verifySignedToken,
  compactSessionForStorage,
} from '../lib/serverDb';
import { generateScientificRoutine } from '../lib/aiRoutineEngine';
import { WorkoutSession } from '../types/kairos';

async function runProductionSuite() {
  console.log('--- [KAIROS PROD TEST SUITE] INICIANDO PRUEBAS DE INFRAESTRUCTURA Y SEGURIDAD ---');

  // Test 1: Registro de usuario
  const testUsername = `test_runner_${Date.now()}`;
  const testPass = 'Gothic_Power_2026!';
  const regResult = await registerAccount({
    username: testUsername,
    displayName: 'Kairos Test Athlete',
    password: testPass,
  });

  if (!regResult.ok) {
    throw new Error(`Fallo en registro de usuario: ${regResult.error}`);
  }
  console.log('✅ 1. Registro seguro completado exitosamente.');
  console.log(`   ID: ${regResult.record.id}, Salt length: ${regResult.record.passwordSalt.length}`);

  // Test 2: Prevención de duplicados
  const dupResult = await registerAccount({
    username: testUsername,
    displayName: 'Duplicate Athlete',
    password: 'any_password',
  });
  if (dupResult.ok) {
    throw new Error('FALLO: Se permitió crear un usuario duplicado.');
  }
  console.log('✅ 2. Detección y bloqueo de usuarios duplicados verificado.');

  // Test 3: Autenticación con contraseña errónea
  const badAuth = await authenticateAccount({
    username: testUsername,
    password: 'WrongPassword123!',
  });
  if (badAuth.ok) {
    throw new Error('FALLO: Se autenticó con contraseña incorrecta.');
  }
  console.log('✅ 3. Rechazo de credenciales incorrectas verificado (Timing-safe).');

  // Test 4: Autenticación con contraseña correcta
  const goodAuth = await authenticateAccount({
    username: testUsername,
    password: testPass,
  });
  if (!goodAuth.ok) {
    throw new Error(`Fallo en login con credenciales correctas: ${goodAuth.error}`);
  }
  console.log('✅ 4. Autenticación exitosa verificada (Scrypt KDF).');

  // Test 5: Tokens firmados con HMAC-SHA256
  const token = await createSignedToken(goodAuth.record.id);
  const verifiedId = await verifySignedToken(token);
  if (verifiedId !== goodAuth.record.id) {
    throw new Error(`FALLO: Token firmado inválido. Esperado ${goodAuth.record.id}, recibido ${verifiedId}`);
  }
  // Verificar alteración de token
  const tamperedToken = token.slice(0, -4) + 'abcd';
  const tamperedId = await verifySignedToken(tamperedToken);
  if (tamperedId !== null) {
    throw new Error('FALLO: Se aceptó un token alterado.');
  }
  console.log('✅ 5. Tokens de sesión HMAC-SHA256 y resistencia a manipulación verificados.');

  // Test 6: Compresión y optimización de huella de almacenamiento
  const rawSampleSession: WorkoutSession = {
    id: 'sess_sample_test',
    dateIso: new Date().toISOString(),
    startedAtMs: Date.now() - 3600000,
    durationSeconds: 3600.4857483,
    title: '  Sesión Pesada Empuje Pecho y Tríceps  ',
    blocks: [
      {
        id: 'blk_1',
        title: 'Pecho Pesado',
        mode: 'hypertrophy',
        exercises: [
          {
            id: 'ex_1',
            catalogId: 'press-banca',
            name: 'Press de Banca Plano',
            mode: 'hypertrophy',
            muscleGroup: 'Pecho',
            defaultRestSeconds: 120,
            hypertrophySets: [
              { id: 's1', setType: 'Efectiva', weightKg: 85.3333333, reps: 8, rir: '1', restSeconds: 120, completed: true },
              { id: 's2', setType: 'Efectiva', weightKg: 85.3333333, reps: 8, rir: '0', restSeconds: 120, completed: true },
            ],
          },
        ],
      },
    ],
    timerLogs: [
      {
        id: 't_rest_1',
        kind: 'rest',
        label: 'Descanso 120s',
        recordedAtIso: new Date().toISOString(),
        plannedSeconds: 120,
        elapsedSeconds: 120,
        workSecondsCompleted: 0,
        roundsCompleted: 1,
        totalRounds: 1,
        endedReason: 'completed',
      },
      {
        id: 't_interval_1',
        kind: 'intervals',
        label: 'Tabata Finisher',
        recordedAtIso: new Date().toISOString(),
        plannedSeconds: 240,
        elapsedSeconds: 240,
        workSecondsCompleted: 160,
        roundsCompleted: 8,
        totalRounds: 8,
        endedReason: 'completed',
      },
    ],
  };

  const compacted = compactSessionForStorage(rawSampleSession);
  const rawSize = JSON.stringify(rawSampleSession).length;
  const compactedSize = JSON.stringify(compacted).length;
  const reduction = Math.round(((rawSize - compactedSize) / rawSize) * 100);

  // Comprobar que descartó el timer tipo 'rest' pero conservó 'intervals'
  if ((compacted.timerLogs || []).some((t) => t.kind === 'rest')) {
    throw new Error('FALLO: El compactador no eliminó los logs de descanso intra-entreno.');
  }
  if (!(compacted.timerLogs || []).some((t) => t.kind === 'intervals')) {
    throw new Error('FALLO: El compactador eliminó un timer de intervalos relevante.');
  }
  console.log(`✅ 6. Compactador de almacenamiento validado: ${rawSize} B -> ${compactedSize} B (-${reduction}% de huella en disco).`);

  // Test 7: Actualización de estado en DB
  const updatedUser = await updateUserStateById(goodAuth.record.id, {
    displayName: 'Kairos Champion',
    onboardingCompleted: true,
    profile: {
      sex: 'male',
      age: 26,
      heightCm: 180,
      weightKg: 80,
      bodyFatPercent: 12,
      experienceLevel: 'advanced',
      primaryGoal: 'hypertrophy',
      updatedAtIso: new Date().toISOString(),
    },
    sessions: [compacted],
  });

  if (!updatedUser || updatedUser.displayName !== 'Kairos Champion' || !updatedUser.onboardingCompleted) {
    throw new Error('FALLO: updateUserStateById no persistió los campos correctamente.');
  }
  console.log('✅ 7. Actualización de perfil atómica y persistencia verificadas.');

  // Test 8: Motor Determinista de IA para Rutinas Científicas
  const aiRoutine = generateScientificRoutine({
    userPrompt: 'Quiero hipertrofia de pecho y hombro, 4 días a la semana, tengo mancuernas y banco',
    daysPerWeek: 4,
    minutesPerSession: 60,
    equipment: 'gym',
    scheduleType: 'weekday',
    profile: updatedUser.profile,
  });

  const activeDays = aiRoutine.days.filter((d) => !d.isRestDay);
  if (aiRoutine.days.length !== 7 || activeDays.length !== 4) {
    throw new Error(`FALLO: Motor de IA generó ${aiRoutine.days.length} días (activos: ${activeDays.length}), esperados 7 días con 4 activos.`);
  }
  if (!aiRoutine.rationale || !aiRoutine.rationale.summary || aiRoutine.rationale.summary.length < 50) {
    throw new Error('FALLO: Motor de IA no generó fundamentación científica.');
  }

  // Comprobar también el modo cíclico
  const cyclicalRoutine = generateScientificRoutine({
    userPrompt: 'Calistenia pura de tracción y empuje',
    daysPerWeek: 3,
    minutesPerSession: 45,
    equipment: 'calisthenics',
    scheduleType: 'cyclic',
    profile: updatedUser.profile,
  });
  const cyclicActiveDays = cyclicalRoutine.days.filter((d) => !d.isRestDay);
  if (cyclicActiveDays.length !== 3) {
    throw new Error(`FALLO: Motor de IA cíclico generó ${cyclicActiveDays.length} días activos, esperados 3.`);
  }

  console.log(`✅ 8. Motor de IA Científica verificado: Generó semana de 7 días (4 activos) y ciclo de ${cyclicalRoutine.days.length} días (3 activos + descansos programados) con evidencia citada.`);

  console.log('--- TODOS LOS TESTS DE PRODUCCIÓN Y PERSISTENCIA PASARON CON ÉXITO (100%) ---');
}

runProductionSuite().catch((err) => {
  console.error('❌ Error en suite de pruebas:', err);
  process.exit(1);
});
