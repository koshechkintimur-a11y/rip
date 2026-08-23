import { NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validation';
import { verifyPassword, createSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { qOne } from '@/lib/db';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Нужны email и пароль' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await qOne<{ id: string; password_hash: string }>(
    `select id, password_hash from users where email = $1`, [email]
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
  }

  const token = await createSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
