import { NextResponse } from 'next/server';
import { q, qOne } from '@/lib/db';
import { ensureWorldBirth, getLatestSeason, runDailyReset, runSeasonDeath } from '@/lib/season/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron (каждую минуту): GET /api/cron/tick?secret=CRON_SECRET
 * - рождение мира, если сезонов нет
 * - авто-reset раз в ~24 часа (или TEST_SEASON_DURATION/24 для тестов)
 * - смерть сезона, когда ends_at наступил (новый сезон НЕ создаётся сам)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let season = await getLatestSeason();
  if (!season) season = await ensureWorldBirth();
  if (!season) return NextResponse.json({ error: 'no season' }, { status: 500 });

  const results: string[] = [];

  // мир мёртв — ждём CONTINUE
  if ((season as any).status === 'ended') {
    return NextResponse.json({ ok: true, results: ['world_dead'] });
  }

  const now = new Date();
  const endsAt = new Date((season as any).ends_at);
  const lastReset = (season as any).last_reset_at ? new Date((season as any).last_reset_at) : null;
  const startedAt = new Date((season as any).started_at);

  // смерть сезона
  if (now >= endsAt) {
    const res = await runSeasonDeath();
    results.push(`death:${JSON.stringify(res)}`);
    return NextResponse.json({ ok: true, results });
  }

  // авто-reset
  const testDur = Number(process.env.TEST_SEASON_DURATION || 0);
  const resetIntervalMs = testDur > 0 ? (testDur * 1000) / 24 : 24 * 3600 * 1000;
  const due = (!lastReset && now.getTime() - startedAt.getTime() >= resetIntervalMs)
    || (lastReset && now.getTime() - lastReset.getTime() >= resetIntervalMs);
  if (due) {
    const res = await runDailyReset();
    results.push(`reset:${JSON.stringify(res)}`);
  }

  return NextResponse.json({ ok: true, results });
}
