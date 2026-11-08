'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { useKairos } from '@/lib/kairosContext';
import { useTimerEngine } from '@/components/TimerEngine';
import { getProfileAge } from '@/lib/formatters';
import {
  calculateCardioZones,
  getZoneForHeartRate,
  calculateKeytelCaloriesPerMinute,
  parseBluetoothHeartRatePacket,
  CardioZone,
  CardioZoneNumber,
  CardioZonesProfile,
} from '@/lib/cardioTelemetry';
import {
  Flame,
  Heart,
  Bluetooth,
  Sliders,
  X,
  AlertTriangle,
  RefreshCw,
  Watch,
  Sparkles,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';

interface HeartRateMonitorWidgetProps {
  compact?: boolean;
  onBpmChange?: (bpm: number, zone: CardioZone) => void;
  onCaloriesUpdate?: (calories: number) => void;
}

type BrandTab = 'xiaomi' | 'huawei' | 'apple' | 'garmin' | 'samsung' | 'browser';

interface HeartRateTelemetryContextValue {
  deviceConnected: boolean;
  deviceName: string | null;
  detectedBrand: string | null;
  isConnecting: boolean;
  bleError: string | null;
  setBleError: (err: string | null) => void;
  scanMode: 'standard' | 'extended';
  setScanMode: (mode: 'standard' | 'extended') => void;
  bpm: number;
  isSimulating: boolean;
  setIsSimulating: React.Dispatch<React.SetStateAction<boolean>>;
  simulationBpm: number;
  setSimulationBpm: (val: number) => void;
  accumulatedCalories: number;
  activeSeconds: number;
  zonesProfile: CardioZonesProfile;
  activeZone: CardioZone;
  instantKcalPerMin: number;
  pulseDurationSec: number;
  connectBluetoothHeartRate: (target?: 'standard' | 'huawei' | 'extended' | boolean) => Promise<void>;
  disconnectBluetooth: () => void;
  resetCalories: () => void;
  showIosModal: boolean;
  setShowIosModal: (show: boolean) => void;
  showNotFoundHelp: boolean;
  setShowNotFoundHelp: (show: boolean) => void;
}

const HeartRateTelemetryContext = createContext<HeartRateTelemetryContextValue | null>(null);

export function HeartRateTelemetryProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useKairos();

  const age = useMemo(() => (profile ? (getProfileAge(profile) ?? 25) : 25), [profile]);
  const weightKg = useMemo(() => profile?.weightKg ?? 75, [profile]);
  const sex = useMemo(() => profile?.sex ?? 'male', [profile]);

  const zonesProfile: CardioZonesProfile = useMemo(() => {
    return calculateCardioZones(profile ? profile : age, 60);
  }, [profile, age]);

  const [deviceConnected, setDeviceConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'standard' | 'extended'>('standard');
  const [showIosModal, setShowIosModal] = useState(false);
  const [showNotFoundHelp, setShowNotFoundHelp] = useState(false);

  const [bpm, setBpm] = useState<number>(128);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationBpm, setSimulationBpm] = useState<number>(135);

  const [accumulatedCalories, setAccumulatedCalories] = useState<number>(0);
  const [activeSeconds, setActiveSeconds] = useState<number>(0);

  const bluetoothDeviceRef = useRef<any>(null);
  const gattServerRef = useRef<any>(null);

  const detectedBrand = useMemo(() => {
    if (!deviceName) return null;
    const lower = deviceName.toLowerCase();
    if (
      lower.includes('huawei') ||
      lower.includes('honor') ||
      lower.includes('band 11') ||
      lower.includes('band 10') ||
      lower.includes('band 9') ||
      lower.includes('band 8') ||
      lower.includes('watch gt') ||
      lower.includes('fit')
    ) {
      if (lower.includes('11')) return 'Huawei Band 11';
      if (lower.includes('10')) return 'Huawei Band 10';
      if (lower.includes('9')) return 'Huawei Band 9';
      if (lower.includes('8')) return 'Huawei Band 8';
      return 'Huawei Smart Band';
    }
    if (
      lower.includes('xiaomi') ||
      lower.includes('mi ') ||
      lower.includes('redmi') ||
      lower.includes('smart band')
    ) {
      return 'Xiaomi / Redmi';
    }
    if (lower.includes('apple') || lower.includes('heartcast') || lower.includes('echo')) {
      return 'Apple Watch';
    }
    if (lower.includes('garmin')) return 'Garmin';
    if (lower.includes('polar')) return 'Polar';
    if (lower.includes('galaxy') || lower.includes('samsung')) return 'Samsung Galaxy';
    return 'Pulsómetro BLE';
  }, [deviceName]);

  const activeZone = useMemo(() => {
    return getZoneForHeartRate(bpm, zonesProfile);
  }, [bpm, zonesProfile]);

  const instantKcalPerMin = useMemo(() => {
    return calculateKeytelCaloriesPerMinute({
      heartRate: bpm,
      weightKg,
      age,
      sex,
    });
  }, [bpm, weightKg, age, sex]);

  useEffect(() => {
    if (!deviceConnected && !isSimulating) return;

    const interval = setInterval(() => {
      setActiveSeconds((prev) => prev + 1);
      setAccumulatedCalories((prev) => {
        const addedPerSecond = instantKcalPerMin / 60;
        return Math.round((prev + addedPerSecond) * 10) / 10;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [deviceConnected, isSimulating, instantKcalPerMin]);

  useEffect(() => {
    if (isSimulating) {
      setBpm(simulationBpm);
    }
  }, [isSimulating, simulationBpm]);

  const onDisconnected = useCallback(() => {
    setDeviceConnected(false);
    setDeviceName(null);
  }, []);

  const handleHeartRateCharacteristicValueChanged = useCallback((event: any) => {
    const value: DataView = event.target.value;
    const packet = parseBluetoothHeartRatePacket(value);
    if (packet.bpm > 0) {
      setBpm(packet.bpm);
    }
  }, []);

  const connectBluetoothHeartRate = useCallback(
    async (target: 'standard' | 'huawei' | 'extended' | boolean = 'standard') => {
      setBleError(null);
      setShowNotFoundHelp(false);

      if (typeof window === 'undefined' || !(navigator as any).bluetooth) {
        setShowIosModal(true);
        setBleError(
          'Web Bluetooth no está habilitado en Safari de iPhone directamente. Usa la app gratuita Bluefy o activa el Modo Simulación.'
        );
        return;
      }

      try {
        setIsConnecting(true);

        const isHuawei = target === 'huawei';
        const isExtended = target === true || target === 'extended' || scanMode === 'extended';

        const standardFilters = [
          { services: ['heart_rate'] },
          { namePrefix: 'Huawei' },
          { namePrefix: 'HUAWEI' },
          { namePrefix: 'huawei' },
          { namePrefix: 'Band' },
          { namePrefix: 'band' },
          { namePrefix: 'HONOR' },
          { namePrefix: 'Honor' },
          { namePrefix: 'Watch' },
          { namePrefix: 'watch' },
          { namePrefix: 'FIT' },
          { namePrefix: 'Fit' },
          { namePrefix: 'Mi ' },
          { namePrefix: 'Xiaomi' },
          { namePrefix: 'Redmi' },
          { namePrefix: 'Polar' },
          { namePrefix: 'Garmin' },
          { namePrefix: 'Heart' },
          { namePrefix: 'Echo' },
        ];

        const commonOptionalServices = [
          'heart_rate',
          'battery_service',
          'device_information',
          0x180d,
          '0000180d-0000-1000-8000-00805f9b34fb',
          0x3802,
          '00003802-0000-1000-8000-00805f9b34fb',
          0xfe95,
          '0000fe95-0000-1000-8000-00805f9b34fb',
        ];

        // Para Huawei Band 11 usamos acceptAllDevices: true para que aparezca 100% en la lista de dispositivos cercanos
        const scanConfig: any =
          isHuawei || isExtended
            ? {
                acceptAllDevices: true,
                optionalServices: commonOptionalServices,
              }
            : {
                filters: standardFilters,
                optionalServices: commonOptionalServices,
              };

        const device = await (navigator as any).bluetooth.requestDevice(scanConfig);

        bluetoothDeviceRef.current = device;
        setDeviceName(device.name || 'Huawei Band 11');

        device.addEventListener('gattserverdisconnected', onDisconnected);

        const server = await device.gatt.connect();
        gattServerRef.current = server;

        let service: any;
        try {
          service = await server.getPrimaryService('heart_rate');
        } catch {
          try {
            service = await server.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
          } catch {
            try {
              service = await server.getPrimaryService(0x180d);
            } catch {
              try {
                const allServices = await server.getPrimaryServices();
                service = allServices.find((s: any) => {
                  const u = (s.uuid || '').toLowerCase();
                  return u.includes('180d') || u.includes('heart');
                });
              } catch {
                // fall through
              }
            }
          }
        }

        if (!service) {
          throw new Error(
            'Tu Huawei Band 11 se conectó por Bluetooth, pero no está emitiendo pulso cardíaco. En tu pulsera entra a Ajustes > Frecuencia Cardíaca > "Transmitir FC" (o inicia una sesión de ejercicio y desliza para transmitir).'
          );
        }

        let characteristic: any;
        try {
          characteristic = await service.getCharacteristic('heart_rate_measurement');
        } catch {
          try {
            characteristic = await service.getCharacteristic('00002a37-0000-1000-8000-00805f9b34fb');
          } catch {
            characteristic = await service.getCharacteristic(0x2a37);
          }
        }

        await characteristic.startNotifications();
        characteristic.addEventListener(
          'characteristicvaluechanged',
          handleHeartRateCharacteristicValueChanged
        );

        setDeviceConnected(true);
        setIsSimulating(false);
        setIsConnecting(false);
        setShowNotFoundHelp(false);
        setShowIosModal(false);
      } catch (err: any) {
        setIsConnecting(false);
        if (err.name === 'NotFoundError') {
          // El usuario canceló o el dispositivo no se visualizó en el diálogo del navegador
          setShowNotFoundHelp(true);
          return;
        }
        setBleError(
          `${err?.message || 'Error al conectar el pulsómetro'}. Tip: Verifica haber activado "Compartir FC" o "Transmitir FC" en tu reloj/app.`
        );
      }
    },
    [handleHeartRateCharacteristicValueChanged, onDisconnected, scanMode]
  );

  const disconnectBluetooth = useCallback(() => {
    try {
      if (gattServerRef.current && gattServerRef.current.connected) {
        gattServerRef.current.disconnect();
      }
    } catch {}
    setDeviceConnected(false);
    setDeviceName(null);
  }, []);

  const resetCalories = useCallback(() => {
    setAccumulatedCalories(0);
    setActiveSeconds(0);
  }, []);

  const pulseDurationSec = useMemo(() => {
    return Math.max(0.3, Math.min(2.0, 60 / Math.max(40, bpm)));
  }, [bpm]);

  const value = useMemo<HeartRateTelemetryContextValue>(
    () => ({
      deviceConnected,
      deviceName,
      detectedBrand,
      isConnecting,
      bleError,
      setBleError,
      scanMode,
      setScanMode,
      bpm,
      isSimulating,
      setIsSimulating,
      simulationBpm,
      setSimulationBpm,
      accumulatedCalories,
      activeSeconds,
      zonesProfile,
      activeZone,
      instantKcalPerMin,
      pulseDurationSec,
      connectBluetoothHeartRate,
      disconnectBluetooth,
      resetCalories,
      showIosModal,
      setShowIosModal,
      showNotFoundHelp,
      setShowNotFoundHelp,
    }),
    [
      deviceConnected,
      deviceName,
      detectedBrand,
      isConnecting,
      bleError,
      scanMode,
      bpm,
      isSimulating,
      simulationBpm,
      accumulatedCalories,
      activeSeconds,
      zonesProfile,
      activeZone,
      instantKcalPerMin,
      pulseDurationSec,
      connectBluetoothHeartRate,
      disconnectBluetooth,
      resetCalories,
      showIosModal,
      showNotFoundHelp,
    ]
  );

  return (
    <HeartRateTelemetryContext.Provider value={value}>
      {children}
    </HeartRateTelemetryContext.Provider>
  );
}

export function useHeartRateTelemetry() {
  const ctx = useContext(HeartRateTelemetryContext);
  if (!ctx) {
    throw new Error('useHeartRateTelemetry debe usarse dentro de HeartRateTelemetryProvider');
  }
  return ctx;
}

/**
 * Barra flotante permanente (idéntica al HUD del temporizador) que permanece visible en
 * toda la app cuando el reloj del usuario está conectado exitosamente (o en simulación).
 * Muestra: Pulsaciones en vivo (BPM), Fase actual (1..5) y Calorías quemadas acumuladas.
 */
export function FloatingHeartRateHUD() {
  const {
    deviceConnected,
    isSimulating,
    deviceName,
    detectedBrand,
    bpm,
    activeZone,
    accumulatedCalories,
    instantKcalPerMin,
    pulseDurationSec,
  } = useHeartRateTelemetry();
  const { activeTab, setActiveTab } = useKairos();
  const { snapshot, isDrawerExpanded } = useTimerEngine();

  // Solo aparece permanentemente cuando el reloj está conectado (o simulando activamente)
  if (!deviceConnected && !isSimulating) {
    return null;
  }

  // Si en una pestaña distinta a Timer hay además un temporizador corriendo o su toast activo,
  // apilamos la barra de pulsaciones justo encima del temporizador para que nunca se tapen.
  const timerHudVisible =
    activeTab !== 'timer' &&
    (snapshot.isActive || isDrawerExpanded || Boolean(snapshot.lastAutoSavedNotice));

  const bottomClass = timerHudVisible
    ? 'bottom-[calc(8.3rem+env(safe-area-inset-bottom))]'
    : 'bottom-[calc(4.4rem+env(safe-area-inset-bottom))]';

  return (
    <div
      className={`fixed inset-x-0 ${bottomClass} z-40 mx-auto max-w-[430px] px-3 pointer-events-none transition-all duration-200`}
    >
      <div className="pointer-events-auto rounded-2xl border border-stoneborder bg-surface/95 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div
          className="h-[2px] w-full transition-colors duration-300"
          style={{ backgroundColor: activeZone.accentHex }}
        />

        <div className="flex items-center justify-between gap-2 px-3.5 py-2">
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
            title="Ver panel completo de telemetría en Temporizador"
          >
            <Heart
              className="h-4 w-4 shrink-0 fill-rose-500/25 text-rose-500"
              style={{
                animation: `pulse ${pulseDurationSec}s ease-in-out infinite`,
              }}
            />
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="font-mono text-base font-bold tabular-nums text-brand">
                {bpm}
              </span>
              <span className="text-[10px] font-mono text-brand-muted">BPM</span>
            </div>

            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${activeZone.badgeBg}`}
            >
              {activeZone.shortName}
            </span>

            <span className="truncate text-[11px] text-brand-muted">
              {activeZone.name.split('·')[1]?.trim() ||
                detectedBrand ||
                deviceName ||
                'En vivo'}
            </span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-stoneborder/70">
            <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-500/20" />
            <div className="text-right">
              <div className="font-mono text-sm font-bold tabular-nums text-brand leading-none">
                {accumulatedCalories.toFixed(0)}{' '}
                <span className="text-[10px] font-normal text-brand-muted">kcal</span>
              </div>
              <div className="font-mono text-[9px] tabular-nums text-amber-400/90 leading-tight">
                {instantKcalPerMin.toFixed(1)}/min
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeartRateMonitorWidget({
  onBpmChange,
  onCaloriesUpdate,
}: HeartRateMonitorWidgetProps) {
  const {
    deviceConnected,
    deviceName,
    detectedBrand,
    isConnecting,
    bleError,
    setBleError,
    bpm,
    isSimulating,
    setIsSimulating,
    simulationBpm,
    setSimulationBpm,
    accumulatedCalories,
    zonesProfile,
    activeZone,
    instantKcalPerMin,
    pulseDurationSec,
    connectBluetoothHeartRate,
    disconnectBluetooth,
    showIosModal,
    setShowIosModal,
    showNotFoundHelp,
    setShowNotFoundHelp,
  } = useHeartRateTelemetry();

  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [activeGuideTab, setActiveGuideTab] = useState<BrandTab>('huawei');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const handleCopyKairosUrl = () => {
    try {
      if (typeof window !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2500);
      }
    } catch {}
  };

  useEffect(() => {
    if (onBpmChange) {
      onBpmChange(bpm, activeZone);
    }
  }, [bpm, activeZone, onBpmChange]);

  useEffect(() => {
    if (onCaloriesUpdate) {
      onCaloriesUpdate(accumulatedCalories);
    }
  }, [accumulatedCalories, onCaloriesUpdate]);

  return (
    <div className="rounded-3xl border border-stoneborder bg-surface p-4 sm:p-5 space-y-4">
      {/* Header bar: Title, Status badge, and Guide Trigger */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-stoneborder bg-background text-rose-500 shadow-sm">
            <Heart
              className="h-4 w-4 fill-rose-500/20 text-rose-500"
              style={{
                animation: `pulse ${pulseDurationSec}s ease-in-out infinite`,
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-gothic text-xs font-semibold uppercase tracking-wider text-brand">
                Telemetría Cardíaca Live
              </h2>
              {detectedBrand && (
                <span className="rounded bg-gothic/20 px-1 py-0.2 text-[9px] font-semibold text-gothic uppercase">
                  {detectedBrand}
                </span>
              )}
            </div>
            <p className="text-[10px] text-brand-muted">
              Tanaka ({zonesProfile.maxHeartRate} bpm máx) · Ecuación Keytel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1 rounded-lg border border-stoneborder bg-background px-2 py-1 text-[11px] text-brand-muted hover:text-brand transition-colors"
            title="¿Cómo conectar mi Xiaomi, Huawei o Apple Watch?"
          >
            <HelpCircle className="h-3.5 w-3.5 text-gothic" />
            <span className="hidden sm:inline">¿Cómo conectar?</span>
          </button>

          {deviceConnected ? (
            <button
              type="button"
              onClick={disconnectBluetooth}
              className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>{deviceName ?? 'Conectado'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => connectBluetoothHeartRate('huawei')}
                disabled={isConnecting}
                className="flex items-center gap-1.5 rounded-xl border border-sky-500/50 bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 active:scale-95 transition-all shadow-sm"
                title="Vincular Huawei Band 11 con 1 toque directo"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-400" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth className="h-3.5 w-3.5 text-sky-400" />
                    <span>Huawei Band 11</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => connectBluetoothHeartRate('standard')}
                disabled={isConnecting}
                className="flex items-center gap-1 rounded-xl border border-stoneborder bg-background px-2.5 py-1.5 text-xs font-medium text-brand hover:border-gothic/50 active:scale-95 transition-all shadow-sm"
              >
                <span>Otro</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. Alerta interactiva para iOS Safari (iPhone) */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-up">
          <div className="w-full max-w-md rounded-3xl border border-stoneborder bg-[#121115] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stoneborder/70 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Bluetooth className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-gothic text-sm font-semibold tracking-wide text-brand">
                    Bluetooth en iPhone (iOS)
                  </h3>
                  <p className="text-[10px] text-brand-muted">
                    Restricción del sistema operativo Safari de Apple
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="rounded-lg p-1 text-brand-muted hover:text-brand"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <p className="text-brand-muted">
                Apple no permite conexiones Web Bluetooth directas dentro de <strong className="text-brand">Safari regular</strong>. Para vincular tu Huawei Band 11 en iPhone tienes 2 opciones rápidas:
              </p>

              {/* Opción 1: Bluefy */}
              <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-sky-300 font-semibold text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-200 text-[11px] font-bold">1</span>
                  <span>Usa la app gratuita Bluefy (Recomendado)</span>
                </div>
                <p className="text-[11px] text-brand-muted leading-relaxed">
                  Descarga <strong>Bluefy - Web BLE Browser</strong> en tu iPhone desde App Store. Abre KAIROS desde Bluefy y podrás conectar tu Huawei Band 11 directamente.
                </p>
                <button
                  type="button"
                  onClick={handleCopyKairosUrl}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-500/50 bg-sky-500/20 py-2.5 px-3 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 active:scale-95 transition-all shadow-sm"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span className="text-emerald-300">¡Enlace Copiado! Pégalo en Bluefy</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-sky-400" />
                      <span>Copiar Enlace de KAIROS para Bluefy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Opción 2: Modo Simulación con 1 toque */}
              <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-brand font-semibold text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">2</span>
                  <span>O activa Modo Simulación de Pulsaciones</span>
                </div>
                <p className="text-[11px] text-brand-muted leading-relaxed">
                  Prueba de inmediato todas las zonas cardíacas, pulsaciones y cálculo metabólico de calorías sin hardware físico.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsSimulating(true);
                    setShowIosModal(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gothic/20 border border-gothic/40 py-2 text-xs font-semibold text-brand hover:bg-gothic/30 active:scale-95 transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5 text-gothic" />
                  <span>Activar Modo Simulación con 1 Toque</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-stoneborder/70 flex justify-end">
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="rounded-xl border border-stoneborder bg-background px-4 py-2 text-xs font-semibold text-brand hover:border-gothic/60"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Dispositivo no encontrado o diálogo cancelado */}
      {showNotFoundHelp && (
        <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-3.5 space-y-2.5 animate-fade-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-300 font-semibold text-xs">
              <Sparkles className="h-4 w-4 shrink-0 text-sky-400" />
              <span>¿No viste tu Huawei Band 11 en la lista?</span>
            </div>
            <button
              type="button"
              onClick={() => setShowNotFoundHelp(false)}
              className="rounded-lg p-1 text-brand-muted hover:text-brand"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-brand-muted leading-relaxed">
            Sigue estos 2 pasos rápidos en tu pulsera para que aparezca al instante:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl border border-stoneborder/60 bg-background/80 p-2.5 space-y-1">
              <p className="font-semibold text-brand">1. En tu Huawei Band 11:</p>
              <p className="text-brand-muted">
                Entra en <strong>Ajustes ⚙️</strong> → <strong>Frecuencia Cardíaca</strong> → activa <strong>&quot;Transmitir FC&quot;</strong> (o inicia un entrenamiento y desliza a la derecha).
              </p>
            </div>
            <div className="rounded-xl border border-stoneborder/60 bg-background/80 p-2.5 space-y-1">
              <p className="font-semibold text-brand">2. Cierra app de Salud:</p>
              <p className="text-brand-muted">
                Cierra la app <strong>Salud de Huawei</strong> de las apps recientes del celular para que libere la señal Bluetooth.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowNotFoundHelp(false);
                void connectBluetoothHeartRate(true);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-sky-500/25 border border-sky-500/50 py-2 px-3 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/35 active:scale-95 transition-all shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
              <span>Reintentar Búsqueda (Todos los dispositivos)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNotFoundHelp(false);
                setActiveGuideTab('huawei');
                setShowGuideModal(true);
              }}
              className="rounded-xl border border-stoneborder bg-background py-2 px-3 text-[11px] text-brand-muted hover:text-brand hover:border-gothic/50 transition-colors"
            >
              Ver Guía Paso a Paso
            </button>
          </div>
        </div>
      )}

      {/* 3. BLE Error Banner Prominente (Arriba del pliegue) */}
      {bleError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2 text-xs animate-fade-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Aviso de conexión Bluetooth</span>
            </div>
            <button
              type="button"
              onClick={() => setBleError(null)}
              className="rounded-lg p-1 text-brand-muted hover:text-brand"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-brand-muted leading-relaxed">{bleError}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => connectBluetoothHeartRate(true)}
              className="rounded-xl bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-[11px] font-semibold text-brand hover:bg-amber-500/30 active:scale-95 transition-all"
            >
              Buscar Todos los Dispositivos Cercanos
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveGuideTab('huawei');
                setShowGuideModal(true);
              }}
              className="rounded-xl border border-stoneborder bg-background px-3 py-1.5 text-[11px] text-brand-muted hover:text-brand"
            >
              Ver Guía Huawei Band 11
            </button>
          </div>
        </div>
      )}

      {/* Main Telemetry Display: BPM & Calories */}
      <div className="grid grid-cols-2 gap-3">
        {/* Heart Rate & Active Zone */}
        <div className="rounded-2xl border border-stoneborder bg-background p-3.5 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-brand-muted">
              Pulsaciones
            </span>
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${activeZone.badgeBg}`}>
              {activeZone.shortName}
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="font-mono text-3xl sm:text-4xl font-bold tabular-nums text-brand tracking-tight">
              {bpm}
            </span>
            <span className="text-xs font-mono font-medium text-brand-muted">BPM</span>
          </div>

          <div className="pt-1 text-[10px] text-brand-muted truncate">
            {activeZone.name.split('·')[1]?.trim() || activeZone.name}
          </div>
        </div>

        {/* Real-time Calories Burned */}
        <div className="rounded-2xl border border-stoneborder bg-background p-3.5 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-brand-muted">
              Gasto Calórico
            </span>
            <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
          </div>

          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="font-mono text-3xl sm:text-4xl font-bold tabular-nums text-brand tracking-tight">
              {accumulatedCalories.toFixed(0)}
            </span>
            <span className="text-xs font-mono font-medium text-brand-muted">Kcal</span>
          </div>

          <div className="pt-1 text-[10px] text-amber-400 font-mono tabular-nums">
            {instantKcalPerMin.toFixed(1)} kcal/min
          </div>
        </div>
      </div>

      {/* 5-Phase Cardiovascular Spectrum Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-medium text-brand-muted">
          <span>Espectro Fisiológico</span>
          <span className="font-mono text-brand">{activeZone.rangePct} HRmax</span>
        </div>

        <div className="grid grid-cols-5 gap-1 h-2 rounded-full overflow-hidden bg-background p-0.5 border border-stoneborder/60">
          {([1, 2, 3, 4, 5] as CardioZoneNumber[]).map((zoneNum) => {
            const zInfo = zonesProfile.zones[zoneNum];
            const isCurrent = activeZone.zone === zoneNum;
            return (
              <div
                key={zoneNum}
                className={`h-full rounded-sm transition-all duration-300 ${
                  isCurrent
                    ? 'shadow-sm opacity-100 scale-y-125'
                    : 'opacity-30'
                }`}
                style={{
                  backgroundColor: zInfo.accentHex,
                }}
                title={`${zInfo.name} (${zInfo.minBpm}-${zInfo.maxBpm} bpm)`}
              />
            );
          })}
        </div>

        <div className="flex justify-between text-[9px] font-mono text-brand-muted px-0.5">
          <span>Z1 ({zonesProfile.zones[1].minBpm} bpm)</span>
          <span>Z2</span>
          <span>Z3</span>
          <span>Z4</span>
          <span>Z5 ({zonesProfile.zones[5].maxBpm} bpm)</span>
        </div>
      </div>

      {/* Target physiological explanation pill */}
      <div className={`rounded-xl border p-2.5 text-[11px] leading-relaxed ${activeZone.badgeBg}`}>
        <div className="flex items-start gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-current opacity-80" />
          <div className="space-y-0.5">
            <p className="font-medium text-brand">{activeZone.metabolicTarget}</p>
            <p className="text-[10px] opacity-80">{activeZone.perceivedEffort}</p>
          </div>
        </div>
      </div>


      {/* Simulation / Manual Testing Slider Controls */}
      <div className="pt-1 border-t border-stoneborder/50">
        <button
          type="button"
          onClick={() => {
            setIsSimulating((prev) => !prev);
          }}
          className="w-full flex items-center justify-between text-[11px] text-brand-muted hover:text-brand transition-colors py-1"
        >
          <span className="flex items-center gap-1.5">
            <Sliders className="h-3 w-3 text-gothic" />
            <span>Modo Simulación / Probar Fases Manualmente</span>
          </span>
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
              isSimulating
                ? 'border-gothic/50 bg-gothic/15 text-gothic font-semibold'
                : 'border-stoneborder text-brand-muted'
            }`}
          >
            {isSimulating ? 'Activo' : 'Inactivo'}
          </span>
        </button>

        {isSimulating && (
          <div className="mt-2 rounded-xl border border-stoneborder bg-background p-3 space-y-2 animate-fade-up">
            <div className="flex items-center justify-between text-xs">
              <span className="text-brand-muted">Ajustar pulso de prueba:</span>
              <span className="font-mono font-bold text-brand">{simulationBpm} BPM</span>
            </div>
            <input
              type="range"
              min={50}
              max={zonesProfile.maxHeartRate + 10}
              value={simulationBpm}
              onChange={(e) => setSimulationBpm(parseInt(e.target.value, 10))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-brand-muted font-mono">
              <span>50 BPM (Reposo)</span>
              <span>{Math.round(zonesProfile.maxHeartRate * 0.65)} BPM (Fase 2)</span>
              <span>{zonesProfile.maxHeartRate} BPM (Máx)</span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Step-by-Step Device Pairing Wizard Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-up">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-stoneborder bg-surface p-5 space-y-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stoneborder/70 pb-3">
              <div className="flex items-center gap-2">
                <Watch className="h-4 w-4 text-gothic" />
                <h3 className="font-gothic text-sm font-semibold tracking-wide text-brand">
                  Guía Paso a Paso: Vincular tu Reloj
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg p-1 text-brand-muted hover:text-brand"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Brand Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1 rounded-2xl border border-stoneborder bg-background p-1 text-[11px]">
              {(
                [
                  { id: 'xiaomi', label: 'Xiaomi / Redmi' },
                  { id: 'huawei', label: 'Huawei Band 11' },
                  { id: 'apple', label: 'Apple Watch' },
                  { id: 'garmin', label: 'Garmin / Polar' },
                  { id: 'samsung', label: 'Galaxy Watch' },
                  { id: 'browser', label: 'Navegadores' },
                ] as { id: BrandTab; label: string }[]
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveGuideTab(id)}
                  className={`rounded-xl py-2 px-1 text-center font-medium transition-colors ${
                    activeGuideTab === id
                      ? 'bg-elevated text-brand border border-stoneborder shadow-sm font-semibold'
                      : 'text-brand-muted hover:text-brand'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Brand Instructions Content */}
            <div className="space-y-3 text-xs leading-relaxed">
              {/* XIAOMI & REDMI */}
              {activeGuideTab === 'xiaomi' && (
                <div className="space-y-3 animate-fade-up">
                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">1</span>
                      Abre la aplicación Mi Fitness o Zepp Life
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      En tu teléfono, abre la app oficial donde tienes emparejada tu pulsera Xiaomi Smart Band (6, 7, 8 o 9) o reloj Redmi Watch.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">2</span>
                      Activa "Compartir frecuencia cardíaca"
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Ve a la pestaña <strong>Dispositivo</strong> (icono de pulsera abajo) → busca la opción <strong>"Compartir frecuencia cardíaca con otros dispositivos"</strong> (o <em>"Transmitir FC"</em>) y ponla en <strong>Activado</strong>.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">3</span>
                      Conecta en KAIROS
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Regresa a KAIROS, pulsa el botón <strong>"Vincular Reloj"</strong> y selecciona tu pulsera Xiaomi en la lista emergente. Tus pulsaciones aparecerán en tiempo real.
                    </p>
                  </div>
                </div>
              )}

              {/* HUAWEI BAND 11 & HUAWEI SMART BANDS */}
              {activeGuideTab === 'huawei' && (
                <div className="space-y-3 animate-fade-up">
                  {/* Badge de Compatibilidad Total */}
                  <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-sky-300 font-semibold text-xs">
                      <Sparkles className="h-4 w-4 shrink-0 text-sky-400" />
                      <span>100% Compatible con Huawei Band 11, Band 10, Band 9, Band 8 y Watch FIT</span>
                    </div>
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                      Tu Huawei Band 11 transmite pulsaciones en vivo por Bluetooth Low Energy estándar (GATT Heart Rate). Para conectarla solo necesitas estos 2 pasos rápidos:
                    </p>
                  </div>

                  {/* Paso 1 */}
                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-bold">1</span>
                      En tu Huawei Band 11 (Pantalla del reloj)
                    </span>
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                      Desliza en la pantalla y entra en <strong>Ajustes ⚙️</strong> → <strong>Frecuencia Cardíaca</strong> → Activa <strong>&quot;Transmitir frecuencia cardíaca&quot;</strong> (Broadcast HR).
                    </p>
                    <div className="rounded-xl border border-stoneborder/70 bg-surface/50 p-2.5 text-[10px] text-brand-muted leading-snug">
                      💡 <em>Atajo instantáneo al entrenar:</em> Al iniciar cualquier sesión de ejercicio en la pulsera (Fuerza o Carrera), desliza la pantalla hacia la derecha y toca <strong>&quot;Emitir FC&quot;</strong>. La pulsera mostrará un corazón parpadeando.
                    </div>
                  </div>

                  {/* Paso 2 */}
                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2.5">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-bold">2</span>
                      Toca &quot;Vincular Huawei Band 11&quot; en KAIROS
                    </span>
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                      Toca el botón azul aquí abajo. Tu navegador abrirá la lista de dispositivos Bluetooth: selecciona tu <strong>HUAWEI Band 11</strong> y ¡listo! Tus pulsaciones y gasto calórico aparecerán en vivo en pantalla.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGuideModal(false);
                        void connectBluetoothHeartRate('huawei');
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-500/20 border border-sky-500/50 py-2.5 px-3 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 active:scale-95 transition-all shadow-sm"
                    >
                      <Bluetooth className="h-4 w-4 text-sky-400" />
                      <span>Vincular Huawei Band 11 Ahora</span>
                    </button>
                  </div>

                  {/* Solución a interferencia con app Salud de Huawei */}
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
                    <span className="font-semibold text-amber-300 text-xs flex items-center gap-1.5">
                      <span>⚡</span> Tip de 5 segundos si tu pulsera no aparece de inmediato
                    </span>
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                      Si la aplicación <strong>Salud de Huawei</strong> está corriendo en tu teléfono, puede bloquear temporalmente el Bluetooth para uso exclusivo. <strong>Cierra la app Salud de Huawei de la multitarea</strong> o desactiva y vuelve a activar el Bluetooth de tu teléfono durante 3 segundos.
                    </p>
                  </div>
                </div>
              )}

              {/* APPLE WATCH */}
              {activeGuideTab === 'apple' && (
                <div className="space-y-3 animate-fade-up">
                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">1</span>
                      ¿Por qué el Apple Watch necesita este paso?
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Apple bloquea el acceso de páginas web a Apple Health por privacidad. Para transmitir tus pulsaciones segundo a segundo a cualquier navegador, se utiliza un puente BLE estándar.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">2</span>
                      Instala la app gratuita HeartCast o Echo
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      En tu iPhone / Apple Watch, instala <strong>HeartCast</strong> (o <strong>Echo Heart Rate</strong>) desde la App Store. Abre la app en el Apple Watch y dale a <strong>"Start"</strong>. El reloj empezará a emitir tu pulso por Bluetooth.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">3</span>
                      Toca "Vincular Reloj" en KAIROS
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      KAIROS detectará la señal Bluetooth de tu Apple Watch de inmediato.
                    </p>
                  </div>
                </div>
              )}

              {/* GARMIN & POLAR */}
              {activeGuideTab === 'garmin' && (
                <div className="space-y-3 animate-fade-up">
                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">1</span>
                      En Relojes Garmin (Forerunner / Fenix / Venu)
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Mantén presionado el botón de menú central → ve a <strong>Ajustes</strong> → <strong>Sensores y Accesorios</strong> → <strong>Frecuencia Cardíaca en Muñeca</strong> → Selecciona <strong>"Transmitir FC" (Broadcast HR)</strong>.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">2</span>
                      Bandas Pectorales (Polar H10, HRM-Pro, Wahoo)
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Las bandas de pecho se activan solas en cuanto te las colocas sobre el torso humedecido. No requieren configuración previa.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">3</span>
                      Toca "Vincular Reloj" en KAIROS
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Aparecerá en la lista al instante y se conectará con 1 solo toque.
                    </p>
                  </div>
                </div>
              )}

              {/* SAMSUNG GALAXY WATCH */}
              {activeGuideTab === 'samsung' && (
                <div className="space-y-3 animate-fade-up">
                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">1</span>
                      Galaxy Watch 4, 5, 6, 7 (Wear OS)
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Abre Google Play Store en tu reloj e instala la aplicación gratuita <strong>Heart Rate to Bluetooth</strong> o <strong>HR Transmitter</strong>.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">2</span>
                      Inicia la transmisión y vincula en KAIROS
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Pulsa "Start Broadcast" en tu reloj y luego toca <strong>"Vincular Reloj"</strong> en KAIROS.
                    </p>
                  </div>
                </div>
              )}

              {/* NAVEGADORES: ANDROID VS IPHONE */}
              {activeGuideTab === 'browser' && (
                <div className="space-y-3 animate-fade-up">
                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5 text-emerald-400">
                      ✓ Teléfonos Android (Samsung, Xiaomi, Huawei, Motorola)
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Soporte <strong>100% nativo de fábrica</strong>. Solo abre KAIROS en <strong>Google Chrome, Microsoft Edge, Brave o Samsung Internet</strong> y pulsa "Vincular Reloj". No requiere ninguna app adicional en el teléfono.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5 text-amber-400">
                      ⚠ Teléfonos iPhone (iOS)
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Safari en iOS desactiva la conexión Bluetooth web por directiva de Apple.<br />
                      <strong>Solución:</strong> En iPhone, abre KAIROS desde la app gratuita <strong>Bluefy</strong> (navegador oficial WebBLE del App Store). ¡Con Bluefy funciona el Bluetooth con cualquier reloj en iPhone!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stoneborder/70">
              <button
                type="button"
                onClick={() => {
                  setShowGuideModal(false);
                  connectBluetoothHeartRate(true);
                }}
                className="rounded-xl border border-stoneborder bg-background py-2.5 text-xs font-semibold text-brand hover:border-gothic/60"
              >
                Escanear Dispositivos
              </button>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-xl bg-brand py-2.5 text-xs font-bold text-background uppercase tracking-wider"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
