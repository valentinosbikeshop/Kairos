'use client';

import React, { useMemo, useRef, useState } from 'react';
import { WorkoutSession } from '@/types/kairos';
import { useKairos } from '@/lib/kairosContext';
import { summarizeExerciseLastPerformance } from '@/lib/exerciseDatabase';
import { formatFullDateEs, formatHhMmSs, formatMmSs } from '@/lib/formatters';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  LogOut,
  ShieldCheck,
  Timer,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';

export function HistoryView() {
  const {
    user,
    sessions,
    deleteSession,
    updateHistoricalSession,
    repeatSessionAsTemplate,
    exportBackupJson,
    importBackupJson,
    logoutUser,
  } = useKairos();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime()
      ),
    [sessions]
  );

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
    <div className="px-5 ios-page-safe-pt pb-36 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-gothic text-xl font-semibold tracking-wide text-brand">
            Historial y Cuenta
          </h1>
          <p className="text-xs text-brand-muted">
            {sessions.length === 0
              ? 'Sin sesiones registradas aún'
              : `${sessions.length} ${sessions.length === 1 ? 'sesión guardada' : 'sesiones guardadas'}`}
          </p>
        </div>
      </div>

      {/* ================= EMPTY STATE FOR NEW ACCOUNTS (0 DATA) ================= */}
      {sortedSessions.length === 0 ? (
        <div className="rounded-3xl border border-stoneborder bg-surface px-6 py-10 text-center space-y-2.5">
          <div className="text-xs text-gothic">❖</div>
          <h2 className="font-gothic text-base font-semibold text-brand">
            Bitácora Vacía
          </h2>
          <p className="text-xs text-brand-muted leading-relaxed max-w-[260px] mx-auto">
            Tus sesiones completadas quedarán archivadas aquí y protegidas en tu cuenta.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const totalExercises = session.blocks.reduce(
              (acc, b) => acc + b.exercises.length,
              0
            );

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
                      className="text-left flex-1 min-w-0"
                    >
                      <h3 className="font-gothic text-sm font-semibold text-brand truncate">
                        {session.title}
                      </h3>
                      <p className="text-xs text-brand-muted tabular-nums mt-0.5">
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
                      className="rounded-xl border border-stoneborder bg-background px-3 py-2 text-xs text-brand-muted hover:text-brand"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
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
  const [durationMinutes, setDurationMinutes] = useState(
    Math.max(1, Math.round(session.durationSeconds / 60))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl border border-stoneborder bg-surface p-5 space-y-4 animate-fade-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h3 className="font-gothic text-sm font-semibold text-brand">Editar Sesión</h3>
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
        </div>

        <button
          type="button"
          onClick={() =>
            onSave({
              ...session,
              title: title.trim() || session.title,
              durationSeconds: durationMinutes * 60,
            })
          }
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-xs font-bold uppercase tracking-wider text-background"
        >
          <Check className="h-4 w-4" />
          Guardar
        </button>
      </div>
    </div>
  );
}
