'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useKairos } from '@/lib/kairosContext';
import { kairosAudio, KairosAudioHealth, SOUND_PROFILE_META } from '@/lib/audioEngine';
import { SoundProfile } from '@/types/kairos';
import { Bell, Check, Minus, Plus, Radio, Volume2, VolumeX, X, Zap } from 'lucide-react';

/**
 * Discreet Gothic Header Button + Modal Sheet to adjust volume (0% - 200%),
 * mute/unmute, test acoustic cues over Spotify/Apple Music, and switch tone profiles.
 * Portaled to document.body to avoid being trapped inside headers with backdrop-blur.
 */
export function SoundSettingsButton() {
  const { audioSettings } = useKairos();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  const isMuted = audioSettings.gainPercent === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          kairosAudio.unlock(true);
          setOpen(true);
        }}
        aria-label="Configurar volumen y tonos"
        className="inline-flex items-center gap-1.5 rounded-xl border border-stoneborder bg-surface px-3 py-1.5 text-xs font-medium text-brand-muted hover:border-gothic/50 hover:text-brand active:scale-95"
      >
        {isMuted ? (
          <VolumeX className="h-3.5 w-3.5 text-brand-subtle" />
        ) : (
          <Volume2 className="h-3.5 w-3.5 text-gothic" />
        )}
        <span className="tabular-nums">
          {isMuted ? 'Silencio' : `${audioSettings.gainPercent}%`}
        </span>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl border border-stoneborder bg-surface p-5 shadow-2xl animate-fade-up pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-stoneborder pb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gothic">
                    Audio no intrusivo
                  </span>
                  <h3 className="font-gothic text-base font-semibold text-brand mt-0.5">
                    Volumen y Tonos del Timer
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar ajustes de sonido"
                  className="rounded-xl border border-stoneborder bg-background p-2 text-brand-muted hover:text-brand"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <AudioMixerPanel />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export function AudioMixerPanel() {
  const { audioSettings, updateAudioSettings } = useKairos();
  const [lastSavedGain, setLastSavedGain] = useState<number>(() =>
    audioSettings.gainPercent > 0 ? audioSettings.gainPercent : 115
  );
  const [testingSound, setTestingSound] = useState(false);
  const [audioHealth, setAudioHealth] = useState<KairosAudioHealth>('locked');

  useEffect(() => {
    return kairosAudio.subscribeHealth(setAudioHealth);
  }, []);

  const setGain = (nextVal: number) => {
    const clamped = Math.max(0, Math.min(200, Math.round(nextVal / 5) * 5));
    kairosAudio.unlock(true);
    if (clamped > 0) {
      setLastSavedGain(clamped);
    }
    updateAudioSettings({ gainPercent: clamped });
  };

  const handleProfileSelect = (profile: SoundProfile) => {
    kairosAudio.unlock(true);
    const restoredGain = audioSettings.gainPercent === 0 ? lastSavedGain : audioSettings.gainPercent;
    updateAudioSettings({ profile, gainPercent: restoredGain });
    setTimeout(() => {
      kairosAudio.playCompletionCue('work');
    }, 35);
  };

  const handlePreviewTone = () => {
    kairosAudio.unlock(true);
    if (audioSettings.gainPercent === 0) {
      updateAudioSettings({ gainPercent: lastSavedGain });
    }
    setTestingSound(true);
    kairosAudio.playCountdownPip(2);
    setTimeout(() => kairosAudio.playCountdownPip(1), 320);
    setTimeout(() => {
      kairosAudio.playCompletionCue('finish');
      setTestingSound(false);
    }, 660);
  };

  const profiles: { id: SoundProfile; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'minimal', icon: Radio },
    { id: 'boxing', icon: Bell },
    { id: 'tactical', icon: Zap },
  ];

  const isMuted = audioSettings.gainPercent === 0;

  return (
    <div className="space-y-4">
      {/* Volume Control Card */}
      <div className="rounded-2xl border border-stoneborder bg-background/75 p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-brand">Intensidad del aviso</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-gothic">
            {isMuted
              ? '0% · Silencio'
              : audioSettings.gainPercent > 100
                ? `${audioSettings.gainPercent}% · Boost`
                : `${audioSettings.gainPercent}%`}
          </span>
        </div>

        {/* Stepper + Slider */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setGain(audioSettings.gainPercent - 15)}
            aria-label="Disminuir volumen"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stoneborder bg-surface text-brand-muted hover:text-brand active:scale-95"
          >
            <Minus className="h-4 w-4" />
          </button>

          <input
            type="range"
            min={0}
            max={200}
            step={5}
            value={audioSettings.gainPercent}
            onChange={(e) => setGain(Number(e.target.value))}
            aria-label="Regulador de volumen 0 a 200 por ciento"
            className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-elevated accent-[#B5A082]"
          />

          <button
            type="button"
            onClick={() => setGain(audioSettings.gainPercent + 15)}
            aria-label="Aumentar volumen"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stoneborder bg-surface text-brand-muted hover:text-brand active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Volume Presets + Preview Button */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <div className="flex items-center gap-1.5">
            {[
              { label: 'Silencio', val: 0 },
              { label: '75%', val: 75 },
              { label: '115%', val: 115 },
              { label: '175%', val: 175 },
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => setGain(preset.val)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] tabular-nums transition-colors ${
                  audioSettings.gainPercent === preset.val
                    ? 'border-gothic bg-gothic/20 text-brand font-medium'
                    : 'border-stoneborder bg-surface text-brand-muted hover:text-brand'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handlePreviewTone}
            disabled={testingSound}
            className="rounded-lg border border-gothic/50 bg-gothic/15 px-3 py-1 text-[11px] font-semibold text-brand active:scale-95 disabled:opacity-60"
          >
            {testingSound ? 'Sonando...' : 'Probar'}
          </button>
        </div>
      </div>

      {/* Tone Profile Selector */}
      <div className="space-y-2">
        <span className="block text-xs text-brand-muted">Tono de aviso (se mezcla con tu música)</span>
        <div className="space-y-2">
          {profiles.map(({ id, icon: Icon }) => {
            const meta = SOUND_PROFILE_META[id];
            const active = audioSettings.profile === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleProfileSelect(id)}
                className={`w-full flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-colors active:scale-[0.99] ${
                  active
                    ? 'border-gothic/60 bg-elevated'
                    : 'border-stoneborder bg-background/60 hover:border-stoneborder'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                      active
                        ? 'border-gothic/50 bg-gothic/20 text-gothic'
                        : 'border-stoneborder bg-surface text-brand-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-brand">{meta.name}</div>
                    <div className="text-[11px] text-brand-muted truncate">{meta.subtitle}</div>
                  </div>
                </div>

                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    active
                      ? 'border-gothic bg-gothic text-background'
                      : 'border-stoneborder bg-surface text-transparent'
                  }`}
                >
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Estado del Motor de Audio + Compatibilidad Apple Music / Spotify */}
      <div className="rounded-2xl border border-stoneborder bg-background/75 p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                audioHealth === 'running' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="text-xs font-medium text-brand">
              {audioHealth === 'running'
                ? 'Motor de sonido activo (Apple Music / Spotify)'
                : 'Motor en reposo — toca para activar'}
            </span>
          </div>
          {audioHealth !== 'running' && (
            <button
              type="button"
              onClick={handlePreviewTone}
              className="rounded-lg bg-gothic/20 border border-gothic/50 px-2.5 py-1 text-[11px] font-semibold text-brand active:scale-95"
            >
              Reactivar
            </button>
          )}
        </div>
        <p className="text-[11px] text-brand-muted leading-relaxed">
          KAIROS atenúa ligeramente tu música (ducking) durante 0.3s al sonar cada pitido sin pausar
          Apple Music. En iPhone, asegúrate de no tener activado el modo Silencio del dispositivo.
        </p>
      </div>
    </div>
  );
}
