import { NextResponse } from 'next/server';
import { getSessionUser, hashPassword, verifyPassword } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Смена пароля.
 * PATCH /api/auth/change-password { currentPassword, newPassword }
 */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPassword = String(body?.currentPassword || '');
  const newPassword = String(body?.newPassword || '');

  if (newPassword.length < 6) return NextResponse.json({ error: 'Пароль минимум 6 символов' }, { status: 400 });

  const stored = await q(`select password_hash from users where id = $1`, [user.id]);
  const storedHash = stored?.[0]?.password_hash;
  if (!storedHash || !verifyPassword(currentPassword, storedHash)) {
    return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 403 });
  }

  await q(`update users set password_hash = $1 where id = $2`, [hashPassword(newPassword), user.id]);
  // отзываем ВСЕ старые сессии — украденный cookie не должен пережить смену пароля
  await q(`delete from sessions where user_id = $1`, [user.id]);
  return NextResponse.json({ ok: true });
}