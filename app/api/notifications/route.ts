import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Уведомления: все ответы ДРУГИХ людей в ветках, где я участвовал
 * (мои корневые сообщения или мои ответы). Новые сверху.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const notifs = await q(
    `select
       a.id as answer_id,
       a.content as answer_content,
       a.created_at as answered_at,
       pa.username as answer_username,
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
     limit 100`,
    [user.id]
  );

  return NextResponse.json({ notifications: notifs });
}
