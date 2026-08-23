import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { ensureWorldBirth, getLatestSeason, runSeasonDeath } from '@/lib/season/engine';

export const dynamic = 'force-dynamic';

/** Состояние мира: сезон, кошелёк, статистика, счётчики, непрочитанные ЛС. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  // СЕРВЕР авторитетен: если активный сезон просрочен — объявляем смерть здесь же
  // (не ждём cron/админку). Клиент только читает результат.
  let season = await getLatestSeason();
  if (!season) season = await ensureWorldBirth();
  if ((season as any).status === 'active' && new Date((season as any).ends_at).getTime() <= Date.now()) {
    await runSeasonDeath();
    season = await getLatestSeason();
  }

  const seasonId = (season as any).id;

  const [wallet, stats, aliveCount, myAlive, unreadDm] = await Promise.all([
    qOne(`select balance from wallets where user_id = $1`, [user.id]),
    qOne(`select * from season_statistics where season_id = $1`, [seasonId]),
    qOne<{ c: string }>(
      `select count(*)::text as c from messages where season_id = $1 and status in ('active','legendary')`,
      [seasonId]
    ),
    qOne<{ c: string }>(
      `select count(*)::text as c from messages where author_id = $1 and season_id = $2 and status in ('active','legendary')`,
      [user.id, seasonId]
    ),
    qOne<{ c: string }>(
      `select count(*)::text as c
       from direct_messages dm
       join direct_conversations c on c.id = dm.conversation_id
       where (c.user_a = $1 or c.user_b = $1) and dm.sender_id <> $1 and dm.read_by_recipient = false`,
      [user.id]
    ),
  ]);

  return NextResponse.json({
    season,
    wallet: wallet || { balance: 0 },
    stats,
    aliveCount: Number(aliveCount?.c || 0),
    myAlive: Number(myAlive?.c || 0),
    unreadDm: Number(unreadDm?.c || 0),
  });
}
