import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Уведомления:
 * - comments: ответы ДРУГИХ людей в ветках, где я участвовал
 * - reactions: кто поставил 💀 на мои сообщения
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const [comments, reactions] = await Promise.all([
    q(
      `select
         'comment' as kind,
         a.id as answer_id,
         a.content as answer_content,
         a.created_at as answered_at,
         pa.username as answer_username,
         pa.avatar_url as answer_avatar_url,
         r.id as root_id,
         r.content as root_content,
         (select count(*) from branches b2 where b2.root_message_id = r.id)::int as total_replies,
         exists (
           select 1 from branches bb
           join messages mm on mm.branch_id = bb.id
           where bb.root_message_id = r.id
             and mm.author_id = $1
             and mm.created_at > a.created_at
         ) as is_new
       from messages a
       join profiles pa on pa.id = a.author_id
       join branches b on b.id = a.branch_id
       join messages r on r.id = b.root_message_id
       where a.author_id <> $1
         and a.branch_id is not null
         and a.created_at > now() - interval '7 days'
         and exists (
           select 1 from branches bb2
           join messages mm2 on mm2.branch_id = bb2.id
           where bb2.root_message_id = r.id and mm2.author_id = $1
         )
       order by a.created_at desc
       limit 50`,
      [user.id]
    ),
    q(
      `select
         'reaction' as kind,
         r2.id as reaction_id,
         r2.created_at as reacted_at,
         pu.username as reactor_username,
         pu.avatar_url as reactor_avatar_url,
         m.id as message_id,
         m.content as message_content,
         m.created_at as message_created_at,
         (r2.created_at > coalesce(m.last_seen_at, 'epoch')) as is_new
       from reactions r2
       join profiles pu on pu.id = r2.user_id
       join messages m on m.id = r2.message_id
       where m.author_id = $1
         and r2.user_id <> $1
         and r2.created_at > now() - interval '7 days'
       order by r2.created_at desc
       limit 50`,
      [user.id]
    ),
  ]);

  const all = [...comments, ...reactions] as Array<Record<string, unknown>>;
  all.sort((a, b) => String(b.answered_at || b.reacted_at || '').localeCompare(String(a.answered_at || a.reacted_at || '')));
  return NextResponse.json({ notifications: all });
}
