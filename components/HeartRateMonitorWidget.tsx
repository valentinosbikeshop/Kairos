'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useKairos } from '@/lib/kairosContext';
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
  Activity,
  Flame,
  Heart,
  Bluetooth,
  Info,
  Sliders,
  X,
  Check,
  AlertTriangle,
  RefreshCw,
  Watch,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface HeartRateMonitorWidgetProps {
  compact?: boolean;
  onBpmChange?: (bpm: number, zone: CardioZone) => void;
  onCaloriesUpdate?: (calories: number) => void;
}

export function HeartRateMonitorWidget({
  compact = false,
  onBpmChange,
  onCaloriesUpdate,
}: HeartRateMonitorWidgetProps) {
  const { profile } = useKairos();

  // Somatic profile metrics for personalized calculations
  const age = useMemo(() => (profile ? (getProfileAge(profile) ?? 25) : 25), [profile]);
  const weightKg = useMemo(() => profile?.weightKg ?? 75, [profile]);
  const sex = useMemo(() => profile?.sex ?? 'male', [profile]);

  // Calculate personalized cardiovascular zones profile
  const zonesProfile: CardioZonesProfile = useMemo(() => {
    return calculateCardioZones(profile ? profile : age, 60);
  }, [profile, age]);

  // Telemetry state
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);

  // Live heart rate metrics
  const [bpm, setBpm] = useState<number>(128); // Initial active baseline
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationBpm, setSimulationBpm] = useState<number>(135);

  // Caloric accumulation
  const [accumulatedCalories, setAccumulatedCalories] = useState<number>(0);
  const [activeSeconds, setActiveSeconds] = useState<number>(0);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  const bluetoothDeviceRef = useRef<any>(null);
  const gattServerRef = useRef<any>(null);

  // Active zone based on current BPM
  const activeZone = useMemo(() => {
    return getZoneForHeartRate(bpm, zonesProfile);
  }, [bpm, zonesProfile]);

  // Instant calories burned per minute using validated Keytel formula
  const instantKcalPerMin = useMemo(() => {
    return calculateKeytelCaloriesPerMinute({
      heartRate: bpm,
      weightKg,
      age,
      sex,
    });
  }, [bpm, weightKg, age, sex]);

  // Sync callbacks to parent if provided
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

  // Real-time calorie accumulation ticker (every 1 second)
  useEffect(() => {
    // Only accumulate calories if connected or simulating or active
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

  // Simulation mode updater
  useEffect(() => {
    if (isSimulating) {
      setBpm(simulationBpm);
    }
  }, [isSimulating, simulationBpm]);

  // Web Bluetooth API Heart Rate Service (0x180D)
  const connectBluetoothHeartRate = async () => {
    setBleError(null);

    if (typeof window === 'undefined' || !(navigator as any).bluetooth) {
      setBleError(
        'Web Bluetooth no está habilitado directamente en este navegador. Puedes activar el Modo Simulación para probar tus zonas o usar un navegador compatible (Chrome / Edge / Bluefy en iOS).'
      );
      return;
    }

    try {
      setIsConnecting(true);
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service'],
      });

      bluetoothDeviceRef.current = device;
      setDeviceName(device.name || 'Pulsómetro BLE');

      device.addEventListener('gattserverdisconnected', onDisconnected);

      const server = await device.gatt.connect();
      gattServerRef.current = server;

      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');

      await characteristic.startNotifications();
      characteristic.addEventListener(
        'characteristicvaluechanged',
        handleHeartRateCharacteristicValueChanged
      );

      setDeviceConnected(true);
      setIsSimulating(false);
      setIsConnecting(false);
    } catch (err: any) {
      setIsConnecting(false);
      if (err.name === 'NotFoundError') {
        // User cancelled picker
        return;
      }
      setBleError(err?.message || 'Error al conectar el pulsómetro Bluetooth.');
    }
  };

  const handleHeartRateCharacteristicValueChanged = (event: any) => {
    const value: DataView = event.target.value;
    const packet = parseBluetoothHeartRatePacket(value);
    if (packet.bpm > 0) {
      setBpm(packet.bpm);
    }
  };

  const onDisconnected = () => {
    setDeviceConnected(false);
    setDeviceName(null);
  };

  const disconnectBluetooth = () => {
    try {
      if (gattServerRef.current && gattServerRef.current.connected) {
        gattServerRef.current.disconnect();
      }
    } catch {}
    setDeviceConnected(false);
    setDeviceName(null);
  };

  // Pulse animation duration in seconds derived from current BPM
  const pulseDurationSec = useMemo(() => {
    return Math.max(0.3, Math.min(2.0, 60 / Math.max(40, bpm)));
  }, [bpm]);

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
            <h2 className="font-gothic text-xs font-semibold uppercase tracking-wider text-brand">
              Telemetría Cardíaca Live
            </h2>
            <p className="text-[10px] text-brand-muted">
              Fórmula Tanaka ({zonesProfile.maxHeartRate} bpm máx) · Ecuación Keytel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-stoneborder bg-background text-brand-muted hover:text-brand transition-colors"
            title="Guía de conexión Apple Watch / AirPods"
          >
            <Info className="h-3.5 w-3.5" />
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
            <button
              type="button"
              onClick={connectBluetoothHeartRate}
              disabled={isConnecting}
              className="flex items-center gap-1 rounded-lg border border-stoneborder bg-background px-2.5 py-1 text-[11px] font-medium text-brand hover:border-gothic/50 active:scale-95 transition-all"
            >
              {isConnecting ? (
                <RefreshCw className="h-3 w-3 animate-spin text-gothic" />
              ) : (
                <Bluetooth className="h-3 w-3 text-sky-400" />
              )}
              <span>{isConnecting ? 'Buscando...' : 'Vincular BLE'}</span>
            </button>
          )}
        </div>
      </div>

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

      {/* BLE error banner */}
      {bleError && (
        <div className="rounded-xl border border-status-regress/40 bg-status-regress/10 p-3 space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-status-regress font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Nota de compatibilidad BLE</span>
          </div>
          <p className="text-[11px] text-brand-muted leading-relaxed">{bleError}</p>
        </div>
      )}

      {/* Simulation / Manual Testing Slider Controls */}
      <div className="pt-1 border-t border-stoneborder/50">
        <button
          type="button"
          onClick={() => {
            setIsSimulating((prev) => !prev);
            if (!isSimulating) setBpm(simulationBpm);
          }}
          className="w-full flex items-center justify-between text-[11px] text-brand-muted hover:text-brand transition-colors py-1"
        >
          <span className="flex items-center gap-1.5">
            <Sliders className="h-3 w-3 text-gothic" />
            <span>Modo Simulación / Probar Fases Manualmente</span>
          </span>
          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
            isSimulating
              ? 'border-gothic/50 bg-gothic/15 text-gothic font-semibold'
              : 'border-stoneborder text-brand-muted'
          }`}>
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

      {/* Device Connection Modal Guide */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-up">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-stoneborder bg-surface p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stoneborder/70 pb-3">
              <div className="flex items-center gap-2">
                <Watch className="h-4 w-4 text-gothic" />
                <h3 className="font-gothic text-sm font-semibold tracking-wide text-brand">
                  Conexión con Apple Health & Wearables
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

            <div className="space-y-3.5 text-xs text-brand-muted leading-relaxed">
              <div className="rounded-2xl border border-stoneborder bg-background p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-brand font-semibold text-xs">
                  <Watch className="h-4 w-4 text-rose-400" />
                  <span>Apple Watch (Transmisión en Vivo)</span>
                </div>
                <p className="text-[11px]">
                  Debido a la privacidad de iOS, Safari no expone Apple HealthKit directamente a páginas web sin intermediario.
                </p>
                <p className="text-[11px] text-brand">
                  <strong>Método en Tiempo Real (Recomendado):</strong> Instala la app gratuita{' '}
                  <span className="text-gothic font-medium">HeartCast</span> o{' '}
                  <span className="text-gothic font-medium">Echo Heart Rate</span> en tu Apple Watch o iPhone. Estas aplicaciones emiten tu pulso como un sensor Bluetooth BLE estándar (GATT 0x180D), permitiendo a KAIROS recibir tus pulsaciones segundo a segundo.
                </p>
              </div>

              <div className="rounded-2xl border border-stoneborder bg-background p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-brand font-semibold text-xs">
                  <Smartphone className="h-4 w-4 text-sky-400" />
                  <span>AirPods Pro & Auriculares con Pulsómetro</span>
                </div>
                <p className="text-[11px]">
                  Los auriculares deportivos y modelos de AirPods / Beats (como Powerbeats Pro 2) con sensor óptico de frecuencia cardíaca transmiten por el perfil oficial Bluetooth Heart Rate. Pulsa <strong>Vincular BLE</strong> para detectarlos de inmediato.
                </p>
              </div>

              <div className="rounded-2xl border border-stoneborder bg-background p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-brand font-semibold text-xs">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span>Garmin / Polar / Wahoo / Whoop / Coros</span>
                </div>
                <p className="text-[11px]">
                  • <strong>Garmin:</strong> Ve a Menú → Sensores → <em>Emitir frecuencia cardíaca (Broadcast HR)</em>.<br />
                  • <strong>Polar / Wahoo / Coros:</strong> Activa el modo de transmisión BLE o sincroniza tu banda pectoral (Polar H10/Verity Sense) directamente con KAIROS con 1 toque.
                </p>
              </div>

              <div className="rounded-2xl border border-stoneborder bg-background p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-brand font-semibold text-xs">
                  <Flame className="h-4 w-4 text-amber-400" />
                  <span>Cálculo Científico Personalizado</span>
                </div>
                <p className="text-[11px]">
                  • <strong>Zonas Tanaka:</strong> Basadas en tu edad actual calculada desde tu fecha de nacimiento (HRmax = 208 - 0.7 × edad).<br />
                  • <strong>Calorías Keytel:</strong> Estimadas en tiempo real mediante la ecuación del <em>Journal of Sports Sciences</em> combinando sexo biológico, peso corporal ({weightKg} kg), edad ({age} años) y pulso activo.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-xl bg-brand py-2.5 text-xs font-bold text-background uppercase tracking-wider"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
