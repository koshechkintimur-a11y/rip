import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { messageSchema, containsProfanity } from '@/lib/validation';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';
import { ensureWorldBirth, getLatestSeason } from '@/lib/season/engine';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!rateLimit(`msg:${user.id}`, 10, 60_000)) return tooMany();

  const body = await req.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Ошибка' }, { status: 400 });
  }
  const { content, mediaUrl, mediaType, parentMessageId } = parsed.data;
  if (containsProfanity(content)) {
    return NextResponse.json({ error: 'Сообщение отклонено фильтром' }, { status: 400 });
  }

  // мир: если сезона нет — рождение; если мёртв — писать нельзя
  let season = await getLatestSeason();
  if (!season) season = await ensureWorldBirth();
  if ((season as any).status === 'ended') {
    return NextResponse.json({ error: 'Мир мёртв. Нажми CONTINUE, чтобы начать новый сезон.', code: 'world_dead' }, { status: 400 });
  }
  const msg = await qOne(
    `insert into messages (author_id, season_id, content, media_url, media_type, parent_message_id, status)
     values ($1, $2, $3, $4, $5, $6, 'active') returning id, created_at`,
    [user.id, (season as any).id, content, mediaUrl || null, mediaType || null, parentMessageId || null]
  );

  return NextResponse.json({ ok: true, message: msg });
}

/** Репост: сообщение-копия со ссылкой на оригинал. */
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!rateLimit(`repost:${user.id}`, 5, 60_000)) return tooMany();

  const body = await req.json().catch(() => null);
  const originalId = body?.messageId as string | undefined;
  if (!originalId) return NextResponse.json({ error: 'Нет messageId' }, { status: 400 });

  const original = await qOne(
    `select m.id, m.author_id, m.season_id, m.status, m.content, m.media_url, m.media_type
     from messages m where m.id = $1`,
    [originalId]
  );
  if (!original) return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 });

  let season = await getLatestSeason();
  if (!season) season = await ensureWorldBirth();
  if ((season as any).status === 'ended') {
    return NextResponse.json({ error: 'Мир мёртв. Нажми CONTINUE, чтобы начать новый сезон.', code: 'world_dead' }, { status: 400 });
  }

  // репост: только ссылка на оригинал, без копирования контента
  const msg = await qOne(
    `insert into messages (author_id, season_id, content, media_url, media_type, repost_of_id, status)
     values ($1, $2, '', null, null, $3, 'active') returning id, created_at`,
    [user.id, (season as any).id, originalId]
  );

  return NextResponse.json({ ok: true, message: msg });
}