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

  // SEC-001/004: черепок только чужому, живому сообщению текущего сезона
  const msg = await qOne<{ author_id: string; status: string; season_id: string }>(
    `select author_id, status, season_id from messages where id = $1`,
    [messageId]
  );
  if (!msg) return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 });
  if (msg.author_id === user.id) return NextResponse.json({ error: 'Своё сообщение не черепят' }, { status: 400 });
  if (!['active', 'legendary'].includes(msg.status)) return NextResponse.json({ error: 'Сообщение уже мертво' }, { status: 400 });
  const season = await qOne<{ id: string }>(`select id from seasons where status = 'active' order by number desc limit 1`);
  if (!season || msg.season_id !== season.id) return NextResponse.json({ error: 'Не из этого сезона' }, { status: 400 });

  const existing = await qOne(`select id from reactions where message_id = $1 and user_id = $2`, [messageId, user.id]);
  if (existing) {
    await q(`delete from reactions where id = $1`, [existing.id]);
  } else {
    try {
      await q(`insert into reactions (message_id, user_id) values ($1, $2)`, [messageId, user.id]);
    } catch (e: any) {
      // SEC-013: параллельный запрос уже вставил реакцию → unique violation → 409, не 500
      if (e?.code === '23505') {
        return NextResponse.json({ error: 'Уже отреагировал' }, { status: 409 });
      }
      throw e;
    }
  }
  const m = await qOne<{ reaction_count: number }>(`select reaction_count from messages where id = $1`, [messageId]);
  return NextResponse.json({ ok: true, reaction_count: m?.reaction_count ?? 0, active: !existing });
}
