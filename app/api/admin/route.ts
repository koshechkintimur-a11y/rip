import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { ensureWorldBirth, getLatestSeason, runDailyReset, runSeasonDeath, startNextSeason } from '@/lib/season/engine';

/** Админ/тест-панель. Доступ: is_test_user или email в ADMIN_EMAILS. */
async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  if (user.is_test_user) return true;
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return admins.includes(user.email);
}

/** Статистика мира. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });

  const season = await ensureWorldBirth();
  const stats = await qOne(`select * from season_statistics where season_id = $1`, [(season as any).id]);
  const users = await q(
    `select p.username, p.display_name, p.is_test_user, w.balance,
       (select count(*) from messages m where m.author_id = p.id)::int as messages_count,
       p.created_at
     from profiles p left join wallets w on w.user_id = p.id
     order by p.created_at asc limit 100`
  );

  return NextResponse.json({ season, stats, users });
}

/** Действия: reset / death / next / grant / system. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = body?.action as string;

  try {
    switch (action) {
      case 'reset': {
        const res = await runDailyReset();
        return NextResponse.json({ ok: true, result: res });
      }
      case 'death': {
        const res = await runSeasonDeath();
        return NextResponse.json({ ok: true, result: res });
      }
      case 'next': {
        const res = await startNextSeason();
        return NextResponse.json({ ok: true, result: res });
      }
      case 'grant': {
        const username = body?.username as string;
        const amount = Number(body?.amount || 0);
        if (!username || !amount) return NextResponse.json({ error: 'Нужны username и amount' }, { status: 400 });
        const profile = await qOne(`select id from profiles where username = $1`, [username]);
        if (!profile) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
        await q(`update wallets set balance = balance + $1 where user_id = $2`, [amount, profile.id]);
        await q(`insert into wallet_transactions (user_id, amount, kind, description) values ($1, $2, 'test_grant', $3)`, [
          profile.id, amount, 'Грант из админки',
        ]);
        return NextResponse.json({ ok: true });
      }
      case 'system': {
        const content = body?.content as string;
        const season = await ensureWorldBirth();
        if (!content) return NextResponse.json({ error: 'Нужен content' }, { status: 400 });
        await q(`insert into system_events (season_id, kind, content) values ($1, 'custom', $2)`, [
          (season as any).id, content,
        ]);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Ошибка' }, { status: 400 });
  }
}
