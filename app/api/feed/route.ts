import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { ensureWorldBirth } from '@/lib/season/engine';

export const dynamic = 'force-dynamic';

/** Единая лента: сообщения + системные события, курсорная пагинация. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const url = new URL(req.url);
  const before = url.searchParams.get('before'); // ISO
  const limit = Math.min(Number(url.searchParams.get('limit') || 30), 60);

  const season = await ensureWorldBirth();
  const items = await q(
    `select
       'message' as type, m.id, m.content, m.media_url, m.media_type, m.status,
       m.survival_count::int, m.reaction_count::int, m.created_at, m.author_id,
       p.username, p.display_name, p.avatar_url, m.branch_id,
       m.repost_of_id,
       ro.content as repost_content, ro.media_url as repost_media_url,
       ro.media_type as repost_media_type, rp.username as repost_username,
       (select b.reply_count from branches b where b.root_message_id = m.id) as reply_count,
       exists (
         select 1 from branches bb
         join messages a on a.branch_id = bb.id
         where bb.root_message_id = m.id and a.author_id = $3
       ) as participated,
       coalesce((
         select count(*) from branches bb2
         join messages a2 on a2.branch_id = bb2.id
         where bb2.root_message_id = m.id
           and a2.author_id <> $3
           and a2.created_at > (
             select coalesce(max(aa.created_at), '-infinity') from branches bb3
             join messages aa on aa.branch_id = bb3.id
             where bb3.root_message_id = m.id and aa.author_id = $3
           )
       ), 0)::int as new_after_me,
       null::text as event_kind
     from messages m
     join profiles p on p.id = m.author_id
     left join messages ro on ro.id = m.repost_of_id
     left join profiles rp on rp.id = ro.author_id
     where m.season_id = $1 and m.parent_message_id is null
       and m.status in ('active','legendary')
       and ($2::timestamptz is null or m.created_at < $2)
     union all
     select
       'system' as type, s.id, s.content, null::text, null::text, 'system'::text,
       null::int, null::int, s.created_at, null::uuid,
       null::text, null::text, null::text, null::uuid,
       null::uuid, null::text, null::text, null::text, null::text,
       null::int, null::boolean, null::int,
       s.kind as event_kind
     from system_events s
     where s.season_id = $1 and ($2::timestamptz is null or s.created_at < $2)
     order by created_at desc
     limit $4`,
    [(season as any).id, before || null, user.id, limit]
  );

  return NextResponse.json({ season, items, hasMore: items.length === limit });
}
