'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AiCoachModal } from '@/components/AiCoachModal';
import { useKairos } from '@/lib/kairosContext';
import { useTimerEngine } from '@/components/TimerEngine';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export function FloatingAiCoachButton() {
  const { activeTab, activeWorkout } = useKairos();
  const { snapshot: timerSnapshot } = useTimerEngine();

  const [isOpen, setIsOpen] = useState(false);
  const [dockSide, setDockSide] = useState<'left' | 'right'>('right');
  const [isTucked, setIsTucked] = useState(false);
  // Custom user-dragged vertical offset from bottom (in px); null = smart automatic positioning per screen
  const [customBottomPx, setCustomBottomPx] = useState<number | null>(null);

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const startPosRef = useRef<{ x: number; y: number; baseBottom: number }>({
    x: 0,
    y: 0,
    baseBottom: 96,
  });
  const startTimeRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);

  // Load saved preferences
  useEffect(() => {
    try {
      const savedSide = localStorage.getItem('kairos_ai_dock_side');
      if (savedSide === 'left' || savedSide === 'right') {
        setDockSide(savedSide);
      }
      const savedBottom = localStorage.getItem('kairos_ai_bottom_px');
      if (savedBottom) {
        const parsed = Number(savedBottom);
        if (Number.isFinite(parsed) && parsed >= 84 && parsed <= 520) {
          setCustomBottomPx(parsed);
        }
      }
    } catch {}
  }, []);

  // Smart context-aware position depending on activeTab, active workout blocks, and floating timer HUD
  const smartBottomPx = useMemo(() => {
    const floatingTimerVisible = timerSnapshot.isActive && activeTab !== 'timer';
    const timerHudBump = floatingTimerVisible ? 66 : 0;

    if (activeTab === 'workout') {
      // When the user has exercise blocks on screen, the "Finalizar" bar and "+ Serie" buttons sit near the bottom
      const hasBlocks = activeWorkout.blocks.length > 0;
      return (hasBlocks ? 148 : 96) + timerHudBump;
    }
    if (activeTab === 'timer') {
      // Elevate above timer transport controls & simulation bar
      return 144;
    }
    if (activeTab === 'history') {
      return 96 + timerHudBump;
    }
    return 94 + timerHudBump;
  }, [activeTab, activeWorkout.blocks.length, timerSnapshot.isActive]);

  const effectiveBottomPx = customBottomPx ?? smartBottomPx;

  const beginDrag = (clientX: number, clientY: number) => {
    startPosRef.current = {
      x: clientX,
      y: clientY,
      baseBottom: effectiveBottomPx,
    };
    startTimeRef.current = Date.now();
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const updateDrag = (clientX: number, clientY: number) => {
    const dx = clientX - startPosRef.current.x;
    const dy = clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > 7) {
      hasMovedRef.current = true;
    }
    setDragOffset({ x: dx, y: dy });
  };

  const finishDrag = (clientX?: number) => {
    setIsDragging(false);
    const { x: dx, y: dy } = dragOffset;
    const duration = Date.now() - startTimeRef.current;
    setDragOffset({ x: 0, y: 0 });

    if (!hasMovedRef.current || (Math.hypot(dx, dy) < 10 && duration < 280)) {
      if (isTucked) {
        setIsTucked(false);
      } else {
        setIsOpen(true);
      }
      return;
    }

    // Compute new vertical position (dragging up = negative dy = larger bottomPx)
    const maxBottom =
      typeof window !== 'undefined' ? Math.max(220, window.innerHeight - 130) : 480;
    const nextBottom = Math.round(
      Math.max(84, Math.min(maxBottom, startPosRef.current.baseBottom - dy))
    );
    setCustomBottomPx(nextBottom);
    try {
      localStorage.setItem('kairos_ai_bottom_px', String(nextBottom));
    } catch {}

    // Determine horizontal side by viewport midpoint or swipe delta
    let nextSide = dockSide;
    if (typeof window !== 'undefined' && typeof clientX === 'number') {
      nextSide = clientX < window.innerWidth / 2 ? 'left' : 'right';
    } else if (dockSide === 'right' && dx < -45) {
      nextSide = 'left';
    } else if (dockSide === 'left' && dx > 45) {
      nextSide = 'right';
    }

    setDockSide(nextSide);
    try {
      localStorage.setItem('kairos_ai_dock_side', nextSide);
    } catch {}

    // If user dragged all the way against the outer screen edge, tuck into compact edge pill
    if (typeof window !== 'undefined' && typeof clientX === 'number') {
      if (clientX <= 18 || clientX >= window.innerWidth - 18) {
        setIsTucked(true);
      } else {
        setIsTucked(false);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    beginDrag(t.clientX, t.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    updateDrag(t.clientX, t.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    finishDrag(t?.clientX);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    beginDrag(e.clientX, e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateDrag(moveEvent.clientX, moveEvent.clientY);
    };
    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      finishDrag(upEvent.clientX);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const toggleDockSide = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSide = dockSide === 'right' ? 'left' : 'right';
    setDockSide(nextSide);
    setCustomBottomPx(null); // Reset to smart vertical placement
    try {
      localStorage.setItem('kairos_ai_dock_side', nextSide);
      localStorage.removeItem('kairos_ai_bottom_px');
    } catch {}
  };

  const contextHint = useMemo(() => {
    if (activeTab === 'workout') return 'workout' as const;
    if (activeTab === 'timer') return 'timer' as const;
    if (activeTab === 'history') return 'history' as const;
    return 'general' as const;
  }, [activeTab]);

  return (
    <>
      {/* 2D Movable + Smart Context-Aware Floating AI Coach Button */}
      <div
        className={`fixed z-[110] select-none touch-none ${
          dockSide === 'right'
            ? isTucked
              ? 'right-0'
              : 'right-3.5 sm:right-[calc(50%-215px+14px)]'
            : isTucked
              ? 'left-0'
              : 'left-3.5 sm:left-[calc(50%-215px+14px)]'
        }`}
        style={{
          bottom: `calc(${effectiveBottomPx}px + env(safe-area-inset-bottom, 0px))`,
          transform: isDragging
            ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`
            : 'translate3d(0, 0, 0)',
          transition: isDragging
            ? 'none'
            : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), bottom 320ms cubic-bezier(0.16, 1, 0.3, 1), left 320ms cubic-bezier(0.16, 1, 0.3, 1), right 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {isTucked ? (
          <button
            type="button"
            onClick={() => setIsTucked(false)}
            title="Expandir botón KAIROS IA"
            aria-label="Expandir asistente de IA KAIROS"
            className={`flex items-center gap-1 border border-gothic/70 bg-[#161224]/95 py-2.5 px-2 text-gothic shadow-lg backdrop-blur-xl ${
              dockSide === 'right' ? 'rounded-l-2xl border-r-0' : 'rounded-r-2xl border-l-0'
            }`}
          >
            {dockSide === 'right' ? (
              <ChevronLeft className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Sparkles className="h-4 w-4 text-gothic" />
          </button>
        ) : (
          <div className="relative group">
            <button
              type="button"
              onClick={() => {
                if (!hasMovedRef.current) {
                  setIsOpen(true);
                }
              }}
              title="Consultor Científico KAIROS AI · Arrastra libremente a cualquier altura o esquina"
              aria-label="Abrir asistente de IA KAIROS"
              className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-gothic/70 bg-[#161224]/95 text-gothic shadow-[0_6px_24px_rgba(0,0,0,0.75)] backdrop-blur-xl hover:scale-105 hover:border-gothic active:scale-95 ring-1 ring-white/10 transition-transform cursor-grab active:cursor-grabbing"
            >
              {/* Subtle gothic glow ring */}
              <span className="absolute -inset-1 rounded-full bg-gothic/25 opacity-60 blur-md group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="relative flex items-center justify-center pointer-events-none">
                <Sparkles className="h-4 w-4 text-gothic drop-shadow-[0_0_10px_rgba(157,78,221,0.8)]" />
                <span className="absolute -bottom-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand text-[8px] font-black text-background shadow-md">
                  IA
                </span>
              </div>
            </button>

            {/* Quick toggle side / auto-dock badge on hover */}
            <button
              type="button"
              onClick={toggleDockSide}
              title="Cambiar de lado / Posición inteligente automática"
              aria-label="Cambiar lado del botón de IA"
              className={`absolute -top-1.5 ${
                dockSide === 'right' ? '-left-2' : '-right-2'
              } opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex h-5 w-5 items-center justify-center rounded-full border border-stoneborder bg-surface text-brand-muted hover:text-brand shadow-sm`}
            >
              <ArrowLeftRight className="h-2.5 w-2.5" />
            </button>

            {/* Quick tuck-to-edge button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsTucked(true);
              }}
              title="Ocultar en el borde"
              aria-label="Ocultar botón IA en el borde"
              className={`absolute -bottom-1.5 ${
                dockSide === 'right' ? '-left-2' : '-right-2'
              } opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex h-4 w-4 items-center justify-center rounded-full border border-stoneborder bg-surface text-[9px] text-brand-muted hover:text-brand shadow-sm`}
            >
              {dockSide === 'right' ? '›' : '‹'}
            </button>
          </div>
        )}
      </div>

      <AiCoachModal isOpen={isOpen} onClose={() => setIsOpen(false)} contextHint={contextHint} />
    </>
  );
}
