import { AudioSettings, SoundProfile } from '@/types/kairos';

interface NavigatorWithAudioSession extends Navigator {
  audioSession?: {
    type: 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';
  };
}

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export const SOUND_PROFILE_META: Record<
  SoundProfile,
  { name: string; subtitle: string; badge: string }
> = {
  minimal: {
    name: 'Kairos Minimal',
    subtitle: 'Sinusoidal puro 880Hz + acorde armónico 1318.5Hz',
    badge: 'Por Defecto',
  },
  boxing: {
    name: 'Campana de Boxeo',
    subtitle: 'Síntesis FM metálica inarmónica de ring',
    badge: 'Ring FM',
  },
  tactical: {
    name: 'Pulso Táctico',
    subtitle: 'Triangular 1200Hz doble-bip anti sub-bass',
    badge: 'Alta Penetración',
  },
};

export type KairosAudioHealth = 'unavailable' | 'locked' | 'running';

class KairosAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private settings: AudioSettings = {
    gainPercent: 115,
    profile: 'minimal',
    vibrationEnabled: true,
  };
  private mixTestTimers: ReturnType<typeof setTimeout>[] = [];
  private autoUnlockInstalled = false;
  private needsRecreate = false;
  private keepAliveSource: AudioBufferSourceNode | null = null;
  private keepAliveWanted = false;
  private healthListeners = new Set<(health: KairosAudioHealth) => void>();
  private transientResetTimer: ReturnType<typeof setTimeout> | null = null;
  private htmlAudioEl: HTMLAudioElement | null = null;
  private wavCache = new Map<string, string>();

  /**
   * iOS: 'ambient' mezcla los pitidos con Apple Music / Spotify sin pausar la música.
   * Cuando suena un aviso del timer, conmutamos brevemente a 'transient' para que iOS
   * atenúe (ducking) ligeramente Apple Music durante el pitido y luego restaure el volumen al 100%.
   */
  public configureAmbientSession(): void {
    if (typeof navigator === 'undefined') return;
    if ('audioSession' in navigator) {
      try {
        const nav = navigator as NavigatorWithAudioSession;
        if (nav.audioSession && nav.audioSession.type !== 'ambient') {
          nav.audioSession.type = 'ambient';
        }
      } catch {
        // Ignore on browsers where audioSession.type setter is restricted
      }
    }
  }

  private pulseTransientAudioSession(durationMs: number): void {
    if (typeof navigator === 'undefined' || !('audioSession' in navigator)) return;
    try {
      const nav = navigator as NavigatorWithAudioSession;
      if (nav.audioSession) {
        nav.audioSession.type = 'transient';
        if (this.transientResetTimer) clearTimeout(this.transientResetTimer);
        this.transientResetTimer = setTimeout(() => {
          try {
            if (nav.audioSession) {
              nav.audioSession.type = 'ambient';
            }
          } catch {
            // Ignore
          }
        }, Math.max(180, durationMs));
      }
    } catch {
      // Ignore
    }
  }

  private buildWavDataUri(
    tones: { freq: number; startSec: number; durSec: number; amp: number }[],
    totalSec: number
  ): string {
    const key = `${this.settings.profile}_${Math.round(this.settings.gainPercent)}_${tones
      .map((t) => `${t.freq}:${t.startSec}:${t.durSec}`)
      .join('|')}`;
    const cached = this.wavCache.get(key);
    if (cached) return cached;

    const sampleRate = 22050;
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
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    const linearGain = Math.min(2.0, this.percentToLinearGain(this.settings.gainPercent));

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      for (const tone of tones) {
        if (t >= tone.startSec && t <= tone.startSec + tone.durSec) {
          const localT = t - tone.startSec;
          const attack = Math.min(1, localT / 0.006);
          const decay = Math.exp((-3.5 * localT) / tone.durSec);
          sample += Math.sin(2 * Math.PI * tone.freq * localT) * tone.amp * attack * decay;
        }
      }
      const boosted = Math.max(-0.98, Math.min(0.98, sample * linearGain));
      view.setInt16(44 + i * 2, Math.round(boosted * 32767), true);
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const uri = `data:audio/wav;base64,${typeof btoa === 'function' ? btoa(binary) : ''}`;
    if (this.wavCache.size > 24) this.wavCache.clear();
    this.wavCache.set(key, uri);
    return uri;
  }

  private playFallbackWav(
    tones: { freq: number; startSec: number; durSec: number; amp: number }[],
    totalSec: number
  ): void {
    if (typeof window === 'undefined' || this.settings.gainPercent <= 0) return;
    try {
      const uri = this.buildWavDataUri(tones, totalSec);
      if (!this.htmlAudioEl) {
        this.htmlAudioEl = new Audio();
        this.htmlAudioEl.preload = 'auto';
      }
      this.htmlAudioEl.src = uri;
      this.htmlAudioEl.volume = Math.min(1, Math.max(0.15, this.settings.gainPercent / 115));
      void this.htmlAudioEl.play().catch(() => undefined);
    } catch {
      // Ignore
    }
  }

  /** Estado actual del motor de audio para diagnósticos de la UI. */
  public getHealth(): KairosAudioHealth {
    if (typeof window === 'undefined') return 'unavailable';
    const AudioCtx =
      window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioCtx) return 'unavailable';
    if (!this.ctx) return 'locked';
    return this.ctx.state === 'running' ? 'running' : 'locked';
  }

  public subscribeHealth(listener: (health: KairosAudioHealth) => void): () => void {
    this.healthListeners.add(listener);
    listener(this.getHealth());
    return () => {
      this.healthListeners.delete(listener);
    };
  }

  private emitHealth(): void {
    const health = this.getHealth();
    this.healthListeners.forEach((fn) => fn(health));
  }

  private createContext(): AudioContext | null {
    const AudioCtx =
      window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx({ latencyHint: 'interactive' });

    // Signal Chain: Oscillator -> Envelope Gain -> MasterGain -> DynamicsCompressor -> Destination
    const masterGain = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();

    // Tuned dynamics compressor so 200% boost cuts over Spotify/Apple Music without clipping
    compressor.threshold.setValueAtTime(-10, ctx.currentTime);
    compressor.knee.setValueAtTime(16, ctx.currentTime);
    compressor.ratio.setValueAtTime(10, ctx.currentTime);
    compressor.attack.setValueAtTime(0.002, ctx.currentTime);
    compressor.release.setValueAtTime(0.14, ctx.currentTime);

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    ctx.onstatechange = () => {
      // iOS usa el estado no estándar 'interrupted' cuando otra app (Apple Music, llamada, Siri)
      // toma la sesión de audio. Lo marcamos para recrear el contexto en el próximo toque.
      const state = ctx.state as string;
      if (state === 'interrupted') {
        this.needsRecreate = true;
      }
      if (state === 'running') {
        this.needsRecreate = false;
        if (this.keepAliveWanted) this.startKeepAliveSource();
      }
      this.emitHealth();
    };

    this.ctx = ctx;
    this.masterGain = masterGain;
    this.compressor = compressor;
    this.keepAliveSource = null;
    this.applyMasterGain();
    return ctx;
  }

  private destroyContext(): void {
    const old = this.ctx;
    this.stopKeepAliveSource();
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    if (old) {
      old.onstatechange = null;
      void old.close().catch(() => undefined);
    }
  }

  /**
   * Plays a 1-sample silent buffer. iOS only fully unlocks Web Audio when a source is started
   * synchronously inside a user gesture.
   */
  private primeWithSilentBuffer(ctx: AudioContext): void {
    try {
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // Ignore
    }
  }

  /**
   * Debe llamarse desde gestos del usuario (toques) o antes de reproducir.
   * Reanuda el contexto tanto en 'suspended' como en 'interrupted' (iOS) y lo recrea si quedó bloqueado.
   */
  public unlock(fromGesture = false): AudioContext | null {
    if (typeof window === 'undefined') return null;

    this.configureAmbientSession();
    this.installAutoUnlock();

    const state = this.ctx?.state as string | undefined;
    if (this.ctx && (state === 'closed' || (fromGesture && this.needsRecreate && state !== 'running'))) {
      this.destroyContext();
      this.needsRecreate = false;
    }

    if (!this.ctx) {
      if (!this.createContext()) return null;
    }

    const ctx = this.ctx as AudioContext;
    if (fromGesture) this.primeWithSilentBuffer(ctx);

    if ((ctx.state as string) !== 'running') {
      ctx
        .resume()
        .then(() => this.emitHealth())
        .catch(() => {
          this.needsRecreate = true;
          this.emitHealth();
        });
    }

    return ctx;
  }

  /**
   * Re-desbloquea el audio automáticamente con cualquier toque en pantalla y al volver a la app.
   * Soluciona el silencio total tras cambiar a Apple Music / Spotify y regresar a KAIROS.
   */
  private installAutoUnlock(): void {
    if (this.autoUnlockInstalled || typeof window === 'undefined') return;
    this.autoUnlockInstalled = true;

    const onGesture = () => {
      if (!this.ctx || (this.ctx.state as string) !== 'running' || this.needsRecreate) {
        this.unlock(true);
      }
    };
    const gestureEvents: (keyof WindowEventMap)[] = ['pointerdown', 'touchend', 'click', 'keydown'];
    gestureEvents.forEach((evt) =>
      window.addEventListener(evt, onGesture, { capture: true, passive: true })
    );

    const onForeground = () => {
      if (document.visibilityState !== 'visible') return;
      this.configureAmbientSession();
      if (this.ctx && (this.ctx.state as string) !== 'running') {
        this.ctx
          .resume()
          .then(() => this.emitHealth())
          .catch(() => {
            this.needsRecreate = true;
            this.emitHealth();
          });
      }
    };
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pageshow', onForeground);
    window.addEventListener('focus', onForeground);
  }

  /**
   * Mantiene viva la sesión de audio mientras hay un temporizador activo para que iOS
   * no duerma el hardware entre pitidos. Emite una señal a -100 dB (inaudible).
   */
  public setKeepAlive(active: boolean): void {
    this.keepAliveWanted = active;
    if (active) {
      this.unlock();
      this.startKeepAliveSource();
    } else {
      this.stopKeepAliveSource();
    }
  }

  private startKeepAliveSource(): void {
    const ctx = this.ctx;
    if (!ctx || this.keepAliveSource) return;
    try {
      const seconds = 1;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.00001;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(ctx.destination);
      src.start();
      this.keepAliveSource = src;
    } catch {
      this.keepAliveSource = null;
    }
  }

  private stopKeepAliveSource(): void {
    if (!this.keepAliveSource) return;
    try {
      this.keepAliveSource.stop();
      this.keepAliveSource.disconnect();
    } catch {
      // Ignore
    }
    this.keepAliveSource = null;
  }

  /**
   * Ejecuta el sintetizador únicamente con el contexto en estado 'running'.
   * Si está suspendido/interrumpido, espera a que se reanude para no programar sonidos
   * en un reloj congelado (causa de pitidos perdidos en iOS).
   */
  private withRunningContext(play: (ctx: AudioContext, master: GainNode, now: number) => void): void {
    const ctx = this.unlock();
    if (!ctx) return;

    const run = () => {
      if (!this.ctx || !this.masterGain) return;
      play(this.ctx, this.masterGain, this.ctx.currentTime + 0.012);
    };

    if ((ctx.state as string) === 'running') {
      run();
      return;
    }

    let done = false;
    const timeout = setTimeout(() => {
      done = true;
    }, 1200);
    ctx
      .resume()
      .then(() => {
        clearTimeout(timeout);
        if (!done) run();
      })
      .catch(() => {
        clearTimeout(timeout);
        this.needsRecreate = true;
        this.emitHealth();
      });
  }

  public updateSettings(next: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...next };
    this.applyMasterGain();
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  private percentToLinearGain(percent: number): number {
    const clamped = Math.max(0, Math.min(200, percent));
    if (clamped === 0) return 0;
    // Smooth curve: 100% -> 1.0, 200% -> 2.5 overdrive into compressor
    if (clamped <= 100) {
      return (clamped / 100) * 1.0;
    }
    return 1.0 + ((clamped - 100) / 100) * 1.5;
  }

  private applyMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const target = this.percentToLinearGain(this.settings.gainPercent);
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.015);
  }

  private vibrate(pattern: number | number[]): void {
    if (!this.settings.vibrationEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // iOS Safari does not expose navigator.vibrate; safely ignored
      }
    }
  }

  /**
   * Plays countdown pip for 3, 2, 1 seconds remaining.
   */
  public playCountdownPip(secondRemaining: 3 | 2 | 1 = 1): void {
    this.vibrate(35);
    if (this.settings.gainPercent <= 0) return;

    this.pulseTransientAudioSession(260);

    const ctx = this.unlock();
    if (!ctx || (ctx.state as string) !== 'running') {
      const freq = this.settings.profile === 'tactical' ? 1200 : 880;
      this.playFallbackWav([{ freq, startSec: 0, durSec: 0.13, amp: 0.75 }], 0.16);
    }

    this.withRunningContext((c, _master, now) =>
      this.synthCountdownPip(c, now, secondRemaining)
    );
  }

  private synthCountdownPip(ctx: AudioContext, now: number, secondRemaining: 3 | 2 | 1): void {
    if (!this.masterGain) return;
    const profile = this.settings.profile;

    if (profile === 'minimal') {
      // Pure 880Hz sine pulse of 120ms
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.65, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(env);
      env.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.125);
    } else if (profile === 'boxing') {
      // Crisp metallic/wood ring clapper warning tap
      const carrier = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const env = ctx.createGain();

      carrier.type = 'triangle';
      carrier.frequency.setValueAtTime(secondRemaining === 1 ? 820 : 740, now);

      mod.type = 'sine';
      mod.frequency.setValueAtTime(1180, now);
      modGain.gain.setValueAtTime(260, now);
      modGain.gain.exponentialRampToValueAtTime(10, now + 0.09);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.7, now + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(env);
      env.connect(this.masterGain);

      mod.start(now);
      carrier.start(now);
      mod.stop(now + 0.145);
      carrier.stop(now + 0.145);
    } else {
      // Tactical: 1200Hz triangle double rapid beep (cuts over heavy sub-bass)
      const offsets = [0, 0.085];
      offsets.forEach((offset) => {
        if (!this.masterGain) return;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const t = now + offset;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.78, t + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

        osc.connect(env);
        env.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.06);
      });
    }
  }

  /**
   * Plays completion / phase transition signal at 00:00.
   * cueType 'work' = start set / work phase (energetic ascending), 'rest' = enter rest phase, 'finish' = timer complete.
   */
  public playCompletionCue(cueType: 'finish' | 'work' | 'rest' = 'finish'): void {
    this.vibrate(cueType === 'rest' ? [60, 40, 60] : [90, 45, 130]);
    if (this.settings.gainPercent <= 0) return;

    this.pulseTransientAudioSession(750);

    const ctx = this.unlock();
    if (!ctx || (ctx.state as string) !== 'running') {
      const tones =
        cueType === 'rest'
          ? [
              { freq: 880, startSec: 0, durSec: 0.22, amp: 0.72 },
              { freq: 659.25, startSec: 0.15, durSec: 0.28, amp: 0.72 },
            ]
          : [
              { freq: 880, startSec: 0, durSec: 0.42, amp: 0.72 },
              { freq: 1318.5, startSec: 0.06, durSec: 0.45, amp: 0.72 },
            ];
      this.playFallbackWav(tones, 0.56);
    }

    this.withRunningContext((c, _master, now) => this.synthCompletionCue(c, now, cueType));
  }

  private synthCompletionCue(
    ctx: AudioContext,
    now: number,
    cueType: 'finish' | 'work' | 'rest'
  ): void {
    if (!this.masterGain) return;
    const profile = this.settings.profile;

    if (profile === 'minimal') {
      if (cueType === 'rest') {
        // Clean descending interval (880Hz -> 659.25Hz) signaling "Descansar"
        const freqs = [880, 659.25];
        freqs.forEach((f, idx) => {
          if (!this.masterGain) return;
          const t = now + idx * 0.14;
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t);
          env.gain.setValueAtTime(0.0001, t);
          env.gain.exponentialRampToValueAtTime(0.68, t + 0.01);
          env.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
          osc.connect(env);
          env.connect(this.masterGain);
          osc.start(t);
          osc.stop(t + 0.26);
        });
      } else {
        // Ascending harmonic chord (880Hz + 1318.5Hz of 450ms as specified)
        const voices = [
          { freq: 880, delay: 0, dur: 0.45, amp: 0.65 },
          { freq: 1318.5, delay: 0.055, dur: 0.45, amp: 0.62 },
        ];
        voices.forEach(({ freq, delay, dur, amp }) => {
          if (!this.masterGain) return;
          const t = now + delay;
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);

          env.gain.setValueAtTime(0.0001, t);
          env.gain.exponentialRampToValueAtTime(amp, t + 0.012);
          env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

          osc.connect(env);
          env.connect(this.masterGain);
          osc.start(t);
          osc.stop(t + dur + 0.01);
        });
      }
    } else if (profile === 'boxing') {
      // FM Metallic Boxing Ring Bell with inharmonic partials & long decay
      const strikes = cueType === 'rest' ? [0, 0.22] : [0];
      strikes.forEach((strikeOffset) => {
        const t = now + strikeOffset;
        const partials = [
          { ratio: 1.0, modRatio: 1.43, modDepth: 520, amp: 0.62, decay: 0.95 },
          { ratio: 1.414, modRatio: 2.13, modDepth: 340, amp: 0.36, decay: 0.72 },
          { ratio: 2.38, modRatio: 3.17, modDepth: 220, amp: 0.25, decay: 0.52 },
        ];
        const baseFreq = 640;

        partials.forEach((p) => {
          if (!this.masterGain) return;
          const carrier = ctx.createOscillator();
          const mod = ctx.createOscillator();
          const modGain = ctx.createGain();
          const env = ctx.createGain();

          carrier.type = 'sine';
          carrier.frequency.setValueAtTime(baseFreq * p.ratio, t);

          mod.type = 'sine';
          mod.frequency.setValueAtTime(baseFreq * p.modRatio, t);
          modGain.gain.setValueAtTime(p.modDepth, t);
          modGain.gain.exponentialRampToValueAtTime(8, t + p.decay * 0.6);

          env.gain.setValueAtTime(0.0001, t);
          env.gain.exponentialRampToValueAtTime(p.amp, t + 0.003);
          env.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);

          mod.connect(modGain);
          modGain.connect(carrier.frequency);
          carrier.connect(env);
          env.connect(this.masterGain);

          mod.start(t);
          carrier.start(t);
          mod.stop(t + p.decay + 0.02);
          carrier.stop(t + p.decay + 0.02);
        });
      });
    } else {
      // Tactical High-Penetration Burst (1200Hz -> 1480Hz -> 1760Hz triangle)
      const notes =
        cueType === 'rest'
          ? [
              { freq: 1350, offset: 0, dur: 0.11 },
              { freq: 1020, offset: 0.13, dur: 0.18 },
            ]
          : [
              { freq: 1200, offset: 0, dur: 0.09 },
              { freq: 1450, offset: 0.105, dur: 0.09 },
              { freq: 1760, offset: 0.21, dur: 0.26 },
            ];

      notes.forEach(({ freq, offset, dur }) => {
        if (!this.masterGain) return;
        const t = now + offset;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.85, t + 0.005);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(env);
        env.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      });
    }
  }

  /**
   * Subtle crisp micro-confirmation when checking off a set (✓)
   */
  public playSetCheckFeedback(): void {
    this.vibrate(20);
    if (this.settings.gainPercent <= 0) return;
    this.withRunningContext((ctx, master, now) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.065);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.32, now + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

      osc.connect(env);
      env.connect(master);
      osc.start(now);
      osc.stop(now + 0.09);
    });
  }

  /**
   * Live calibration sequence: "3 - 2 - 1 - ¡TIEMPO!" so user can adjust 0-200% gain with Spotify/Apple Music playing.
   */
  public triggerMusicMixTest(onStepChange?: (step: string | null) => void): void {
    this.cancelMusicMixTest();
    this.unlock(true);

    onStepChange?.('3');
    this.playCountdownPip(3);

    this.mixTestTimers.push(
      setTimeout(() => {
        onStepChange?.('2');
        this.playCountdownPip(2);
      }, 850)
    );

    this.mixTestTimers.push(
      setTimeout(() => {
        onStepChange?.('1');
        this.playCountdownPip(1);
      }, 1700)
    );

    this.mixTestTimers.push(
      setTimeout(() => {
        onStepChange?.('¡TIEMPO!');
        this.playCompletionCue('finish');
      }, 2550)
    );

    this.mixTestTimers.push(
      setTimeout(() => {
        onStepChange?.(null);
      }, 3600)
    );
  }

  public cancelMusicMixTest(): void {
    this.mixTestTimers.forEach((t) => clearTimeout(t));
    this.mixTestTimers = [];
  }
}

export const kairosAudio = new KairosAudioEngine();
