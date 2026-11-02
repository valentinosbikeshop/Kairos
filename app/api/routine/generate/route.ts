import { NextRequest, NextResponse } from 'next/server';
import { AIRoutineInput, generateScientificRoutine } from '@/lib/aiRoutineEngine';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<AIRoutineInput>;
    const routine = generateScientificRoutine({
      userPrompt: body.userPrompt ?? '',
      daysPerWeek: Number(body.daysPerWeek) || 3,
      minutesPerSession: Number(body.minutesPerSession) || 60,
      equipment: body.equipment ?? 'gym',
      scheduleType: body.scheduleType ?? 'weekday',
      profile: body.profile ?? null,
    });

    return NextResponse.json({
      ok: true,
      routine,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'No se pudo generar la rutina.' },
      { status: 500 }
    );
  }
}
