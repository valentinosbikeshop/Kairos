'use client';

import React, { useState } from 'react';
import { AiCoachModal } from '@/components/AiCoachModal';
import { Sparkles } from 'lucide-react';

export function FloatingAiCoachButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button constrained inside the centered iPhone chassis */}
      <div className="fixed ios-floating-ai-bottom z-[110] right-4 sm:right-[calc(50%-215px+16px)]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Consultor KAIROS AI · Evidencia Deportiva y Biomecánica"
          aria-label="Abrir asistente de IA KAIROS"
          className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-gothic/70 bg-[#161224]/95 text-gothic shadow-[0_6px_28px_rgba(0,0,0,0.75)] backdrop-blur-xl transition-all hover:scale-105 hover:border-gothic active:scale-95 ring-1 ring-white/10"
        >
          {/* Subtle gothic glow ring */}
          <span className="absolute -inset-1 rounded-full bg-gothic/30 opacity-70 blur-md group-hover:opacity-100 transition-opacity" />

          <div className="relative flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-gothic drop-shadow-[0_0_10px_rgba(157,78,221,0.8)]" />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-black text-background shadow-md">
              IA
            </span>
          </div>
        </button>
      </div>

      <AiCoachModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
