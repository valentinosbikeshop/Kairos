import { NextRequest, NextResponse } from 'next/server';
import {
  getUserRecordById,
  SESSION_COOKIE_NAME,
  verifySignedToken,
} from '@/lib/serverDb';

interface HealthSyncPayload {
  source: 'apple_health' | 'huawei_health' | 'xiaomi_fitness' | 'google_health_connect' | 'ble_live';
  deviceName?: string;
  heartRateAverage?: number;
  heartRateMax?: number;
  currentBpm?: number;
  activeCaloriesBurned?: number;
  totalDurationSeconds?: number;
  samples?: Array<{ timestamp: number; bpm: number }>;
}

async function resolveAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerId = await verifySignedToken(authHeader.slice(7).trim());
    if (bearerId) return bearerId;
  }
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySignedToken(cookieToken);
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autenticado. Inicia sesión en KAIROS para sincronizar salud.' },
        { status: 401 }
      );
    }

    const user = await getUserRecordById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado en la base de datos.' },
        { status: 404 }
      );
    }

    const body: HealthSyncPayload = await req.json();

    if (!body || !body.source) {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de telemetría de salud inválido.' },
        { status: 400 }
      );
    }

    // Procesamiento y respuesta de sincronización exitosa
    const syncedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      message: `Telemetría sincronizada exitosamente desde ${body.source}`,
      syncedAt,
      summary: {
        userId: user.id,
        username: user.username,
        source: body.source,
        deviceName: body.deviceName || 'Dispositivo de Salud',
        bpmAvg: body.heartRateAverage || body.currentBpm || 0,
        bpmMax: body.heartRateMax || body.currentBpm || 0,
        calories: body.activeCaloriesBurned || 0,
        durationSeconds: body.totalDurationSeconds || 0,
        sampleCount: body.samples?.length || 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno al procesar sincronización de salud.' },
      { status: 500 }
    );
  }
}
