import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { startNextSeason } from '@/lib/season/engine';
import { getLatestSeason } from '@/lib/season/engine';

/** CONTINUE после смерти сезона: создать следующий (идемпотентно — если уже есть активный, вернуть его). */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  // идемпотентность: если уже есть активный сезон — не создаём новый
  const active = await getLatestSeason();
  if (active && (active as any).status === 'active') {
    return NextResponse.json({ ok: true, season: active });
  }

  try {
    const season = await startNextSeason();
    return NextResponse.json({ ok: true, season });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Не удалось создать новый сезон' }, { status: 400 });
  }
}
