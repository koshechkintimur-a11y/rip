import { NextResponse } from 'next/server';
import { qOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Проверка занятости username в реальном времени (регистрация, настройки).
 * GET /api/auth/check-username?username=xxx → { taken: boolean }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get('username') || '').toLowerCase().trim();
  if (!username || !/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json({ taken: false, valid: false });
  }
  const clash = await qOne(`select id from profiles where username = $1`, [username]);
  return NextResponse.json({ taken: !!clash, valid: true });
}
