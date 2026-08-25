import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';

/**
 * Черепок на крике (💀 = голос за жизнь крика).
 * Один юзер = один черепок на слот (toggle). Свой крик черепить нельзя.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!rateLimit(`attention-react:${user.id}`, 30, 60_000)) return tooMany();

  const body = await req.json().catch(() => null);
  const slotId = body?.slotId as string | undefined;
  if (!slotId) return NextResponse.json({ error: 'Нет slotId' }, { status: 400 });

  // активируем слоты по расписанию (scheduled → active), чтобы свежий крик можно было черепить
  await q(`select refresh_attention_statuses()`);

  const slot = await qOne<{ user_id: string; skull_count: number; status: string }>(
    `select user_id, skull_count, status from attention_slots where id = $1`,
    [slotId]
  );
  if (!slot) return NextResponse.json({ error: 'Слот не найден' }, { status: 404 });
  if (!['active', 'echo'].includes(slot.status)) return NextResponse.json({ error: 'Крик уже мёртв' }, { status: 400 });
  if (slot.user_id === user.id) return NextResponse.json({ error: 'Свой крик не черепят' }, { status: 400 });

  // toggle: повторный черепок снимает свой голос
  const existing = await qOne(`select id from attention_reactions where slot_id = $1 and user_id = $2`, [slotId, user.id]);
  if (existing) {
    await q(`delete from attention_reactions where id = $1`, [existing.id]);
    await q(`update attention_slots set skull_count = greatest(skull_count - 1, 0) where id = $1`, [slotId]);
  } else {
    await q(`insert into attention_reactions (slot_id, user_id) values ($1, $2)`, [slotId, user.id]);
    await q(`update attention_slots set skull_count = skull_count + 1 where id = $1`, [slotId]);
  }

  const s = await qOne<{ skull_count: number }>(`select skull_count from attention_slots where id = $1`, [slotId]);
  return NextResponse.json({ ok: true, skull_count: s?.skull_count ?? 0, active: !existing });
}
