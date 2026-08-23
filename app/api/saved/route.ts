import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';

/** Мои сохранённые сообщения (архив сезона). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const saved = await q(
    `select sm.*, m.content, m.media_url, m.media_type, m.status, m.survival_count, m.created_at as message_created_at
     from saved_messages sm join messages m on m.id = sm.message_id
     where sm.user_id = $1 order by sm.created_at desc limit 50`,
    [user.id]
  );
  return NextResponse.json({ saved });
}

/** Сохранить своё сообщение (макс 3 за сезон, проверка на сервере). */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const messageId = body?.messageId as string | undefined;
  if (!messageId) return NextResponse.json({ error: 'Нет messageId' }, { status: 400 });

  try {
    await q(`select save_my_message($1, $2)`, [user.id, messageId]);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Не удалось сохранить' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
