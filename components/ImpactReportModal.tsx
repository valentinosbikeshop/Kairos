'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SessionImpactReport } from '@/types/kairos';
import { formatHhMmSs, formatMmSs } from '@/lib/formatters';
import { Check, Timer, X } from 'lucide-react';

interface ImpactReportModalProps {
  report: SessionImpactReport | null;
  onClose: () => void;
  onGoToAnalytics: () => void;
}

export function ImpactReportModal({
  report,
  onClose,
  onGoToAnalytics,
}: ImpactReportModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (report) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [report]);

  if (!report || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-stoneborder bg-surface shadow-2xl animate-fade-up pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stoneborder p-5">
          <div>
            <span className="text-[11px] text-gothic">❖ Sesión Guardada</span>
            <h2 className="font-gothic text-lg font-semibold text-brand mt-0.5">
              {report.session.title}
            </h2>
            <p className="text-xs text-brand-muted tabular-nums mt-0.5">
              Duración: {formatHhMmSs(report.session.durationSeconds)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar resumen"
            className="rounded-xl border border-stoneborder bg-background p-2 text-brand-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Calm Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-stoneborder bg-background/70 p-3.5">
              <span className="text-xs text-brand-muted block">Series cumplidas</span>
              <span className="mt-1 block font-gothic text-xl font-semibold tabular-nums text-brand">
                {report.totalEffectiveSets}
              </span>
            </div>

            <div className="rounded-2xl border border-stoneborder bg-background/70 p-3.5">
              <span className="text-xs text-brand-muted block">Mejoras logradas</span>
              <span className="mt-1 block font-gothic text-xl font-semibold tabular-nums text-gothic">
                {report.advances.length}
              </span>
            </div>
          </div>

          {(() => {
            const workTimers = (report.session.timerLogs ?? []).filter((t) => t.kind !== 'rest');
            if (workTimers.length === 0) return null;
            return (
              <div className="flex items-center justify-between rounded-xl border border-stoneborder bg-background/60 px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2 text-brand-muted">
                  <Timer className="h-3.5 w-3.5 text-gothic" />
                  <span>Intervalos e isometrías</span>
                </div>
                <span className="tabular-nums text-brand">
                  {workTimers.length} · {formatMmSs(report.totalLoggedTimerSeconds)}
                </span>
              </div>
            );
          })()}

          {report.advances.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-gothic text-xs uppercase tracking-wider text-gothic">
                Avances de Hoy
              </h3>
              {report.advances.map((ev) => (
                <div
                  key={ev.catalogId}
                  className="flex items-center justify-between rounded-xl border border-stoneborder bg-background/70 px-3.5 py-2.5 text-xs"
                >
                  <span className="font-medium text-brand">{ev.exerciseName}</span>
                  <span className="tabular-nums text-gothic">{ev.latestValueFormatted}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-2.5 border-t border-stoneborder p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stoneborder bg-background py-3 text-xs font-medium text-brand-muted hover:text-brand"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onGoToAnalytics();
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-xs font-bold uppercase tracking-wider text-background"
          >
            <Check className="h-3.5 w-3.5" />
            Ver Evolución
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
