import { WorkoutBlock, WorkoutSession } from '@/types/kairos';

function daysAgoIso(daysAgo: number, hour = 18, minute = 0): { iso: string; ms: number } {
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysAgo,
    hour,
    minute,
    0,
    0
  );
  return { iso: target.toISOString(), ms: target.getTime() };
}

export function generateSeedSessions(): WorkoutSession[] {
  const d14 = daysAgoIso(13, 18, 15);
  const d12 = daysAgoIso(11, 19, 0);
  const d11 = daysAgoIso(10, 7, 30);
  const d9 = daysAgoIso(8, 18, 30);
  const d8 = daysAgoIso(7, 17, 45);
  const d6 = daysAgoIso(5, 10, 0);
  const d5 = daysAgoIso(4, 18, 20);
  const d4 = daysAgoIso(3, 7, 40);
  const d2 = daysAgoIso(2, 18, 45);
  const d1 = daysAgoIso(1, 11, 15);

  return [
    // Día -13: Fuerza Empuje + Hipertrofia + Salto de Cuerda
    {
      id: 'seed_s1',
      title: 'Empuje Neural + Accesorios + Cuerda',
      dateIso: d14.iso,
      startedAtMs: d14.ms,
      durationSeconds: 4320,
      notes: 'Inicio de microciclo. Buena velocidad de barra en banca.',
      blocks: [
        {
          id: 'b_s1_1',
          mode: 'strength',
          title: 'Bloque Fuerza — Press Competición',
          exercises: [
            {
              id: 'ex_s1_1',
              catalogId: 'str_comp_bench_press',
              name: 'Press de Banca Competición (Pausa 1s)',
              mode: 'strength',
              muscleGroup: 'Pectoral / Tríceps / Deltoide',
              defaultRestSeconds: 240,
              referenceOneRmKg: 118,
              strengthSets: [
                { id: 'st_1', weightKg: 102.5, reps: 4, rpe: 8.0, restSeconds: 240, completed: true },
                { id: 'st_2', weightKg: 102.5, reps: 4, rpe: 8.5, restSeconds: 240, completed: true },
                { id: 'st_3', weightKg: 100, reps: 4, rpe: 8.0, restSeconds: 240, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s1_2',
          mode: 'hypertrophy',
          title: 'Bloque Hipertrofia — Pectoral & Deltoides',
          exercises: [
            {
              id: 'ex_s1_2',
              catalogId: 'hyp_incline_db_press',
              name: 'Press Inclinado con Mancuernas (30°)',
              mode: 'hypertrophy',
              muscleGroup: 'Pectoral Superior',
              defaultRestSeconds: 120,
              hypertrophySets: [
                { id: 'hy_1', weightKg: 36, reps: 10, rir: '2', setType: 'Efectiva', restSeconds: 120, completed: true },
                { id: 'hy_2', weightKg: 36, reps: 9, rir: '1', setType: 'Efectiva', restSeconds: 120, completed: true },
                { id: 'hy_3', weightKg: 34, reps: 10, rir: '1', setType: 'Efectiva', restSeconds: 120, completed: true },
              ],
            },
            {
              id: 'ex_s1_3',
              catalogId: 'hyp_cable_lateral_raise',
              name: 'Elevaciones Laterales en Polea (Altura Muñeca)',
              mode: 'hypertrophy',
              muscleGroup: 'Deltoide Lateral',
              defaultRestSeconds: 75,
              hypertrophySets: [
                { id: 'hy_4', weightKg: 12.5, reps: 14, rir: '1', setType: 'Efectiva', restSeconds: 75, completed: true },
                { id: 'hy_5', weightKg: 12.5, reps: 13, rir: '0', setType: 'Efectiva', restSeconds: 75, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s1_3',
          mode: 'cardio',
          cardioDiscipline: 'jumprope',
          title: 'Finisher Cardio — Salto de Cuerda',
          exercises: [
            {
              id: 'ex_s1_4',
              catalogId: 'crd_jr_double_unders',
              name: 'Salto de Cuerda (Double Unders / Dobles)',
              mode: 'cardio',
              cardioDiscipline: 'jumprope',
              muscleGroup: 'Potencia Elástica Aquiles',
              defaultRestSeconds: 60,
              jumpRopeSets: [
                { id: 'jr_1', jumps: 140, durationSeconds: 60, style: 'Dobles / Double Unders', misses: 2, restSeconds: 60, completed: true },
                { id: 'jr_2', jumps: 145, durationSeconds: 60, style: 'Dobles / Double Unders', misses: 1, restSeconds: 60, completed: true },
                { id: 'jr_3', jumps: 142, durationSeconds: 60, style: 'Dobles / Double Unders', misses: 2, restSeconds: 60, completed: true },
              ],
            },
          ],
        },
      ],
    },

    // Día -11: Tren Inferior Fuerza + Hipertrofia
    {
      id: 'seed_s2',
      title: 'Cadena Posterior & Cuádriceps',
      dateIso: d12.iso,
      startedAtMs: d12.ms,
      durationSeconds: 4680,
      blocks: [
        {
          id: 'b_s2_1',
          mode: 'strength',
          title: 'Bloque Fuerza — Peso Muerto',
          exercises: [
            {
              id: 'ex_s2_1',
              catalogId: 'str_conv_deadlift',
              name: 'Peso Muerto Convencional',
              mode: 'strength',
              muscleGroup: 'Cadena Posterior Completa',
              defaultRestSeconds: 270,
              referenceOneRmKg: 205,
              strengthSets: [
                { id: 'st_21', weightKg: 175, reps: 4, rpe: 8.0, restSeconds: 270, completed: true },
                { id: 'st_22', weightKg: 175, reps: 4, rpe: 8.5, restSeconds: 270, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s2_2',
          mode: 'hypertrophy',
          title: 'Bloque Hipertrofia — Pierna Completa',
          exercises: [
            {
              id: 'ex_s2_2',
              catalogId: 'hyp_hack_squat',
              name: 'Sentadilla Hack Profunda',
              mode: 'hypertrophy',
              muscleGroup: 'Cuádriceps',
              defaultRestSeconds: 150,
              hypertrophySets: [
                { id: 'hy_21', weightKg: 130, reps: 10, rir: '2', setType: 'Efectiva', restSeconds: 150, completed: true },
                { id: 'hy_22', weightKg: 130, reps: 10, rir: '1', setType: 'Efectiva', restSeconds: 150, completed: true },
              ],
            },
            {
              id: 'ex_s2_3',
              catalogId: 'hyp_seated_leg_curl',
              name: 'Curl Femoral Sentado',
              mode: 'hypertrophy',
              muscleGroup: 'Isquiosurales',
              defaultRestSeconds: 90,
              hypertrophySets: [
                { id: 'hy_23', weightKg: 65, reps: 12, rir: '1', setType: 'Efectiva', restSeconds: 90, completed: true },
                { id: 'hy_24', weightKg: 65, reps: 11, rir: '1', setType: 'Efectiva', restSeconds: 90, completed: true },
              ],
            },
          ],
        },
      ],
    },

    // Día -10: Calistenia + Running Series
    {
      id: 'seed_s3',
      title: 'Calistenia Estáticos + Pista 400m',
      dateIso: d11.iso,
      startedAtMs: d11.ms,
      durationSeconds: 3900,
      blocks: [
        {
          id: 'b_s3_1',
          mode: 'calisthenics',
          title: 'Dominio Escapular & Palancas',
          exercises: [
            {
              id: 'ex_s3_1',
              catalogId: 'cal_front_lever_iso',
              name: 'Front Lever (Isométrico)',
              mode: 'calisthenics',
              calisthenicsSubType: 'isometric',
              muscleGroup: 'Dorsal / Core',
              defaultRestSeconds: 180,
              calisthenicsIsometricSets: [
                { id: 'ci_1', progression: 'Advanced Tuck', targetSeconds: 15, actualSeconds: 14, addedWeightKg: 0, restSeconds: 180, completed: true },
                { id: 'ci_2', progression: 'Advanced Tuck', targetSeconds: 15, actualSeconds: 13, addedWeightKg: 0, restSeconds: 180, completed: true },
                { id: 'ci_3', progression: 'Advanced Tuck', targetSeconds: 15, actualSeconds: 12, addedWeightKg: 0, restSeconds: 180, completed: true },
              ],
            },
            {
              id: 'ex_s3_2',
              catalogId: 'cal_strict_pullups',
              name: 'Dominadas Pronas Estrictas',
              mode: 'calisthenics',
              calisthenicsSubType: 'dynamic',
              muscleGroup: 'Dorsal / Escápulas',
              defaultRestSeconds: 135,
              calisthenicsDynamicSets: [
                { id: 'cd_1', variation: 'Lastrada Prona', addedWeightKg: 20, reps: 7, rir: '2', restSeconds: 135, completed: true },
                { id: 'cd_2', variation: 'Lastrada Prona', addedWeightKg: 20, reps: 7, rir: '1', restSeconds: 135, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s3_2',
          mode: 'cardio',
          cardioDiscipline: 'running',
          title: 'Intervalos de Pista VO2 Max',
          exercises: [
            {
              id: 'ex_s3_3',
              catalogId: 'crd_run_intervals_400',
              name: 'Running Series de 400m (VO2 Max)',
              mode: 'cardio',
              cardioDiscipline: 'running',
              muscleGroup: 'Potencia Aeróbica',
              defaultRestSeconds: 90,
              runningSets: [
                { id: 'rn_1', distanceMeters: 400, durationSeconds: 88, inclinePercent: 0, runType: 'Series de Velocidad / Fartlek', restSeconds: 90, completed: true },
                { id: 'rn_2', distanceMeters: 400, durationSeconds: 87, inclinePercent: 0, runType: 'Series de Velocidad / Fartlek', restSeconds: 90, completed: true },
                { id: 'rn_3', distanceMeters: 400, durationSeconds: 89, inclinePercent: 0, runType: 'Series de Velocidad / Fartlek', restSeconds: 90, completed: true },
              ],
            },
          ],
        },
      ],
    },

    // Día -8: Simulación Hyrox 1 + Natación Regenerativa
    {
      id: 'seed_s4',
      title: 'Simulación Hyrox Medio + Piscina',
      dateIso: d9.iso,
      startedAtMs: d9.ms,
      durationSeconds: 4500,
      blocks: [
        {
          id: 'b_s4_1',
          mode: 'hyrox',
          title: 'Circuito Oficial Hyrox (Bloque 1)',
          exercises: [
            {
              id: 'ex_s4_1',
              catalogId: 'hyx_1000m_run',
              name: '1000m Run (Carrera Comprometida)',
              mode: 'hyrox',
              muscleGroup: 'Aeróbico',
              defaultRestSeconds: 30,
              hyroxSets: [
                { id: 'hx_1', station: '1000m Run', distanceMeters: 1000, reps: 0, implementWeightKg: 0, splitSeconds: 252, roxzoneSeconds: 28, completed: true },
              ],
            },
            {
              id: 'ex_s4_2',
              catalogId: 'hyx_skierg_1000',
              name: 'SkiErg 1000m',
              mode: 'hyrox',
              muscleGroup: 'Tríceps / Dorsal / Core',
              defaultRestSeconds: 45,
              hyroxSets: [
                { id: 'hx_2', station: 'SkiErg', distanceMeters: 1000, reps: 0, implementWeightKg: 0, splitSeconds: 244, roxzoneSeconds: 30, completed: true },
              ],
            },
            {
              id: 'ex_s4_3',
              catalogId: 'hyx_sled_push_50',
              name: 'Sled Push 50m',
              mode: 'hyrox',
              muscleGroup: 'Cuádriceps / Potencia',
              defaultRestSeconds: 60,
              hyroxSets: [
                { id: 'hx_3', station: 'Sled Push', distanceMeters: 50, reps: 0, implementWeightKg: 152, splitSeconds: 186, roxzoneSeconds: 34, completed: true },
              ],
            },
            {
              id: 'ex_s4_4',
              catalogId: 'hyx_wall_balls_100',
              name: 'Wall Balls (100 reps)',
              mode: 'hyrox',
              muscleGroup: 'Cuádriceps / Hombros',
              defaultRestSeconds: 60,
              hyroxSets: [
                { id: 'hx_4', station: 'Wall Balls', distanceMeters: 0, reps: 100, implementWeightKg: 6, splitSeconds: 295, roxzoneSeconds: 25, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s4_2',
          mode: 'cardio',
          cardioDiscipline: 'swimming',
          title: 'Soltura Acuática Crol',
          exercises: [
            {
              id: 'ex_s4_5',
              catalogId: 'crd_swim_100_free',
              name: 'Natación Series 100m Crol',
              mode: 'cardio',
              cardioDiscipline: 'swimming',
              muscleGroup: 'Dorsal / Capacidad Pulmonar',
              defaultRestSeconds: 30,
              swimmingSets: [
                { id: 'sw_1', poolLengthMeters: 25, laps: 4, stroke: 'Crol/Libre', durationSeconds: 104, restSeconds: 30, completed: true },
                { id: 'sw_2', poolLengthMeters: 25, laps: 4, stroke: 'Crol/Libre', durationSeconds: 103, restSeconds: 30, completed: true },
              ],
            },
          ],
        },
      ],
    },

    // Día -7: Fuerza Empuje 2 + Hipertrofia + Cuerda
    {
      id: 'seed_s5',
      title: 'Empuje Fuerza S2 + Cuerda Velocidad',
      dateIso: d8.iso,
      startedAtMs: d8.ms,
      durationSeconds: 4100,
      blocks: [
        {
          id: 'b_s5_1',
          mode: 'strength',
          title: 'Bloque Fuerza — Banca Pausa',
          exercises: [
            {
              id: 'ex_s5_1',
              catalogId: 'str_comp_bench_press',
              name: 'Press de Banca Competición (Pausa 1s)',
              mode: 'strength',
              muscleGroup: 'Pectoral / Tríceps',
              defaultRestSeconds: 240,
              referenceOneRmKg: 118,
              strengthSets: [
                { id: 'st_51', weightKg: 105, reps: 4, rpe: 8.5, restSeconds: 240, completed: true },
                { id: 'st_52', weightKg: 105, reps: 4, rpe: 8.5, restSeconds: 240, completed: true },
                { id: 'st_53', weightKg: 102.5, reps: 4, rpe: 8.0, restSeconds: 240, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s5_2',
          mode: 'hypertrophy',
          title: 'Accesorios Estiramiento',
          exercises: [
            {
              id: 'ex_s5_2',
              catalogId: 'hyp_incline_db_press',
              name: 'Press Inclinado con Mancuernas (30°)',
              mode: 'hypertrophy',
              muscleGroup: 'Pectoral Superior',
              defaultRestSeconds: 120,
              hypertrophySets: [
                { id: 'hy_51', weightKg: 38, reps: 9, rir: '1', setType: 'Efectiva', restSeconds: 120, completed: true },
                { id: 'hy_52', weightKg: 38, reps: 9, rir: '1', setType: 'Efectiva', restSeconds: 120, completed: true },
              ],
            },
            {
              id: 'ex_s5_3',
              catalogId: 'hyp_cable_lateral_raise',
              name: 'Elevaciones Laterales en Polea (Altura Muñeca)',
              mode: 'hypertrophy',
              muscleGroup: 'Deltoide Lateral',
              defaultRestSeconds: 75,
              hypertrophySets: [
                { id: 'hy_53', weightKg: 13.5, reps: 14, rir: '1', setType: 'Efectiva', restSeconds: 75, completed: true },
                { id: 'hy_54', weightKg: 13.5, reps: 13, rir: '1', setType: 'Efectiva', restSeconds: 75, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s5_3',
          mode: 'cardio',
          cardioDiscipline: 'jumprope',
          title: 'Salto de Cuerda — Cadencia Reactiva',
          exercises: [
            {
              id: 'ex_s5_4',
              catalogId: 'crd_jr_double_unders',
              name: 'Salto de Cuerda (Double Unders / Dobles)',
              mode: 'cardio',
              cardioDiscipline: 'jumprope',
              muscleGroup: 'Potencia Elástica Aquiles',
              defaultRestSeconds: 60,
              jumpRopeSets: [
                { id: 'jr_51', jumps: 152, durationSeconds: 60, style: 'Dobles / Double Unders', misses: 1, restSeconds: 60, completed: true },
                { id: 'jr_52', jumps: 155, durationSeconds: 60, style: 'Dobles / Double Unders', misses: 1, restSeconds: 60, completed: true },
                { id: 'jr_53', jumps: 150, durationSeconds: 60, style: 'Dobles / Double Unders', misses: 0, restSeconds: 60, completed: true },
              ],
            },
          ],
        },
      ],
    },

    // Día -5: Pierna Pico previo + Ergómetro Watts
    {
      id: 'seed_s6',
      title: 'Pierna Pesada S2 + Sprints AirBike',
      dateIso: d6.iso,
      startedAtMs: d6.ms,
      durationSeconds: 4600,
      blocks: [
        {
          id: 'b_s6_1',
          mode: 'strength',
          title: 'Fuerza — Peso Muerto Pico Previo',
          exercises: [
            {
              id: 'ex_s6_1',
              catalogId: 'str_conv_deadlift',
              name: 'Peso Muerto Convencional',
              mode: 'strength',
              muscleGroup: 'Cadena Posterior',
              defaultRestSeconds: 270,
              referenceOneRmKg: 205,
              strengthSets: [
                { id: 'st_61', weightKg: 180, reps: 4, rpe: 8.5, restSeconds: 270, completed: true },
                { id: 'st_62', weightKg: 180, reps: 4, rpe: 9.0, restSeconds: 270, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s6_2',
          mode: 'hypertrophy',
          title: 'Hipertrofia Cuádriceps & Isquios',
          exercises: [
            {
              id: 'ex_s6_2',
              catalogId: 'hyp_hack_squat',
              name: 'Sentadilla Hack Profunda',
              mode: 'hypertrophy',
              muscleGroup: 'Cuádriceps',
              defaultRestSeconds: 150,
              hypertrophySets: [
                { id: 'hy_61', weightKg: 135, reps: 10, rir: '1', setType: 'Efectiva', restSeconds: 150, completed: true },
                { id: 'hy_62', weightKg: 135, reps: 10, rir: '1', setType: 'Efectiva', restSeconds: 150, completed: true },
              ],
            },
            {
              id: 'ex_s6_3',
              catalogId: 'hyp_seated_leg_curl',
              name: 'Curl Femoral Sentado',
              mode: 'hypertrophy',
              muscleGroup: 'Isquiosurales',
              defaultRestSeconds: 90,
              hypertrophySets: [
                { id: 'hy_63', weightKg: 67.5, reps: 12, rir: '1', setType: 'Efectiva', restSeconds: 90, completed: true },
                { id: 'hy_64', weightKg: 67.5, reps: 11, rir: '0', setType: 'Efectiva', restSeconds: 90, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s6_3',
          mode: 'cardio',
          cardioDiscipline: 'cycling',
          title: 'Potencia en AirBike',
          exercises: [
            {
              id: 'ex_s6_4',
              catalogId: 'crd_cyc_watt_sprints',
              name: 'Sprints en AirBike / Bicicleta (Watts)',
              mode: 'cardio',
              cardioDiscipline: 'cycling',
              muscleGroup: 'Potencia Anaeróbica',
              defaultRestSeconds: 90,
              cyclingSets: [
                { id: 'cy_1', durationSeconds: 30, distanceMeters: 380, avgWatts: 540, cadenceRpm: 102, restSeconds: 90, completed: true },
                { id: 'cy_2', durationSeconds: 30, distanceMeters: 390, avgWatts: 560, cadenceRpm: 105, restSeconds: 90, completed: true },
              ],
            },
          ],
        },
      ],
    },

    // Día -4: Calistenia Straddle + Running Series + Natación
    {
      id: 'seed_s7',
      title: 'Calistenia Straddle + Velocidad Mixta',
      dateIso: d5.iso,
      startedAtMs: d5.ms,
      durationSeconds: 4200,
      blocks: [
        {
          id: 'b_s7_1',
          mode: 'calisthenics',
          title: 'Progresión Front Lever Straddle & Tracción',
          exercises: [
            {
              id: 'ex_s7_1',
              catalogId: 'cal_front_lever_iso',
              name: 'Front Lever (Isométrico)',
              mode: 'calisthenics',
              calisthenicsSubType: 'isometric',
              muscleGroup: 'Dorsal / Core',
              defaultRestSeconds: 180,
              calisthenicsIsometricSets: [
                { id: 'ci_71', progression: 'Straddle', targetSeconds: 12, actualSeconds: 10, addedWeightKg: 0, restSeconds: 180, completed: true },
                { id: 'ci_72', progression: 'Straddle', targetSeconds: 12, actualSeconds: 10, addedWeightKg: 0, restSeconds: 180, completed: true },
                { id: 'ci_73', progression: 'Straddle', targetSeconds: 12, actualSeconds: 9, addedWeightKg: 0, restSeconds: 180, completed: true },
              ],
            },
            {
              id: 'ex_s7_2',
              catalogId: 'cal_strict_pullups',
              name: 'Dominadas Pronas Estrictas',
              mode: 'calisthenics',
              calisthenicsSubType: 'dynamic',
              muscleGroup: 'Dorsal / Escápulas',
              defaultRestSeconds: 135,
              calisthenicsDynamicSets: [
                { id: 'cd_71', variation: 'Lastrada Prona', addedWeightKg: 22.5, reps: 7, rir: '1', restSeconds: 135, completed: true },
                { id: 'cd_72', variation: 'Lastrada Prona', addedWeightKg: 22.5, reps: 7, rir: '1', restSeconds: 135, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s7_2',
          mode: 'cardio',
          cardioDiscipline: 'running',
          title: 'Series 400m Mejora de Ritmo',
          exercises: [
            {
              id: 'ex_s7_3',
              catalogId: 'crd_run_intervals_400',
              name: 'Running Series de 400m (VO2 Max)',
              mode: 'cardio',
              cardioDiscipline: 'running',
              muscleGroup: 'Potencia Aeróbica',
              defaultRestSeconds: 90,
              runningSets: [
                { id: 'rn_71', distanceMeters: 400, durationSeconds: 83, inclinePercent: 0, runType: 'Series de Velocidad / Fartlek', restSeconds: 90, completed: true },
                { id: 'rn_72', distanceMeters: 400, durationSeconds: 84, inclinePercent: 0, runType: 'Series de Velocidad / Fartlek', restSeconds: 90, completed: true },
                { id: 'rn_73', distanceMeters: 400, durationSeconds: 83, inclinePercent: 0, runType: 'Series de Velocidad / Fartlek', restSeconds: 90, completed: true },
              ],
            },
          ],
        },
      ],
    },

    // Día -3: Hyrox Simulación 2 (Mejora en Run y SkiErg) + Natación PR
    {
      id: 'seed_s8',
      title: 'Hyrox Específico + Piscina Umbral',
      dateIso: d4.iso,
      startedAtMs: d4.ms,
      durationSeconds: 4450,
      blocks: [
        {
          id: 'b_s8_1',
          mode: 'hyrox',
          title: 'Simulación Competición Hyrox',
          exercises: [
            {
              id: 'ex_s8_1',
              catalogId: 'hyx_1000m_run',
              name: '1000m Run (Carrera Comprometida)',
              mode: 'hyrox',
              muscleGroup: 'Aeróbico',
              defaultRestSeconds: 30,
              hyroxSets: [
                { id: 'hx_81', station: '1000m Run', distanceMeters: 1000, reps: 0, implementWeightKg: 0, splitSeconds: 241, roxzoneSeconds: 24, completed: true },
              ],
            },
            {
              id: 'ex_s8_2',
              catalogId: 'hyx_skierg_1000',
              name: 'SkiErg 1000m',
              mode: 'hyrox',
              muscleGroup: 'Tríceps / Dorsal / Core',
              defaultRestSeconds: 45,
              hyroxSets: [
                { id: 'hx_82', station: 'SkiErg', distanceMeters: 1000, reps: 0, implementWeightKg: 0, splitSeconds: 233, roxzoneSeconds: 25, completed: true },
              ],
            },
            {
              id: 'ex_s8_3',
              catalogId: 'hyx_sled_push_50',
              name: 'Sled Push 50m',
              mode: 'hyrox',
              muscleGroup: 'Cuádriceps / Potencia',
              defaultRestSeconds: 60,
              hyroxSets: [
                { id: 'hx_83', station: 'Sled Push', distanceMeters: 50, reps: 0, implementWeightKg: 152, splitSeconds: 179, roxzoneSeconds: 29, completed: true },
              ],
            },
            {
              id: 'ex_s8_4',
              catalogId: 'hyx_wall_balls_100',
              name: 'Wall Balls (100 reps)',
              mode: 'hyrox',
              muscleGroup: 'Cuádriceps / Hombros',
              defaultRestSeconds: 60,
              hyroxSets: [
                { id: 'hx_84', station: 'Wall Balls', distanceMeters: 0, reps: 100, implementWeightKg: 6, splitSeconds: 282, roxzoneSeconds: 22, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s8_2',
          mode: 'cardio',
          cardioDiscipline: 'swimming',
          title: 'Series 100m Crol Rápido',
          exercises: [
            {
              id: 'ex_s8_5',
              catalogId: 'crd_swim_100_free',
              name: 'Natación Series 100m Crol',
              mode: 'cardio',
              cardioDiscipline: 'swimming',
              muscleGroup: 'Dorsal / Capacidad Pulmonar',
              defaultRestSeconds: 30,
              swimmingSets: [
                { id: 'sw_81', poolLengthMeters: 25, laps: 4, stroke: 'Crol/Libre', durationSeconds: 97, restSeconds: 30, completed: true },
                { id: 'sw_82', poolLengthMeters: 25, laps: 4, stroke: 'Crol/Libre', durationSeconds: 98, restSeconds: 30, completed: true },
              ],
            },
          ],
        },
      ],
    },

    // Día -2: Fuerza PR en Banca + PR en Press Inclinado + PR en Double Unders
    {
      id: 'seed_s9',
      title: 'Récords de Empuje + Double Unders PR',
      dateIso: d2.iso,
      startedAtMs: d2.ms,
      durationSeconds: 4380,
      notes: 'Nuevo PR limpio en Press Banca 110kg x 4 y 168 RPM en Double Unders.',
      blocks: [
        {
          id: 'b_s9_1',
          mode: 'strength',
          title: 'Fuerza — Press de Banca Competición',
          exercises: [
            {
              id: 'ex_s9_1',
              catalogId: 'str_comp_bench_press',
              name: 'Press de Banca Competición (Pausa 1s)',
              mode: 'strength',
              muscleGroup: 'Pectoral / Tríceps / Deltoide',
              defaultRestSeconds: 240,
              referenceOneRmKg: 122,
              strengthSets: [
                { id: 'st_91', weightKg: 110, reps: 4, rpe: 8.5, restSeconds: 240, completed: true },
                { id: 'st_92', weightKg: 107.5, reps: 4, rpe: 8.5, restSeconds: 240, completed: true },
                { id: 'st_93', weightKg: 105, reps: 4, rpe: 8.0, restSeconds: 240, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s9_2',
          mode: 'hypertrophy',
          title: 'Hipertrofia — Sobrecarga Pectoral & Hombro',
          exercises: [
            {
              id: 'ex_s9_2',
              catalogId: 'hyp_incline_db_press',
              name: 'Press Inclinado con Mancuernas (30°)',
              mode: 'hypertrophy',
              muscleGroup: 'Pectoral Superior',
              defaultRestSeconds: 120,
              hypertrophySets: [
                { id: 'hy_91', weightKg: 40, reps: 10, rir: '1', setType: 'Efectiva', restSeconds: 120, completed: true },
                { id: 'hy_92', weightKg: 40, reps: 9, rir: '1', setType: 'Efectiva', restSeconds: 120, completed: true },
              ],
            },
            {
              id: 'ex_s9_3',
              catalogId: 'hyp_cable_lateral_raise',
              name: 'Elevaciones Laterales en Polea (Altura Muñeca)',
              mode: 'hypertrophy',
              muscleGroup: 'Deltoide Lateral',
              defaultRestSeconds: 75,
              hypertrophySets: [
                { id: 'hy_93', weightKg: 15, reps: 14, rir: '1', setType: 'Efectiva', restSeconds: 75, completed: true },
                { id: 'hy_94', weightKg: 15, reps: 13, rir: '0', setType: 'Efectiva', restSeconds: 75, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s9_3',
          mode: 'cardio',
          cardioDiscipline: 'jumprope',
          title: 'Cardio Reactivo — PR Cadencia Cuerda',
          exercises: [
            {
              id: 'ex_s9_4',
              catalogId: 'crd_jr_double_unders',
              name: 'Salto de Cuerda (Double Unders / Dobles)',
              mode: 'cardio',
              cardioDiscipline: 'jumprope',
              muscleGroup: 'Potencia Elástica Aquiles',
              defaultRestSeconds: 60,
              jumpRopeSets: [
                { id: 'jr_91', jumps: 168, durationSeconds: 60, style: 'Dobles / Double Unders', misses: 0, restSeconds: 60, completed: true },
                { id: 'jr_92', jumps: 170, durationSeconds: 60, style: 'Dobles / Double Unders', misses: 1, restSeconds: 60, completed: true },
                { id: 'jr_93', jumps: 166, durationSeconds: 60, style: 'Dobles / Double Unders', misses: 0, restSeconds: 60, completed: true },
              ],
            },
          ],
        },
      ],
    },

    // Día -1: Sesión Mixta con Avance en Hack Squat & Front Lever, PERO Retroceso SNC en Peso Muerto & Curl Femoral
    {
      id: 'seed_s10',
      title: 'Pierna + Calistenia (Alerta Fatiga Axial)',
      dateIso: d1.iso,
      startedAtMs: d1.ms,
      durationSeconds: 4720,
      notes: 'Gran avance en Sentadilla Hack y Front Lever, pero fatiga neural evidente en Peso Muerto tras poco sueño.',
      blocks: [
        {
          id: 'b_s10_1',
          mode: 'strength',
          title: 'Fuerza — Peso Muerto (Fatiga SNC)',
          exercises: [
            {
              id: 'ex_s10_1',
              catalogId: 'str_conv_deadlift',
              name: 'Peso Muerto Convencional',
              mode: 'strength',
              muscleGroup: 'Cadena Posterior Completa',
              defaultRestSeconds: 270,
              referenceOneRmKg: 205,
              strengthSets: [
                { id: 'st_101', weightKg: 170, reps: 3, rpe: 9.5, restSeconds: 180, completed: true },
                { id: 'st_102', weightKg: 165, reps: 3, rpe: 9.5, restSeconds: 180, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s10_2',
          mode: 'hypertrophy',
          title: 'Hipertrofia — Hack Squat PR & Femoral',
          exercises: [
            {
              id: 'ex_s10_2',
              catalogId: 'hyp_hack_squat',
              name: 'Sentadilla Hack Profunda',
              mode: 'hypertrophy',
              muscleGroup: 'Cuádriceps',
              defaultRestSeconds: 150,
              hypertrophySets: [
                { id: 'hy_101', weightKg: 142.5, reps: 10, rir: '1', setType: 'Efectiva', restSeconds: 150, completed: true },
                { id: 'hy_102', weightKg: 142.5, reps: 9, rir: '1', setType: 'Efectiva', restSeconds: 150, completed: true },
              ],
            },
            {
              id: 'ex_s10_3',
              catalogId: 'hyp_seated_leg_curl',
              name: 'Curl Femoral Sentado',
              mode: 'hypertrophy',
              muscleGroup: 'Isquiosurales',
              defaultRestSeconds: 90,
              hypertrophySets: [
                { id: 'hy_103', weightKg: 62.5, reps: 9, rir: '0', setType: 'Efectiva', restSeconds: 75, completed: true },
                { id: 'hy_104', weightKg: 60, reps: 9, rir: '0', setType: 'Efectiva', restSeconds: 75, completed: true },
              ],
            },
          ],
        },
        {
          id: 'b_s10_3',
          mode: 'calisthenics',
          title: 'Calistenia — Front Lever Lastrado PR',
          exercises: [
            {
              id: 'ex_s10_4',
              catalogId: 'cal_front_lever_iso',
              name: 'Front Lever (Isométrico)',
              mode: 'calisthenics',
              calisthenicsSubType: 'isometric',
              muscleGroup: 'Dorsal / Core',
              defaultRestSeconds: 180,
              calisthenicsIsometricSets: [
                { id: 'ci_101', progression: 'Straddle', targetSeconds: 14, actualSeconds: 13, addedWeightKg: 2.5, restSeconds: 180, completed: true },
                { id: 'ci_102', progression: 'Straddle', targetSeconds: 14, actualSeconds: 12, addedWeightKg: 2.5, restSeconds: 180, completed: true },
                { id: 'ci_103', progression: 'Straddle', targetSeconds: 12, actualSeconds: 11, addedWeightKg: 0, restSeconds: 180, completed: true },
              ],
            },
          ],
        },
      ],
    },
  ];
}

/**
 * Pre-populated multi-mode active session draft so the user can immediately experience
 * polymorphic logging + auto-rest timer triggers on first launch without friction.
 */
export function generateStarterActiveBlocks(): WorkoutBlock[] {
  return [
    {
      id: 'active_blk_1',
      mode: 'strength',
      title: 'Bloque 1 · Fuerza Neural',
      exercises: [
        {
          id: 'active_ex_1',
          catalogId: 'str_comp_bench_press',
          name: 'Press de Banca Competición (Pausa 1s)',
          mode: 'strength',
          muscleGroup: 'Pectoral / Tríceps / Deltoide',
          defaultRestSeconds: 180,
          referenceOneRmKg: 124.7,
          strengthSets: [
            {
              id: 'active_st_1',
              weightKg: 110,
              reps: 4,
              rpe: 8.5,
              restSeconds: 180,
              completed: false,
            },
            {
              id: 'active_st_2',
              weightKg: 112.5,
              reps: 4,
              rpe: 9.0,
              restSeconds: 180,
              completed: false,
            },
          ],
        },
      ],
    },
    {
      id: 'active_blk_2',
      mode: 'hypertrophy',
      title: 'Bloque 2 · Hipertrofia Mecánica',
      exercises: [
        {
          id: 'active_ex_2',
          catalogId: 'hyp_incline_db_press',
          name: 'Press Inclinado con Mancuernas (30°)',
          mode: 'hypertrophy',
          muscleGroup: 'Pectoral Superior',
          defaultRestSeconds: 120,
          hypertrophySets: [
            {
              id: 'active_hy_1',
              weightKg: 40,
              reps: 10,
              rir: '1',
              setType: 'Efectiva',
              restSeconds: 120,
              completed: false,
            },
            {
              id: 'active_hy_2',
              weightKg: 42,
              reps: 9,
              rir: '1',
              setType: 'Efectiva',
              restSeconds: 120,
              completed: false,
            },
          ],
        },
      ],
    },
    {
      id: 'active_blk_3',
      mode: 'cardio',
      cardioDiscipline: 'jumprope',
      title: 'Bloque 3 · Cardio Salto de Cuerda',
      exercises: [
        {
          id: 'active_ex_3',
          catalogId: 'crd_jr_double_unders',
          name: 'Salto de Cuerda (Double Unders / Dobles)',
          mode: 'cardio',
          cardioDiscipline: 'jumprope',
          muscleGroup: 'Potencia Elástica Aquiles',
          defaultRestSeconds: 60,
          jumpRopeSets: [
            {
              id: 'active_jr_1',
              jumps: 170,
              durationSeconds: 60,
              style: 'Dobles / Double Unders',
              misses: 0,
              restSeconds: 60,
              completed: false,
            },
          ],
        },
      ],
    },
  ];
}
