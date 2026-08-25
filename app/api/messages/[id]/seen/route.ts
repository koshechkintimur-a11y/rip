import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

/**
 * UI-002: отметить уведомления по сообщению прочитанными.
 * Только автор сообщения может отметить своё (last_seen_at на messages).
 */
export async function POST(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await ctx.params;
  await q(`update messages set last_seen_at = now() where id = $1 and author_id = $2`, [id, user.id]);
  return NextResponse.json({ ok: true });
}
