/** Простейший in-memory rate limiter (на инстанс; для MVP достаточно). */
const buckets = new Map<string, { count: number; resetAt: number }>();

/** SEC-009: периодическая чистка просроченных бакетов (memory leak). */
const MAX_BUCKETS = 5000;
let lastCleanup = 0;
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000 || buckets.size < MAX_BUCKETS) return;
  lastCleanup = now;
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}

/** SEC-002: реальный IP клиента. Только X-Real-IP (ставит nginx — доверенный).
 *  X-Forwarded-For подделывается клиентом — НЕ используем. Без X-Real-IP
 *  (прямой доступ, dev) все попадают в общий бакет — лимит всё равно работает. */
export function clientIp(req: Request): string {
  return req.headers.get('x-real-ip') || 'anon';
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  cleanup();
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
