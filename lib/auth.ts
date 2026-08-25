import crypto from 'crypto';
import { cookies } from 'next/headers';
import { q, qOne } from '@/lib/db';

export const SESSION_COOKIE = 'rip_session';
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false; // SEC-003: telegram-юзеры (password_hash=null) — не 500, а 401
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await q(`insert into sessions (token, user_id, expires_at) values ($1, $2, $3)`, [token, userId, expiresAt]);
  return token;
}

export async function destroySession(token: string) {
  await q(`delete from sessions where token = $1`, [token]);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 3600,
  };
}

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_test_user: boolean;
};

/** Пользователь из сессионной cookie (server-side). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return qOne<SessionUser>(
    `select u.id, u.email, p.username, p.display_name, p.avatar_url, p.bio, p.is_test_user
     from sessions s
     join users u on u.id = s.user_id
     join profiles p on p.id = u.id
     where s.token = $1 and s.expires_at > now()`,
    [token]
  );
}
