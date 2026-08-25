import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { startNextSeason, getActiveSeason, runSeasonDeath } from '@/lib/season/engine';

/** CONTINUE после смерти сезона: вернуть активный сезон (идемпотентно — новый создаётся автоматически при смерти). */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  // UI-005: клиент показывает death по таймеру, а сервер ещё не запускал cron.
  // Если активный сезон ИСТЁК — завершаем его здесь, чтобы CONTINUE рождал новый.
  const active = await getActiveSeason();
  if (active && new Date((active as any).ends_at).getTime() <= Date.now()) {
    await runSeasonDeath();
    const season = await startNextSeason();
    return NextResponse.json({ ok: true, season });
  }
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
