import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { dmSchema, containsProfanity } from '@/lib/validation';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';
import { pushToUser } from '@/lib/push/send';

/** GET без параметров: список диалогов. GET ?conversationId=: история переписки. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversationId');

  if (conversationId) {
    // проверка членства
    const conv = await qOne(
      `select id from direct_conversations where id = $1 and (user_a = $2 or user_b = $2)`,
      [conversationId, user.id]
    );
    if (!conv) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });

    const messages = await q(
      `select dm.*, p.username as sender_username, p.avatar_url as sender_avatar_url
       from direct_messages dm left join profiles p on p.id = dm.sender_id
       where dm.conversation_id = $1
       order by dm.created_at asc
       limit 200`,
      [conversationId]
    );
    return NextResponse.json({ messages, conversationId });
  }

  // список диалогов
  const conversations = await q(
    `select c.*,
       case when c.user_a = $1 then c.user_b else c.user_a end as other_id,
       p.username as other_username,
       p.display_name as other_display_name,
       p.avatar_url as other_avatar_url,
       (select count(*) from direct_messages dm
         where dm.conversation_id = c.id and dm.sender_id <> $1 and dm.read_by_recipient = false)::int as unread
     from direct_conversations c
     join profiles p on p.id = case when c.user_a = $1 then c.user_b else c.user_a end
     where c.user_a = $1 or c.user_b = $1
     order by c.created_at desc`,
    [user.id]
  );
  return NextResponse.json({ conversations });
}

/** Отправить сообщение; создаёт диалог при необходимости. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!rateLimit(`dm:${user.id}`, 30, 60_000)) return tooMany();

  const body = await req.json().catch(() => null);
  const parsed = dmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Ошибка' }, { status: 400 });
  }
  const { conversationId, recipientId, content = '', mediaUrl, mediaType } = parsed.data;
  const cleanContent = (content || '').trim();
  if (containsProfanity(cleanContent)) {
    return NextResponse.json({ error: 'Сообщение отклонено фильтром' }, { status: 400 });
  }

  let convId = conversationId || null;
  let otherUserId: string | null = null;

  if (!convId && recipientId) {
    if (recipientId === user.id) return NextResponse.json({ error: 'Нельзя писать себе' }, { status: 400 });
    const a = [user.id, recipientId].sort();
    const existing = await qOne(`select id from direct_conversations where user_a = $1 and user_b = $2`, [a[0], a[1]]);
    if (existing) {
      convId = existing.id;
    } else {
      const created = await qOne<{ id: string }>(
        `insert into direct_conversations (user_a, user_b) values ($1, $2) returning id`, [a[0], a[1]]
      );
      if (!created) return NextResponse.json({ error: 'Не удалось создать диалог' }, { status: 500 });
      convId = created.id;
    }
    otherUserId = recipientId;
  } else if (convId) {
    const conv = await qOne<{ user_a: string; user_b: string }>(
      `select user_a, user_b from direct_conversations where id = $1 and (user_a = $2 or user_b = $2)`,
      [convId, user.id]
    );
    if (!conv) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
    otherUserId = conv.user_a === user.id ? conv.user_b : conv.user_a;
  }

  if (!convId) return NextResponse.json({ error: 'Нет адресата' }, { status: 400 });

  const hasContent = cleanContent.length > 0 || !!mediaUrl;
  let msg = null;
  if (hasContent) {
    msg = await qOne<{ id: string; created_at: string }>(
      `insert into direct_messages (conversation_id, sender_id, content, media_url, media_type)
       values ($1, $2, $3, $4, $5) returning id, created_at`,
      [convId, user.id, cleanContent, mediaUrl || null, mediaType || null]
    );
    await q(`update direct_conversations set last_message = $1 where id = $2`, [cleanContent.slice(0, 80) || '📷', convId]);

    if (otherUserId) {
      void pushToUser(otherUserId, { title: '✉ Личное сообщение', body: cleanContent.slice(0, 60) || '📷', url: '/dm' });
    }
  }

  return NextResponse.json({ ok: true, message: msg, conversationId: convId });
}

/** Отметить диалог прочитанным. */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const conversationId = body?.conversationId as string | undefined;
  if (!conversationId) return NextResponse.json({ error: 'Нет conversationId' }, { status: 400 });

  await q(
    `update direct_messages dm set read_by_recipient = true
     from direct_conversations c
     where dm.conversation_id = c.id and c.id = $1
       and (c.user_a = $2 or c.user_b = $2) and dm.sender_id <> $2`,
    [conversationId, user.id]
  );
  return NextResponse.json({ ok: true });
}
