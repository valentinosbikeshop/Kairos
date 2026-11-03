'use client';

import React from 'react';
import {
  TimerEngineProvider,
  FloatingWorkoutTimerHUD,
  useTimerEngine,
} from '@/components/TimerEngine';
import { KairosProvider, useKairos } from '@/lib/kairosContext';
import { AuthAndOnboardingView } from '@/components/AuthAndOnboardingView';
import { RoutineModalsHost } from '@/components/RoutineBuilderAndRationale';
import { WorkoutStudio } from '@/components/WorkoutStudio';
import { TimerProView } from '@/components/TimerProView';
import { ScienceLibraryView } from '@/components/ScienceLibraryView';
import { AnalyticsView } from '@/components/AnalyticsView';
import { HistoryView } from '@/components/HistoryView';
import { ImpactReportModal } from '@/components/ImpactReportModal';
import {
  HeartRateTelemetryProvider,
  FloatingHeartRateHUD,
  useHeartRateTelemetry,
} from '@/components/HeartRateMonitorWidget';
import { AppUpdateBanner } from '@/components/AppUpdateManager';
import { FloatingAiCoachButton } from '@/components/FloatingAiCoachButton';
import { AppTab } from '@/types/kairos';
import { Activity, BookOpen, CalendarClock, Dumbbell, Timer } from 'lucide-react';

function KairosInnerWorkspace() {
  const {
    hydrated,
    user,
    profile,
    routine,
    saveUserRoutine,
    openRoutineModal,
    setOpenRoutineModal,
    openRationaleModal,
    setOpenRationaleModal,
    activeTab,
    setActiveTab,
    latestImpactReport,
    dismissImpactReport,
  } = useKairos();

  const { snapshot } = useTimerEngine();
  const { deviceConnected, isSimulating } = useHeartRateTelemetry();

  // Reset scroll to top on tab change so header is never cut off
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [activeTab]);

  const tabs: {
    id: AppTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    dot?: boolean;
  }[] = [
    { id: 'workout', label: 'Entrenar', icon: Dumbbell },
    { id: 'timer', label: 'Timer', icon: Timer, dot: snapshot.isActive || deviceConnected || isSimulating },
    { id: 'science', label: 'Ciencia', icon: BookOpen },
    { id: 'analytics', label: 'Análisis', icon: Activity },
    { id: 'history', label: 'Historial', icon: CalendarClock },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-[#09080B] flex justify-center">
      {/* Centered iPhone Chassis */}
      <div className="relative flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-background text-brand sm:border-x sm:border-stoneborder sm:shadow-[0_0_80px_rgba(0,0,0,0.85)]">
        <AppUpdateBanner />
        {!hydrated ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 gothic-sanctuary-bg">
            <span className="text-xs text-gothic">❖</span>
            <span className="font-gothic text-lg tracking-[0.25em] text-brand/80">KAIROS</span>
          </div>
        ) : !user || !user.onboardingCompleted ? (
          <AuthAndOnboardingView />
        ) : (
          <>
            <main className="flex-1 gothic-sanctuary-bg">
              {activeTab === 'workout' && <WorkoutStudio />}
              {activeTab === 'timer' && <TimerProView />}
              {activeTab === 'science' && <ScienceLibraryView />}
              {activeTab === 'analytics' && <AnalyticsView />}
              {activeTab === 'history' && <HistoryView />}
            </main>

            <FloatingHeartRateHUD />
            {activeTab !== 'timer' && <FloatingWorkoutTimerHUD />}
            <FloatingAiCoachButton />

            <ImpactReportModal
              report={latestImpactReport}
              onClose={dismissImpactReport}
              onGoToAnalytics={() => setActiveTab('analytics')}
            />

            <RoutineModalsHost
              isRoutineOpen={openRoutineModal}
              onCloseRoutine={() => setOpenRoutineModal(false)}
              isRationaleOpen={openRationaleModal}
              onCloseRationale={() => setOpenRationaleModal(false)}
              routine={routine}
              profile={profile}
              onSaveRoutine={(r) => saveUserRoutine(r, false)}
            />

            {/* Calm Gothic Bottom Navigation */}
            <nav
              aria-label="Navegación principal"
              className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-[430px] border-t border-stoneborder bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
            >
              <div className="grid grid-cols-5 px-2 py-1.5">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex flex-col items-center justify-center gap-1 py-1.5 transition-colors active:scale-95 ${
                        isActive ? 'text-brand' : 'text-brand-subtle hover:text-brand-muted'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute -top-1.5 h-[2px] w-6 rounded-full bg-gothic" />
                      )}
                      <div className="relative">
                        <Icon
                          className={`h-[18px] w-[18px] ${
                            isActive ? 'stroke-[2] text-gothic' : 'stroke-[1.6]'
                          }`}
                        />
                        {tab.dot && (
                          <span className="absolute -right-1.5 -top-0.5 h-2 w-2 rounded-full bg-gothic" />
                        )}
                      </div>
                      <span
                        className={`text-[10px] tracking-wide ${
                          isActive ? 'font-semibold text-brand' : 'font-normal'
                        }`}
                      >
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}

export function KairosAppShell() {
  return (
    <TimerEngineProvider>
      <KairosProvider>
        <HeartRateTelemetryProvider>
          <KairosInnerWorkspace />
        </HeartRateTelemetryProvider>
      </KairosProvider>
    </TimerEngineProvider>
  );
}
