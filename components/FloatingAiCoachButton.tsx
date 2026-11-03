'use client';

import React, { useState } from 'react';
import { AiCoachModal } from '@/components/AiCoachModal';
import { Sparkles } from 'lucide-react';

export function FloatingAiCoachButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button constrained inside the centered iPhone chassis */}
      <div className="fixed bottom-[4.75rem] z-40 right-4 sm:right-[calc(50%-215px+16px)]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Consultor KAIROS AI · Evidencia Deportiva y Biomecánica"
          aria-label="Abrir asistente de IA KAIROS"
          className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-gothic/50 bg-[#14111E]/95 text-gothic shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all hover:scale-105 hover:border-gothic active:scale-95"
        >
          {/* Subtle gothic glow ring */}
          <span className="absolute -inset-0.5 rounded-full bg-gothic/25 opacity-70 blur-sm group-hover:opacity-100 transition-opacity" />

          <div className="relative flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-gothic drop-shadow-[0_0_8px_rgba(157,78,221,0.6)]" />
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand text-[8px] font-black text-background">
              IA
            </span>
          </div>
        </button>
      </div>

      <AiCoachModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
