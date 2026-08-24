import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

/** Ветка: корневое сообщение + ответы (любой статус — история важна). */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await ctx.params;

  // один запрос вместо трёх: root + его сезон + счётчик ответов + счётчик репостов
  const root = await qOne(
    `select m.id, m.content, m.media_url, m.media_type, m.status, m.survival_count, m.reaction_count,
            m.created_at, m.author_id, p.username, p.display_name, p.avatar_url, m.branch_id,
            (select b.reply_count from branches b where b.root_message_id = m.id) as reply_count,
            (select count(*) from messages r where r.repost_of_id = m.id)::int as repost_count,
            s.id as season_id, s.number as season_number
     from messages m
     join profiles p on p.id = m.author_id
     left join seasons s on s.id = m.season_id
     where m.id = $1`,
    [id]
  );
  if (!root) return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 });

  const replies = await q(
    `select m.id, m.content, m.media_url, m.media_type, m.status, m.survival_count, m.reaction_count,
            m.created_at, m.author_id, p.username, p.display_name, p.avatar_url, m.branch_id
     from messages m join profiles p on p.id = m.author_id
     where m.parent_message_id = $1
     order by m.created_at asc`,
    [id]
  );

  return NextResponse.json({ root, replies, season: root.season_id ? { id: root.season_id, number: root.season_number } : null });
}
