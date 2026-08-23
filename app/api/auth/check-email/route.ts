import { NextResponse } from 'next/server';
import { qOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Проверка занятости email (регистрация, настройки). GET /api/auth/check-email?email=... */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get('email') || '').toLowerCase().trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ taken: false, valid: false });
  }
  const clash = await qOne(`select id from users where email = $1`, [email]);
  return NextResponse.json({ taken: !!clash, valid: true });
}
