/** Простейший in-memory rate limiter (на инстанс; для MVP достаточно). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

export function tooMany() {
  return Response.json({ error: 'Слишком часто. Подожди немного.' }, { status: 429 });
}
