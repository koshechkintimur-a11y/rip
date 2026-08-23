import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { q, qOne } from '@/lib/db';
import { sendMail } from '@/lib/mail';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Запрос сброса пароля.
 * POST /api/auth/forgot { email } → письмо со ссылкой /reset-password?code=...
 */
export async function POST(req: Request) {
  if (!rateLimit(`forgot:${req.headers.get('x-forwarded-for') || 'anon'}`, 3, 60_000)) return tooMany();

  const body = await req.json().catch(() => null);
  const email = String(body?.email || '').toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
  }

  const user = await qOne(`select id from users where email = $1`, [email]);
  // не выдаём, существует ли аккаунт — всегда отвечаем ok
  if (user) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    // гасим старые токены
    await q(`update password_reset_tokens set used_at = now() where user_id = $1 and used_at is null`, [user.id]);
    await q(
      `insert into password_reset_tokens (user_id, token_hash, expires_at) values ($1, $2, now() + interval '1 hour')`,
      [user.id, tokenHash]
    );
    const base = process.env.APP_URL || 'http://localhost:3002';
    const link = `${base}/reset-password?code=${token}`;
    const mail = await sendMail(
      email,
      'RIP — сброс пароля',
      `<p>Для сброса пароля перейди по ссылке (действует 1 час):</p><p><a href="${link}">${link}</a></p><p>Если ты не запрашивал сброс — проигнорируй это письмо.</p>`
    );
    // dev-режим без SMTP: отдаём код клиенту, чтобы можно было сбросить локально
    if (!mail.sent && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ ok: true, devCode: token, message: 'SMTP не настроен — dev-код для сброса' });
    }
  }

  return NextResponse.json({ ok: true, message: 'Если аккаунт существует, письмо отправлено' });
}
