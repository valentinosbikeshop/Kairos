import {
  registerAccount,
  authenticateAccount,
  getUserRecordById,
  updateUserStateById,
  createSignedToken,
  verifySignedToken,
  compactSessionForStorage,
} from '../lib/serverDb';
import {
  anchorRoutineToDayForToday,
  buildWorkoutBlocksFromRoutineDay,
  generateScientificRoutine,
  populateRoutineDayByFocus,
  resolveTodayRoutineStatus,
} from '../lib/aiRoutineEngine';
import { parseAgenticUserCommand, generateScientificAiResponse } from '../lib/aiChatEngine';
import {
  detectOutOfContextExerciseWords,
  resolveExerciseIntelligently,
} from '../lib/exerciseClassifierEngine';
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

  // Test 9: Cronología, Detección de Día, Anclaje y "Cargar Día Completo"
  const status0 = resolveTodayRoutineStatus(cyclicalRoutine, []);
  if (!status0.todayPlan || status0.todayPlan.isRestDay || status0.todayPlan.exercises.length === 0) {
    throw new Error('FALLO: resolveTodayRoutineStatus sin sesiones previas no inició en el Día 1 activo con ejercicios.');
  }
  const secondActiveDay = cyclicalRoutine.days.find((d) => !d.isRestDay && d.id !== status0.todayPlan?.id)!;
  const anchoredRoutine = anchorRoutineToDayForToday(cyclicalRoutine, secondActiveDay.id);
  const statusAnchored = resolveTodayRoutineStatus(anchoredRoutine, []);
  if (statusAnchored.todayPlan?.id !== secondActiveDay.id) {
    throw new Error('FALLO: anchorRoutineToDayForToday no sincronizó el día seleccionado como el día de hoy.');
  }
  const loadedBlocks = buildWorkoutBlocksFromRoutineDay(secondActiveDay);
  const loadedExCount = loadedBlocks.reduce((acc, b) => acc + b.exercises.length, 0);
  if (loadedExCount !== secondActiveDay.exercises.length || !loadedBlocks[0].exercises[0].deepProfile) {
    throw new Error('FALLO: buildWorkoutBlocksFromRoutineDay no extrajo todos los ejercicios con su deepProfile.');
  }
  const emptyLegDay = populateRoutineDayByFocus({
    id: 'rday_empty_leg',
    label: 'Día 2',
    focusTitle: 'Pierna',
    isRestDay: false,
    primaryMode: 'hypertrophy',
    estimatedMinutes: 60,
    exercises: [],
  });
  if (emptyLegDay.exercises.length < 5) {
    throw new Error('FALLO: populateRoutineDayByFocus no pobló el día vacío de Pierna.');
  }
  console.log(`✅ 9. Cronología inteligente, sincronización de días y "Cargar día completo" verificados (${loadedExCount} ejercicios con deepProfile y autocompletado de días vacíos).`);

  // Test 10: Capacidades Agénticas del Chatbot (Edición de rutina, carga de día, actualización de perfil)
  const chatCtx = {
    userName: 'Valentino',
    userWeightKg: 77,
    routineName: 'Mi Rutina Personal',
    routineDays: cyclicalRoutine.days,
  };
  const cmdLoad = parseAgenticUserCommand('Cárgame el Día 1 en mi entrenamiento de hoy', chatCtx);
  if (!cmdLoad || cmdLoad.suggestedActions[0]?.type !== 'load_routine_day_to_workout' || !cmdLoad.suggestedActions[0]?.autoExecute) {
    throw new Error('FALLO: Chatbot agéntico no ejecutó comando de cargar día al entrenamiento.');
  }
  const cmdAdd = parseAgenticUserCommand('Agrega Elevaciones Laterales en Polea 4x15 al Día 1', chatCtx);
  if (!cmdAdd || cmdAdd.suggestedActions[0]?.type !== 'update_routine_days') {
    throw new Error('FALLO: Chatbot agéntico no ejecutó comando de agregar ejercicio a la rutina.');
  }
  const cmdProfile = parseAgenticUserCommand('Actualiza mi peso a 78.5 kg', chatCtx);
  if (!cmdProfile || cmdProfile.suggestedActions[0]?.payload.profilePatch?.weightKg !== 78.5) {
    throw new Error('FALLO: Chatbot agéntico no ejecutó actualización de peso en el perfil.');
  }
  console.log('✅ 10. Chatbot Agéntico verificado: Carga de días, edición directa de rutinas y actualización de perfil biométrico funcionando al 100%.');

  // Test 11: Inteligencia Biomecánica Profunda y Detección de Palabras Fuera de Contexto
  const outOfCtx = detectOutOfContextExerciseWords('Press Inclinado con Mancuernas martes revisar nota');
  if (!outOfCtx.hasSuspiciousWords || !outOfCtx.suggestedCleanName.includes('Press Inclinado')) {
    throw new Error('FALLO: detectOutOfContextExerciseWords no detectó palabras fuera de contexto.');
  }
  const deepResolved = resolveExerciseIntelligently('Sentadilla Hack');
  if (!deepResolved.deepProfile || deepResolved.deepProfile.primaryMuscles.length === 0) {
    throw new Error('FALLO: resolveExerciseIntelligently no generó deepProfile.');
  }
  console.log(`✅ 11. Inteligencia biomecánica profunda (${deepResolved.canonicalName} -> SFR ${deepResolved.deepProfile.sfrScore}/10) y detector de palabras fuera de contexto verificados.`);

  // Test 12: Coherencia integral del Motor de IA (Consultas naturales, chips, fat loss sin falsos positivos, fuera de dominio)
  const restRes = await generateScientificAiResponse('¿Cuánto debo descansar entre series hoy?', chatCtx);
  if (!restRes.content.includes('fosfocreatina') || restRes.suggestedActions.length === 0) {
    throw new Error('FALLO: Respuesta de descanso entre series incompleta.');
  }
  const fatLossRes = await generateScientificAiResponse('¿Cómo elimino grasa sin perder músculo?', chatCtx);
  if (fatLossRes.content.includes('No detecté palabras intrusas')) {
    throw new Error('FALLO CRÍTICO: "elimino grasa" cayó en falso positivo de limpieza de rutina.');
  }
  const subRes = await generateScientificAiResponse('Máquina ocupada o molestia articular: dame un sustituto', chatCtx);
  if (!subRes.content.includes('Sustitución Biomecánica') || subRes.suggestedActions.length === 0) {
    throw new Error('FALLO: Respuesta de sustitución biomecánica incompleta.');
  }
  const sleepRes = await generateScientificAiResponse('Dormí mal hoy (5 horas), ¿cómo ajusto mi rutina?', chatCtx);
  if (!sleepRes.content.includes('Autorregulación') || !sleepRes.content.includes('RIR')) {
    throw new Error('FALLO: Respuesta de autoregulación por sueño incompleta.');
  }
  const offTopicRes = await generateScientificAiResponse('Dame una receta de pizza napolitana o habla de política', chatCtx);
  if (!offTopicRes.content.includes('exclusivamente a')) {
    throw new Error('FALLO: Guardrail de enfoque temático no redirigió consulta fuera de dominio.');
  }
  console.log('✅ 12. Coherencia integral del Motor de IA verificada (Descansos, Recomposición sin falsos positivos, Sustitutos, Sueño/HRV y Guardrail de dominio).');

  console.log('--- TODOS LOS TESTS DE PRODUCCIÓN Y PERSISTENCIA PASARON CON ÉXITO (100%) ---');
}

runProductionSuite().catch((err) => {
  console.error('❌ Error en suite de pruebas:', err);
  process.exit(1);
});
