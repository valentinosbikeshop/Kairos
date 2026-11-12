---
name: precision-fitness-telemetry
description: >-
  Precision telemetry and wearable biometrics engineering for fitness tracking.
  Covers Web Bluetooth Low Energy (GATT Heart Rate Service 0x180D), zero-jitter Web Worker
  timers, physiological formulas (Tanaka, Gellish, Karvonen, Keytel calorie expenditure),
  and heart rate zone classification.
---

# Precision Fitness Telemetry & Wearables Engineering

This skill provides mathematical formulas, protocol specifications, and implementation guidelines for capturing, processing, and displaying biometric telemetry in real-time fitness applications.

---

## 1. Zero-Jitter Timer Engineering

### 1.1 Drift Mitigation via Epoch Deltas
Standard JavaScript `setInterval` drifts progressively due to event-loop lag and CPU throttling.
- **Rule**: Never increment timers with `timeElapsed += 1` inside an interval.
- **Implementation**: Reference the hardware epoch clock:
  ```typescript
  const startEpoch = performance.now();
  const targetEpoch = startEpoch + durationMs;

  function tick() {
    const now = performance.now();
    const remainingMs = Math.max(0, targetEpoch - now);
    const elapsedMs = now - startEpoch;
    // update state based on actual elapsed time
  }
  ```

### 1.2 Dedicated Web Worker Implementation
When browser tabs are backgrounded, main-thread timers are throttled to 1000ms intervals.
- Instantiate an inline or separate Web Worker script (`timer.worker.ts`):
  ```typescript
  // Inside worker
  let timerId: number | null = null;
  self.onmessage = (e) => {
    if (e.data.action === 'start') {
      const intervalMs = e.data.interval || 250;
      timerId = self.setInterval(() => {
        self.postMessage({ type: 'tick', timestamp: Date.now() });
      }, intervalMs);
    } else if (e.data.action === 'stop' && timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };
  ```

---

## 2. Web Bluetooth Low Energy (GATT Heart Rate Protocol)

### 2.1 Bluetooth SIG Standards
Heart rate telemetry adheres to the standardized Bluetooth GATT specification:
- **Service UUID**: `0x180D` (`0000180d-0000-1000-8000-00805f9b34fb`) - Heart Rate Service
- **Characteristic UUID**: `0x2A37` (`00002a37-0000-1000-8000-00805f9b34fb`) - Heart Rate Measurement

### 2.2 Device Discovery & Filtering
Modern fitness watches (Huawei Band, Garmin, Polar, Apple Watch with Heart Rate Broadcast, WHOOP, Wahoo TICKR) broadcast heart rate either under standard `0x180D` or require broad scanning:
```typescript
const device = await navigator.bluetooth.requestDevice({
  filters: [{ services: ['heart_rate'] }],
  optionalServices: ['battery_service', 0x180D],
  // Fallback for universal scanning when user pairs non-standard broadcasts:
  // acceptAllDevices: true,
  // optionalServices: ['heart_rate', 0x180D]
});
```

### 2.3 Parsing GATT 0x2A37 DataView Packets
The byte format is bit-flagged:
```typescript
function parseHeartRatePacket(value: DataView): { hr: number; rrIntervals: number[] } {
  const flags = value.getUint8(0);
  const is16Bit = (flags & 0x01) !== 0;
  const hasRr = (flags & 0x10) !== 0;

  let offset = 1;
  const hr = is16Bit ? value.getUint16(offset, /*littleEndian=*/true) : value.getUint8(offset);
  offset += is16Bit ? 2 : 1;

  // Energy Expended (optional: flags & 0x08)
  if (flags & 0x08) offset += 2;

  // RR-Intervals (1/1024 second units)
  const rrIntervals: number[] = [];
  if (hasRr) {
    while (offset + 1 < value.byteLength) {
      const rrRaw = value.getUint16(offset, true);
      rrIntervals.push(Math.round((rrRaw / 1024) * 1000)); // convert to ms
      offset += 2;
    }
  }

  return { hr, rrIntervals };
}
```

---

## 3. Evidence-Based Physiological Formulas

### 3.1 Maximum Heart Rate ($\text{HR}_{\max}$)
The archaic Fox & Haskell formula ($220 - \text{edad}$) has an error margin of $\pm 12 \text{ bpm}$. Use modern validated equations:
- **Tanaka Formula** (Tanaka, Monahan, Seals, 2001; JACC):
  $$\text{HR}_{\max} = 208 - (0.7 \times \text{edad})$$
- **Gellish Formula** (Gellish et al., 2007; MSSE - optimal for endurance athletes):
  $$\text{HR}_{\max} = 207 - (0.7 \times \text{edad})$$

### 3.2 Heart Rate Reserve & Karvonen Method
For athletes with known resting heart rate ($\text{HR}_{\text{rest}}$):
$$\text{HRR} = \text{HR}_{\max} - \text{HR}_{\text{rest}}$$
$$\text{Target HR} = \text{HR}_{\text{rest}} + (\text{HRR} \times \% \text{Intensidad})$$

### 3.3 Five-Zone Physiological Spectrum
| Zona | Nombre | % $\text{HR}_{\max}$ | Fisiología Dominante | RPE (1-10) |
|---|---|---|---|---|
| **Z1** | Recuperación Activa | 50% - 60% | Regeneración tisular, aclaramiento metabólico | 1 - 2 |
| **Z2** | Resistencia Aeróbica Base | 60% - 70% | Biogénesis mitocondrial, oxidación máxima de grasas | 3 - 4 |
| **Z3** | Ritmo / Tempo | 70% - 80% | Umbral aeróbico (LT1), utilización mixta glucógeno/grasa | 5 - 6 |
| **Z4** | Umbral de Lactato | 80% - 90% | Umbral anaeróbico (LT2), acumulación de iones $H^+$ | 7 - 8 |
| **Z5** | $\text{VO}_2\text{ Max}$ / Capacidad Anaeróbica | 90% - 100% | Reclutamiento total fibras rápidas tipo IIb, fosfágeno | 9 - 10 |

### 3.4 Keytel Caloric Expenditure Equation
The peer-reviewed Keytel formula (Keytel et al., 2005; Journal of Sports Sciences) estimates gross energy expenditure from continuous heart rate without a spirometer:

**Para Hombres**:
$$\text{Kcal/min} = \frac{(-55.0969 + (0.6309 \times \text{HR}) + (0.1988 \times \text{Peso}_{\text{kg}}) + (0.2017 \times \text{Edad}))}{4.184}$$

**Para Mujeres**:
$$\text{Kcal/min} = \frac{(-20.4022 + (0.4472 \times \text{HR}) - (0.1263 \times \text{Peso}_{\text{kg}}) + (0.074 \times \text{Edad}))}{4.184}$$
*(Si el resultado es menor a 0 en reposo extremo, acotar al gasto metabólico basal $\sim 1.0\text{--}1.2\text{ kcal/min}$)*.
