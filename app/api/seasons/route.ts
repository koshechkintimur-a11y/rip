import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** История сезонов: номера, статусы, статистика сообщений. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const seasons = await q(
    `select s.id, s.number, s.status, s.started_at, s.ends_at, s.duration_seconds, s.last_reset_at, s.created_at,
       (select count(*) from messages m where m.season_id = s.id)::int as total_messages,
       (select count(*) from messages m where m.season_id = s.id and m.status in ('active','legendary'))::int as alive_messages,
       (select count(*) from messages m where m.season_id = s.id and m.status = 'dead')::int as dead_messages,
       (select count(*) from messages m where m.season_id = s.id and m.survival_count >= 5)::int as legendary_messages,
       (select count(*) from messages m where m.season_id = s.id and m.status in ('active','legendary') and m.reaction_count > 0)::int as reacted_messages
     from seasons s
     order by s.number desc
     limit 50`
  );

  return NextResponse.json({ seasons });
}
