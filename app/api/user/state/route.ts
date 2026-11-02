import { NextRequest, NextResponse } from 'next/server';
import {
  extractPublicSnapshot,
  getUserRecordById,
  SESSION_COOKIE_NAME,
  updateUserStateById,
  verifySignedToken,
} from '@/lib/serverDb';

async function resolveAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerId = await verifySignedToken(authHeader.slice(7).trim());
    if (bearerId) return bearerId;
  }
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySignedToken(cookieToken);
}

export async function GET(req: NextRequest) {
  const userId = await resolveAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }
  const record = await getUserRecordById(userId);
  if (!record) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    authenticated: true,
    snapshot: extractPublicSnapshot(record),
  });
}

export async function PUT(req: NextRequest) {
  const userId = await resolveAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Sesión no válida.' }, { status: 401 });
  }
  try {
    const patch = await req.json();
    const updated = await updateUserStateById(userId, patch);
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado.' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      snapshot: extractPublicSnapshot(updated),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Error al sincronizar tus datos.' },
      { status: 500 }
    );
  }
}
