import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { profileSchema } from '@/lib/validation';

/** Обновить свой профиль. */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Ошибка' }, { status: 400 });
  }
  const { displayName, bio } = parsed.data;

  await q(
    `update profiles set display_name = coalesce($2, display_name), bio = coalesce($3, bio)
     where id = $1`,
    [user.id, displayName ?? null, bio ?? null]
  );
  return NextResponse.json({ ok: true });
}
