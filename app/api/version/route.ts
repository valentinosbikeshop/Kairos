import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    'dev';

  return NextResponse.json(
    {
      ok: true,
      buildId,
      checkedAtIso: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
