import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';

/** Пожаловаться на сообщение. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!rateLimit(`report:${user.id}`, 20, 60_000)) return tooMany();

  const body = await req.json().catch(() => null);
  const messageId = body?.messageId as string | undefined;
  const reason = (body?.reason as string | undefined)?.slice(0, 200) || null;
  if (!messageId) return NextResponse.json({ error: 'Нет messageId' }, { status: 400 });

  const exists = await qOne(`select id from messages where id = $1`, [messageId]);
  if (!exists) return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 });

  await q(`insert into reports (message_id, reporter_id, reason) values ($1, $2, $3)`, [messageId, user.id, reason]);
  return NextResponse.json({ ok: true });
}
