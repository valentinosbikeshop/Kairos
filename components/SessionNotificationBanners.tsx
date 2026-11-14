'use client';

import React from 'react';
import { useKairos } from '@/lib/kairosContext';
import { Clock, CheckCircle2, X, ShieldAlert, ArrowRight } from 'lucide-react';

export function SessionNotificationBanners() {
  const {
    sessionReminderBannerOpen,
    dismissSessionReminderBanner,
    sessionAutoSavedNotice,
    dismissSessionAutoSavedNotice,
    finishAndAnalyzeWorkout,
    setActiveTab,
  } = useKairos();

  if (!sessionReminderBannerOpen && !sessionAutoSavedNotice) {
    return null;
  }

  return (
    <>
      {/* 1. Modal / Alerta de Auto-Guardado a las 2h 15m */}
      {sessionAutoSavedNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="autosave-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-[390px] rounded-3xl border border-emerald-500/35 bg-[#121115] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-4">
            <button
              type="button"
              onClick={dismissSessionAutoSavedNotice}
              aria-label="Cerrar aviso de auto-guardado"
              className="absolute top-4 right-4 rounded-xl p-1.5 text-brand-subtle hover:text-brand hover:bg-white/5 active:scale-95 transition-all"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Auto-guardado · 2h 15m
                </span>
                <h3
                  id="autosave-title"
                  className="font-gothic text-base font-bold text-[#EDE8DF] tracking-wide truncate"
                >
                  Sesión Guardada
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#C5BEB3] leading-relaxed">
              Han transcurrido <strong className="text-[#EDE8DF]">2 horas y 15 minutos</strong>{' '}
              desde que añadiste tu primer ejercicio. Tu sesión{' '}
              <strong className="text-emerald-300">«{sessionAutoSavedNotice.title}»</strong>{' '}
              ha sido guardada y analizada automáticamente para preservar tu progreso y fatiga acumulada.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  dismissSessionAutoSavedNotice();
                  setActiveTab('history');
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-stoneborder bg-[#18151B] py-2.5 px-3 text-xs font-semibold text-[#EDE8DF] hover:border-gothic/40 active:scale-95 transition-all"
              >
                Ver en Historial
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={dismissSessionAutoSavedNotice}
                className="flex-1 flex items-center justify-center rounded-xl bg-gradient-to-r from-[#DEB868] via-[#E8C87A] to-[#C89D48] py-2.5 px-3 text-xs font-bold text-[#0B0A0E] uppercase tracking-wider shadow-[0_4px_20px_rgba(222,184,104,0.3)] hover:brightness-105 active:scale-95 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Banner Flotante de Recordatorio a la 1h 45m */}
      {sessionReminderBannerOpen && !sessionAutoSavedNotice && (
        <aside
          role="alert"
          aria-label="Recordatorio para guardar sesión"
          className="fixed bottom-20 inset-x-3 z-40 mx-auto max-w-[406px] rounded-2xl border border-[#DEB868]/45 bg-[#131116]/95 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.9)] backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DEB868]/35 bg-[#DEB868]/10 text-[#DEB868]">
              <Clock className="h-5 w-5 stroke-[2.2]" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border border-[#DEB868]/40 bg-[#DEB868]/15 px-1.5 py-0.5 text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#DEB868]">
                  1h 45m activo
                </span>
                <span className="text-[10px] text-brand-muted">Recordatorio de Sesión</span>
              </div>
              <h4 className="font-gothic text-sm font-bold text-[#EDE8DF] mt-1 tracking-wide">
                ¿Deseas guardar tu sesión del día?
              </h4>
              <p className="text-[11.5px] text-[#C2B9AC] leading-snug mt-1">
                Han pasado 1h 45m desde tu primer ejercicio. Guarda tu sesión para registrar tu volumen y nivel de fatiga.{' '}
                <span className="text-[#DEB868] font-medium">
                  Se guardará automáticamente a las 2h 15m.
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={dismissSessionReminderBanner}
              aria-label="Ocultar recordatorio"
              className="rounded-lg p-1 text-brand-subtle hover:text-brand hover:bg-white/5 active:scale-95 transition-all -mr-1 -mt-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={dismissSessionReminderBanner}
              className="flex-1 rounded-xl border border-stoneborder/80 bg-background/60 py-2.5 px-3 text-[11px] font-semibold text-brand-muted hover:text-brand active:scale-95 transition-all text-center"
            >
              Continuar Entrenando
            </button>
            <button
              type="button"
              onClick={() => {
                dismissSessionReminderBanner();
                finishAndAnalyzeWorkout();
              }}
              className="flex-[1.4] flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#DEB868] via-[#E8C87A] to-[#C89D48] py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-[#0B0A0E] shadow-[0_4px_20px_rgba(222,184,104,0.3)] hover:brightness-105 active:scale-95 transition-all text-center"
            >
              <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />
              Guardar Sesión Ahora
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
