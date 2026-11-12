'use client';

import React, { useMemo, useRef, useState } from 'react';
import { TrainingMode, WorkoutSession } from '@/types/kairos';
import { useKairos } from '@/lib/kairosContext';
import { summarizeExerciseLastPerformance } from '@/lib/exerciseDatabase';
import { formatFullDateEs, formatHhMmSs, formatMmSs, MODE_META } from '@/lib/formatters';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Timer,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';

const DISCIPLINE_CALENDAR_META: Record<
  TrainingMode,
  { label: string; shortLabel: string; colorHex: string; dotClass: string; badgeClass: string }
> = {
  hypertrophy: {
    label: 'Hipertrofia',
    shortLabel: 'HIP',
    colorHex: '#60A5FA',
    dotClass: 'bg-[#60A5FA]',
    badgeClass: 'border-[#60A5FA]/50 bg-[#60A5FA]/15 text-[#93C5FD]',
  },
  strength: {
    label: 'Fuerza',
    shortLabel: 'FUE',
    colorHex: '#F59E0B',
    dotClass: 'bg-[#F59E0B]',
    badgeClass: 'border-[#F59E0B]/50 bg-[#F59E0B]/15 text-[#FCD34D]',
  },
  calisthenics: {
    label: 'Calistenia',
    shortLabel: 'CAL',
    colorHex: '#10B981',
    dotClass: 'bg-[#10B981]',
    badgeClass: 'border-[#10B981]/50 bg-[#10B981]/15 text-[#6EE7B7]',
  },
  hyrox: {
    label: 'Hyrox',
    shortLabel: 'HYR',
    colorHex: '#F97316',
    dotClass: 'bg-[#F97316]',
    badgeClass: 'border-[#F97316]/50 bg-[#F97316]/15 text-[#FDBA74]',
  },
  cardio: {
    label: 'Cardio / Running',
    shortLabel: 'CAR',
    colorHex: '#38BDF8',
    dotClass: 'bg-[#38BDF8]',
    badgeClass: 'border-[#38BDF8]/50 bg-[#38BDF8]/15 text-[#7DD3FC]',
  },
};

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function toLocalYmd(dateOrIso: Date | string): string {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (Number.isNaN(d.getTime())) {
    return typeof dateOrIso === 'string' ? dateOrIso.slice(0, 10) : '';
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function getSessionModes(session: WorkoutSession): TrainingMode[] {
  const modes = new Set<TrainingMode>();
  for (const blk of session.blocks) {
    if (blk.exercises.length > 0) {
      modes.add(blk.mode);
    }
  }
  // If session only had timerLogs (e.g. HIIT/Tabata), classify as cardio/calisthenics
  if (modes.size === 0 && (session.timerLogs?.length ?? 0) > 0) {
    const hasIso = session.timerLogs?.some((t) => t.kind === 'isometric');
    modes.add(hasIso ? 'calisthenics' : 'cardio');
  }
  if (modes.size === 0) {
    modes.add('hypertrophy');
  }
  return Array.from(modes);
}

export function HistoryView() {
  const {
    user,
    routine,
    sessions,
    deleteSession,
    updateHistoricalSession,
    repeatSessionAsTemplate,
    updateWorkoutCustomDate,
    loadRoutineDayIntoWorkout,
    setActiveTab,
    exportBackupJson,
    importBackupJson,
    logoutUser,
  } = useKairos();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const todayDate = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => toLocalYmd(todayDate), [todayDate]);

  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => ({
    year: todayDate.getFullYear(),
    month: todayDate.getMonth(),
  }));
  const [selectedDateYmd, setSelectedDateYmd] = useState<string | null>(null);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime()
      ),
    [sessions]
  );

  // Map YYYY-MM-DD -> { sessions, modes }
  const sessionsByDateMap = useMemo(() => {
    const map = new Map<
      string,
      { sessions: WorkoutSession[]; modes: TrainingMode[] }
    >();

    for (const s of sortedSessions) {
      const ymd = toLocalYmd(s.dateIso);
      if (!ymd) continue;
      const existing = map.get(ymd) ?? { sessions: [], modes: [] };
      existing.sessions.push(s);
      for (const m of getSessionModes(s)) {
        if (!existing.modes.includes(m)) {
          existing.modes.push(m);
        }
      }
      map.set(ymd, existing);
    }
    return map;
  }, [sortedSessions]);

  // Build calendar cells for current month (Monday-first grid)
  const calendarGrid = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 0=Sun..6=Sat -> Monday=0..Sunday=6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const cells: Array<{
      ymd: string;
      dayNumber: number;
      inCurrentMonth: boolean;
      isToday: boolean;
      isFuture: boolean;
      sessions: WorkoutSession[];
      modes: TrainingMode[];
    }> = [];

    // Leading days from previous month
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      const ymd = toLocalYmd(d);
      const data = sessionsByDateMap.get(ymd);
      cells.push({
        ymd,
        dayNumber: d.getDate(),
        inCurrentMonth: false,
        isToday: ymd === todayYmd,
        isFuture: ymd > todayYmd,
        sessions: data?.sessions ?? [],
        modes: data?.modes ?? [],
      });
    }

    // Current month days
    let trainedDaysInMonth = 0;
    let totalSessionsInMonth = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const ymd = toLocalYmd(d);
      const data = sessionsByDateMap.get(ymd);
      const daySessions = data?.sessions ?? [];
      if (daySessions.length > 0) {
        trainedDaysInMonth++;
        totalSessionsInMonth += daySessions.length;
      }
      cells.push({
        ymd,
        dayNumber: day,
        inCurrentMonth: true,
        isToday: ymd === todayYmd,
        isFuture: ymd > todayYmd,
        sessions: daySessions,
        modes: data?.modes ?? [],
      });
    }

    // Trailing days to complete 6-week or 5-week row
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const needed = 7 - remainder;
      for (let i = 1; i <= needed; i++) {
        const d = new Date(year, month + 1, i);
        const ymd = toLocalYmd(d);
        const data = sessionsByDateMap.get(ymd);
        cells.push({
          ymd,
          dayNumber: d.getDate(),
          inCurrentMonth: false,
          isToday: ymd === todayYmd,
          isFuture: ymd > todayYmd,
          sessions: data?.sessions ?? [],
          modes: data?.modes ?? [],
        });
      }
    }

    return {
      cells,
      trainedDaysInMonth,
      totalSessionsInMonth,
    };
  }, [calendarMonth, sessionsByDateMap, todayYmd]);

  const handleLogForgottenWorkoutOnDate = (ymd: string, routineDayId?: string) => {
    updateWorkoutCustomDate(ymd === todayYmd ? undefined : ymd);
    if (routineDayId && routine) {
      const foundDay = routine.days.find((d) => d.id === routineDayId);
      if (foundDay) {
        loadRoutineDayIntoWorkout(foundDay);
        return;
      }
    }
    setActiveTab('workout');
  };

  const displayedSessions = useMemo(() => {
    if (!selectedDateYmd) return sortedSessions;
    return sessionsByDateMap.get(selectedDateYmd)?.sessions ?? [];
  }, [selectedDateYmd, sessionsByDateMap, sortedSessions]);

  const handleExport = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kairos-${user?.username || 'cuenta'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusBanner({
      ok: true,
      text: 'Copia de seguridad descargada.',
    });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const res = importBackupJson(content);
      setStatusBanner({ ok: res.ok, text: res.message });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="px-5 ios-page-safe-pt pb-36 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-gothic text-xl font-semibold tracking-wide text-brand">
            Calendario e Historial
          </h1>
          <p className="text-xs text-brand-muted">
            {sessions.length === 0
              ? 'Toca cualquier día para registrar un entrenamiento'
              : `${sessions.length} ${sessions.length === 1 ? 'sesión registrada' : 'sesiones registradas'} · Toca un día para ver o agregar`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleLogForgottenWorkoutOnDate(selectedDateYmd || todayYmd)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gothic/50 bg-gothic/15 px-3 py-1.5 text-xs font-semibold text-brand hover:border-gothic active:scale-95 transition-all"
        >
          <PlusCircle className="h-3.5 w-3.5 text-gothic" />
          <span>Registrar día</span>
        </button>
      </div>

      {/* ================= VISUAL MONTHLY TRAINING CALENDAR ================= */}
      <section className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-3.5 kairos-card-alive">
        {/* Month Navigation Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gothic shrink-0" />
            <div>
              <h2 className="font-gothic text-sm font-semibold text-brand">
                {MONTH_NAMES_ES[calendarMonth.month]} {calendarMonth.year}
              </h2>
              <p className="text-[11px] text-brand-muted tabular-nums">
                {calendarGrid.trainedDaysInMonth}{' '}
                {calendarGrid.trainedDaysInMonth === 1 ? 'día entrenado' : 'días entrenados'} este mes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setCalendarMonth((prev) =>
                  prev.month === 0
                    ? { year: prev.year - 1, month: 11 }
                    : { year: prev.year, month: prev.month - 1 }
                )
              }
              className="rounded-lg border border-stoneborder bg-background p-1.5 text-brand-muted hover:text-brand active:scale-95"
              title="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCalendarMonth({
                  year: todayDate.getFullYear(),
                  month: todayDate.getMonth(),
                });
                setSelectedDateYmd(null);
              }}
              className="rounded-lg border border-stoneborder bg-background px-2.5 py-1 text-[11px] font-medium text-brand-muted hover:text-brand active:scale-95"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() =>
                setCalendarMonth((prev) =>
                  prev.month === 11
                    ? { year: prev.year + 1, month: 0 }
                    : { year: prev.year, month: prev.month + 1 }
                )
              }
              className="rounded-lg border border-stoneborder bg-background p-1.5 text-brand-muted hover:text-brand active:scale-95"
              title="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Day-of-Week Labels (Lun -> Dom) */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div
              key={d}
              className="text-[10px] font-mono font-semibold uppercase tracking-wider text-brand-subtle py-0.5"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarGrid.cells.map((cell) => {
            const isSelected = selectedDateYmd === cell.ymd;
            const hasSessions = cell.sessions.length > 0;

            return (
              <button
                key={cell.ymd}
                type="button"
                disabled={cell.isFuture}
                onClick={() =>
                  setSelectedDateYmd((prev) => (prev === cell.ymd ? null : cell.ymd))
                }
                className={`relative flex flex-col items-center justify-between rounded-xl border p-1.5 min-h-[52px] transition-all ${
                  !cell.inCurrentMonth ? 'opacity-35 ' : ''
                }${
                  cell.isFuture
                    ? 'border-stoneborder/40 bg-background/25 cursor-default opacity-30'
                    : isSelected
                      ? 'border-gothic bg-gothic/20 ring-2 ring-gothic/40 shadow-[0_0_12px_rgba(222,184,104,0.2)]'
                      : hasSessions
                        ? 'border-stoneborder bg-elevated/90 hover:border-gothic/60 shadow-sm'
                        : cell.isToday
                          ? 'border-gothic/60 bg-gothic/10 hover:border-gothic'
                          : 'border-stoneborder/60 bg-background/50 hover:border-stoneborder'
                }`}
              >
                {/* Day Number + Today Indicator */}
                <span
                  className={`text-[11px] font-mono tabular-nums leading-none ${
                    isSelected
                      ? 'font-bold text-gothic'
                      : hasSessions
                        ? 'font-bold text-brand'
                        : cell.isToday
                          ? 'font-bold text-gothic'
                          : 'text-brand-muted'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {/* Multi-Discipline Visual Markers (Color Bars + Dots) */}
                {hasSessions ? (
                  <div className="w-full space-y-1 mt-1">
                    {/* Segmented Color Bar showing exact mix (e.g. Hypertrophy + Cardio) */}
                    <div className="flex w-full h-1.5 rounded-full overflow-hidden gap-[1px] bg-background/60">
                      {cell.modes.map((m) => (
                        <span
                          key={m}
                          style={{ backgroundColor: DISCIPLINE_CALENDAR_META[m].colorHex }}
                          className="flex-1 h-full"
                          title={DISCIPLINE_CALENDAR_META[m].label}
                        />
                      ))}
                    </div>
                    {/* Short discipline code labels */}
                    <div className="flex items-center justify-center gap-0.5 flex-wrap">
                      {cell.modes.slice(0, 2).map((m) => (
                        <span
                          key={m}
                          style={{ color: DISCIPLINE_CALENDAR_META[m].colorHex }}
                          className="text-[8px] font-mono font-bold leading-none tracking-tighter"
                        >
                          {DISCIPLINE_CALENDAR_META[m].shortLabel}
                        </span>
                      ))}
                      {cell.modes.length > 2 && (
                        <span className="text-[8px] font-mono text-brand-muted leading-none">
                          +{cell.modes.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-[9px] text-brand-subtle/40 leading-none mt-2">
                    {cell.isToday ? 'Hoy' : '·'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Visual Color Legend for Disciplines */}
        <div className="pt-2 border-t border-stoneborder/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            {(Object.keys(DISCIPLINE_CALENDAR_META) as TrainingMode[]).map((modeKey) => {
              const meta = DISCIPLINE_CALENDAR_META[modeKey];
              return (
                <div key={modeKey} className="inline-flex items-center gap-1.5 text-[10px]">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: meta.colorHex }}
                  />
                  <span className="text-brand-muted font-medium">{meta.label}</span>
                </div>
              );
            })}
          </div>
          <span className="text-[10px] text-brand-subtle">
            Barra combinada = 2+ disciplinas el mismo día
          </span>
        </div>

        {/* Selected Date Action Panel (Forgotten Workout / Day Filter) */}
        {selectedDateYmd && (
          <div className="rounded-xl border border-gothic/45 bg-background/90 p-3 space-y-2.5 animate-fade-up">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-brand">
                  📅 Día seleccionado: <span className="text-gothic font-mono">{selectedDateYmd}</span>
                </p>
                <p className="text-[11px] text-brand-muted">
                  {displayedSessions.length === 0
                    ? 'No hay entrenamientos registrados en esta fecha.'
                    : `${displayedSessions.length} ${
                        displayedSessions.length === 1
                          ? 'entrenamiento registrado'
                          : 'entrenamientos registrados'
                      } en esta fecha.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateYmd(null)}
                className="rounded-lg border border-stoneborder bg-surface px-2 py-1 text-[10px] text-brand-muted hover:text-brand"
              >
                Ver todos
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleLogForgottenWorkoutOnDate(selectedDateYmd)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gothic/20 border border-gothic/60 py-2 px-3 text-xs font-semibold text-brand hover:bg-gothic/30 active:scale-95 transition-all"
              >
                <PlusCircle className="h-3.5 w-3.5 text-gothic" />
                <span>
                  {displayedSessions.length === 0
                    ? `Registrar entrenamiento olvidado (${selectedDateYmd})`
                    : `Agregar otra sesión en ${selectedDateYmd}`}
                </span>
              </button>
            </div>

            {/* Optional 1-tap Routine Day Loader for that forgotten date */}
            {routine && routine.days.some((d) => !d.isRestDay) && (
              <div className="space-y-1 pt-1 border-t border-stoneborder/60">
                <span className="block text-[10px] text-brand-muted">
                  O carga directamente un día de tu rutina en <strong className="text-brand">{selectedDateYmd}</strong>:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {routine.days
                    .filter((d) => !d.isRestDay)
                    .map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleLogForgottenWorkoutOnDate(selectedDateYmd, d.id)}
                        className="rounded-lg border border-stoneborder bg-surface px-2.5 py-1 text-[10px] font-medium text-brand hover:border-gothic/60"
                      >
                        {d.label}: {d.focusTitle}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ================= SESSIONS LIST (FILTERED BY DATE OR ALL) ================= */}
      {displayedSessions.length === 0 ? (
        <div className="rounded-3xl border border-stoneborder bg-surface px-6 py-8 text-center space-y-3">
          <div className="text-xs text-gothic">❖</div>
          <h2 className="font-gothic text-base font-semibold text-brand">
            {selectedDateYmd
              ? `Sin registros el ${selectedDateYmd}`
              : 'Bitácora Vacía'}
          </h2>
          <p className="text-xs text-brand-muted leading-relaxed max-w-[260px] mx-auto">
            {selectedDateYmd
              ? '¿Entrenaste este día y olvidaste anotarlo? Regístralo ahora y el motor recalculará tu fatiga e historial.'
              : 'Tus sesiones completadas quedarán archivadas aquí y marcadas por disciplina en el calendario.'}
          </p>
          <button
            type="button"
            onClick={() => handleLogForgottenWorkoutOnDate(selectedDateYmd || todayYmd)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gothic/60 bg-gothic/15 px-4 py-2 text-xs font-semibold text-brand hover:bg-gothic/25"
          >
            <PlusCircle className="h-3.5 w-3.5 text-gothic" />
            <span>
              {selectedDateYmd
                ? `Registrar sesión del ${selectedDateYmd}`
                : 'Registrar entrenamiento'}
            </span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedSessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const totalExercises = session.blocks.reduce(
              (acc, b) => acc + b.exercises.length,
              0
            );
            const sessionModes = getSessionModes(session);

            return (
              <article
                key={session.id}
                className="rounded-2xl border border-stoneborder bg-surface overflow-hidden"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                      className="text-left flex-1 min-w-0 space-y-1"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        {sessionModes.map((m) => (
                          <span
                            key={m}
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase ${DISCIPLINE_CALENDAR_META[m].badgeClass}`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: DISCIPLINE_CALENDAR_META[m].colorHex }}
                            />
                            {DISCIPLINE_CALENDAR_META[m].label}
                          </span>
                        ))}
                      </div>
                      <h3 className="font-gothic text-sm font-semibold text-brand truncate">
                        {session.title}
                      </h3>
                      <p className="text-xs text-brand-muted tabular-nums">
                        {formatFullDateEs(session.dateIso)} · {formatHhMmSs(session.durationSeconds)}{' '}
                        · {totalExercises} ejerc.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                      className="p-1.5 text-brand-subtle hover:text-brand"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Clean Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => repeatSessionAsTemplate(session)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-stoneborder bg-elevated py-2 px-3 text-xs font-medium text-brand hover:border-gothic/50"
                    >
                      <Copy className="h-3.5 w-3.5 text-gothic" />
                      Repetir hoy
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingSession(session)}
                      title="Editar fecha, título o duración"
                      className="inline-flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-3 py-2 text-xs text-brand-muted hover:text-brand"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Editar fecha/datos</span>
                    </button>

                    {confirmDeleteId === session.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          deleteSession(session.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded-xl border border-status-regress/50 bg-status-regress/15 px-3 py-2 text-xs font-semibold text-brand"
                      >
                        Confirmar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(session.id)}
                        className="rounded-xl border border-stoneborder bg-background px-3 py-2 text-xs text-brand-subtle hover:text-status-regress"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-stoneborder bg-background/60 p-4 space-y-3 animate-fade-up">
                    {session.blocks.map((blk) => (
                      <div key={blk.id} className="space-y-1.5">
                        <span className="text-xs font-semibold text-gothic">{blk.title}</span>
                        <div className="space-y-1">
                          {blk.exercises.map((ex) => {
                            const bestLine = summarizeExerciseLastPerformance(ex);
                            return (
                              <div
                                key={ex.id}
                                className="flex items-center justify-between gap-2 text-xs py-1 border-b border-stoneborder/50 last:border-0"
                              >
                                <span className="text-brand truncate">{ex.name}</span>
                                <span className="shrink-0 tabular-nums text-brand-muted">
                                  {bestLine ?? 'Completado'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {(() => {
                      const workTimers = (session.timerLogs ?? []).filter((tl) => tl.kind !== 'rest');
                      if (workTimers.length === 0) return null;
                      return (
                        <div className="space-y-1 pt-2 border-t border-stoneborder">
                          <div className="flex items-center gap-1.5 text-xs text-gothic">
                            <Timer className="h-3.5 w-3.5" />
                            <span>Intervalos e isometrías</span>
                          </div>
                          {workTimers.map((tl) => (
                            <div
                              key={tl.id}
                              className="flex items-center justify-between text-xs text-brand-muted"
                            >
                              <span className="truncate">{tl.label}</span>
                              <span className="tabular-nums">{formatMmSs(tl.elapsedSeconds)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ================= ACCOUNT & PERSISTENT BACKUP CARD ================= */}
      <section className="rounded-2xl border border-stoneborder bg-surface p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-stoneborder bg-background text-gothic">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-brand">
                {user?.displayName || 'Atleta KAIROS'}
              </h2>
              <p className="text-[11px] text-brand-muted">@{user?.username}</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] text-gothic">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sincronizado
          </span>
        </div>

        {statusBanner && (
          <p className="rounded-xl border border-stoneborder bg-background px-3 py-2 text-xs text-brand">
            {statusBanner.text}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-stoneborder bg-background py-2.5 text-xs text-brand-muted hover:text-brand"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar copia
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-stoneborder bg-background py-2.5 text-xs text-brand-muted hover:text-brand"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar copia
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileImport}
            className="hidden"
          />
        </div>

        <button
          type="button"
          onClick={() => void logoutUser()}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-stoneborder bg-background py-2.5 text-xs text-brand-muted hover:text-brand"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </section>

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSave={(updated) => {
            updateHistoricalSession(updated);
            setEditingSession(null);
          }}
        />
      )}
    </div>
  );
}

function EditSessionModal({
  session,
  onClose,
  onSave,
}: {
  session: WorkoutSession;
  onClose: () => void;
  onSave: (updated: WorkoutSession) => void;
}) {
  const [title, setTitle] = useState(session.title);
  const [dateYmd, setDateYmd] = useState(() => toLocalYmd(session.dateIso));
  const [durationMinutes, setDurationMinutes] = useState(
    Math.max(1, Math.round(session.durationSeconds / 60))
  );
  const [notes, setNotes] = useState(session.notes || '');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl border border-stoneborder bg-surface p-5 space-y-4 animate-fade-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h3 className="font-gothic text-sm font-semibold text-brand">
            Editar Fecha y Datos de Sesión
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stoneborder bg-background p-1.5 text-brand-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-brand-muted mb-1">
              Fecha del entrenamiento
            </label>
            <input
              type="date"
              value={dateYmd}
              onChange={(e) => setDateYmd(e.target.value)}
              className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] font-mono text-brand"
            />
          </div>

          <div>
            <label className="block text-xs text-brand-muted mb-1">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] text-brand"
            />
          </div>

          <div>
            <label className="block text-xs text-brand-muted mb-1">Duración (min)</label>
            <input
              type="number"
              inputMode="numeric"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] tabular-nums text-brand"
            />
          </div>

          <div>
            <label className="block text-xs text-brand-muted mb-1">Notas (opcional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Agarre supino en jalón, buena energía..."
              className="w-full rounded-xl border border-stoneborder bg-background px-3 py-2 text-[16px] text-brand resize-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            let nextDateIso = session.dateIso;
            if (dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
              const [yStr, mStr, dStr] = dateYmd.split('-');
              const existingDate = new Date(session.dateIso);
              const hours = Number.isNaN(existingDate.getTime()) ? 12 : existingDate.getHours();
              const mins = Number.isNaN(existingDate.getTime()) ? 0 : existingDate.getMinutes();
              const updatedDate = new Date(
                Number(yStr),
                Number(mStr) - 1,
                Number(dStr),
                hours,
                mins,
                0,
                0
              );
              if (!Number.isNaN(updatedDate.getTime())) {
                nextDateIso = updatedDate.toISOString();
              }
            }

            onSave({
              ...session,
              title: title.trim() || session.title,
              dateIso: nextDateIso,
              durationSeconds: durationMinutes * 60,
              notes: notes.trim() || undefined,
            });
          }}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-xs font-bold uppercase tracking-wider text-background"
        >
          <Check className="h-4 w-4" />
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
