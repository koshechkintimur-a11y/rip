import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';

type Ctx = { params: Promise<{ username: string }> };

/** Публичный профиль: статистика + архивы сообщений. */
export async function GET(_req: Request, ctx: Ctx) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { username } = await ctx.params;
  const profile = await qOne(
    `select id, username, display_name, avatar_url, bio, created_at from profiles where username = $1`,
    [username]
  );
  if (!profile) return NextResponse.json({ error: 'Не найден' }, { status: 404 });

  const stats = await qOne(
    `select
       (select count(*) from messages where author_id = $1)::int as total,
       (select count(*) from messages where author_id = $1 and status in ('active','legendary'))::int as alive,
       (select count(*) from messages where author_id = $1 and status = 'dead')::int as dead,
       (select count(*) from messages where author_id = $1 and survival_count >= 5)::int as legendary,
       (select count(*) from branches b join messages m on m.id = b.root_message_id where m.author_id = $1)::int as branches,
       (select count(*) from messages where author_id = $1 and parent_message_id is not null)::int as in_branches`,
    [profile.id]
  );

  const survived = await q(
    `select id, content, media_url, media_type, status, survival_count, reaction_count, created_at, died_at
     from messages where author_id = $1 and status in ('active','legendary')
     order by created_at desc limit 50`, [profile.id]
  );
  const dead = await q(
    `select id, content, media_url, media_type, status, survival_count, reaction_count, created_at, died_at
     from messages where author_id = $1 and status = 'dead'
     order by created_at desc limit 50`, [profile.id]
  );
  const myBranches = await q(
    `select m.id, m.content, m.created_at, b.reply_count
     from branches b join messages m on m.id = b.root_message_id
     where m.author_id = $1 order by b.reply_count desc limit 50`, [profile.id]
  );

  return NextResponse.json({ profile, stats, survived, dead, myBranches });
}
