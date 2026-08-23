import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { startNextSeason, getActiveSeason } from '@/lib/season/engine';

/** CONTINUE после смерти сезона: вернуть активный сезон (идемпотентно — новый создаётся автоматически при смерти). */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  // идемпотентность: если уже есть активный сезон — возвращаем его (новый рождается в runSeasonDeath)
  const active = await getActiveSeason();
  if (active) {
    return NextResponse.json({ ok: true, season: active });
  }

  try {
    const season = await startNextSeason();
    return NextResponse.json({ ok: true, season });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Не удалось создать новый сезон' }, { status: 400 });
  }
}
