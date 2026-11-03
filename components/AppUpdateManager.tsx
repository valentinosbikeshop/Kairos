'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, Sparkles } from 'lucide-react';

const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';

export async function performInPlaceAppUpdate(targetBuildId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          try {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          } catch {
            // Ignore
          }
        })
      );
    }

    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
  } catch {
    // Ignore cache cleanup errors
  }

  const stamp = targetBuildId || `${Date.now()}`;
  const url = new URL(window.location.href);
  url.searchParams.set('_kv', stamp);
  window.location.replace(url.toString());
}

export function useAppUpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteBuildId, setRemoteBuildId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [justCheckedUpToDate, setJustCheckedUpToDate] = useState(false);

  // Clean cache-busting query param after reload so the Home Screen URL remains pristine
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.search.includes('_kv=')) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  const checkForUpdate = useCallback(async (manual = false): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (manual) setChecking(true);
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { ok?: boolean; buildId?: string };
      const latest = data?.buildId;
      if (
        latest &&
        latest !== 'dev' &&
        CLIENT_BUILD_ID !== 'dev' &&
        latest !== CLIENT_BUILD_ID
      ) {
        setRemoteBuildId(latest);
        setUpdateAvailable(true);
        return true;
      }
      if (manual) {
        setJustCheckedUpToDate(true);
        setTimeout(() => setJustCheckedUpToDate(false), 2600);
      }
      return false;
    } catch {
      return false;
    } finally {
      if (manual) setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkForUpdate(false);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate(false);
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate(false);
      }
    }, 180_000);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [checkForUpdate]);

  const applyUpdateNow = useCallback(async () => {
    setUpdating(true);
    await performInPlaceAppUpdate(remoteBuildId || undefined);
  }, [remoteBuildId]);

  return {
    updateAvailable,
    remoteBuildId,
    checking,
    updating,
    justCheckedUpToDate,
    checkForUpdate,
    applyUpdateNow,
  };
}

/**
 * Banner automático superior que aparece apenas tú despliegas una nueva versión,
 * permitiendo actualizar sin borrar el atajo de pantalla de inicio.
 */
export function AppUpdateBanner() {
  const { updateAvailable, updating, applyUpdateNow } = useAppUpdateChecker();

  if (!updateAvailable) return null;

  return (
    <div className="sticky top-0 z-50 mx-auto w-full max-w-[430px] px-4 ios-header-safe-pt">
      <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-gothic/60 bg-surface/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl animate-fade-up">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 text-gothic" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-brand truncate">
              Nueva versión disponible
            </p>
            <p className="text-[10px] text-brand-muted truncate">
              Actualiza al instante sin borrar tu atajo de inicio
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void applyUpdateNow()}
          disabled={updating}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-background active:scale-95 disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${updating ? 'animate-spin' : ''}`} />
          <span>{updating ? 'Actualizando...' : 'Actualizar'}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Botón compacto para que el usuario pueda verificar o forzar la actualización de la app en cualquier momento.
 */
export function AppUpdateButton({ compact = false }: { compact?: boolean } = {}) {
  const {
    updateAvailable,
    checking,
    updating,
    justCheckedUpToDate,
    checkForUpdate,
    applyUpdateNow,
  } = useAppUpdateChecker();

  const handleClick = async () => {
    if (updateAvailable) {
      await applyUpdateNow();
      return;
    }
    const found = await checkForUpdate(true);
    if (found) {
      await applyUpdateNow();
    } else {
      // Si el usuario pulsa explícitamente actualizar y quiere refrescar caché del atajo PWA:
      await performInPlaceAppUpdate();
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={checking || updating}
      title="Actualizar aplicación a la última versión sin eliminar el atajo de pantalla de inicio"
      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
        updateAvailable
          ? 'border-gothic bg-gothic/20 text-brand animate-pulse'
          : 'border-stoneborder bg-surface text-brand-muted hover:border-gothic/50 hover:text-brand'
      }`}
    >
      {justCheckedUpToDate ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <RefreshCw
          className={`h-3.5 w-3.5 ${
            checking || updating ? 'animate-spin text-gothic' : updateAvailable ? 'text-gothic' : ''
          }`}
        />
      )}
      {(!compact || updateAvailable || updating) && (
        <span>
          {updating
            ? 'Actualizando...'
            : updateAvailable
              ? '¡Actualizar!'
              : 'Actualizar'}
        </span>
      )}
    </button>
  );
}
