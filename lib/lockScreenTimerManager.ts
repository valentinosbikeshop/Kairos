import { formatMmSs } from '@/lib/formatters';

const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let backgroundWorker: Worker | null = null;
let backgroundAudioEl: HTMLAudioElement | null = null;
let activeNotificationRef: Notification | null = null;

/**
 * Creates an inline Web Worker that fires ticks every 90ms.
 * Web Workers run on a background thread and are NOT throttled or suspended
 * when the screen is locked, ensuring the countdown and beeps fire at the exact millisecond.
 */
export function startBackgroundWorkerClock(onTick: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  stopBackgroundWorkerClock();

  try {
    const workerScript = `
      let intervalId = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (intervalId) clearInterval(intervalId);
          intervalId = setInterval(function() {
            self.postMessage('tick');
          }, 90);
        } else if (e.data === 'stop') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    worker.onmessage = (e) => {
      if (e.data === 'tick') {
        onTick();
      }
    };

    worker.postMessage('start');
    backgroundWorker = worker;

    return () => {
      stopBackgroundWorkerClock();
      URL.revokeObjectURL(url);
    };
  } catch {
    // Fallback if Web Workers are restricted by CSP/sandbox
    const id = setInterval(onTick, 90);
    return () => clearInterval(id);
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
 * Mantiene el ciclo de vida del temporizador sin interrumpir la música de fondo
 * (Apple Music, Spotify). NO usamos un elemento <audio> HTML aquí para no robar el foco
 * de audio del sistema operativo iOS/Android.
 */
export function startSilentBackgroundAudio(): void {
  // Sin <audio>.play() para garantizar mezcla pura sobre música del usuario sin pausas
}

export function stopSilentBackgroundAudio(): void {
  if (backgroundAudioEl) {
    try {
      backgroundAudioEl.pause();
      backgroundAudioEl.currentTime = 0;
    } catch {
      // Ignore
    }
  }
}

/**
 * Updates the native Lock Screen Media Widget (Media Session API).
 * Displays a live countdown scrub-bar, phase title, and play/pause/skip controls
 * directly on the iOS / Android lock screen.
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

    if (params.onTogglePlayPause) {
      navigator.mediaSession.setActionHandler('play', params.onTogglePlayPause);
      navigator.mediaSession.setActionHandler('pause', params.onTogglePlayPause);
    }
    if (params.onSkip) {
      navigator.mediaSession.setActionHandler('nexttrack', params.onSkip);
      navigator.mediaSession.setActionHandler('stop', params.onSkip);
    }
    if (params.onAddSeconds) {
      navigator.mediaSession.setActionHandler('seekforward', () => params.onAddSeconds?.(15));
      navigator.mediaSession.setActionHandler('seekbackward', () => params.onAddSeconds?.(-15));
    }
  } catch {
    // Ignore mediaSession exceptions
  }
}

export function clearLockScreenMediaSession(): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
    navigator.mediaSession.setActionHandler('stop', null);
    navigator.mediaSession.setActionHandler('seekforward', null);
    navigator.mediaSession.setActionHandler('seekbackward', null);
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
 * Emits an urgent notification to the user's lock screen.
 * - While running: Displays a persistent status indicator of the active timer.
 * - When finished: Dispatches an urgent alarm notification with vibration and alert sound.
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
        await reg.showNotification(params.isFinished ? `🔔 ¡Tiempo Cumplido! — KAIROS` : `⏱️ KAIROS: ${params.title}`, {
          body: params.body,
          icon: '/icon',
          badge: '/icon',
          tag: 'kairos-active-timer',
          renotify: Boolean(params.isFinished),
          requireInteraction: true,
          silent: !params.isFinished,
          vibrate: params.isFinished ? [300, 150, 300, 150, 600] : undefined,
        } as NotificationOptions);
        return;
      }
    }

    // Direct Notification fallback
    if (activeNotificationRef) {
      activeNotificationRef.close();
    }

    activeNotificationRef = new Notification(
      params.isFinished ? `🔔 ¡Tiempo Cumplido! — KAIROS` : `⏱️ KAIROS: ${params.title}`,
      {
        body: params.body,
        icon: '/icon',
        badge: '/icon',
        tag: 'kairos-active-timer',
        renotify: Boolean(params.isFinished),
        requireInteraction: true,
        silent: !params.isFinished,
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
