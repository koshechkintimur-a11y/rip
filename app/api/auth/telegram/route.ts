import { NextResponse } from 'next/server';
import { validateTelegramInitData, suggestUsername, TelegramUser } from '@/lib/telegram';
import { createSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Вход через Telegram Mini App (seamless auth).
 * POST /api/auth/telegram { initData, username? }
 * initData — сырые данные Telegram.WebApp.initData (НЕ initDataUnsafe!).
 * Сервер сам проверяет подпись HMAC-SHA256, создаёт/находит аккаунт
 * через auth_identities и выдаёт обычную rip_session.
 */
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'anon';
  if (!rateLimit(`tg:${ip}`, 20, 60_000)) return tooMany();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'Telegram не настроен на сервере' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const initData = typeof body?.initData === 'string' ? body.initData : '';
  const requestedUsername = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const startParam = typeof body?.startParam === 'string' ? body.startParam : '';

  const data = validateTelegramInitData(initData, botToken);
  if (!data) {
    return NextResponse.json({ error: 'Не удалось подтвердить данные Telegram' }, { status: 401 });
  }
  const tgUser: TelegramUser = data.user!;
  const tgId = String(tgUser.id);

  // аналитика: открытие Mini App
  try {
    await q(`insert into telegram_events (user_id, event_type, payload) values (null, 'app_opened', $1)`, [
      JSON.stringify({ tg_id: tgId, start_param: startParam }),
    ]);
  } catch { /* тихо */ }

  // 1. ищем существующую identity
  const identity = await qOne<{ user_id: string }>(
    `select user_id from auth_identities where provider = 'telegram' and provider_user_id = $1`,
    [tgId]
  );

  let userId: string;
  if (identity) {
    userId = identity.user_id;
  } else {
    // 2. новый пользователь: создаём через тот же pipeline (users → profiles → wallet-триггер)
    const isTaken = async (u: string) => {
      const clash = await qOne(`select id from profiles where username = $1`, [u]);
      return !!clash;
    };
    // предложенный ник: от пользователя (onboarding) или из Telegram
    const username = requestedUsername
      ? (await isTaken(requestedUsername) ? await suggestUsername(requestedUsername, isTaken) : requestedUsername)
      : await suggestUsername(tgUser.username, isTaken);

    const email = tgId ? `tg_${tgId}@telegram.rip` : null; // технический уникальный email
    const newUser = await qOne<{ id: string }>(
      `insert into users (email, password_hash) values ($1, null) returning id`,
      [email]
    );
    if (!newUser) return NextResponse.json({ error: 'Не удалось создать аккаунт' }, { status: 500 });

    const profile = await qOne<{ id: string }>(
      `insert into profiles (id, username, display_name, avatar_url) values ($1, $2, $2, $3) returning id`,
      [newUser.id, username, tgUser.photo_url || null]
    );
    if (!profile) {
      await q(`delete from users where id = $1`, [newUser.id]);
      return NextResponse.json({ error: 'Не удалось создать профиль' }, { status: 500 });
    }

    await q(
      `insert into auth_identities (user_id, provider, provider_user_id, metadata) values ($1, 'telegram', $2, $3)`,
      [newUser.id, tgId, JSON.stringify({
        username: tgUser.username || null,
        first_name: tgUser.first_name || null,
        last_name: tgUser.last_name || null,
        photo_url: tgUser.photo_url || null,
      })]
    );

    // реферал из start_param=ref_XXX
    if (startParam.startsWith('ref_')) {
      const refCode = startParam.slice(4);
      const referrer = await qOne(`select id from users where id::text = $1`, [refCode]);
      if (referrer && referrer.id !== newUser.id) {
        await q(
          `insert into referrals (referrer_id, referred_id) values ($1, $2) on conflict do nothing`,
          [referrer.id, newUser.id]
        );
      }
    }

    userId = newUser.id;
  }

  const token = await createSession(userId);
  const res = NextResponse.json({ ok: true, isNew: !identity });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
