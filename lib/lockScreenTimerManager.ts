import { formatMmSs } from '@/lib/formatters';

let backgroundWorker: Worker | null = null;
let backgroundAudioEl: HTMLAudioElement | null = null;
let alarmAudioEl: HTMLAudioElement | null = null;
let activeNotificationRef: Notification | null = null;

let cachedSilentWavUri: string | null = null;
let cachedAlarmChimeUri: string | null = null;

/**
 * Sintetiza un archivo PCM WAV estricto en memoria codificado en Data URI base64.
 * Generado en microsegundos de forma 100% nativa sin descargas externas.
 */
function buildWavDataUri(
  tones: { freq: number; startSec: number; durSec: number; amp: number }[],
  totalSec: number,
  sampleRate = 22050
): string {
  const numSamples = Math.max(1, Math.floor(sampleRate * totalSec));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;
    for (const tone of tones) {
      if (t >= tone.startSec && t <= tone.startSec + tone.durSec) {
        const localT = t - tone.startSec;
        const attack = Math.min(1, localT / 0.005);
        const decay = Math.exp((-2.8 * localT) / tone.durSec);
        s += Math.sin(2 * Math.PI * tone.freq * localT) * tone.amp * attack * decay;
      }
    }
    const val = Math.max(-0.95, Math.min(0.95, s));
    view.setInt16(44 + i * 2, Math.round(val * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${typeof btoa === 'function' ? btoa(binary) : ''}`;
}

/**
 * Pista de silencio estricto (1.2 segundos). Al reproducirse en bucle continuo,
 * mantiene el hilo de JavaScript y el subsistema de audio de iOS Safari y Android activos
 * incluso cuando la pantalla se bloquea o el usuario cambia de app.
 */
function getSilentWavDataUri(): string {
  if (!cachedSilentWavUri) {
    cachedSilentWavUri = buildWavDataUri([], 1.2, 11025);
  }
  return cachedSilentWavUri;
}

/**
 * Alarma acústica penetrante de alta fidelidad:
 * 2 ráfagas de acorde armónico triple (880Hz + 1174Hz + 1760Hz).
 * Reproducida directamente a través de HTMLAudioElement para sonar con pantalla bloqueada
 * rompiendo cualquier suspensión de la API Web Audio.
 */
function getAlarmChimeDataUri(): string {
  if (!cachedAlarmChimeUri) {
    cachedAlarmChimeUri = buildWavDataUri(
      [
        // Primera ráfaga ascendente
        { freq: 880, startSec: 0.0, durSec: 0.22, amp: 0.85 },
        { freq: 1174.66, startSec: 0.14, durSec: 0.25, amp: 0.9 },
        { freq: 1760, startSec: 0.3, durSec: 0.45, amp: 0.95 },
        // Segunda ráfaga de confirmación
        { freq: 880, startSec: 0.65, durSec: 0.22, amp: 0.85 },
        { freq: 1174.66, startSec: 0.79, durSec: 0.25, amp: 0.9 },
        { freq: 1760, startSec: 0.95, durSec: 0.6, amp: 0.98 },
      ],
      1.65,
      22050
    );
  }
  return cachedAlarmChimeUri;
}

/**
 * Inicia o mantiene la pista silenciosa en segundo plano para habilitar ejecución
 * continua de timers y audio en la pantalla de bloqueo de iOS y Android.
 */
export function startSilentBackgroundAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const silentUri = getSilentWavDataUri();
    if (!backgroundAudioEl) {
      backgroundAudioEl = new Audio();
      backgroundAudioEl.loop = true;
      backgroundAudioEl.preload = 'auto';
    }
    if (backgroundAudioEl.src !== silentUri) {
      backgroundAudioEl.src = silentUri;
    }
    // Volumen mínimo para mantener el bus de hardware abierto sin estorbar
    backgroundAudioEl.volume = 0.01;

    if (backgroundAudioEl.paused) {
      void backgroundAudioEl.play().catch(() => {
        // En navegadores estrictos requiere un gesto del usuario; se invoca desde clics
      });
    }

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'playing';
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore audio loop exceptions
  }
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
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'paused';
    } catch {
      // Ignore
    }
  }
}

/**
 * Dispara la alarma sonora de alta prioridad en la pantalla de bloqueo.
 * Utiliza HTMLAudioElement directo + vibración háptica reforzada.
 */
export function playLockScreenAlarmAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const chimeUri = getAlarmChimeDataUri();
    if (!alarmAudioEl) {
      alarmAudioEl = new Audio();
      alarmAudioEl.preload = 'auto';
    }
    alarmAudioEl.src = chimeUri;
    alarmAudioEl.volume = 1.0;
    void alarmAudioEl.play().catch(() => {
      // Fallback
    });

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 150, 400, 150, 600, 200, 800]);
      } catch {
        // Ignore vibration errors
      }
    }
  } catch {
    // Ignore audio playback errors
  }
}

/**
 * Reloj de alta precisión en Web Worker con soporte de alarma exacta programada.
 * Los Web Workers corren en un hilo paralelo que no es suspendido mientras el audio esté activo.
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
 * Actualiza el Widget Nativo de Pantalla de Bloqueo (Media Session API).
 * Permite ver la cuenta atrás, pausar, reanudar o saltar desde la pantalla de bloqueo de iOS/Android.
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
 * Emite una notificación urgente a la pantalla de bloqueo.
 * Con isFinished=true se activa con prioridad máxima, sonido y vibración.
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
