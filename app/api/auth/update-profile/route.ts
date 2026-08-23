import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Обновление профиля: username + email (с проверкой занятости).
 * PATCH /api/auth/update-profile { username?, email? }
 */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.toLowerCase().trim() : undefined;
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : undefined;

  if (username !== undefined) {
    if (username.length < 3) return NextResponse.json({ error: 'Ник минимум 3 символа' }, { status: 400 });
    if (username.length > 20) return NextResponse.json({ error: 'Ник максимум 20 символов' }, { status: 400 });
    if (!/^[a-z0-9_]+$/.test(username)) return NextResponse.json({ error: 'Ник: только a-z, 0-9, _' }, { status: 400 });
    const clash = await qOne(`select id from profiles where username = $1 and id <> $2`, [username, user.id]);
    if (clash) return NextResponse.json({ error: 'Ник уже занят' }, { status: 409 });
    await q(`update profiles set username = $1 where id = $2`, [username, user.id]);
  }

  if (email !== undefined) {
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
    const clash = await qOne(`select id from users where email = $1 and id <> $2`, [email, user.id]);
    if (clash) return NextResponse.json({ error: 'Email уже занят' }, { status: 409 });
    await q(`update users set email = $1 where id = $2`, [email, user.id]);
  }

  return NextResponse.json({ ok: true });
}
