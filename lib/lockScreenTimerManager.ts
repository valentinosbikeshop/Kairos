import { formatMmSs } from '@/lib/formatters';
import { kairosAudio } from '@/lib/audioEngine';

let backgroundWorker: Worker | null = null;
let activeNotificationRef: Notification | null = null;

/**
 * Mantiene la sesión en categoría 'ambient' de Web Audio API mientras un timer esté corriendo.
 * 
 * GARANTÍA ABSOLUTA DE NO-INTERRUPCIÓN (APPLE MUSIC / SPOTIFY):
 * Queda estrictamente prohibido usar elementos <audio> (HTMLAudioElement) para bucles en segundo plano.
 * En iOS Safari y Android, cualquier elemento <audio> que intente reproducirse reclama foco multimedia
 * primario y PAUSA forzosamente aplicaciones externas como Spotify o Apple Music.
 * 
 * En su lugar, KAIROS utiliza Web Audio API en categoría permanente 'ambient' con un keep-alive inaudible (-100dB).
 * Esto garantiza que la música del usuario NUNCA se pause, NUNCA se interrumpa y NUNCA se corte.
 */
export function startSilentBackgroundAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    kairosAudio.setKeepAlive(true);
  } catch {
    // Ignore
  }
}

export function stopSilentBackgroundAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    kairosAudio.setKeepAlive(false);
  } catch {
    // Ignore
  }
}

/**
 * Dispara la señal acústica y háptica de alarma respetando al 100% la música del usuario.
 * - Utiliza síntesis Web Audio en categoría 'ambient' procesada por el Dynamics Compressor.
 * - Corta nítidamente sobre Spotify/Apple Music sin pausar la canción.
 * - Activa vibración háptica reforzada en el dispositivo.
 */
export function playLockScreenAlarmAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    // 1. Síntesis acústica enriquecida en modo ambient (mezcla limpia sobre la música sin pausas)
    kairosAudio.playCompletionCue('finish');

    // 2. Patrón de vibración háptica de alta prioridad
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 150, 400, 150, 600, 200, 800]);
      } catch {
        // Ignore vibration errors
      }
    }
  } catch {
    // Ignore
  }
}

/**
 * Reloj de alta precisión en Web Worker con soporte de alarma exacta programada.
 * Los Web Workers corren en un hilo paralelo que no interfiere con el foco de audio
 * y no pausa ninguna aplicación externa.
 */
