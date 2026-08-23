import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';

/** Сохранить/удалить подписку Web Push текущего пользователя. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const sub = body?.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    return NextResponse.json({ error: 'Невалидная подписка' }, { status: 400 });
  }

  const existing = await qOne(`select id from push_subscriptions where endpoint = $1`, [sub.endpoint]);
  if (existing) {
    await q(`update push_subscriptions set keys = $1 where id = $2`, [JSON.stringify(sub.keys), existing.id]);
  } else {
    await q(`insert into push_subscriptions (user_id, endpoint, keys) values ($1, $2, $3)`, [
      user.id, sub.endpoint, JSON.stringify(sub.keys),
    ]);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  if (endpoint) {
    await q(`delete from push_subscriptions where user_id = $1 and endpoint = $2`, [user.id, endpoint]);
  }
  return NextResponse.json({ ok: true });
}
