import { NextResponse } from 'next/server';
import { signupSchema, containsProfanity } from '@/lib/validation';
import { hashPassword, createSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { q, qOne, withTransaction } from '@/lib/db';
import { rateLimit, tooMany, clientIp } from '@/lib/moderation/rate-limit';

export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientIp(req)}`, 5, 60_000)) return tooMany();

  try {
    return await handle(req);
  } catch (e) {
    console.error('[signup] STACK:', e instanceof Error ? e.stack : String(e));
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }
}

async function handle(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Некорректные данные' }, { status: 400 });
  }
  const { email, password, username } = parsed.data;
  if (containsProfanity(username)) {
    return NextResponse.json({ error: 'Такой ник недопустим' }, { status: 400 });
  }

  // уникальность: проверяем ДО создания
  const clash = await qOne(`select id from profiles where username = $1`, [username]);
  if (clash) return NextResponse.json({ error: 'Ник уже занят' }, { status: 409 });
  const emailClash = await qOne(`select id from users where email = $1`, [email]);
  if (emailClash) return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 409 });

  // транзакция: users + profiles (триггер выдаст 1000 монет)
  return withTransaction(async () => {
    const user = await qOne<{ id: string }>(
      `insert into users (email, password_hash) values ($1, $2) returning id`,
      [email, hashPassword(password)]
    );
    if (!user) return NextResponse.json({ error: 'Ошибка создания пользователя' }, { status: 500 });

    const profile = await qOne<{ id: string }>(
      `insert into profiles (id, username, display_name) values ($1, $2, $2) returning id`,
      [user.id, username]
    );
    if (!profile) return NextResponse.json({ error: 'Ошибка создания профиля' }, { status: 500 });

    const token = await createSession(user.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  });
}
