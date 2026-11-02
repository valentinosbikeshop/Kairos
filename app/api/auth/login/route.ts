import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateAccount,
  createSignedToken,
  extractPublicSnapshot,
  SESSION_COOKIE_NAME,
} from '@/lib/serverDb';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      username?: string;
      password?: string;
    };

    const res = await authenticateAccount({
      username: body.username ?? '',
      password: body.password ?? '',
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 401 });
    }

    const token = await createSignedToken(res.record.id);
    const snapshot = extractPublicSnapshot(res.record);

    const response = NextResponse.json({
      ok: true,
      token,
      snapshot,
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
      { ok: false, error: 'Error al iniciar sesión.' },
      { status: 500 }
    );
  }
}
