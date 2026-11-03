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
  ChevronRight,
  HelpCircle,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface HeartRateMonitorWidgetProps {
  compact?: boolean;
  onBpmChange?: (bpm: number, zone: CardioZone) => void;
  onCaloriesUpdate?: (calories: number) => void;
}

type BrandTab = 'xiaomi' | 'huawei' | 'apple' | 'garmin' | 'samsung' | 'browser';

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
  const [scanMode, setScanMode] = useState<'standard' | 'extended'>('standard');

  // Live heart rate metrics
  const [bpm, setBpm] = useState<number>(128); // Initial active baseline
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationBpm, setSimulationBpm] = useState<number>(135);

  // Caloric accumulation
  const [accumulatedCalories, setAccumulatedCalories] = useState<number>(0);
  const [activeSeconds, setActiveSeconds] = useState<number>(0);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [activeGuideTab, setActiveGuideTab] = useState<BrandTab>('xiaomi');

  const bluetoothDeviceRef = useRef<any>(null);
  const gattServerRef = useRef<any>(null);

  // Brand detection based on device name
  const detectedBrand = useMemo(() => {
    if (!deviceName) return null;
    const lower = deviceName.toLowerCase();
    if (lower.includes('xiaomi') || lower.includes('mi ') || lower.includes('redmi') || lower.includes('smart band')) {
      return 'Xiaomi / Redmi';
    }
    if (lower.includes('huawei') || lower.includes('honor') || lower.includes('watch gt') || lower.includes('fit')) {
      return 'Huawei';
    }
    if (lower.includes('apple') || lower.includes('heartcast') || lower.includes('echo')) {
      return 'Apple Watch';
    }
    if (lower.includes('garmin')) {
      return 'Garmin';
    }
    if (lower.includes('polar')) {
      return 'Polar';
    }
    if (lower.includes('galaxy') || lower.includes('samsung')) {
      return 'Samsung Galaxy';
    }
    return 'Pulsómetro BLE';
  }, [deviceName]);

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

  // Web Bluetooth API Heart Rate Service with Multi-Brand Compatibility
  const connectBluetoothHeartRate = async (forceExtended = false) => {
    setBleError(null);

    if (typeof window === 'undefined' || !(navigator as any).bluetooth) {
      setBleError(
        'Web Bluetooth no está habilitado directamente en este navegador. En Android usa Chrome o Edge. En iPhone (iOS) usa la app gratuita Bluefy o activa el Modo Simulación.'
      );
      return;
    }

    try {
      setIsConnecting(true);

      const standardOptions = {
        filters: [
          { services: ['heart_rate'] },
          { namePrefix: 'Mi ' },
          { namePrefix: 'Xiaomi' },
          { namePrefix: 'Redmi' },
          { namePrefix: 'HUAWEI' },
          { namePrefix: 'HONOR' },
          { namePrefix: 'Band' },
          { namePrefix: 'Watch' },
          { namePrefix: 'Polar' },
          { namePrefix: 'Garmin' },
          { namePrefix: 'Heart' },
          { namePrefix: 'Echo' },
        ],
        optionalServices: [
          'heart_rate',
          'battery_service',
          'device_information',
          0x180d,
          '0000180d-0000-1000-8000-00805f9b34fb',
        ],
      };

      const extendedOptions = {
        acceptAllDevices: true,
        optionalServices: [
          'heart_rate',
          'battery_service',
          'device_information',
          0x180d,
          '0000180d-0000-1000-8000-00805f9b34fb',
        ],
      };

      const scanConfig = forceExtended || scanMode === 'extended' ? extendedOptions : standardOptions;

      const device = await (navigator as any).bluetooth.requestDevice(scanConfig);

      bluetoothDeviceRef.current = device;
      setDeviceName(device.name || 'Pulsómetro Inteligente');

      device.addEventListener('gattserverdisconnected', onDisconnected);

      const server = await device.gatt.connect();
      gattServerRef.current = server;

      // Intentar obtener servicio de pulso primario estándar
      let service;
      try {
        service = await server.getPrimaryService('heart_rate');
      } catch {
        // Respaldo por UUID canónico de 128 bits
        service = await server.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
      }

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
        // Cancelado por el usuario
        return;
      }
      setBleError(
        `${err?.message || 'Error al conectar el pulsómetro'}. Tip: Verifica haber activado "Compartir FC" o "Transmitir FC" en tu reloj/app.`
      );
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
            <button
              type="button"
              onClick={() => connectBluetoothHeartRate(false)}
              disabled={isConnecting}
              className="flex items-center gap-1 rounded-lg border border-stoneborder bg-background px-2.5 py-1 text-[11px] font-medium text-brand hover:border-gothic/50 active:scale-95 transition-all shadow-sm"
            >
              {isConnecting ? (
                <RefreshCw className="h-3 w-3 animate-spin text-gothic" />
              ) : (
                <Bluetooth className="h-3 w-3 text-sky-400" />
              )}
              <span>{isConnecting ? 'Buscando...' : 'Vincular Reloj'}</span>
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

      {/* BLE error banner with quick troubleshooting button */}
      {bleError && (
        <div className="rounded-xl border border-status-regress/40 bg-status-regress/10 p-3 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-status-regress font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Nota de vinculación</span>
          </div>
          <p className="text-[11px] text-brand-muted leading-relaxed">{bleError}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => connectBluetoothHeartRate(true)}
              className="rounded-lg bg-status-regress/20 border border-status-regress/40 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-status-regress/30"
            >
              Probar Búsqueda Ampliada (Todos los dispositivos)
            </button>
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="rounded-lg border border-stoneborder bg-background px-2.5 py-1 text-[11px] text-brand-muted hover:text-brand"
            >
              Ver instrucciones de mi reloj
            </button>
          </div>
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
                  { id: 'huawei', label: 'Huawei / Honor' },
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

              {/* HUAWEI & HONOR */}
              {activeGuideTab === 'huawei' && (
                <div className="space-y-3 animate-fade-up">
                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">1</span>
                      En tu Huawei Smart Band (En vivo en pantalla)
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      En la pantalla táctil de la pulsera, desliza y entra en <strong>Ajustes ⚙️</strong> → <strong>Frecuencia Cardíaca</strong> (o <strong>Bluetooth / Sensores</strong>) → Activa <strong>"Transmitir frecuencia cardíaca"</strong> (Broadcast HR).<br />
                      <em>Alternativa:</em> Al iniciar cualquier sesión de ejercicio en la pulsera, desliza hasta la rueda de ajustes del entrenamiento y activa <strong>"Emitir FC"</strong>.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">2</span>
                      En la App "Salud de Huawei" (En tu Teléfono)
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Abre la app <strong>Salud de Huawei</strong> → ve a la pestaña <strong>"Yo"</strong> (abajo a la derecha) → entra en <strong>Gestión de privacidad / Servicios de terceros</strong> → Activa la sincronización con <strong>Google Health Connect</strong> (en Android) o <strong>Salud de Apple</strong> (en iPhone).<br />
                      <em>En Android:</em> Si tu versión de Huawei Health no enlaza directo, instala la app gratuita <strong>Health Sync</strong> para puentear los datos de Salud de Huawei en tiempo real.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stoneborder bg-background p-3.5 space-y-2">
                    <span className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gothic/20 text-gothic text-[11px] font-bold">3</span>
                      Conectar en KAIROS
                    </span>
                    <p className="text-[11px] text-brand-muted">
                      Vuelve a KAIROS, pulsa <strong>"Vincular Reloj"</strong> (o <em>"Búsqueda Ampliada"</em> si tu modelo usa nombre personalizado) y selecciona tu pulsera Huawei. Empezará a medir tus pulsaciones y gasto calórico al instante.
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
