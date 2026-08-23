import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Сводка для моего профиля: юзер + кошелёк + статистика + сообщения + сохранённые. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const [wallet, stats, messages, saved] = await Promise.all([
    qOne(`select balance from wallets where user_id = $1`, [user.id]),
    qOne(
      `select
         (select count(*) from messages where author_id = $1)::int as total,
         (select count(*) from messages where author_id = $1 and status in ('active','legendary'))::int as alive,
         (select count(*) from messages where author_id = $1 and status = 'dead')::int as dead,
         (select count(*) from messages where author_id = $1 and survival_count >= 5)::int as legendary,
         (select count(*) from branches b join messages m on m.id = b.root_message_id where m.author_id = $1)::int as branches,
         (select count(*) from messages where author_id = $1 and parent_message_id is not null)::int as in_branches`,
      [user.id]
    ),
    q(
      `select id, content, status, survival_count, created_at, died_at
       from messages where author_id = $1
       order by created_at desc limit 100`,
      [user.id]
    ),
    q(
      `select sm.message_id, m.content, sm.label
       from saved_messages sm join messages m on m.id = sm.message_id
       where sm.user_id = $1 order by sm.created_at desc`,
      [user.id]
    ),
  ]);

  return NextResponse.json({
    user: {
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      is_test_user: user.is_test_user,
    },
    wallet: wallet || { balance: 0 },
    stats: stats || { total: 0, alive: 0, dead: 0, legendary: 0, branches: 0, in_branches: 0 },
    messages,
    saved,
  });
}
