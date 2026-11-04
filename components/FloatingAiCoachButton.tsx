'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AiCoachModal } from '@/components/AiCoachModal';
import { ArrowLeftRight, Sparkles } from 'lucide-react';

export function FloatingAiCoachButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [dockSide, setDockSide] = useState<'left' | 'right'>('right');
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const touchStartXRef = useRef<number>(0);
  const touchStartTimeRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);

  // Load saved dock side preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kairos_ai_dock_side');
      if (saved === 'left' || saved === 'right') {
        setDockSide(saved);
      }
    } catch {}
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartTimeRef.current = Date.now();
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const delta = currentX - touchStartXRef.current;
    if (Math.abs(delta) > 6) {
      hasMovedRef.current = true;
    }
    setDragX(delta);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const delta = dragX;
    const duration = Date.now() - touchStartTimeRef.current;
    setDragX(0);

    // If movement was minimal and quick, treat as tap to open
    if (!hasMovedRef.current || (Math.abs(delta) < 10 && duration < 300)) {
      setIsOpen(true);
      return;
    }

    // Drag threshold to snap to other side
    if (dockSide === 'right' && delta < -45) {
      setDockSide('left');
      try {
        localStorage.setItem('kairos_ai_dock_side', 'left');
      } catch {}
    } else if (dockSide === 'left' && delta > 45) {
      setDockSide('right');
      try {
        localStorage.setItem('kairos_ai_dock_side', 'right');
      } catch {}
    }
  };

  const toggleDockSide = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSide = dockSide === 'right' ? 'left' : 'right';
    setDockSide(nextSide);
    try {
      localStorage.setItem('kairos_ai_dock_side', nextSide);
    } catch {}
  };

  return (
    <>
      {/* Floating Button draggable horizontally with spring docking */}
      <div
        className={`fixed ios-floating-ai-bottom z-[110] select-none touch-pan-y ${
          dockSide === 'right'
            ? 'right-4 sm:right-[calc(50%-215px+16px)]'
            : 'left-4 sm:left-[calc(50%-215px+16px)]'
        }`}
        style={{
          transform: isDragging ? `translateX(${dragX}px)` : 'translateX(0)',
          transition: isDragging
            ? 'none'
            : 'transform 360ms cubic-bezier(0.16, 1, 0.3, 1), left 360ms cubic-bezier(0.16, 1, 0.3, 1), right 360ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative group">
          <button
            type="button"
            onClick={() => {
              if (!hasMovedRef.current) {
                setIsOpen(true);
              }
            }}
            title="Consultor Científico KAIROS AI · Desliza a izquierda o derecha para reubicar"
            aria-label="Abrir asistente de IA KAIROS"
            className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-gothic/70 bg-[#161224]/95 text-gothic shadow-[0_6px_28px_rgba(0,0,0,0.75)] backdrop-blur-xl hover:scale-105 hover:border-gothic active:scale-95 ring-1 ring-white/10 transition-transform cursor-pointer"
          >
            {/* Subtle gothic glow ring */}
            <span className="absolute -inset-1 rounded-full bg-gothic/30 opacity-70 blur-md group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative flex items-center justify-center pointer-events-none">
              <Sparkles className="h-5 w-5 text-gothic drop-shadow-[0_0_10px_rgba(157,78,221,0.8)]" />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-black text-background shadow-md">
                IA
              </span>
            </div>
          </button>

          {/* Quick toggle side icon badge on hover/hold */}
          <button
            type="button"
            onClick={toggleDockSide}
            title={dockSide === 'right' ? 'Mover a la izquierda' : 'Mover a la derecha'}
            aria-label="Cambiar lado del botón de IA"
            className={`absolute -top-1.5 ${
              dockSide === 'right' ? '-left-2' : '-right-2'
            } opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex h-5 w-5 items-center justify-center rounded-full border border-stoneborder bg-surface text-brand-muted hover:text-brand shadow-sm`}
          >
            <ArrowLeftRight className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      <AiCoachModal isOpen={isOpen} onClose={() => setIsOpen(false)} contextHint="general" />
    </>
  );
}
