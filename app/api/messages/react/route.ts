import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';

/** Переключить реакцию (💀) на сообщении. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!rateLimit(`react:${user.id}`, 30, 60_000)) return tooMany();

  const body = await req.json().catch(() => null);
  const messageId = body?.messageId as string | undefined;
  if (!messageId) return NextResponse.json({ error: 'Нет messageId' }, { status: 400 });

  const existing = await qOne(`select id from reactions where message_id = $1 and user_id = $2`, [messageId, user.id]);
  if (existing) {
    await q(`delete from reactions where id = $1`, [existing.id]);
  } else {
    await q(`insert into reactions (message_id, user_id) values ($1, $2)`, [messageId, user.id]);
  }
  const m = await qOne<{ reaction_count: number }>(`select reaction_count from messages where id = $1`, [messageId]);
  return NextResponse.json({ ok: true, reaction_count: m?.reaction_count ?? 0, active: !existing });
}
