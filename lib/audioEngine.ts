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

  public configureAmbientSession(): void {
    if (typeof navigator === 'undefined') return;
    if ('audioSession' in navigator) {
      try {
        const nav = navigator as NavigatorWithAudioSession;
        if (nav.audioSession) {
          nav.audioSession.type = 'ambient';
        }
      } catch {
        // Ignore on browsers where audioSession.type setter is restricted
      }
    }
  }

  public unlock(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    this.configureAmbientSession();

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx({ latencyHint: 'interactive' });

      // Signal Chain: Oscillator -> Envelope Gain -> MasterGain -> DynamicsCompressor -> Destination
      this.masterGain = this.ctx.createGain();
      this.compressor = this.ctx.createDynamicsCompressor();

      // Tuned dynamics compressor so 200% boost cuts over Spotify/Apple Music without clipping
      this.compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(16, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.14, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
      this.applyMasterGain();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
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

    const ctx = this.unlock();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
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

    const ctx = this.unlock();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
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
    const ctx = this.unlock();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now);
    osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.065);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.32, now + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Live calibration sequence: "3 - 2 - 1 - ¡TIEMPO!" so user can adjust 0-200% gain with Spotify/Apple Music playing.
   */
  public triggerMusicMixTest(onStepChange?: (step: string | null) => void): void {
    this.cancelMusicMixTest();
    this.unlock();

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
