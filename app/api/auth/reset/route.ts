import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { hashPassword } from '@/lib/auth';
import { q, qOne } from '@/lib/db';
import { rateLimit, tooMany } from '@/lib/moderation/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Сброс пароля по коду.
 * POST /api/auth/reset { code, password }
 */
export async function POST(req: Request) {
  if (!rateLimit(`reset:${req.headers.get('x-forwarded-for') || 'anon'}`, 5, 60_000)) return tooMany();

  const body = await req.json().catch(() => null);
  const code = String(body?.code || '');
  const password = String(body?.password || '');
  if (!code) return NextResponse.json({ error: 'Нет кода' }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: 'Пароль минимум 6 символов' }, { status: 400 });

  const tokenHash = createHash('sha256').update(code).digest('hex');
  const token = await qOne(
    `select * from password_reset_tokens
     where token_hash = $1 and used_at is null and expires_at > now()`,
    [tokenHash]
  );
  if (!token) {
    return NextResponse.json({ error: 'Ссылка недействительна или истекла' }, { status: 400 });
  }

  await q(`update users set password_hash = $1 where id = $2`, [hashPassword(password), token.user_id]);
  await q(`update password_reset_tokens set used_at = now() where id = $1`, [token.id]);

  return NextResponse.json({ ok: true, message: 'Пароль изменён' });
}
