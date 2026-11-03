import {
  calculateTanakaMaxHeartRate,
  calculateCardioZones,
  getZoneForHeartRate,
  calculateKeytelCaloriesPerMinute,
  parseBluetoothHeartRatePacket,
} from '../lib/cardioTelemetry';

console.log('--- Testing Cardio Telemetry Engine ---');

// 1. Tanaka max heart rate for age 25
const maxHr25 = calculateTanakaMaxHeartRate(25);
console.log('Tanaka age 25:', maxHr25, 'expected around 191');
if (maxHr25 !== 191) throw new Error('Tanaka formula mismatch');

// 2. Cardio zones calculation
const zonesProfile = calculateCardioZones(25, 60);
console.log('Zones profile calculated:');
for (const z of [1, 2, 3, 4, 5] as const) {
  const zInfo = zonesProfile.zones[z];
  console.log(`  Zone ${z} (${zInfo.name}): ${zInfo.minBpm} - ${zInfo.maxBpm} bpm`);
}

// 3. Zone classification
const zAt140 = getZoneForHeartRate(140, zonesProfile);
console.log('BPM 140 zone:', zAt140.name);

// 4. Keytel calories per minute for male, 75kg, 25 years old at 145 bpm
const kcalMinMale = calculateKeytelCaloriesPerMinute({
  heartRate: 145,
  weightKg: 75,
  age: 25,
  sex: 'male',
});
console.log(`Keytel Male 145bpm: ${kcalMinMale.toFixed(2)} kcal/min`);
if (kcalMinMale < 8 || kcalMinMale > 16) throw new Error('Keytel male out of physiological range');

// 5. Test BLE packet parsing
// Packet: flags 0x00 (8-bit, no extra), bpm 135 (0x87)
const buffer = new Uint8Array([0x00, 135]).buffer;
const parsed = parseBluetoothHeartRatePacket(new DataView(buffer));
console.log('Parsed BLE packet:', parsed);
if (parsed.bpm !== 135) throw new Error('BLE parser failed');

console.log('✅ ALL CARDIO TELEMETRY TESTS PASSED!');
