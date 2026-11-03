import { NextRequest, NextResponse } from 'next/server';
import {
  createSignedToken,
  extractPublicSnapshot,
  resetAccountPassword,
  SESSION_COOKIE_NAME,
} from '@/lib/serverDb';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      username?: string;
      newPassword?: string;
    };

    const res = await resetAccountPassword({
      username: body.username ?? '',
      newPassword: body.newPassword ?? '',
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }

    const token = await createSignedToken(res.record.id);
    const snapshot = extractPublicSnapshot(res.record);

    const response = NextResponse.json({
      ok: true,
      token,
      snapshot,
      message: 'Contraseña actualizada con éxito.',
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'No se pudo restablecer la contraseña. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