export function startBackgroundWorkerClock(onTick: () => void, targetEndTimeMs?: number): () => void {
  if (typeof window === 'undefined') return () => undefined;

  stopBackgroundWorkerClock();

  try {
    const workerScript = `
      let intervalId = null;
      let alarmTimeoutId = null;
      self.onmessage = function(e) {
        const data = e.data;
        if (data === 'start' || (data && data.type === 'start')) {
          if (intervalId) clearInterval(intervalId);
          intervalId = setInterval(function() {
            self.postMessage('tick');
          }, 90);
        } else if (data && data.type === 'scheduleAlarm') {
          if (alarmTimeoutId) clearTimeout(alarmTimeoutId);
          const delay = Math.max(0, (data.targetMs || 0) - Date.now());
          alarmTimeoutId = setTimeout(function() {
            self.postMessage('alarmTrigger');
          }, delay);
        } else if (data === 'stop') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          if (alarmTimeoutId) {
            clearTimeout(alarmTimeoutId);
            alarmTimeoutId = null;
          }
        }
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    worker.onmessage = (e) => {
      if (e.data === 'tick' || e.data === 'alarmTrigger') {
        onTick();
      }
    };

    worker.postMessage('start');
    if (targetEndTimeMs && targetEndTimeMs > Date.now()) {
      worker.postMessage({
        type: 'scheduleAlarm',
        targetMs: targetEndTimeMs,
      });
    }

    backgroundWorker = worker;

    return () => {
      stopBackgroundWorkerClock();
      URL.revokeObjectURL(url);
    };
  } catch {
    // Fallback if Web Workers are restricted by CSP/sandbox
    const id = setInterval(onTick, 90);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (targetEndTimeMs && targetEndTimeMs > Date.now()) {
      timeoutId = setTimeout(onTick, Math.max(0, targetEndTimeMs - Date.now()));
    }
    return () => {
      clearInterval(id);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }
}

export function stopBackgroundWorkerClock(): void {
  if (backgroundWorker) {
    try {
      backgroundWorker.postMessage('stop');
      backgroundWorker.terminate();
    } catch {
      // Ignore
    }
    backgroundWorker = null;
  }
}

/**
 * Actualiza el Widget de Pantalla de Bloqueo (Media Session API).
 * Diseñado pasivamente para no competir con el widget de Spotify o Apple Music.
 */
export function updateLockScreenMediaSession(params: {
  title: string;
  subtitle: string;
  durationSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  onTogglePlayPause?: () => void;
  onSkip?: () => void;
  onAddSeconds?: (sec: number) => void;
}): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

  try {
    const elapsed = Math.max(0, params.durationSeconds - params.remainingSeconds);
    const timeFormatted = formatMmSs(params.remainingSeconds);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `⏱️ ${timeFormatted} · ${params.title}`,
      artist: 'KAIROS Pro Timer',
      album: params.subtitle || 'Santuario de Entrenamiento',
      artwork: [
        { src: '/icon', sizes: '192x192', type: 'image/png' },
        { src: '/apple-icon', sizes: '512x512', type: 'image/png' },
      ],
    });

    if ('setPositionState' in navigator.mediaSession && params.durationSeconds > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(1, params.durationSeconds),
          playbackRate: params.isRunning ? 1 : 0,
          position: Math.min(params.durationSeconds, Math.max(0, elapsed)),
        });
      } catch {
        // Ignore setPositionState boundary errors
      }
    }
  } catch {
    // Ignore mediaSession exceptions
  }
}

export function clearLockScreenMediaSession(): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
  } catch {
    // Ignore
  }
}

// ============================================================================
// NATIVE LOCK SCREEN URGENT NOTIFICATIONS (WEB NOTIFICATIONS API)
// ============================================================================

export type LockNotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationPermissionStatus(): LockNotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as LockNotificationStatus;
}

export async function requestLockNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

/**
 * Emite una notificación urgente a la pantalla de bloqueo sin interrumpir la música.
 * Con isFinished=true se activa con vibración y banner prioritario.
 */
export async function emitLockScreenTimerNotification(params: {
  title: string;
  body: string;
  isFinished?: boolean;
}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    // Try via ServiceWorker first for background persistence on mobile
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(
          params.isFinished ? `🚨 ¡TIEMPO CUMPLIDO! — KAIROS` : `⏱️ KAIROS: ${params.title}`,
          {
            body: params.body,
            icon: '/icon',
            badge: '/icon',
            tag: params.isFinished ? 'kairos-timer-finished' : 'kairos-active-timer',
            renotify: Boolean(params.isFinished),
            requireInteraction: Boolean(params.isFinished),
            silent: false,
            vibrate: params.isFinished ? [400, 150, 400, 150, 600, 200, 800] : undefined,
          } as NotificationOptions
        );
        return;
      }
    }

    // Direct Notification fallback
    if (activeNotificationRef) {
      activeNotificationRef.close();
    }

    activeNotificationRef = new Notification(
      params.isFinished ? `🚨 ¡TIEMPO CUMPLIDO! — KAIROS` : `⏱️ KAIROS: ${params.title}`,
      {
        body: params.body,
        icon: '/icon',
        badge: '/icon',
        tag: params.isFinished ? 'kairos-timer-finished' : 'kairos-active-timer',
        renotify: Boolean(params.isFinished),
        requireInteraction: Boolean(params.isFinished),
        silent: false,
      } as NotificationOptions
    );
  } catch {
    // Ignore notification errors
  }
}

export async function clearLockScreenTimerNotification(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (activeNotificationRef) {
    try {
      activeNotificationRef.close();
    } catch {
      // Ignore
    }
    activeNotificationRef = null;
  }
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const notifications = await reg?.getNotifications({ tag: 'kairos-active-timer' });
      notifications?.forEach((n) => n.close());
    } catch {
      // Ignore
    }
  }
}
